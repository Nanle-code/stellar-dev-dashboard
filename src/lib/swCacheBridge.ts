/** swCacheBridge — stub (service worker cache bridge not available in this environment) */

export interface SWStats {
  cacheSize: number
  entryCount: number
}

export const swCacheBridge = {
  init: (): void => { /* no-op */ },
}

export async function swCachePut(_key: string, _value: unknown): Promise<void> { /* no-op */ }
export async function swCacheDelete(_key: string): Promise<void> { /* no-op */ }
export async function swCacheClearApi(): Promise<void> { /* no-op */ }
export async function swGetStats(): Promise<SWStats> {
  return { cacheSize: 0, entryCount: 0 }
}
export async function swWarmUrls(_urls: string[]): Promise<void> { /* no-op */ }
export function onSWMessage(_handler: (msg: unknown) => void): () => void {
  return () => { /* no-op */ }
}
