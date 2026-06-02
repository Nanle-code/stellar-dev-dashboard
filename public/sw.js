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

// ─── Background Sync / Update notification ───────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});