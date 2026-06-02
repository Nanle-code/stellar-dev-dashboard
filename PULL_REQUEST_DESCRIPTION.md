# Pull Request Description

## Summary

Implement responsive optimizations for dashboard charts and tables to improve mobile usability and touch interactions. This update also includes repository validation fixes required to build successfully.

## What changed

- Added mobile-friendly layouts to dashboard chart and table components:
  - `src/components/dashboard/AccountComparison.jsx`
  - `src/components/dashboard/AuditLog.jsx`
  - `src/components/charts/NetworkMetricsChart.jsx`
  - `src/components/charts/BalanceHistoryChart.jsx`
  - `src/components/charts/AccountActivityChart.jsx`
  - `src/components/charts/AdvancedChartSuite.jsx`
- Ensured responsive chart sizing, axis spacing, and touch-friendly rendering on smaller screens.
- Preserved desktop table/layout behavior while introducing mobile card/list alternatives.

## Repo fixes included

- Added missing `idb` dependency to `package.json` for `src/lib/alertRulesDb.js`
- Fixed syntax/duplicate export in `src/plugins/index.js`
- Exported `ee` alias from `src/lib/stellar.ts` to satisfy existing imports
- Imported missing `CircuitState` type in `src/lib/stellar.ts`
- Resolved ESLint warnings in `src/lib/stellar.ts`

## Validation

- `pnpm exec eslint ...` on changed files: passed
- `pnpm exec tsc --noEmit`: passed
- `pnpm exec vite build`: passed

## Files changed

- `package.json`
- `src/components/dashboard/AccountComparison.jsx`
- `src/components/dashboard/AuditLog.jsx`
- `src/components/charts/NetworkMetricsChart.jsx`
- `src/components/charts/BalanceHistoryChart.jsx`
- `src/components/charts/AccountActivityChart.jsx`
- `src/components/charts/AdvancedChartSuite.jsx`
- `src/lib/stellar.ts`
- `src/plugins/index.js`
