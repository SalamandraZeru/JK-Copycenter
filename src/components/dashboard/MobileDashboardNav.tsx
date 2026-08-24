'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { LogoutButton } from '@/components/dashboard/LogoutButton';
import { dashboardNavItems, isDashboardNavItemActive } from './navigation';

const primaryItems = dashboardNavItems.slice(0, 3);
const overflowItems = dashboardNavItems.slice(3);

export function MobileDashboardNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const moreIsActive = overflowItems.some((item) => isDashboardNavItemActive(pathname, item.href));

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
      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-40 bg-slate-950/25 md:hidden"
            onClick={() => setIsOpen(false)}
          />
          <section
            id="dashboard-mobile-more-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Mais opções do painel"
            className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl md:hidden"
          >
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <p className="text-sm font-bold text-slate-900">Mais opções</p>
              <button
                type="button"
                aria-label="Fechar mais opções"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="Opções adicionais do painel">
              <ul className="space-y-1">
                {overflowItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isDashboardNavItemActive(pathname, item.href);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="mt-3 border-t border-slate-100 pt-3">
              <Link
                href="/grafica"
                className="flex min-h-11 items-center justify-center rounded-xl bg-[#0d2b5c] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#1769aa]"
              >
                Novo pedido gráfico
              </Link>
              <LogoutButton />
            </div>
          </section>
        </>
      )}

      <nav
        aria-label="Navegação principal do painel"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,32,64,0.10)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-4 gap-1">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = isDashboardNavItemActive(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="truncate">{item.name.replace('Meus ', '')}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls="dashboard-mobile-more-menu"
              className={`flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold transition ${
                moreIsActive || isOpen
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
              onClick={() => setIsOpen((current) => !current)}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
