'use client';

import { useEffect, useState } from 'react';

function canRegisterServiceWorker() {
  return 'serviceWorker' in navigator
    && (window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname));
}

export function PwaRegistration() {
  const [offline, setOffline] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [registrationState, setRegistrationState] = useState<'mounting' | 'unsupported' | 'registering' | 'registered' | 'failed'>('mounting');

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    if (!canRegisterServiceWorker()) {
      setRegistrationState('unsupported');
      return () => {
        window.removeEventListener('offline', onOffline);
        window.removeEventListener('online', onOnline);
      };
    }

    let active = true;
    let refreshing = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    async function register() {
      try {
        setRegistrationState('registering');
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        if (!active) return;
        setRegistrationState('registered');

        const setUpdateIfReady = () => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            setWaitingWorker(registration.waiting);
          }
        };
        setUpdateIfReady();
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') setUpdateIfReady();
          });
        });
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        void registration.update();
      } catch {
        if (active) setRegistrationState('failed');
        // PWA is progressive enhancement; a registration failure must not block the store.
      }
    }

    void register();
    return () => {
      active = false;
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return (
    <>
      <span data-pwa-registration={registrationState} hidden />
      {offline ? (
        <div role="status" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-950 shadow-lg">
          Você está sem conexão. Conteúdo já aberto pode continuar disponível, mas pedidos não podem ser finalizados offline.
        </div>
      ) : null}
      {waitingWorker ? (
        <div role="status" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-[#b7d0e8] bg-white px-4 py-3 text-sm text-[#0d2b5c] shadow-lg">
          <span>Uma atualização está pronta.</span>
          <button
            type="button"
            onClick={() => waitingWorker.postMessage({ type: 'SKIP_WAITING' })}
            className="min-h-11 rounded-lg bg-[#0d2b5c] px-3 py-2 text-sm font-bold text-white hover:bg-[#1769aa]"
          >
            Atualizar
          </button>
        </div>
      ) : null}
    </>
  );
}
