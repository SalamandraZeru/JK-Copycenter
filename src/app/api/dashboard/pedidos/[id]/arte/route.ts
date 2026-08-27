import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { validateCsrfOrigin } from '@/lib/security/csrf';

export const dynamic = 'force-dynamic';

const decisionSchema = z.object({
  reportId: z.string().uuid(),
  decision: z.enum(['approved', 'correction_requested']),
  note: z.string().trim().max(1000).optional(),
}).strict();

const revisionSchema = z.object({
  reportId: z.string().uuid(),
  fileId: z.string().uuid(),
}).strict();

async function getOwnedOrder(orderId: string) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { user: null, order: null };
  const service = createServiceRoleClient();
  const { data: order } = await service
    .from('orders')
    .select('id, user_id, artwork_status')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .maybeSingle();
  return { user, order };
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  const { user, order } = await getOwnedOrder(params.id);
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('order_file_preflight_reports')
    .select('id, order_id, order_file_id, file_content_sha256, status, automation_summary, structure_summary, graphics_summary, findings, customer_approval_required, staff_note, reviewed_at, created_at, updated_at, order_files (id, original_name, page_count, page_count_method, mime_type)')
    .eq('order_id', params.id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ artworkStatus: order.artwork_status, reports: data ?? [] });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ error: 'Requisição não autorizada.' }, { status: 403 });
  }
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  const parsed = await parseAdminJson(request, decisionSchema);
  if (!parsed.success) return parsed.errorResponse;
  const { user, order } = await getOwnedOrder(params.id);
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

  const service = createServiceRoleClient();
  const { data: report, error: reportError } = await service
    .from('order_file_preflight_reports')
    .select('id, order_id, order_file_id, file_content_sha256, status, customer_approval_required')
    .eq('id', parsed.data.reportId)
    .eq('order_id', order.id)
    .maybeSingle();
  if (reportError) return NextResponse.json({ error: reportError.message }, { status: 500 });
  if (!report) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 });
  if (report.status !== 'awaiting_customer_approval' || !report.customer_approval_required) {
    return NextResponse.json({ error: 'Esta versão não está aguardando sua decisão.' }, { status: 409 });
  }

  const { error: approvalError } = await service.from('order_artwork_approvals').insert({
    order_id: order.id,
    report_id: report.id,
    order_file_id: report.order_file_id,
    approved_file_sha256: report.file_content_sha256,
    decision: parsed.data.decision,
    approved_by_user_id: user.id,
    guest_email: null,
    note: parsed.data.note || null,
  });
  if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 500 });

  const status = parsed.data.decision === 'approved' ? 'approved_for_production' : 'correction_requested';
  const { error: updateError } = await service
    .from('order_file_preflight_reports')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', report.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ success: true, status });
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ error: 'Requisição não autorizada.' }, { status: 403 });
  }
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  const parsed = await parseAdminJson(request, revisionSchema);
  if (!parsed.success) return parsed.errorResponse;
  const { user, order } = await getOwnedOrder(params.id);
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

  const service = createServiceRoleClient();
  const { data: report } = await service
    .from('order_file_preflight_reports')
    .select('id, order_item_id, status')
    .eq('id', parsed.data.reportId)
    .eq('order_id', order.id)
    .maybeSingle();
  if (!report) return NextResponse.json({ error: 'Relatório não encontrado.' }, { status: 404 });
  if (report.status !== 'correction_requested') {
    return NextResponse.json({ error: 'A nova versão só pode ser enviada após uma solicitação de correção.' }, { status: 409 });
  }

  const { data: file, error: fileError } = await service
    .from('order_files')
    .select('id, status, order_id, user_id, deleted_at')
    .eq('id', parsed.data.fileId)
    .eq('user_id', user.id)
    .is('order_id', null)
    .is('deleted_at', null)
    .maybeSingle();
  if (fileError) return NextResponse.json({ error: fileError.message }, { status: 500 });
  if (!file || !['ready', 'confirmed'].includes(file.status)) {
    return NextResponse.json({ error: 'O arquivo enviado ainda não está pronto para revisão.' }, { status: 409 });
  }

  const { error: attachError } = await service
    .from('order_files')
    .update({ order_id: order.id, order_item_id: report.order_item_id })
    .eq('id', file.id)
    .is('order_id', null);
  if (attachError) return NextResponse.json({ error: attachError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
