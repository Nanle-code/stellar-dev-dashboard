import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Exercise the REAL implementation (no module mock) so we validate the
// deterministic cross-tab resolution end to end.
import {
  syncState,
  onStateChange,
  resolveStateConflict,
  loadSyncedState,
  getTabId,
} from '../../../src/utils/stateSync'

// ─── In-memory localStorage ────────────────────────────────────────────────────
function createStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v))
    },
    removeItem: (k) => {
      map.delete(k)
    },
    clear: () => map.clear(),
    _map: map,
  }
}

let originalDescriptor
let storage

function installStorage(s) {
  storage = s
  originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  })
}

function restoreStorage() {
  if (originalDescriptor) {
    Object.defineProperty(window, 'localStorage', originalDescriptor)
  } else {
    delete window.localStorage
  }
}

beforeEach(() => {
  installStorage(createStorage())
})
afterEach(() => {
  restoreStorage()
  vi.restoreAllMocks()
})

const ENV = (v, value, t = 0, w = '') =>
  JSON.stringify({ __v: v, __t: t, __w: w, value })

// ─── Primary flow ──────────────────────────────────────────────────────────────
describe('syncState — primary flow', () => {
  it('wraps the value in a version envelope and returns an increasing version', async () => {
    const v1 = await syncState('k', { theme: 'dark' })
    expect(v1).toBe(1)
    const v2 = await syncState('k', { theme: 'light' })
    expect(v2).toBe(2)

    // Raw stored entry is an envelope carrying the version + metadata.
    const raw = JSON.parse(storage.getItem('k'))
    expect(raw.__v).toBe(2)
    expect(raw.value).toEqual({ theme: 'light' })
    expect(typeof raw.__t).toBe('number')
    expect(typeof raw.__w).toBe('string')

    const loaded = loadSyncedState('k')
    expect(loaded.value).toEqual({ theme: 'light' })
    expect(loaded.version).toBe(2)
    expect(typeof loaded.writerId).toBe('string')
    expect(typeof loaded.timestamp).toBe('number')
  })

  it('notifies cross-tab listeners with value + version metadata', async () => {
    const received = []
    const unsub = onStateChange((key, value, meta) => received.push({ key, value, meta }))
    await syncState('settings', { network: 'mainnet' })

    // Simulate the `storage` event another tab would receive.
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'settings', newValue: ENV(1, { network: 'mainnet' }) })
    )

    expect(received).toHaveLength(1)
    expect(received[0].key).toBe('settings')
    expect(received[0].value).toEqual({ network: 'mainnet' })
    expect(received[0].meta).toEqual({ version: 1, writerId: expect.any(String), timestamp: expect.any(Number) })
    unsub()
  })

  it('rebases onto an externally-written newer version instead of clobbering it', async () => {
    // Another tab already wrote version 5.
    storage.setItem('k', ENV(5, { a: 1 }))
    const version = await syncState('k', { a: 2 })
    expect(version).toBe(6)
    const loaded = loadSyncedState('k')
    expect(loaded.value).toEqual({ a: 2 })
    expect(loaded.version).toBe(6)
  })
})

// ─── Boundary cases ──────────────────────────────────────────────────────────
describe('resolveStateConflict — boundary cases', () => {
  it('returns the higher-version record regardless of argument order', () => {
    const a = resolveStateConflict('local', { version: 1 }, 'incoming', { version: 3 })
    const b = resolveStateConflict('incoming', { version: 3 }, 'local', { version: 1 })
    expect(a).toBe('incoming')
    expect(b).toBe('incoming')
  })

  it('breaks a version tie using the higher timestamp', () => {
    const winner = resolveStateConflict(
      'local',
      { version: 1, timestamp: 100, writerId: 'x' },
      'incoming',
      { version: 1, timestamp: 200, writerId: 'y' }
    )
    expect(winner).toBe('incoming')
  })

  it('breaks a version+timestamp tie using lexicographic writerId', () => {
    const winner = resolveStateConflict(
      'local',
      { version: 1, timestamp: 100, writerId: 'aaa' },
      'incoming',
      { version: 1, timestamp: 100, writerId: 'zzz' }
    )
    expect(winner).toBe('incoming')
  })

  it('returns local when every ranking field is identical (stable)', () => {
    const meta = { version: 1, timestamp: 100, writerId: 'same' }
    expect(resolveStateConflict('local', meta, 'incoming', meta)).toBe('local')
  })

  it('treats legacy (no-meta) values as version 0 deterministically', () => {
    // No meta → both version 0 → local wins, independent of order.
    expect(resolveStateConflict('local')).toBe('local')
    expect(resolveStateConflict('incoming', undefined, 'local')).toBe('local')
  })

  it('never throws on null/undefined inputs', () => {
    expect(() => resolveStateConflict(null, null, undefined, undefined)).not.toThrow()
    expect(resolveStateConflict(undefined, undefined, 'x', { version: 1 })).toBe('x')
  })
})

// ─── Failure paths ─────────────────────────────────────────────────────────────
describe('syncState — failure paths', () => {
  it('rejects an empty/invalid key with a TypeError', async () => {
    await expect(syncState('', { a: 1 })).rejects.toBeInstanceOf(TypeError)
    await expect(syncState(null, { a: 1 })).rejects.toBeInstanceOf(TypeError)
  })

  it('rejects an undefined value with a TypeError', async () => {
    await expect(syncState('k', undefined)).rejects.toBeInstanceOf(TypeError)
  })

  it('rejects when localStorage is unavailable', async () => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: undefined })
    await expect(syncState('k', { a: 1 })).rejects.toThrow(/localStorage is unavailable/)
  })

  it('rejects when the write throws (e.g. quota exceeded)', async () => {
    storage.setItem = () => {
      const err = new Error('QuotaExceededError')
      err.name = 'QuotaExceededError'
      throw err
    }
    await expect(syncState('k', { a: 1 })).rejects.toThrow(/failed to persist/)
  })

  it('onStateChange throws if callback is not a function', () => {
    expect(() => onStateChange(null)).toThrow(TypeError)
  })
})

// ─── Compare-and-swap retry (concurrent write) ─────────────────────────────────
describe('syncState — concurrent write handling', () => {
  it('retries and commits when another tab advances the version mid-write', async () => {
    // Injects a competing write (version 1) on the inner read of the first
    // attempt, simulating another tab committing between our outer and inner
    // read — forcing the optimistic CAS to rebase and retry.
    class CompetingStorage {
      constructor() {
        this.data = {}
        this.reads = 0
        this.bump = true
      }
      getItem(k) {
        const raw = k in this.data ? this.data[k] : null
        this.reads++
        if (this.bump && this.reads === 2) {
          const newer = JSON.stringify({ __v: 1, __t: 1, __w: 'other', value: { a: 99 } })
          this.data[k] = newer
          this.bump = false
          return newer
        }
        return raw
      }
      setItem(k, v) {
        this.data[k] = v
      }
      removeItem(k) {
        delete this.data[k]
      }
      clear() {
        this.data = {}
      }
    }
    installStorage(new CompetingStorage())
    const version = await syncState('k', { a: 1 })
    expect(version).toBe(2)
    expect(loadSyncedState('k').value).toEqual({ a: 1 })
  })
})

// ─── getTabId ───────────────────────────────────────────────────────────────────
describe('getTabId', () => {
  it('returns a stable, non-empty id for the lifetime of the tab', () => {
    const id1 = getTabId()
    const id2 = getTabId()
    expect(id1).toBeTruthy()
    expect(id1).toBe(id2)
  })
})
