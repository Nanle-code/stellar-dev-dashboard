import { getServer } from './stellar'

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Exponential backoff configuration for ledger stream reconnection.
 *
 * Strategy: baseDelay * 2^attempt, with full jitter (random [0, baseDelay))
 * using RECONNECT_JITTER_FACTOR to scale the jitter range.
 * Maximum delay capped at RECONNECT_MAX_DELAY_MS to prevent unbounded growth.
 *
 * Parameters:
 *   - RECONNECT_BASE_DELAY_MS: Initial delay in milliseconds (1000 = 1s)
 *   - RECONNECT_MAX_DELAY_MS: Maximum delay ceiling in milliseconds (30000 = 30s)
 *   - MAX_RECONNECT_ATTEMPTS: Max retry attempts before giving up (10)
 *   - RECONNECT_JITTER_FACTOR: Jitter range multiplier (1 = full [0, baseDelay),
 *     0 = no jitter, deterministic backoff)
 *
 * Offline-pause behavior:
 *   - When browser goes offline (_isOnline becomes false), pending reconnect
 *     timers are cancelled and no new retry attempts are made.
 *   - Reconnect attempts are NOT incremented while offline, so backoff state
 *     is preserved.
 *   - When coming back online (_isOnline becomes true), reconnect attempts
 *     are reset to 0 and reconnection starts from base delay immediately.
 *   - Status transitions to 'reconnecting' while paused offline so callers
 *     can surface "Paused - offline" state.
 *
 * Compatibility:
 *   - Environments without `navigator.onLine` (e.g., SSR, node): defaults
 *     to `_isOnline = true` to avoid crashing. Online/offline event listeners
 *     are no-ops if `window` is not defined.
 *   - The `_isOnline` flag and `_setIsOnline()` method gracefully degrade
 *     without throwing in any environment.
 */
const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000
const MAX_RECONNECT_ATTEMPTS = 10

// Jitter configuration — full jitter (random value in [0, delay))
// prevents reconnect storms when many clients resume simultaneously.
const RECONNECT_JITTER_FACTOR = 1 // full jitter: random [0, delay);
// The jitter factor scales the jitter range: factor=1 gives full [0, baseDelay),
// factor=0 gives no jitter (pure deterministic backoff).

// ── StreamManager ──────────────────────────────────────────────────────────────

/**
 * Manages a single Horizon SSE ledger stream with automatic reconnection and
 * a pub-sub interface so multiple consumers can attach without creating
 * multiple network connections.
 *
 * Status transitions:
 *   disconnected → connecting → connected
 *   connected    → error      → reconnecting → connecting → …
 *   any          → disconnected  (on explicit .disconnect())
 */
class StreamManager {
  constructor() {
    /** @type {(() => void) | null} */
    this._closeStream = null
    /** @type {'disconnected'|'connecting'|'connected'|'reconnecting'|'error'} */
    this._status = 'disconnected'
    this._reconnectAttempts = 0
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._reconnectTimer = null
    /** @type {string | null} */
    this._network = null

    /** Ledger callbacks */
    this._ledgerSubscribers = new Set()
    /** Status-change callbacks */
    this._statusSubscribers = new Set()

    /** Online-state awareness */
    this._isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    this._onlineUnsubscribers = []

    // Register online/offline event listeners once per manager instance
    this._registerOnlineListeners()
  }

