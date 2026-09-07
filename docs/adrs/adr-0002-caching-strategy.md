# ADR-0002: Multi-Layer Caching Strategy

- **Status:** Accepted
- **Date:** 2026-08-29
- **Deciders:** Stellar Dev Dashboard maintainers
- **Area:** caching

## Context

Horizon and Soroban RPC reads dominate dashboard traffic: account balances,
transactions, operations, ledgers, prices, and contract metadata. Users expect
sub-second renders, rate limits are tight, and the app must remain usable offline.
Requirements:

- Fast reads for hot keys, with persistence across reloads.
- Serve stale data instantly while revalidating (stale-while-revalidate).
- Per-namespace TTLs, event-based invalidation, and bounded memory.
- A clear provenance signal so UI can label live vs cached vs stale data
  (consumed by [ADR-0003: offline mode](./adr-0003-offline-mode.md)).

## Decision

Adopt `CacheManager` v2 in
[`src/lib/cacheManager.ts`](../../src/lib/cacheManager.ts) as the facade over three
cache layers, aligned with the load-distribution optimiser:

- **L1 — in-memory LRU** ([`src/lib/cache.js`](../../src/lib/cache.js)): doubly
  linked LRU with per-key TTL and tag sets, `maxSize`-bounded eviction, and
  subscriber notifications. Target hit rate >80% for hot keys.
- **L2 — IndexedDB** ([`src/lib/storage.js`](../../src/lib/storage.js)): `api-cache`
  store keyed by namespaced key with `expiresAt`/`tag` indexes; written through on
  `set`, fall back read on L1 miss. Target hit rate >60% for warm keys.
- **L3 — Service Worker cache** ([`src/lib/swCacheBridge.ts`](../../src/lib/swCacheBridge.ts)):
  network-level caching and offline serving populated by write-through for
  cacheable API URLs. Stats are requested asynchronously with a bounded timeout.

Behaviour:

- **SWR:** `swr()`/`getWithFallback()` return non-stale values immediately, serve
  stale values while refreshing in the background, and await the fetcher only on a
  cold miss. Stale windows differ by connectivity: 5s online, 5min offline.
- **TTL constants** (`TTL.*`): account 60s, transactions/operations 30s, ledger 5s,
  asset 5min, network 1h, price 30s, long 1h, short 10s.
- **Compression:** values larger than 512 bytes are LZ-compressed and tagged
  (`\x00lz:`) so decompression is transparent; compression is skipped when it does
  not save space, and round-trip integrity is validated on read.
- **Invalidation:** tag/prefix invalidation, `invalidateAccount()` after a
  successful submission, and `invalidateNetwork()` on network switch (which also
  clears the SW API bucket).
- **Warming:** startup hydration from IDB plus predictive prefetch and debounced
  background refresh, coordinated by
  [`src/lib/cacheWarmingStrategy.ts`](../../src/lib/cacheWarmingStrategy.ts).
- **Analytics:** hit/miss/latency/bytes per namespace
  ([`src/lib/cacheAnalytics.ts`](../../src/lib/cacheAnalytics.ts)) feed the dynamic
  cache controller and prediction middleware
  ([`src/cache/dynamicCacheController.ts`](../../src/cache/dynamicCacheController.ts),
  [`src/api/middleware/predictCache.ts`](../../src/api/middleware/predictCache.ts)).
- **Named managers:** `stellarCacheManager` (persistent, swCache, compress,
  maxBytes 10MB), `realtimeCacheManager` (volatile, TTL short),
  `priceCacheManager` (persistent 5min), `sorobanCacheManager` (persistent long).

## Consequences

- **Pros:** single read path (`getWithFallback`) with layered fallback; coherent
  layers via write-through; bounded memory via LRU + per-namespace `maxBytes`;
  provenance (`source: 'memory' | 'memory-stale' | 'indexeddb' | 'sw' | 'miss'`)
  is exposed to consumers.
- **Cons:** write-through adds latency; compression trades CPU for memory;
  L3 hit computation is asynchronous and best-effort; multiple cache entry points
  (`Cache`, `persistentCache`, `realtimeCache`, manager-wrapped `stellarCache`) must
  keep namespace discipline to avoid key collisions.

## Compatibility & Migration

- IndexedDB schema is versioned (`DB_VERSION = 4`); future store additions require a
  bump, and the `onversionchange` handler closes and reopens the DB gracefully in
  multi-tab scenarios. IDB operations fall back to `localStorage` when unavailable.
- Cache keys are namespaced (`stellar:`, `rt:`, `price:`, `soroban:`) so stores can
  be pruned independently without cross-talk.
- Migration of a cached value only needs `cachedAt`/`ttlMs` metadata for
  `evaluateDataSource()`; older entries without metadata are treated as unknown.
- The SW API bucket is a coarse invalidation unit — tag-level eviction is not
  supported there; broad-invalidate via `swCacheClearApi()` on account/network tags.

## Security Considerations

- Cached account data is public network state; do not write private keys, seed
  phrases, or session material into any cache layer.
- No cache write happens for user-supplied secrets; the app-state and API-cache
  stores should be cleared on wallet disconnect and logout.
- Compression is applied to serialised data only — no origin-specific sensitive data
  is introduced by the codec.

## Invalid Input, Unsupported Environments & Failure Paths

- **IDB unavailable/blocked:** `getStoredValue`/`setStoredValue` fall back to
  localStorage; a blocked upgrade rejects with a descriptive error that callers
  swallow and continue in L1-only mode.
- **Over-size value:** when `estimateBytes(value)` exceeds the per-namespace budget,
  the value is skipped in L1 but still persisted to IDB where configured.
- **Corrupt compressed payload:** `decompressValue` returns `null` on parse failure;
  callers fall back to a network fetch instead of crashing.
- **`estimateBytes` failure:** returns `0` (unmeasured) rather than throwing.
- **No service worker/controller:** `swCacheBridge` functions become no-ops and SW
  stats resolve to `null` after the timeout.

## Alternatives Considered

- **Single in-memory cache only** — rejected: loses persistence and offline
  serving required by the offline mode ADR.
- **Redis/server cache** — rejected for the browser client; the API layer may add
  one later but the client cannot depend on it.
- **Eager fetch + no caching** — rejected: rate limits and latency targets are not
  met.

## References

- [`src/lib/cacheManager.ts`](../../src/lib/cacheManager.ts)
- [`src/lib/cache.js`](../../src/lib/cache.js)
- [`src/lib/storage.js`](../../src/lib/storage.js)
- [`src/lib/swCacheBridge.ts`](../../src/lib/swCacheBridge.ts)
- [`src/lib/cacheCompression.ts`](../../src/lib/cacheCompression.ts)
- [`src/lib/cacheWarmingStrategy.ts`](../../src/lib/cacheWarmingStrategy.ts)
- [`src/cache/dynamicCacheController.ts`](../../src/cache/dynamicCacheController.ts)
- [`src/api/middleware/predictCache.ts`](../../src/api/middleware/predictCache.ts)
- Related: [ADR-0003: offline mode](./adr-0003-offline-mode.md)