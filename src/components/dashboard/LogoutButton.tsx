'use client';

import React from 'react';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
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
