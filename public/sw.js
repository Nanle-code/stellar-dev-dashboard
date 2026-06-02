/**
 * Stellar Dev Dashboard — Service Worker
 * Caches the app shell (HTML + static assets) for offline use.
 * Network-first for Horizon/Soroban API calls; cache-first for everything else.
 */

const CACHE_NAME = 'stellar-shell-v1';

// Assets that form the offline-capable app shell
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// URL prefixes that should NEVER be cached (live network data)
const NETWORK_ONLY_PREFIXES = [
  'https://horizon',
  'https://soroban',
  'https://friendbot',
  'https://api.coingecko',
  'https://api.stellar',
];

function isNetworkOnly(url) {
  return NETWORK_ONLY_PREFIXES.some((prefix) => url.startsWith(prefix));
}

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests that aren't part of the shell
  if (!url.startsWith(self.location.origin) && !isNetworkOnly(url) === false) {
    return;
  }

  // Network-only: Horizon / Soroban / price APIs — never cache these
  if (isNetworkOnly(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // App shell & static assets: cache-first, fallback to network then offline page
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Cache successful same-origin responses
          if (
            response.ok &&
            (url.startsWith(self.location.origin) ||
              url.startsWith('https://fonts.'))
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: serve index.html for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});

// ─── Background Sync ─────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    console.log('Background sync triggered: sync-offline-queue');
    // In a real app, you'd call a function here to flush the IndexedDB queue
    // but since the SW doesn't have easy access to the same JS modules as the
    // client, we often rely on the client to flush when it wakes up, or
    // implement the flush logic here using IDB directly.
    event.waitUntil(Promise.resolve());
  }
});

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = { title: 'Stellar Dev Dashboard', body: 'New update available!' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ─── Message Handling ───────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});