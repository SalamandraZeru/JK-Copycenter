import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// Report-only by design. Physical cleanup remains unavailable until the owner
// separately approves a reviewed deletion run.
Deno.serve(async (request: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    return Response.json({ success: false, error: 'CRON_SECRET_NOT_CONFIGURED' }, { status: 500 });
  }
  if (request.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ success: false, error: 'MISSING_SERVICE_CONFIGURATION' }, { status: 500 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const reportAt = new Date();
    const reportKey = `edge-daily:${reportAt.toISOString().slice(0, 10)}`;

    const { count: eligibleCount, error: eligibleError } = await supabase
      .from('order_files')
      .select('id', { count: 'exact', head: true })
      .not('storage_path', 'is', null)
      .is('storage_deleted_at', null)
      .or(`expires_at.lte.${reportAt.toISOString()},deleted_at.not.is.null,status.in.(rejected,expired,deleted,error),cleanup_required.eq.true`);
    if (eligibleError) throw eligibleError;

    const { count: expiredIntentCount, error: intentError } = await supabase
      .from('order_files')
      .select('id', { count: 'exact', head: true })
      .is('storage_path', null)
      .in('status', ['intended', 'uploading', 'processing'])
      .lte('intent_expires_at', reportAt.toISOString());
    if (intentError) throw intentError;

    const details = {
      report_at: reportAt.toISOString(),
      deletion_performed: false,
      approval_required: true,
      source: 'edge_function',
    };
    const { data: run, error: runError } = await supabase
      .from('file_retention_runs')
      .upsert({
        run_key: reportKey,
        mode: 'report',
        status: 'completed',
        eligible_count: eligibleCount || 0,
        expired_intent_count: expiredIntentCount || 0,
        details,
        completed_at: reportAt.toISOString(),
      }, { onConflict: 'run_key' })
      .select('id')
      .single();
    if (runError || !run) throw runError || new Error('RETENTION_REPORT_FAILED');

    const { error: auditError } = await supabase.from('audit_logs').insert({
      admin_user_id: null,
      action: 'file_retention_report',
      entity: 'file_retention_runs',
      entity_id: run.id,
      old_value: null,
      new_value: {
        eligible_count: eligibleCount || 0,
        expired_intent_count: expiredIntentCount || 0,
        deletion_performed: false,
      },
      ip_address: null,
    });
    if (auditError) throw auditError;

    return Response.json({
      success: true,
      runId: run.id,
      eligibleCount: eligibleCount || 0,
      expiredIntentCount: expiredIntentCount || 0,
      deletionPerformed: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RETENTION_REPORT_FAILED';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});
