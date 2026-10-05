/**
 * Soroban resource-regression benchmarks (#980).
 *
 * Public surface for saving named invocations per contract, re-simulating them
 * against the currently deployed version, and diffing CPU / memory / fee usage
 * across versions with a configurable regression threshold.
 *
 * Quick start:
 * ```ts
 * import {
 *   upsertBenchmark,
 *   reSimulateBenchmarks,
 *   serializeBenchmarkFile,
 *   importBenchmarks,
 * } from '../lib/benchmarks'
 *
 * upsertBenchmark({ name: 'transfer', contractId: 'C...', functionName: 'transfer', args: [] })
 * const results = await reSimulateBenchmarks(loadBenchmarks(), simulateWithSorobanRpc, { thresholdPct: 10 })
 * const json = serializeBenchmarkFile(loadBenchmarks())
 * const summary = importBenchmarks(json) // validates the schema first
 * ```
 */

import { diffMeasurement, normalizeThresholdPct } from './diff'
import { saveMeasurement, upsertBenchmark } from './storage'
import { normalizeWasmHash } from './wasmHash'
import type {
  Benchmark,
  BenchmarkMeasurement,
  BenchmarkRunOptions,
  BenchmarkRunResult,
  BenchmarkSimulator,
  ResourceUsage,
} from './types'

export * from './types'
export * from './ids'
export * from './diff'
export * from './serialization'
export * from './storage'
export * from './wasmHash'

/** Resources recorded when a simulation fails: all counters are zero. */
export const ZERO_RESOURCES: ResourceUsage = { cpuInsns: 0, memBytes: 0, fee: 0 }

function normalizeResourceNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : 0
}

/** Coerce arbitrary input into a well-formed, non-negative resource snapshot. */
export function normalizeResources(resources: Partial<ResourceUsage> | null | undefined): ResourceUsage {
  return {
    cpuInsns: normalizeResourceNumber(resources?.cpuInsns),
    memBytes: normalizeResourceNumber(resources?.memBytes),
    fee: normalizeResourceNumber(resources?.fee),
  }
}

/**
 * Re-simulate one benchmark and compare the result with its baseline.
 *
 * - The measurement (including the Wasm hash it ran against) is persisted.
 * - If the benchmark has no baseline yet, the first successful measurement
 *   becomes the baseline, so subsequent runs have something to diff against.
 * - A simulator failure is captured as an unsuccessful measurement rather than
 *   thrown, so one bad invocation cannot abort a whole benchmark suite.
 */
export async function reSimulateBenchmark(
  benchmark: Benchmark,
  simulator: BenchmarkSimulator,
  options: BenchmarkRunOptions = {},
): Promise<BenchmarkRunResult> {
  const persist = options.persist !== false
  const thresholdPct = normalizeThresholdPct(options.thresholdPct)
  const measuredAt = new Date().toISOString()

  let measurement: BenchmarkMeasurement
  try {
    const output = await simulator(benchmark)
    measurement = {
      wasmHash: output?.wasmHash ? normalizeWasmHash(output.wasmHash) : '',
      resources: normalizeResources(output?.resources),
      measuredAt,
      success: output?.success !== false,
    }
    if (typeof output?.ledger === 'number' && Number.isFinite(output.ledger)) {
      measurement.ledger = output.ledger
    }
    if (output?.error) measurement.error = output.error
  } catch (error) {
    measurement = {
      wasmHash: benchmark.baseline?.wasmHash ?? '',
      resources: { ...ZERO_RESOURCES },
      measuredAt,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  let nextBenchmark = benchmark
  if (measurement.success && !benchmark.baseline) {
    nextBenchmark = { ...benchmark, baseline: measurement, updatedAt: Date.now() }
    if (persist) upsertBenchmark({ ...nextBenchmark, id: benchmark.id, baseline: measurement })
  }

  if (persist) saveMeasurement(benchmark.id, measurement)

  const diff = measurement.success
    ? diffMeasurement(nextBenchmark.baseline, measurement, thresholdPct, {
        benchmarkId: benchmark.id,
        benchmarkName: benchmark.name,
        contractId: benchmark.contractId,
      })
    : null

  return { benchmark: nextBenchmark, measurement, diff }
}

/**
 * Re-simulate every benchmark sequentially (keeps RPC load predictable) and
 * return their measurements and diffs.
 */
export async function reSimulateBenchmarks(
  benchmarks: Benchmark[],
  simulator: BenchmarkSimulator,
  options: BenchmarkRunOptions = {},
): Promise<BenchmarkRunResult[]> {
  const results: BenchmarkRunResult[] = []
  for (const benchmark of benchmarks) {
    results.push(await reSimulateBenchmark(benchmark, simulator, options))
  }
  return results
}

/** True when any benchmark in a run result set regressed past the threshold. */
export function hasRegressions(results: BenchmarkRunResult[]): boolean {
  return results.some((result) => result.diff?.regressed)
}
