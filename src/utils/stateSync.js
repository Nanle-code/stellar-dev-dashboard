/**
 * stateSync.js
 * Cross-tab state synchronization via BroadcastChannel.
 * Two tabs open on the same origin will stay in sync for network, activeTab,
 * and connectedAddress — without sharing private keys.
 *
 * Usage:
 *   import { initStateSync, broadcastStateChange, destroyStateSync } from './stateSync';
 *   // Call once at app boot:
 *   initStateSync(useStore);
 */

const CHANNEL_NAME = 'stellar-dashboard-sync';
const SYNC_VERSION = 1;

// Fields that are safe to broadcast (no private keys, no secrets).
const ALLOWED_KEYS = ['network', 'activeTab', 'connectedAddress', 'theme'];

let channel = null;
let storeRef = null;
let unsubscribe = null;
let _ignoreNextUpdate = false; // prevent echo loop

/**
 * Encode only the safe slice of state for broadcasting.
 * @param {object} state - Full Zustand store state
 * @returns {object} - Filtered state snapshot
 */
function encodeState(state) {
  return ALLOWED_KEYS.reduce((acc, key) => {
    if (state[key] !== undefined) acc[key] = state[key];
    return acc;
  }, {});
}

/**
 * Validate an incoming message from another tab.
 * @param {MessageEvent} event
 * @returns {object|null} - Parsed payload or null if invalid
 */
function parseMessage(event) {
  try {
    const { version, type, payload } = event.data;
    if (version !== SYNC_VERSION) return null;
    if (type !== 'STATE_UPDATE') return null;
    if (!payload || typeof payload !== 'object') return null;
    // Only accept known-safe keys
    const filtered = {};
    for (const key of ALLOWED_KEYS) {
      if (key in payload) filtered[key] = payload[key];
    }
    return filtered;
  } catch {
    return null;
  }
}

/**
 * Broadcast a state change to other tabs.
 * @param {object} partialState - The subset of state that changed
 */
export function broadcastStateChange(partialState) {
  if (!channel) return;
  const safePayload = {};
  for (const key of ALLOWED_KEYS) {
    if (key in partialState) safePayload[key] = partialState[key];
  }
  if (Object.keys(safePayload).length === 0) return;
  channel.postMessage({ version: SYNC_VERSION, type: 'STATE_UPDATE', payload: safePayload });
}

/**
 * Initialise cross-tab sync.
 * @param {Function} useStore - The Zustand store hook (pass the store itself, not the hook)
 * @param {object} store - The raw Zustand store object (with .getState / .setState / .subscribe)
 */
export function initStateSync(store) {
  if (!('BroadcastChannel' in window)) {
    console.warn('[stateSync] BroadcastChannel not supported — cross-tab sync disabled.');
    return;
  }

  storeRef = store;

  // Create channel
  channel = new BroadcastChannel(CHANNEL_NAME);

  // Listen for updates from other tabs
  channel.onmessage = (event) => {
    const payload = parseMessage(event);
    if (!payload) return;
    _ignoreNextUpdate = true;
    store.setState(payload);
    _ignoreNextUpdate = false;
  };

  channel.onmessageerror = (err) => {
    console.warn('[stateSync] Message error:', err);
  };

  // Subscribe to local store changes and broadcast them
  unsubscribe = store.subscribe((state, prevState) => {
    if (_ignoreNextUpdate) return;
    const changed = {};
    for (const key of ALLOWED_KEYS) {
      if (state[key] !== prevState[key]) changed[key] = state[key];
    }
    if (Object.keys(changed).length > 0) broadcastStateChange(changed);
  });
}

/**
 * Tear down the BroadcastChannel and store subscription.
 * Call this in useEffect cleanup if needed.
 */
export function destroyStateSync() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (channel) {
    channel.close();
    channel = null;
  }
  storeRef = null;
}

// ─── URL hash encoding / decoding ────────────────────────────────────────────

/**
 * Fields that may appear in a shareable URL hash.
 * NEVER includes private keys or secrets.
 */
const URL_FIELDS = ['network', 'activeTab', 'connectedAddress'];

/**
 * Encode session state into a URL-safe base64 hash fragment.
 * Only safe, non-secret fields are included.
 *
 * @param {object} state
 * @returns {string} - e.g. "#eyJuZXR3b3JrIjoidGVzdG5ldCJ9"
 */
export function encodeSessionToHash(state) {
  const payload = {};
  for (const key of URL_FIELDS) {
    if (state[key] !== undefined && state[key] !== null && state[key] !== '') {
      payload[key] = state[key];
    }
  }
  try {
    const json = JSON.stringify(payload);
    // btoa over encodeURIComponent to handle unicode
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return '#' + encoded;
  } catch {
    return '';
  }
}

/**
 * Decode a URL hash fragment back into session state.
 * Returns null if hash is absent or invalid.
 *
 * @param {string} [hash] - e.g. window.location.hash
 * @returns {object|null}
 */
