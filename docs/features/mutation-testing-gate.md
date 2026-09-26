# Mutation Testing Gate for Critical Fee Math (#895)

Critical fee arithmetic — stroop conversion and fee estimation — now has a
dedicated Stryker mutation-testing gate. A pull request that degrades the
quality of these tests is blocked in CI, exactly like a failing unit test.

## What is gated

`src/lib/feeMath.ts` is the single source of truth for:

- `stroopsToXlm` / `xlmToStroops` — 1 XLM = 10,000,000 stroops conversions with
  7-decimal fixed-point output and fractional-stroop rejection (with binary
  floating-point tolerance of 1e-6 stroop).
- `clampBaseFee` — enforces the 100 stroop protocol minimum.
- `estimateTotalFee` — per-operation fee totals with a bounded congestion
  multiplier in [1, 10].
- `estimateCongestedFee` — utilization-scaled fee estimates (low-load
  threshold at 20% utilization, up to a 2.5× multiplier at saturation).

Every function validates its input and throws a typed `FeeMathError`
(`invalid_input` / `unsupported_environment`) instead of silently coercing.

## How the gate works

- **Config:** `stryker.feemath.conf.json` mutates only `src/lib/feeMath.ts`
  and runs the harness suite `tests/unit/feeMath.mutation.test.js` via
  `vitest.stryker.feeMath.config.js`.
- **Thresholds:** `high: 85`, `low: 70`, `break: 70`. Stryker exits non-zero
  when the score falls below 70; the wrapper script enforces the same floor
  from the machine-readable report.
- **Script:** `pnpm run test:mutation:feemath` runs
  `scripts/check-mutation-score.mjs`, which executes Stryker, parses
  `reports/mutation/mutation.json`, prints a CI-friendly summary, and fails
  the build when the score is under the gate. Override the floor with
  `node scripts/check-mutation-score.mjs --min 80`.

## Running locally

```bash
pnpm run test:mutation:feemath          # full gate (takes ~2–3 minutes)
pnpm exec stryker run --config-file stryker.feemath.conf.json --dryRunOnly
```

The HTML report is written to `reports/mutation/mutation.html`.

## Current baseline

The initial run scores **75.89%** (85 killed, 24 survived, 3 no-coverage).
The surviving mutants are almost exclusively error-message string mutants
(e.g. mutating `'invalid_input'` to `""` in thrown messages), which do not
affect numeric behavior. To raise the score further, assert on error codes:

```js
try {
  clampBaseFee(-5)
} catch (err) {
  expect(err.code).toBe('invalid_input')
  expect(err.message).toContain('non-negative')
}
```

## CI integration

The gate is wired into the existing mutation-testing job in
`.github/workflows/testing.yml` (schedule + manual dispatch), alongside the
security mutation run. Add it to PR-required workflows by invoking:

```yaml
- name: Fee-math mutation gate
  run: pnpm run test:mutation:feemath
```

## Security notes

- The gate runs with `inPlace: true`; Stryker restores originals from its
  sandbox backup. Commit any in-progress edits before running to avoid
  ambiguity after an interrupted run.
- `reports/` is git-ignored; reports are CI artifacts, not source.

## Migration / compatibility

- No runtime behavior changes: `feeMath.ts` is additive and currently unused
  by callers; `networkMonitoring.predictFees` remains the live congestion
  predictor. Future PRs should migrate fee arithmetic call sites to this
  module so the gate protects them.
- The existing `stryker.conf.json` (security gate on `src/utils/security.js`)
  is unchanged and continues to run on the weekly schedule.
