# Soroban Resource Regression Benchmarks

**Issue:** #980 — Detect resource usage regressions between contract versions.

Contract upgrades can quietly make common calls more expensive. This feature lets
you save an invocation as a named benchmark, replay it against the currently
deployed contract version through Soroban RPC, and compare CPU instructions,
memory bytes, and resource fees against the version you captured earlier.

## Where it lives

The panel is rendered inside the contract history view
(`src/components/dashboard/ContractHistory.tsx`), which is reachable from the
Soroban **Contracts → History** tab. The UI is implemented in
`src/components/dashboard/ResourceRegressionBenchmarks.tsx` and the logic lives
in `src/lib/benchmarks/`.

## Saving a benchmark

Fill in the **Save benchmark** form and press *Save benchmark*:

| Field | Required | Notes |
| --- | --- | --- |
| Name | yes | Unique per contract; re-saving the same name updates in place. |
| Contract ID | yes | Soroban contract address (`C…`). |
| Function | yes | Entry point to invoke. |
| Source account | yes | Account used to build the simulation transaction (`G…`). |
| Network | yes | `testnet`, `mainnet`, or `futurenet`. |
| Arguments | no | JSON array of `{ "type": "address", "value": "G…" }` entries. |
| Baseline CPU / memory / fee | no | Optional historical numbers. |
| Baseline Wasm hash | no | The Wasm hash the baseline was measured against. |

Baseline numbers are optional. If you leave them blank, the **first successful
re-simulation becomes the baseline** automatically, so you can capture the
"before" numbers from the currently deployed version and compare against future
deployments.

## Re-simulating and reading the diff

Press *Re-simulate all*. Each benchmark is replayed sequentially through
`simulateContractCall` from `src/lib/stellar.ts`, and the measured resources are
stored together with the Wasm hash the run was bound to. The per-resource table
then shows, for every benchmark:

```
Resource            Baseline   Current   Δ        Δ%       Status
CPU instructions    1,000,000  1,300,000 +300,000 +30.0%   REGRESSION
Memory (bytes)      20,480     20,480    0        0.0%     OK
Fee (stroops)       12,000     11,000    -1,000   -8.3%    IMPROVED
```

Regressions are highlighted in red; improvements are green. A failed
simulation is recorded as an unsuccessful measurement with its error message
instead of aborting the rest of the suite.

### Threshold semantics

A resource is flagged as a **regression only when it grows by strictly more than
the configured threshold percentage**. Changes exactly at the threshold are
accepted. This keeps a "+10% is fine" budget from failing on a change that is
exactly +10%.

| Threshold | Change | Regression? |
| --- | --- | --- |
| 10% | +0% | No |
| 10% | +10% (exactly at the threshold) | No |
| 10% | +10.5% | Yes |
| 10% | −20% (improvement) | No |
| 0% | +1% | Yes |
| 10% | baseline `0` → any positive value | Yes |

The threshold is persisted in `localStorage` under
`stellar-dashboard:contract-benchmark-threshold:v1` and defaults to **10%**.
Use `0%` to flag any increase at all.

## Export / import for CI

Press *Export JSON* to download a versioned document and *Import JSON* to load
one back (merging by benchmark id, then by `contractId` + `name`). The same
functions are available programmatically:

```ts
import {
  loadBenchmarks,
  exportBenchmarksJson,
  importBenchmarks,
  reSimulateBenchmarks,
} from './src/lib/benchmarks'

// Export the current suite for archival as a CI artifact
const json = exportBenchmarksJson()

// Import a suite produced by an earlier run (schema is validated first)
importBenchmarks(json, { merge: true })

// Replay every benchmark and fail the build on any regression
const results = await reSimulateBenchmarks(loadBenchmarks(), simulator, { thresholdPct: 10 })
if (results.some((result) => result.diff?.regressed)) process.exit(1)
```

The exported document uses this shape:

```json
{
  "schema": "stellar-dev-dashboard/benchmarks",
  "version": 1,
  "exportedAt": "2026-09-26T00:00:00.000Z",
  "benchmarks": [
    {
      "id": "6f1c…",
      "name": "transfer-hot-path",
      "contractId": "C…",
      "functionName": "transfer",
      "args": [{ "type": "address", "value": "G…" }],
      "sourceAccount": "G…",
      "network": "testnet",
      "baseline": {
        "wasmHash": "ab12…",
        "resources": { "cpuInsns": 1000000, "memBytes": 20480, "fee": 12000 },
        "measuredAt": "2026-09-26T00:00:00.000Z",
        "success": true
      },
      "createdAt": 1758844800000,
      "updatedAt": 1758844800000
    }
  ]
}
```

Import validation is strict: malformed JSON, an unsupported `schema`/`version`,
or a benchmark entry missing `name`, `contractId`, `functionName`, or with
non-numeric resource counters throws a `BenchmarkImportError` whose `issues`
array lists every problem. Importing validates the whole document before
writing anything, so a partially valid file cannot corrupt the stored suite.
A bare JSON array of benchmark objects is also accepted.

## Compatibility, security, and migration notes

- **Storage:** benchmarks and results are stored in `localStorage`. Data is
  per-browser; use export/import to move a suite between machines or into CI.
  Clearing site data removes benchmarks.
- **No new dependencies:** the module is dependency-free TypeScript and reuses
  the existing Vitest setup. `package.json` and the lockfile are unchanged.
- **RPC usage:** re-simulation hits Soroban RPC for every benchmark,
  sequentially, so a large suite is intentionally paced rather than fanned out.
- **Secrets:** benchmarks store only the public source account and invocation
  arguments — never a secret key — so exported JSON is safe to archive.
- **Wasm hashes:** the hash is captured with each result. When the dashboard
  cannot read the contract instance (offline, built-in Stellar Asset Contract,
  or an RPC version mismatch), provide the current hash in the
  *Current Wasm hash* field or the run falls back to the baseline hash and is
  labelled "same Wasm hash".
- **Migration:** existing contract-history records are untouched; benchmarks are
  additive and can be created at any time. Removing the feature only orphans the
  two `stellar-dashboard:contract-benchmark*` storage keys.

## Tests

`src/lib/benchmarks/__tests__/benchmarks.test.ts` covers the primary diff flow,
boundary behaviour (exactly at / just under / just over the threshold, zero
baselines, invalid thresholds), and failure cases (malformed JSON import,
schema violations, a simulator that throws).

```bash
pnpm run test        # Vitest suite
pnpm run type-check  # tsc --noEmit
```

## Related reading

- [Soroban contract debugging tutorials](./soroban-debugging-tutorials.md)
- [Soroban best practices](../SOROBAN_BEST_PRACTICES.md)
- [Performance regression detection](../PERFORMANCE_REGRESSION_DETECTION.md)
