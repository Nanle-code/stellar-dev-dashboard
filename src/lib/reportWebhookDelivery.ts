/**
 * Scheduled Report Delivery via Authenticated Webhook Endpoints (#869)
 * ====================================================================
 * Delivers scheduled analytics summaries to user-registered webhook endpoints
 * with authenticated requests (HMAC-SHA256 signature or Bearer token),
 * bounded retries, and a per-delivery audit log.
 *
 * Complements the existing report scheduling in `customReports.ts` (which
 * models schedules and delivery *plans*) with the actual authenticated
 * delivery *transport* for the webhook channel.
 *
 * Security notes (see docs/features/webhook-signatures.md):
 *  - Payloads are signed with HMAC-SHA256 using the documented
 *    `t=<unix-seconds>,v1=<hex-hmac>` header format over `${timestamp}.${rawBody}`.
 *  - Only HTTPS endpoints are accepted unless `allowInsecure` is explicitly
 *    set (localhost development only).
 *  - Delivery failures never throw to the scheduler loop; they are recorded
 *    in the delivery log so one bad endpoint cannot stall other schedules.
 *
 * @see src/lib/customReports.ts — schedule + delivery plan modelling
 * @see docs/features/webhook-signatures.md — signature verification guide
 */

import type { TransformedReportData } from './customReports'

// ─── Errors ──────────────────────────────────────────────────────────────────

export type WebhookDeliveryErrorCode =
  | 'invalid_input'
  | 'unsupported_environment'
  | 'delivery_failed'

export class WebhookDeliveryError extends Error {
  readonly code: WebhookDeliveryErrorCode
  readonly status?: number

  constructor(code: WebhookDeliveryErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'WebhookDeliveryError'
    this.code = code
    this.status = status
  }
}

// ─── Endpoint configuration ──────────────────────────────────────────────────

export interface ReportWebhookEndpointInput {
  url: string
  /** HMAC-SHA256 signing secret (preferred). Mutually exclusive semantics with bearerToken: secret wins. */
  secret?: string
  /** Bearer token sent as `Authorization: Bearer <token>` when no secret is configured. */
  bearerToken?: string
  headers?: Record<string, string>
  /** Allow http:// (localhost development only). Default false. */
  allowInsecure?: boolean
}

export interface ReportWebhookEndpoint extends Required<Omit<ReportWebhookEndpointInput, 'secret' | 'bearerToken' | 'allowInsecure'>> {
  id: string
  secret?: string
  bearerToken?: string
  allowInsecure: boolean
}

export const DEFAULT_MAX_ATTEMPTS = 3
export const DEFAULT_TIMEOUT_MS = 10_000
/** Exponential backoff base between attempts. */
export const BACKOFF_BASE_MS = 1_000

const WEBHOOK_ID_PREFIX = 'wh_'

let endpointCounter = 0

/** Validate a webhook URL. HTTPS required unless explicitly allowed. */
export function validateWebhookUrl(url: string, allowInsecure = false): string {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new WebhookDeliveryError('invalid_input', 'Webhook URL is required')
  }
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new WebhookDeliveryError('invalid_input', `Webhook URL is not a valid URL: ${url}`)
  }
  if (parsed.protocol !== 'https:' && !(allowInsecure && parsed.protocol === 'http:')) {
    throw new WebhookDeliveryError(
      'invalid_input',
      `Webhook endpoints must use HTTPS${allowInsecure ? '' : ' (or pass allowInsecure for local development)'}: ${parsed.protocol}`,
    )
  }
  return parsed.toString()
}

/** Create a validated endpoint configuration with generated id and defaults. */
export function createWebhookEndpoint(input: ReportWebhookEndpointInput): ReportWebhookEndpoint {
  if (!input || typeof input !== 'object') {
    throw new WebhookDeliveryError('invalid_input', 'Endpoint configuration must be an object')
  }
  const url = validateWebhookUrl(input.url, input.allowInsecure === true)
  if (input.secret != null && typeof input.secret !== 'string') {
    throw new WebhookDeliveryError('invalid_input', 'Webhook secret must be a string')
  }
  if (input.secret == null && input.bearerToken != null && typeof input.bearerToken !== 'string') {
    throw new WebhookDeliveryError('invalid_input', 'Webhook bearer token must be a string')
  }
  if (input.headers != null && (typeof input.headers !== 'object' || Array.isArray(input.headers))) {
    throw new WebhookDeliveryError('invalid_input', 'Webhook headers must be an object of string values')
  }

  endpointCounter += 1
  return {
    id: `${WEBHOOK_ID_PREFIX}${Date.now().toString(36)}_${endpointCounter}`,
    url,
    secret: input.secret,
    bearerToken: input.bearerToken,
    headers: { ...(input.headers ?? {}) },
    allowInsecure: input.allowInsecure === true,
  }
}

// ─── Payload building ────────────────────────────────────────────────────────

