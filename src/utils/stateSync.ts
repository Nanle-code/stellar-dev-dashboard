import { getStoredValue, setStoredValue } from '../lib/storage'

const SYNC_CHANNEL_NAME = 'stellar-dashboard-state-sync'
const TAB_ID = `tab-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`

let channel = null

function getChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(SYNC_CHANNEL_NAME)
  }
  return channel
}

/**
 * Broadcast a state change to other open tabs.
 * Messages include a vector clock (timestamp + tabId) for conflict resolution.
 */
export function broadcastStateChange(key, value) {
  try {
    const ch = getChannel()
    if (ch) {
      ch.postMessage({ key, value, timestamp: Date.now(), tabId: TAB_ID })
    }
  } catch {
    // BroadcastChannel not supported – skip
  }
}

/**
 * Subscribe to state changes from other tabs.
 * The callback receives (key, value, meta: { timestamp, tabId }).
 * Returns an unsubscribe function.
 */
export function onStateChange(callback) {
  try {
    const ch = getChannel()
    if (!ch) return () => {}

    const handler = (event) => {
      const { key, value, timestamp, tabId } = event.data || {}
      // Ignore messages originating from this same tab
      if (key !== undefined && tabId !== TAB_ID) {
        callback(key, value, { timestamp, tabId })
      }
    }

    ch.addEventListener('message', handler)
    return () => ch.removeEventListener('message', handler)
  } catch {
    return () => {}
  }
}

/**
 * Persist a slice of state to IndexedDB and broadcast to other tabs.
 * The record includes a `_syncedAt` timestamp for last-writer-wins resolution.
 */
export async function syncState(key, value) {
  const record = { ...value, _syncedAt: Date.now(), _tabId: TAB_ID }
  await setStoredValue(key, record)
  broadcastStateChange(key, record)
}

/**
 * Load persisted state for a given key.
 */
export async function loadSyncedState(key) {
  return getStoredValue(key)
}

/**
 * Merge two state snapshots using last-writer-wins per key (#105).
 * Fields with a newer `_syncedAt` timestamp win.
 *
 * @param {Record<string, unknown>} local   The locally held state
 * @param {Record<string, unknown>} remote  The incoming state from another tab or IDB
 * @returns {Record<string, unknown>} Merged state
 */
export function resolveStateConflict(local, remote) {
  if (!remote || typeof remote !== 'object') return local
  if (!local || typeof local !== 'object') return remote

  const localTs  = local._syncedAt  ?? 0
  const remoteTs = remote._syncedAt ?? 0

  // Remote is newer — use it as the base, preserving any local keys not in remote
  if (remoteTs >= localTs) {
    return { ...local, ...remote }
  }
  return { ...remote, ...local }
}

/** Return the tab identifier for this session. */
export function getTabId() {
  return TAB_ID
}
