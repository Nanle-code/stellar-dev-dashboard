/**
 * AccountStreamManager
 *
 * Manages real-time, per-account streams against Horizon (SSE under the
 * hood). Multiple subscribers can attach to the same accountId/channel pair
 * without opening more than one network connection per (channel, account).
 *
 * Channels:
 *   effects      — every effect on the account (balance changes, signers, …)
 *   payments     — incoming and outgoing payments
 *   operations   — every operation that involved the account
 *   transactions — every transaction the account participated in
 *
 * Resilience:
 *   - Exponential backoff up to 30s on errors.
 *   - Caps at MAX_RECONNECT_ATTEMPTS, then sits in 'error' until manually retried.
 *   - Tracks lastMessageAt so the UI can surface "stale stream" warnings.
 */

import { getServer } from '../stellar'
import type { NetworkName } from '../stellar'
import type {
  AccountStreamChannel,
  AccountStreamEvent,
  AccountSubscriptionOptions,
  StreamStatus,
  StreamStatusChange,
  StreamUnsubscribe,
} from './StreamTypes'

const RECONNECT_BASE_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000
const MAX_RECONNECT_ATTEMPTS = 10

type Listener = (event: AccountStreamEvent) => void
type StatusListener = (change: StreamStatusChange) => void

interface StreamState {
  accountId: string
  channel: AccountStreamChannel
  network: NetworkName
  cursor: string
  closeStream: (() => void) | null
  status: StreamStatus
  listeners: Set<Listener>
  reconnectAttempts: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
  lastMessageAt?: number
}

function streamKey(accountId: string, channel: AccountStreamChannel, network: NetworkName) {
  return `${network}:${accountId}:${channel}`
}

export class AccountStreamManager {
  private streams = new Map<string, StreamState>()
  private statusListeners = new Map<string, Set<StatusListener>>()

  /**
   * Subscribe to one or more channels for an account. Returns an unsubscribe
   * function that, when called, removes the listener and closes the
   * underlying SSE connection if no other listeners remain.
   */
  subscribe(
    accountId: string,
    network: NetworkName,
    callback: Listener,
    options: AccountSubscriptionOptions = {},
  ): StreamUnsubscribe {
    const channels: AccountStreamChannel[] =
      options.channels && options.channels.length > 0
        ? options.channels
        : ['effects']

    const cursor = options.cursor ?? 'now'

    const cleanups: Array<() => void> = []

    for (const channel of channels) {
      const key = streamKey(accountId, channel, network)
      let state = this.streams.get(key)

      if (!state) {
        state = {
          accountId,
          channel,
          network,
          cursor,
          closeStream: null,
          status: 'idle',
          listeners: new Set(),
          reconnectAttempts: 0,
          reconnectTimer: null,
        }
        this.streams.set(key, state)
        this.openStream(state)
      }

      state.listeners.add(callback)

      if (options.onStatusChange) {
        this.onStatusChange(accountId, channel, network, options.onStatusChange)
      }

      cleanups.push(() => {
        const current = this.streams.get(key)
        if (!current) return
        current.listeners.delete(callback)
        if (current.listeners.size === 0) {
          this.closeStream(current)
          this.streams.delete(key)
        }
      })
    }

    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }

  onStatusChange(
    accountId: string,
    channel: AccountStreamChannel,
    network: NetworkName,
    callback: StatusListener,
  ): StreamUnsubscribe {
    const key = streamKey(accountId, channel, network)
    if (!this.statusListeners.has(key)) {
      this.statusListeners.set(key, new Set())
    }
    this.statusListeners.get(key)!.add(callback)

    // Emit current state so subscribers don't need to wait for the next change.
    const state = this.streams.get(key)
    if (state) {
      callback({
        status: state.status,
        attempt: state.reconnectAttempts,
        lastMessageAt: state.lastMessageAt,
      })
    }

    return () => {
      this.statusListeners.get(key)?.delete(callback)
    }
  }

  /**
   * Force-close every stream this manager owns. Useful on network change or
   * tear-down.
   */
  disconnectAll(): void {
    for (const state of this.streams.values()) this.closeStream(state)
    this.streams.clear()
  }

  /**
   * Disconnect all streams for a single account (any channel).
   */
  disconnectAccount(accountId: string): void {
    for (const [key, state] of this.streams) {
      if (state.accountId === accountId) {
        this.closeStream(state)
        this.streams.delete(key)
      }
    }
  }

