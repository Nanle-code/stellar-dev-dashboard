# Content Security Policy (CSP) Violation Reporting

Implementation notes for Issue #831 — capture CSP violations with sampling and a
triage dashboard **without exposing sensitive page content**.

---

## 1. Overview

The dashboard enforces a Content Security Policy at two layers:

| Layer | File | Purpose |
| :--- | :--- | :--- |
| Production response header | `nginx.conf` | Authoritative policy for the built SPA (contains the inline-script hash). |
| Development / fallback meta tag | `index.html` | Policy applied when the app is not served behind nginx. |

Both layers now declare a **same-origin reporting endpoint**:

```
report-uri /api/security/csp-report;
report-to csp-endpoint;
```

nginx additionally emits the modern `Reporting-Endpoints` response header:

```
Reporting-Endpoints: csp-endpoint="/api/security/csp-report"
```

`report-to` (Reporting API) supersedes `report-uri` in Chromium; `report-uri`
is kept for Firefox/Safari compatibility.

---

## 2. Capture pipeline

`src/lib/cspReporting.ts` turns browser `securitypolicyviolation` events into
sampled, sanitised records:

```
browser event ──▶ CspReporter.report()
                    ├─ normalizeCspViolation()   (validate + sanitise)
                    ├─ shouldSample()            (drop noisy reports)
                    ├─ ring buffer               (triage store, capped)
                    └─ dispatch()                (report-uri beacon, best-effort)
```

### Sampling

- Default `sampleRate` is `0.25` (25%).
- Valid range `0–1`; `0` disables capture, `1` captures everything.
- A non-finite rate throws a `TypeError` — invalid configuration is a
  programmer error, not something to guess at.
- The RNG is injectable, so sampling is deterministic in tests.

### Sanitisation & privacy

| Field | Handling |
| :--- | :--- |
| `blocked-uri`, `document-uri`, `source-file` | Query strings and fragments are **stripped**. `data:` / `blob:` URIs are reduced to `data:[redacted]` / `blob:[redacted]`. |
| `original-policy` | Truncated and redacted. |
| Secret-shaped strings | Redacted with `redactSensitive` from `src/utils/security.ts` (Stellar secret keys, bearer tokens). |
| `sample` / `script-sample` | **Never captured or transmitted.** This field can echo page content, so CSP configuration deliberately does **not** enable the `report-sample` directive. |

The wire body uses the standard `application/csp-report` shape:

```json
{
  "csp-report": {
    "blocked-uri": "https://evil.example.com/tracker.js",
    "document-uri": "https://app.example.com/dashboard",
    "violated-directive": "script-src",
    "effective-directive": "script-src-elem",
    "original-policy": "script-src 'self'",
    "disposition": "enforce",
    "status-code": 200,
    "source-file": "https://app.example.com/app.js",
    "line-number": 42,
    "column-number": 7
  }
}
```

---

## 3. Configuration

```ts
import { configureCspReporter, installCspReporting } from './lib/cspReporting';

configureCspReporter({
  sampleRate: 0.1,                     // keep 10% of violations
  maxEntries: 200,                     // triage ring-buffer size
  endpoint: '/api/security/csp-report',// same-origin collector
  send: true,                          // also beacon reports to the endpoint
});

const uninstall = installCspReporting();
```

`installSecurityEventListeners()` wires this automatically and forwards each
**sampled** violation into the security audit trail
(`SecurityEventType.CSP_VIOLATION`) with sanitised metadata only.

---

## 4. Triage dashboard

The **Security → CSP Violations** step in `SecurityDashboard`
(`src/components/dashboard/CspViolationTriage.tsx`, backed by
`src/hooks/useCspViolations.ts`) shows:

- reports received / captured / dropped-by-sampling / dropped-as-invalid;
- violation counts grouped by directive;
- a table of recent sanitised violations (time, directive, blocked URI, source, line);
- a "Copy JSON" export for offline triage.

---

## 5. Failure handling

| Situation | Behaviour |
| :--- | :--- |
| Non-object / missing directive | Dropped, counted in `droppedInvalid`. |
| Rate above the sample threshold | Dropped, counted in `droppedSampled`. |
| `sendBeacon` throws or `fetch` rejects | Logged at `warn`; capture is never interrupted. |
| No network transport | Report retained locally; dispatch skipped with a warning. |
| No `document` (SSR / non-browser) | `installCspReporting()` returns a no-op uninstaller. |

---

## 6. Compatibility notes

- `report-to` + `Reporting-Endpoints` are honoured by Chromium-based browsers;
  `report-uri` covers Firefox and Safari.
- The `index.html` meta tag can only express `report-uri` — `Reporting-Endpoints`
  is a response header and cannot be set from a `<meta>` element.
- No change to the existing enforced policy: the same `default-src`,
  `script-src`, `connect-src`, etc. are retained.

## 7. Security notes

- `report-sample` is intentionally **not** used to avoid leaking page content.
- The collector endpoint is same-origin (`/api/...`) and is validated by the
  CSP test suite; reports are never sent to third-party origins.
- Only sanitised, sampled data reaches the audit trail and triage store.

## 8. Migration notes

- No consumer changes required. `installSecurityEventListeners()` now routes CSP
  violations through the sampled reporter instead of logging raw event fields.
- If you previously relied on every CSP violation producing an audit entry,
  configure the shared reporter with `sampleRate: 1`.

---

## 9. Testing

- `tests/csp.test.js` — configuration coverage: primary flow (policy + reporting
  endpoints), boundary (allowed origins, same-origin endpoint, no wildcard), and
  failure cases (no `evil.com` / `http://` / `report-sample`).
- `src/lib/__tests__/cspReporting.test.ts` — normalisation, privacy
  sanitisation, sampling boundaries, invalid input, dispatch failures, and
  unsupported environments.

Run them with:

```bash
pnpm run test
```
