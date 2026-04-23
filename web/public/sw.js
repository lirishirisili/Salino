const CACHE_NAME = 'salino-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and Chrome extension requests
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension://')) return;

  // Network-first for API/Firebase calls
  if (
    request.url.includes('firestore.googleapis.com') ||
    request.url.includes('identitytoolkit.googleapis.com') ||
    request.url.includes('securetoken.googleapis.com')
  ) {
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }).catch(() => {
      if (request.destination === 'document') {
        return caches.match('/index.html');
      }
      return new Response('Offline', { status: 503 });
    })
  );
});
