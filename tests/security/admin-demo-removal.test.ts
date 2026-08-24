import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('remoção do acesso administrativo de demonstração', () => {
  it('não publica a rota de sessão demo', () => {
    expect(
      existsSync(join(root, 'src/app/api/admin/auth/demo/route.ts'))
    ).toBe(false);
  });

  it('não aceita jk_admin_preview no middleware ou helper de sessão', () => {
    const middleware = readFileSync(join(root, 'src/middleware.ts'), 'utf8');
    const adminHelper = readFileSync(join(root, 'src/lib/auth/admin.ts'), 'utf8');

    expect(middleware).not.toContain('jk_admin_preview');
    expect(adminHelper).not.toContain('jk_admin_preview');
  });

  it('não mantém credencial preenchida nem fallback demo no login', () => {
    const login = readFileSync(join(root, 'src/app/admin/login/page.tsx'), 'utf8');
    const header = readFileSync(join(root, 'src/app/admin/components/Header.tsx'), 'utf8');

    expect(login).not.toContain('admin123456');
    expect(login).not.toContain('/api/admin/auth/demo');
    expect(login).not.toContain('handleDemoLogin');
    expect(header).not.toContain('/api/admin/auth/demo');
  });
});
