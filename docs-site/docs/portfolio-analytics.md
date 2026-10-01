# Portfolio Analytics Guide

This guide covers the portfolio analytics and data export tooling used by the
2026 DEX accounting workflows. It documents the trade journal export, the cost
basis helpers, and the realized PnL columns that downstream accounting systems
consume.

## Trade journal export

The trade journal export produces a row per **executed** trade. Trades that are
pending, cancelled, or failed are excluded from the journal so that realized PnL
is only computed from settled activity.

### Columns

| Column | Description |
| --- | --- |
| `trade_id` | Unique identifier of the executed trade. |
| `timestamp` | Execution time in ISO-8601 UTC. |
| `market` | Trading pair / market symbol. |
| `side` | `buy` or `sell`. |
| `quantity` | Executed base-asset quantity. |
| `price` | Execution price in quote asset. |
| `fee` | Fee paid, in quote asset. |
| `cost_basis` | Cost basis helper: average cost per unit at execution time. |
| `cost_basis_total` | Cost basis helper: total cost basis consumed by the trade. |
| `proceeds` | Gross proceeds of the trade (quantity x price). |
| `realized_pnl` | Realized PnL for the trade (proceeds - cost basis - fees). |
| `realized_pnl_currency` | Quote asset the realized PnL is denominated in. |

### Cost basis helpers

Cost basis is tracked per market using the average-cost method. The helpers
below are exposed so accounting workflows can reconcile the journal:

- `cost_basis` — running average cost per unit for the market at the time the
  trade executed.
- `cost_basis_total` — the portion of the running cost basis consumed by the
  trade. For buys this is the added cost; for sells it is the cost basis of the
  units removed.

### Realized PnL

Realized PnL is only non-zero for sells. It is computed as:

```
realized_pnl = proceeds - cost_basis_total - fee
```

Buys report `realized_pnl = 0` and update the running cost basis instead.

## Invalid input handling

The export validates its input before producing a journal:

- Missing or malformed trade records (for example, a non-numeric `quantity` or
  `price`) are rejected with a descriptive error rather than silently coerced.
- Trades with a negative quantity or price are treated as invalid input.
- A trade whose `side` is not `buy` or `sell` is rejected.

Invalid records cause the export to fail fast so that accounting workflows do
not ingest partially-correct journals.

## Unsupported environments

The export requires a runtime with the standard portfolio analytics data
source available. When the data source is unavailable (for example, an
unsupported environment or a missing configuration), the export raises an
explicit "unsupported environment" error instead of returning an empty journal.
This makes the failure visible to the caller rather than producing misleading
zero-value output.

## Failure paths

- **Invalid input** — rejected with a descriptive validation error.
- **Unsupported environment** — rejected with an explicit unsupported
  environment error.
- **Data source failure** — propagated to the caller; the export does not
  swallow errors or emit a partial journal.

## Compatibility and migration notes

- The journal schema is additive. New columns may be appended in future
  releases; consumers should key on column names rather than positional order.
- `realized_pnl` is denominated in the quote asset reported by
  `realized_pnl_currency`. Consumers migrating from older exports that lacked
  this column should treat missing values as `0` and re-run the export to obtain
  realized PnL.
- Cost basis is computed with the average-cost method. Workflows that previously
  assumed FIFO cost basis must migrate to the average-cost helpers documented
  above.

## Security notes

The export contains trade history and cost basis data. Treat exported journals
as sensitive financial data: restrict access to authorized accounting
workflows, avoid logging full journals, and store exports in access-controlled
locations.

## Testing guidance

Automated tests for the trade journal export should cover:

- **Primary flow** — a sequence of buys and sells produces the expected cost
  basis helpers and realized PnL columns.
- **Boundary case** — a sell that exactly consumes the remaining position
  (zero remaining quantity) reports the correct realized PnL.
- **Failure case** — an invalid trade record (for example, a negative quantity)
  is rejected with a descriptive error.
