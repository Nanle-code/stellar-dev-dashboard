# Visual Regression Testing

Playwright's built-in screenshot diffing catches unintended UI regressions across all major dashboard widgets and three viewport sizes (mobile, tablet, desktop).

## Running tests

```bash
# Run visual tests against the dev server (starts automatically)
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

| Viewport  | Size       |
|-----------|------------|
| mobile    | 375 × 667  |
| tablet    | 768 × 1024 |
| desktop   | 1440 × 900 |

Widgets tested: Connect Panel, Overview, Account, Transactions, NetworkStats, DEXExplorer, PathExplorer, RealTimeLedger, AccountComparison, PortfolioValue, plus Sidebar, Themes (dark/light), and Multisig panels.

## Configuration

| Setting | Value |
|---------|-------|
| Config file | `playwright.config.ts` |
| Snapshots | `tests/e2e/snapshots/` |
| Threshold | `maxDiffPixelRatio: 0.002` (0.2%) |
| Animations | Disabled (`reducedMotion: reduce`) |
| Browser | Chromium only (for baseline consistency) |

The threshold of 0.2% tolerates minor anti-aliasing differences. Raise it in `playwright.config.ts → expect.toHaveScreenshot.maxDiffPixelRatio` if you have persistent false positives from font rendering.

## CI/CD

Visual tests run automatically on every pull request via the `visual-regression` job in `.github/workflows/ci.yml`.

- On failure: diff artifacts are uploaded as `visual-diff-<run>` (retained 14 days) and a comment is posted on the PR explaining how to update baselines.
- Snapshots are cached per branch so PRs always compare against the target branch baseline.

## Troubleshooting

**Flaky test due to network data** — The tests use a known Testnet public key. If Horizon is unavailable, tests gracefully fall back to the disconnected/loading state screenshot.

**Font rendering differs across OS** — Always generate and compare baselines in the same environment. CI uses Ubuntu; local macOS/Windows may produce different anti-aliasing. Generate baselines inside a container or accept the CI-generated ones as source of truth.

**Snapshot directory path** — Snapshots follow the pattern:
```
tests/e2e/snapshots/tests/e2e/visual.spec.js/<snapshot-name>-visual.png
```
