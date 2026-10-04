import { NextResponse } from 'next/server';
import type { Json } from '@/types/supabase';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { dispatchPush, notifyCustomerOrderUpdate } from '@/lib/push/notify';
import {
  adminQuoteCommandSchema,
  buildQuoteWhatsAppMessage,
  quoteCommandHash,
} from '@/lib/orders/manual-quote';

export const dynamic = 'force-dynamic';

function quoteError(message: string): { error: string; status: number } {
  if (message.includes('ORDER_NOT_FOUND')) return { error: 'Solicitação não encontrada.', status: 404 };
  if (message.includes('ORDER_NOT_GRAPHIC_QUOTE')) return { error: 'Este pedido não é uma solicitação gráfica.', status: 409 };
  if (message.includes('QUOTE_VERSION_CONFLICT')) return { error: 'A solicitação foi alterada por outro operador. Atualize a página.', status: 409 };
  if (message.includes('QUOTE_STATE_LOCKED')) return { error: 'O estado atual não permite emitir ou revisar a proposta.', status: 409 };
  if (message.includes('QUOTE_OPERATION_INVALID')) return { error: 'Emissão ou revisão incompatível com a versão atual.', status: 409 };
  if (message.includes('QUOTE_IDEMPOTENCY_CONFLICT')) return { error: 'A mesma tentativa já foi usada com outro conteúdo.', status: 409 };
  if (message.includes('QUOTE_ACTOR_NOT_AUTHORIZED')) return { error: 'Seu perfil não pode gerenciar orçamentos.', status: 403 };
  if (message.includes('QUOTE_OBSERVATION_REQUIRED')) return { error: 'Inclua uma observação comercial na proposta.', status: 400 };
  if (message.includes('QUOTE_CHANGE_REASON_REQUIRED')) return { error: 'Explique o motivo da revisão.', status: 400 };
  if (message.includes('QUOTE_EXPIRATION_INVALID')) return { error: 'A validade precisa estar no futuro.', status: 400 };
  if (message.includes('QUOTE_ITEMS_INVALID')) return { error: 'Revise os itens e valores da proposta.', status: 400 };
  return { error: 'Não foi possível registrar o orçamento.', status: 500 };
}

function customerActionUrl(request: Request, order: {
  id: string;
  user_id: string | null;
  order_token: string;
}): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  let origin = new URL(request.url).origin;
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        origin = url.origin;
      }
    } catch {
      // O origin da própria requisição continua sendo o fallback local seguro.
    }
  }
  return order.user_id
    ? `${origin}/dashboard/pedidos/${order.id}`
    : `${origin}/orcamento/${order.id}#${order.order_token}`;
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const params = await props.params;
  const auth = await requireApiAdminPermission('manage_quotes');
  if (!auth.success) return auth.errorResponse;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID da solicitação inválido.' }, { status: 400 });

  const parsed = await parseAdminJson(request, adminQuoteCommandSchema);
  if (!parsed.success) return parsed.errorResponse;

  try {
    const supabase = createServiceRoleClient();
    const [{ data: order, error: orderError }, { data: storedItems, error: itemsError }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, order_token, user_id, order_kind, quote_status, latest_quote_version')
        .eq('id', params.id)
        .maybeSingle(),
      supabase
        .from('order_items')
        .select('id, quantity, service_name_snapshot, fields_snapshot')
        .eq('order_id', params.id)
        .order('created_at', { ascending: true }),
    ]);
    if (orderError || itemsError) throw orderError || itemsError;
    if (!order) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 });
    if (order.order_kind !== 'graphic_quote') {
      return NextResponse.json({ error: 'Este pedido não é uma solicitação gráfica.' }, { status: 409 });
    }

    const suppliedValues = new Map(parsed.data.items.map((item) => [item.orderItemId, item.unitPriceCents]));
    if (storedItems.length !== suppliedValues.size || storedItems.some((item) => !suppliedValues.has(item.id))) {
      return NextResponse.json({ error: 'A proposta precisa incluir todos os itens atuais uma única vez.' }, { status: 409 });
    }

    const rpcItems = storedItems.map((item) => {
      const unitPriceCents = suppliedValues.get(item.id);
      if (unitPriceCents === undefined) throw new Error('QUOTE_ITEMS_INVALID');
      return {
        order_item_id: item.id,
        label_snapshot: item.service_name_snapshot || 'Serviço gráfico',
        quantity: item.quantity,
        unit_price_cents: unitPriceCents,
        total_price_cents: unitPriceCents * item.quantity,
        scope_snapshot: item.fields_snapshot,
      };
    });
    const normalized = {
      operation: parsed.data.operation,
      expectedQuoteVersion: parsed.data.expectedQuoteVersion,
      commercialObservation: parsed.data.commercialObservation,
      changeReason: parsed.data.changeReason || null,
      expiresAt: parsed.data.expiresAt,
      deliveryFeeCents: parsed.data.deliveryFeeCents,
      items: rpcItems,
    };
    const requestHash = quoteCommandHash(normalized);
    const common = {
      p_order_id: params.id,
      p_admin_user_id: auth.session.id,
      p_expected_quote_version: parsed.data.expectedQuoteVersion,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_request_hash: requestHash,
      p_commercial_observation: parsed.data.commercialObservation,
      p_expires_at: parsed.data.expiresAt,
      p_delivery_fee_cents: parsed.data.deliveryFeeCents,
      p_items: rpcItems as unknown as Json,
    };
    const response = parsed.data.operation === 'issue'
      ? await supabase.rpc('issue_order_quote', common)
      : await supabase.rpc('revise_order_quote', {
          ...common,
          p_change_reason: typeof parsed.data.changeReason === 'string' ? parsed.data.changeReason : '',
        });
    if (response.error) throw response.error;
    const result = response.data?.[0];
    if (!result) throw new Error('QUOTE_RESPONSE_EMPTY');
    if (!result.replayed) {
      dispatchPush(notifyCustomerOrderUpdate(supabase, order.id, { type: 'quote_issued' }));
    }

    const actionUrl = customerActionUrl(request, order);
    const message = buildQuoteWhatsAppMessage({
      orderNumber: order.order_number,
      version: result.quote_version,
      totalCents: result.total_cents,
      expiresAt: parsed.data.expiresAt,
      commercialObservation: parsed.data.commercialObservation,
      customerActionUrl: actionUrl,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        customerActionUrl: actionUrl,
        whatsappMessage: message,
      },
    }, { status: result.replayed ? 200 : 201 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'QUOTE_FAILED';
    const mapped = quoteError(message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
