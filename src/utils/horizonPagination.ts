/**
 * Horizon Pagination Helper — Issue #913
 *
 * Reusable pagination wrapper for Stellar Horizon list endpoints (transactions,
 * operations, payments, ledgers, offers, ...). Tracks a `paging_token` cursor
 * checkpoint across pages so long-running iterations can be persisted and
 * resumed later (e.g. across page reloads or background job restarts), and
 * retries transient Horizon failures (429 / 5xx) with exponential backoff.
 *
 * The helper is transport-agnostic: callers supply a `fetchPage` function that
 * performs the actual Horizon request (typically a `@stellar/stellar-sdk`
 * CallBuilder, e.g. `server.transactions().forAccount(id)`), which keeps this
 * module easy to unit test and reusable across every paginated Horizon
 * resource.
 */

import { RetryManager, type RetryOptions } from '../lib/errorHandling/RetryManager'

export type PageOrder = 'asc' | 'desc'

export interface HorizonRecord {
  paging_token: string
  [key: string]: unknown
}

export interface FetchPageParams {
  cursor: string | null
  limit: number
  order: PageOrder
}

export interface FetchPageResult<T extends HorizonRecord = HorizonRecord> {
  records: T[]
}

export type HorizonPageFetcher<T extends HorizonRecord = HorizonRecord> = (
  params: FetchPageParams,
) => Promise<FetchPageResult<T>>

export interface HorizonPaginatorOptions {
  limit?: number
  order?: PageOrder
  /** Cursor checkpoint to resume from, e.g. one previously read via getCursor(). */
  initialCursor?: string | null
  /** When provided, validated as a well-formed Horizon endpoint before use. */
  horizonUrl?: string
  /** Restrict horizonUrl to a known set of hosts (e.g. your own Horizon nodes). */
  allowedHosts?: string[]
  retry?: RetryOptions
}

export interface PaginationState {
  cursor: string | null
  order: PageOrder
  limit: number
  pageCount: number
  recordCount: number
  done: boolean
}

const MIN_LIMIT = 1
const MAX_LIMIT = 200
const DEFAULT_LIMIT = 10

// Horizon paging tokens are numeric TOIDs (e.g. "12884901888"), the literal
// "now" (streaming cursor), or opaque alphanumeric tokens for other resources.
const CURSOR_PATTERN = /^(now|[A-Za-z0-9_-]{1,64})$/

/** True if `cursor` is a syntactically valid Horizon paging token. */
export function isValidCursor(cursor: unknown): cursor is string {
  return typeof cursor === 'string' && CURSOR_PATTERN.test(cursor)
}

/** Validates a cursor, returning it (or null) if valid and throwing otherwise. */
export function validateCursor(cursor: string | null | undefined): string | null {
  if (cursor === null || cursor === undefined) return null
  if (!isValidCursor(cursor)) {
    throw new Error(`Invalid Horizon cursor: ${JSON.stringify(cursor)}`)
  }
  return cursor
}

/** Validates that `url` is a well-formed, non-downgraded Horizon endpoint. */
export function validateHorizonUrl(url: string, allowedHosts?: string[]): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid Horizon URL: ${JSON.stringify(url)}`)
  }

  const isLocalHttp =
    parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  if (parsed.protocol !== 'https:' && !isLocalHttp) {
    throw new Error(`Horizon URL must use https (got "${parsed.protocol}"): ${url}`)
  }

  if (allowedHosts && allowedHosts.length > 0 && !allowedHosts.includes(parsed.hostname)) {
    throw new Error(`Horizon URL host "${parsed.hostname}" is not in the allowed host list`)
  }
}

/**
 * Iterates a paginated Horizon resource, exposing a resumable cursor
 * checkpoint (`getCursor()` / `resumeFromCursor()`) and retrying transient
 * failures via `RetryManager`. On retry exhaustion the last successfully
 * seen cursor is left untouched so callers can safely retry or resume later.
 */
export class HorizonPaginator<T extends HorizonRecord = HorizonRecord> {
  private readonly fetchPage: HorizonPageFetcher<T>
  private readonly limit: number
  private readonly order: PageOrder
  private readonly retryManager: RetryManager
  private cursor: string | null
  private done = false
  private pageCount = 0
  private recordCount = 0

  constructor(fetchPage: HorizonPageFetcher<T>, options: HorizonPaginatorOptions = {}) {
    this.fetchPage = fetchPage

    this.limit = options.limit ?? DEFAULT_LIMIT
    if (!Number.isInteger(this.limit) || this.limit < MIN_LIMIT || this.limit > MAX_LIMIT) {
      throw new Error(`Horizon page limit must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}, got ${options.limit}`)
    }

    this.order = options.order ?? 'asc'
    if (this.order !== 'asc' && this.order !== 'desc') {
      throw new Error(`Invalid page order: ${JSON.stringify(options.order)}`)
    }

    if (options.horizonUrl) {
      validateHorizonUrl(options.horizonUrl, options.allowedHosts)
    }

    this.cursor = validateCursor(options.initialCursor ?? null)
    this.retryManager = new RetryManager(options.retry)
  }

  /** Cursor for the last record seen — persist this to resume later. */
  getCursor(): string | null {
    return this.cursor
  }

  isDone(): boolean {
    return this.done
  }

  getState(): PaginationState {
    return {
      cursor: this.cursor,
      order: this.order,
      limit: this.limit,
      pageCount: this.pageCount,
      recordCount: this.recordCount,
      done: this.done,
    }
  }

  /** Resume iteration from a previously saved cursor checkpoint. */
  resumeFromCursor(cursor: string): void {
    this.cursor = validateCursor(cursor)
    this.done = false
  }

  /**
   * Fetch the next page. Transient failures (429 / 5xx / network errors) are
   * retried with exponential backoff; if retries are exhausted the error is
   * surfaced to the caller and the cursor checkpoint remains at its last
   * known-good value.
   */
  async nextPage(): Promise<T[]> {
    if (this.done) return []

    const page = await this.retryManager.executeWithRetry(() =>
      this.fetchPage({ cursor: this.cursor, limit: this.limit, order: this.order }),
    )

    const records = page?.records ?? []
    if (records.length === 0) {
      this.done = true
      return []
    }

    const lastRecord = records[records.length - 1]
    this.cursor = validateCursor(lastRecord.paging_token)
    this.pageCount += 1
    this.recordCount += records.length
    if (records.length < this.limit) {
      this.done = true
    }

    return records
  }

  /** Stream every remaining record, page by page, until the collection ends. */
  async *stream(): AsyncGenerator<T, void, void> {
    while (!this.done) {
      const records = await this.nextPage()
      for (const record of records) {
        yield record
      }
    }
  }

  /** Convenience: collect up to `maxRecords` records (default: all remaining). */
  async collect(maxRecords: number = Infinity): Promise<T[]> {
    const out: T[] = []
    for await (const record of this.stream()) {
      out.push(record)
      if (out.length >= maxRecords) break
    }
    return out
  }
}

export function createHorizonPaginator<T extends HorizonRecord = HorizonRecord>(
  fetchPage: HorizonPageFetcher<T>,
  options?: HorizonPaginatorOptions,
): HorizonPaginator<T> {
  return new HorizonPaginator(fetchPage, options)
}
