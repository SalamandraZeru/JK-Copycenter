import { describe, it, expect } from 'vitest';
import { validateCsrfOrigin } from '@/lib/security/csrf';

describe('CSRF', () => {
  const host = 'jkcopycenter.com.br';

  it('POST sem Origin é rejeitado em host público e aceito apenas no desenvolvimento local', () => {
    expect(validateCsrfOrigin(null, host)).toBe(false);
    expect(validateCsrfOrigin('', host)).toBe(false);
    expect(validateCsrfOrigin(undefined, host)).toBe(false);
    expect(validateCsrfOrigin(null, 'localhost:3000')).toBe(true);
  });

  it('checkout de origem externa maliciosa → rejeitado', () => {
    const maliciousOrigins = [
      'https://evil-site.com',
      'https://jkcopycenter.com.br.attacker.com',
      'http://phishing-site.org',
      'javascript:void(0)',
    ];

    for (const origin of maliciousOrigins) {
      expect(validateCsrfOrigin(origin, host)).toBe(false);
    }
  });

  it('upload de origem externa → rejeitado se não for mesma origem nem localhost', () => {
    const foreignOrigin = 'https://external-service.net';
    expect(validateCsrfOrigin(foreignOrigin, host)).toBe(false);

    // Legitimate same-origin request
    const legitimateOrigin = 'https://jkcopycenter.com.br';
    expect(validateCsrfOrigin(legitimateOrigin, host)).toBe(true);

    // Localhost é aceito somente quando o host também é local.
    expect(validateCsrfOrigin('http://localhost:3000', 'localhost:3000')).toBe(true);
    expect(validateCsrfOrigin('http://localhost:3000', host)).toBe(false);
    expect(validateCsrfOrigin('http://127.0.0.1:3000', host)).toBe(false);
  });
});
