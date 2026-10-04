const CACHE_NAME = 'jk-public-v4';
const PRECACHE_URLS = [
  '/offline.html',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
];
const EXCLUDED_PREFIXES = [
  '/api/',
  '/admin',
  '/dashboard',
  '/login',
  '/registro',
  '/carrinho',
  '/pedido',
  '/pedido-confirmado',
  '/servico',
  '/solicitacao-enviada',
  '/orcamento',
];
const CACHEABLE_PUBLIC_PAGES = new Set(['/', '/grafica', '/papelaria', '/sobre']);

function isExcluded(pathname) {
  return EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isSafeStatic(url) {
  return url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/icons/')
    || url.pathname.startsWith('/images/brand/')
    || url.pathname === '/favicon.ico';
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match('/offline.html'));
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('jk-public-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isExcluded(url.pathname)) return;

  if (request.mode === 'navigate') {
    if (CACHEABLE_PUBLIC_PAGES.has(url.pathname)) event.respondWith(networkFirst(request));
    return;
  }

  if (isSafeStatic(url)) event.respondWith(cacheFirst(request));
});

// Notificações push: mostra o aviso e, ao tocar, abre (ou foca) a página do pedido.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === 'string' ? data.title : 'JK Copycenter';
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/';
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    renotify: true,
    data: { url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === target.origin && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target.href);
        return;
      }
    }
    await self.clients.openWindow(target.href);
  })());
});
