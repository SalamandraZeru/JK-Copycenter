import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  Heart,
  LayoutDashboard,
  MapPin,
  ShoppingBag,
  User,
} from 'lucide-react';

export interface DashboardNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export const dashboardNavItems: DashboardNavItem[] = [
  { name: 'Visão Geral', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Meus Pedidos', href: '/dashboard/pedidos', icon: ShoppingBag },
  { name: 'Meus Arquivos', href: '/dashboard/arquivos', icon: FileText },
  { name: 'Endereços', href: '/dashboard/enderecos', icon: MapPin },
  { name: 'Favoritos', href: '/dashboard/favoritos', icon: Heart },
  { name: 'Meu Perfil', href: '/dashboard/perfil', icon: User },
];

export function isDashboardNavItemActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href);
}
