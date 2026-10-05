/**
 * Shared transaction submission tracker.
 *
 * Stellar does not accept a transaction synchronously. `sendTransaction` and
 * Horizon's `/transactions_async` return immediately with a status such as
 * `PENDING`, `DUPLICATE`, `TRY_AGAIN_LATER`, or `ERROR`, and the outcome has to
 * be polled for. This module owns that lifecycle in one place so a submission
 * can be followed from "sent" to a terminal state, and so the UI can render the
 * progress in a tray that is not tied to the view that started it.
 *
 * It is deliberately framework-agnostic: no React, no timers of its own. The
 * clock and the delay function are injected, which is what makes the retry and
 * expiry behaviour testable without waiting in real time.
 */

import { STELLAR_ERROR_CODES } from './errorHandling/ErrorMessages'

/** Every state a submission can be in. */
export type SubmissionStatus =
  | 'SUBMITTING'
  | 'PENDING'
  | 'DUPLICATE'
  | 'TRY_AGAIN_LATER'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'

/** States from which no further transition happens. */
export const TERMINAL_STATUSES: ReadonlySet<SubmissionStatus> = new Set<SubmissionStatus>([
  'SUCCESS',
  'FAILED',
  'EXPIRED',
])

/**
 * Statuses the network can return.
 *
 * Wider than `SubmissionStatus` on purpose: `ERROR` and `DUPLICATE` are
 * transport-level answers that the tracker translates into a state it owns
 * (`FAILED` and `PENDING` respectively), so they never appear as a record's
 * status. Keeping them separate is what stops a caller from ever storing a
 * status the tray cannot render.
 */
export type NetworkStatus = SubmissionStatus | 'ERROR' | 'DUPLICATE'

/** A failure translated into something a person can act on. */
export interface DecodedSubmissionError {
  /** Raw code from the network, when one was supplied. */
  code?: string
  /** Plain-language description. */
  message: string
  /** What the user should do next. */
  suggestion: string
}

export interface SubmissionRecord {
  id: string
  /** Human label shown in the tray, e.g. "Send 25 USDC". */
  label: string
  status: SubmissionStatus
  /** Set once the network has accepted the transaction. */
  hash?: string
  createdAt: number
  updatedAt: number
  /** Number of status polls performed. */
  attempts: number
  /** Populated when `status` is `FAILED`. */
  error?: DecodedSubmissionError
  /** Set when the submission resolved `DUPLICATE`; polling continues. */
  duplicateOf?: string
}

export interface TrackerOptions {
  /** Injected clock. Defaults to `Date.now`. */
  now?: () => number
  /** Injected delay. Defaults to `setTimeout`; tests pass a no-op. */
  sleep?: (_ms: number) => Promise<void>
  /** First backoff delay after `TRY_AGAIN_LATER`, in ms. */
  baseBackoffMs?: number
  /** Upper bound for the backoff, in ms. */
  maxBackoffMs?: number
  /** How long a submission may stay non-terminal before it expires. */
  expiryMs?: number
  /** Upper bound on polls, guarding against a never-finalising transaction. */
  maxAttempts?: number
}

