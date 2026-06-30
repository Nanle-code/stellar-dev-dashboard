import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the IndexedDB-backed storage layer so tests don't need a real IDB.
// All persistence calls become no-ops; the in-memory L1 is exercised directly.
vi.mock('../../../src/lib/storage.js', () => {
  const memory = new Map<string, { value: unknown; expiresAt: number; tag?: string }>()
  return {
    getStoredValue: vi.fn(async (key: string) => memory.get(key) ?? null),
    setStoredValue: vi.fn(async (key: string, value: unknown) => {
      memory.set(key, value as never)
    }),
    removeStoredValue: vi.fn(async (key: string) => {
      memory.delete(key)
    }),
    clearStorage: vi.fn(async () => memory.clear()),
    getCachedApiResponse: vi.fn(async (key: string) => {
      const rec = memory.get(key)
      if (!rec) return null
      if (Date.now() > rec.expiresAt) return null
      return rec.value
    }),
    setCachedApiResponse: vi.fn(async (key: string, value: unknown, ttl: number, tag = '') => {
      memory.set(key, { value, expiresAt: Date.now() + ttl, tag })
    }),
    deleteCachedApiResponse: vi.fn(async (key: string) => {
      memory.delete(key)
    }),
    invalidateCacheByTag: vi.fn(async (tag: string) => {
      for (const [k, v] of memory) if (v.tag === tag) memory.delete(k)
    }),
    pruneExpiredApiCache: vi.fn(async () => {
      for (const [k, v] of memory) if (Date.now() > v.expiresAt) memory.delete(k)
    }),
    storageStats: vi.fn(async () => ({ appState: 0, apiCache: memory.size, offlineQueue: 0 })),
  }
})

import { CacheManager, getCombinedCacheStats } from '../../../src/lib/cacheManager'

describe('CacheManager', () => {
  let manager: CacheManager

  beforeEach(() => {
    manager = new CacheManager({ namespace: 'default', maxSize: 10, defaultTTL: 60_000, persist: false })
  })

  it('stores and retrieves values from L1', async () => {
    await manager.set('alpha', { a: 1 })
    expect(manager.get('alpha')).toEqual({ a: 1 })
  })

  it('returns null for unknown keys', () => {
    expect(manager.get('does-not-exist')).toBeNull()
  })

  it('honors TTL by treating expired entries as misses', async () => {
    await manager.set('short', 'ephemeral', 5)
    await new Promise((r) => setTimeout(r, 20))
    expect(manager.get('short')).toBeNull()
  })

  it('deletes individual keys', async () => {
    await manager.set('to-delete', 1)
    expect(manager.has('to-delete')).toBe(true)
    await manager.delete('to-delete')
    expect(manager.has('to-delete')).toBe(false)
  })

  it('invalidates by tag', async () => {
    await manager.set('a', 1, 60_000, ['accounts'])
    await manager.set('b', 2, 60_000, ['accounts'])
    await manager.set('c', 3, 60_000, ['ledgers'])
    await manager.invalidateTag('accounts')
    expect(manager.get('a')).toBeNull()
    expect(manager.get('b')).toBeNull()
    expect(manager.get('c')).toBe(3)
  })

  it('invalidates by prefix', async () => {
    await manager.set('account:1', 1)
    await manager.set('account:2', 2)
    await manager.set('ledger:5', 'L5')
    manager.invalidatePrefix('account:')
    expect(manager.get('account:1')).toBeNull()
    expect(manager.get('account:2')).toBeNull()
    expect(manager.get('ledger:5')).toBe('L5')
  })

  it('reports stats with hit rate', async () => {
    await manager.set('hit', 1)
    manager.get('hit')
    manager.get('hit')
    manager.get('miss')

    const stats = manager.getStats()
    expect(stats.hits).toBeGreaterThanOrEqual(2)
    expect(stats.misses).toBeGreaterThanOrEqual(1)
    expect(stats.hitRate).toMatch(/%$/)
    expect(stats.namespace).toBe('default')
  })

  it('builds deterministic cache keys', () => {
    expect(CacheManager.key('account', { id: 'A', net: 'testnet' })).toBe(
      'account:{"id":"A","net":"testnet"}',
    )
  })

  it('runs SWR fetcher exactly once on cold miss', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 })
    const a = await manager.swr('cold', fetcher)
    const b = await manager.swr('cold', fetcher)
    expect(a).toEqual({ id: 1 })
    expect(b).toEqual({ id: 1 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('SWR force=true bypasses cache and refetches', async () => {
    let count = 0
    const fetcher = vi.fn(async () => ++count)
    await manager.swr('forced', fetcher)
    const second = await manager.swr('forced', fetcher, { force: true })
    expect(second).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('subscribers fire on set and stop after unsubscribe', async () => {
    const cb = vi.fn()
    const unsub = manager.subscribe<number>('watched', cb)
    await manager.set('watched', 1)
    await manager.set('watched', 2)
    unsub()
    await manager.set('watched', 3)
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenLastCalledWith(2)
  })

  it('clear empties the cache and resets counters', async () => {
    await manager.set('x', 1)
    manager.get('x')
    manager.clear()
    expect(manager.get('x')).toBeNull()
    const stats = manager.getStats()
    expect(stats.size).toBe(0)
  })
})

describe('getCombinedCacheStats', () => {
  it('returns one snapshot row per shared manager + storage counts', async () => {
    const result = await getCombinedCacheStats()
    expect(Array.isArray(result.managers)).toBe(true)
    expect(result.managers.length).toBeGreaterThanOrEqual(3)
    for (const m of result.managers) {
      expect(m).toHaveProperty('namespace')
      expect(m).toHaveProperty('hitRate')
    }
    expect(result.storage).toHaveProperty('apiCache')
  })
})
