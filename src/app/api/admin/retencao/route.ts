import { NextResponse } from 'next/server';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { createServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const auth = await requireApiAdminPermission('read_audit');
  if (!auth.success) return auth.errorResponse;

  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();
  const [eligible, failures, runs, retention] = await Promise.all([
    supabase.from('order_files').select('id', { count: 'exact', head: true })
      .not('storage_path', 'is', null).is('storage_deleted_at', null)
      .or(`retention_due_at.lte.${now},cleanup_required.eq.true`),
    supabase.from('order_files').select('id', { count: 'exact', head: true })
      .eq('cleanup_required', true).is('storage_deleted_at', null),
    supabase.from('file_retention_runs')
      .select('id, mode, status, eligible_count, processed_count, deleted_count, missing_count, failed_count, started_at, completed_at')
      .order('started_at', { ascending: false }).limit(30),
    supabase.from('system_config').select('value').eq('key', 'data_retention_days').maybeSingle(),
  ]);

  if (eligible.error || failures.error || runs.error || retention.error) {
    return NextResponse.json({ error: 'Não foi possível carregar o relatório de retenção.' }, { status: 500 });
  }

  return NextResponse.json({
    retentionDays: Number(retention.data?.value || 15),
    eligibleCount: eligible.count || 0,
    failureCount: failures.count || 0,
    runs: runs.data || [],
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