export interface StatusUpdate {
  status: NetworkStatus
  hash?: string
  resultCode?: string
  errorCodes?: string[]
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Copy a record, including the nested error.
 *
 * A shallow spread is not enough: `error` is an object, and without this a caller
 * could mutate the error the tracker is holding.
 */
function copyRecord(record: SubmissionRecord): SubmissionRecord {
  return { ...record, ...(record.error ? { error: { ...record.error } } : {}) }
}

/**
 * Extra guidance for the result codes that are most often hit in practice.
 *
 * `STELLAR_ERROR_CODES` already provides a description for most codes; this adds
 * the actionable half, which the shared map deliberately does not carry because
 * it has no per-code context.
 */
const CODE_SUGGESTIONS: Record<string, string> = {
  tx_bad_seq: 'Reload the account to pick up the latest sequence number, then resubmit.',
  tx_bad_auth: 'Reconnect your wallet and sign again — the signing key may have changed.',
  tx_insufficient_balance: 'Top up the account, or reduce the amount and the fee.',
  tx_insufficient_fee: 'Raise the base fee and resubmit; the network fee floor may have moved.',
  tx_no_account: 'Fund and create the source account on this network first.',
  op_no_destination: 'Check the destination account id — it does not exist on this network.',
  op_underfunded: 'The account cannot cover amount plus fee. Lower the amount or add funds.',
  op_no_trust: 'The destination has no trustline for this asset.',
  tx_too_early: 'Wait for the previous transaction in your sequence to be validated.',
  tx_too_late: 'The sequence number is too old. Reload the account and resubmit.',
  tx_malformed: 'The transaction could not be parsed. Rebuild it rather than resubmitting as-is.',
}

/** Decode a network result code into a message plus a concrete next step. */
export function decodeSubmissionError(
  resultCode?: string,
  errorCodes: string[] = [],
): DecodedSubmissionError {
  // A transaction can carry several failed operations; the first is the one that
  // actually stopped it, and the rest are usually consequences of it.
  const code = resultCode ?? errorCodes[0]

  if (!code) {
    return {
      message: 'The transaction failed without a result code.',
      suggestion: 'Retry the transaction. If it keeps failing, capture the hash and check it on a block explorer.',
    }
  }

  const message = STELLAR_ERROR_CODES[code]

  if (message) {
    return { code, message, suggestion: CODE_SUGGESTIONS[code] ?? 'Review the details and retry.' }
  }

  return {
    code,
    message: `The transaction failed with result code ${code}.`,
    suggestion: 'Look up this result code in the Stellar documentation before retrying.',
  }
}

/** Subscribe to every state change. Returns an unsubscribe function. */
export type TrackerListener = (_records: SubmissionRecord[]) => void

export class SubmissionTracker {
  private readonly options: Required<TrackerOptions>
  private readonly records = new Map<string, SubmissionRecord>()
  private readonly listeners = new Set<TrackerListener>()
  private sequence = 0

  constructor(options: TrackerOptions = {}) {
    this.options = {
      now: options.now ?? (() => Date.now()),
      sleep: options.sleep ?? defaultSleep,
      baseBackoffMs: options.baseBackoffMs ?? 500,
      maxBackoffMs: options.maxBackoffMs ?? 8_000,
      expiryMs: options.expiryMs ?? 60_000,
      maxAttempts: options.maxAttempts ?? 120,
    }
  }

  /**
   * Current records, oldest first.
   *
   * Each record is copied, including its nested `error`, so a consumer cannot
   * reach back into tracker state and rewrite a status.
   */
  list(): SubmissionRecord[] {
    return [...this.records.values()]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(copyRecord)
  }

  get(id: string): SubmissionRecord | undefined {
    const record = this.records.get(id)
    return record ? copyRecord(record) : undefined
  }