export interface ReportWebhookPayload {
  event: 'report.published'
  reportId: string
  generatedAt: string
  summary?: string
  metrics: Array<{ label: string; value: string | number }>
  insights: string[]
  dashboardUrl?: string
}

/** Build the analytics-summary payload sent to webhook endpoints. */
export function buildReportWebhookPayload(
  report: TransformedReportData,
  options: { dashboardUrl?: string } = {},
): ReportWebhookPayload {
  if (!report || typeof report !== 'object' || !report.templateId) {
    throw new WebhookDeliveryError('invalid_input', 'A transformed report with a templateId is required')
  }
  return {
    event: 'report.published',
    reportId: report.templateId,
    generatedAt: report.generatedAt || new Date().toISOString(),
    summary: report.summary,
    metrics: Array.isArray(report.metrics) ? report.metrics : [],
    insights: Array.isArray(report.insights) ? report.insights : [],
    dashboardUrl: options.dashboardUrl,
  }
}

// ─── HMAC signing (t=...,v1=... format) ──────────────────────────────────────

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Sign a raw body with HMAC-SHA256 using the documented header format:
 * `t=<unix-seconds>,v1=<hex-hmac>` over `${timestamp}.${rawBody}`.
 * Throws `unsupported_environment` when Web Crypto is unavailable.
 */
export async function signReportPayload(
  rawBody: string,
  secret: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new WebhookDeliveryError(
      'unsupported_environment',
      'Web Crypto (crypto.subtle) is required to sign webhook payloads but is unavailable in this environment',
    )
  }
  const key = await importHmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestampSeconds}.${rawBody}`))
  return `t=${timestampSeconds},v1=${toHex(signature)}`
}

// ─── Delivery with retries ───────────────────────────────────────────────────

export interface DeliveryAttempt {
  attempt: number
  ok: boolean
  status?: number
  error?: string
  durationMs: number
  at: string
}

export interface DeliveryLogEntry {
  id: string
  endpointId: string
  endpointUrl: string
  reportId: string
  at: string
  success: boolean
  signed: boolean
  payloadBytes: number
  attempts: DeliveryAttempt[]
}

export interface DeliverReportOptions {
  maxAttempts?: number
  timeoutMs?: number
  /** Overrides the default exponential backoff sleep (tests pass 0). */
  sleep?: (_ms: number) => Promise<void>
  now?: () => number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function backoffDelay(attempt: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), 30_000)
}

/**
 * Deliver one report payload to one endpoint with authentication and bounded
 * retries. Throws only for invalid input or unsupported environments; network
 * and HTTP failures are returned as a failed DeliveryLogEntry.
 */
export async function deliverReportToWebhook(
  endpoint: ReportWebhookEndpoint,
  payload: ReportWebhookPayload,
  options: DeliverReportOptions = {},
): Promise<DeliveryLogEntry> {
  if (!endpoint || typeof endpoint !== 'object' || typeof endpoint.url !== 'string') {
    throw new WebhookDeliveryError('invalid_input', 'A webhook endpoint with a url is required')
  }
  if (!payload || typeof payload !== 'object') {
    throw new WebhookDeliveryError('invalid_input', 'A report payload is required')
  }
  if (typeof fetch === 'undefined') {
    throw new WebhookDeliveryError(
      'unsupported_environment',
      'fetch is required for webhook delivery but is unavailable in this environment',
    )
  }

  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 10))
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const sleep = options.sleep ?? defaultSleep
  const now = options.now ?? (() => Date.now())

  const rawBody = JSON.stringify(payload)
  const useSecret = typeof endpoint.secret === 'string' && endpoint.secret.length > 0
  const signature = useSecret
    ? await signReportPayload(rawBody, endpoint.secret as string, Math.floor(now() / 1000))
    : null

  const attempts: DeliveryAttempt[] = []

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = now()
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...endpoint.headers,
      }
      if (signature) {
        headers['X-Webhook-Signature'] = signature
      } else if (endpoint.bearerToken) {
        headers['Authorization'] = `Bearer ${endpoint.bearerToken}`
      }

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: rawBody,
        signal: AbortSignal.timeout(timeoutMs),
      })

      const durationMs = now() - startedAt
      const ok = response.ok
      attempts.push({
        attempt,
        ok,
        status: response.status,
        error: ok ? undefined : `Endpoint responded with HTTP ${response.status}`,
        durationMs,
        at: new Date(startedAt).toISOString(),
      })

      if (ok) {
        return finish(attempts, true)
      }
    } catch (err) {
      const durationMs = now() - startedAt
      attempts.push({
        attempt,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs,
        at: new Date(startedAt).toISOString(),
      })
    }

    if (attempt < maxAttempts) {
      await sleep(backoffDelay(attempt))
    }
  }

  return finish(attempts, false)

  function finish(attemptsOut: DeliveryAttempt[], success: boolean): DeliveryLogEntry {
    return {
      id: `dlv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      endpointId: endpoint.id,
      endpointUrl: endpoint.url,
      reportId: payload.reportId,
      at: new Date(now()).toISOString(),
      success,
      signed: Boolean(signature),
      payloadBytes: rawBody.length,
      attempts: attemptsOut,
    }
  }
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

