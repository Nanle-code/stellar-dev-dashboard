type SWMessageHandler = (data: any) => void

type SWStats = {
  hits: number
  misses: number
  entries: number
  bytes: number
}

const listeners: Map<string, SWMessageHandler[]> = new Map()

export function onSWMessage(type: string, handler: SWMessageHandler): void {
  if (!('serviceWorker' in navigator)) return

  const handlers = listeners.get(type) ?? []
  handlers.push(handler)
  listeners.set(type, handlers)

  navigator.serviceWorker.addEventListener('message', (event) => {
    const message = event.data
    if (!message || message.type !== type) return
    handlers.forEach((cb) => cb(message.payload))
  })
}

function postToSW(message: any): void {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return
  navigator.serviceWorker.controller.postMessage(message)
}

export function swWarmUrls(urls: string[]): void {
  postToSW({ type: 'SWARM_URLS', payload: { urls } })
}

export function swCachePut(url: string, value: unknown, ttl: number): void {
  postToSW({ type: 'SW_CACHE_PUT', payload: { url, value, ttl } })
}

export function swCacheDelete(url: string): void {
  postToSW({ type: 'SW_CACHE_DELETE', payload: { url } })
}

export function swCacheClearApi(): void {
  postToSW({ type: 'SW_CACHE_CLEAR_API' })
}

export async function swGetStats(timeout = 500): Promise<SWStats | null> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return null
  return new Promise<SWStats | null>((resolve) => {
    const id = `sw-stats-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const listener = (payload: any) => {
      if (payload?.id !== id) return
      resolve(payload.stats ?? null)
    }

    const handler = (event: any) => listener(event)
    navigator.serviceWorker.addEventListener('message', handler)
    navigator.serviceWorker.controller.postMessage({ type: 'SW_GET_STATS', payload: { id } })

    setTimeout(() => {
      navigator.serviceWorker.removeEventListener('message', handler)
      resolve(null)
    }, timeout)
  })
}

export type { SWStats }
