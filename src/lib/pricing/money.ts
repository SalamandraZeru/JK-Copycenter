export function reaisToCents(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('INVALID_MONEY_VALUE');
  const cents = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('INVALID_MONEY_VALUE');
  return cents;
}

export function multiplierToBps(value: number): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error('INVALID_MULTIPLIER');
  const bps = Math.round(value * 10_000);
  if (!Number.isSafeInteger(bps)) throw new Error('INVALID_MULTIPLIER');
  return bps;
}
