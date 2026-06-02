import { getServer } from './stellar'

// ── Constants ──────────────────────────────────────────────────────────────────

const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000
const MAX_RECONNECT_ATTEMPTS = 10

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
  private _closeStream: (() => void) | null = null
  private _status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' = 'disconnected'
  private _reconnectAttempts = 0
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _network: any | null = null
  private _ledgerSubscribers: Set<(ledger: any) => void> = new Set()
  private _statusSubscribers: Set<(status: any) => void> = new Set()

  constructor() {
    this._closeStream = null
    this._status = 'disconnected'
    this._reconnectAttempts = 0
    this._reconnectTimer = null
    this._network = null

    this._ledgerSubscribers = new Set()
    this._statusSubscribers = new Set()
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Register a callback that fires each time a new ledger arrives.
   * Returns an unsubscribe function.
   * @param {(ledger: object) => void} callback
   * @returns {() => void}
   */
  subscribe(callback: (ledger: any) => void): () => void {
    this._ledgerSubscribers.add(callback)
    return () => { this._ledgerSubscribers.delete(callback); }
  }

  /**
   * Register a callback that fires each time the connection status changes.
   * Returns an unsubscribe function.
   * @param {(status: string) => void} callback
   * @returns {() => void}
   */
  onStatusChange(callback: (status: any) => void): () => void {
    this._statusSubscribers.add(callback)
    return () => { this._statusSubscribers.delete(callback); }
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
  connect(network: any = 'testnet') {
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
      const server = getServer(this._network as any)
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
    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[StreamManager] Max reconnect attempts reached')
      this._setStatus('error')
      return
    }

    this._cancelReconnect()
    this._closeActiveStream()

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** this._reconnectAttempts,
      RECONNECT_MAX_DELAY_MS,
    )
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
