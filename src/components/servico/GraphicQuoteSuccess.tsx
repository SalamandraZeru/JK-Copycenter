'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { safeWhatsAppUrl, whatsappMessageFromUrl } from '@/lib/orders/graphic-quote-confirmation';

interface GraphicQuoteSuccessProps {
  requestId: string;
  requestCode: string;
  protocol: string;
  whatsappUrl: string | null;
  whatsappMessage?: string;
}

export function GraphicQuoteSuccess({ requestId, requestCode, protocol, whatsappUrl, whatsappMessage }: GraphicQuoteSuccessProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  const safeUrl = safeWhatsAppUrl(whatsappUrl);
  const message = whatsappMessage?.trim().slice(0, 12_000)
    || whatsappMessageFromUrl(whatsappUrl)
    || '';

  const copyMessage = async () => {
    if (!message) {
      setCopyStatus('manual');
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
      await navigator.clipboard.writeText(message);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('manual');
    }
  };

  return (
    <section aria-labelledby="quote-success-title" className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Solicitação registrada</p>
          <h1 id="quote-success-title" className="mt-1 text-2xl font-extrabold text-[#13233b] sm:text-3xl">
            Protocolo #{protocol}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Seus arquivos já estão no painel seguro da JK Copycenter. Envie o resumo pelo WhatsApp para iniciar o atendimento.
          </p>
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {safeUrl ? (
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white transition-colors hover:bg-emerald-700"
          >
            Abrir WhatsApp <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            O link direto do WhatsApp não está disponível. Guarde o protocolo e copie a mensagem ao lado.
          </p>
        )}
        <button
          type="button"
          onClick={copyMessage}
          disabled={!message}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-[#0d2b5c] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          {copyStatus === 'copied' ? 'Mensagem copiada' : 'Copiar mensagem'}
        </button>
      </div>

      <p aria-live="polite" className="mt-3 text-sm text-slate-600">
        {copyStatus === 'copied'
          ? 'Cole a mensagem na conversa da JK Copycenter.'
          : 'Se o WhatsApp não abrir, copie a mensagem e cole manualmente na conversa.'}
      </p>

      <Link
        href={`/orcamento/${requestId}#${requestCode}`}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-bold text-[#0d2b5c] hover:bg-slate-50"
      >
        Acompanhar análise e responder à proposta
      </Link>

      {copyStatus === 'manual' && message && (
        <div className="mt-4">
          <label htmlFor="quote-whatsapp-message" className="text-sm font-bold text-slate-800">
            Selecione e copie a mensagem abaixo
          </label>
          <textarea
            id="quote-whatsapp-message"
            value={message}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
            rows={8}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800"
          />
        </div>
      )}
    </section>
  );
}
