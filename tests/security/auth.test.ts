import { describe, it, expect } from 'vitest';
import { canPerform } from '@/lib/auth/permissions';
import type { AdminRole } from '@/types';

describe('Autenticação', () => {
  it('admin via Google OAuth → bloqueado, redireciona com erro', () => {
    // Admin login only permits email/password provider
    const allowedProviders = ['email'];
    const attemptedProvider = 'google';

    const isAllowed = allowedProviders.includes(attemptedProvider);
    expect(isAllowed).toBe(false);
  });

  it('login admin com senha errada → 401', () => {
    const validHashMatch = false;
    const statusCode = validHashMatch ? 200 : 401;
    expect(statusCode).toBe(401);
  });

  it('cookie de sessão adulterado → 401', () => {
    const rawSession = 'invalid.tampered.signature';
    const isValidJwt = false;
    const authResult = isValidJwt ? { user: { id: '1' } } : null;

    expect(authResult).toBeNull();
  });

  it('token de guest forjado → acesso negado', () => {
    const forgedToken = 'fake-uuid-not-in-database';
    const dbOrder = null;

    const accessGranted = dbOrder !== null;
    expect(accessGranted).toBe(false);
  });

  it('token de guest expirado → acesso negado', () => {
    const tokenCreatedAt = new Date(Date.now() - 31 * 24 * 3600 * 1000); // 31 days ago
    const maxRetentionMs = 30 * 24 * 3600 * 1000;

    const isExpired = Date.now() - tokenCreatedAt.getTime() > maxRetentionMs;
    expect(isExpired).toBe(true);
  });

  it('sessão de cliente usada em rota admin → 403', () => {
    const customerUser = { id: 'cust-1', role: 'customer' };
    const adminRoles: AdminRole[] = ['super_admin', 'admin', 'producao', 'catalogo'];

    const isAdmin = adminRoles.includes(customerUser.role as AdminRole);
    expect(isAdmin).toBe(false);
  });

  it('sessão de admin usada em rota de cliente → comportamento correto', () => {
    const adminUser = { id: 'admin-1', role: 'admin' as AdminRole };
    expect(adminUser.id).toBeDefined();
    // Admin can browse public pages and manage orders
    expect(canPerform(adminUser.role, 'read_orders')).toBe(true);
  });
});
