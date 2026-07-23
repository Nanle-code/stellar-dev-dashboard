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