  getStatus(
    accountId: string,
    channel: AccountStreamChannel,
    network: NetworkName,
  ): StreamStatus {
    return this.streams.get(streamKey(accountId, channel, network))?.status ?? 'idle'
  }

  /** Returns one summary row per active stream — used by the UI panel. */
  listActiveStreams(): Array<{
    accountId: string
    channel: AccountStreamChannel
    network: NetworkName
    status: StreamStatus
    listeners: number
    lastMessageAt?: number
  }> {
    return Array.from(this.streams.values()).map((s) => ({
      accountId: s.accountId,
      channel: s.channel,
      network: s.network,
      status: s.status,
      listeners: s.listeners.size,
      lastMessageAt: s.lastMessageAt,
    }))
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private openStream(state: StreamState): void {
    this.setStatus(state, 'connecting')

    let server: ReturnType<typeof getServer>
    try {
      server = getServer(state.network)
    } catch (err) {
      this.setStatus(state, 'error', String(err))
      this.scheduleReconnect(state)
      return
    }

    const builder = this.buildEndpoint(server, state)

    try {
      state.closeStream = builder.cursor(state.cursor).stream({
        onmessage: (record: unknown) => {
          state.reconnectAttempts = 0
          state.lastMessageAt = Date.now()
          this.setStatus(state, 'connected')

          const typed = record as { paging_token?: string }
          state.cursor = typed?.paging_token ?? state.cursor

          const event: AccountStreamEvent = {
            channel: state.channel,
            accountId: state.accountId,
            network: state.network,
            pagingToken: typed?.paging_token ?? '',
            receivedAt: state.lastMessageAt!,
            record,
          }

          for (const listener of state.listeners) {
            try {
              listener(event)
            } catch {
              /* swallow listener errors so one bad subscriber can't kill the stream */
            }
          }
        },
        onerror: (error: unknown) => {
          this.setStatus(state, 'error', String(error))
          this.scheduleReconnect(state)
        },
      })
    } catch (err) {
      this.setStatus(state, 'error', String(err))
      this.scheduleReconnect(state)
    }
  }

  private buildEndpoint(
    server: ReturnType<typeof getServer>,
    state: StreamState,
  ): {
    cursor: (c: string) => { stream: (handlers: { onmessage: (r: unknown) => void; onerror: (e: unknown) => void }) => () => void }
  } {
    switch (state.channel) {
      case 'effects':
        return server.effects().forAccount(state.accountId) as never
      case 'payments':
        return server.payments().forAccount(state.accountId) as never
      case 'operations':
        return server.operations().forAccount(state.accountId) as never
      case 'transactions':
        return server.transactions().forAccount(state.accountId) as never
      default: {
        const exhaustive: never = state.channel
        throw new Error(`Unknown channel: ${exhaustive as string}`)
      }
    }
  }

  private closeStream(state: StreamState): void {
    if (state.reconnectTimer !== null) {
      clearTimeout(state.reconnectTimer)
      state.reconnectTimer = null
    }
    if (state.closeStream) {
      try {
        state.closeStream()
      } catch {
        /* ignore */
      }
      state.closeStream = null
    }
    this.setStatus(state, 'disconnected')
  }

  private scheduleReconnect(state: StreamState): void {
    if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.setStatus(state, 'error', 'max-reconnect-attempts')
      return
    }

    if (state.closeStream) {
      try {
        state.closeStream()
      } catch {
        /* ignore */
      }
      state.closeStream = null
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** state.reconnectAttempts,
      RECONNECT_MAX_DELAY_MS,
    )
    state.reconnectAttempts++
    this.setStatus(state, 'reconnecting')

    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null
      // If the stream was disconnected externally, don't reopen.
      if (state.status === 'disconnected') return
      this.openStream(state)
    }, delay)
  }

  private setStatus(state: StreamState, next: StreamStatus, error?: string): void {
    if (state.status === next && next !== 'connected') return
    state.status = next

    const change: StreamStatusChange = {
      status: next,
      attempt: state.reconnectAttempts,
      lastMessageAt: state.lastMessageAt,
      ...(error ? { error } : {}),
    }
    const key = streamKey(state.accountId, state.channel, state.network)
    const listeners = this.statusListeners.get(key)
    if (!listeners) return
    for (const cb of listeners) {
      try {
        cb(change)
      } catch {
        /* ignore */
      }
    }
  }
}

/** Shared singleton — components subscribe through this. */
export const accountStreamManager = new AccountStreamManager()
