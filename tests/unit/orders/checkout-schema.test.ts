import { describe, expect, it } from 'vitest';
import { checkoutIntentSchema } from '@/lib/orders/checkout-intent';

const base = {
  idempotencyKey: '10000000-0000-4000-8000-000000000001',
  items: [{
    serviceId: '20000000-0000-4000-8000-000000000001',
    productId: '',
    quantity: 1,
    fieldValues: [{ fieldKey: 'paper', value: 'a4' }],
  }],
  deliveryType: 'pickup',
  customerPhone: '35999998888',
  paymentMethod: 'pix',
};

describe('contrato de intenção do checkout', () => {
  it('normaliza identificadores e strings opcionais vazias', () => {
    const parsed = checkoutIntentSchema.safeParse({
      ...base,
      customerName: '   ',
      guestEmail: '',
      notes: '',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items[0]?.productId).toBeUndefined();
      expect(parsed.data.customerName).toBeUndefined();
      expect(parsed.data.guestEmail).toBeUndefined();
      expect(parsed.data.notes).toBeUndefined();
    }
  });

  it('rejeita item sem serviço nem produto', () => {
    const parsed = checkoutIntentSchema.safeParse({
      ...base,
      items: [{ serviceId: '', productId: '', quantity: 1 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('remove preço, total, desconto, label e efeitos adulterados do JSON', () => {
    const parsed = checkoutIntentSchema.safeParse({
      ...base,
      price: 1,
      total: 1,
      discount: 99,
      items: [{
        ...base.items[0],
        price: 1,
        total: 1,
        priceEffect: { addedPrice: -10_000, multiplier: 0 },
        fieldValues: [{
          fieldKey: 'paper',
          value: 'a4',
          label: 'Rótulo falsificado',
          priceEffect: { addedPrice: -10_000, multiplier: 0 },
        }],
      }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('price');
      expect(parsed.data).not.toHaveProperty('total');
      expect(parsed.data.items[0]).not.toHaveProperty('price');
      expect(parsed.data.items[0]).not.toHaveProperty('priceEffect');
      expect(parsed.data.items[0]?.fieldValues[0]).toEqual({ fieldKey: 'paper', value: 'a4' });
    }
  });
});
