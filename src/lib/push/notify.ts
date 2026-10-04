import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { OrderStatus } from '@/types/index';
import { sendWebPush, type VapidKeys } from './web-push';

type Client = SupabaseClient<Database>;

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export type CustomerOrderEvent =
  | { type: 'status'; status: OrderStatus }
  | { type: 'quote_issued' };

function vapidKeys(): VapidKeys | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  const subject = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://')
    ? process.env.NEXT_PUBLIC_SITE_URL
    : 'https://jk-copycenter.jkcopycenterpassos.workers.dev';
  return { publicKey, privateKey, subject };
}

/**
 * Roda o envio depois da resposta (waitUntil do Worker), para o push nunca
 * atrasar nem derrubar a ação do admin ou do cliente.
 */
export function dispatchPush(task: Promise<unknown>): void {
  const guarded = task.catch(() => undefined);
  try {
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(guarded);
  } catch {
    // Fora do Worker (dev local): a promessa segue sozinha.
  }
}

async function deliver(
  supabase: Client,
  rows: Array<{ id: string; endpoint: string; p256dh: string; auth: string; failure_count: number }>,
  message: PushMessage,
): Promise<number> {
  const vapid = vapidKeys();
  if (!vapid || rows.length === 0) return 0;
  let sent = 0;
  await Promise.all(rows.map(async (row) => {
    const result = await sendWebPush(row, message, vapid, { topic: message.tag });
    if (result === 'sent') {
      sent += 1;
      await supabase.from('push_subscriptions')
        .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
        .eq('id', row.id);
    } else if (result === 'gone' || row.failure_count >= 4) {
      // Aparelho desinscrito ou falhando sempre: remove a inscrição.
      await supabase.from('push_subscriptions').delete().eq('id', row.id);
    } else {
      await supabase.from('push_subscriptions').update({ failure_count: row.failure_count + 1 }).eq('id', row.id);
    }
  }));
  return sent;
}

const SUBSCRIPTION_COLUMNS = 'id, endpoint, p256dh, auth, failure_count';

export async function notifyAdminsNewOrder(
  supabase: Client,
  order: { id: string; orderNumber: string; kind: 'quote' | 'order' },
): Promise<number> {
  const { data } = await supabase
    .from('push_subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('audience', 'admin');
  return deliver(supabase, data ?? [], {
    title: order.kind === 'quote' ? 'Novo pedido de orçamento' : 'Novo pedido na loja',
    body: `Pedido #${order.orderNumber} acabou de chegar. Toque para abrir.`,
    url: `/admin/pedidos/${order.id}`,
    tag: `admin-order-${order.orderNumber}`,
  });
}

export async function notifyAdminsQuoteAnswer(
  supabase: Client,
  order: { id: string; orderNumber: string; accepted: boolean },
): Promise<number> {
  const { data } = await supabase
    .from('push_subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('audience', 'admin');
  return deliver(supabase, data ?? [], {
    title: order.accepted ? 'Orçamento aceito' : 'Orçamento recusado',
    body: `O cliente ${order.accepted ? 'aceitou' : 'recusou'} o orçamento do pedido #${order.orderNumber}.`,
    url: `/admin/pedidos/${order.id}`,
    tag: `admin-quote-${order.orderNumber}`,
  });
}

export function customerMessage(
  event: CustomerOrderEvent,
  order: { orderNumber: string; deliveryType: string | null },
): Pick<PushMessage, 'title' | 'body'> | null {
  const number = `#${order.orderNumber}`;
  if (event.type === 'quote_issued') {
    return { title: 'Seu orçamento está pronto', body: `Confira o valor do pedido ${number} e responda pelo site.` };
  }
  switch (event.status) {
    case 'awaiting_payment':
      return { title: `Pedido ${number}: aguardando pagamento`, body: 'Assim que o pagamento for confirmado, começamos a produção.' };
    case 'confirmed':
      return { title: `Pagamento confirmado`, body: `O pedido ${number} foi confirmado e vai para a produção.` };
    case 'in_production':
      return { title: `Pedido ${number} em produção`, body: 'Já estamos trabalhando no seu pedido.' };
    case 'ready':
      return order.deliveryType === 'delivery'
        ? { title: `Pedido ${number} pronto!`, body: 'Seu pedido está pronto e sai para entrega em breve.' }
        : { title: `Pedido ${number} pronto!`, body: 'Pode retirar na loja. Te esperamos!' };
    case 'completed':
      return { title: `Pedido ${number} finalizado`, body: 'Obrigado por escolher a JK Copycenter!' };
    case 'cancelled':
      return { title: `Pedido ${number} cancelado`, body: 'Se tiver alguma dúvida, fale com a gente pelo WhatsApp.' };
    default:
      return null;
  }
}

export async function notifyCustomerOrderUpdate(
  supabase: Client,
  orderId: string,
  event: CustomerOrderEvent,
): Promise<number> {
  const [{ data: order }, { data: rows }] = await Promise.all([
    supabase.from('orders').select('id, order_number, user_id, order_token, delivery_type').eq('id', orderId).maybeSingle(),
    supabase.from('push_subscriptions').select(SUBSCRIPTION_COLUMNS).eq('audience', 'customer').eq('order_id', orderId),
  ]);
  if (!order || !rows?.length) return 0;
  const content = customerMessage(event, { orderNumber: order.order_number, deliveryType: order.delivery_type });
  if (!content) return 0;

  // Mesmo destino do link enviado pelo WhatsApp; o código fica no fragmento (#), que não vai ao servidor.
  const url = order.user_id
    ? `/dashboard/pedidos/${order.id}`
    : event.type === 'quote_issued' ? `/orcamento/${order.id}#${order.order_token}` : '/pedido';
  const sent = await deliver(supabase, rows, {
    ...content,
    url,
    tag: `order-${order.order_number}`,
  });

  // Pedido encerrado: não há mais avisos a dar, então o aparelho deixa de ser guardado.
  if (event.type === 'status' && (event.status === 'completed' || event.status === 'cancelled')) {
    await supabase.from('push_subscriptions').delete().eq('audience', 'customer').eq('order_id', orderId);
  }
  return sent;
}
