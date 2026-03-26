const CACHE_VERSION = 'meshaid-v2';
const PRECACHE_CACHE = `${CACHE_VERSION}-precache`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
];

const STATIC_DESTINATIONS = new Set(['script', 'style', 'font', 'image', 'worker']);

const cacheableResponse = (response) => response && (response.ok || response.type === 'opaque');

async function networkFirst(request, fallbackPath) {
  const runtime = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (cacheableResponse(response)) {
      runtime.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await runtime.match(request);
    if (cached) return cached;
    if (fallbackPath) {
      return caches.match(fallbackPath);
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const runtime = await caches.open(RUNTIME_CACHE);
  const cached = await runtime.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (cacheableResponse(response)) {
        runtime.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) return cached;

  const fresh = await fetchPromise;
  return fresh || Response.error();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![PRECACHE_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, '/index.html'));
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  if (STATIC_DESTINATIONS.has(event.request.destination)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});
