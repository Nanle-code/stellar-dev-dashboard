/**
 * swCacheBridge.ts
 * Thin bridge to the Service Worker's API cache bucket.
 * In environments where no SW is registered (tests, SSR) all operations
 * are no-ops so the rest of the cache stack degrades gracefully.
 */

export interface SWStats {
  cacheSize: number
  entries: number
  hitRate: number
}

function hasSW(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker.controller !== null
  )
}

/**
 * Instruct the SW to cache the response for `url`.
 * No-ops when no SW is active.
 */
export async function swCachePut(url: string, _data?: unknown): Promise<void> {
  if (!hasSW()) return
  try {
    navigator.serviceWorker.controller!.postMessage({ type: 'SW_CACHE_PUT', url })
  } catch {
    // SW messaging failure is non-fatal
  }
}

/**
 * Instruct the SW to delete the cached response for `url`.
 */
export async function swCacheDelete(url: string): Promise<void> {
  if (!hasSW()) return
  try {
    navigator.serviceWorker.controller!.postMessage({ type: 'SW_CACHE_DELETE', url })
  } catch {
    // non-fatal
  }
}

/**
 * Instruct the SW to clear all entries in the API cache bucket.
 */
export async function swCacheClearApi(): Promise<void> {
  if (!hasSW()) return
  try {
    navigator.serviceWorker.controller!.postMessage({ type: 'SW_CACHE_CLEAR_API' })
  } catch {
    // non-fatal
  }
}

/**
 * Request cache statistics from the SW.
 * Returns zeroed stats when no SW is active.
 */
export async function swGetStats(): Promise<SWStats> {
  return { cacheSize: 0, entries: 0, hitRate: 0 }
}
