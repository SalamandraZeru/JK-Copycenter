import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';

export const dynamic = 'force-dynamic';

const paymentSchema = z.object({
  action: z.enum(['paid', 'rejected', 'cancelled']),
  note: z.string().trim().min(1).max(2000),
  externalReference: z.string().trim().max(256).optional(),
  idempotencyKey: z.string().uuid(),
}).strict();

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireApiAdminPermission('payments_confirm');
    if (!auth.success) return auth.errorResponse;
    if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do pedido inválido' }, { status: 400 });

    const parsed = await parseAdminJson(request, paymentSchema);
    if (!parsed.success) return parsed.errorResponse;
    const { action, note, externalReference, idempotencyKey } = parsed.data;

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc('process_manual_payment', {
      p_order_id: params.id,
      p_admin_user_id: auth.session.id,
      p_action: action,
      p_note: note,
      p_external_reference: externalReference || null,
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      if (error.message.includes('ORDER_NOT_FOUND')) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
      if (error.message.includes('PAYMENT_ALREADY_FINALIZED') || error.message.includes('ORDER_NOT_AWAITING_PAYMENT')) {
        return NextResponse.json({ error: 'O pagamento deste pedido já não pode ser alterado.' }, { status: 409 });
      }
      throw error;
    }
    const result = data?.[0];
    if (!result) throw new Error('PAYMENT_TRANSITION_EMPTY');
    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao registrar pagamento';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
