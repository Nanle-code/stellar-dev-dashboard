import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * These tests exercise storage.js's quota-recovery integration: a write that
 * fails with a quota error should trigger eviction of safe API cache entries
 * and one retry, and should notify subscribers either way.
 *
 * jsdom doesn't ship a real IndexedDB implementation, so we install a small
 * fake `global.indexedDB` — just enough of the API surface storage.js uses
 * (open/transaction/objectStore/put/get/getAll/delete) — and control exactly
 * when a `put()` call fails with a quota error via `armQuotaFailures()`.
 */

function makeRequest() {
  return { result: undefined, error: undefined, onsuccess: null, onerror: null };
}

function resolveRequest(req, result) {
  req.result = result;
  queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
}

function rejectRequest(req, error) {
  req.error = error;
  queueMicrotask(() => req.onerror && req.onerror({ target: req }));
}

function quotaError() {
  return new DOMException('The quota has been exceeded.', 'QuotaExceededError');
}

class FakeStore {
  constructor(name, opts = {}) {
    this.name = name;
    this.keyPath = opts.keyPath;
    this.data = new Map();
    this._failPutTimes = 0;
  }

  armQuotaFailures(times) {
    this._failPutTimes = times;
  }

  createIndex() { /* not needed for the write paths under test */ }

  put(value, key) {
    const req = makeRequest();
    const resolvedKey = this.keyPath ? value[this.keyPath] : key;
    if (this._failPutTimes > 0) {
      this._failPutTimes -= 1;
      rejectRequest(req, quotaError());
      return req;
    }
    this.data.set(resolvedKey, value);
    resolveRequest(req, resolvedKey);
    return req;
  }

  get(key) {
    const req = makeRequest();
    resolveRequest(req, this.data.get(key));
    return req;
  }

  getAll() {
    const req = makeRequest();
    resolveRequest(req, Array.from(this.data.values()));
    return req;
  }

  delete(key) {
    const req = makeRequest();
    this.data.delete(key);
    resolveRequest(req, undefined);
    return req;
  }

  clear() {
    const req = makeRequest();
    this.data.clear();
    resolveRequest(req, undefined);
    return req;
  }

  count() {
    const req = makeRequest();
    resolveRequest(req, this.data.size);
    return req;
  }
}

class FakeDB {
  constructor() {
    this._stores = new Map();
    this.onversionchange = null;
    this.objectStoreNames = { contains: (n) => this._stores.has(n) };
  }

  createObjectStore(name, opts) {
    const store = new FakeStore(name, opts);
    this._stores.set(name, store);
    return store;
  }

  transaction() {
    const db = this;
    return { objectStore: (n) => db._stores.get(n) };
  }

  close() {}
}

function installFakeIndexedDB() {
  const db = new FakeDB();
  global.indexedDB = {
    open() {
      const req = { onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null, result: db };
      queueMicrotask(() => {
        req.onupgradeneeded && req.onupgradeneeded({ target: { result: db } });
        req.onsuccess && req.onsuccess({ target: req });
      });
      return req;
    },
  };
  return db;
}

describe('storage.js quota recovery', () => {
  let db;
  let localStorageStore;

  beforeEach(async () => {
    vi.resetModules();
    db = installFakeIndexedDB();

    localStorageStore = new Map();
    global.localStorage = {
      getItem: (k) => (localStorageStore.has(k) ? localStorageStore.get(k) : null),
      setItem: (k, v) => localStorageStore.set(k, String(v)),
      removeItem: (k) => localStorageStore.delete(k),
      clear: () => localStorageStore.clear(),
    };
  });

  afterEach(() => {
    delete global.indexedDB;
    vi.restoreAllMocks();
  });

  it('evicts safe cache entries and retries once after a quota error (primary flow)', async () => {
    const storage = await import('../../../src/lib/storage.js');
    const { onQuotaExceeded } = await import('../../../src/lib/storageQuota.js');

    // Seed some evictable API cache entries so eviction has something to remove.
    await storage.setCachedApiResponse('old-1', { a: 1 }, 60_000, 'accounts');
    await storage.setCachedApiResponse('old-2', { a: 2 }, 60_000, 'accounts');

    const events = [];
    onQuotaExceeded((e) => events.push(e));

    // Fail the first write to app-state with a quota error, succeed on retry.
    db._stores.get('app-state').armQuotaFailures(1);

    await storage.setStoredValue('theme', 'dark');

    expect(await storage.getStoredValue('theme')).toBe('dark');
    expect(events).toEqual([
      expect.objectContaining({ store: 'app-state', key: 'theme', recovered: true }),
    ]);
  });

  it('falls back to localStorage when eviction cannot free enough space (boundary case)', async () => {
    const storage = await import('../../../src/lib/storage.js');
    const { onQuotaExceeded } = await import('../../../src/lib/storageQuota.js');

    // Force the DB (and its stores) into existence before arming failures.
    await storage.getStoredValue('__warm__');

    // No API cache entries exist to evict, and every app-state write keeps failing.
    const appState = db._stores.get('app-state');
    appState.armQuotaFailures(Infinity);

    const events = [];
    onQuotaExceeded((e) => events.push(e));

    await storage.setStoredValue('theme', 'dark');

    expect(events).toEqual([
      expect.objectContaining({ store: 'app-state', key: 'theme', recovered: false }),
    ]);
    // The value still landed via the localStorage fallback.
    expect(JSON.parse(global.localStorage.getItem('idb:theme'))).toBe('dark');
  });

  it('notifies with recovered:false and does not throw when every layer is out of quota (failure case)', async () => {
    const storage = await import('../../../src/lib/storage.js');
    const { onQuotaExceeded } = await import('../../../src/lib/storageQuota.js');

    // Force the DB (and its stores) into existence before arming failures.
    await storage.getStoredValue('__warm__');

    db._stores.get('app-state').armQuotaFailures(Infinity);
    global.localStorage.setItem = () => { throw new DOMException('quota exceeded', 'QuotaExceededError'); };

    const events = [];
    onQuotaExceeded((e) => events.push(e));

    await expect(storage.setStoredValue('theme', 'dark')).resolves.toBeUndefined();

    // One event for the failed IDB retry, one for the failed localStorage fallback.
    expect(events).toEqual([
      expect.objectContaining({ store: 'app-state', key: 'theme', recovered: false }),
      expect.objectContaining({ store: 'app-state', key: 'theme', recovered: false, fallback: 'localStorage' }),
    ]);
  });

  it('leaves invalid/unsupported-environment writes as silent no-ops, matching prior behavior', async () => {
    delete global.indexedDB;
    global.localStorage.setItem = () => { throw new Error('private mode'); };

    const storage = await import('../../../src/lib/storage.js');

    await expect(storage.setStoredValue('theme', 'dark')).resolves.toBeUndefined();
    expect(await storage.getStoredValue('theme')).toBeNull();
  });
});
