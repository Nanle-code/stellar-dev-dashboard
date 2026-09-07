/**
 * Unit tests for IndexedDB schema versioning and migrations
 * #749 Version IndexedDB schemas and test migrations
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  getStoredValue,
  setStoredValue,
  removeStoredValue,
  clearStorage,
  getSchemaVersion,
  setSchemaVersion,
  storageStats,
  DB_NAME,
  DB_VERSION,
  CURRENT_SCHEMA_VERSION,
  STORES,
} from '../storage'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function createMockIDB() {
  const stores = new Map()
  const db = {
    objectStoreNames: {
      contains: (name) => stores.has(name),
    },
    createObjectStore: (name, opts = {}) => {
      const store = {
        keyPath: opts.keyPath || null,
        autoIncrement: opts.autoIncrement || false,
        indexes: new Map(),
        data: new Map(),
        createIndex: (idxName, keyPath, unique) => {
          store.indexes.set(idxName, { keyPath, unique })
        },
        get: (key) => ({ result: store.data.get(key), onsuccess: null, onerror: null }),
        put: (value) => {
          const key = value[store.keyPath] ?? value.key
          store.data.set(key, value)
          return { result: undefined, onsuccess: null, onerror: null }
        },
        delete: (key) => {
          store.data.delete(key)
          return { result: undefined, onsuccess: null, onerror: null }
        },
        clear: () => {
          store.data.clear()
          return { result: undefined, onsuccess: null, onerror: null }
        },
        getAll: () => ({ result: Array.from(store.data.values()), onsuccess: null, onerror: null }),
        count: () => ({ result: store.data.size, onsuccess: null, onerror: null }),
        index: (name) => ({
          openCursor: () => ({ result: null, onsuccess: null, onerror: null }),
        }),
        transaction: () => ({
          objectStore: (name) => stores.get(name),
          oncomplete: null,
          onerror: null,
        }),
      }
      stores.set(name, store)
      return store
    },
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

beforeEach(() => {
  mockIDB = createMockIDB()
  openDBRequest = {
    result: null,
    onsuccess: null,
    onerror: null,
    onblocked: null,
    onupgradeneeded: null,
  }

  const originalOpenDB = (globalThis as any).indexedDB?.open
    ? (globalThis as any).indexedDB.open.bind((globalThis as any).indexedDB)
    : null

  ;(globalThis as any).indexedDB = {
    open: (name, version) => {
      const req = {
        result: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
        onupgradeneeded: null,
        oldVersion: 0,
        transaction: () => mockIDB.db.transaction(),
      }
      openDBRequest = req
      return req
    },
  }
})

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('storage schema versioning', () => {
  it('exposes the current schema version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(5)
  })

  it('creates the meta store on open', async () => {
    const { setStoredValue: _set, getStoredValue: _get, ...rest } = await import('../storage')
    await setStoredValue('theme', 'dark')
    expect(mockIDB.stores.has(STORES.APP_STATE)).toBe(true)
    expect(mockIDB.stores.has(STORES.META)).toBe(true)
  })

  it('migrates from schema version 4 to 5', async () => {
    // Simulate an old DB by pre-populating without meta store
    const appStore = mockIDB.db.createObjectStore(STORES.APP_STATE)
    appStore.put({ key: 'legacy', value: 'data' })

    // Trigger upgrade by dispatching onupgradeneeded
    openDBRequest.oldVersion = 4
    openDBRequest.onupgradeneeded({ target: { result: mockIDB.db }, oldVersion: 4 })

    // Check meta store was created and version set
    const metaStore = mockIDB.stores.get(STORES.META)
    const versionRecord = metaStore.data.get('schemaVersion')
    expect(versionRecord).toBeDefined()
    expect(versionRecord.value).toBe(5)
  })

  it('returns current schema version when no version is stored', async () => {
    const version = await getSchemaVersion()
    expect(version).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('persists and retrieves schema version', async () => {
    await setSchemaVersion(5)
    const version = await getSchemaVersion()
    expect(version).toBe(5)
  })

  it('handles invalid schema version input gracefully', async () => {
    await expect(setSchemaVersion(NaN)).resolves.toBeUndefined()
    await expect(setSchemaVersion(-1)).resolves.toBeUndefined()
    const version = await getSchemaVersion()
    expect(Number.isFinite(version)).toBe(true)
  })

  it('handles unsupported environment (no indexedDB)', async () => {
    const originalIDB = (globalThis as any).indexedDB
    ;(globalThis as any).indexedDB = undefined

    const version = await getSchemaVersion()
    expect(version).toBe(CURRENT_SCHEMA_VERSION)

    ;(globalThis as any).indexedDB = originalIDB
  })
})

describe('storage error handling and fallback', () => {
  it('falls back to localStorage when IndexedDB fails', async () => {
    const store = new Map()
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
    const stats = await storageStats()
    expect(stats).toHaveProperty('appState')
    expect(stats).toHaveProperty('apiCache')
    expect(stats).toHaveProperty('offlineQueue')
    expect(typeof stats.appState).toBe('number')
  })

  it('returns zeros on failure', async () => {
    const originalIDB = (globalThis as any).indexedDB
    ;(globalThis as any).indexedDB = undefined

    const stats = await storageStats()
    expect(stats).toEqual({ appState: 0, apiCache: 0, offlineQueue: 0 })

    ;(globalThis as any).indexedDB = originalIDB
  })
})
