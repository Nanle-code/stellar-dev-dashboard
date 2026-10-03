# Cohort Retention Views for Account Activity

## Overview

Issue #863 introduces **Cohort Retention Views** for account activity in the Stellar Dev Dashboard analytics workspace.

This feature enables developers, node operators, and ecosystem analysts to group accounts by their first-seen period (Day, Week, or Month) and track their retention rates over subsequent periods.

---

## Features & Capabilities

1. **Cohort Heatmap Matrix Table**:
   - Displays cohort start dates, initial cohort size (Period 0), and subsequent retention rates (% or account count).
   - HSL-tailored color gradients indicating retention depth (Bright Teal/Cyan for 80-100%, Emerald Green for 60-79%, Amber for 40-59%, Orange for 20-39%, Purple for 1-19%).
   - Accessible hover tooltips showing active account counts vs total cohort size.

2. **Retention Curve Visualization**:
   - Interactive line chart tracking the aggregated average retention curve across all cohorts over time.

3. **Multi-Period Granularity**:
   - Toggle between **Daily** (`day`), **Weekly** (`week`), and **Monthly** (`month`) cohort groupings.

4. **Activity Type Filtering**:
   - Filter cohort activity by **All Activities**, **Payments**, **Smart Contracts** (Soroban), or **DEX Trades**.

5. **Data Exporting**:
   - One-click CSV and JSON export options for offline reporting and data pipeline integration.

6. **Summary Metrics Dashboard**:
   - Key indicators for Total Cohorts Tracked, Total Unique Accounts, Avg Period 1 Retention (+1 Wk/Day/Mo), Avg Period 4 Retention, and Best Performing Cohort.

---

## Architecture & File Structure

- **`src/lib/cohortRetention.ts`**: Pure TypeScript domain logic for calculating cohort retention matrices, periods, statistics, formatting, CSV/JSON exports, and input validation.
- **`src/components/dashboard/CohortRetentionView.tsx`**: React UI component rendering the cohort controls, summary metrics, heatmap matrix table, line chart, and export triggers.
- **`src/lib/__tests__/cohortRetention.test.ts`**: Automated unit tests covering primary calculation flows, boundary cases, and failure paths.
- **`src/components/dashboard/__tests__/CohortRetentionView.test.tsx`**: React component tests validating UI rendering, filter switching, view mode toggling, and export callbacks.
- **`src/routes/routes.ts`**: Registered route `/cohortRetention` under the `analytics` group.

---

## Compatibility Notes

- **Browser & Runtime Requirements**:
  - Compatible with modern browsers supporting ES2022+ and HTML5 Canvas / SVG rendering (Recharts).
  - Uses native UTC date calculations (`Date.UTC`) for standard time zone independence across regions.
- **SSR / Node & Test Environment Fallbacks**:
  - File download handlers automatically detect browser environments (`window`, `URL.createObjectURL`) and degrade gracefully without throwing errors in Node.js, SSR, or JSdom test environments.
- **Node.js Policy**:
  - Adheres to Node.js >= 22 engine policy as specified in `package.json`.

---

## Security Notes

- **PII & Address Privacy**:
  - Stellar public keys (`G...`) are processed locally within the client memory. No private key, seed phrase, or unencrypted account metadata is recorded or exported.
- **Input Sanitization**:
  - All account IDs and activity strings are trimmed and sanitized before insertion into cohort structures and CSV export rows to prevent CSV injection or cross-site scripting (XSS).
- **Error Boundaries & Circuit Breakers**:
  - Calculation errors return typed result objects (`CohortRetentionResult`) with explicit error codes (`INVALID_INPUT`, `UNSUPPORTED_ENVIRONMENT`, `CALCULATION_FAILED`), preventing unhandled runtime exceptions from crashing the dashboard.

---

## Migration & Integration Guide

### Consuming the Cohort Library in Custom Components

```typescript
import { calculateCohortRetention } from './lib/cohortRetention';

const result = calculateCohortRetention(accountActivities, {
  granularity: 'week',
  activityFilter: 'all',
  maxPeriods: 8,
});

if (result.ok) {
  console.log('Cohort Rows:', result.data.cohorts);
  console.log('Avg Period 1 Retention:', result.data.stats.avgPeriod1Retention);
} else {
  console.error('Cohort Error:', result.error.message);
}
```

### Embedding the UI View

```tsx
import CohortRetentionView from './components/dashboard/CohortRetentionView';

export function MyAnalyticsTab() {
  return <CohortRetentionView title="Account Retention" />;
}
```
