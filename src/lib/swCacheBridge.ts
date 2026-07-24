/**
 * swCacheBridge.ts — Service Worker Cache Bridge
 *
 * Provides client-side API to interact with the Service Worker's L3 cache layer.
 * The SW intercepts network fetches and caches API responses; this bridge allows
 * the main thread to explicitly manage SW cache entries.
 */

export interface SWStats {
  size: number;
  entries: number;
  lastUpdated: number;
}

/**
 * Put a value into the SW cache for the given URL.
 * This posts a message to the SW which then updates its cache.
 */
export function swCachePut(url: string, value: unknown, ttl: number): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_PUT',
      url,
      value,
      ttl,
    });
  }
}

/**
 * Delete a URL from the SW cache.
 */
export function swCacheDelete(url: string): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_DELETE',
      url,
    });
  }
}

/**
 * Clear all API responses from the SW cache.
 */
export function swCacheClearApi(): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_CLEAR_API',
    });
  }
}

/**
 * Request stats from the SW cache.
 * Returns a promise that resolves with the stats or null if SW is not available.
 */
export async function swGetStats(timeout: number = 500): Promise<SWStats | null> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return null;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(null), timeout);

    const handler = (event: MessageEvent) => {
      if (event.data.type === 'CACHE_STATS') {
        clearTimeout(timeoutId);
        navigator.serviceWorker!.removeEventListener('message', handler);
        resolve(event.data.stats as SWStats);
      }
    };

    navigator.serviceWorker!.addEventListener('message', handler);
    navigator.serviceWorker.controller?.postMessage({
      type: 'CACHE_GET_STATS',
    });
  });
}
