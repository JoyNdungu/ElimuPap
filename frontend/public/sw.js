const CACHE_NAME = 'elimupap-shell-v2';
const FILES_CACHE = 'elimupap-files-v1';
const APP_SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const KEEP = new Set([CACHE_NAME, FILES_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isBackendFile =
    url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/converted/');

  // Cache static uploaded study files (PDFs, DOCX, Audio) even from backend origin
  if (isBackendFile) {
    event.respondWith(
      caches.open(FILES_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((res) => {
            if (res && res.ok) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          });
        })
      )
    );
    return;
  }

  // Never intercept JSON API calls in the SW (handled by axios offlineCache)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
  );
});
