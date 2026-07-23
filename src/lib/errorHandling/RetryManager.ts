/**
 * RetryManager.ts — Issue #144
 * Exponential backoff retry logic for API calls.
 */

import { createLogger } from '../../utils/logger'

const logger = createLogger('RetryManager')

export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  jitter?: boolean
  onRetry?: (attempt: number, error: unknown) => void
}

export class RetryManager {
  private maxRetries: number
  private baseDelay: number
  private maxDelay: number
  private jitter: boolean

  constructor(options: RetryOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3
    this.baseDelay = options.baseDelay ?? 1000
    this.maxDelay = options.maxDelay ?? 30_000
    this.jitter = options.jitter ?? true
  }

  /**
   * Execute an operation with exponential backoff retry.
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? this.maxRetries
    const baseDelay = options.baseDelay ?? this.baseDelay
    let lastError: unknown

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error

        if (attempt === maxRetries || !this.isRetryable(error)) {
          throw error
        }

        const delay = this.calculateDelay(attempt, baseDelay)
        logger.warn(`Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms`, {
          error: error instanceof Error ? error.message : String(error),
        })

        options.onRetry?.(attempt, error)
        await this.sleep(delay)
      }
    }

    throw lastError
  }

  private calculateDelay(attempt: number, baseDelay: number): number {
    const exponential = baseDelay * Math.pow(2, attempt - 1)
    const capped = Math.min(exponential, this.maxDelay)
    if (!this.jitter) return capped
    return capped * (0.9 + Math.random() * 0.2) // ±10% jitter
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch')) return true
    }
    // HTTP status codes that are retryable
    const status = (error as any)?.response?.status ?? (error as any)?.status
    if (status) return [408, 429, 500, 502, 503, 504].includes(status)
    return true
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Singleton instance
export const retryManager = new RetryManager()

// ─── OfflineQueue ─────────────────────────────────────────────────────────────

/**
 * OfflineQueue — typed wrapper around src/utils/offline.js for Horizon writes.
 *
 * Usage:
 *   offlineQueue.enqueue('simulate:abc', () => simulateTx(xdr), 'Simulate TX')
 *
 * When the network comes back the queue is flushed automatically (via the
 * 'online' event in offline.js). Callers can also call flush() manually.
 */

export interface OfflineQueueEntry {
  id: string
  label: string
  priority: number
}

export class OfflineQueue {
  private entries: Map<string, OfflineQueueEntry & { fn: () => Promise<unknown> }> = new Map()
  private listeners: Array<(entries: OfflineQueueEntry[]) => void> = []

  /**
   * Add an operation to the queue.
   * If the app is online the operation runs immediately via RetryManager.
   * If offline it is stored for later replay.
   *
   * @param id       Stable identifier — duplicate ids replace previous entry
   * @param fn       Async function to execute
   * @param label    Human-readable label shown in UI
   * @param priority Higher priority runs first (default 0)
   */
  async enqueue(
    id: string,
    fn: () => Promise<unknown>,
    label = '',
    priority = 0,
  ): Promise<void> {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true

    if (online) {
      // Online — execute immediately with retry
      await retryManager.executeWithRetry(fn, {
        maxRetries: 3,
        onRetry: (attempt, err) => {
          logger.warn(`Retry ${attempt} for "${id}": ${err}`)
        },
      })
      return
    }

    // Offline — persist
    this.entries.set(id, { id, fn, label, priority })
    this.notifyListeners()
    logger.info(`[OfflineQueue] Queued "${id}" (offline)`)

    // Also write to IDB so the entry survives a reload
    try {
      const { enqueueOfflineOp } = await import('../storage.js')
      await enqueueOfflineOp({ id, label, priority })
    } catch { /* IDB may not be available in tests */ }
  }

  /** Remove a queued entry without executing it. */
  cancel(id: string): void {
    this.entries.delete(id)
    this.notifyListeners()
  }

  /** Number of pending entries. */
  get size(): number {
    return this.entries.size
  }

  /** Snapshot of pending entries (safe to render). */
  getEntries(): OfflineQueueEntry[] {
    return [...this.entries.values()].map(({ id, label, priority }) => ({
      id,
      label,
      priority,
    }))
  }

  /**
   * Attempt to flush all queued operations.
   * Called automatically by offline.js when the network comes back online.
   */
  async flush(): Promise<void> {
    if (this.entries.size === 0) return

    logger.info(`[OfflineQueue] Flushing ${this.entries.size} queued operations`)

    const sorted = [...this.entries.values()].sort((a, b) => b.priority - a.priority)

    for (const entry of sorted) {
      try {
        await retryManager.executeWithRetry(entry.fn, {
          maxRetries: 3,
          onRetry: (attempt, err) => {
            logger.warn(`Retry ${attempt} for queued op "${entry.id}": ${err}`)
          },
        })
        this.entries.delete(entry.id)
        logger.info(`[OfflineQueue] Replayed "${entry.id}"`)
      } catch (err) {
        logger.error(`[OfflineQueue] Failed to replay "${entry.id}"`, {}, err as Error)
      }
    }

    this.notifyListeners()
  }

  /**
   * Subscribe to queue changes (e.g. to show a pending-ops badge).
   * @returns unsubscribe function
   */
  subscribe(cb: (entries: OfflineQueueEntry[]) => void): () => void {
    this.listeners.push(cb)
    return () => { this.listeners = this.listeners.filter(l => l !== cb) }
  }

  private notifyListeners(): void {
    const snapshot = this.getEntries()
    this.listeners.forEach(cb => { try { cb(snapshot) } catch { /* ignore */ } })
  }
}

/** Singleton — import this wherever you need to queue Horizon writes. */
export const offlineQueue = new OfflineQueue()
