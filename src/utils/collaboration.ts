/**
 * Collaboration utilities (#112)
 *
 * Shared-dashboard helpers:
 *  - Presence tracking (who else is viewing the same dashboard)
 *  - Cursor / pointer broadcasting
 *  - Shared filter / tab state merging
 */

/**
 * Create a presence record for the current user.
 * @param {string} sessionId
 * @param {string | null} address  Connected Stellar address, if any
 * @returns {PresenceRecord}
 */
export function createPresenceRecord(sessionId, address) {
  return {
    sessionId,
    address: address ?? null,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    cursor: null,
  }
}

/**
 * Merge an incoming presence update into the local presence map.
 * Returns a new Map — does not mutate the original.
 *
 * @param {Map<string, PresenceRecord>} current
 * @param {PresenceRecord}              incoming
 * @returns {Map<string, PresenceRecord>}
 */
export function mergePresence(current, incoming) {
  const next = new Map(current)
  next.set(incoming.sessionId, { ...incoming, lastSeen: Date.now() })
  return next
}

/**
 * Remove sessions that have not sent a heartbeat within `ttlMs` milliseconds.
 * @param {Map<string, PresenceRecord>} current
 * @param {number} [ttlMs=30000]
 * @returns {Map<string, PresenceRecord>}
 */
export function pruneStalePresence(current, ttlMs = 30_000) {
  const now = Date.now()
  const next = new Map()
  for (const [id, record] of current) {
    if (now - record.lastSeen < ttlMs) next.set(id, record)
  }
  return next
}

/**
 * Build a cursor-move message payload.
 * @param {number} x  Normalised X position (0–1)
 * @param {number} y  Normalised Y position (0–1)
 * @returns {{ x: number, y: number }}
 */
export function buildCursorPayload(x, y) {
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }
}

/**
 * Derive a deterministic colour for a session (for presence avatars / cursors).
 * @param {string} sessionId
 * @returns {string} HSL colour string
 */
export function sessionColor(sessionId) {
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash) + sessionId.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 55%)`
}

/**
 * Merge a remote shared-view state update into local state.
 * Last-writer-wins per key, filtered to a safe allow-list of shareable keys.
 *
 * @param {Record<string, unknown>} local
 * @param {Record<string, unknown>} remote
 * @returns {Record<string, unknown>}
 */
const SHAREABLE_KEYS = new Set(['activeTab', 'network', 'connectedAddress'])

export function mergeSharedViewState(local, remote) {
  const merged = { ...local }
  for (const [key, value] of Object.entries(remote)) {
    if (SHAREABLE_KEYS.has(key)) merged[key] = value
  }
  return merged
}
