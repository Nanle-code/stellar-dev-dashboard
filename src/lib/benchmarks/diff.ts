/**
 * Resource diffing for Soroban benchmarks (#980).
 *
 * Threshold semantics: a resource is flagged as a regression only when its
 * growth is STRICTLY GREATER than the configured threshold percentage. A change
 * exactly at the threshold (for example +10% with a 10% threshold) is treated
 * as acceptable, and improvements (negative growth) are never regressions.
 */

import {
  RESOURCE_KEYS,
  RESOURCE_LABELS,
  type BenchmarkMeasurement,
  type ResourceDelta,
  type ResourceDiff,
  type ResourceUsage,
} from './types'

/** Default regression threshold, in percent, when callers do not specify one. */
export const DEFAULT_REGRESSION_THRESHOLD_PCT = 10

/** Tolerance used when comparing a delta against the threshold. */
const THRESHOLD_EPSILON = 1e-9

/**
 * Coerce an arbitrary threshold input into a finite, non-negative number.
 * Invalid input falls back to the default so a bad form value can never
 * silently disable or invert regression detection.
 */
export function normalizeThresholdPct(thresholdPct?: number): number {
  if (typeof thresholdPct !== 'number' || !Number.isFinite(thresholdPct) || thresholdPct < 0) {
    return DEFAULT_REGRESSION_THRESHOLD_PCT
  }
  return thresholdPct
}

/**
 * Percentage change from `oldValue` to `newValue`.
 *
 * When the baseline is zero we cannot divide, so any non-zero increase is
 * reported as a 100% change (a zero baseline growing is always a regression
 * under any positive threshold). Zero-to-zero is 0%.
 */
export function computeDeltaPct(oldValue: number, newValue: number): number {
  if (!Number.isFinite(oldValue) || !Number.isFinite(newValue)) return 0
  if (oldValue === 0) return newValue === 0 ? 0 : 100
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100
}

/** Read a resource counter defensively, defaulting to 0. */
function readResource(resources: Partial<ResourceUsage> | null | undefined, key: keyof ResourceUsage): number {
  const value = Number(resources?.[key])
  return Number.isFinite(value) ? value : 0
}

/**
 * Diff two resource snapshots and flag per-resource regressions.
 *
 * @param oldResources Baseline resources (previous contract version).
 * @param newResources Re-simulated resources (current contract version).
 * @param thresholdPct Maximum acceptable growth, in percent (default 10).
 */
export function diffResources(
  oldResources: Partial<ResourceUsage> | null | undefined,
  newResources: Partial<ResourceUsage> | null | undefined,
  thresholdPct: number = DEFAULT_REGRESSION_THRESHOLD_PCT,
): ResourceDelta[] {
  const threshold = normalizeThresholdPct(thresholdPct)

  return RESOURCE_KEYS.map((key) => {
    const oldValue = readResource(oldResources, key)
    const newValue = readResource(newResources, key)
    const delta = newValue - oldValue
    const deltaPct = computeDeltaPct(oldValue, newValue)

    return {
      key,
      label: RESOURCE_LABELS[key],
      oldValue,
      newValue,
      delta,
      deltaPct,
      // Epsilon keeps "exactly at the threshold" from tipping into a regression
      // because of binary floating-point rounding (e.g. +10% rendering as
      // 10.000000000000002).
      regression: deltaPct - threshold > THRESHOLD_EPSILON,
    }
  })
}

/**
 * Build a full {@link ResourceDiff} between two measurements.
 *
 * Returns null when either side is missing or failed — a failed simulation has
 * no meaningful resource numbers to compare.
 */
export function diffMeasurement(
  baseline: BenchmarkMeasurement | null | undefined,
  current: BenchmarkMeasurement | null | undefined,
  thresholdPct: number = DEFAULT_REGRESSION_THRESHOLD_PCT,
  context: { benchmarkId?: string; benchmarkName?: string; contractId?: string } = {},
): ResourceDiff | null {
  if (!baseline || !current || !baseline.success || !current.success) return null

  const threshold = normalizeThresholdPct(thresholdPct)
  const rows = diffResources(baseline.resources, current.resources, threshold)
  const regressionCount = rows.filter((row) => row.regression).length

  return {
    benchmarkId: context.benchmarkId ?? '',
    benchmarkName: context.benchmarkName ?? '',
    contractId: context.contractId ?? '',
    oldWasmHash: baseline.wasmHash,
    newWasmHash: current.wasmHash,
    sameVersion: Boolean(baseline.wasmHash) && baseline.wasmHash === current.wasmHash,
    thresholdPct: threshold,
    rows,
    regressionCount,
    regressed: regressionCount > 0,
    comparedAt: new Date().toISOString(),
  }
}

/** Format a signed delta percentage for display (e.g. `+12.5%`). */
export function formatDeltaPct(deltaPct: number): string {
  if (!Number.isFinite(deltaPct)) return 'n/a'
  const sign = deltaPct > 0 ? '+' : ''
  return `${sign}${deltaPct.toFixed(1)}%`
}
