import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type CleanupMode = 'dry_run' | 'execute';

interface EligibleFile {
  id: string;
  storage_path: string;
}

const jsonHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
  'Referrer-Policy': 'no-referrer',
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function cleanOperationalError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'RETENTION_STORAGE_ERROR';
  const token = raw.match(/[A-Z][A-Z0-9_]{2,63}/)?.[0];
  return token || 'RETENTION_STORAGE_ERROR';
}

function splitStoragePath(path: string): { folder: string; name: string } {
  const separator = path.lastIndexOf('/');
  if (separator < 0) return { folder: '', name: path };
  return { folder: path.slice(0, separator), name: path.slice(separator + 1) };
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) return json({ success: false, error: 'CRON_SECRET_NOT_CONFIGURED' }, 500);
  if (request.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return json({ success: false, error: 'UNAUTHORIZED' }, 401);
  }

  const url = new URL(request.url);
  const mode: CleanupMode = url.searchParams.get('mode') === 'execute' ? 'execute' : 'dry_run';
  const requestedBatch = Number(url.searchParams.get('batch') || '50');
  const batchSize = Number.isSafeInteger(requestedBatch)
    ? Math.min(100, Math.max(1, requestedBatch))
    : 50;

  if (mode === 'execute') {
    const executionToken = Deno.env.get('RETENTION_EXECUTION_TOKEN');
    if (!executionToken || request.headers.get('X-Retention-Execution-Token') !== executionToken) {
      return json({ success: false, error: 'RETENTION_EXECUTION_NOT_AUTHORIZED' }, 403);
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: 'MISSING_SERVICE_CONFIGURATION' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const startedAt = new Date();
  const runKey = `edge:${mode}:${startedAt.toISOString()}:${crypto.randomUUID()}`;
  let runId: string | null = null;

  try {
    const { data: run, error: runError } = await supabase
      .from('file_retention_runs')
      .insert({
        run_key: runKey,
        mode,
        status: 'running',
        details: { source: 'edge_function', batch_size: batchSize },
        started_at: startedAt.toISOString(),
        completed_at: startedAt.toISOString(),
      })
      .select('id')
      .single();
    if (runError || !run) throw runError || new Error('RETENTION_RUN_CREATE_FAILED');
    runId = run.id;

    const now = new Date().toISOString();
    const { data, error: eligibleError } = await supabase
      .from('order_files')
      .select('id, storage_path')
      .not('storage_path', 'is', null)
      .is('storage_deleted_at', null)
      .or(`retention_due_at.lte.${now},cleanup_required.eq.true`)
      .order('retention_due_at', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true })
      .limit(batchSize);
    if (eligibleError) throw eligibleError;

    const eligible = (data || []).filter((file): file is EligibleFile => Boolean(file.storage_path));
    let deletedCount = 0;
    let missingCount = 0;
    let failedCount = 0;

    if (mode === 'execute') {
      for (const file of eligible) {
        const attemptedAt = new Date().toISOString();
        try {
          const { folder, name } = splitStoragePath(file.storage_path);
          const { data: beforeRemoval, error: beforeError } = await supabase.storage
            .from('order-files')
            .list(folder, { limit: 10, search: name });
          if (beforeError) throw new Error('RETENTION_STORAGE_VERIFY_FAILED');
          const existedBeforeRemoval = (beforeRemoval || []).some((object) => object.name === name);

          const { error: removeError } = await supabase.storage
            .from('order-files')
            .remove([file.storage_path]);
          if (removeError) throw new Error('RETENTION_STORAGE_REMOVE_FAILED');

          const { data: remaining, error: verifyError } = await supabase.storage
            .from('order-files')
            .list(folder, { limit: 10, search: name });
          if (verifyError) throw new Error('RETENTION_STORAGE_VERIFY_FAILED');
          if ((remaining || []).some((object) => object.name === name)) {
            throw new Error('RETENTION_STORAGE_OBJECT_STILL_PRESENT');
          }

          const { error: reconcileError } = await supabase
            .from('order_files')
            .update({
              status: 'deleted',
              storage_deleted_at: attemptedAt,
              storage_path: null,
              cleanup_required: false,
              cleanup_last_attempt_at: attemptedAt,
              cleanup_last_error: null,
            })
            .eq('id', file.id)
            .eq('storage_path', file.storage_path)
            .is('storage_deleted_at', null);
          if (reconcileError) throw new Error('RETENTION_DATABASE_RECONCILE_FAILED');
          if (existedBeforeRemoval) deletedCount += 1;
          else missingCount += 1;
        } catch (error) {
          failedCount += 1;
          await supabase.rpc('increment_file_cleanup_failure', {
            p_file_id: file.id,
            p_attempted_at: attemptedAt,
            p_error_code: cleanOperationalError(error),
          });
        }
      }
    }

    const completedAt = new Date().toISOString();
    const finalStatus = failedCount > 0 ? (deletedCount > 0 ? 'partial' : 'failed') : 'completed';
    const details = {
      source: 'edge_function',
      batch_size: batchSize,
      deletion_performed: mode === 'execute',
      more_may_remain: eligible.length === batchSize,
    };
    const { error: finalizeError } = await supabase
      .from('file_retention_runs')
      .update({
        status: finalStatus,
        eligible_count: eligible.length,
        processed_count: mode === 'execute' ? eligible.length : 0,
        deleted_count: deletedCount,
        missing_count: missingCount,
        failed_count: failedCount,
        details,
        completed_at: completedAt,
      })
      .eq('id', runId);
    if (finalizeError) throw finalizeError;

    await supabase.from('audit_logs').insert({
      admin_user_id: null,
      action: mode === 'execute' ? 'file_retention_executed' : 'file_retention_dry_run',
      entity: 'file_retention_runs',
      entity_id: runId,
      old_value: null,
      new_value: {
        eligible_count: eligible.length,
        deleted_count: deletedCount,
        failed_count: failedCount,
      },
      ip_address: null,
    });

    return json({
      success: true,
      runId,
      mode,
      eligibleCount: eligible.length,
      processedCount: mode === 'execute' ? eligible.length : 0,
      deletedCount,
      missingCount,
      failedCount,
      moreMayRemain: eligible.length === batchSize,
    });
  } catch (error) {
    if (runId) {
      await supabase
        .from('file_retention_runs')
        .update({
          status: 'failed',
          failed_count: 1,
          details: { source: 'edge_function', error: cleanOperationalError(error) },
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId);
    }
    return json({ success: false, error: cleanOperationalError(error), runId }, 500);
  }
});
