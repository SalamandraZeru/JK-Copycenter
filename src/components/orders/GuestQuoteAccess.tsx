'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QuoteDecisionPanel } from './QuoteDecisionPanel';

function validCode(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

export function GuestQuoteAccess({ orderId }: { orderId: string }) {
  const [requestCode, setRequestCode] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const storageKey = `jk_quote_access_${orderId}`;
    const fragment = decodeURIComponent(window.location.hash.slice(1));
    const stored = sessionStorage.getItem(storageKey);
    const code = validCode(fragment) ? fragment : validCode(stored) ? stored : null;
    if (code) sessionStorage.setItem(storageKey, code);
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    setRequestCode(code);
  }, [orderId]);

  if (requestCode === undefined) return <div className="py-20 text-center text-slate-600">Abrindo proposta segura…</div>;
  if (!requestCode) return <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-2xl font-bold text-slate-950">Link incompleto ou expirado</h1><p className="mt-2 text-slate-600">Peça à equipe JK Copycenter um novo link para este protocolo.</p><Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#0d2b5c] px-5 font-bold text-white">Voltar ao início</Link></section>;
  return <QuoteDecisionPanel orderId={orderId} requestCode={requestCode} />;
}
