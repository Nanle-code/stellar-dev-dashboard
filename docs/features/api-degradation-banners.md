# Graceful API Degradation Banners (Horizon outages)

The dashboard depends on several upstream services (Horizon, Soroban RPC, the
price feed). When one of them becomes slow or unreachable, the UI should degrade
gracefully instead of rendering empty panels or failing silently.

## What it does

`src/lib/apiDegradation.ts` classifies each service signal into one of four
health states:

| State         | Meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `operational` | Reachable and within latency / error-rate thresholds           |
| `degraded`    | Reachable but slow (`> 2000 ms`) or erroring (`≥ 5 %`)         |
| `outage`      | The last probe failed (`reachable: false`)                     |
| `unknown`     | No usable signal (missing/invalid data) — never raises a banner |

`evaluateApiDegradation(statuses)` aggregates the signals into a single banner:

- **critical** — at least one outage. Announces via `role="alert"`.
- **warning** — one or more degraded-but-reachable services.
- **hidden** — everything operational, or only `unknown` signals (no false alarms).

Retry guidance is derived from `computeRetryDelayMs(attempt)`, an exponential
backoff (1.5 s → 3 s → 6 s …, capped at 60 s).

## React usage

```tsx
import { useApiDegradation } from '../hooks/useApiDegradation';
import ApiDegradationBanner from '../components/layout/ApiDegradationBanner';

function LayoutShell({ statuses }) {
  const { attempt, retry } = useApiDegradation(statuses);
  return <ApiDegradationBanner statuses={statuses} attempt={attempt} onRetry={retry} />;
}
```

`ApiDegradationBanner` is fully presentational — pass it the raw health signals
and an `onRetry` callback; it handles severity styling, accessibility roles, and
dismissal (re-showing when the severity/headline changes).

## Invalid input, unsupported environments, and failure paths

- Non-object, `null`, or malformed entries are classified as `unknown` rather
  than throwing, so the banner can always render.
- Negative or `NaN` retry attempts are normalised to a safe zero-based delay.
- The module has no browser dependencies and is safe under SSR / Node.

## Testing

`src/lib/__tests__/apiDegradation.test.ts` covers:

- primary flow — outage produces a critical, retryable banner;
- boundary cases — all-operational and unknown-only lists stay hidden;
- failure cases — malformed input never throws and is reported as unknown.

Run with `pnpm run test -- apiDegradation`.
