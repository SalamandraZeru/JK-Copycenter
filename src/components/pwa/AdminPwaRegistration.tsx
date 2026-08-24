'use client';

import { useEffect } from 'react';

function canRegisterServiceWorker() {
  return 'serviceWorker' in navigator
    && (window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname));
}

export function AdminPwaRegistration() {
  useEffect(() => {
    if (!canRegisterServiceWorker()) return;

    void navigator.serviceWorker.register('/admin-sw.js', {
      scope: '/admin/',
      updateViaCache: 'none',
    });
  }, []);

  return null;
}
