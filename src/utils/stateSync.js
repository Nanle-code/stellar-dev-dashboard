import { getStoredValue, setStoredValue } from '../lib/storage'

const SYNC_CHANNEL_NAME = 'stellar-dashboard-state-sync'

let channel = null

function getChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(SYNC_CHANNEL_NAME)
  }
  return channel
}

/**
 * Broadcast a state change to other open tabs.
 */
export function broadcastStateChange(key, value) {
  try {
    const ch = getChannel()
    if (ch) {
      ch.postMessage({ key, value, timestamp: Date.now() })
    }
  } catch {
    // BroadcastChannel not supported – skip
  }
}

/**
 * Subscribe to state changes from other tabs.
 * Returns an unsubscribe function.
 */
export function onStateChange(callback) {
  try {
    const ch = getChannel()
    if (!ch) return () => {}

    const handler = (event) => {
      const { key, value } = event.data || {}
      if (key !== undefined) {
        callback(key, value)
      }
    }

    ch.addEventListener('message', handler)
    return () => ch.removeEventListener('message', handler)
  } catch {
    return () => {}
  }
}

/**
 * Persist a slice of state and broadcast it to other tabs.
 */
export async function syncState(key, value) {
  await setStoredValue(key, value)
  broadcastStateChange(key, value)
}

/**
 * Load persisted state for a given key.
 */
export async function loadSyncedState(key) {
  return getStoredValue(key)
}
