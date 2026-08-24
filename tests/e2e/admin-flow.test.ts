import { describe, expect, it } from 'vitest';
import { calculatePrice } from '@/lib/pricing/engine';
import { baseInput, pricingContext } from '../helpers/pricing-context';

describe('admin altera catálogo sem reescrever histórico', () => {
  it('uma nova versão produz nova cotação e mantém o snapshot anterior', () => {
    const context = pricingContext();
    const before = calculatePrice(baseInput, context);
    context.rules[0]!.pricePerPageCents = 75;
    context.rules[0]!.version = 4;
    context.service.pricingVersion = 8;
    const after = calculatePrice(baseInput, context);

    expect(before.success && before.data.totalCents).toBe(100);
    expect(after.success && after.data.totalCents).toBe(150);
    expect(before.success && before.data.ruleVersion).toBe(3);
    expect(after.success && after.data.ruleVersion).toBe(4);
  });
});
