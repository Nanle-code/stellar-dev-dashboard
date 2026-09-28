import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createWebhookEndpoint,
  validateWebhookUrl,
  buildReportWebhookPayload,
  signReportPayload,
  deliverReportToWebhook,
  ReportDeliveryScheduler,
  WebhookDeliveryError,
  DEFAULT_MAX_ATTEMPTS,
} from '../reportWebhookDelivery'
import type { TransformedReportData } from '../customReports'

function makeReport(): TransformedReportData {
  return {
    templateId: 'network-health',
    generatedAt: '2026-09-01T12:00:00.000Z',
    metrics: [{ label: 'Latest Ledger', value: 55_000_000 }],
    chartData: [],
    rows: [],
    columns: [],
    insights: ['Base fee stable at 100 stroops.'],
    summary: 'Network is healthy',
  }
}

const okResponse = () => new Response(JSON.stringify({ received: true }), { status: 200 })

describe('validateWebhookUrl / createWebhookEndpoint', () => {
  it('accepts an HTTPS URL and normalizes it', () => {
    expect(validateWebhookUrl('https://example.com/hooks/report')).toBe('https://example.com/hooks/report')
  })

  it('rejects plain HTTP unless explicitly allowed (boundary)', () => {
    expect(() => validateWebhookUrl('http://localhost:4000/hooks')).toThrow(/HTTPS/)
    expect(validateWebhookUrl('http://localhost:4000/hooks', true)).toBe('http://localhost:4000/hooks')
  })

  it('rejects empty and malformed URLs', () => {
    expect(() => validateWebhookUrl('')).toThrow(/required/)
    expect(() => validateWebhookUrl('   ')).toThrow(/required/)
    expect(() => validateWebhookUrl('not-a-url')).toThrow(/not a valid URL/)
    expect(() => validateWebhookUrl('ftp://example.com/x')).toThrow(/HTTPS/)
  })

  it('creates an endpoint with an id and defaults', () => {
    const endpoint = createWebhookEndpoint({ url: 'https://example.com/hook', secret: 's3cret' })
    expect(endpoint.id).toMatch(/^wh_/)
    expect(endpoint.allowInsecure).toBe(false)
    expect(endpoint.headers).toEqual({})
    expect(endpoint.secret).toBe('s3cret')
  })

  it('rejects non-object endpoint configuration', () => {
    expect(() => createWebhookEndpoint(null as any)).toThrow(/must be an object/)
  })
})

describe('buildReportWebhookPayload', () => {
  it('builds a signed-ready analytics summary payload', () => {
    const payload = buildReportWebhookPayload(makeReport(), { dashboardUrl: 'https://dashboard.example/reports' })

    expect(payload.event).toBe('report.published')
    expect(payload.reportId).toBe('network-health')
    expect(payload.metrics).toHaveLength(1)
    expect(payload.insights).toEqual(['Base fee stable at 100 stroops.'])
    expect(payload.dashboardUrl).toBe('https://dashboard.example/reports')
  })

  it('rejects reports without a templateId (invalid input)', () => {
    expect(() => buildReportWebhookPayload({} as any)).toThrow(/templateId/)
  })
})

describe('signReportPayload', () => {
  it('produces the documented t=...,v1=... signature format', async () => {
    const signature = await signReportPayload('{"a":1}', 'topsecret', 1_700_000_000)
    expect(signature).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/)
  })

  it('produces a different signature for a different timestamp (replay protection)', async () => {
    const s1 = await signReportPayload('body', 'topsecret', 1_700_000_000)
    const s2 = await signReportPayload('body', 'topsecret', 1_700_000_300)
    expect(s1).not.toBe(s2)
  })
})

describe('deliverReportToWebhook', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('delivers a signed payload on the primary flow', async () => {
    const fetchMock = vi.fn(async () => okResponse())
    globalThis.fetch = fetchMock as any

    const endpoint = createWebhookEndpoint({ url: 'https://example.com/hook', secret: 'shhh' })
    const entry = await deliverReportToWebhook(endpoint, buildReportWebhookPayload(makeReport()), { sleep: async () => {} })

    expect(entry.success).toBe(true)
    expect(entry.signed).toBe(true)
    expect(entry.attempts).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [, init] = fetchMock.mock.calls[0] as [string, Record<string, unknown>]
    const headers = init.headers as Record<string, string>
    expect(headers['X-Webhook-Signature']).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/)
    expect(String(init.body)).toContain('"event":"report.published"')
  })

  it('sends a bearer token when no secret is configured', async () => {
    const fetchMock = vi.fn(async () => okResponse())
    globalThis.fetch = fetchMock as any

    const endpoint = createWebhookEndpoint({ url: 'https://example.com/hook', bearerToken: 'tok_123' })
    const entry = await deliverReportToWebhook(endpoint, buildReportWebhookPayload(makeReport()))

    expect(entry.success).toBe(true)
    const [, init] = fetchMock.mock.calls[0] as [string, Record<string, unknown>]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok_123')
  })

  it('retries on transient HTTP failure and succeeds on a later attempt', async () => {
    let calls = 0
    globalThis.fetch = vi.fn(async () => {
      calls += 1
      return calls === 1 ? new Response('nope', { status: 503 }) : okResponse()
    }) as any

    const endpoint = createWebhookEndpoint({ url: 'https://example.com/hook', secret: 'shhh' })
    const sleeps: number[] = []
    const entry = await deliverReportToWebhook(endpoint, buildReportWebhookPayload(makeReport()), {
      sleep: async (ms) => sleeps.push(ms),
    })

    expect(entry.success).toBe(true)
    expect(entry.attempts).toHaveLength(2)
    expect(entry.attempts[0].status).toBe(503)
    expect(sleeps).toEqual([1_000]) // exponential backoff base
  })

  it('exhausts retries and records a failed entry without throwing (failure path)', async () => {
    globalThis.fetch = vi.fn(async () => new Response('down', { status: 500 })) as any

    const endpoint = createWebhookEndpoint({ url: 'https://example.com/hook', bearerToken: 't' })
    const entry = await deliverReportToWebhook(endpoint, buildReportWebhookPayload(makeReport()), {
      maxAttempts: 2,
      sleep: async () => {},
    })

    expect(entry.success).toBe(false)
    expect(entry.attempts).toHaveLength(2)
    expect(entry.attempts.every((a) => a.status === 500)).toBe(true)
  })

  it('respects DEFAULT_MAX_ATTEMPTS=3 by default', async () => {
    globalThis.fetch = vi.fn(async () => new Response('down', { status: 502 })) as any
    const endpoint = createWebhookEndpoint({ url: 'https://example.com/hook' })
    const entry = await deliverReportToWebhook(endpoint, buildReportWebhookPayload(makeReport()), { sleep: async () => {} })

    expect(DEFAULT_MAX_ATTEMPTS).toBe(3)
    expect(entry.attempts).toHaveLength(3)
  })

  it('rejects invalid endpoints up front', async () => {
    await expect(deliverReportToWebhook(null as any, buildReportWebhookPayload(makeReport()))).rejects.toThrow(/url is required/i)
  })
})

