import { describe, expect, it } from 'vitest';
import { getAdminNavItems, isAdminNavItemActive } from '@/app/admin/components/navigation';

describe('navegação administrativa', () => {
  it('mantém no menu móvel apenas as rotas permitidas para o perfil', () => {
    expect(getAdminNavItems('producao').map((item) => item.href)).toEqual([
      '/admin/pedidos',
      '/admin/producao',
    ]);

    expect(getAdminNavItems('catalogo').map((item) => item.href)).toEqual([
      '/admin/produtos',
      '/admin/servicos',
      '/admin/categorias',
    ]);
  });

  it('inclui o painel completo para super admin e destaca rotas filhas', () => {
    expect(getAdminNavItems('super_admin')).toHaveLength(10);
    expect(isAdminNavItemActive('/admin/pedidos/123', '/admin/pedidos')).toBe(true);
    expect(isAdminNavItemActive('/admin/pedidos', '/admin/dashboard')).toBe(false);
  });
});
