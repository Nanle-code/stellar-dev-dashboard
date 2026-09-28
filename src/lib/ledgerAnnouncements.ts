/**
 * Live-region announcements for ledger and transaction stream updates (#872).
 *
 * Real-time account/transaction streams can emit several updates in a short
 * window. Reading each one aloud would overwhelm screen-reader users, so this
 * module detects the high-signal ledger/transaction notifications, coalesces
 * bursts into a single polite announcement, and never re-announces history.
 *
 * The logic is deliberately dependency-free and timer-injectable so it can be
 * unit-tested and used during SSR without touching `window`.
 */

import type { RealTimeNotification } from './websocket/StreamTypes'

/**
 * Titles produced by the ledger/transaction stream summariser
 * (`useAccountStream.summarizeEvent`). Only these are announced.
 */
export const LEDGER_UPDATE_TITLES: ReadonlySet<string> = new Set([
  'Incoming payment',
  'Outgoing payment',
  'Account credited',
  'Account debited',
  'Signer change',
  'New transaction',
])

/** Coalescing window (ms) before a pending batch is announced. */
export const DEFAULT_WINDOW_MS = 4000
/** Flush immediately once this many updates are pending. */
export const DEFAULT_MAX_BATCH = 5

/** Return true when `notification` is a ledger/transaction stream update. */
export function isLedgerUpdate(notification: unknown): boolean {
  if (!notification || typeof notification !== 'object') return false
  const title = (notification as { title?: unknown }).title
  return typeof title === 'string' && LEDGER_UPDATE_TITLES.has(title)
}

/** A concise, spoken phrase for a single update. */
export function describeLedgerUpdate(notification: RealTimeNotification): string {
  const title =
    typeof notification?.title === 'string' && notification.title.trim()
      ? notification.title.trim()
      : 'Ledger update'
  const message =
    typeof notification?.message === 'string' ? notification.message.trim() : ''
  return message ? `${title}: ${message}` : title
}

/**
 * Build one announcement summarising 1..N updates. Non-ledger entries are
 * ignored, and an empty (or entirely irrelevant) batch yields `''` so callers
 * can skip announcing. `updates[0]` is treated as the most recent.
 */
export function buildLedgerAnnouncement(
  updates: readonly RealTimeNotification[] | null | undefined,
): string {
  const valid = Array.isArray(updates) ? updates.filter(isLedgerUpdate) : []
  if (valid.length === 0) return ''
  if (valid.length === 1) {
    return `Ledger update. ${describeLedgerUpdate(valid[0])}.`
  }
  if (valid.length <= 3) {
    return `Ledger updates. ${valid.map(describeLedgerUpdate).join('; ')}.`
  }
  return `${valid.length} ledger updates. Latest: ${describeLedgerUpdate(valid[0])}.`
}

export interface LedgerAnnouncerOptions {
  /** Callback invoked with each coalesced announcement. */
  announce: (message: string) => void
  windowMs?: number
  maxBatch?: number
  /** Injectable timers (defaults to the global ones). */
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
}

export interface LedgerAnnouncer {
  /** Seed the seen-set with existing history so it is never announced. */
  prime(notifications: readonly RealTimeNotification[] | null | undefined): void
  /** Feed a fresh store snapshot; schedules a coalesced announcement. */
  observe(notifications: readonly RealTimeNotification[] | null | undefined): void
  /** Announce any pending batch immediately. */
  flush(): void
  /** Cancel pending work (e.g. on unmount). */
  dispose(): void
}

const MAX_PENDING = 50

/**
 * Create a coalescing announcer. It remembers every notification id it has
 * seen, so removals, reorders, or repeated snapshots never re-announce, and it
 * ignores the initial snapshot entirely.
 */
export function createLedgerAnnouncer(options: LedgerAnnouncerOptions): LedgerAnnouncer {
  const {
    announce,
    windowMs = DEFAULT_WINDOW_MS,
    maxBatch = DEFAULT_MAX_BATCH,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  } = options

  const seen = new Set<string>()
  let pending: RealTimeNotification[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let primed = false

  function safeAnnounce(message: string): void {
    if (!message) return
    try {
      announce(message)
    } catch {
      /* Announcing must never break the underlying stream. */
    }
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeoutFn(timer)
      timer = null
    }
  }

  function flush(): void {
    clearTimer()
    if (pending.length === 0) return
    const batch = pending
    pending = []
    safeAnnounce(buildLedgerAnnouncement(batch))
  }

  function schedule(): void {
    if (timer !== null) return
    timer = setTimeoutFn(() => {
      timer = null
      flush()
    }, windowMs)
  }

  function observe(notifications: readonly RealTimeNotification[] | null | undefined): void {
    if (!Array.isArray(notifications)) return
    const fresh = notifications.filter(
      (n) => n && typeof n.id === 'string' && !seen.has(n.id),
    )
    for (const n of fresh) seen.add(n.id)
    if (!primed) return // the first snapshot is history, not news

    const updates = fresh.filter(isLedgerUpdate)
    if (updates.length === 0) return

    pending = [...updates, ...pending].slice(0, MAX_PENDING)
    if (pending.length >= maxBatch) {
      flush()
    } else {
      schedule()
    }
  }

  function prime(notifications: readonly RealTimeNotification[] | null | undefined): void {
    if (Array.isArray(notifications)) {
      for (const n of notifications) {
        if (n && typeof n.id === 'string') seen.add(n.id)
      }
    }
    primed = true
  }

  function dispose(): void {
    clearTimer()
    pending = []
  }

  return { prime, observe, flush, dispose }
}
