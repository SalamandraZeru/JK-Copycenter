'use client';

import { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Loader2, Share } from 'lucide-react';
import { pushAvailability, subscribeThisDevice, type PushAvailability } from '@/lib/push/client';

type State = PushAvailability | 'loading' | 'working' | 'enabled' | 'error';

const storageKey = (orderId: string) => `jk-push-order:${orderId}`;

/** Oferece avisos push sobre as etapas de um pedido (ex.: quando ficar pronto). */
export function OrderPushOptIn({ orderId, orderCode }: { orderId: string; orderCode?: string }) {
  const [state, setState] = useState<State>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const availability = pushAvailability();
    let enabled = false;
    try {
      enabled = availability === 'available' && Notification.permission === 'granted'
        && localStorage.getItem(storageKey(orderId)) === '1';
    } catch {
      enabled = false;
    }
    setState(enabled ? 'enabled' : availability);
  }, [orderId]);

  const enable = async () => {
    setState('working');
    setError(null);
    try {
      const subscription = await subscribeThisDevice();
      const response = await fetch('/api/push/pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, ...(orderCode ? { orderCode } : {}), subscription }),
      });
      const json = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(json.error || 'Não foi possível ativar os avisos.');
      try { localStorage.setItem(storageKey(orderId), '1'); } catch { /* só lembrete visual */ }
      setState('enabled');
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : '';
      if (code === 'PUSH_DENIED') return setState('denied');
      if (code === 'PUSH_DISMISSED') return setState('available');
      setError(code && !code.startsWith('PUSH_') ? code : 'Não foi possível ativar os avisos agora.');
      setState('error');
    }
  };

  if (state === 'loading' || state === 'unsupported') return null;

  return (
    <div className="w-full rounded-2xl border border-[#092653]/15 bg-[#e8f1fa] p-4 text-left">
      {state === 'enabled' ? (
        <p className="flex items-start gap-3 text-sm font-semibold text-[#092653]">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-emerald-600" aria-hidden="true" />
          Avisos ativados. Você recebe uma notificação neste aparelho quando o pedido mudar de etapa.
        </p>
      ) : state === 'ios-install' ? (
        <div className="flex items-start gap-3 text-sm text-[#13233b]">
          <BellRing className="mt-0.5 h-5 w-5 flex-none text-[#b4232d]" aria-hidden="true" />
          <p>
            <strong className="block text-[#092653]">Quer aviso quando ficar pronto?</strong>
            No iPhone, instale o site primeiro: toque em <Share className="inline h-4 w-4 align-text-bottom" aria-label="Compartilhar" /> e depois em <strong>Adicionar à Tela de Início</strong>. Abra pelo ícone e ative os avisos.
          </p>
        </div>
      ) : state === 'denied' ? (
        <p className="flex items-start gap-3 text-sm text-[#13233b]">
          <BellRing className="mt-0.5 h-5 w-5 flex-none text-slate-400" aria-hidden="true" />
          As notificações estão bloqueadas neste navegador. Para receber avisos, libere as notificações nas configurações do site.
        </p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="flex flex-1 items-start gap-3 text-sm text-[#13233b]">
            <BellRing className="mt-0.5 h-5 w-5 flex-none text-[#b4232d]" aria-hidden="true" />
            <span>
              <strong className="block text-[#092653]">Quer aviso quando ficar pronto?</strong>
              Avisamos neste aparelho a cada etapa do pedido.
            </span>
          </p>
          <button
            type="button"
            onClick={enable}
            disabled={state === 'working'}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#092653] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#b4232d] disabled:opacity-60"
          >
            {state === 'working' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Ativar avisos
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
