## Summary

Adds cohort retention views for Stellar account activity to the Analytics dashboard (#863). Accounts are grouped by their first-seen period (Day, Week, Month) and subsequent retention decay rates are tracked across subsequent time periods.

- **Domain Library (`src/lib/cohortRetention.ts`)**: Pure TypeScript calculation engine for cohort matrices, summary statistics, period headers, activity filtering (Payments, Smart Contracts, DEX Trades), CSV/JSON exports, and discriminated union error handling (`CohortRetentionResult`).
- **UI Component (`src/components/dashboard/CohortRetentionView.tsx`)**: Heatmap matrix table with HSL-tailored dark mode color gradients, Recharts line chart for average retention curve, granularity controls, view mode toggles (`%` vs `#`), and export buttons.
- **Integration**: Embedded in `Analytics.tsx` and registered route `/cohortRetention` in `routes.ts`.
- **Documentation**: Detailed guide in [`docs/features/COHORT_RETENTION_ANALYTICS.md`](docs/features/COHORT_RETENTION_ANALYTICS.md) and changelog entry in `CHANGELOG.md`.

Closes #863

## How was this tested?

Ran unit and component tests:
`pnpm run test:unit -- src/lib/__tests__/cohortRetention.test.ts src/components/dashboard/__tests__/CohortRetentionView.test.tsx` (20 passed)

- **Primary flow**: Verified daily, weekly, monthly cohort calculations, retention percentages, active account matrices, aggregated curve data points, activity filtering, and CSV/JSON export generation.
- **Boundary cases**: Verified empty activity list handling, single-account cohorts, 100% retention across all periods, 0% retention decay, date boundary parsing (UTC month/week boundaries), and `minCohortSize` filtering.
- **Failure cases**: Verified `null` / non-array activity inputs, invalid granularity strings (`'year'`), negative period parameters, malformed records with invalid dates/missing IDs, calculation error objects, and graceful fallback when `URL.createObjectURL` is unsupported in JSdom/SSR.

## Merge requirements

A PR is merged only when **every** box below is true. See
[Merge requirements](https://github.com/Nanle-code/stellar-dev-dashboard/blob/master/docs/contributing.md#merge-requirements) for the full policy.

- [x] All required CI checks pass on the latest commit (not just an earlier push).
- [x] No required checks are failing, pending, or skipped — re-run or fix them; do not ask for a merge while any are outstanding.
- [x] The branch has no merge conflicts with the target branch (rebase or merge `master` if GitHub shows "This branch has conflicts").
- [x] Tests were added or updated for the change (primary flow, a boundary case, and a failure case).
- [x] Docs were updated where behaviour, configuration, or security posture changed.
