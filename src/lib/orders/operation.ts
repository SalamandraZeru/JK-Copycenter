import type { AdminRole } from '@/types';

type ProductionStatus = 'confirmed' | 'in_production' | 'ready';
type ProductionTarget = 'in_production' | 'ready' | 'completed';

const productionTransitions: Record<ProductionStatus, ProductionTarget[]> = {
  confirmed: ['in_production'],
  in_production: ['ready'],
  ready: ['completed'],
};

export function canProductionAdvanceOrder(
  role: AdminRole,
  status: string,
  paymentStatus: string | null | undefined,
  target: string,
): boolean {
  if (role !== 'producao' || paymentStatus !== 'paid') return false;
  const allowed = productionTransitions[status as ProductionStatus];
  return Boolean(allowed?.includes(target as ProductionTarget));
}

export function productionNextStatus(
  status: string,
  paymentStatus: string | null | undefined,
): ProductionTarget | null {
  if (paymentStatus !== 'paid') return null;
  return productionTransitions[status as ProductionStatus]?.[0] ?? null;
}
