---
id: offline-support
title: Offline Support
sidebar_label: Offline Support
---

# Offline Support

The dashboard works in degraded mode when the network is unavailable — it serves cached data instantly and queues write operations for replay when connectivity returns.

## How it works

```
Online  → fetch from network → write to L1 (memory) + L2 (IndexedDB)
Offline → serve from L2 cache → queue writes in offline-queue store
Back online → flush offline queue automatically → refresh stale cache entries
```

## Cache layers

| Layer | Storage | Scope | TTL |
|---|---|---|---|
| L1 | In-memory LRU | Current session | Configurable per key |
| L2 | IndexedDB | Persists across reloads | Configurable per key |

The two-layer cache is managed by `src/lib/cacheManager.ts`:

```ts
import { stellarCacheManager } from '@/lib/cacheManager';

// Write to both layers
await stellarCacheManager.set('account:GABC...', accountData, {
  ttl: 30_000,
  tags: ['accounts'],
});

// Read — L1 first, L2 fallback
const { data, stale } = await stellarCacheManager.get('account:GABC...');
if (stale) {
  // Revalidate in background (stale-while-revalidate)
  revalidateAccount();
}
```

## Offline queue

Operations that require a network write (transaction submissions) are held in the offline queue and retried automatically:

```ts
import { offlineQueue } from '@/lib/errorHandling/RetryManager';

// Enqueue a submission for later
await offlineQueue.enqueue(
  'submit-payment-abc123',
  () => server.submitTransaction(signedTx),
  'XLM payment to GDEST...'
);
```

The queue flushes automatically when the browser fires the `online` event. You can also flush manually:

```ts
await offlineQueue.flush();
```

## Detecting offline state

```ts
import { isOffline } from '@/lib/cache';

if (isOffline()) {
  showOfflineBanner('Using cached data. Some features unavailable.');
}

// React hook example
window.addEventListener('online',  () => setIsOnline(true));
window.addEventListener('offline', () => setIsOnline(false));
```

## Service Worker

The dashboard ships a service worker (`public/sw.js`) that caches static assets for fully offline shell loading. The UI loads instantly from cache even with no network, then hydrates with fresh data once connectivity returns.

```js
// In your app entry point
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

## Cache invalidation

```ts
import { stellarCacheManager } from '@/lib/cacheManager';

// Invalidate all entries for a tag group
await stellarCacheManager.invalidateByTag('accounts');

// Or clear everything
await stellarCacheManager.clear();

// Prune expired entries (called automatically on startup)
import { pruneCaches } from '@/lib/cacheManager';
await pruneCaches();
```

## Best practices

- Tag all account-related cache entries with `'accounts'` so they can be bulk-invalidated on wallet disconnect
- Use `stale-while-revalidate` for price data — users see the last known price instantly, then it silently updates
- Never enqueue the same operation ID twice — the queue deduplicates by ID
- Test offline behaviour with Chrome DevTools → Network tab → Offline
