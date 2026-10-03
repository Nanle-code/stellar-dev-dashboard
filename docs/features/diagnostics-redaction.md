# Diagnostics Redaction

Implements **#774 — [2026 Security] Redact secrets and signed XDR from diagnostics**.

Secret keys, signed transaction envelopes (XDR), JWTs, API tokens, recovery
phrases and credential-bearing URLs must never reach telemetry, console logs,
error reports or `localStorage`. All diagnostics now pass through a single
redaction choke point: `src/lib/observability/redact.ts`.

## What is redacted

### By value shape (works anywhere in a string)

| Shape | Example | Detection |
| --- | --- | --- |
| Stellar secret seed | `S…` (56 chars) | `isStellarSecretKey` |
| Signed XDR envelope | `AAAA…` (≥100 base64 chars) | `isSignedXdr` |
| JWT / JWS | `eyJ….eyJ….…` | `isJwt` |
| PEM private key | `-----BEGIN … PRIVATE KEY-----` | `isPemPrivateKey` |
| BIP-39 recovery phrase | 12/15/18/21/24 words | `isMnemonic` |
| Provider keys | `sk_live_…`, `ghp_…`, `github_pat_…`, `xoxb-…`, `AIza…` | `isProviderApiKey` |
| Auth header | `Bearer …`, `Basic …` | `isAuthHeaderValue` |

### By key name

Keys are split on `camelCase` / `snake_case` / `kebab-case` boundaries and
matched against credential segments (`secret`, `token`, `password`,
`authorization`, `privateKey`, `mnemonic`, `seed`, `xdr`, `envelope`, …).
Sensitive keys are replaced **wholesale** — the value is never inspected or
serialised. A key pair like `apiKey` is caught by the `key` + qualifier rule,
while `publicKey` is left intact.

### URLs

Credential query parameters (`token`, `access_token`, `api_key`, `secret`,
`signature`, `xdr`, `code`, …) are replaced with `[REDACTED]` in place, and the
rest of the URL is preserved. Malformed/relative URLs fall back to substring
scrubbing.

## API

```ts
import {
  redactValue,          // deep-redact a JSON-like payload
  redactString,         // scrub one free-form string
  redactUrl,            // scrub credential query params
  redactError,          // { name, message, stack, code } with secrets removed
  redactForTelemetry,   // alias of redactValue at the telemetry boundary
  withRedaction,        // wrap a logger so every call is redacted
  containsSensitiveValue,
} from '@/lib/observability/redact';
```

Options: `placeholder`, `maxDepth` (default 8), `maxStringLength`
(default 10,000), `extraSensitiveKeys`.

## Integration

- **`src/utils/logger.ts`** — every entry redacts its message, context and
  `Error` before it is written to the console or handed to log handlers.
- **`src/lib/errorReporting.ts`** — `sanitizeErrorData` now deep-redacts the
  full details payload instead of deleting a fixed allowlist of props; error
  `message`/`stack`, breadcrumbs, warnings, performance context and the
  fingerprint input are all redacted before they are queued, printed or
  persisted to `localStorage`.

## Failure handling

Redaction never throws:

- circular references become `[Circular]`;
- recursion past `maxDepth` becomes `[Truncated]`;
- functions, symbols and objects with throwing getters become
  `[Unrepresentable]`;
- `null`/`undefined`/numbers/booleans pass through untouched.

This guarantees the diagnostics pipeline can always flush, even when the
payload that triggered the error is itself hostile.

## Compatibility & migration notes

- No public API changed: `reportError`, `reportWarning`, `reportPerformance`,
  `addBreadcrumb` and the logger functions keep their signatures.
- Downstream dashboards should expect the literal `[REDACTED]` /
  `[Truncated]` / `[Circular]` markers in place of prior raw values.
- If a field is legitimately sensitive but its name is not covered by the
  heuristics, add it via `extraSensitiveKeys` rather than disabling redaction.
- Redaction is intentionally conservative: false positives (over-redaction)
  are preferred over leaking a key. Because of that, an `xdr` key is redacted
  even when it holds an unsigned envelope.

## Tests

`src/lib/observability/__tests__/redact.test.ts` covers:

- **Primary flow** — secret keys, signed XDR, mnemonics, provider keys and
  auth headers are removed from nested payloads; `withRedaction` scrubs logger
  messages, context and errors.
- **Boundary cases** — near-miss strings (short keys, truncated XDR, 11-word
  phrases), non-sensitive values, URL query-param scrubbing, depth and length
  truncation.
- **Failure paths** — circular references, `Error` message/stack redaction,
  malformed and hostile input (throwing getters), `null`/`undefined`.
