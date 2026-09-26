# Visual Regression Testing

Playwright's built-in screenshot diffing catches unintended UI regressions across all major dashboard widgets and three viewport sizes (mobile, tablet, desktop).

## Running tests

```bash
# Run visual tests across all viewport projects (mobile, tablet, desktop, wide)
npm run test:visual

# Open the HTML report after a run
npm run test:visual:report
```

## Updating baselines

When you make **intentional** UI changes, regenerate the baseline screenshots:

```bash
# Regenerate all baseline snapshots
npm run test:visual:update

# Stage only the changed snapshots
git add tests/e2e/snapshots
git commit -m "chore: update visual baselines — <reason>"
```

Commit message should briefly explain why the visuals changed (e.g. "redesigned card borders", "added LedgerStats widget").

## What is covered

Tests run at three viewports for each major widget:

| Viewport | Size       |
| -------- | ---------- |
| mobile   | 375 × 667  |
| tablet   | 768 × 1024 |
| desktop  | 1440 × 900 |

Widgets tested: Connect Panel, Overview, Account, Transactions, NetworkStats, DEXExplorer, PathExplorer, RealTimeLedger, AccountComparison, PortfolioValue, plus Sidebar, Themes (dark/light), and Multisig panels.

### Contract interaction form (#894)

`tests/e2e/contract-interaction/visual.spec.ts` captures the contract
invocation form at every breakpoint: empty form, filled form, successful
simulation result, invalid contract id, oversized argument values, and a
Soroban RPC error state. Soroban/Horizon endpoints are mocked from
`tests/e2e/contract-interaction/fixtures.ts` so results are deterministic and
offline-safe. See `docs/features/contract-interaction-visual-regression.md`.

Baseline-aware behaviour: when a baseline is missing the suite attaches the
actual image and annotates the test as `baseline-missing` instead of failing
(the CI cache may be cold on the first run). Record baselines with:

```bash
UPDATE_VISUAL_BASELINES=1 npx playwright test --project=visual-desktop
```

Once baselines are committed/cached, set `VISUAL_REQUIRE_BASELINE=1` to make a
missing baseline a hard failure.


## Configuration

| Setting           | Value                                                             |
| ----------------- | ----------------------------------------------------------------- |
| Config file       | `playwright.config.ts`                                            |
| Viewport projects | `visual-mobile`, `visual-tablet`, `visual-desktop`, `visual-wide` |
| Snapshots         | `tests/e2e/snapshots/`                                            |
| Threshold         | `maxDiffPixelRatio: 0.002` (0.2%)                                 |
| Animations        | Disabled (`reducedMotion: reduce`)                                |
| Browser           | Chromium only (for baseline consistency)                          |

The threshold of 0.2% tolerates minor anti-aliasing differences. Raise it in `playwright.config.ts → expect.toHaveScreenshot.maxDiffPixelRatio` if you have persistent false positives from font rendering.

## CI/CD

Visual tests run on every PR via `.github/workflows/testing.yml` (multi-viewport matrix) and `.github/workflows/ci.yml`.

- **Chromatic** (optional): set `CHROMATIC_PROJECT_TOKEN` and run `npm run test:chromatic` for Storybook component snapshots.
- **Mutation testing**: `npm run test:mutation` (Stryker) — runs weekly in CI.
- **Coverage gate**: `npm run test:coverage:check` enforces thresholds from `testing/coverage-thresholds.json`.
- **Lighthouse CI**: `npm run test:lighthouse` with route-level Core Web Vitals budgets in `lighthouserc.cjs`, `lighthouserc.desktop.cjs`, and `lighthouserc.mobile.cjs`. Dedicated commands: `npm run test:lighthouse:desktop`, `npm run test:lighthouse:mobile`, and `npm run test:lighthouse:enforce`. See `docs/PERFORMANCE.md`.
- **Accessibility gate**: `npm run test:a11y` with axe-core WCAG 2.1 AA.

- On failure: diff artifacts are uploaded as `visual-diff-<run>` (retained 14 days) and a comment is posted on the PR explaining how to update baselines.
- Snapshots are cached per branch so PRs always compare against the target branch baseline.

## Troubleshooting

**Flaky test due to network data** — The tests use a known Testnet public key. If Horizon is unavailable, tests gracefully fall back to the disconnected/loading state screenshot.

**Font rendering differs across OS** — Always generate and compare baselines in the same environment. CI uses Ubuntu; local macOS/Windows may produce different anti-aliasing. Generate baselines inside a container or accept the CI-generated ones as source of truth.

**Snapshot directory path** — Snapshots follow the pattern:

```
tests/e2e/snapshots/tests/e2e/visual.spec.js/<snapshot-name>-visual.png
```
