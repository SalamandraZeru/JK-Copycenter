import { describe, expect, it } from 'vitest';
import { calculatePrice } from '@/lib/pricing/engine';
import type { PricingCalculationInput } from '@/types/pricing';
import { baseInput, pricingContext } from '../helpers/pricing-context';

describe('limite de confiança do preço', () => {
  it.each([
    { price: 1 },
    { price: 0 },
    { price: -1 },
    { total: 1, discount: 99, deliveryFee: 0 },
  ])('ignora campos monetários adulterados no objeto de intenção: %o', (tampering) => {
    const malicious = { ...baseInput, ...tampering };
    const result = calculatePrice(malicious, pricingContext());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalCents).toBe(100);
  });

  it('ignora priceEffect, multiplier e addedPrice anexados à seleção pelo navegador', () => {
    const maliciousFields = [{
      fieldKey: 'finish',
      value: 'none',
      priceEffect: { addedPrice: -100_000, multiplier: 0 },
    }];
    const input: PricingCalculationInput = { ...baseInput, fieldValues: maliciousFields };
    const result = calculatePrice(input, pricingContext());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalCents).toBe(100);
  });

  it('não transforma atributo desconhecido em preço-base', () => {
    const result = calculatePrice({ ...baseInput, attributeIds: ['attacker-value'] }, pricingContext());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('QUOTE_UNAVAILABLE');
  });
});
