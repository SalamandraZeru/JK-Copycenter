import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import type { OrderStatus } from '@/types';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { canProductionAdvanceOrder } from '@/lib/orders/operation';

export const dynamic = 'force-dynamic';

interface OrderFileRecord {
  id: string;
  original_name: string;
  size_bytes: number;
  mime_type: string;
  status: string;
  expires_at: string | null;
  deleted_at: string | null;
}

const statusSchema = z.object({
  status: z.enum(['confirmed', 'in_production', 'ready', 'completed', 'cancelled']),
  notes: z.string().trim().min(1).max(2000),
  idempotencyKey: z.string().uuid(),
  allowUnpaidConfirmation: z.boolean().optional().default(false),
}).strict();

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireApiAdminPermission('read_orders');
    if (!auth.success) return auth.errorResponse;
    if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do pedido inválido' }, { status: 400 });

    const supabase = createServiceRoleClient();

    const select = auth.session.role === 'producao'
      ? `
        id, order_number, status, payment_status, created_at, delivery_type,
        order_items (id, service_name_snapshot, product_name_snapshot, fields_snapshot, pages_count, quantity),
        order_files (id, original_name, size_bytes, mime_type, status, expires_at, deleted_at)
      `
      : `
        *,
        order_items (*),
        order_price_adjustments (
          id,
          order_item_id,
          previous_item_total_cents,
          new_item_total_cents,
          previous_order_subtotal_cents,
          new_order_subtotal_cents,
          previous_order_total_cents,
          new_order_total_cents,
          reason,
          created_at,
          admin_users (full_name)
        ),
        order_events (*),
        order_payment_events (*),
        order_files (id, original_name, size_bytes, mime_type, status, expires_at, deleted_at)
      `;
    const { data: rawData, error } = await supabase
      .from('orders')
      .select(select)
      .eq('id', params.id)
      .single();

    if (error) throw error;
    const data = rawData as unknown as { order_files?: OrderFileRecord[]; [key: string]: unknown } | null;
    if (!data) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

    const rawFiles = (data.order_files || []) as unknown as OrderFileRecord[];
    const files = rawFiles.filter((file) => !file.deleted_at);

    return NextResponse.json({ ...data, files, operationView: auth.session.role === 'producao' ? 'production' : 'admin' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar pedido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireApiAdminPermission('update_orders');
    if (!auth.success) return auth.errorResponse;
    if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do pedido inválido' }, { status: 400 });
    const session = auth.session;

    const supabase = createServiceRoleClient();
    
    const parsed = await parseAdminJson(request, statusSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;
    const { status, notes, idempotencyKey, allowUnpaidConfirmation } = body;
    if (session.role === 'producao') {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('status, payment_status')
        .eq('id', params.id)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order || !canProductionAdvanceOrder(session.role, order.status, order.payment_status, status)) {
        return NextResponse.json({ error: 'Produção só pode avançar pedidos pagos pela sequência operacional.' }, { status: 403 });
      }
    }
    if (allowUnpaidConfirmation && (status !== 'confirmed' || session.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Exceção de confirmação exige super_admin e destino confirmado.' }, { status: 403 });
    }
    const { data, error } = await supabase.rpc('transition_order_status', {
      p_order_id: params.id,
      p_admin_user_id: session.id,
      p_to_status: status as OrderStatus,
      p_note: notes,
      p_idempotency_key: idempotencyKey,
      p_allow_unpaid_confirmation: Boolean(allowUnpaidConfirmation),
    });
    if (error) {
      if (error.message.includes('ORDER_NOT_FOUND')) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
      if (error.message.includes('INVALID_ORDER_STATE_TRANSITION') || error.message.includes('ORDER_CONFIRMATION_REQUIRES_PAYMENT')) {
        return NextResponse.json({ error: 'Transição de status não permitida.' }, { status: 409 });
      }
      if (error.message.includes('PREPRESS_APPROVAL_REQUIRED')) {
        return NextResponse.json({ error: 'A arte deste pedido ainda precisa ser aprovada antes de entrar em produção.' }, { status: 409 });
      }
      throw error;
    }
    const result = data?.[0];
    if (!result) throw new Error('ORDER_TRANSITION_EMPTY');
    return NextResponse.json({ success: true, status: result.order_status, replayed: result.replayed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar pedido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
