'use client';

import React from 'react';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/cart/store';

// Chaves de conveniência mantidas no sessionStorage durante a jornada de
// compra/consulta. São limpas no logout para não deixar dados do cliente
// autenticado no navegador (ASVS 14.3.1).
const SESSION_KEYS_TO_CLEAR = [
  'jk_guest_lookup',
  'jk_checkout_confirmation',
  'jk_checkout_idempotency_key',
];

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Limpa estado do cliente no navegador antes de sair.
    try {
      useCartStore.getState().clearCart();
      if (typeof window !== 'undefined') {
        SESSION_KEYS_TO_CLEAR.forEach((key) => window.sessionStorage.removeItem(key));
      }
    } catch {
      // Limpeza é best-effort; o servidor revalida propriedade e sessão.
    }
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors w-full"
    >
      <LogOut className="w-5 h-5 text-red-500" />
      Sair da Conta
    </button>
  );
}