  /**
   * Register window online/offline event listeners.
   * Safe to call multiple times — existing listeners are cleaned up before
   * re-registration. Designed to be no-op in SSR / test environments without
   * window/navigator.
   */
  _registerOnlineListeners() {
    // Clean up any previously registered listeners
    this._onlineUnsubscribers.forEach((unsub) => unsub())
    this._onlineUnsubscribers = []

    if (typeof window === 'undefined') return

    const onOnline = () => {
      this._setIsOnline(true)
    }
    const onOffline = () => {
      this._setIsOnline(false)
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    this._onlineUnsubscribers.push(
      () => window.removeEventListener('online', onOnline),
      () => window.removeEventListener('offline', onOffline),
    )
  }

  /**
   * Update the internal _isOnline flag and optionally pause/resume reconnection.
   * Called from online/offline event handlers.
   * @param {boolean} online
   */
  _setIsOnline(online) {
    this._isOnline = online
    // When coming back online, reset backoff so reconnection proceeds promptly.
    // When going offline, pause the pending reconnect timer.
    if (online) {
      // Reset reconnect attempts and cancel pending timer so reconnection
      // starts from base delay immediately.
      const wasPausedOffline = this._status === 'reconnecting'
      this._reconnectAttempts = 0
      this._cancelReconnect()
      if (wasPausedOffline) {
        // We were paused waiting for connectivity — reopen the stream now
        // instead of leaving the manager stuck reporting 'connecting'.
        this._openStream()
      }
    } else {
      // Pause: cancel any pending reconnect timer without incrementing attempts.
      this._cancelReconnect()
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Register a callback that fires each time a new ledger arrives.
   * Returns an unsubscribe function.
   * @param {(ledger: object) => void} callback
   * @returns {() => void}
   */
  subscribe(callback) {
    this._ledgerSubscribers.add(callback)
    return () => this._ledgerSubscribers.delete(callback)
  }

  /**
   * Register a callback that fires each time the connection status changes.
   * Returns an unsubscribe function.
   * @param {(status: string) => void} callback
   * @returns {() => void}
   */
  onStatusChange(callback) {
    this._statusSubscribers.add(callback)
    return () => this._statusSubscribers.delete(callback)
  }

  /** @returns {'disconnected'|'connecting'|'connected'|'reconnecting'|'error'} */
  getStatus() {
    return this._status
  }

  /**
   * Open (or re-open) the stream for the given network.
   * Disconnects any existing stream first.
   * @param {string} [network='testnet']
   */
  connect(network = 'testnet') {
    if (this._network !== network && this._closeStream) {
      this.disconnect()
    }
    this._network = network
    this._reconnectAttempts = 0
    this._openStream()
  }

  /**
   * Close the stream and cancel any pending reconnect.
   * Status becomes 'disconnected'.
   */
  disconnect() {
    this._cancelReconnect()
    this._closeActiveStream()
    this._setStatus('disconnected')
    this._reconnectAttempts = 0
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _setStatus(status) {
    if (this._status === status) return
    this._status = status
    for (const cb of this._statusSubscribers) {
      try { cb(status) } catch { /* ignore subscriber errors */ }
    }
  }

  _emit(ledger) {
    for (const cb of this._ledgerSubscribers) {
      try { cb(ledger) } catch { /* ignore subscriber errors */ }
    }
  }

  _openStream() {
    this._setStatus('connecting')
    try {
      const server = getServer(this._network)
      this._closeStream = server
        .ledgers()
        .cursor('now')
        .stream({
          onmessage: (ledger) => {
            this._reconnectAttempts = 0
            this._setStatus('connected')
            this._emit(ledger)
          },
          onerror: (error) => {
            console.error('[StreamManager] SSE error:', error)
            this._setStatus('error')
            this._scheduleReconnect()
          },
        })
    } catch (err) {
      console.error('[StreamManager] Failed to open stream:', err)
      this._setStatus('error')
      this._scheduleReconnect()
    }
  }

  _closeActiveStream() {
    if (this._closeStream) {
      try { this._closeStream() } catch { /* ignore */ }
      this._closeStream = null
    }
  }

  _cancelReconnect() {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
  }

  _scheduleReconnect() {
    // If the browser is offline, pause reconnection entirely — don't burn
    // a retry attempt or backoff growth while there's no network.
    if (!this._isOnline) {
      // Still update status to reflect we're paused offline; callers can
      // surface "paused - offline" state if desired.
      this._setStatus('reconnecting')
      return
    }

    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[StreamManager] Max reconnect attempts reached')
      this._setStatus('error')
      return
    }

    this._cancelReconnect()
    this._closeActiveStream()

    const baseDelay = RECONNECT_BASE_DELAY_MS * 2 ** this._reconnectAttempts
    // Full jitter using RECONNECT_JITTER_FACTOR: random delay in
    // [0, baseDelay) — prevents reconnect storms when many clients
    // resume simultaneously. factor=1 gives full jitter, factor=0
    // gives deterministic backoff.
    const jitteredDelay = Math.floor(
      RECONNECT_JITTER_FACTOR * Math.random() * baseDelay
    )
    const delay = Math.min(jitteredDelay, RECONNECT_MAX_DELAY_MS)

    this._reconnectAttempts++
    this._setStatus('reconnecting')

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      if (this._status !== 'disconnected') {
        this._openStream()
      }
    }, delay)
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

/**
 * Shared stream manager instance.  Components attach/detach subscribers
 * without creating multiple HTTP connections.
 */
export const ledgerStreamManager = new StreamManager()

// ── Convenience hook helper ────────────────────────────────────────────────────

/**
 * Connect the shared manager to `network`, register ledger and status
 * callbacks, and return a cleanup function that removes the callbacks and
 * disconnects the stream.
 *
 * Designed to be called inside a React useEffect:
 *
 *   useEffect(() => connectLedgerStream(network, onLedger, onStatus), [network])
 *
 * @param {string} network
 * @param {(ledger: object) => void} onLedger
 * @param {(status: string) => void} onStatus
 * @returns {() => void} cleanup
 */
export function connectLedgerStream(network, onLedger, onStatus) {
  const unsubLedger = ledgerStreamManager.subscribe(onLedger)
  const unsubStatus = ledgerStreamManager.onStatusChange(onStatus)

  ledgerStreamManager.connect(network)

  return () => {
    unsubLedger()
    unsubStatus()
    ledgerStreamManager.disconnect()
  }
}
