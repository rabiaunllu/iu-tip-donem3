const CACHE_NAME = 'iutip-cache-v14';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/style.css',
  './css/style.css?v=2.14',
  './js/config.js',
  './js/config.js?v=2.14',
  './js/utils.js',
  './js/utils.js?v=2.14',
  './js/state.js',
  './js/state.js?v=2.14',
  './js/data.js',
  './js/data.js?v=2.14',
  './js/render.js',
  './js/render.js?v=2.14',
  './js/app.js',
  './js/app.js?v=2.14',
  './data/schedule_2026_2027.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only cache GET requests
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // 1. Navigation istekleri (HTML / Sayfa Yükleme): Network-First
  // Kullanıcı online olduğunda her zaman GitHub Actions'ın son dağıttığı güncel index.html yüklenir.
  // Çevrimdışıyken (offline) önbellekteki index.html devreye girer.
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(e.request).then((cached) => cached || caches.match('./index.html') || caches.match('./'));
      })
    );
    return;
  }

  // 2. Statik dosyalar ve JSON verileri: Stale-While-Revalidate
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
