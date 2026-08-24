'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ChevronRight,
} from 'lucide-react';
import { dashboardNavItems, isDashboardNavItemActive } from './navigation';

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Menu Principal
      </div>
      <ul className="space-y-1.5">
        {dashboardNavItems.map((item) => {
          const isActive = isDashboardNavItemActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.name}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50/60 text-blue-700 font-semibold shadow-xs border border-blue-100/80 translate-x-0.5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 hover:translate-x-1'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span>{item.name}</span>
                </div>

                {isActive ? (
                  <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