export function decodeSessionFromHash(hash) {
  const raw = (hash || window.location.hash).replace(/^#/, '');
  if (!raw) return null;
  try {
    const json = decodeURIComponent(escape(atob(raw)));
    const parsed = JSON.parse(json);
    // Strict allow-list: never let hash inject arbitrary state
    const safe = {};
    for (const key of URL_FIELDS) {
      if (key in parsed) safe[key] = parsed[key];
    }
    return Object.keys(safe).length ? safe : null;
  } catch {
    return null;
  }
}

/**
 * Build a full shareable URL for the current session.
 * @param {object} state
 * @returns {string}
 */
export function buildShareableURL(state) {
  const base = window.location.origin + window.location.pathname;
  return base + encodeSessionToHash(state);
}

// ─── Deterministic cross-tab state resolution (#751) ─────────────────────────
//
// Cross-tab writes to the same localStorage key can race: two tabs may both
// read version N, then both attempt to write N+1, and the second write silently
// clobbers the first (a "lost update"). To resolve concurrent updates
// *deterministically* we wrap every stored value in a version envelope and
// perform an optimistic compare-and-swap (CAS) with retry. Any residual
// conflict (e.g. equal versions from a legacy writer) is settled by
// resolveStateConflict(), a pure, order-independent function so every tab
// converges to the same value.
//
// Envelope shape (only the caller-supplied `value` is stored — never secrets):
//   { __v: number, __t: number, __w: string, value: any }

const ENV_VERSION = '__v';
const ENV_TIME = '__t';
const ENV_WRITER = '__w';
const ENV_VALUE = 'value';

// Bound the number of CAS retries under sustained concurrent contention. Each
// retry advances the version, guaranteeing progress; exhaustion is surfaced as
// a rejection (see syncState failure path).
const MAX_CONFLICT_RETRIES = 16;

function localStorageAvailable() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

let _tabId = null;
/**
 * Stable, per-tab identifier used to deterministically break version ties.
 * @returns {string}
 */
export function getTabId() {
  if (_tabId) return _tabId;
  let id;
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      id = 'tab-' + crypto.randomUUID();
    } else {
      id = 'tab-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
    }
  } catch {
    id = 'tab-fallback-' + Math.random().toString(36).slice(2);
  }
  _tabId = id;
  return _tabId;
}

function isEnvelope(obj) {
  return !!obj && typeof obj === 'object' && ENV_VERSION in obj;
}

// Coerce a stored value (envelope or legacy raw value) into a normalized
// envelope. Legacy raw values (no __v) become version 0 so old data still
// participates in deterministic resolution and migration is transparent.
function toEnvelope(raw) {
  if (raw === null || raw === undefined) return null;
  if (isEnvelope(raw)) {
    return {
      [ENV_VERSION]: Number(raw[ENV_VERSION]) || 0,
      [ENV_TIME]: Number(raw[ENV_TIME]) || 0,
      [ENV_WRITER]: typeof raw[ENV_WRITER] === 'string' ? raw[ENV_WRITER] : '',
      [ENV_VALUE]: raw[ENV_VALUE],
    };
  }
  return {
    [ENV_VERSION]: 0,
    [ENV_TIME]: 0,
    [ENV_WRITER]: '',
    [ENV_VALUE]: raw,
  };
}

// Build an envelope from a value plus optional structured metadata. Falls back
// to a legacy (version 0) envelope when no meta is supplied.
function toEnvelopeFromValue(value, meta) {
  if (meta && typeof meta === 'object') {
    return toEnvelope({
      [ENV_VERSION]: Number(meta.version) || 0,
      [ENV_TIME]: Number(meta.timestamp) || 0,
      [ENV_WRITER]: typeof meta.writerId === 'string' ? meta.writerId : '',
      [ENV_VALUE]: value,
    });
  }
  return toEnvelope(value);
}

function parseEnvelopeString(rawStr) {
  if (rawStr == null) return null;
  try {
    return toEnvelope(JSON.parse(rawStr));
  } catch {
    // Corrupt entry — treat as no prior state rather than throwing.
    return null;
  }
}

