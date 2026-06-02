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