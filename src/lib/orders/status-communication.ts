import type { OrderStatus } from '@/types';

const STATUS_COPY: Record<string, string> = {
  created: 'recebido',
  awaiting_payment: 'aguardando a confirmação de pagamento',
  confirmed: 'confirmado',
  in_production: 'em produção',
  ready: 'pronto para retirada ou entrega',
  completed: 'concluído',
  cancelled: 'cancelado',
};

export function normalizeWhatsAppRecipient(phone: string | null | undefined): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return null;
}

export function orderStatusTemplateKey(status: OrderStatus | string): string {
  return `order_status_${String(status)}`;
}

export function buildOrderStatusWhatsAppMessage(input: {
  orderNumber: string;
  status: OrderStatus | string;
  deliveryType: 'pickup' | 'delivery' | string;
}): string {
  const statusCopy = STATUS_COPY[input.status] || 'atualizado';
  const deliveryCopy = input.status === 'ready'
    ? input.deliveryType === 'delivery'
      ? 'Nossa equipe entrará em contato sobre a entrega.'
      : 'A retirada pode ser combinada com a loja.'
    : 'Se precisar, responda a esta conversa.';

  // Não incluir preço, chave Pix, arquivo, links temporários ou endereço. A
  // página administrativa só abre a conversa; a entrega da mensagem depende
  // do operador e não é confundida com confirmação de envio.
  return [
    'JK Copycenter — atualização de pedido',
    `Pedido #${input.orderNumber}: ${statusCopy}.`,
    deliveryCopy,
  ].join('\n');
}

export function buildOrderStatusWhatsAppUrl(input: {
  recipient: string;
  orderNumber: string;
  status: OrderStatus | string;
  deliveryType: 'pickup' | 'delivery' | string;
}): string {
  return `https://wa.me/${input.recipient}?text=${encodeURIComponent(buildOrderStatusWhatsAppMessage(input))}`;
}
