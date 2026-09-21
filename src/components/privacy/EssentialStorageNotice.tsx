'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

const STORAGE_KEY = 'jk-essential-storage-notice-v1';

export function EssentialStorageNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(STORAGE_KEY) !== 'dismissed');
  }, []);

  if (!visible) return null;
  return (
    <aside aria-label="Aviso sobre cookies essenciais" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-slate-700 bg-slate-950 p-4 text-white shadow-2xl sm:flex sm:items-center sm:gap-5 sm:p-5">
      <p className="pr-8 text-sm leading-6 text-slate-200 sm:flex-1 sm:pr-0">
        Usamos cookies e armazenamento local necessários para login, segurança, uploads e continuidade do seu pedido. Não identificamos cookies de publicidade ou analytics no site atual. <Link href="/privacidade" className="font-bold text-white underline underline-offset-4">Entenda o uso</Link>.
      </p>
      <button type="button" onClick={() => { window.localStorage.setItem(STORAGE_KEY, 'dismissed'); setVisible(false); }} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-slate-950 hover:bg-slate-100 sm:mt-0">Entendi</button>
      <button type="button" onClick={() => { window.localStorage.setItem(STORAGE_KEY, 'dismissed'); setVisible(false); }} aria-label="Fechar aviso" className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white sm:hidden"><X className="h-5 w-5" /></button>
    </aside>
  );
}
