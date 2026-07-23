/**
 * swCacheBridge.ts — Service Worker cache bridge.
 *
 * Provides a thin messaging layer so in-page code can instruct
 * the Service Worker to cache/invalidate HTTP responses.
 *
 * When no Service Worker is available (dev mode, unsupported browser)
 * all functions are no-ops and stats return null.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SWStats {
  cacheNames: string[];
  entryCount: number;
  estimatedBytes: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasSW(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker.controller !== null
  );
}

function postToSW(message: Record<string, unknown>): void {
  if (!hasSW()) return;
  navigator.serviceWorker.controller!.postMessage(message);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Tell the SW to cache a URL with an optional TTL (seconds). */
export function swCachePut(url: string, _value: unknown, ttlSeconds?: number): void {
  postToSW({ type: 'CACHE_PUT', url, ttlSeconds: ttlSeconds ?? 0 });
}

/** Tell the SW to evict a cached URL. */
export function swCacheDelete(url: string): void {
  postToSW({ type: 'CACHE_DELETE', url });
}

/** Tell the SW to clear all API/network caches. */
export function swCacheClearApi(): void {
  postToSW({ type: 'CACHE_CLEAR_API' });
}

/**
 * Request cache statistics from the SW.
 * Resolves to null if no SW is available or the request times out.
 */
export function swGetStats(timeoutMs = 1000): Promise<SWStats | null> {
  if (!hasSW()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.onmessage = null;
      resolve(null);
    }, timeoutMs);

    channel.port1.onmessage = (event: MessageEvent<SWStats>) => {
      clearTimeout(timer);
      resolve(event.data ?? null);
    };

    navigator.serviceWorker.controller!.postMessage(
      { type: 'GET_STATS' },
      [channel.port2]
    );
  });
}

// ─── Legacy helpers (kept for backward compatibility) ─────────────────────────

/** @deprecated Use swCachePut instead. */
export function syncCacheToSW(key: string, value: unknown): void {
  swCachePut(key, value);
}

/** @deprecated Use swCacheDelete instead. */
export function invalidateSWCache(key: string): void {
  swCacheDelete(key);
}

// ─── Extended helpers ─────────────────────────────────────────────────────────

type SWMessageHandler = (data: unknown) => void;

const _swMessageHandlers: Map<string, SWMessageHandler[]> = new Map();

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const type: string = event.data?.type;
    if (!type) return;
    const handlers = _swMessageHandlers.get(type) ?? [];
    handlers.forEach((h) => h(event.data));
  });
}

/**
 * Register a handler for messages broadcast from the Service Worker.
 * Returns an unsubscribe function.
 */
export function onSWMessage(type: string, handler: SWMessageHandler): () => void {
  const existing = _swMessageHandlers.get(type) ?? [];
  _swMessageHandlers.set(type, [...existing, handler]);
  return () => {
    const handlers = _swMessageHandlers.get(type) ?? [];
    _swMessageHandlers.set(type, handlers.filter((h) => h !== handler));
  };
}

/** Tell the SW to pre-cache a list of URLs. */
export function swWarmUrls(urls: string[]): void {
  postToSW({ type: 'WARM_URLS', urls });
}
