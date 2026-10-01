# Contract Interaction Visual Regression Suite

Implements **#894 — [2026 Testing] Add contract interaction visual regression suite**.

Captures and compares visual baselines for the contract invocation form across
breakpoints, so layout or styling regressions in the Soroban contract UI are
caught before review.

## Where it lives

| File | Purpose |
| --- | --- |
| `tests/e2e/contract-interaction/visual.spec.ts` | The Playwright suite. Named `visual.spec.ts` so it matches the `visual-*` projects (`testMatch: '**/visual.spec.*'`). |
| `tests/e2e/contract-interaction/contractFormHarness.ts` | Navigation, deterministic network mocks, and the baseline-aware screenshot assertion. |
| `tests/e2e/contract-interaction/fixtures.ts` | Pure Soroban/Horizon fixtures + endpoint classification (unit-tested). |
| `tests/unit/visual/contractFormFixtures.test.ts` | Vitest coverage for the fixture/routing logic. |

## Breakpoint coverage

The suite runs once per `visual-*` project, so every assertion is captured at
each breakpoint defined in `tests/visual/viewports.ts`:

| Project | Viewport |
| --- | --- |
| `visual-mobile` | 375 × 667 |
| `visual-tablet` | 768 × 1024 |
| `visual-desktop` | 1280 × 800 |
| `visual-wide` | 1440 × 900 |

Snapshots are written through `snapshotPathTemplate`, so the viewport name is
part of each file name and baselines never collide across projects.

## Coverage

**Primary flow**

- default (empty) invocation form;
- form filled with a valid contract id (`C` + 55 base32 chars);
- successful `simulateTransaction` renders the result panel.

**Boundary cases**

- malformed contract id keeps the form mounted, preserves input and shows the
  validation state;
- oversized argument values (120 digits) do not break the layout;
- at each breakpoint the form width stays within the viewport.

**Failure paths**

- a Soroban JSON-RPC error (`HostError: contract trapped during simulation`)
  surfaces an error state;
- a missing baseline is reported as `baseline-missing` and does not fail the
  run (see below).

## Determinism

`mockStellarNetwork(page)` intercepts every non-app request:

- Soroban RPC (`simulateTransaction`, `getLatestLedger`, `getNetwork`, …) is
  served from `fixtures.ts`;
- Horizon responses return empty record sets;
- the app's own assets pass through untouched.

This removes network flakiness and keeps the form/result/error states identical
between runs. `classifyEndpoint` decides which fixture to serve and is covered
by unit tests, including malformed URLs.

## Baselines and unsupported environments

The CI job restores `tests/e2e/snapshots` from the `actions/cache` entry and
saves it after a green run. Because a cold cache means no baseline exists,
`expectStableScreenshot()` degrades gracefully:

| Situation | Behaviour |
| --- | --- |
| Baseline exists | Real Playwright pixel comparison (`maxDiffPixelRatio: 0.002`), diff artifacts on failure. |
| Baseline missing + `UPDATE_VISUAL_BASELINES=1` | Writes the baseline, attaches the image, passes. |
| Baseline missing + `VISUAL_REQUIRE_BASELINE=1` | Fails with a message pointing at the recording command. |
| Baseline missing otherwise | Attaches the actual image, annotates `baseline-missing`, passes. |

If the build under test has no Contracts tab or no invocation form, the tests
`test.skip` with an explicit reason instead of failing.

## Running

```bash
# Compare against recorded baselines (all breakpoints)
npx playwright test --project=visual-mobile
npx playwright test --project=visual-desktop

# Record baselines from scratch
UPDATE_VISUAL_BASELINES=1 npx playwright test --project=visual-desktop

# Require baselines (strict mode, e.g. after committing snapshots)
VISUAL_REQUIRE_BASELINE=1 npx playwright test --project=visual-wide
```

## Compatibility & migration notes

- No product code changed; the suite is additive and does not affect existing
  `tests/e2e/visual.spec.js` baselines.
- The suite is intentionally baseline-tolerant so a first-time run (cold CI
  cache) cannot break the visual-regression job. Enable
  `VISUAL_REQUIRE_BASELINE=1` once baselines are committed or reliably cached to
  turn the tolerance into a hard gate.
- Mocking is scoped to Stellar endpoints only; unrelated third-party requests
  still pass through, so if the shell gains a new external data source, add a
  fixture to `fixtures.ts` rather than loosening the threshold.
