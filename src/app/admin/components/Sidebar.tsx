'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { AdminRole } from '@/types';
import { AdminNavigationLinks } from './AdminNavigationLinks';

interface SidebarProps {
  role: AdminRole;
}

export function Sidebar({ role }: SidebarProps) {
  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col min-h-screen">
      <div className="p-5 border-b border-slate-800">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <div className="rounded-md bg-white p-1">
            <Image src="/images/brand/jk-monogram.webp" alt="JK Copycenter" width={360} height={404} className="h-8 w-auto" />
          </div>
          <span className="font-bold text-lg tracking-tight">Administração</span>
        </Link>
      </div>

      <AdminNavigationLinks role={role} />
      
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-lg p-3 text-sm">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Seu Perfil</p>
          <p className="font-bold text-white capitalize">{role.replace('_', ' ')}</p>
        </div>
      </div>
    </div>
  );
}
