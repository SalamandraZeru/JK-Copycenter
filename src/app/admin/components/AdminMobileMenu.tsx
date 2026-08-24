'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { AdminRole } from '@/types';
import { AdminNavigationLinks } from './AdminNavigationLinks';

interface AdminMobileMenuProps {
  role: AdminRole;
}

export function AdminMobileMenu({ role }: AdminMobileMenuProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu administrativo"
        aria-expanded={isOpen}
        aria-controls="admin-mobile-menu"
        className="-ml-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#0d2b5c] transition hover:bg-slate-100 md:hidden"
        onClick={() => setIsOpen(true)}
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar menu administrativo"
            className="fixed inset-0 z-40 bg-slate-950/45 md:hidden"
            onClick={() => setIsOpen(false)}
          />
          <aside
            id="admin-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu administrativo"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(19rem,86vw)] flex-col bg-slate-900 text-white shadow-2xl md:hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-800 p-5">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-white p-1">
                  <Image src="/images/brand/jk-monogram.webp" alt="JK Copycenter" width={360} height={404} className="h-8 w-auto" />
                </div>
                <span className="text-lg font-bold tracking-tight">Administração</span>
              </div>
              <button
                type="button"
                aria-label="Fechar menu"
                className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <AdminNavigationLinks role={role} onNavigate={() => setIsOpen(false)} />

            <div className="border-t border-slate-800 p-4">
              <div className="rounded-lg bg-slate-800 p-3 text-sm">
                <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">Seu perfil</p>
                <p className="font-bold capitalize text-white">{role.replace('_', ' ')}</p>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
