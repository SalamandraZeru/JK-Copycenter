import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { enforceCloudflareRateLimit } from '@/lib/security/cloudflare-rate-limit';
import { pushSubscriptionSchema } from '@/lib/push/subscription';

export const dynamic = 'force-dynamic';

const MAX_DEVICES_PER_ORDER = 5;

const bodySchema = z.object({
  orderId: z.string().uuid(),
  // Código de acompanhamento do pedido: obrigatório para quem comprou sem conta.
  orderCode: z.string().uuid().optional(),
  subscription: pushSubscriptionSchema,
}).strict();

/** Inscreve este aparelho para receber avisos quando o pedido mudar de etapa. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ error: 'Requisição não autorizada.' }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  const limit = await enforceCloudflareRateLimit(request, 'JK_PUSH_SUBSCRIBE_RATE_LIMIT', 'push-order', { userId: user?.id ?? null });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde um instante.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  }

  const { orderId, orderCode, subscription } = parsed.data;
  const supabase = createServiceRoleClient();
  const { data: order } = await supabase
    .from('orders')
    .select('id, user_id, order_token, status')
    .eq('id', orderId)
    .maybeSingle();

  const ownsOrder = order && (
    (order.user_id && user?.id === order.user_id)
    || (!order.user_id && orderCode !== undefined && orderCode === order.order_token)
  );
  if (!order || !ownsOrder) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  if (order.status === 'completed' || order.status === 'cancelled') {
    return NextResponse.json({ error: 'Este pedido já foi encerrado.' }, { status: 409 });
  }

  const { count } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('audience', 'customer')
    .eq('order_id', orderId)
    .neq('endpoint', subscription.endpoint);
  if ((count ?? 0) >= MAX_DEVICES_PER_ORDER) {
    return NextResponse.json({ error: 'Limite de aparelhos para este pedido atingido.' }, { status: 409 });
  }

  await supabase.from('push_subscriptions').delete()
    .eq('audience', 'customer').eq('order_id', orderId).eq('endpoint', subscription.endpoint);
  const { error } = await supabase.from('push_subscriptions').insert({
    audience: 'customer',
    order_id: orderId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  });
  if (error) return NextResponse.json({ error: 'Não foi possível ativar os avisos.' }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}
