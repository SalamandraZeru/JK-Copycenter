'use client';

import React from 'react';
import Image from 'next/image';
import { LogOut, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { AdminUserSession } from '@/lib/auth/admin';
import { AdminMobileMenu } from './AdminMobileMenu';

interface HeaderProps {
  user: AdminUserSession;
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <header className="h-[72px] bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex min-w-0 items-center gap-1 md:hidden">
        <AdminMobileMenu role={user.role} />
        <Image src="/images/brand/jk-monogram.webp" alt="JK Copycenter" width={360} height={404} className="h-9 w-auto" />
        <span className="truncate text-sm font-bold text-[#0d2b5c]">Administração</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right hidden md:block">
          <p className="text-sm font-bold text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500 capitalize">{user.role.replace('_', ' ')}</p>
        </div>
        
        <div className="w-10 h-10 bg-[#e8f1fa] rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-[#0d2b5c]" />
        </div>

        <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block"></div>

        <button 
          onClick={handleLogout}
          aria-label="Sair da administração"
          className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[#b4232d]"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
