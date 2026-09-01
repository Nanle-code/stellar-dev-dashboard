# Pull Request Summary: Wallet Sessions, API Versioning, Alert Templates & Webhook Signatures

## Summary

This PR implements four 2026 roadmap items: global Freighter wallet session handling, explicit public API versioning with deprecation headers, starter alert rule templates for common developer incidents, and secure HMAC webhook signature verification.

closes #760
closes #918
closes #916
closes #915

---

## #760 — Wallet session revocation and account-change listeners

### Changes
- Added `useWalletSessionListeners` hook mounted in `DashboardLayout` so session events are handled app-wide (not only on the wallet tab)
- Added `revokeWalletSession(reason)` to the Zustand store to atomically clear wallet identity and account state
- Enhanced Freighter connector with:
  - Network normalization (`PUBLIC` → mainnet, `TESTNET` → testnet, etc.)
  - DOM event listeners for lock, account change, and network change
  - Polling fallback via `subscribeFreighterSession` when the extension does not emit events
- Added `src/lib/wallet/sessionListeners.ts` to coordinate lock, disconnect, account reload, and network sync

### Documentation
- Updated `docs-site/docs/getting-started/authentication.md` with session lifecycle, security, and migration notes

### Tests
- `tests/unit/lib/wallet/freighter.test.js` — normalization, events, polling, disconnect
- `tests/unit/lib/wallet/sessionListeners.test.js` — lock revocation, account reload, unsupported network
- `tests/unit/lib/store.test.js` — `revokeWalletSession` behavior

---

## #918 — Version public dashboard API responses with deprecation headers

### Changes
- Added `api/middleware/apiVersioning.js` with:
  - `API-Version` and `X-API-Version` headers on every response
  - `Deprecation`, `Sunset`, `Link`, and `Warning` headers for deprecated routes
  - `Accept-Version` validation (returns `400` for unsupported versions)
- Applied middleware globally in `api/server.js`
- Updated `/api/docs` to expose `apiVersion: 1.0.0`

### Documentation
- Added `docs/api/API_VERSIONING.md`
- Updated `docs/api/VERSION_HISTORY.md`

### Tests
- `tests/api/middleware/apiVersioning.test.js` — version headers, deprecation headers, invalid `Accept-Version`, payload wrapper

---

## #916 — Alert rule templates for common developer incidents

### Changes
- Added `src/lib/alertRuleTemplates.ts` with starter templates:
  - **Fee Spike** — base fees exceed recent baseline by a multiplier
  - **Failed Submissions** — failed tx count exceeds threshold in a window
  - **RPC Latency Regression** — API/RPC p50/p95/p99 latency exceeds threshold
- Extended `src/types/alerts.ts` with `fee_spike`, `submission_failures`, and `rpc_latency` rule types
- Extended `src/lib/alertRuleEngine.ts` with metric-driven evaluators
- Added metric window helpers to `src/utils/metricsCollector.ts`:
  - `getMetricPointsInWindow`
  - `countMetricEventsInWindow`
  - `recordFeeObservation`

### Documentation
- Updated `docs/features/alert-rules.md` with template usage and metric instrumentation notes

### Tests
- `src/lib/__tests__/alertRuleTemplates.test.ts` — template creation, primary flow, boundary case (insufficient samples), failure paths

---

## #915 — Webhook signature verification helpers for inbound events

### Changes
- Added `src/lib/webhookSignatures.ts` with:
  - `signWebhookPayload` / `verifyWebhookSignature`
  - `parseWebhookSignatureHeader`
  - HMAC-SHA256 via Web Crypto API
  - Timestamp replay tolerance (default 300s)
  - Constant-time signature comparison
- Replaced placeholder `btoa(body + secret)` signing in `src/lib/webhooks.ts` with real HMAC signatures (`t=<timestamp>,v1=<hex>`)

### Documentation
- Added `docs/features/webhook-signatures.md` with signing, verification, failure codes, and migration notes

### Tests
- `src/lib/__tests__/webhookSignatures.test.ts` — sign/verify round-trip, tampering, malformed headers, replay tolerance

---

## Other fixes

- Fixed invalid JSON in `package.json` (`optionalDependencies` duplicate entry) that blocked `npm install`

---

## Test plan

- [x] `tests/unit/lib/wallet/freighter.test.js` (6 tests)
- [x] `tests/unit/lib/wallet/sessionListeners.test.js` (3 tests)
- [x] `tests/unit/lib/store.test.js` — includes `revokeWalletSession` (22 tests)
- [x] `tests/api/middleware/apiVersioning.test.js` (4 tests)
- [x] `src/lib/__tests__/alertRuleTemplates.test.ts` (7 tests)
- [x] `src/lib/__tests__/webhookSignatures.test.ts` (5 tests)

**47 tests passing** across the new and updated test files.

---

## Migration / compatibility notes

| Area | Note |
| --- | --- |
| **Wallet** | Session listeners now run globally; move any tab-scoped handling to `useWalletSessionListeners` |
| **API** | Existing `/api/v1/*` clients continue to work; `/api/v1/behavior/*` includes sunset headers pointing to `/api/v2/behavior` |
| **Webhooks** | Outbound signatures changed from placeholder digests to `t=<timestamp>,v1=<hmac>`; receivers must verify raw body bytes before JSON parsing |
| **Alerts** | Metric templates require instrumentation via `recordTransactionSubmitted`, `recordApiCall`, and `recordFeeObservation` |

---

## Files changed (key)

| Area | Files |
| --- | --- |
| Wallet | `src/lib/wallet/freighter.js`, `src/lib/wallet/sessionListeners.ts`, `src/hooks/useWalletSessionListeners.ts`, `src/lib/store.ts`, `src/routes/DashboardLayout.tsx` |
| API | `api/middleware/apiVersioning.js`, `api/server.js` |
| Alerts | `src/lib/alertRuleTemplates.ts`, `src/types/alerts.ts`, `src/lib/alertRuleEngine.ts`, `src/utils/metricsCollector.ts` |
| Webhooks | `src/lib/webhookSignatures.ts`, `src/lib/webhooks.ts` |
| Docs | `docs/api/API_VERSIONING.md`, `docs/features/webhook-signatures.md`, `docs/features/alert-rules.md`, `docs-site/docs/getting-started/authentication.md` |
| Tests | 6 new/updated test files (see Test plan above) |
