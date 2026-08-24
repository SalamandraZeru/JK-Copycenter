import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkoutIntentSchema } from '@/lib/orders/checkout-intent';
import { validateAndRecalculate } from '@/lib/pricing/checkout-validator';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const isLocal = ['127.0.0.1', 'localhost'].includes(supabaseUrl ? new URL(supabaseUrl).hostname : '');

describe.runIf(isLocal)('intenção adulterada contra pricing local real', () => {
  let service: SupabaseClient<Database>;

  beforeAll(() => {
    service = createClient<Database>(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  });

  it('JSON monetário adulterado produz a mesma cotação server-side', async () => {
    const baseItem = {
      serviceId: '33333333-3333-3333-3333-333333333333',
      quantity: 2,
      attributeIds: [
        '66666666-6666-6666-6666-666666666661',
        '66666666-6666-6666-6666-666666666663',
        '66666666-6666-6666-6666-666666666665',
      ],
      fieldValues: [{ fieldKey: 'color', value: 'bw' }],
      pageCount: 999_999,
      isFrontAndBack: false,
      fileIds: [],
    };
    const clean = checkoutIntentSchema.parse({
      idempotencyKey: crypto.randomUUID(),
      items: [baseItem],
      deliveryType: 'pickup',
      paymentMethod: 'pix',
      customerPhone: '35999999999',
    });
    const tampered = checkoutIntentSchema.parse({
      idempotencyKey: crypto.randomUUID(),
      items: [{
        ...baseItem,
        price: 1,
        total: 1,
        discount: 100,
        fieldValues: [{
          fieldKey: 'color',
          value: 'bw',
          label: 'falso',
          priceEffect: { multiplier: 0, addedPrice: -100_000 },
        }],
      }],
      price: 1,
      total: 1,
      deliveryType: 'pickup',
      paymentMethod: 'pix',
      customerPhone: '35999999999',
    });

    const cleanItem = clean.items[0]!;
    const tamperedItem = tampered.items[0]!;
    const cleanQuote = await validateAndRecalculate({
      serviceId: cleanItem.serviceId!,
      attributeIds: cleanItem.attributeIds,
      fieldValues: cleanItem.fieldValues,
      pageCount: 1,
      isFrontAndBack: cleanItem.isFrontAndBack,
      quantity: cleanItem.quantity,
      fileIds: cleanItem.fileIds,
    }, service);
    const tamperedQuote = await validateAndRecalculate({
      serviceId: tamperedItem.serviceId!,
      attributeIds: tamperedItem.attributeIds,
      fieldValues: tamperedItem.fieldValues,
      pageCount: 1,
      isFrontAndBack: tamperedItem.isFrontAndBack,
      quantity: tamperedItem.quantity,
      fileIds: tamperedItem.fileIds,
    }, service);

    expect(cleanQuote.success).toBe(true);
    expect(tamperedQuote.success).toBe(true);
    if (cleanQuote.success && tamperedQuote.success) {
      expect(tamperedQuote.data.totalCents).toBe(cleanQuote.data.totalCents);
      expect(tamperedQuote.data.totalCents).toBeGreaterThan(0);
      expect(tamperedItem.fieldValues[0]).toEqual({ fieldKey: 'color', value: 'bw' });
    }
  });
});
