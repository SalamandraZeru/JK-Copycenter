import { describe, expect, it } from 'vitest';
import { calculatePrice } from '@/lib/pricing/engine';
import { baseInput, pricingContext } from '../helpers/pricing-context';

describe('cotação reproduzível usada pelo checkout', () => {
  it('gera snapshot completo em centavos para persistência', () => {
    const result = calculatePrice({
      ...baseInput,
      fieldValues: [{ fieldKey: 'finish', value: 'staple' }],
      quantity: 10,
    }, pricingContext());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalCents).toBe(1_425);
      expect(result.data.discountCents).toBe(75);
      expect(result.data.serviceSnapshot.name).toBe('Impressão');
      expect(result.data.fieldsSnapshot[0]?.priceEffect).toEqual({ type: 'fixed', valueCents: 25 });
    }
  });
});
