## Summary

Implements cost attribution by application tag or memo prefix for project budgeting (#868). Attributes transaction fees (in Stroops and XLM) and payment transfer volumes to developer-defined project tags (e.g. `billing`, `auth`, `nft-drop`, `defi-swap`) via literal memo prefixes (e.g., `[APP:billing]`, `BILL:`) or custom regex patterns.

- **Domain Library (`src/lib/costThresholdManager.ts`)**: `CostThresholdManager` implementation for tag definition, memo prefix and regex pattern matching, budget limits, volume tracking, threshold alerts (`ok`, `warning` >= 80%, `exceeded` >= 100%, `unbudgeted`), auto-discovery of embedded tags (`[APP:tag]`), JSON/CSV report exports, and graceful SSR/storage error handling.
- **Analytics Integration (`src/lib/analytics.ts`)**: Embedded cost attribution calculations into `buildAnalyticsSnapshot()` and re-exported `CostThresholdManager`.
- **Documentation**: User-facing & developer guide in [`docs/features/COST_ATTRIBUTION_ANALYTICS.md`](docs/features/COST_ATTRIBUTION_ANALYTICS.md) and changelog entry in `CHANGELOG.md`.

Closes #868

## How was this tested?

Ran unit tests:
`pnpm run test:unit src/lib/__tests__/costThresholdManager.test.ts` (13 passed)

- **Primary flow**: Verified adding/updating rules, attributing fees and payment volumes to configured tags by memo prefix, auto-discovering unbudgeted tag prefixes, calculating fee sums in Stroops and XLM, average fee calculations, and JSON/CSV report exporting.
- **Boundary cases**: Verified empty transaction list handling, exact warning threshold calculation (80.0%), exact 100% budget cap exceedance, zero-fee transactions, and case-insensitive memo matching.
- **Failure cases**: Verified `null` / `undefined` / non-array transaction inputs, malformed transaction objects with invalid fee strings (`"invalid_number"`, negative fees), malformed regex rules (unclosed brackets), throwing `localStorage` security/quota errors in restricted SSR/iframe sandboxes, and missing required rule properties.

## Merge requirements

A PR is merged only when **every** box below is true. See
[Merge requirements](https://github.com/Nanle-code/stellar-dev-dashboard/blob/master/docs/contributing.md#merge-requirements) for the full policy.

- [x] All required CI checks pass on the latest commit (not just an earlier push).
- [x] No required checks are failing, pending, or skipped — re-run or fix them; do not ask for a merge while any are outstanding.
- [x] The branch has no merge conflicts with the target branch (rebase or merge `master` if GitHub shows "This branch has conflicts").
- [x] Tests were added or updated for the change (primary flow, a boundary case, and a failure case).
- [x] Docs were updated where behaviour, configuration, or security posture changed.
