# Custom Metric Builder Guide (#864)

Compose reusable metrics from Horizon fields and saved arithmetic expressions.

## Overview

The custom metric builder lets you define formulas that combine any numeric
Horizon API field with basic arithmetic (`+`, `-`, `*`, `/`) and
parentheses. Formulas are validated at save time, stored locally, and can be
evaluated on demand against any analytics snapshot.

## Quick Start

```typescript
import {
  saveMetricFormula,
  evaluateSavedFormula,
  METRIC_FIELD_CATALOGUE,
} from './src/lib/metricBuilder';

// 1. Browse available fields
console.log(METRIC_FIELD_CATALOGUE.map(f => `${f.path} — ${f.label}`));

// 2. Save a reusable formula
saveMetricFormula({
  id: 'fee-efficiency',
  name: 'Fee Efficiency Ratio',
  formula: 'network.baseFee / network.p90Fee',
  format: 'percentage',
  tags: ['fees', 'efficiency'],
});

// 3. Evaluate against a live snapshot
const snapshot = buildAnalyticsSnapshot({ /* ... Horizon data ... */ });
const result = evaluateSavedFormula('fee-efficiency', snapshot);
// → { value: 0.5, formatted: "50.0%", resolvedFields: ["network.baseFee", "network.p90Fee"] }
```

## Available Horizon Fields

The field catalogue (`METRIC_FIELD_CATALOGUE`) exposes these paths:

### Account fields

| Path | Label | Description |
|------|-------|-------------|
| `account.xlmBalance` | XLM Balance | Native XLM balance |
| `account.trustlineCount` | Trustline Count | Non-native trustlines |
| `account.totalAssets` | Total Assets | All balance entries including native |
| `account.nonNativeBalanceCount` | Non-Native Funded | Non-native trustlines with positive balance |

### Transaction fields

| Path | Label | Description |
|------|-------|-------------|
| `transactions.totalTransactions` | Total Transactions | Total transaction count |
| `transactions.successfulTransactions` | Successful Transactions | Count of successful transactions |
| `transactions.failedTransactions` | Failed Transactions | Count of failed transactions |
| `transactions.successRate` | Success Rate | Ratio (0–1) of successful to total |
| `transactions.weeklyActivity` | Weekly Activity | Transaction count in the last 7 days |
| `transactions.averageOperationsPerTx` | Avg Ops per Tx | Average operations per transaction |

### Network fields

| Path | Label | Description |
|------|-------|-------------|
| `network.latestLedgerSequence` | Latest Ledger | Most recent ledger sequence number |
| `network.baseFee` | Base Fee | Last ledger base fee (stroops) |
| `network.p90Fee` | P90 Fee | 90th percentile accepted fee (stroops) |
| `network.txSuccessCount` | Ledger Tx Success Count | Successful txs in latest ledger |
| `network.txFailedCount` | Ledger Tx Failed Count | Failed txs in latest ledger |
| `network.operationCount` | Ledger Operation Count | Total operations in latest ledger |
| `network.averageCloseSeconds` | Avg Close Time | Average ledger close time (seconds) |

## Formula Syntax

Formulas support:

- **Field references**: dot-separated paths (e.g. `account.xlmBalance`)
- **Numeric literals**: integers and decimals (e.g. `100`, `3.14`)
- **Operators**: `+`, `-`, `*`, `/` with standard precedence
- **Parentheses**: `(` `)` for grouping
- **Unary negation**: `-field.path` or `-(expr)`

### Examples

```
account.xlmBalance
transactions.successfulTransactions / transactions.totalTransactions
(network.baseFee + network.p90Fee) / 2
account.xlmBalance - (account.trustlineCount * 0.5)
-transactions.failedTransactions + transactions.successfulTransactions
```

### Limits

| Limit | Value |
|-------|-------|
| Max formula length | 1,024 characters |
| Max field depth | 5 segments |
| Max tokens | 256 |
| Max saved formulas | 100 |

## Display Formats

Each saved formula can specify a `format`:

| Format | Example output | Use case |
|--------|---------------|----------|
| `number` | `1,234.56` | General numeric values |
| `percentage` | `90.0%` | Ratios (value × 100) |
| `stroops` | `100 stroops` | Raw Stellar fee units |
| `xlm` | `1.0000000 XLM` | XLM amounts (stroops ÷ 10⁷) |

## CRUD API

