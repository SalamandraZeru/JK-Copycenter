import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const single = vi.fn();
const eq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser },
    from,
  }),
}));

import { getAdminSession } from '@/lib/auth/admin';

describe('fronteira de sessão administrativa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não cria autoridade sem usuário validado pelo Supabase', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getAdminSession()).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('rejeita usuário autenticado sem papel administrativo ativo', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'customer-id', email: 'customer@example.test' } },
      error: null,
    });
    single.mockResolvedValue({ data: null, error: null });

    await expect(getAdminSession()).resolves.toBeNull();
  });

  it('aceita sessão Supabase com papel administrativo ativo obtido server-side', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'admin-id', email: 'admin@example.test' } },
      error: null,
    });
    single.mockResolvedValue({
      data: {
        id: 'admin-id',
        full_name: 'Admin Teste',
        role: 'admin',
        is_active: true,
      },
      error: null,
    });

    await expect(getAdminSession()).resolves.toEqual({
      id: 'admin-id',
      email: 'admin@example.test',
      name: 'Admin Teste',
      role: 'admin',
    });
  });
});