describe('ReportDeliveryScheduler', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => okResponse()) as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function makeDriver(overrides: Partial<any> = {}) {
    const endpoint = createWebhookEndpoint({ url: 'https://example.com/hook', secret: 'shhh' })
    return {
      endpoint,
      driver: {
        getReport: vi.fn(async () => makeReport()),
        getEndpoint: vi.fn((id: string) => (id === endpoint.id ? endpoint : undefined)),
        ...overrides,
      },
    }
  }

  it('registers, runs due schedules, and logs a successful delivery (primary flow)', async () => {
    const { driver, endpoint } = makeDriver()
    const scheduler = new ReportDeliveryScheduler(driver)
    const t0 = 1_700_000_000_000

    const schedule = scheduler.schedule(endpoint.id, 'network-health', 60_000, t0)
    expect(schedule.nextRunAt).toBe(t0 + 60_000)
    expect(scheduler.runDue(t0)).resolves.toBeTruthy()
    const results = await scheduler.runDue(t0 + 60_001)

    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(true)
    expect(results[0].reportId).toBe('network-health')
    expect(driver.getReport).toHaveBeenCalledWith('network-health')
  })

  it('does not run a schedule before it is due (boundary)', async () => {
    const { driver, endpoint } = makeDriver()
    const scheduler = new ReportDeliveryScheduler(driver)
    const t0 = 1_700_000_000_000
    scheduler.schedule(endpoint.id, 'network-health', 60_000, t0)

    const early = await scheduler.runDue(t0 + 59_999)
    expect(early).toHaveLength(0)
  })

  it('rejects intervals below the minimum and unknown endpoints (invalid input)', () => {
    const { driver, endpoint } = makeDriver()
    const scheduler = new ReportDeliveryScheduler(driver)

    expect(() => scheduler.schedule(endpoint.id, 'network-health', 1_000)).toThrow(WebhookDeliveryError)
    expect(() => scheduler.schedule('wh_missing', 'network-health', 60_000)).toThrow(/Unknown webhook endpoint/)
    expect(() => scheduler.schedule('', 'x', 60_000)).toThrow(/endpointId and reportId/)
  })

  it('records a failure entry when the endpoint disappeared (failure path)', async () => {
    const { endpoint } = makeDriver()
    let lookup: (_id: string) => any = (id: string) => (id === endpoint.id ? endpoint : undefined)
    const driver = {
      getReport: vi.fn(async () => makeReport()),
      getEndpoint: vi.fn((id: string) => lookup(id)),
    }
    const scheduler = new ReportDeliveryScheduler(driver)
    const t0 = 1_700_000_000_000
    scheduler.schedule(endpoint.id, 'network-health', 60_000, t0)

    // The endpoint is deregistered after scheduling.
    lookup = () => undefined

    const results = await scheduler.runDue(t0 + 60_001)
    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(false)
    expect(results[0].attempts[0].error).toMatch(/no longer registered/)
    expect(scheduler.getDeliveryLog()).toHaveLength(1)
  })

  it('keeps scheduling when report generation fails, and logs the failure', async () => {
    const { driver, endpoint } = makeDriver({
      getReport: vi.fn(async () => {
        throw new Error('report generation failed')
      }),
    })
    const scheduler = new ReportDeliveryScheduler(driver)
    const t0 = 1_700_000_000_000
    scheduler.schedule(endpoint.id, 'network-health', 60_000, t0)

    const results = await scheduler.runDue(t0 + 60_001)
    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(false)
    expect(results[0].attempts[0].error).toMatch(/report generation failed/)

    // Next run is still scheduled after the failure.
    expect(scheduler.listSchedules()[0].nextRunAt).toBe(t0 + 60_001 + 60_000)
  })

  it('respects disabled schedules', async () => {
    const { driver, endpoint } = makeDriver()
    const scheduler = new ReportDeliveryScheduler(driver)
    const t0 = 1_700_000_000_000
    const schedule = scheduler.schedule(endpoint.id, 'network-health', 60_000, t0)

    scheduler.setEnabled(schedule.id, false)
    const results = await scheduler.runDue(t0 + 60_001)
    expect(results).toHaveLength(0)
  })
})
