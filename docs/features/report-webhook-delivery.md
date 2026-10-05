# Scheduled Report Delivery via Webhook Endpoints (#869)

Scheduled analytics summaries can now be delivered automatically to
authenticated webhook endpoints (Slack-compatible receivers, Zapier, Make.com,
or your own services).

## Overview

`src/lib/reportWebhookDelivery.ts` complements the schedule and delivery-plan
modeling in `src/lib/customReports.ts` (which already supports choosing the
`webhook` channel with an HTTPS URL) with the actual authenticated **transport**
layer: signed payloads, bounded retries, and a delivery audit log.

```ts
import {
  createWebhookEndpoint,
  buildReportWebhookPayload,
  deliverReportToWebhook,
  ReportDeliveryScheduler,
} from '@/lib/reportWebhookDelivery'

// 1. Register an endpoint (HMAC signing preferred; bearer token supported).
const endpoint = createWebhookEndpoint({
  url: 'https://hooks.example.com/stellar-reports',
  secret: process.env.REPORT_WEBHOOK_SECRET,   // HMAC-SHA256 signing
  // bearerToken: 'tok_xxx',                    // alternative auth
})

// 2. Build the summary payload from a transformed report.
const payload = buildReportWebhookPayload(transformedReport, {
  dashboardUrl: 'https://dashboard.example/reports',
})

// 3. Deliver once (signed + retried)…
const logEntry = await deliverReportToWebhook(endpoint, payload)

// …or schedule recurring delivery.
const driver = {
  getReport: (id) => generateReport(id),
  getEndpoint: (id) => (id === endpoint.id ? endpoint : undefined),
}
const scheduler = new ReportDeliveryScheduler(driver)
scheduler.schedule(endpoint.id, 'network-health', 60 * 60 * 1000)
setInterval(() => scheduler.runDue(), 60 * 1000)
```

## Payload format

Deliveries POST `application/json` with a stable envelope:

```json
{
  "event": "report.published",
  "reportId": "network-health",
  "generatedAt": "2026-09-01T12:00:00.000Z",
  "summary": "Network is healthy",
  "metrics": [{ "label": "Latest Ledger", "value": 55000000 }],
  "insights": ["Base fee stable at 100 stroops."],
  "dashboardUrl": "https://dashboard.example/reports"
}
```

## Authentication

Two mechanisms are supported, in priority order:

1. **HMAC-SHA256 signature** (when `secret` is set) — the `X-Webhook-Signature`
   header carries the documented `t=<unix-seconds>,v1=<hex-hmac>` value, signed
   over `${timestamp}.${rawBody}`. See
   [webhook-signatures.md](./webhook-signatures.md) for receiver-side
   verification, replay tolerance, and secret rotation guidance.
2. **Bearer token** (when no secret is configured) — an
   `Authorization: Bearer <token>` header is attached.

Custom static headers (e.g. receiver-specific API keys) can be supplied via
`headers` and are merged underneath the auth headers.

## Validation and security rules

- URLs must be **HTTPS**. Plain HTTP is only accepted with
  `allowInsecure: true` for localhost development.
- Empty, malformed, or non-HTTPS URLs throw `WebhookDeliveryError`
  (`code: 'invalid_input'`) at registration time — never at delivery time.
- Endpoints must opt in; the scheduler refuses unknown endpoint ids.
- Delivery intervals are bounded below (`MIN_SCHEDULE_INTERVAL_MS`, default
  1 minute) to prevent accidental request floods.

## Retries and failure handling

- Transient failures (network errors, HTTP 5xx, timeouts) are retried with
  exponential backoff: 1s, 2s, 4s (default `maxAttempts: 3`, per-attempt
  timeout 10s).
- Every attempt is recorded in the returned `DeliveryLogEntry` (status,
  duration, error) and appended to the scheduler's delivery log.
- A failing endpoint never throws into the scheduler loop and never blocks
  delivery to other schedules; it is recorded as a failed entry instead.
- `unsupported_environment` is thrown (not retried) when Web Crypto or
  `fetch` is unavailable, e.g. in non-secure contexts.

## Compatibility notes

- Existing `customReports.ts` schedules that select the `webhook` channel are
  unaffected; this module is additive and can be adopted per-feature.
- The signature format matches the inbound verification helper documented in
  `docs/features/webhook-signatures.md`, so receivers can reuse the same code.
- Payload size is bounded by the report summary (metrics + insights), not raw
  row data; attach full CSV/PDF exports separately if needed via
  `buildDeliveryPlan`.
