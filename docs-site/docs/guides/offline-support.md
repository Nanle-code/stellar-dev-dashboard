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

### Controlled update prompt

When a new version of the dashboard is deployed, the service worker installs in the background without forcing an immediate reload. Instead, it notifies the application that an update is available, and the user sees a prompt asking them to activate the new version. This prevents stale-chunk crashes and unexpected reloads.

**How it works:**

1. The new SW installs and enters a **waiting** state.
2. The application detects the waiting worker and sets `updateAvailable = true`.
3. A UI banner (SWUpdatePrompt) invites the user to update.
4. When the user clicks **Update**, the app sends a `RESUME_ACTIVATION` message to the waiting worker.
5. The SW activates, takes control of all clients, and the page reloads with the new version.

### Deferred activation during signing (issue #886)

Activating a waiting service worker makes it take control of the page, which is usually followed by a reload so all assets come from the new version. Interrupting a wallet signature mid-flight would lose the user's work, so critical signing flows are protected:

- While a signing operation is active, `applySWUpdate()` **defers** activation. The waiting worker is told `DEFER_ACTIVATION` and stays installed; nothing reloads.
- If the new worker takes control during a signing flow (e.g. another tab activated it), the reload is **postponed** until the flow ends.
- When `setCriticalSigningActive(false)` ends the flow, a deferred update is activated automatically and the page reloads once.
- The SWUpdatePrompt banner shows "Update scheduled" instead of appearing to do nothing.

```ts
import { setCriticalSigningActive, isCriticalSigningActive } from '@/utils/offline';

// Wrap any critical signing operation:
setCriticalSigningActive(true);
try {
  await signTransaction(tx);   // SW activation/reload is blocked for this window
} finally {
  setCriticalSigningActive(false); // pending update activates + reloads now
}
```

`TransactionSigner` already wraps its signing flow this way. The protection is best-effort: if the browser discards the page (tab closed, crash), the update simply applies on the next load.

**Developer API:**

```ts
import {
  subscribeToSWUpdates,
  applySWUpdate,
  isSWUpdateAvailable,
  setCriticalSigningActive,
  isCriticalSigningActive,
} from '@/utils/offline';

// Subscribe to update availability
const unsub = subscribeToSWUpdates((available) => {
  if (available) showUpdateBanner();
});

// Check if an update is waiting
if (isSWUpdateAvailable()) {
  // Show update UI
}

// Activate the update (or defer it if a signing flow is active)
// Returns 'activated' | 'deferred' | null
const result = await applySWUpdate();
```

**Service-worker messaging protocol** (`public/sw.js`):

| Message | Behaviour |
|---|---|
| `RESUME_ACTIVATION` | Clears any deferral and activates immediately (`skipWaiting()`). |
| `DEFER_ACTIVATION` | Marks activation as postponed; the worker stays in the waiting state. |
| `SKIP_WAITING` | Legacy immediate activation kept for backwards compatibility. |

**Compatibility:** Requires `'serviceWorker' in navigator`. Functions are no-ops in unsupported environments. Older cached SW versions that only understand `SKIP_WAITING` still activate normally — the client falls back gracefully.

**Security:** Activation messages are only posted to the same-origin service worker registered by the application. No user data is transmitted during the update flow, and signing operations are never interrupted by an activation message.

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
