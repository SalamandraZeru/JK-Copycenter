/**
 * CSRF and Origin verification helper for sensitive state-changing routes.
 */
export function validateCsrfOrigin(
  originHeader: string | null | undefined,
  hostHeader: string | null | undefined
): boolean {
  if (!hostHeader) return false;

  const expectedHost = hostHeader.toLowerCase().trim();
  const expectedHostname = expectedHost.replace(/^\[|\]$/g, '').split(':')[0] || '';
  const isLocalHost = expectedHostname === 'localhost'
    || expectedHostname === '127.0.0.1'
    || expectedHostname === '::1'
    || expectedHostname.endsWith('.localhost');

  // Browsers may omit Origin for same-origin requests. Restrict that compatibility
  // exception to local development, where the request host itself is loopback.
  if (!originHeader || originHeader.trim() === '') return isLocalHost;

  try {
    const originUrl = new URL(originHeader);
    const originHost = originUrl.host.toLowerCase().trim();
    const originHostname = originUrl.hostname.toLowerCase().trim();

    if (isLocalHost) {
      return originHostname === 'localhost'
        || originHostname === '127.0.0.1'
        || originHostname === '::1'
        || originHostname.endsWith('.localhost');
    }

    return originHost === expectedHost;
  } catch {
    return false;
  }
}
