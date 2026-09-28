# #863 [2026 Analytics] Add cohort retention views for account activity

## Summary

Resolves #863 by adding **Cohort Retention Views for Account Activity** to the Analytics workspace in `stellar-dev-dashboard`.

This PR provides cohort matrix heatmaps and retention curve visualizations that group accounts by their first-seen period (Day, Week, or Month) and analyze subsequent retention over time.

---

## Key Changes Included

1. **Domain Library (`src/lib/cohortRetention.ts`)**:
   - `calculateCohortRetention()`: Pure TypeScript calculation engine for cohort matrices, summary statistics, periods headers, and activity filtering (Payments, Smart Contracts, DEX Trades).
   - `exportCohortDataAsCsv()` & `exportCohortDataAsJson()`: Export helpers for offline analysis and data pipelines.
   - Robust input validation, boundary checking, and discriminated error union (`CohortRetentionResult`).

2. **React UI Component (`src/components/dashboard/CohortRetentionView.tsx`)**:
   - Modern, high-aesthetic heat map matrix table with HSL-tailored dark mode color gradients.
   - Granularity selector (`Daily`, `Weekly`, `Monthly`).
   - View mode toggle (`Percentage %` vs `Account Count #`).
   - Interactive Recharts LineChart for the aggregated average retention curve.
   - Download buttons for CSV and JSON exports.
   - Accessible tooltips, ARIA attributes, and error/empty state fallbacks.

3. **Analytics Integration & Routing**:
   - Embedded `CohortRetentionView` in `src/components/dashboard/Analytics.tsx`.
   - Registered `/cohortRetention` route in `src/routes/routes.ts`.

4. **Automated Tests**:
   - **`src/lib/__tests__/cohortRetention.test.ts`** (16 tests): Tests primary flows (weekly/daily/monthly cohorts), boundary cases (empty datasets, single activity, 0% & 100% retention, timestamp parsing), and failure paths (null inputs, invalid granularity, negative parameters, malformed records).
   - **`src/components/dashboard/__tests__/CohortRetentionView.test.tsx`** (4 tests): Component tests validating UI rendering, controls, view mode toggles, and export triggers.

5. **User & Developer Documentation**:
   - **`docs/features/COHORT_RETENTION_ANALYTICS.md`**: Complete guide covering architecture, features, compatibility, security, and migration/integration code snippets.
   - **`CHANGELOG.md`**: Entry under `## [Unreleased]`.

---

## Acceptance Criteria Verification

- [x] Objective implemented with clear handling for invalid input, unsupported environments, and failure paths.
- [x] Automated tests cover the primary flow, at least one boundary case, and at least one failure case.
- [x] User-facing documentation and developer guidance updated with compatibility, security, and migration notes.
- [x] All 20 new automated unit tests passing cleanly.
