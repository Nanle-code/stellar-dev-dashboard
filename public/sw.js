/**
 * Stellar Dev Dashboard — Service Worker (v3)
 *
 * Cache Layers handled here (L3):
 *   - App shell (HTML + static assets): cache-first, long-lived
 *   - Static Stellar API responses (account, transactions): network-first
 *     with cache fallback + configurable TTL header support
 *   - Live/streaming endpoints: network-only (never cache)
 *
 * Cache Storage buckets:
 *   stellar-shell-v3        App shell + static assets
 *   stellar-api-v3          Cacheable Horizon / Soroban GET responses
 *
 * Messaging protocol (postMessage from client):
 *   { type: 'SKIP_WAITING' }             — activate immediately
 *   { type: 'CACHE_PUT', url, data }     — store a pre-fetched value
 *   { type: 'CACHE_DELETE', url }        — evict a specific URL
 *   { type: 'CACHE_CLEAR_API' }          — flush the API cache bucket
 *   { type: 'GET_STATS' }                — reply with { type:'STATS', stats }
 *   { type: 'WARM_URLS', urls }          — pre-fetch a list of URLs into API cache
 */

const SHELL_CACHE  = 'stellar-shell-v3';
const API_CACHE    = 'stellar-api-v3';
const OLD_CACHES   = [
  'stellar-shell-v1',
  'stellar-shell-v2',
  'stellar-api-v1',
  'stellar-api-v2',
];

// ─── App shell assets ──────────────────────────────────────────────────────────
const SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];

// ─── Network-only URL prefixes (live data, auth, writes) ──────────────────────
const NETWORK_ONLY_PREFIXES = [
  'https://friendbot',            // faucet
  'https://api.coingecko',        // prices (volatile)
];

// ─── Cacheable API prefixes (GET-only, network-first + fallback) ──────────────
const CACHEABLE_API_PREFIXES = [
  'https://horizon',
  'https://soroban',
  'https://horizon-testnet',
  'https://horizon-futurenet',
  'https://soroban-testnet',
  'https://soroban-futurenet',
];

// Endpoints that must NEVER be cached even within cacheable prefixes
const NEVER_CACHE_PATHS = [
  '/transactions',  // write operations handled via POST
  '/fee_stats',     // always live
];

// Default TTL for API responses in the SW cache (ms)
const API_CACHE_TTL_MS = 30_000; // 30 s

// Max entries in the API cache bucket before oldest entries are evicted
const API_CACHE_MAX_ENTRIES = 150;

