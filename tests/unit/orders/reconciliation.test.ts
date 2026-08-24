import { describe, expect, it } from 'vitest';
import { isReconciledRevenueOrder } from '@/lib/orders/reconciliation';
import { canProductionAdvanceOrder } from '@/lib/orders/operation';

describe('reconciliação operacional', () => {
  it('só reconhece receita para pagamento pago em estado elegível', () => {
    expect(isReconciledRevenueOrder({ status: 'awaiting_payment', payment_status: 'pending_contact' })).toBe(false);
    expect(isReconciledRevenueOrder({ status: 'cancelled', payment_status: 'paid' })).toBe(false);
    expect(isReconciledRevenueOrder({ status: 'confirmed', payment_status: 'paid' })).toBe(true);
    expect(isReconciledRevenueOrder({ status: 'completed', payment_status: 'paid' })).toBe(true);
  });

  it('produção só avança pagamento confirmado pela sequência permitida', () => {
    expect(canProductionAdvanceOrder('producao', 'confirmed', 'paid', 'in_production')).toBe(true);
    expect(canProductionAdvanceOrder('producao', 'confirmed', 'pending_contact', 'in_production')).toBe(false);
    expect(canProductionAdvanceOrder('producao', 'confirmed', 'paid', 'completed')).toBe(false);
    expect(canProductionAdvanceOrder('admin', 'confirmed', 'paid', 'in_production')).toBe(false);
  });
});
