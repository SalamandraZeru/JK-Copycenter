import type { Order, OrderItemWithFiles } from '@/types/checkout';

export interface WhatsAppOrderInput {
  orderNumber?: string | undefined;
  order_number?: string | undefined;
  customerName?: string | null | undefined;
  customer_name?: string | null | undefined;
  customerPhone?: string | null | undefined;
  customer_phone?: string | null | undefined;
  guestName?: string | null | undefined;
  guest_name?: string | null | undefined;
  guestPhone?: string | null | undefined;
  guest_phone?: string | null | undefined;
  deliveryType?: string | undefined;
  delivery_type?: string | undefined;
  paymentMethod?: string | undefined;
  payment_method?: string | undefined;
  subtotal?: number | undefined;
  subtotal_cents?: number | undefined;
  deliveryFee?: number | undefined;
  delivery_fee?: number | undefined;
  delivery_fee_cents?: number | undefined;
  total?: number | undefined;
  total_cents?: number | undefined;
  hasEstimates?: boolean | undefined;
  has_estimates?: boolean | undefined;
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function conciseText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 280) : null;
}

export function buildWhatsAppMessage(
  order: Order | WhatsAppOrderInput | Record<string, unknown>,
  items: OrderItemWithFiles[],
): string {
  const orderRecord = order as Record<string, unknown>;
  const orderNumber = String(orderRecord.orderNumber ?? orderRecord.order_number ?? '');
  const customerName = String(
    orderRecord.customerName ??
    orderRecord.customer_name ??
    orderRecord.guestName ??
    orderRecord.guest_name ??
    'Cliente'
  );
  const customerPhone = String(
    orderRecord.customerPhone ??
    orderRecord.customer_phone ??
    orderRecord.guestPhone ??
    orderRecord.guest_phone ??
    ''
  );
  const deliveryType = String(orderRecord.deliveryType ?? orderRecord.delivery_type ?? 'pickup');
  const paymentMethod = String(orderRecord.paymentMethod ?? orderRecord.payment_method ?? 'pix');
  const subtotal = Number(orderRecord.subtotal ?? (Number(orderRecord.subtotal_cents ?? 0) / 100));
  const deliveryFee = Number(
    orderRecord.deliveryFee
    ?? orderRecord.delivery_fee
    ?? (Number(orderRecord.delivery_fee_cents ?? 0) / 100)
  );
  const total = Number(orderRecord.total ?? (Number(orderRecord.total_cents ?? 0) / 100));
  const hasEstimates = Boolean(orderRecord.hasEstimates ?? orderRecord.has_estimates);
  const paymentMethods: Record<string, string> = {
    pix: 'PIX',
    card: 'Cartão',
    cash: 'Dinheiro',
  };

  const itemSummary = items.map((item) => {
    const itemRecord = item as unknown as Record<string, unknown>;
    const name = String(
      item.productNameSnapshot ?? itemRecord.product_name_snapshot ??
      item.serviceNameSnapshot ?? itemRecord.service_name_snapshot ?? 'Item'
    );
    const quantity = Math.max(1, Number(item.quantity ?? 1));
    const pageCount = Math.max(0, Number(item.pageCount ?? itemRecord.pages_count ?? 0));
    const description = conciseText(
      String(item.serviceDescriptionSnapshot ?? itemRecord.service_description_snapshot ?? '')
    );
    const itemTotal = Number(item.totalPrice ?? itemRecord.total_price ?? (Number(itemRecord.total_price_cents ?? 0) / 100));
    const details = [
      `Quantidade: ${quantity}x`,
      ...(pageCount > 0 ? [`Páginas por cópia: ${pageCount}`] : []),
      ...(description ? [`Configuração: ${description}`] : []),
      ...(Number.isFinite(itemTotal) ? [`Total do item: ${formatCurrency(itemTotal)}`] : []),
    ];
    return `- *${name}*\n  ${details.join(' · ')}`;
  }).join('\n') || '- Itens do pedido';

  // A mensagem e um resumo operacional: nunca inclui arquivos, paths, links
  // privados, chave Pix, endereco completo, dados de cartao ou aprovacao.
  return [
    '*NOVO PEDIDO — JK COPYCENTER*',
    `Pedido: #${orderNumber}`,
    '',
    '*Resumo de itens:*',
    itemSummary,
    '',
    `Subtotal: ${formatCurrency(subtotal)}`,
    `Entrega: ${deliveryFee > 0 ? formatCurrency(deliveryFee) : 'Grátis'}`,
    `${hasEstimates ? 'Total estimado' : 'Total calculado'}: ${formatCurrency(total)}`,
    `Pagamento pretendido: ${paymentMethods[paymentMethod] || paymentMethod}`,
    `Cliente: ${customerName}`,
    `Contato: ${customerPhone || 'não informado'}`,
    `Entrega: ${deliveryType === 'delivery' ? 'Entrega' : 'Retirada na loja'}`,
    '',
    ...(hasEstimates ? ['Atenção: a contagem de páginas é estimada; a equipe confirmará o valor final antes do pagamento.'] : []),
    'Pagamento pendente de confirmação pela equipe.',
  ].join('\n');
}

export function buildWhatsAppUrl(
  message: string,
  whatsappNumber: string
): string {
  const cleanNumber = whatsappNumber.replace(/[^0-9]/g, '');
  if (!/^[0-9]{8,15}$/.test(cleanNumber)) throw new Error('WHATSAPP_NUMBER_INVALID');
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}
