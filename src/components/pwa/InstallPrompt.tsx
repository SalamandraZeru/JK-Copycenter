'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { PlusSquare, Share, X } from 'lucide-react';
import { isIos, isStandalone } from '@/lib/push/client';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Variant = 'public' | 'admin';

const COPY: Record<Variant, { title: string; body: string }> = {
  public: {
    title: 'Instale o app da JK Copycenter',
    body: 'Abra em um toque, direto da tela inicial, e receba avisos do seu pedido.',
  },
  admin: {
    title: 'Instale o painel JK Admin',
    body: 'Abra o painel como app e receba aviso de cada pedido novo.',
  },
};

const DISMISS_DAYS = 7;
const SHOW_DELAY_MS = 2500;

function dismissedRecently(variant: Variant): boolean {
  try {
    const value = Number(localStorage.getItem(`jk-install-dismissed:${variant}`));
    return Number.isFinite(value) && Date.now() - value < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function rememberDismiss(variant: Variant) {
  try { localStorage.setItem(`jk-install-dismissed:${variant}`, String(Date.now())); } catch { /* sem memória: volta a aparecer depois */ }
}

/**
 * Banner que convida a instalar o PWA. Chrome/Edge (Android e PC) usam o
 * prompt nativo; no iPhone, que não tem esse prompt, mostramos o passo a passo.
 */
export function InstallPrompt({ variant = 'public' }: { variant?: Variant }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<'hidden' | 'native' | 'ios'>('hidden');

  useEffect(() => {
    if (isStandalone() || dismissedRecently(variant)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      clearTimeout(timer);
      timer = setTimeout(() => setMode('native'), SHOW_DELAY_MS);
    };
    const onInstalled = () => {
      setMode('hidden');
      setDeferred(null);
      rememberDismiss(variant);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // Safari do iPhone/iPad: só dá para instalar pelo menu Compartilhar.
    const ua = navigator.userAgent;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (isIos() && isSafari) timer = setTimeout(() => setMode('ios'), SHOW_DELAY_MS + 1500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [variant]);

  if (mode === 'hidden') return null;

  const close = () => {
    rememberDismiss(variant);
    setMode('hidden');
  };

  const install = async () => {
    if (!deferred) return close();
    await deferred.prompt();
    const choice = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    setDeferred(null);
    if (choice.outcome === 'dismissed') rememberDismiss(variant);
    setMode('hidden');
  };

  const copy = COPY[variant];
  return (
    <div
      role="dialog"
      aria-labelledby="jk-install-title"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-[#092653]/15 bg-[#fffdf8] p-4 shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:mx-0 sm:w-[24rem]"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Fechar"
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <img src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 flex-none rounded-xl shadow-sm" />
        <div className="min-w-0">
          <p id="jk-install-title" className="font-black leading-tight text-[#092653]">{copy.title}</p>
          {mode === 'native' ? (
            <p className="mt-1 text-sm leading-snug text-slate-600">{copy.body}</p>
          ) : (
            <ol className="mt-1 space-y-1 text-sm leading-snug text-slate-600">
              <li>1. Toque em <Share className="inline h-4 w-4 align-text-bottom text-[#092653]" aria-label="Compartilhar" /> na barra do Safari.</li>
              <li>2. Escolha <strong className="text-[#092653]">Adicionar à Tela de Início</strong> <PlusSquare className="inline h-4 w-4 align-text-bottom" aria-hidden="true" />.</li>
            </ol>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={close} className="min-h-10 rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100">
          {mode === 'native' ? 'Agora não' : 'Entendi'}
        </button>
        {mode === 'native' && (
          <button type="button" onClick={install} className="min-h-10 rounded-xl bg-[#b4232d] px-5 text-sm font-bold text-white hover:bg-[#951c25]">
            Instalar
          </button>
        )}
      </div>
    </div>
  );
}
