import { NextResponse, type NextRequest } from 'next/server';
import type { Json } from '@/types/supabase';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { enforceCloudflareRateLimit } from '@/lib/security/cloudflare-rate-limit';
import { isUuid } from '@/lib/security/admin-input';
import { customerQuoteActionSchema, quoteCommandHash } from '@/lib/orders/manual-quote';

export const dynamic = 'force-dynamic';

type QuoteActor =
  | { userId: string; guestToken: null }
  | { userId: null; guestToken: string };

interface QuoteOrderAccess {
  id: string;
  order_number: string;
  user_id: string | null;
  order_token: string;
  guest_access_expires_at: string | null;
  order_kind: string;
  quote_status: string;
  latest_quote_version: number;
}

async function authorizeOrder(
  request: NextRequest,
  orderId: string,
  suppliedToken?: string,
): Promise<{ order: QuoteOrderAccess; actor: QuoteActor } | null> {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from('orders')
    .select('id, order_number, user_id, order_token, guest_access_expires_at, order_kind, quote_status, latest_quote_version')
    .eq('id', orderId)
    .maybeSingle();
  if (!data || data.order_kind !== 'graphic_quote') return null;

  if (data.user_id && user?.id === data.user_id) {
    return { order: data, actor: { userId: user.id, guestToken: null } };
  }
  const token = suppliedToken?.trim();
  if (!data.user_id && token && isUuid(token) && data.order_token === token
      && data.guest_access_expires_at
      && new Date(data.guest_access_expires_at).getTime() > Date.now()) {
    return { order: data, actor: { userId: null, guestToken: token } };
  }
  return null;
}

function publicQuoteError(message: string): { error: string; status: number } {
  if (message.includes('QUOTE_VERSION_CONFLICT') || message.includes('QUOTE_SCOPE_CHANGED')) {
    return { error: 'A proposta mudou. Atualize a página antes de responder.', status: 409 };
  }
  if (message.includes('QUOTE_EXPIRED')) return { error: 'Esta proposta expirou. Solicite uma nova versão à equipe.', status: 409 };
  if (message.includes('QUOTE_NOT_ACCEPTABLE') || message.includes('QUOTE_NOT_DECLINABLE')) {
    return { error: 'Esta proposta não está mais disponível para essa ação.', status: 409 };
  }
  if (message.includes('QUOTE_ACCESS_DENIED')) return { error: 'Acesso à proposta negado.', status: 403 };
  if (message.includes('QUOTE_IDEMPOTENCY_CONFLICT')) return { error: 'Esta tentativa já foi usada com outra resposta.', status: 409 };
  if (message.includes('QUOTE_DELIVERY_ADDRESS_INVALID') || message.includes('QUOTE_FULFILLMENT_INVALID')) {
    return { error: 'Revise a forma de pagamento e os dados de entrega.', status: 400 };
  }
  return { error: 'Não foi possível registrar sua resposta.', status: 500 };
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const params = await props.params;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 });
  const access = await authorizeOrder(request, params.id, request.headers.get('x-quote-request-code') || undefined);
  if (!access) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 });

  const limit = await enforceCloudflareRateLimit(request, 'JK_PRICING_PREVIEW_RATE_LIMIT', 'quote-read', {
    userId: access.actor.userId,
    guestSessionHash: access.actor.guestToken ? quoteCommandHash(access.actor.guestToken) : null,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Muitas consultas. Aguarde um instante.' }, {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfterSeconds) },
    });
  }

  const admin = createServiceRoleClient();
  const [{ data: orderItems, error: itemError }, { data: quotes, error: quoteError }] = await Promise.all([
    admin
      .from('order_items')
      .select('id, service_name_snapshot, quantity, fields_snapshot')
      .eq('order_id', access.order.id)
      .order('created_at', { ascending: true }),
    admin
      .from('order_quotes')
      .select(`
        id, version, subtotal_cents, delivery_fee_cents, total_cents,
        commercial_observation, change_reason, expires_at, created_at,
        order_quote_items (
          id, order_item_id, line_position, label_snapshot, quantity,
          unit_price_cents, total_price_cents, scope_snapshot
        )
      `)
      .eq('order_id', access.order.id)
      .order('version', { ascending: false }),
  ]);
  if (itemError || quoteError) {
    return NextResponse.json({ error: 'Proposta temporariamente indisponível.' }, { status: 503 });
  }

  return NextResponse.json({
    success: true,
    data: {
      order: {
        id: access.order.id,
        orderNumber: access.order.order_number,
        quoteStatus: access.order.quote_status,
        latestQuoteVersion: access.order.latest_quote_version,
      },
      items: orderItems || [],
      quotes: quotes || [],
    },
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' } });
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const params = await props.params;
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ error: 'Requisição não autorizada.' }, { status: 403 });
  }
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 });

  const parsed = customerQuoteActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Revise sua resposta e os dados informados.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const access = await authorizeOrder(request, params.id, parsed.data.requestCode);
  if (!access) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 });

  const limit = await enforceCloudflareRateLimit(request, 'JK_PRICING_PREVIEW_RATE_LIMIT', 'quote-action', {
    userId: access.actor.userId,
    guestSessionHash: access.actor.guestToken ? quoteCommandHash(access.actor.guestToken) : null,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde um instante.' }, {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfterSeconds) },
    });
  }

  const normalized = {
    orderId: access.order.id,
    action: parsed.data.action,
    quoteId: parsed.data.quoteId,
    expectedQuoteVersion: parsed.data.expectedQuoteVersion,
    note: parsed.data.note || null,
    paymentMethod: parsed.data.paymentMethod || null,
    deliveryType: parsed.data.deliveryType || null,
    deliveryAddress: parsed.data.deliveryAddress || null,
  };
  const hash = quoteCommandHash(normalized);
  const admin = createServiceRoleClient();

  try {
    const response = parsed.data.action === 'accept'
      ? await admin.rpc('accept_order_quote_with_fulfillment', {
          p_order_id: access.order.id,
          p_quote_id: parsed.data.quoteId,
          p_expected_quote_version: parsed.data.expectedQuoteVersion,
          p_actor_user_id: access.actor.userId,
          p_guest_order_token: access.actor.guestToken,
          p_idempotency_key: parsed.data.idempotencyKey,
          p_request_hash: hash,
          p_payment_method: parsed.data.paymentMethod!,
          p_delivery_type: parsed.data.deliveryType!,
          p_delivery_address: (parsed.data.deliveryAddress || null) as Json,
        })
      : await admin.rpc('decline_order_quote', {
          p_order_id: access.order.id,
          p_quote_id: parsed.data.quoteId,
          p_expected_quote_version: parsed.data.expectedQuoteVersion,
          p_actor_user_id: access.actor.userId,
          p_guest_order_token: access.actor.guestToken,
          p_note: parsed.data.note || '',
          p_idempotency_key: parsed.data.idempotencyKey,
          p_request_hash: hash,
        });
    if (response.error) throw response.error;
    const result = response.data?.[0];
    if (!result) throw new Error('QUOTE_RESPONSE_EMPTY');
    return NextResponse.json({ success: true, data: result });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'QUOTE_ACTION_FAILED';
    const mapped = publicQuoteError(message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
