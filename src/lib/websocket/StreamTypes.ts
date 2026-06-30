/**
 * Shared types for the real-time streaming layer.
 *
 * Note: Stellar Horizon exposes account/transaction streams over Server-Sent
 * Events (SSE), not raw WebSockets — but the consumer-facing API in this
 * module follows the WebSocket-style "subscribe / unsubscribe / status"
 * model so it reads naturally from React components.
 */

import type { Horizon } from '@stellar/stellar-sdk'
import type { NetworkName } from '../stellar'

// ─── Status ────────────────────────────────────────────────────────────────────

export type StreamStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'disconnected'

export interface StreamStatusChange {
  status: StreamStatus
  error?: string
  /** Number of reconnect attempts so far. Reset to 0 on success. */
  attempt: number
  /** ms timestamp of the last successful message. */
  lastMessageAt?: number
}

// ─── Channels (what kind of update is this?) ──────────────────────────────────

export type AccountStreamChannel =
  | 'effects'
  | 'payments'
  | 'operations'
  | 'transactions'

export type ContractStreamChannel = 'events' | 'state'

// ─── Account events ───────────────────────────────────────────────────────────

export interface AccountStreamEvent<T = unknown> {
  channel: AccountStreamChannel
  accountId: string
  network: NetworkName
  /** Cursor / paging token for the underlying record. */
  pagingToken: string
  /** ms timestamp the event was received locally. */
  receivedAt: number
  /** Raw record from Horizon (effect, payment, operation, transaction). */
  record: T
}

export type EffectRecord = Horizon.ServerApi.EffectRecord
export type PaymentRecord = Horizon.ServerApi.PaymentOperationRecord
export type OperationRecord = Horizon.ServerApi.OperationRecord
export type TransactionRecord = Horizon.ServerApi.TransactionRecord

export type AccountStreamPayload =
  | AccountStreamEvent<EffectRecord>
  | AccountStreamEvent<PaymentRecord>
  | AccountStreamEvent<OperationRecord>
  | AccountStreamEvent<TransactionRecord>

// ─── Contract events ──────────────────────────────────────────────────────────

export interface ContractStreamEvent {
  channel: ContractStreamChannel
  contractId: string
  network: NetworkName
  ledger: number
  receivedAt: number
  /** Raw event/state record from Soroban RPC. */
  payload: Record<string, unknown>
}

// ─── Subscription handles ─────────────────────────────────────────────────────

export type StreamUnsubscribe = () => void

export interface AccountSubscriptionOptions {
  channels?: AccountStreamChannel[]
  /** Which paging token to start from. Defaults to 'now'. */
  cursor?: string
  /** Optional callback for connection state changes scoped to this account. */
  onStatusChange?: (change: StreamStatusChange) => void
}

export interface ContractSubscriptionOptions {
  /** ms between Soroban event polls. Defaults to 4000. */
  pollIntervalMs?: number
  /** Topic filters passed straight through to Soroban getEvents. */
  topicFilters?: Array<Array<string>>
  onStatusChange?: (change: StreamStatusChange) => void
}

// ─── Notifications (consumer-facing summary) ──────────────────────────────────

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface RealTimeNotification {
  id: string
  level: NotificationLevel
  title: string
  message: string
  /** ms timestamp. */
  timestamp: number
  /** Optional source — e.g. account id, contract id. */
  source?: string
  /** Original payload for callers that want to drill in. */
  payload?: unknown
  /** Whether the user has dismissed/seen it. */
  read: boolean
}