// ─── Stats counters ───────────────────────────────────────────────────────────
const stats = {
  shellHits: 0,
  apiHits: 0,
  apiMisses: 0,
  networkErrors: 0,
  evictions: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNetworkOnly(url) {
  return NETWORK_ONLY_PREFIXES.some((p) => url.startsWith(p));
}

function isCacheableApi(url) {
  if (!CACHEABLE_API_PREFIXES.some((p) => url.startsWith(p))) return false;
  try {
    const { pathname } = new URL(url);
    if (NEVER_CACHE_PATHS.some((p) => pathname.includes(p))) return false;
  } catch { return false; }
  return true;
}

/**
 * Wrap a Response with a custom expiry timestamp header so we can
 * validate TTL when reading from the SW cache.
 */
function stampedResponse(response, ttlMs = API_CACHE_TTL_MS) {
  const expires = Date.now() + ttlMs;
  const headers = new Headers(response.headers);
  headers.set('x-sw-expires', String(expires));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Return true if a cached Response has not yet passed its sw-expires header.
 */
function isFreshResponse(response) {
  const exp = parseInt(response.headers.get('x-sw-expires') || '0', 10);
  return exp > Date.now();
}

/**
 * Evict the oldest N entries from a cache to keep it under MAX size.
 */
async function evictOldest(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  if (keys.length <= maxEntries) return;
  const toDelete = keys.slice(0, keys.length - maxEntries);
  await Promise.all(toDelete.map((req) => cache.delete(req)));
  stats.evictions += toDelete.length;
}

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
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
            .filter((k) => OLD_CACHES.includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Only intercept GET requests
  if (request.method !== 'GET') return;

  // ── Network-only (volatile data) ──────────────────────────────────────────
  if (isNetworkOnly(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // ── L3: Cacheable Horizon / Soroban API ───────────────────────────────────
  if (isCacheableApi(url)) {
    event.respondWith(
      caches.open(API_CACHE).then(async (apiCache) => {
        // Try L3 cache first
        const cached = await apiCache.match(request);
        if (cached && isFreshResponse(cached)) {
          stats.apiHits++;
          return cached;
        }

        // Network fetch with TTL stamp
        try {
          const response = await fetch(request);
          if (response.ok) {
            const stamped = stampedResponse(response.clone());
            apiCache.put(request, stamped);
            evictOldest(API_CACHE, API_CACHE_MAX_ENTRIES);
          }
          stats.apiMisses++;
          return response;
        } catch {
          stats.networkErrors++;
          // Return stale data if available, even if expired
          if (cached) return cached;
          throw new Error('Network unavailable and no cached response');
        }
      }),
    );
    return;
  }

  // ── App shell & static assets: cache-first ────────────────────────────────
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) { stats.shellHits++; return cached; }

      return fetch(request)
        .then((response) => {
          if (
            response.ok &&
            (url.startsWith(self.location.origin) || url.startsWith('https://fonts.'))
          ) {
            caches.open(SHELL_CACHE).then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === 'navigate') return caches.match('/index.html');
        });
    }),
  );
});

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    // Signal all clients to flush their IDB offline queue
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) =>
        Promise.all(
          clients.map((client) =>
            client.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' }),
          ),
        ),
      ),
    );
  }
});

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Stellar Dev Dashboard', body: 'New update available!' };
  if (event.data) {
    try { data = event.data.json(); } catch { data.body = event.data.text(); }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(urlToOpen);
      }),
  );
});

// ─── Message Handling ─────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg) return;

  switch (msg.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    // Client manually stores a pre-fetched value in L3
    case 'CACHE_PUT': {
      if (msg.url && msg.data !== undefined) {
        caches.open(API_CACHE).then((cache) => {
          const response = new Response(JSON.stringify(msg.data), {
            headers: {
              'Content-Type': 'application/json',
              'x-sw-expires': String(Date.now() + (msg.ttl || API_CACHE_TTL_MS)),
            },
          });
          cache.put(msg.url, response);
          evictOldest(API_CACHE, API_CACHE_MAX_ENTRIES);
        });
      }
      break;
    }

    // Evict a specific URL from L3
    case 'CACHE_DELETE': {
      if (msg.url) {
        caches.open(API_CACHE).then((cache) => cache.delete(msg.url));
      }
      break;
    }

    // Flush the entire API cache bucket
    case 'CACHE_CLEAR_API': {
      caches.delete(API_CACHE);
      break;
    }

    // Respond with current stats
    case 'GET_STATS': {
      caches.open(API_CACHE).then(async (cache) => {
        const keys = await cache.keys();
        event.source?.postMessage({
          type: 'STATS',
          stats: { ...stats, apiCacheEntries: keys.length },
        });
      });
      break;
    }

    // Pre-warm a list of API URLs into L3
    case 'WARM_URLS': {
      if (Array.isArray(msg.urls)) {
        caches.open(API_CACHE).then(async (cache) => {
          for (const url of msg.urls) {
            try {
              const existing = await cache.match(url);
              if (existing && isFreshResponse(existing)) continue;
              const response = await fetch(url);
              if (response.ok) {
                cache.put(url, stampedResponse(response));
              }
            } catch { /* non-fatal */ }
          }
          evictOldest(API_CACHE, API_CACHE_MAX_ENTRIES);
        });
      }
      break;
    }
  }
});
