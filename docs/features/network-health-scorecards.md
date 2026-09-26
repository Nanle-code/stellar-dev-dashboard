# Comparative Network Health Scorecards (#867)

The Cross-Network panel now includes a side-by-side **health scorecard**
comparing Mainnet and Testnet indicators, with standing caveats so the two
networks are not misread as comparable SLAs.

## Where to find it

Open the **Transactions** dashboard view → **Cross-Network panel** (lazy-loaded
`CrossNetworkPanel`). The scorecard renders below the per-network status rows,
above the "Network-aware actions" notes. It is also exported as
`src/components/dashboard/NetworkHealthScorecard.tsx` for reuse.

## Scoring model

`src/lib/networkHealthScorecard.ts` computes a composite 0–100 score per
network from four weighted indicators:

| Indicator | Weight | Source field(s) |
| --- | --- | --- |
| Ledger Freshness | 30% | `latestLedger.closed_at` (stale beyond 60s) |
| Tx Success Rate | 30% | `successful_transaction_count` / `failed_transaction_count` |
| Fee Pressure | 25% | `feeStats.last_ledger_base_fee` (degrades above 1,000 stroops) |
| Ledger Throughput | 15% | `operation_count` (utilization vs 1,000 ops/ledger) |

Grades: `healthy` (≥80), `degraded` (55–79), `critical` (<55), plus
`unavailable` when a network cannot be scored.

The report includes a deterministic **delta** (mainnet − testnet), a
**leader**, and narrative insights, e.g.:

> Mainnet scores 92/100 (healthy) vs Testnet 71/100 (degraded). Mainnet is
> currently healthier by 21 points.

## Caveats (always shown)

Every scorecard carries standing caveats:

- Mainnet and Testnet have different validator sets, load profiles, and
  stakes — scores are **not directly comparable SLAs**.
- Testnet XLM has no monetary value and can be reset; testnet health does not
  predict mainnet health.

Data-quality warnings discovered while scoring are appended per network
(stale ledgers, missing fields, base fee below the 100 stroop protocol
minimum, elevated fees suggesting congestion, low success rates).

## Failure handling

- **Unsupported networks** (futurenet, local, custom, arbitrary strings) are
  rejected with a clear error rather than silently scored — the scorecard is
  scoped to mainnet/testnet by design.
- **One network failing never hides the other.** Snapshot fetch failures and
  invalid snapshots are captured per network as `ok: false` entries with an
  `error` message; the panel renders an inline error for that network while
  the other side keeps its score.
- **Missing fields score neutral** (sub-score 50) with a warning, so a
  partial Horizon response degrades gracefully instead of crashing.
- **Malformed numeric strings** are coerced to neutral instead of producing
  `NaN` scores.

## Developer usage

```ts
import { buildComparativeHealthReport } from '@/lib/networkHealthScorecard'

const report = await buildComparativeHealthReport(
  async (network) => toHealthInput(network, await fetchNetworkStats(network)),
  ['mainnet', 'testnet'],
  { now: Date.now() }, // injectable clock for tests
)
```

The fetcher is injected, so tests and alternative data sources (caches,
custom Horizon mirrors) can be swapped without changing the scoring logic.

## Compatibility notes

- Purely additive: `CrossNetworkPanel` renders the new scorecard lazily; no
  existing props or store fields changed.
- No new network requests beyond the two `fetchNetworkStats` calls
  (mainnet + testnet) triggered when the panel mounts.