```typescript
import {
  saveMetricFormula,
  getMetricFormula,
  updateMetricFormula,
  deleteMetricFormula,
  listMetricFormulas,
  clearAllMetricFormulas,
} from './src/lib/metricBuilder';

// Save
saveMetricFormula({ id: 'my-metric', name: 'My Metric', formula: '...' });

// Get by id
const formula = getMetricFormula('my-metric');

// List (optionally filtered by tags)
const all = listMetricFormulas();
const feeMetrics = listMetricFormulas(['fees']);

// Update
updateMetricFormula('my-metric', { name: 'Updated Name', formula: '...' });

// Delete
deleteMetricFormula('my-metric');

// Clear all (testing / reset)
clearAllMetricFormulas();
```

## Batch Evaluation

Evaluate multiple saved formulas against the same data snapshot. Failures
are captured individually so one bad formula does not block the others:

```typescript
import { evaluateBatch } from './src/lib/metricBuilder';

const results = evaluateBatch(
  ['fee-ratio', 'success-pct', 'missing-formula'],
  snapshot,
);

for (const [id, result] of results) {
  if ('error' in result) {
    console.warn(`${id} failed: ${result.error}`);
  } else {
    console.log(`${id} = ${result.formatted}`);
  }
}
```

## Import / Export

Back up or share saved formulas across environments:

```typescript
import { exportMetricFormulas, importMetricFormulas } from './src/lib/metricBuilder';

// Export
const json = exportMetricFormulas();
// → portable JSON array string

// Import (merges with existing; overwrites on id collision)
const { imported, skipped } = importMetricFormulas(json);
```

## Error Handling

All public functions throw `MetricBuilderError` with a typed `code` property:

| Code | When |
|------|------|
| `invalid_formula` | Expression cannot be parsed or is empty/too long |
| `invalid_input` | Non-string formula, null data, bad id/name, non-numeric field |
| `field_not_found` | A field path does not exist in the data snapshot |
| `division_by_zero` | Division by zero encountered during evaluation |
| `duplicate_id` | Attempting to save with an id that already exists |
| `not_found` | Attempting to update/evaluate a formula that does not exist |
| `limit_exceeded` | Exceeding the 100-formula storage limit |
| `storage_unavailable` | Reserved for environments where localStorage is missing |

```typescript
import { MetricBuilderError } from './src/lib/metricBuilder';

try {
  evaluateFormula('account.missing / 0', snapshot);
} catch (err) {
  if (err instanceof MetricBuilderError) {
    switch (err.code) {
      case 'field_not_found': /* guide user to pick a valid field */ break;
      case 'division_by_zero': /* show a user-friendly message */ break;
      default: console.error(err.message);
    }
  }
}
```

## Security Notes

- **No `eval()`**: Formulas are parsed with a hand-written recursive-descent
  parser. Arbitrary code execution is not possible.
- **Field path validation**: Only alphanumeric characters, underscores, and
  dots are allowed in identifiers. SQL injection, script injection, and
  prototype pollution via field paths are blocked by the tokenizer.
- **Storage isolation**: Saved formulas are persisted under a dedicated
  localStorage key (`stellar-dev-dashboard-saved-metric-formulas`) and
  scoped to the origin.
- **Complexity limits**: Token count, formula length, and field depth are
  capped to prevent denial-of-service via pathological expressions.

## Compatibility & Migration

- **Browser requirements**: Full functionality with any browser that
  supports `localStorage`. Falls back to in-memory storage in SSR, Web
  Workers, or privacy mode — formulas work but are not persisted across
  page reloads.
- **Data source compatibility**: Works with `buildAnalyticsSnapshot()` from
  `analytics.ts` and `ReportDataSet` from `customReports.ts`.
- **No breaking changes**: This is a new module. No existing API surfaces
  or data schemas are modified.
- **TypeScript**: Fully typed with exported types for `SavedMetricFormula`,
  `MetricEvaluationResult`, `MetricBuilderError`, and `MetricField`.

## Integration with Custom Reports

The metric builder extends the `customReports.ts` infrastructure. You can
use evaluated formulas as additional metric entries in report templates:

```typescript
import { evaluateFormula } from './src/lib/metricBuilder';
import { transformReportData } from './src/lib/customReports';

const reportData = transformReportData('account-activity', analyticsSnapshot);

// Add a custom metric to the report
const custom = evaluateFormula(
  'transactions.successRate * 100',
  analyticsSnapshot,
  'number',
);
reportData.metrics.push({ label: 'Custom Success %', value: custom.formatted });
```
