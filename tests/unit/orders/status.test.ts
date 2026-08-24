import { describe, it, expect } from 'vitest';
import { validateTransition } from '../../../src/lib/orders/status';

describe('validateTransition', () => {
  it('awaiting_payment → confirmed: válido', () => {
    expect(validateTransition('awaiting_payment', 'confirmed')).toBe(true);
  });

  it('awaiting_payment → in_production: inválido', () => {
    expect(validateTransition('awaiting_payment', 'in_production')).toBe(false);
  });

  it('ready → cancelled: válido', () => {
    expect(validateTransition('ready', 'cancelled')).toBe(true);
  });

  it('completed → created: inválido', () => {
    expect(validateTransition('completed', 'created')).toBe(false);
  });

  it('cancelled → in_production: inválido', () => {
    expect(validateTransition('cancelled', 'in_production')).toBe(false);
  });
});