function readEnvelope(key) {
  try {
    return parseEnvelopeString(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function safeParseOrNull(raw) {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Attempt a single compare-and-swap write. If the stored version has already
// advanced past `baseVersion` (another tab committed in between), `committed`
// is false and `baseVersion` carries the newer version to rebase onto.
function tryWriteEnvelope(key, baseVersion, value) {
  const env = {
    [ENV_VERSION]: baseVersion + 1,
    [ENV_TIME]: Date.now(),
    [ENV_WRITER]: getTabId(),
    [ENV_VALUE]: value,
  };
  const current = readEnvelope(key);
  if (current && current[ENV_VERSION] !== baseVersion) {
    return { committed: false, baseVersion: current[ENV_VERSION] };
  }
  localStorage.setItem(key, JSON.stringify(env));
  return { committed: true, baseVersion };
}

/**
 * Persist a keyed state slice to localStorage with deterministic,
 * conflict-safe (compare-and-swap) cross-tab writes.
 *
 * Prevents lost updates: every write is assigned a strictly increasing version.
 * If another tab commits a newer version between our read and our write, this
 * rebases onto that version and retries — so two simultaneous edits can never
 * silently clobber each other into an inconsistent state.
 *
 * @param {string} key - Non-empty storage key
 * @param {*} value - Value to persist (must be defined and JSON-serializable)
 * @returns {Promise<number>} The version assigned to the committed write
 * @throws {TypeError} If `key` is not a non-empty string or `value` is undefined
 * @throws {Error} If localStorage is unavailable, a write throws, or retries are
 *                 exhausted under sustained concurrent contention
 */
export async function syncState(key, value) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new TypeError('syncState: key must be a non-empty string');
  }
  if (value === undefined) {
    throw new TypeError('syncState: value must be defined (use null to clear)');
  }
  if (!localStorageAvailable()) {
    throw new Error('syncState: localStorage is unavailable in this environment');
  }

  const first = readEnvelope(key);
  let base = first ? first[ENV_VERSION] : 0;

  for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt++) {
    let result;
    try {
      result = tryWriteEnvelope(key, base, value);
    } catch (err) {
      const reason = err && err.message ? err.message : 'storage error';
      throw new Error('syncState: failed to persist state — ' + reason);
    }
    if (result.committed) {
      return base + 1;
    }
    // Another tab advanced the version — rebase and retry.
    base = result.baseVersion;
  }

  throw new Error(
    'syncState: could not acquire a consistent version after ' +
      MAX_CONFLICT_RETRIES +
      ' retries (sustained concurrent write contention)'
  );
}

/**
 * Read a persisted, versioned state slice.
 * @param {string} key
 * @returns {{value:*, version:number, writerId:string, timestamp:number}|null}
 */
export function loadSyncedState(key) {
  if (typeof key !== 'string' || !key) return null;
  if (!localStorageAvailable()) return null;
  const env = readEnvelope(key);
  if (!env) return null;
  return {
    value: env[ENV_VALUE],
    version: env[ENV_VERSION],
    writerId: env[ENV_WRITER],
    timestamp: env[ENV_TIME],
  };
}

const _stateChangeListeners = new Set();

/**
 * Subscribe to cross-tab state changes (via the `storage` event).
 * The callback receives `(key, value, meta)` where `meta` is
 * `{ version, writerId, timestamp }` for envelope writes, or `null` for
 * legacy/non-envelope writes.
 *
 * @param {Function} callback
 * @returns {Function} unsubscribe
 * @throws {TypeError} If callback is not a function
 */
export function onStateChange(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('onStateChange: callback must be a function');
  }
  _stateChangeListeners.add(callback);

  const handler = (e) => {
    if (!e.key || !_stateChangeListeners.has(callback)) return;
    try {
      const env = parseEnvelopeString(e.newValue);
      const meta = env
        ? { version: env[ENV_VERSION], writerId: env[ENV_WRITER], timestamp: env[ENV_TIME] }
        : null;
      const value = env ? env[ENV_VALUE] : safeParseOrNull(e.newValue);
      callback(e.key, value, meta);
    } catch {
      // A malformed storage event must never break the listener.
    }
  };

  if (typeof window !== 'undefined') window.addEventListener('storage', handler);
  return () => {
    if (typeof window !== 'undefined') window.removeEventListener('storage', handler);
    _stateChangeListeners.delete(callback);
  };
}

/**
 * Deterministically resolve a conflict between a local and an incoming record.
 *
 * Pure and order-independent: `resolveStateConflict(a, ma, b, mb)` and
 * `resolveStateConflict(b, mb, a, ma)` always agree on the winner, so every tab
 * that observes the same two records converges to the same value (no divergence,
 * no silent lost update).
 *
 * Ranking (higher wins): version → timestamp → writer id (lexicographic) →
 * serialized value (lexicographic). A full tie returns the *local* value to keep
 * the local tab's state.
 *
 * @param {*} localValue - Current local value
 * @param {object} [localMeta] - `{ version, writerId, timestamp }` for local
 * @param {*} incomingValue - Incoming value from another tab
 * @param {object} [incomingMeta] - `{ version, writerId, timestamp }` for incoming
 * @returns {*} The winning value (local or incoming)
 */
export function resolveStateConflict(localValue, localMeta, incomingValue, incomingMeta) {
  const a = toEnvelopeFromValue(localValue, localMeta);
  const b = toEnvelopeFromValue(incomingValue, incomingMeta);
  if (!a) return incomingValue;
  if (!b) return localValue;

  const rank = (r) => [
    r[ENV_VERSION],
    r[ENV_TIME],
    r[ENV_WRITER],
    JSON.stringify(r[ENV_VALUE] ?? null),
  ];

  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < ra.length; i++) {
    if (ra[i] > rb[i]) return localValue;
    if (ra[i] < rb[i]) return incomingValue;
  }
  return localValue;
}
