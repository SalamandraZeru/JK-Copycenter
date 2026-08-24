'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, Menu, X, User } from 'lucide-react';
import { useCartStore } from '@/lib/cart/store';
import { createClient } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const itemsCount = useCartStore((state) => state.items.length);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-[72px]">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="hidden sm:inline-flex min-h-11 items-center rounded-md" aria-label="JK Copycenter - página inicial">
                <Image
                  src="/images/brand/jk-copycenter-horizontal.webp"
                  alt="JK Copycenter"
                  width={960}
                  height={462}
                  className="h-11 w-auto object-contain"
                  priority
                />
              </Link>
              <Link href="/" className="inline-flex min-h-11 sm:hidden items-center gap-2 rounded-md" aria-label="JK Copycenter - página inicial">
                <Image
                  src="/images/brand/jk-monogram.webp"
                  alt=""
                  width={360}
                  height={404}
                  className="h-9 w-auto object-contain"
                  priority
                />
                <span className="text-sm font-bold tracking-tight text-[#0d2b5c]">Copycenter</span>
              </Link>
            </div>
            <nav className="hidden sm:ml-7 sm:flex sm:space-x-6">
              <Link href="/grafica" className="inline-flex items-center px-1 text-sm font-semibold text-slate-700 hover:text-[#0d2b5c] border-b-2 border-transparent hover:border-[#b4232d] transition-colors">
                Gráfica
              </Link>
              <Link href="/papelaria" className="inline-flex items-center px-1 text-sm font-semibold text-slate-700 hover:text-[#0d2b5c] border-b-2 border-transparent hover:border-[#b4232d] transition-colors">
                Papelaria
              </Link>
              <Link href="/sobre" className="inline-flex items-center px-1 text-sm font-semibold text-slate-700 hover:text-[#0d2b5c] border-b-2 border-transparent hover:border-[#b4232d] transition-colors">
                Sobre
              </Link>
            </nav>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            <Link href="/carrinho" className="min-h-11 min-w-11 p-2 text-slate-600 hover:text-[#0d2b5c] relative inline-flex items-center justify-center rounded-lg hover:bg-[#e8f1fa] transition-colors">
              <span className="sr-only">Carrinho</span>
              <ShoppingCart className="w-6 h-6" />
              {itemsCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-blue-600 rounded-full">
                  {itemsCount}
                </span>
              )}
            </Link>
            
            {session ? (
              <Link href="/dashboard" className="min-h-11 text-sm font-semibold text-slate-700 hover:text-[#0d2b5c] border border-slate-300 rounded-lg px-3 py-2 flex items-center transition-colors">
                <User className="w-4 h-4 mr-2" /> Painel
              </Link>
            ) : (
              <Link href="/login" className="min-h-11 text-sm font-semibold text-slate-700 hover:text-[#0d2b5c] border border-slate-300 rounded-lg px-3 py-2 inline-flex items-center transition-colors">
                Entrar
              </Link>
            )}
          </div>
          
          <div className="flex items-center sm:hidden space-x-2">
            <Link href="/carrinho" className="min-h-11 min-w-11 p-2 text-slate-600 hover:text-[#0d2b5c] relative mr-1 inline-flex items-center justify-center rounded-lg hover:bg-[#e8f1fa] transition-colors">
              <ShoppingCart className="w-6 h-6" />
              {itemsCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-blue-600 rounded-full">
                  {itemsCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-expanded={isOpen}
              aria-controls="mobile-navigation"
              aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
              className="min-h-11 min-w-11 p-2 rounded-lg text-slate-600 hover:text-[#0d2b5c] hover:bg-[#e8f1fa] focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div id="mobile-navigation" className="sm:hidden border-t border-slate-200 bg-white">
          <div className="pt-2 pb-3 space-y-1">
            <Link href="/grafica" onClick={() => setIsOpen(false)} className="block px-4 py-3 border-l-4 border-transparent text-base font-semibold text-slate-700 hover:bg-[#e8f1fa] hover:border-[#b4232d] hover:text-[#0d2b5c]">
              Gráfica
            </Link>
            <Link href="/papelaria" onClick={() => setIsOpen(false)} className="block px-4 py-3 border-l-4 border-transparent text-base font-semibold text-slate-700 hover:bg-[#e8f1fa] hover:border-[#b4232d] hover:text-[#0d2b5c]">
              Papelaria
            </Link>
            <Link href="/sobre" onClick={() => setIsOpen(false)} className="block px-4 py-3 border-l-4 border-transparent text-base font-semibold text-slate-700 hover:bg-[#e8f1fa] hover:border-[#b4232d] hover:text-[#0d2b5c]">
              Sobre
            </Link>
            <div className="pt-4 pb-2 border-t border-slate-200">
              {session ? (
                <Link href="/dashboard" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-base font-semibold text-[#0d2b5c] hover:bg-[#e8f1fa]">
                  Painel do Cliente
                </Link>
              ) : (
                <Link href="/login" onClick={() => setIsOpen(false)} className="block px-4 py-3 text-base font-semibold text-[#0d2b5c] hover:bg-[#e8f1fa]">
                  Fazer Login
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
