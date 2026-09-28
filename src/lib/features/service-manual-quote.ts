const ENABLED_VALUE = 'true';

/**
 * Server-side release gate for the future manual graphic quote flow.
 *
 * The feature fails closed: missing, malformed or unexpected values keep the
 * current production flow active. The flag is intentionally not public and
 * must not be used as an authorization control.
 */
export function isServiceManualQuoteEnabled(): boolean;
export function isServiceManualQuoteEnabled(value: string | undefined): boolean;
export function isServiceManualQuoteEnabled(...args: [value?: string]): boolean {
  const value = args.length === 0 ? process.env.SERVICE_MANUAL_QUOTE_ENABLED : args[0];
  return value?.trim().toLowerCase() === ENABLED_VALUE;
}
