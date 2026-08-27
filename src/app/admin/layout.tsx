import type { Metadata, Viewport } from 'next';
import React from 'react';
import { getAdminSession } from '@/lib/auth/admin';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AdminPwaRegistration } from '@/components/pwa/AdminPwaRegistration';

export const metadata: Metadata = {
  title: 'Administração',
  applicationName: 'Administração JK Copycenter',
  manifest: '/admin-manifest.webmanifest',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0d2b5c',
  colorScheme: 'light',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  // O PWA administrativo precisa ser registrável desde o login. O worker tem
  // escopo /admin/ e só armazena ativos estáticos; não persiste páginas nem
  // dados autenticados.
  if (!session) {
    return (
      <>
        <AdminPwaRegistration />
        {children}
      </>
    );
  }

  return (
    <div className="admin-shell min-h-screen bg-slate-50 flex">
      {/* Sidebar with role-based links */}
      <div className="admin-sidebar hidden shrink-0 print:hidden md:block">
        <Sidebar role={session.role} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="admin-header print:hidden">
          <Header user={session} />
        </div>
        <AdminPwaRegistration />
        
        <main className="admin-main flex-1 overflow-y-auto p-4 sm:p-6 print:hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
