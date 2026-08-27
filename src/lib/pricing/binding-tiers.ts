export interface BindingTierRange {
  minPages: number;
  maxPages: number | null;
  isActive: boolean;
}

export interface BindingTierGap {
  minPages: number;
  maxPages: number | null;
}

export interface BindingTierCoverage {
  isComplete: boolean;
  gaps: BindingTierGap[];
  hasOverlap: boolean;
}

/**
 * Checks the operational coverage of binding tiers. The database exclusion
 * constraint remains the authority against overlaps; this helper additionally
 * identifies missing ranges so unfinished commercial schedules are never
 * exposed to customers as selectable binding.
 */
export function evaluateBindingTierCoverage(tiers: readonly BindingTierRange[]): BindingTierCoverage {
  const active = tiers
    .filter((tier) => tier.isActive)
    .filter((tier) => Number.isSafeInteger(tier.minPages) && tier.minPages >= 1
      && (tier.maxPages === null || (Number.isSafeInteger(tier.maxPages) && tier.maxPages >= tier.minPages)))
    .sort((left, right) => left.minPages - right.minPages);

  const gaps: BindingTierGap[] = [];
  let expectedMin = 1;
  let hasOverlap = false;

  for (const tier of active) {
    if (expectedMin === Number.POSITIVE_INFINITY) {
      hasOverlap = true;
      continue;
    }
    if (tier.minPages < expectedMin) {
      hasOverlap = true;
      continue;
    }
    if (tier.minPages > expectedMin) {
      gaps.push({ minPages: expectedMin, maxPages: tier.minPages - 1 });
    }
    expectedMin = tier.maxPages === null ? Number.POSITIVE_INFINITY : tier.maxPages + 1;
  }

  if (expectedMin !== Number.POSITIVE_INFINITY) {
    gaps.push({ minPages: expectedMin, maxPages: null });
  }

  return {
    isComplete: active.length > 0 && !hasOverlap && gaps.length === 0,
    gaps,
    hasOverlap,
  };
}
