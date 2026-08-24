import {
  Calculator,
  ClipboardList,
  Layers,
  LayoutDashboard,
  Package,
  PlaySquare,
  Settings,
  ShoppingCart,
  Tag,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AdminRole } from '@/types';
import { canPerform, type AdminAction } from '@/lib/auth/permissions';

export interface AdminNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  action?: AdminAction;
}

const adminNavItems: AdminNavItem[] = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Pedidos', href: '/admin/pedidos', icon: ShoppingCart, action: 'read_orders' },
  { name: 'Fila de Produção', href: '/admin/producao', icon: PlaySquare, action: 'manage_production' },
  { name: 'Produtos', href: '/admin/produtos', icon: Package, action: 'manage_catalog' },
  { name: 'Serviços', href: '/admin/servicos', icon: Layers, action: 'manage_catalog' },
  { name: 'Categorias', href: '/admin/categorias', icon: Tag, action: 'manage_catalog' },
  { name: 'Preços', href: '/admin/precos', icon: Calculator, action: 'manage_pricing' },
  { name: 'Configurações', href: '/admin/configuracoes', icon: Settings, action: 'manage_config' },
  { name: 'Usuários', href: '/admin/usuarios', icon: Users, action: 'manage_users' },
  { name: 'Auditoria', href: '/admin/auditoria', icon: ClipboardList, action: 'read_audit' },
];

export function getAdminNavItems(role: AdminRole) {
  return adminNavItems.filter((item) => {
    if (item.href === '/admin/dashboard') {
      return role === 'super_admin' || role === 'admin';
    }

    return !item.action || canPerform(role, item.action);
  });
}

export function isAdminNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
