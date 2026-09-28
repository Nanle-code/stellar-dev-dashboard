# Circuit-Breaker Protection for External Analytics Providers

Implementation notes for Issue #828 — fail open or closed according to policy when
third-party analytics or monitoring endpoints are unavailable.

---

## 1. Objective

The dashboard sends telemetry to several external providers (Sentry, the
analytics collector, the RUM endpoint, and the error-reporting endpoint). A
provider that is slow, rate-limiting, or hard-down must never degrade the
product or leak unhandled errors into user flows.

`src/utils/providerCircuitBreaker.ts` wraps every outbound telemetry call in a
circuit breaker and applies an explicit **failure policy** that determines what
happens when the provider is unavailable.

The module reuses the generic breaker from
`src/lib/errorHandling/CircuitBreaker.ts` (Issue #144) so circuit state,
thresholds, and cooldown behaviour stay consistent across the platform.

---

## 2. Circuit states

| State | Behaviour |
| :--- | :--- |
| `CLOSED` | Normal operation. Requests pass through. Consecutive failures trip the breaker. |
| `OPEN` | Requests are skipped immediately — **no network call is made** — until `timeout` elapses. |
| `HALF_OPEN` | A single probe request is allowed (after the cooldown). Success closes the circuit; failure re-opens it. |

---

## 3. Failure policies

| Policy | Meaning | When to use |
| :--- | :--- | :--- |
| `fail-open` | The send is dropped and the caller continues unaffected. Errors are swallowed (logged at `warn`). | Best-effort telemetry: **analytics**, **RUM**, **Sentry**. Losing a sample is preferable to breaking a user flow. |
| `fail-closed` | The original error is re-thrown so the caller can retain and retry the payload. | Delivery-sensitive pipelines: **error reporting**. The batch stays queued and is retried after the breaker cools down. |

Defaults are registered in `DEFAULT_PROVIDER_POLICIES`:

| Provider | Default policy |
| :--- | :--- |
| `analytics` | `fail-open` |
| `rum` | `fail-open` |
| `sentry` | `fail-open` |
| `errorReporting` | `fail-closed` |

---

## 4. Configuration

Policies are normally configured through `initMonitoring()`, which remains the
single entry point for the monitoring stack:

```ts
import { initMonitoring } from './utils/monitoring';

initMonitoring({
  sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  providerPolicies: {
    analytics: 'fail-open',
    errorReporting: 'fail-closed',
  },
});
```

Individual calls can override breaker tuning (thresholds / cooldown) and the
policy inline:

```ts
import { guardProviderSend } from './utils/providerCircuitBreaker';

const result = await guardProviderSend(
  'analytics',
  async () => {
    const response = await fetch(endpoint, { method: 'POST', body: JSON.stringify(batch) });
    if (!response.ok) throw new Error(`Analytics endpoint responded ${response.status}`);
  },
  { policy: 'fail-open', failureThreshold: 3, successThreshold: 1, timeout: 30_000 },
);

if (!result.delivered) {
  // result.skipped === true  → circuit was OPEN, no network call was attempted
  // result.skipped === false → the send was attempted and failed
}
```

### Runtime helpers

| Function | Purpose |
| :--- | :--- |
| `guardProviderSend(provider, operation, options?)` | Run an operation under breaker + policy protection. |
| `setProviderPolicy(provider, policy)` / `clearProviderPolicy(provider)` | Override / reset a provider policy. |
| `getProviderPolicy(provider)` | Resolve the effective policy (override → built-in default → `fail-open`). |
| `getProviderStats(provider)` | Snapshot `{ state, failureCount, successCount, lastFailureTime, policy }`. |
| `resetProviderCircuitBreaker(provider)` | Force a provider back to `CLOSED` (tests / manual recovery). |
| `isTransportSupported()` | `true` when `fetch` or `navigator.sendBeacon` is available. |

---

## 5. Failure-path semantics

- **Invalid input** — a non-string/empty provider name or a non-function
  operation throws a `TypeError`. Malformed input is a programmer error and is
  never treated as telemetry.
- **Unsupported environment** — when no network transport exists
  (`isTransportSupported() === false`) the breaker is **not** tripped. `fail-open`
  drops the payload; `fail-closed` throws, allowing the caller to retry later.
- **Provider failure** — under `fail-open` the payload is dropped and logged;
  under `fail-closed` the error propagates.
- **Open circuit** — operations are never invoked while the circuit is `OPEN`;
  the result is reported as `skipped: true` for observability.

---

## 6. Related integrations

| Module | Provider | Policy | Notes |
| :--- | :--- | :--- | :--- |
| `src/utils/analytics.ts` | `analytics` | `fail-open` | Batches are re-queued on a transient failure; they are dropped once the circuit is `OPEN` so the queue cannot grow unbounded while the collector is down. |
| `src/lib/performance.ts` | `rum` | `fail-open` | Fire-and-forget `sendBeacon`/`fetch`; never blocks or throws into callers. |
| `src/lib/errorReporting.ts` | `errorReporting` | `fail-closed` | Failed batches are re-queued and retried after the cooldown. |
| `src/lib/errorReporting.ts` (Sentry bridge) | `sentry` | `fail-open` | Sentry maintains its own transport; the policy is registered for consistency. |

---

## 7. Compatibility notes

- No public API removed. `initMonitoring()` and the existing
  `reportError`/`addBreadcrumb`/RUM flows keep their signatures.
- `MonitoringConfig` gains an optional `providerPolicies` field. Existing calls
  are unaffected and inherit the built-in defaults.
- The breaker is transport-agnostic and works in the browser and in Node ≥ 22
  (global `fetch`).

## 8. Migration notes

- **Analytics queue growth** — previously `flushEvents()` re-queued an unbounded
  number of batches on every failure. With the breaker, batches are still
  re-queued while the circuit is `CLOSED`, but are intentionally dropped once it
  opens. If you need guaranteed analytics delivery, switch `analytics` to
  `fail-closed` and persist the queue in `localStorage`.
- No changes are required for consumers that only call `trackEvent` /
  `trackPageView` / `trackPerformanceMetric`.

## 9. Security notes

- The breaker changes *delivery*, not payload contents; existing PII/secret
  scrubbing in `errorReporting.ts` and the Sentry `beforeSend` hook is unchanged.
- Failing providers stop receiving telemetry once the circuit opens, which also
  limits accidental data exposure to an unhealthy endpoint.
- Diagnostics exposed via `getProviderStats()` contain counters and state only —
  no event payloads, user identifiers, or tokens.

---

## 10. Testing

Automated coverage lives in:

- `src/utils/__tests__/providerCircuitBreaker.test.ts` — primary flow, the
  `OPEN`/`HALF_OPEN` recovery boundary, both failure policies, invalid input, and
  unsupported-environment handling.
- `src/utils/__tests__/analytics.circuitBreaker.test.ts` — integration coverage
  proving repeated failures open the circuit and stop network calls.
- `src/utils/__tests__/monitoring.consent.test.ts` — verifies
  `initMonitoring({ providerPolicies })` is applied.

Run them with:

```bash
pnpm run test:unit
```
