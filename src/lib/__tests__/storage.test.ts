/**
 * Unit tests for IndexedDB schema versioning and migrations
 * #749 Version IndexedDB schemas and test migrations
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'

function createMockIDB() {
  const stores = new Map()

  function createStore(name, opts = {}) {
    const data = new Map()
    const store = {
      keyPath: opts.keyPath || null,
      autoIncrement: opts.autoIncrement || false,
      indexes: new Map(),
      data,
      createIndex: (idxName, keyPath, unique) => {
        store.indexes.set(idxName, { keyPath, unique })
      },
      get: (key) => {
        const req = { result: data.get(key) ?? undefined, onsuccess: null, onerror: null }
        queueMicrotask(() => { if (req.onsuccess) req.onsuccess() })
        return req
      },
      put: (value, key) => {
        const k = key !== undefined ? key : (opts.keyPath ? value[opts.keyPath] : value.key)
        data.set(k, value)
        const req = { result: k, onsuccess: null, onerror: null }
        queueMicrotask(() => { if (req.onsuccess) req.onsuccess() })
        return req
      },
      add: (value) => {
        const k = opts.autoIncrement ? data.size + 1 : (opts.keyPath ? value[opts.keyPath] : value.id)
        data.set(k, value)
        const req = { result: k, onsuccess: null, onerror: null }
        queueMicrotask(() => { if (req.onsuccess) req.onsuccess() })
        return req
      },
      delete: (key) => {
        data.delete(key)
        const req = { result: undefined, onsuccess: null, onerror: null }
        queueMicrotask(() => { if (req.onsuccess) req.onsuccess() })
        return req
      },
      clear: () => {
        data.clear()
        const req = { result: undefined, onsuccess: null, onerror: null }
        queueMicrotask(() => { if (req.onsuccess) req.onsuccess() })
        return req
      },
      getAll: () => {
        const req = { result: Array.from(data.values()), onsuccess: null, onerror: null }
        queueMicrotask(() => { if (req.onsuccess) req.onsuccess() })
        return req
      },
      count: () => {
        const req = { result: data.size, onsuccess: null, onerror: null }
        queueMicrotask(() => { if (req.onsuccess) req.onsuccess() })
        return req
      },
      index: () => ({
        openCursor: () => {
          const req = { result: null, onsuccess: null, onerror: null }
          queueMicrotask(() => { if (req.onsuccess) req.onsuccess() })
          return req
        },
      }),
    }
    stores.set(name, store)
    return store
  }

  const db = {
    objectStoreNames: {
      contains: (name) => stores.has(name),
    },
    createObjectStore: (name, opts) => createStore(name, opts),
    transaction: (storeName, mode) => {
      const store = stores.get(storeName)
      return {
        objectStore: () => store,
        oncomplete: null,
        onerror: null,
      }
    },
    close: () => {},
    onversionchange: null,
  }
  return { db, stores }
}

let mockIDB = null
let openDBRequest = null

beforeEach(async () => {
  vi.resetModules()
  mockIDB = createMockIDB()

  ;(globalThis as any).indexedDB = {
    open: (name, version) => {
      const req = {
        result: mockIDB.db,
        onsuccess: null,
        onerror: null,
        onblocked: null,
        onupgradeneeded: null,
      }
      openDBRequest = req
      queueMicrotask(() => {
        if (req.onupgradeneeded) {
          req.onupgradeneeded({ target: { result: mockIDB.db }, oldVersion: 0 })
        }
        if (req.onsuccess) {
          req.onsuccess()
        }
      })
      return req
    },
  }
})

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('storage schema versioning', () => {
  it('exposes the current schema version', async () => {
    const { CURRENT_SCHEMA_VERSION } = await import('../storage')
    expect(CURRENT_SCHEMA_VERSION).toBe(5)
  })

  it('creates the meta store on open', async () => {
    const { setStoredValue, STORES } = await import('../storage')
    await setStoredValue('theme', 'dark')
    expect(mockIDB.stores.has(STORES.APP_STATE)).toBe(true)
    expect(mockIDB.stores.has(STORES.META)).toBe(true)
  })

  it('migrates from schema version 4 to 5', async () => {
    const { STORES } = await import('../storage')
    const appStore = mockIDB.db.createObjectStore(STORES.APP_STATE)
    appStore.put({ key: 'legacy', value: 'data' })

    openDBRequest.oldVersion = 4
    openDBRequest.onupgradeneeded({ target: { result: mockIDB.db }, oldVersion: 4 })

    const metaStore = mockIDB.stores.get(STORES.META)
    const versionRecord = metaStore.data.get('schemaVersion')
    expect(versionRecord).toBeDefined()
    expect(versionRecord.value).toBe(5)
  })

  it('returns current schema version when no version is stored', async () => {
    const { getSchemaVersion, CURRENT_SCHEMA_VERSION } = await import('../storage')
    const version = await getSchemaVersion()
    expect(version).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('persists and retrieves schema version', async () => {
    const { setSchemaVersion, getSchemaVersion } = await import('../storage')
    await setSchemaVersion(5)
    const version = await getSchemaVersion()
    expect(version).toBe(5)
  })

  it('handles invalid schema version input gracefully', async () => {
    const { setSchemaVersion, getSchemaVersion } = await import('../storage')
    await expect(setSchemaVersion(NaN)).resolves.toBeUndefined()
    await expect(setSchemaVersion(-1)).resolves.toBeUndefined()
    const version = await getSchemaVersion()
    expect(Number.isFinite(version)).toBe(true)
  })

  it('handles unsupported environment (no indexedDB)', async () => {
    const { getSchemaVersion, CURRENT_SCHEMA_VERSION } = await import('../storage')
    const originalIDB = (globalThis as any).indexedDB
    ;(globalThis as any).indexedDB = undefined

    const version = await getSchemaVersion()
    expect(version).toBe(CURRENT_SCHEMA_VERSION)

    ;(globalThis as any).indexedDB = originalIDB
  })
})

describe('storage error handling and fallback', () => {
  it('falls back to localStorage when IndexedDB fails', async () => {
    const { setStoredValue, getStoredValue } = await import('../storage')
    const originalIDB = (globalThis as any).indexedDB
    ;(globalThis as any).indexedDB = {
      open: () => {
        const req = { result: null, onsuccess: null, onerror: null, onblocked: null }
        setTimeout(() => req.onerror?.({ error: new Error('IDB failed') }), 0)
        return req
      },
    }

    await setStoredValue('test-key', 'test-value')
    expect(localStorage.getItem('idb:test-key')).toBe('"test-value"')

    const value = await getStoredValue('test-key')
    expect(value).toBe('test-value')

    ;(globalThis as any).indexedDB = originalIDB
  })

  it('handles blocked state gracefully', async () => {
    const { getStoredValue } = await import('../storage')
    const originalIDB = (globalThis as any).indexedDB
    ;(globalThis as any).indexedDB = {
      open: () => {
        const req = { result: null, onsuccess: null, onerror: null, onblocked: null }
        setTimeout(() => req.onblocked?.(new Error('IndexedDB blocked')), 0)
        return req
      },
    }

    await expect(getStoredValue('any-key')).resolves.toBeNull()

    ;(globalThis as any).indexedDB = originalIDB
  })
})

describe('storageStats', () => {
  it('returns counts for each store', async () => {
    const { storageStats } = await import('../storage')
    const stats = await storageStats()
    expect(stats).toHaveProperty('appState')
    expect(stats).toHaveProperty('apiCache')
    expect(stats).toHaveProperty('offlineQueue')
    expect(typeof stats.appState).toBe('number')
  })

  it('returns zeros on failure', async () => {
    const { storageStats } = await import('../storage')
    const originalIDB = (globalThis as any).indexedDB
    ;(globalThis as any).indexedDB = undefined

    const stats = await storageStats()
    expect(stats).toEqual({ appState: 0, apiCache: 0, offlineQueue: 0 })

    ;(globalThis as any).indexedDB = originalIDB
  })
})
