'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AdminRole } from '@/types';
import { getAdminNavItems, isAdminNavItemActive } from './navigation';

interface AdminNavigationLinksProps {
  role: AdminRole;
  onNavigate?: () => void;
}

export function AdminNavigationLinks({ role, onNavigate }: AdminNavigationLinksProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação administrativa" className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
      {getAdminNavItems(role).map((item) => {
        const Icon = item.icon;
        const isActive = isAdminNavItemActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            {...(onNavigate ? { onClick: onNavigate } : {})}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
              isActive
                ? 'bg-[#1769aa] font-medium text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-400'}`} aria-hidden="true" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
