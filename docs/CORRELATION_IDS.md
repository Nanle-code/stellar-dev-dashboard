# Correlation IDs for frontend diagnostics

Support engineers need to connect a user-visible failure to the exact API call
and backend trace it produced. The dashboard does this with a **correlation id**
that is created when a user action starts and propagated onto every outbound
request and log line.

## API

`src/lib/correlation.ts`

| Export                          | Purpose                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `generateCorrelationId()`       | New id (`crypto.randomUUID()` with a safe fallback)            |
| `isValidCorrelationId(v)`       | Validate `^[A-Za-z0-9._:-]{8,128}$`                            |
| `normaliseCorrelationId(v)`     | Return `v` if valid, otherwise generate a fresh id             |
| `withCorrelation(id \| fn, fn)` | Run a scope with an active correlation id (sync or async)      |
| `getCorrelationId()`            | Id active in the current scope, or `null`                      |
| `createCorrelationFetch(opts)`  | `fetch` wrapper that injects `X-Correlation-ID`                |
| `extractCorrelationId(headers)` | Read the id from a response header, falling back to the context |

`src/utils/correlationLogger.ts` exports `createCorrelatedLogger(namespace)`,
which stamps the active id onto every log context.

## Example

```ts
import { withCorrelation, createCorrelationFetch } from '../lib/correlation';
import { createCorrelatedLogger } from '../utils/correlationLogger';

const api = createCorrelationFetch();
const log = createCorrelatedLogger('SubmitPayment');

await withCorrelation('checkout-2026-09-26', async () => {
  log.info('Submitting payment');            // context includes correlationId
  await api('/api/submit', { method: 'POST' }); // sends X-Correlation-ID
});
```

## Failure paths

- `generateCorrelationId()` never throws, even without Web Crypto.
- Invalid ids are replaced rather than propagated, so malformed upstream values
  cannot pollute traces.
- Failed requests reject with an error carrying a `correlationId` property, and
  the optional `onError(correlationId, error)` hook fires for telemetry.

## Compatibility & security notes

- Header injection is limited to the requests you route through
  `createCorrelationFetch`; opt out per request with `shouldInstrument`.
- Correlation ids are opaque, non-secret identifiers. Do **not** place tokens,
  addresses, or memos inside them.
- No browser globals are read at import time, so the module is SSR-safe.

## Testing

`src/lib/__tests__/correlation.test.ts` covers the primary propagation flow,
boundary cases (invalid/over-long ids, caller-supplied headers), and the failure
path (decorated errors + `onError`). Run `pnpm run test -- correlation`.
