import { describe, expect, it } from 'vitest';
import { canPerform, type AdminAction } from '@/lib/auth/permissions';
import type { AdminRole } from '@/types';

const actions: AdminAction[] = [
  'manage_users', 'manage_config', 'manage_catalog', 'manage_pricing',
  'read_orders', 'update_orders', 'payments_confirm', 'manage_production',
  'read_audit',
];

const expected: Record<AdminRole, AdminAction[]> = {
  super_admin: actions,
  admin: ['manage_config', 'manage_catalog', 'manage_pricing', 'read_orders', 'update_orders', 'payments_confirm', 'manage_production', 'read_audit'],
  producao: ['read_orders', 'update_orders', 'manage_production'],
  catalogo: ['manage_catalog'],
};

describe('matriz RBAC administrativa centralizada', () => {
  for (const role of Object.keys(expected) as AdminRole[]) {
    it(`aplica exatamente as permissões de ${role}`, () => {
      for (const action of actions) {
        expect(canPerform(role, action)).toBe(expected[role].includes(action));
      }
    });
  }
});
