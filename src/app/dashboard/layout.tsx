import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Sparkles,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { LogoutButton } from '@/components/dashboard/LogoutButton';
import { MobileDashboardNav } from '@/components/dashboard/MobileDashboardNav';
import { SidebarNav } from '@/components/dashboard/SidebarNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let profile: { full_name: string | null; avatar_url: string | null } = {
    full_name: null,
    avatar_url: null,
  };

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();
    if (data) profile = data;
  }

  const userDisplayName = profile?.full_name || user?.email?.split('@')[0] || 'Cliente';
  const initial = userDisplayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 flex selection:bg-[#1769aa] selection:text-white">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-white border-r border-slate-200/80 flex-shrink-0 hidden md:flex flex-col shadow-[1px_0_4px_rgba(0,0,0,0.02)]">
        {/* Brand & Badge Header */}
        <div className="h-[72px] flex items-center justify-between px-5 border-b border-slate-100 bg-white">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image src="/images/brand/jk-monogram.webp" alt="JK Copycenter" width={360} height={404} className="h-10 w-auto object-contain" />
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-slate-900 leading-none">
                Copycenter
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Área do Cliente</span>
            </div>
          </Link>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#e8f1fa] text-[#0d2b5c] border border-[#b7d0e8] shadow-xs">
            <Sparkles className="w-2.5 h-2.5 text-[#1769aa]" />
            Cliente JK
          </span>
        </div>
        
        {/* Navigation Links */}
        <SidebarNav />

        {/* Catalog CTA Promo */}
        <div className="p-3 mx-3 mb-3 bg-[#e8f1fa]/70 rounded-xl border border-[#b7d0e8] shadow-xs">
          <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-[#0d2b5c]">
            <ShoppingBag className="w-3.5 h-3.5 text-[#1769aa]" />
            <span>Precisa de Impressão?</span>
          </div>
          <p className="text-[11px] text-slate-600 mb-2.5 leading-relaxed">
            Acesse nosso catálogo completo com cálculo automático de preços.
          </p>
          <Link
            href="/grafica"
            className="flex min-h-10 items-center justify-center gap-1.5 w-full py-1.5 px-3 bg-[#0d2b5c] hover:bg-[#1769aa] text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
          >
            <span>Ir para o Catálogo</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg bg-white border border-slate-200/60 shadow-xs">
            <div className="relative w-8 h-8 rounded-full bg-[#0d2b5c] flex items-center justify-center text-white text-xs font-bold shadow-xs overflow-hidden flex-shrink-0">
              {profile?.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {profile?.full_name || 'Cliente'}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {user?.email || 'Conta Verificada'}
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Glassmorphic Header */}
        <header className="sticky top-0 z-30 h-[72px] bg-white/95 border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all">
          <div className="flex items-center gap-3 md:hidden">
            <Image src="/images/brand/jk-monogram.webp" alt="JK Copycenter" width={360} height={404} className="h-9 w-auto" />
            <div>
              <span className="font-bold text-sm text-slate-900">JK Copycenter</span>
              <span className="block text-[10px] text-slate-500 leading-none">Portal do Cliente</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sistema Online &bull; Passos/MG
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/grafica"
              className="hidden sm:inline-flex min-h-10 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0d2b5c] bg-[#e8f1fa] hover:bg-[#d9eafa] border border-[#b7d0e8] rounded-lg transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Novo Pedido
            </Link>

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  {userDisplayName}
                </p>
                <p className="text-[10px] text-slate-400">Cliente Cadastrado</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#0d2b5c] p-[1.5px] shadow-sm">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-[#0d2b5c]">{initial}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 md:pb-6 lg:p-8 bg-slate-50/60">
          {children}
        </main>
      </div>
      <MobileDashboardNav />
    </div>
  );
}
