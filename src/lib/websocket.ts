/**
 * WebSocket client for real-time collaboration (#112).
 *
 * Provides an auto-reconnecting WebSocket wrapper with:
 *  - Exponential back-off reconnect
 *  - Message type routing (subscribe/publish)
 *  - Ping/pong keepalive
 *  - Listener cleanup
 */

const DEFAULT_RECONNECT_BASE_MS = 500
const DEFAULT_RECONNECT_MAX_MS  = 30_000
const PING_INTERVAL_MS          = 25_000

export class CollaborationSocket {
  constructor(url, options = {}) {
    this._url            = url
    this._options        = options
    this._ws             = null
    this._listeners      = new Map()   // eventType → Set<handler>
    this._reconnectDelay = DEFAULT_RECONNECT_BASE_MS
    this._reconnectTimer = null
    this._pingTimer      = null
    this._intentionalClose = false
    this._sessionId      = `session-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
  }

  get sessionId() { return this._sessionId }
  get connected() { return this._ws?.readyState === WebSocket.OPEN }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  connect() {
    if (this._ws && this._ws.readyState < WebSocket.CLOSING) return

    this._intentionalClose = false

    try {
      this._ws = new WebSocket(this._url)
    } catch (err) {
      this._scheduleReconnect()
      return
    }

    this._ws.onopen = () => {
      this._reconnectDelay = DEFAULT_RECONNECT_BASE_MS
      this._emit('connected', { sessionId: this._sessionId })
      this._startPing()
    }

    this._ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        this._emit(msg.type ?? 'message', msg)
      } catch {
        this._emit('message', { raw: event.data })
      }
    }

    this._ws.onclose = () => {
      this._stopPing()
      this._emit('disconnected', {})
      if (!this._intentionalClose) this._scheduleReconnect()
    }

    this._ws.onerror = (err) => {
      this._emit('error', { error: err })
    }
  }

  disconnect() {
    this._intentionalClose = true
    clearTimeout(this._reconnectTimer)
    this._stopPing()
    if (this._ws) {
      this._ws.close(1000, 'Client disconnect')
      this._ws = null
    }
  }

  // ── Messaging ───────────────────────────────────────────────────────────────

  /**
   * Send a typed message to the server.
   * @param {string} type
   * @param {Record<string, unknown>} payload
   */
  send(type, payload = {}) {
    if (!this.connected) {
      console.warn('[CollaborationSocket] Cannot send — not connected')
      return false
    }
    this._ws.send(JSON.stringify({ type, payload, sessionId: this._sessionId, ts: Date.now() }))
    return true
  }

  // ── Pub/sub ─────────────────────────────────────────────────────────────────

  on(eventType, handler) {
    if (!this._listeners.has(eventType)) this._listeners.set(eventType, new Set())
    this._listeners.get(eventType).add(handler)
    return () => this.off(eventType, handler)
  }

  off(eventType, handler) {
    this._listeners.get(eventType)?.delete(handler)
  }

  _emit(eventType, data) {
    this._listeners.get(eventType)?.forEach((h) => {
      try { h(data) } catch { /* ignore handler errors */ }
    })
  }

  // ── Reconnect ───────────────────────────────────────────────────────────────

  _scheduleReconnect() {
    clearTimeout(this._reconnectTimer)
    this._reconnectTimer = setTimeout(() => {
      this._emit('reconnecting', { delay: this._reconnectDelay })
      this.connect()
    }, this._reconnectDelay)

    this._reconnectDelay = Math.min(this._reconnectDelay * 2, DEFAULT_RECONNECT_MAX_MS)
  }

  // ── Keepalive ───────────────────────────────────────────────────────────────

  _startPing() {
    this._stopPing()
    this._pingTimer = setInterval(() => {
      if (this.connected) this.send('ping', {})
    }, PING_INTERVAL_MS)
  }

  _stopPing() {
    clearInterval(this._pingTimer)
    this._pingTimer = null
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _socket = null

export function getCollaborationSocket(url) {
  if (!_socket && url) {
    _socket = new CollaborationSocket(url)
    _socket.connect()
  }
  return _socket
}

export function destroyCollaborationSocket() {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
}
