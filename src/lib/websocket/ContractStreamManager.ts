/**
 * ContractStreamManager
 *
 * Soroban does not expose a streaming endpoint, so this manager polls
 * `getEvents` on a configurable interval and emits new events to subscribers.
 * Multiple consumers of the same contractId share one polling timer.
 */

import { getSorobanServer } from '../stellar'
import type { NetworkName } from '../stellar'
import type {
  ContractStreamEvent,
  ContractSubscriptionOptions,
  StreamStatus,
  StreamStatusChange,
  StreamUnsubscribe,
} from './StreamTypes'

const DEFAULT_POLL_INTERVAL_MS = 4_000
const MIN_POLL_INTERVAL_MS = 1_000
const MAX_BACKOFF_MS = 30_000

type Listener = (event: ContractStreamEvent) => void
type StatusListener = (change: StreamStatusChange) => void

interface PollState {
  contractId: string
  network: NetworkName
  pollIntervalMs: number
  topicFilters?: Array<Array<string>>
  listeners: Set<Listener>
  status: StreamStatus
  timer: ReturnType<typeof setTimeout> | null
  ledgerCursor: number | null
  consecutiveErrors: number
  lastMessageAt?: number
}

function pollKey(contractId: string, network: NetworkName) {
  return `${network}:${contractId}`
}

export class ContractStreamManager {
  private polls = new Map<string, PollState>()
  private statusListeners = new Map<string, Set<StatusListener>>()

  subscribe(
    contractId: string,
    network: NetworkName,
    callback: Listener,
    options: ContractSubscriptionOptions = {},
  ): StreamUnsubscribe {
    const key = pollKey(contractId, network)
    let state = this.polls.get(key)

    if (!state) {
      state = {
        contractId,
        network,
        pollIntervalMs: Math.max(
          options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
          MIN_POLL_INTERVAL_MS,
        ),
        topicFilters: options.topicFilters,
        listeners: new Set(),
        status: 'idle',
        timer: null,
        ledgerCursor: null,
        consecutiveErrors: 0,
      }
      this.polls.set(key, state)
      this.startPolling(state)
    }

    state.listeners.add(callback)

    if (options.onStatusChange) {
      this.onStatusChange(contractId, network, options.onStatusChange)
    }

    return () => {
      const current = this.polls.get(key)
      if (!current) return
      current.listeners.delete(callback)
      if (current.listeners.size === 0) {
        this.stopPolling(current)
        this.polls.delete(key)
      }
    }
  }

  onStatusChange(
    contractId: string,
    network: NetworkName,
    callback: StatusListener,
  ): StreamUnsubscribe {
    const key = pollKey(contractId, network)
    if (!this.statusListeners.has(key)) {
      this.statusListeners.set(key, new Set())
    }
    this.statusListeners.get(key)!.add(callback)

    const state = this.polls.get(key)
    if (state) {
      callback({
        status: state.status,
        attempt: state.consecutiveErrors,
        lastMessageAt: state.lastMessageAt,
      })
    }

    return () => {
      this.statusListeners.get(key)?.delete(callback)
    }
  }

  disconnectAll(): void {
    for (const state of this.polls.values()) this.stopPolling(state)
    this.polls.clear()
  }

  getStatus(contractId: string, network: NetworkName): StreamStatus {
    return this.polls.get(pollKey(contractId, network))?.status ?? 'idle'
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private startPolling(state: PollState): void {
    this.setStatus(state, 'connecting')
    void this.poll(state)
  }

  private stopPolling(state: PollState): void {
    if (state.timer !== null) {
      clearTimeout(state.timer)
      state.timer = null
    }
    this.setStatus(state, 'disconnected')
  }

  private async poll(state: PollState): Promise<void> {
    if (!this.polls.has(pollKey(state.contractId, state.network))) return

    try {
      const server = getSorobanServer(state.network)

      // First call: discover the latest ledger so we don't replay history.
      if (state.ledgerCursor === null) {
        const latest = await (server as unknown as { getLatestLedger: () => Promise<{ sequence: number }> })
          .getLatestLedger()
        state.ledgerCursor = latest.sequence
      }

      const startLedger = state.ledgerCursor

      const filters: Array<Record<string, unknown>> = [
        {
          type: 'contract',
          contractIds: [state.contractId],
          ...(state.topicFilters ? { topics: state.topicFilters } : {}),
        },
      ]

      type GetEventsResponse = {
        events?: Array<{ ledger: number; topic?: unknown; value?: unknown; contractId?: string }>
        latestLedger?: number
      }

      const response = (await (server as unknown as {
        getEvents: (req: {
          startLedger: number
          filters: Array<Record<string, unknown>>
          limit?: number
        }) => Promise<GetEventsResponse>
      }).getEvents({
        startLedger,
        filters,
        limit: 100,
      })) as GetEventsResponse

      state.consecutiveErrors = 0
      this.setStatus(state, 'connected')

      const events = response.events ?? []
      if (events.length > 0) {
        state.lastMessageAt = Date.now()
        for (const raw of events) {
          if (raw.ledger >= (state.ledgerCursor ?? 0)) {
            state.ledgerCursor = raw.ledger + 1
          }
          const event: ContractStreamEvent = {
            channel: 'events',
            contractId: state.contractId,
            network: state.network,
            ledger: raw.ledger,
            receivedAt: state.lastMessageAt,
            payload: raw as unknown as Record<string, unknown>,
          }
          for (const listener of state.listeners) {
            try {
              listener(event)
            } catch {
              /* swallow listener errors */
            }
          }
        }
      } else if (response.latestLedger) {
        // Advance cursor even when no events to keep the window tight.
        state.ledgerCursor = response.latestLedger
      }

      // Schedule next poll at the configured cadence.
      this.scheduleNext(state, state.pollIntervalMs)
    } catch (err) {
      state.consecutiveErrors++
      this.setStatus(state, 'reconnecting', String(err))

      // Exponential backoff for repeated failures.
      const delay = Math.min(
        state.pollIntervalMs * 2 ** state.consecutiveErrors,
        MAX_BACKOFF_MS,
      )
      this.scheduleNext(state, delay)
    }
  }

  private scheduleNext(state: PollState, delay: number): void {
    if (state.timer !== null) clearTimeout(state.timer)
    state.timer = setTimeout(() => {
      state.timer = null
      void this.poll(state)
    }, delay)
  }

  private setStatus(state: PollState, next: StreamStatus, error?: string): void {
    if (state.status === next && next !== 'connected') return
    state.status = next
    const change: StreamStatusChange = {
      status: next,
      attempt: state.consecutiveErrors,
      lastMessageAt: state.lastMessageAt,
      ...(error ? { error } : {}),
    }
    const key = pollKey(state.contractId, state.network)
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

export const contractStreamManager = new ContractStreamManager()
