import React from 'react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { FloatingWhatsApp } from '@/components/shared/FloatingWhatsApp';
import { PwaRegistration } from '@/components/pwa/PwaRegistration';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header />
      <main className="flex-grow flex flex-col">
        {children}
      </main>
      <FloatingWhatsApp />
      <PwaRegistration />
      <Footer />
    </div>
  );
}