  subscribe(listener: TrackerListener): () => void {
    this.listeners.add(listener)
    // Emit immediately so a late subscriber is not rendered with an empty tray
    // while submissions are already in flight.
    listener(this.list())
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Register a submission. It starts in `SUBMITTING`. */
  track(label: string, hash?: string): SubmissionRecord {
    const timestamp = this.options.now()
    this.sequence += 1
    const id = `sub-${this.sequence}-${timestamp}`

    const record: SubmissionRecord = {
      id,
      label,
      status: hash ? 'PENDING' : 'SUBMITTING',
      createdAt: timestamp,
      updatedAt: timestamp,
      attempts: 0,
      ...(hash ? { hash } : {}),
    }

    this.records.set(id, record)
    this.emit()
    return copyRecord(record)
  }

  /**
   * Record the network's acceptance of a submission.
   *
   * `status` is the value the network returned: `PENDING`, `DUPLICATE`, or
   * `ERROR`. A returned `DUPLICATE` is not a failure — the transaction is
   * already in the mempool, so polling continues to find the same outcome.
   */
  attach(id: string, update: StatusUpdate): SubmissionRecord | undefined {
    const record = this.records.get(id)
    if (!record) return undefined

    if (TERMINAL_STATUSES.has(record.status)) return copyRecord(record)

    const next: SubmissionRecord = {
      ...record,
      hash: update.hash ?? record.hash,
      updatedAt: this.options.now(),
    }

    if (update.status === 'DUPLICATE') {
      // Keep polling: the duplicate reference tells us it landed, not that it
      // finished.
      next.status = 'PENDING'
      if (update.hash) next.duplicateOf = update.hash
    } else if (update.status === 'ERROR') {
      next.status = 'FAILED'
      next.error = decodeSubmissionError(update.resultCode, update.errorCodes)
    } else {
      next.status = update.status
    }

    this.records.set(id, next)
    this.emit()
    return copyRecord(next)
  }

  /** Record a poll result. Returns the delay before the next poll, or null. */
  poll(id: string, update: StatusUpdate): number | null {
    const record = this.records.get(id)
    if (!record) return null
    if (TERMINAL_STATUSES.has(record.status)) return null

    const now = this.options.now()
    const next: SubmissionRecord = {
      ...record,
      hash: update.hash ?? record.hash,
      attempts: record.attempts + 1,
      updatedAt: now,
    }

    if (update.status === 'SUCCESS') {
      next.status = 'SUCCESS'
      this.records.set(id, next)
      this.emit()
      return null
    }

    if (update.status === 'ERROR') {
      next.status = 'FAILED'
      next.error = decodeSubmissionError(update.resultCode, update.errorCodes)
      this.records.set(id, next)
      this.emit()
      return null
    }

    // Expiry is checked before scheduling more work: a transaction that is still
    // pending past its deadline should say so rather than poll forever.
    if (now - next.createdAt >= this.options.expiryMs) {
      next.status = 'EXPIRED'
      next.error = {
        message: `The transaction was still ${update.status} after ${Math.round(
          this.options.expiryMs / 1000,
        )}s.`,
        suggestion:
          'It may still finalise. Check the hash on a block explorer before resubmitting, to avoid sending it twice.',
      }
      this.records.set(id, next)
      this.emit()
      return null
    }

    if (next.attempts >= this.options.maxAttempts) {
      next.status = 'EXPIRED'
      next.error = {
        message: `Gave up after ${next.attempts} status checks.`,
        suggestion: 'Check the hash on a block explorer to see the final outcome.',
      }
      this.records.set(id, next)
      this.emit()
      return null
    }

    if (update.status === 'TRY_AGAIN_LATER') {
      next.status = 'TRY_AGAIN_LATER'
      // Exponential backoff: the network is asking us to slow down, so the wait
      // doubles each time up to a ceiling.
      const backoff = Math.min(
        this.options.baseBackoffMs * 2 ** (next.attempts - 1),
        this.options.maxBackoffMs,
      )
      this.records.set(id, next)
      this.emit()
      return backoff
    }

    next.status = update.status
    this.records.set(id, next)
    this.emit()
    return this.options.baseBackoffMs
  }

  /** Backoff for a poll count, exposed for tests and for callers polling by hand. */
  backoffFor(attempts: number): number {
    return Math.min(
      this.options.baseBackoffMs * 2 ** Math.max(0, attempts - 1),
      this.options.maxBackoffMs,
    )
  }

  /** Drive polling to completion, using the injected clock and sleep. */
  async follow(
    id: string,
    fetchStatus: (_hash: string) => Promise<StatusUpdate>,
  ): Promise<SubmissionRecord | undefined> {
    let delay: number | null = this.options.baseBackoffMs

    while (delay !== null) {
      const record = this.records.get(id)
      if (!record?.hash) return record ? copyRecord(record) : undefined

      // In real use this is the wait between polls; in tests `sleep` is a no-op
      // and `now` is driven manually.
      await this.options.sleep(delay)

      let update: StatusUpdate
      try {
        update = await fetchStatus(record.hash)
      } catch {
        // A failed poll is not a failed transaction. Back off and try again,
        // letting the expiry check decide when to give up.
        update = { status: 'PENDING' }
      }

      delay = this.poll(id, update)
    }

    const finalRecord = this.records.get(id)
    return finalRecord ? copyRecord(finalRecord) : undefined
  }

  /** Remove terminal records, e.g. when the user dismisses the tray. */
  clearTerminal(): void {
    for (const [id, record] of this.records) {
      if (TERMINAL_STATUSES.has(record.status)) this.records.delete(id)
    }
    this.emit()
  }

  private emit(): void {
    const snapshot = this.list()
    for (const listener of this.listeners) listener(snapshot)
  }
}

/**
 * Process-wide tracker.
 *
 * Deliberately a module singleton: a submission must keep being observed after
 * the view that started it unmounts, which is what a tray that "survives view
 * changes" requires.
 */
export const submissionTracker = new SubmissionTracker()
