/**
 * Persistent Storage Layer — IndexedDB with localStorage fallback
 *
 * Provides:
 *   - getStoredValue / setStoredValue / removeStoredValue / clearStorage
 *   - getCachedApiResponse / setCachedApiResponse  (TTL-aware API cache in IDB)
 *   - getOfflineQueue / enqueueOfflineOp / dequeueOfflineOp  (offline write queue)
 *   - storageStats  (size estimates)
 */

// ─── DB config ────────────────────────────────────────────────────────────────

const DB_NAME    = 'stellar-dev-dashboard';
const DB_VERSION = 3;

const STORES = {
  APP_STATE:  'app-state',    // Zustand persistence
  API_CACHE:  'api-cache',    // TTL-aware API response cache
  OFFLINE_Q:  'offline-queue', // Queued writes for when back online
  CONTRACT_HISTORY: 'contract-history', // Contract interactions
};

// ─── DB open ──────────────────────────────────────────────────────────────────

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.APP_STATE)) {
        db.createObjectStore(STORES.APP_STATE);
      }

      if (!db.objectStoreNames.contains(STORES.API_CACHE)) {
        const store = db.createObjectStore(STORES.API_CACHE, { keyPath: 'key' });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
        store.createIndex('tag',       'tag',       { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.OFFLINE_Q)) {
        db.createObjectStore(STORES.OFFLINE_Q, { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(STORES.CONTRACT_HISTORY)) {
        const store = db.createObjectStore(STORES.CONTRACT_HISTORY, { keyPath: 'id' });
        store.createIndex('contractId', 'contractId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };

    request.onsuccess = () => {
      _db = request.result;

      // Handle unexpected close (e.g. version bump from another tab)
      _db.onversionchange = () => {
        _db.close();
        _db = null;
      };

      resolve(_db);
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

// ─── Generic transaction helper ───────────────────────────────────────────────

async function tx(storeName, mode, fn) {
  const db       = await openDB();
  const trans    = db.transaction(storeName, mode);
  const store    = trans.objectStore(storeName);
  return new Promise((resolve, reject) => {
    const req = fn(store);
    if (req && typeof req.onsuccess !== 'undefined') {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    } else {
      trans.oncomplete = () => resolve();
      trans.onerror    = () => reject(trans.error);
    }
  });
}

// ─── App-state store (Zustand persistence) ───────────────────────────────────

export async function getStoredValue(key) {
  try {
    return await tx(STORES.APP_STATE, 'readonly', (s) => s.get(key)) ?? null;
  } catch {
    // Fallback to localStorage
    try {
      const raw = localStorage.getItem(`idb:${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}

export async function setStoredValue(key, value) {
  try {
    await tx(STORES.APP_STATE, 'readwrite', (s) => s.put(value, key));
  } catch {
    try { localStorage.setItem(`idb:${key}`, JSON.stringify(value)); } catch { /* ignore */ }
  }
}

export async function removeStoredValue(key) {
  try {
    await tx(STORES.APP_STATE, 'readwrite', (s) => s.delete(key));
  } catch {
    try { localStorage.removeItem(`idb:${key}`); } catch { /* ignore */ }
  }
}

export async function clearStorage() {
  try {
    await tx(STORES.APP_STATE, 'readwrite', (s) => s.clear());
  } catch { /* ignore */ }
}

// ─── API cache store ──────────────────────────────────────────────────────────

/**
 * Read a cached API response. Returns null if missing or expired.
 * @param {string} key
 * @returns {Promise<*|null>}
 */
export async function getCachedApiResponse(key) {
  try {
    const record = await tx(STORES.API_CACHE, 'readonly', (s) => s.get(key));
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      // Expired — delete lazily
      deleteCachedApiResponse(key).catch(() => {});
      return null;
    }
    return record.value;
  } catch { return null; }
}

/**
 * Write an API response to the persistent cache.
 * @param {string}   key
 * @param {*}        value
 * @param {number}   ttl      TTL in ms
 * @param {string}   [tag]    Optional tag for group invalidation
 */
export async function setCachedApiResponse(key, value, ttl, tag = '') {
  try {
    const record = { key, value, expiresAt: Date.now() + ttl, tag, cachedAt: Date.now() };
    await tx(STORES.API_CACHE, 'readwrite', (s) => s.put(record));
  } catch { /* ignore */ }
}

/**
 * Delete a single API cache entry.
 */
export async function deleteCachedApiResponse(key) {
  try {
    await tx(STORES.API_CACHE, 'readwrite', (s) => s.delete(key));
  } catch { /* ignore */ }
}

/**
 * Invalidate all API cache entries with a given tag.
 */
export async function invalidateCacheByTag(tag) {
  try {
    const db    = await openDB();
    const trans = db.transaction(STORES.API_CACHE, 'readwrite');
    const index = trans.objectStore(STORES.API_CACHE).index('tag');
    const req   = index.openCursor(IDBKeyRange.only(tag));

    await new Promise((resolve, reject) => {
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
        else resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch { /* ignore */ }
}

/**
 * Remove all expired API cache entries.
 */
export async function pruneExpiredApiCache() {
  try {
    const db    = await openDB();
    const trans = db.transaction(STORES.API_CACHE, 'readwrite');
    const index = trans.objectStore(STORES.API_CACHE).index('expiresAt');
    const range = IDBKeyRange.upperBound(Date.now());
    const req   = index.openCursor(range);

    await new Promise((resolve, reject) => {
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
        else resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch { /* ignore */ }
}

// ─── Offline write queue ──────────────────────────────────────────────────────

/**
 * Add an operation to the offline queue (e.g. a transaction to submit later).
 * @param {{ type: string, payload: * }} op
 */
export async function enqueueOfflineOp(op) {
  try {
    await tx(STORES.OFFLINE_Q, 'readwrite', (s) => s.add({ ...op, queuedAt: Date.now() }));
  } catch { /* ignore */ }
}

/**
 * Read all queued offline operations.
 * @returns {Promise<Array>}
 */
export async function getOfflineQueue() {
  try {
    return await tx(STORES.OFFLINE_Q, 'readonly', (s) => s.getAll()) ?? [];
  } catch { return []; }
}

/**
 * Remove a processed operation from the queue by its auto-increment id.
 * @param {number} id
 */
export async function dequeueOfflineOp(id) {
  try {
    await tx(STORES.OFFLINE_Q, 'readwrite', (s) => s.delete(id));
  } catch { /* ignore */ }
}

/**
 * Clear the entire offline queue.
 */
export async function clearOfflineQueue() {
  try {
    await tx(STORES.OFFLINE_Q, 'readwrite', (s) => s.clear());
  } catch { /* ignore */ }
}

// ─── Contract History Store ──────────────────────────────────────────────────
export async function addContractInteraction(record) {
  try {
    await tx(STORES.CONTRACT_HISTORY, 'readwrite', (s) => s.put(record));
  } catch { /* ignore */ }
}

export async function getContractInteractions(filters = {}) {
  try {
    const all = await tx(STORES.CONTRACT_HISTORY, 'readonly', (s) => s.getAll()) ?? [];
    let results = all.sort((a, b) => b.timestamp - a.timestamp);
    
    if (filters.contractId) {
      results = results.filter(r => r.contractId.toLowerCase().includes(filters.contractId.toLowerCase()));
    }
    if (filters.functionName) {
      results = results.filter(r => r.functionName.toLowerCase().includes(filters.functionName.toLowerCase()));
    }
    if (filters.type && filters.type !== 'all') {
      results = results.filter(r => r.type === filters.type);
    }
    if (filters.status && filters.status !== 'all') {
      results = results.filter(r => r.status === filters.status);
    }
    return results;
  } catch {
    return [];
  }
}

export async function clearContractInteractions() {
  try {
    await tx(STORES.CONTRACT_HISTORY, 'readwrite', (s) => s.clear());
  } catch { /* ignore */ }
}

// ─── Storage stats ────────────────────────────────────────────────────────────

/**
 * Estimate the number of entries in each store.
 * @returns {Promise<{ appState: number, apiCache: number, offlineQueue: number }>}
 */
export async function storageStats() {
  try {
    const [appState, apiCache, offlineQueue] = await Promise.all([
      tx(STORES.APP_STATE, 'readonly', (s) => s.count()),
      tx(STORES.API_CACHE, 'readonly', (s) => s.count()),
      tx(STORES.OFFLINE_Q, 'readonly', (s) => s.count()),
    ]);
    return { appState, apiCache, offlineQueue };
  } catch {
    return { appState: 0, apiCache: 0, offlineQueue: 0 };
  }
}

// ─── Auto-prune on load ───────────────────────────────────────────────────────

// Prune expired API cache entries 3 seconds after module load
if (typeof window !== 'undefined') {
  setTimeout(() => pruneExpiredApiCache().catch(() => {}), 3_000);
}

// ─── Encrypted storage ────────────────────────────────────────────────────────
// Wraps setStoredValue/getStoredValue with AES-GCM encryption.
// Import lazily to avoid loading crypto code unless needed.

/**
 * Store a value encrypted with a passphrase.
 * The stored record contains { ciphertext, iv, salt } — no plaintext is persisted.
 *
 * @param {string} key
 * @param {string} plaintext   String value to encrypt (JSON.stringify objects first)
 * @param {string} passphrase  User-provided passphrase
 */
export async function setEncryptedValue(key, plaintext, passphrase) {
  const { encrypt } = await import('./encryption.js');
  const encrypted = await encrypt(plaintext, passphrase);
  await setStoredValue(`enc:${key}`, encrypted);
}

/**
 * Retrieve and decrypt a value stored with setEncryptedValue.
 * Returns null if the key doesn't exist.
 * Throws if the passphrase is wrong or data is corrupted.
 *
 * @param {string} key
 * @param {string} passphrase
 * @returns {Promise<string|null>}
 */
export async function getEncryptedValue(key, passphrase) {
  const record = await getStoredValue(`enc:${key}`);
  if (!record) return null;
  const { decrypt } = await import('./encryption.js');
  return decrypt(record.ciphertext, passphrase, record.iv, record.salt);
}

/**
 * Remove an encrypted value.
 * @param {string} key
 */
export async function removeEncryptedValue(key) {
  await removeStoredValue(`enc:${key}`);
}
