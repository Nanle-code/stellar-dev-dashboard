# storage.js

Persistent storage layer using IndexedDB with localStorage fallback.

## Stores

| Store | Purpose |
|-------|---------|
| `app-state` | General key/value persistence (Zustand state) |
| `api-cache` | TTL-aware API response cache |
| `offline-queue` | Operations queued while offline |

## Functions

### `getStoredValue(key)` / `setStoredValue(key, value)` / `removeStoredValue(key)`

General-purpose key/value storage.

```js
await setStoredValue('theme', 'dark');
const theme = await getStoredValue('theme'); // 'dark'
await removeStoredValue('theme');
```

---

### `getCachedApiResponse(key)` / `setCachedApiResponse(key, value, ttl, tag?)`

TTL-aware API response cache. Returns `null` if missing or expired.

```js
const cached = await getCachedApiResponse('account:GABC');
if (!cached) {
  const data = await fetchAccount('GABC...');
  await setCachedApiResponse('account:GABC', data, 60_000, 'accounts');
}
```

---

### `deleteCachedApiResponse(key)` / `invalidateCacheByTag(tag)`

Remove individual entries or all entries with a given tag.

```js
await invalidateCacheByTag('accounts'); // clears all account cache entries
```

---

### `enqueueOfflineOp(op)` / `getOfflineQueue()` / `dequeueOfflineOp(id)`

Offline write queue for operations that should be retried when connectivity returns.

```js
await enqueueOfflineOp({ type: 'submit_tx', payload: xdrEnvelope });
const queue = await getOfflineQueue();
// process queue...
await dequeueOfflineOp(queue[0].id);
```

---

### `pruneExpiredApiCache()`

Removes all expired cache entries. Called automatically on module load.

---

### `storageStats()`

Returns size estimates for each store.

```js
const stats = await storageStats();
// { appState: 42, apiCache: 128, offlineQueue: 3 } (entry counts)
```

---

## Quota handling

Browsers cap how much a site can persist in IndexedDB and localStorage. `setStoredValue`
and `setCachedApiResponse` — the two write paths shared by `cache.js` and `cacheManager.ts`
— detect quota exhaustion and try to recover automatically instead of just failing:

1. A write fails with a quota error.
2. `evictSafeCacheEntries()` frees space by deleting expendable `api-cache` rows —
   expired entries first, then the oldest still-alive ones (see `selectEvictionCandidates`
   in `storageQuota.js`). Cache entries are safe to evict because they're re-fetchable;
   losing one just becomes a future cache miss.
3. The write is retried once.
4. Either way, `notifyQuotaExceeded()` fires so the UI can tell the user what happened.
   The `useStorageQuotaAlerts()` hook (mounted in `DashboardLayout`) subscribes to this
   and shows a toast — "we freed up space" if the retry succeeded, or instructions to
   clear site data manually if it didn't.

If IndexedDB itself is unsupported or blocked (e.g. private browsing in some browsers),
`setStoredValue` falls back to `localStorage`; if that also throws a quota error, the
failure is reported the same way rather than swallowed silently.

### `evictSafeCacheEntries(maxEntries?)`

Manually free up space by evicting expendable `api-cache` entries. Returns the number
of entries removed. Safe to call at any time.

```js
const freed = await evictSafeCacheEntries(100);
```

### Compatibility notes

Quota-exceeded errors aren't reported identically everywhere:

| Environment | Error shape |
|---|---|
| Chrome, Edge, Safari, current Firefox | `DOMException` with `name === 'QuotaExceededError'` |
| Older Firefox | `name === 'NS_ERROR_DOM_QUOTA_REACHED'` (or legacy `code === 1014`) |
| Legacy fallback | Legacy `code === 22` (`DOMException.QUOTA_EXCEEDED_ERR`) |

`isQuotaExceededError()` in `storageQuota.js` checks all of the above, plus a
message-text fallback (`/quota/i` + `/exceed|reached|full/i`) for environments that
only surface the failure as a plain string.

### Subscribing to quota events

```js
import { onQuotaExceeded } from '../lib/storageQuota.js';

const unsubscribe = onQuotaExceeded(({ store, recovered, evictedCount }) => {
  // ...
});
```
