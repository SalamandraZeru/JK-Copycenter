import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('contenção de preview e segredo guest', () => {
  it('não aceita cookies de preview em código de aplicação', () => {
    const sourceFiles = [
      'src/middleware.ts',
      'src/app/(auth)/login/page.tsx',
      'src/app/(auth)/registro/page.tsx',
      'src/app/dashboard/layout.tsx',
    ];
    for (const file of sourceFiles) {
      expect(read(file)).not.toContain('jk_customer_preview');
      expect(read(file)).not.toContain('jk_admin_preview');
    }
  });

  it('não coloca código/token do pedido na rota ou no WhatsApp', () => {
    const checkoutPage = read('src/app/(public)/carrinho/checkout/page.tsx');
    const confirmation = read('src/app/(public)/pedido-confirmado/page.tsx');
    const whatsapp = read('src/lib/orders/whatsapp.ts');
    expect(checkoutPage).not.toContain('pedido-confirmado?token=');
    expect(confirmation).not.toMatch(/href=\{`\/pedido\/\$\{/);
    expect(whatsapp).not.toContain('orderToken');
    expect(whatsapp).not.toContain('order_token');
  });
});
