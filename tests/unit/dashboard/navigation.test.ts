import { describe, expect, it } from 'vitest';
import { dashboardNavItems, isDashboardNavItemActive } from '@/components/dashboard/navigation';

describe('navegação do painel do cliente', () => {
  it('mantém as seis abas do painel disponíveis para as navegações desktop e mobile', () => {
    expect(dashboardNavItems.map((item) => item.href)).toEqual([
      '/dashboard',
      '/dashboard/pedidos',
      '/dashboard/arquivos',
      '/dashboard/enderecos',
      '/dashboard/favoritos',
      '/dashboard/perfil',
    ]);
  });

  it('marca somente a aba correspondente como ativa, inclusive em páginas filhas', () => {
    expect(isDashboardNavItemActive('/dashboard', '/dashboard')).toBe(true);
    expect(isDashboardNavItemActive('/dashboard/pedidos/123', '/dashboard/pedidos')).toBe(true);
    expect(isDashboardNavItemActive('/dashboard/pedidos', '/dashboard')).toBe(false);
    expect(isDashboardNavItemActive('/dashboard/arquivos', '/dashboard/pedidos')).toBe(false);
  });
});
