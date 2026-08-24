export const RECONCILED_REVENUE_STATUSES = [
  'confirmed',
  'in_production',
  'ready',
  'completed',
] as const;

export function isReconciledRevenueOrder(input: {
  status: string;
  payment_status: string | null | undefined;
}): boolean {
  return input.payment_status === 'paid'
    && RECONCILED_REVENUE_STATUSES.includes(input.status as typeof RECONCILED_REVENUE_STATUSES[number]);
}
