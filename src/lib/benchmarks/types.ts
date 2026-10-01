/**
 * Soroban resource-regression benchmarks — data model.
 *
 * A benchmark is a saved invocation (contract id + function + args) that can be
 * re-simulated against the currently deployed contract version. Every
 * re-simulation stores the measured resources together with the Wasm hash it
 * ran against, so old and new contract versions can be diffed per resource.
 *
 * Issue: #980 [2026 Soroban] Detect resource usage regressions between contract versions
 */

/** Identifier written into exported benchmark files. */
export const BENCHMARK_SCHEMA_ID = 'stellar-dev-dashboard/benchmarks' as const

/** Current schema version for exported benchmark files. */
export const BENCHMARK_SCHEMA_VERSION = 1

/** Resource counters measured for a single Soroban invocation. */
export const RESOURCE_KEYS = ['cpuInsns', 'memBytes', 'fee'] as const

/** Union of the resource counters that participate in a regression diff. */
export type ResourceKey = (typeof RESOURCE_KEYS)[number]

/** Human-readable labels for each resource counter (UI + docs parity). */
export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  cpuInsns: 'CPU instructions',
  memBytes: 'Memory (bytes)',
  fee: 'Fee (stroops)',
}

/**
 * A single point-in-time resource measurement. `fee` is the minimum resource
 * fee in stroops (as reported by Soroban RPC `minResourceFee`).
 */
export interface ResourceUsage {
  cpuInsns: number
  memBytes: number
  fee: number
}

/** A contract invocation argument, matching the dashboard's invoke form. */
export interface BenchmarkArg {
  type: string
  value: string
}

/**
 * A named, saved invocation for a given contract. `baseline` is the reference
 * measurement that later re-simulations are diffed against; it is null until
 * the benchmark has been run (or the user supplies baseline numbers).
 */
export interface Benchmark {
  id: string
  name: string
  contractId: string
  functionName: string
  args: BenchmarkArg[]
  sourceAccount: string
  network: string
  baseline: BenchmarkMeasurement | null
  createdAt: number
  updatedAt: number
}

/**
 * The result of simulating a benchmark. The Wasm hash records which contract
 * version produced the numbers; `success` is false when the simulation failed
 * (in which case `error` is populated and `resources` are zeroed).
 */
export interface BenchmarkMeasurement {
  wasmHash: string
  resources: ResourceUsage
  measuredAt: string
  success: boolean
  ledger?: number
  error?: string
}

/** Per-resource delta between a baseline and a re-simulated measurement. */
export interface ResourceDelta {
  key: ResourceKey
  label: string
  oldValue: number
  newValue: number
  delta: number
  deltaPct: number
  /** True when `deltaPct` is strictly greater than the configured threshold. */
  regression: boolean
}

/** Full per-resource diff for one benchmark. */
export interface ResourceDiff {
  benchmarkId: string
  benchmarkName: string
  contractId: string
  oldWasmHash: string
  newWasmHash: string
  /** True when baseline and re-simulation ran against the same Wasm hash. */
  sameVersion: boolean
  thresholdPct: number
  rows: ResourceDelta[]
  regressionCount: number
  regressed: boolean
  comparedAt: string
}

/** Envelope written by the JSON exporter and accepted by the importer. */
export interface BenchmarkFile {
  schema: typeof BENCHMARK_SCHEMA_ID
  version: number
  exportedAt: string
  benchmarks: Benchmark[]
}

/** Output of a benchmark simulator, before it is turned into a measurement. */
export interface BenchmarkSimulationResult {
  resources: ResourceUsage
  wasmHash: string
  success?: boolean
  error?: string
  ledger?: number
}

/** Pluggable re-simulation function (Soroban RPC in the app, fake in tests). */
export type BenchmarkSimulator = (benchmark: Benchmark) => Promise<BenchmarkSimulationResult>

/** Options shared by the re-simulation helpers. */
export interface BenchmarkRunOptions {
  thresholdPct?: number
  /** Persist measurements to storage (default true). */
  persist?: boolean
}

/** Result of re-simulating a single benchmark. */
export interface BenchmarkRunResult {
  benchmark: Benchmark
  measurement: BenchmarkMeasurement
  diff: ResourceDiff | null
}
