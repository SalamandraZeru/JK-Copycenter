import type { AdminRole } from '@/types';

export type AdminAction =
  | 'manage_users'
  | 'manage_config'
  | 'manage_catalog'
  | 'manage_pricing'
  | 'read_orders'
  | 'update_orders'
  | 'payments_confirm'
  | 'manage_production'
  | 'read_audit';

type RolePermissions = Record<AdminAction, boolean>;

const PERMISSIONS: Record<AdminRole, RolePermissions> = {
  super_admin: {
    manage_users: true,
    manage_config: true,
    manage_catalog: true,
    manage_pricing: true,
    read_orders: true,
    update_orders: true,
    payments_confirm: true,
    manage_production: true,
    read_audit: true,
  },
  admin: {
    manage_users: false,
    manage_config: true,
    manage_catalog: true,
    manage_pricing: true,
    read_orders: true,
    update_orders: true,
    payments_confirm: true,
    manage_production: true,
    read_audit: true,
  },
  producao: {
    manage_users: false,
    manage_config: false,
    manage_catalog: false,
    manage_pricing: false,
    read_orders: true,
    update_orders: true,
    payments_confirm: false,
    manage_production: true,
    read_audit: false,
  },
  catalogo: {
    manage_users: false,
    manage_config: false,
    manage_catalog: true,
    manage_pricing: false,
    read_orders: false,
    update_orders: false,
    payments_confirm: false,
    manage_production: false,
    read_audit: false,
  },
};

export function canPerform(role: AdminRole, action: AdminAction): boolean {
  return PERMISSIONS[role][action];
}
