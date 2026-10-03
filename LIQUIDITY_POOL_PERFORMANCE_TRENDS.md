# Liquidity-pool fee APR and volume trends

The DEX Explorer's **Liquidity Pools → Performance** view estimates a pool's
fee APR and reconstructs its recent volume trend so liquidity providers can
compare pools before depositing (#862).

## Using the trends

1. Connect an account and select `DEX Explorer → Liquidity Pools`.
2. Search for an asset pair and select a pool.
3. Open the **Performance** tab. The **Fee APR & Volume Trends** card shows:
   - **Fee APR (est.)** — annualized fee yield based on observed trade volume.
   - **Est. Daily Fees** — projected daily fee income in pool units.
   - **Est. Daily Volume** — observed volume scaled to a 24-hour rate.
   - A bar chart of volume bucketed across the observed trade window, with a
     trend arrow (rising / falling / steady) derived from the two halves of
     the window.

## How the APR is estimated

Horizon does not expose 24-hour pool volume, so the dashboard reconstructs it
from the pool's most recent trades (`fetchPoolTrades`):

```
dailyVolume   = observedVolume × (24h / observedWindowHours)
dailyFees     = dailyVolume × (feeBps / 10 000)
feeAprPercent = (dailyFees / totalReserveValue) × 365 × 100
```

Trade windows shorter than 24 hours are scaled up and marked
**"extrapolated from <24h"**. Windows shorter than one hour are clamped to one
hour so a burst of trades cannot produce absurd APRs.

## Confidence warnings

The card surfaces warnings instead of silently showing a precise-looking
number:

- **Low sample** — fewer than 5 valid trades; treat the APR as a rough estimate.
- **Stale trades** — no trades in the last 6 hours; the trend may not reflect
  current activity.
- **Extrapolated volume** — the daily rate was scaled up from a shorter window.
- **Skipped records** — malformed trade records were excluded from the totals.

## Failure and input handling

- Missing or invalid pool data (absent fee tier, empty reserves) renders an
  explanatory `role="alert"` message instead of a 0% APR.
- Pools with no recent trades show why the APR is unavailable via
  `role="status"` rather than rendering misleading zeros.
- Malformed trade records (unparsable or negative amounts) are skipped and
  counted; a single bad Horizon record cannot break the panel.
- The chart renders inside an error boundary: if charting fails in an
  unsupported environment, the card falls back to a plain bucket list.
- All metric helpers in `src/lib/poolMetrics.ts` are pure and DOM-free, so
  they can be reused in node tools and jsdom tests.

## Compatibility and security notes

- Estimates are informational only and are not a promise of future yield;
  APR varies with volume and pool depth. They are not slippage-protection
  minimums and should not be treated as execution guarantees.
- Volume is reconstructed only from trades Horizon returns for the selected
  pool; nothing is persisted and no additional permissions are required.
- No migration is needed: the card is additive to the existing Performance
  tab and does not change any existing panel's data flow.
