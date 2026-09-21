'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, Menu, MessageCircle, ShoppingBag, User, X } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/lib/cart/store';

const navigation = [
  { href: '/grafica', label: 'Gráfica' },
  { href: '/papelaria', label: 'Papelaria' },
  { href: '/sobre', label: 'A JK' },
] as const;

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const itemsCount = useCartStore((state) => state.items.length);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, []);

  return <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-[#fffdf8]/95 shadow-[0_1px_0_rgba(15,32,64,.05)] backdrop-blur">
    <div className="hidden bg-[#092653] text-white sm:block"><div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 text-[11px] font-semibold tracking-wide sm:px-6 lg:px-8"><a href="https://share.google/3jStxc1OYvpfH5rJ2" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white"><MapPin className="h-3.5 w-3.5" />Av. JK, 270 · Passos/MG</a><a href="https://wa.me/5535991066260" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-slate-200 hover:text-white"><MessageCircle className="h-3.5 w-3.5" />Atendimento no WhatsApp</a></div></div>
    <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2" aria-label="JK Copycenter — início"><Image src="/images/brand/jk-monogram.webp" alt="" width={360} height={404} className="h-10 w-auto" priority /><span className="leading-tight"><strong className="block text-base tracking-tight text-[#092653]">JK Copycenter</strong><span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:block">Gráfica e papelaria local</span></span></Link>

      <nav aria-label="Navegação principal" className="hidden items-center rounded-full border border-slate-200 bg-white p-1 md:flex">{navigation.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`rounded-full px-5 py-2 text-sm font-bold transition ${active ? 'bg-[#092653] text-white' : 'text-slate-600 hover:bg-[#f4f0e8] hover:text-[#092653]'}`}>{item.label}</Link>; })}</nav>

      <div className="flex items-center gap-1.5">
        <Link href="/carrinho" aria-label={`Carrinho com ${itemsCount} item(ns)`} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 hover:text-[#092653]"><ShoppingBag className="h-5 w-5" />{itemsCount > 0 && <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#b4232d] px-1 text-[10px] font-black text-white">{itemsCount}</span>}</Link>
        <Link href={session ? '/dashboard' : '/login'} className="hidden min-h-11 items-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-bold text-[#092653] hover:border-[#092653] sm:inline-flex"><User className="h-4 w-4" />{session ? 'Minha conta' : 'Entrar'}</Link>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? 'Fechar menu' : 'Abrir menu'} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 md:hidden">{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
      </div>
    </div>
    {open && <div id="mobile-navigation" className="border-t border-slate-200 bg-[#fffdf8] px-4 py-4 md:hidden"><nav className="grid gap-1">{navigation.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`rounded-xl px-4 py-3 text-base font-bold ${active ? 'bg-[#092653] text-white' : 'text-slate-800 hover:bg-[#f4f0e8]'}`}>{item.label}</Link>; })}<Link href={session ? '/dashboard' : '/login'} onClick={() => setOpen(false)} className="mt-2 rounded-xl border border-slate-300 px-4 py-3 text-base font-bold text-[#092653]">{session ? 'Minha conta' : 'Entrar'}</Link></nav></div>}
  </header>;
}
