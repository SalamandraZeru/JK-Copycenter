'use client';

import { useEffect, useState } from 'react';
import { BellOff, BellRing, Loader2 } from 'lucide-react';
import { currentDeviceSubscription, pushAvailability, subscribeThisDevice, type PushAvailability } from '@/lib/push/client';

type State = PushAvailability | 'loading' | 'working' | 'enabled';
const STORAGE_KEY = 'jk-push-admin';

/** Liga/desliga, neste aparelho, o aviso de pedidos novos para a equipe. */
export function AdminPushToggle() {
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const availability = pushAvailability();
    if (availability !== 'available') {
      setState(availability);
      return;
    }
    currentDeviceSubscription().then((subscription) => {
      let remembered = false;
      try { remembered = localStorage.getItem(STORAGE_KEY) === '1'; } catch { remembered = false; }
      if (active) setState(subscription && remembered ? 'enabled' : 'available');
    }).catch(() => { if (active) setState('available'); });
    return () => { active = false; };
  }, []);

  const enable = async () => {
    setState('working');
    setMessage(null);
    try {
      const subscription = await subscribeThisDevice();
      const response = await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });
      if (!response.ok) throw new Error('save');
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* só lembrete visual */ }
      setState('enabled');
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : '';
      if (code === 'PUSH_DENIED') return setState('denied');
      setMessage(code === 'PUSH_DISMISSED' ? null : 'Não foi possível ativar agora.');
      setState('available');
    }
  };

  const disable = async () => {
    setState('working');
    const subscription = await currentDeviceSubscription().catch(() => null);
    if (subscription) {
      await fetch('/api/admin/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => undefined);
      await subscription.unsubscribe().catch(() => false);
    }
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignora */ }
    setState('available');
  };

  if (state === 'loading' || state === 'unsupported') return null;

  const text = state === 'enabled'
    ? 'Este aparelho recebe aviso de cada pedido novo.'
    : state === 'denied'
      ? 'Notificações bloqueadas neste navegador. Libere nas configurações do site.'
      : state === 'ios-install'
        ? 'No iPhone, instale o painel na tela de início para receber avisos.'
        : 'Receba um aviso neste aparelho quando chegar pedido novo.';

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#092653]/15 bg-white p-4 sm:flex-row sm:items-center">
      <p className="flex flex-1 items-start gap-3 text-sm text-slate-700">
        {state === 'enabled'
          ? <BellRing className="mt-0.5 h-5 w-5 flex-none text-emerald-600" aria-hidden="true" />
          : <BellRing className="mt-0.5 h-5 w-5 flex-none text-[#b4232d]" aria-hidden="true" />}
        <span>
          <strong className="block text-[#092653]">Avisos de pedidos</strong>
          {text}
          {message && <span className="mt-1 block text-xs font-medium text-red-700">{message}</span>}
        </span>
      </p>
      {(state === 'available' || state === 'working' || state === 'enabled') && (
        <button
          type="button"
          onClick={state === 'enabled' ? disable : enable}
          disabled={state === 'working'}
          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-60 ${
            state === 'enabled'
              ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              : 'bg-[#092653] text-white hover:bg-[#b4232d]'
          }`}
        >
          {state === 'working' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {state === 'enabled' ? <><BellOff className="h-4 w-4" aria-hidden="true" /> Desativar</> : 'Ativar avisos'}
        </button>
      )}
    </div>
  );
}
