'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GraphicQuoteSuccess } from '@/components/servico/GraphicQuoteSuccess';
import {
  GRAPHIC_QUOTE_CONFIRMATION_KEY,
  parseGraphicQuoteConfirmation,
  type GraphicQuoteConfirmation,
} from '@/lib/orders/graphic-quote-confirmation';

export default function SolicitacaoEnviadaPage() {
  const [confirmation, setConfirmation] = useState<GraphicQuoteConfirmation | null | undefined>(undefined);

  useEffect(() => {
    setConfirmation(parseGraphicQuoteConfirmation(sessionStorage.getItem(GRAPHIC_QUOTE_CONFIRMATION_KEY)));
  }, []);

  if (confirmation === undefined) {
    return <div className="mx-auto min-h-[50vh] max-w-4xl px-4 py-16 text-center text-slate-600">Carregando protocolo…</div>;
  }

  return (
    <main className="mx-auto min-h-[60vh] w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      {confirmation ? (
        <>
          <GraphicQuoteSuccess
            requestId={confirmation.requestId}
            requestCode={confirmation.requestCode}
            protocol={confirmation.protocol}
            whatsappUrl={confirmation.whatsappUrl}
            whatsappMessage={confirmation.whatsappMessage}
          />
          <div className="mt-6 flex flex-col gap-3 text-center sm:flex-row sm:justify-center">
            <Link href="/grafica" className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 font-bold text-[#0d2b5c] hover:bg-white">
              Solicitar outro orçamento
            </Link>
            <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 font-bold text-slate-600 hover:bg-white">
              Voltar ao início
            </Link>
          </div>
        </>
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-extrabold text-[#13233b]">Protocolo não encontrado neste navegador</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Se você já enviou a solicitação, fale com a JK Copycenter usando seus dados de contato. Nenhum pedido novo foi criado por esta tela.
          </p>
          <Link href="/grafica" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#0d2b5c] px-6 py-3 font-bold text-white hover:bg-[#b4232d]">
            Voltar aos serviços
          </Link>
        </section>
      )}
    </main>
  );
}
