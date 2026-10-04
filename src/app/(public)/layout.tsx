import React from 'react';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { FloatingWhatsApp } from '@/components/shared/FloatingWhatsApp';
import { PwaRegistration } from '@/components/pwa/PwaRegistration';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { EssentialStorageNotice } from '@/components/privacy/EssentialStorageNotice';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header />
      <main className="flex min-w-0 flex-grow flex-col">
        {children}
      </main>
      <FloatingWhatsApp />
      <PwaRegistration />
      <InstallPrompt />
      <EssentialStorageNotice />
      <Footer />
    </div>
  );
}
