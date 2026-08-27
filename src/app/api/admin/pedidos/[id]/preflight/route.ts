import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { validateCsrfOrigin } from '@/lib/security/csrf';

export const dynamic = 'force-dynamic';

const reviewSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(['correction_requested', 'awaiting_customer_approval', 'approved_for_production']),
  staffNote: z.string().trim().min(1).max(2000),
  customerApprovalRequired: z.boolean().default(true),
}).strict();

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireApiAdminPermission('read_orders');
  if (!auth.success) return auth.errorResponse;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do pedido inválido.' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('order_file_preflight_reports')
    .select('id, order_id, order_file_id, order_item_id, file_content_sha256, status, automation_summary, structure_summary, graphics_summary, findings, customer_approval_required, staff_note, reviewed_by, reviewed_at, created_at, updated_at, order_files (id, original_name, page_count, page_count_method, mime_type)')
    .eq('order_id', params.id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reports: data ?? [] });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ error: 'Requisição não autorizada.' }, { status: 403 });
  }
  const auth = await requireApiAdminPermission('update_orders');
  if (!auth.success) return auth.errorResponse;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do pedido inválido.' }, { status: 400 });
  const parsed = await parseAdminJson(request, reviewSchema);
  if (!parsed.success) return parsed.errorResponse;
  const body = parsed.data;

  if (body.status === 'approved_for_production' && body.customerApprovalRequired) {
    return NextResponse.json({ error: 'Desative a exigência de aprovação do cliente para liberar diretamente a produção.' }, { status: 409 });
  }

  const supabase = createServiceRoleClient();
  const { data: current, error: currentError } = await supabase
    .from('order_file_preflight_reports')
    .select('id, order_id, order_file_id, status')
    .eq('id', body.reportId)
    .eq('order_id', params.id)
    .maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Relatório de pré-impressão não encontrado.' }, { status: 404 });

  const { data, error } = await supabase
    .from('order_file_preflight_reports')
    .update({
      status: body.status,
      customer_approval_required: Boolean(body.customerApprovalRequired),
      staff_note: body.staffNote,
      reviewed_by: auth.session.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.id)
    .select('id, status, customer_approval_required, staff_note, reviewed_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(supabase, auth.session.id, 'review_artwork_preflight', 'order_file_preflight_reports', current.id, {
    order_id: params.id,
    previous_status: current.status,
    status: body.status,
    customer_approval_required: Boolean(body.customerApprovalRequired),
  });
  return NextResponse.json({ success: true, report: data });
}