export interface ReportDeliverySchedule {
  id: string
  endpointId: string
  reportId: string
  /** Interval between deliveries in milliseconds (min 60_000). */
  intervalMs: number
  enabled: boolean
  lastRunAt?: string
  nextRunAt: number
}

export interface DeliveryDriver {
  /** Fetch the transformed report to deliver for a reportId. */
  getReport: (_reportId: string) => Promise<TransformedReportData>
  /** Registered webhook endpoints by id. */
  getEndpoint: (_endpointId: string) => ReportWebhookEndpoint | undefined
}

export interface SchedulerOptions extends DeliverReportOptions {
  /** Minimum allowed schedule interval (default 1 minute). */
  minIntervalMs?: number
}

export const MIN_SCHEDULE_INTERVAL_MS = 60_000

/**
 * Interval-based scheduler that delivers due report summaries to registered
 * webhook endpoints. Purely driven by explicit `runDue(now)` calls so it is
 * deterministic and testable; the UI can tick it on an interval.
 */
export class ReportDeliveryScheduler {
  private schedules: ReportDeliverySchedule[] = []
  private log: DeliveryLogEntry[] = []
  private readonly driver: DeliveryDriver
  private readonly options: SchedulerOptions

  constructor(driver: DeliveryDriver, options: SchedulerOptions = {}) {
    this.driver = driver
    this.options = options
  }

  /** Register (or replace) a schedule. Returns the normalized schedule. */
  schedule(endpointId: string, reportId: string, intervalMs: number, now = Date.now()): ReportDeliverySchedule {
    if (!endpointId || !reportId) {
      throw new WebhookDeliveryError('invalid_input', 'Both endpointId and reportId are required to schedule delivery')
    }
    const min = this.options.minIntervalMs ?? MIN_SCHEDULE_INTERVAL_MS
    if (!Number.isFinite(intervalMs) || intervalMs < min) {
      throw new WebhookDeliveryError('invalid_input', `Delivery interval must be at least ${min}ms (got ${intervalMs})`)
    }
    if (!this.driver.getEndpoint(endpointId)) {
      throw new WebhookDeliveryError('invalid_input', `Unknown webhook endpoint: ${endpointId}`)
    }

    const normalized: ReportDeliverySchedule = {
      id: `sch_${endpointId}_${reportId}`,
      endpointId,
      reportId,
      intervalMs,
      enabled: true,
      nextRunAt: now + intervalMs,
    }
    this.schedules = [...this.schedules.filter((s) => s.id !== normalized.id), normalized]
    return normalized
  }

  listSchedules(): ReportDeliverySchedule[] {
    return [...this.schedules]
  }

  getDeliveryLog(): DeliveryLogEntry[] {
    return [...this.log]
  }

  setEnabled(scheduleId: string, enabled: boolean): void {
    const schedule = this.schedules.find((s) => s.id === scheduleId)
    if (!schedule) {
      throw new WebhookDeliveryError('invalid_input', `Unknown delivery schedule: ${scheduleId}`)
    }
    schedule.enabled = enabled
  }

  /**
   * Run every enabled schedule whose nextRunAt is due at `now`.
   * Per-delivery failures are recorded, never thrown.
   */
  async runDue(now: number = Date.now()): Promise<DeliveryLogEntry[]> {
    const due = this.schedules.filter((s) => s.enabled && s.nextRunAt <= now)
    const results: DeliveryLogEntry[] = []

    for (const schedule of due) {
      schedule.lastRunAt = new Date(now).toISOString()
      schedule.nextRunAt = now + schedule.intervalMs

      const endpoint = this.driver.getEndpoint(schedule.endpointId)
      if (!endpoint) {
        results.push(this.recordFailure(schedule, now, 'Endpoint no longer registered'))
        continue
      }

      try {
        const report = await this.driver.getReport(schedule.reportId)
        const payload = buildReportWebhookPayload(report)
        const entry = await deliverReportToWebhook(endpoint, payload, this.options)
        this.log = [...this.log, entry]
        results.push(entry)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        results.push(this.recordFailure(schedule, now, message))
      }
    }

    return results
  }

  private recordFailure(schedule: ReportDeliverySchedule, now: number, message: string): DeliveryLogEntry {
    const entry: DeliveryLogEntry = {
      id: `dlv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      endpointId: schedule.endpointId,
      endpointUrl: this.driver.getEndpoint(schedule.endpointId)?.url ?? '(unknown)',
      reportId: schedule.reportId,
      at: new Date(now).toISOString(),
      success: false,
      signed: false,
      payloadBytes: 0,
      attempts: [{ attempt: 1, ok: false, error: message, durationMs: 0, at: new Date(now).toISOString() }],
    }
    this.log = [...this.log, entry]
    return entry
  }
}
