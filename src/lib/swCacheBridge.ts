type MessageHandler = (payload?: unknown) => void;

export interface SWStats {
  entries: number;
  bytes: number;
  lastUpdated: number | null;
}

const handlers = new Map<string, MessageHandler[]>();
const swCache = new Map<string, { value: unknown; expiresAt: number }>();

export function onSWMessage(type: string, handler: MessageHandler): void {
  const list = handlers.get(type) ?? [];
  handlers.set(type, [...list, handler]);
}

export function swWarmUrls(urls: string[]): void {
  if (typeof window === 'undefined') return;
  urls.forEach((url) => {
    try {
      void fetch(url, { method: 'GET', cache: 'force-cache' }).catch(() => undefined);
    } catch {
      // Ignore warmup errors in browser builds.
    }
  });
}

export function emitSWMessage(type: string, payload?: unknown): void {
  const listeners = handlers.get(type) ?? [];
  listeners.forEach((handler) => {
    try {
      handler(payload);
    } catch {
      // Ignore handler errors.
    }
  });
}

export function swCachePut(url: string, value: unknown, ttlMs?: number): void {
  const expiresAt = Date.now() + (ttlMs ?? 60_000);
  swCache.set(url, { value, expiresAt });
}

export function swCacheDelete(url: string): void {
  swCache.delete(url);
}

export function swCacheClearApi(): void {
  for (const [url, entry] of swCache.entries()) {
    if (entry.expiresAt <= Date.now()) {
      swCache.delete(url);
    }
  }
}

export async function swGetStats(timeoutMs = 500): Promise<SWStats> {
  await Promise.resolve();
  const now = Date.now();
  const entries = Array.from(swCache.values()).filter((entry) => entry.expiresAt > now).length;
  return {
    entries,
    bytes: entries * 1024,
    lastUpdated: entries > 0 ? now : null,
  };
}
