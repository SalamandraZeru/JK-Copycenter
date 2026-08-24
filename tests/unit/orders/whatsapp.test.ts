import { describe, it, expect } from 'vitest';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '../../../src/lib/orders/whatsapp';
import type { Order, OrderItemWithFiles } from '../../../src/types/checkout';

describe('buildWhatsAppMessage', () => {
  const baseOrder = {
    id: 'o1',
    userId: 'u1',
    orderNumber: 'JK-2024-0001',
    orderToken: 't1',
    idempotencyKey: 'k1',
    status: 'new' as const,
    customerName: 'João da Silva',
    customerPhone: '11999999999',
    guestEmail: null,
    paymentMethod: 'pix' as const,
    deliveryType: 'pickup' as const,
    deliveryAddress: null,
    deliveryAddressId: null,
    subtotal: 10.00,
    deliveryFee: 0,
    discountTotal: 0,
    total: 10.00,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const baseItems: OrderItemWithFiles[] = [
    {
      id: 'i1',
      orderId: 'o1',
      serviceId: 's1',
      serviceNameSnapshot: 'Impressão A4',
      serviceDescriptionSnapshot: 'Cor: Preto, Papel: Sulfite',
      quantity: 2,
      pageCount: 10,
      basePrice: 0.50,
      totalPrice: 10.00,
      discountApplied: 0,
      fieldsSnapshot: [],
      pricingRuleSnapshot: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      files: [
        {
          id: 'f1',
          orderId: 'o1',
          orderItemId: 'i1',
          userId: 'u1',
          originalName: 'documento.pdf',
          mimeType: 'application/pdf',
          fileType: 'pdf',
          sizeBytes: 1024,
          pageCount: 10,
          pageCountMethod: 'exact',
          status: 'ready',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ]
    }
  ];

  it('mensagem contém número do pedido', () => {
    const msg = buildWhatsAppMessage(baseOrder, baseItems);
    expect(msg).toContain('JK-2024-0001');
    expect(msg).toContain('João da Silva');
  });

  it('mensagem contém apenas resumo de itens, sem arquivos', () => {
    const msg = buildWhatsAppMessage(baseOrder, baseItems);
    expect(msg).toContain('Impressão A4');
    expect(msg).toContain('Quantidade: 2x');
    expect(msg).toContain('Páginas por cópia: 10');
    expect(msg).toContain('Configuração: Cor: Preto, Papel: Sulfite');
    expect(msg).toContain('Total do item: R$ 10,00');
    expect(msg).not.toContain('documento.pdf');
  });

  it('identifica total estimado sem afirmar pagamento ou valor final', () => {
    const msg = buildWhatsAppMessage({ ...baseOrder, hasEstimates: true }, baseItems);
    expect(msg).toContain('Total estimado: R$ 10,00');
    expect(msg).toContain('a equipe confirmará o valor final antes do pagamento');
    expect(msg).not.toMatch(/pagamento aprovado|pago/i);
  });

  it('não vaza chave Pix, arquivos, endereço ou alegação de aprovação', () => {
    const msg = buildWhatsAppMessage({
      ...baseOrder,
      deliveryType: 'delivery',
      deliveryAddress: { street: 'Rua A', number: '123' },
      pixKey: '12345678909',
    }, baseItems);
    expect(msg).not.toContain('12345678909');
    expect(msg).not.toContain('Rua A');
    expect(msg).not.toContain('documento.pdf');
    expect(msg).not.toMatch(/pagamento aprovado|pago/i);
    expect(msg).toContain('Pagamento pendente de confirmação pela equipe.');
  });

  it('informa apenas a modalidade para entrega', () => {
    const order = {
      ...baseOrder,
      deliveryType: 'delivery' as const,
      total: 25.00
    };
    const msg = buildWhatsAppMessage(order, baseItems);
    expect(msg).toContain('Entrega: Entrega');
    expect(msg).not.toContain('Rua A');
  });

  it('sem endereço quando entrega=pickup', () => {
    const msg = buildWhatsAppMessage(baseOrder, baseItems);
    expect(msg).toContain('Retirada na loja');
    expect(msg).not.toContain('Taxa: R$');
  });
});

describe('buildWhatsAppUrl', () => {
  it('URL começa com https://wa.me/', () => {
    const url = buildWhatsAppUrl('Ola', '5511999999999');
    expect(url.startsWith('https://wa.me/')).toBe(true);
  });

  it('mensagem codificada corretamente (encodeURIComponent)', () => {
    const url = buildWhatsAppUrl('Olá Mundo', '5511999999999');
    expect(url).toContain('Ol%C3%A1%20Mundo');
  });

  it('número sem caracteres especiais', () => {
    const url = buildWhatsAppUrl('Ola', '+55 (11) 99999-9999');
    expect(url.startsWith('https://wa.me/5511999999999')).toBe(true);
  });
});
