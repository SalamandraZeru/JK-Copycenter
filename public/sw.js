const CACHE_NAME = 'jk-public-v1';
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
