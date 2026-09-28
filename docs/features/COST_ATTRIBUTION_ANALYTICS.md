# Cost Attribution by Application Tag & Memo Prefix (#868)

## Overview

The `CostThresholdManager` provides project budgeting, cost tracking, and alert threshold monitoring for Stellar transactions by attributing fees and transfer volumes to developer-defined application tags or memo prefixes.

Developers can categorize Stellar transaction fees and payment volumes by application feature (e.g., `billing`, `auth`, `nft-drop`, `defi-swap`, `governance`) using literal memo prefixes (e.g. `[APP:billing]`, `BILL:`, `PAY:`) or custom regular expression patterns.

---

## Key Features

1. **Tag-Based & Memo-Prefix Attribution**:
   - Matches literal prefixes (e.g., `[APP:billing]`, `AUTH:`) or custom regex patterns (e.g., `^PROJ-[0-9]+`).
   - Automatically discovers unbudgeted tag prefixes embedded in memos formatted like `[APP:tag]` or `TAG:tag`.

2. **Project Budgeting & Threshold Monitoring**:
   - Configurable Stroops fee budget limits and transfer volume tracking per tag.
   - Configurable warning threshold percentages (default: 80%).
   - Dynamic budget status flags: `ok`, `warning` (>= 80%), `exceeded` (>= 100%), and `unbudgeted`.

3. **Export Capabilities**:
   - Export attribution reports directly as formatted `JSON` or `CSV`.

4. **Environment Fallback & Fault Tolerance**:
   - Graceful fallback when `localStorage` or browser storage APIs are unavailable (e.g. SSR, restricted cross-origin iframe, or private browsing mode).
   - Safe parsing of non-numeric, `NaN`, or negative fee strings without crashing.
   - Safe isolation for malformed regular expression rules.

---

## Developer Guidance & Usage

### Basic Usage

```typescript
import { getCostThresholdManager } from './src/lib/costThresholdManager'

const manager = getCostThresholdManager()

// Add a budget rule for the billing feature
manager.addRule({
  tag: 'billing',
  memoPrefix: '[APP:billing]',
  budgetLimitStroops: 10_000_000, // 1 XLM budget
  warningThresholdPercent: 80,
})

// Attribute transactions
const summary = manager.attributeTransactions(transactions)

console.log(`Total Attributed Fee: ${summary.totalAttributedFeeXlm} XLM`)
console.log(summary.tagBreakdown)
```

### Exporting Reports

```typescript
const csvData = manager.exportAttributionReport(summary, 'csv')
const jsonData = manager.exportAttributionReport(summary, 'json')
```

---

## Compatibility, Security, and Migration Notes

- **Compatibility**: Compatible with Node.js >= 22 and all modern browsers. Fully functional in SSR (Server-Side Rendering) contexts with in-memory rule fallback.
- **Security & Privacy**: Memo analytics processes metadata exclusively on the client side or in explicit service boundaries. Private keys, secret seeds, or sensitive payload data are never logged or exported.
- **Migration**: Zero breaking changes. `buildAnalyticsSnapshot()` in `analytics.ts` has been updated to include `costAttribution` in the snapshot response seamlessly.
