# ADR-0003: Offline Read-Only Mode

- **Status:** Accepted
- **Date:** 2026-08-29
- **Deciders:** Stellar Dev Dashboard maintainers
- **Area:** offline mode

## Context

The dashboard must stay useful when connectivity drops (flights, subways, captive
portals, transient Horizon outages). The application already caches on three layers
([ADR-0002: caching](./adr-0002-caching-strategy.md)); offline mode needs:

- To serve cached data with a visible provenance signal (live vs cached vs stale).
- To block unsafe network-mutating operations while offline, while still allowing
  locally-side-effect-free actions (XDR export) and queueing writes for replay.
- Connectivity detection that does not trust `navigator.onLine` alone (captive
  portals report online while the network is dead).

## Decision

Introduce a dedicated read-only contract in
[`src/lib/offlineReadOnly.ts`](../../src/lib/offlineReadOnly.ts) built from four
pieces:

- **`NetworkStatus`** — a browser singleton listening to `online`/`offline` events,
  extended with a heartbeat that issues `fetch('/sw.js', { method: 'HEAD' })` every
  15s to verify real connectivity (marked `lastVerifiedAt`). Listener exceptions
  are swallowed so a broken consumer cannot crash the detector. In non-browser
  environments it degrades to `online = navigator.onLine ?? true`.
- **`DataSource` discriminator** — `'live' | 'cache' | 'cache-stale' | 'unknown'`.
  `evaluateDataSource(hasLiveData, meta)` combines network state, `cachedAt`, the
  entry TTL, and the service-worker-cache flag into a `DataSourceInfo` that UI
  badges/banners consume. Invalid or incomplete input degrades to `'unknown'`
  rather than throwing, so rendering never breaks.
- **`WriteSafetyGate`** — `assertWriteSafe(operation, { localOnly, allowQueued })`
  throws `OfflineWriteError` (`code = 'OFFLINE_WRITE_BLOCKED'`) for mutating
  operations while offline, unless the operation is `localOnly` (XDR export, pure
  client work) or already queued for replay (`allowQueued`). Non-string labels are
  normalised to `'unspecified write operation'`; `isWriteSafe()` is the
  non-throwing companion. `withOfflineGuard(operation, fetcher)` wraps network
  writes with the same gate.
- **Offline queue** — writes that must happen are persisted in the `offline-queue`
  IndexedDB store ([`storage.js`](../../src/lib/storage.js)) and replayed by the
  retry manager ([`RetryManager.ts`](../../src/lib/errorHandling/RetryManager.ts),
  `offlineQueue.enqueue/flush`), which flushes on the `online` event.

Supporting behaviour:

- The service worker ([`public/sw.js`](../../public/sw.js)) serves the static shell
  offline and exposes stats/puts/deletes through
  [`swCacheBridge.ts`](../../src/lib/swCacheBridge.ts).
- The data-sync manager
  ([`src/lib/sync/dataSyncManager.ts`](../../src/lib/sync/dataSyncManager.ts))
  reconciles cached and live data when connectivity returns.
- Offline stale windows are extended (5min) so recently cached values remain
  readable offline.

## Consequences

- **Pros:** a single authoritative gate protects every mutation path; provenance is
  explicit in the data layer; reconnect is automatic via events + queue flush.
- **Cons:** `navigator.onLine` mismatches are only corrected by the heartbeat
  (needs the SW script path to exist and be same-origin); operations must opt in to
  queueing — silently forgotten writes are not auto-queued; the 15s heartbeat adds
  a cheap, no-store HEAD request per cycle while online.

## Compatibility & Migration

- Offline detection works in every modern browser; the heartbeat and service-worker
  features are no-ops or degraded when `window`/`navigator`/`serviceWorker` are
  unavailable (SSR, restricted webviews).
- Sources introduced before this ADR (entries without `cachedAt`/`ttlMs` metadata)
  surface as `'unknown'` and re-badge correctly once re-fetched.
- Consumers migrating from manual `isOffline()` checks should switch to
  `subscribeToConnectivity()` + `evaluateDataSource()` so UI reflects verified
  state instead of `navigator.onLine` alone.

## Security Considerations

- Blocked writes fail loudly (`OFFLINE_WRITE_BLOCKED`) instead of failing silently
  — preventing double-submission or partial state drift from blind retries.
- Queued operations must be idempotent-friendly (queue deduplicates by operation
  ID) and must not capture secrets into persisted queue entries.
- Never enqueue raw secret keys; sign on the device at replay time where possible.

## Invalid Input, Unsupported Environments & Failure Paths

- **No `window`/`navigator`:** `networkStatus` is `null` and `isOnline()` falls back
  to `navigator.onLine ?? true`; `subscribeToConnectivity` immediately invokes the
  listener with `true` and returns a no-op unsubscribe.
- **Heartbeat failure (real outage):** any network-level fetch failure flips the
  singleton to offline; browser events restore it.
- **Broken listener:** exceptions in subscribers are swallowed; one bad listener
  does not disrupt the other subscribers.
- **Guard misuse:** `assertWriteSafe` never crashes callers on bad input — the
  operation label is normalised, and `isWriteSafe` never throws.
- **IndexedDB blocked:** queue writes degrade to localStorage where supported and
  otherwise fail with a readable error rather than silently dropping the write.

## Alternatives Considered

- **Trust `navigator.onLine` only** — rejected: captive portals and VPNs make it
  unreliable; the heartbeat was added instead.
- **Auto-queue every blocked write** — rejected: implicit persistence of signed
  transactions is a security and correctness hazard; queueing must be explicit.
- **Read-access-only on the UI layer** — rejected: enforcement belongs in the data
  layer so every code path (hooks, services, API calls) inherits the guard.

## References

- [`src/lib/offlineReadOnly.ts`](../../src/lib/offlineReadOnly.ts)
- [`src/lib/storage.js`](../../src/lib/storage.js)
- [`src/lib/swCacheBridge.ts`](../../src/lib/swCacheBridge.ts)
- [`src/lib/cache.js`](../../src/lib/cache.js)
- [`src/lib/errorHandling/RetryManager.ts`](../../src/lib/errorHandling/RetryManager.ts)
- [`src/lib/sync/dataSyncManager.ts`](../../src/lib/sync/dataSyncManager.ts)
- [`public/sw.js`](../../public/sw.js)
- Related: [ADR-0002: caching](./adr-0002-caching-strategy.md)