import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { validateCsrfOrigin } from '@/lib/security/csrf';

export const dynamic = 'force-dynamic';

const adjustmentSchema = z.object({
  orderItemId: z.string().uuid(),
  newTotalCents: z.coerce.number().int().min(0).max(100_000_000),
  reason: z.string().trim().min(3).max(2000),
  idempotencyKey: z.string().uuid(),
  expectedOrderVersion: z.coerce.number().int().min(1),
}).strict();

function adjustmentError(message: string): { error: string; status: number } {
  if (message.includes('ORDER_NOT_FOUND')) return { error: 'Pedido não encontrado.', status: 404 };
  if (message.includes('ORDER_ITEM_NOT_FOUND')) return { error: 'Item não pertence a este pedido.', status: 404 };
  if (message.includes('ORDER_PRICE_ADJUSTMENT_LOCKED')) return { error: 'O valor só pode ser ajustado antes da confirmação do pagamento.', status: 409 };
  if (message.includes('ORDER_PRICE_VERSION_CONFLICT')) return { error: 'O pedido foi alterado por outra pessoa. Atualize a página antes de registrar novo ajuste.', status: 409 };
  if (message.includes('ORDER_PRICE_ADJUSTMENT_NO_CHANGE')) return { error: 'Informe um valor diferente do total atual do item.', status: 409 };
  if (message.includes('ORDER_PRICE_REASON_REQUIRED')) return { error: 'Informe uma justificativa com ao menos 3 caracteres.', status: 400 };
  if (message.includes('ORDER_PRICE_INVALID')) return { error: 'O novo valor é inválido.', status: 400 };
  return { error: message, status: 500 };
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const params = await props.params;
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ error: 'Requisição não autorizada.' }, { status: 403 });
  }
  const auth = await requireApiAdminPermission('payments_confirm');
  if (!auth.success) return auth.errorResponse;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do pedido inválido.' }, { status: 400 });

  const parsed = await parseAdminJson(request, adjustmentSchema);
  if (!parsed.success) return parsed.errorResponse;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc('adjust_order_item_price', {
      p_order_id: params.id,
      p_order_item_id: parsed.data.orderItemId,
      p_admin_user_id: auth.session.id,
      p_new_total_cents: parsed.data.newTotalCents,
      p_reason: parsed.data.reason,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_expected_order_version: parsed.data.expectedOrderVersion,
    });
    if (error) throw error;
    const result = data?.[0];
    if (!result) throw new Error('ORDER_PRICE_ADJUSTMENT_EMPTY');
    return NextResponse.json({ success: true, data: result });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : 'Não foi possível ajustar o valor do pedido.';
    const mapped = adjustmentError(message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
