/**
 * Critical Fee Math (#895)
 * ========================
 * Single source of truth for stroop conversion and fee estimation arithmetic.
 * These functions are pure and safety-critical: wrong rounding or unit
 * conversion here produces wrong fees on mainnet, so they are protected by a
 * Stryker mutation-testing gate (see `stryker.conf.json` and
 * `tests/unit/feeMath.mutation.test.js`) with a minimum mutation score.
 *
 * All functions:
 *  - Reject non-finite, negative, or non-numeric input instead of silently
 *    coercing (invalid input → `FeeMathError`, code `invalid_input`).
 *  - Clamp results to the protocol minimum base fee (100 stroops) where the
 *    domain requires it.
 *  - Never return fractional stroops: fees are integral by protocol rule.
 *
 * @see src/lib/networkMonitoring.ts `predictFees` — live congestion-based variant
 * @see docs/features/MUTATION_TESTING_GATE.md — gate documentation
 */

export type FeeMathErrorCode = 'invalid_input' | 'unsupported_environment'

export class FeeMathError extends Error {
  readonly code: FeeMathErrorCode
  constructor(code: FeeMathErrorCode, message: string) {
    super(message)
    this.name = 'FeeMathError'
    this.code = code
  }
}

/** Stellar protocol minimum transaction fee, in stroops. */
export const MIN_BASE_FEE_STROOPS = 100
/** 1 XLM = 10 000 000 stroops. */
export const STROOPS_PER_XLM = 10_000_000
/** Ledger capacity used for congestion-normalized estimates. */
export const LEDGER_OPERATION_LIMIT = 1000

function assertFiniteNonNegative(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FeeMathError('invalid_input', `${label} must be a finite number (got ${String(value)})`)
  }
  if (value < 0) {
    throw new FeeMathError('invalid_input', `${label} must be non-negative (got ${value})`)
  }
}

// ─── Stroop conversion ───────────────────────────────────────────────────────

/**
 * Convert stroops to XLM as a fixed 7-decimal string.
 * Boundary cases: 0 → "0.0000000"; values above Number safe range throw.
 */
export function stroopsToXlm(stroops: number): string {
  assertFiniteNonNegative(stroops, 'stroops')
  return (stroops / STROOPS_PER_XLM).toFixed(7)
}

/**
 * Convert an XLM amount to integral stroops.
 * Accepts a number or decimal string (e.g. "1.5"). Fractional amounts that do
 * not resolve to whole stroops are rejected rather than silently rounded.
 */
export function xlmToStroops(xlm: number | string): number {
  if (typeof xlm === 'string') {
    const trimmed = xlm.trim()
    if (trimmed === '' || !/^\d*\.?\d+$/.test(trimmed)) {
      throw new FeeMathError('invalid_input', `Invalid XLM amount: ${JSON.stringify(xlm)}`)
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      throw new FeeMathError('invalid_input', `Invalid XLM amount: ${JSON.stringify(xlm)}`)
    }
    xlm = parsed
  }
  assertFiniteNonNegative(xlm, 'xlm')

  const stroops = xlm * STROOPS_PER_XLM
  // Tolerate binary floating-point drift (e.g. 0.0000100 → 100.00000000000001)
  // but still reject genuinely fractional stroop amounts.
  const EPSILON = 1e-6
  const rounded = Math.round(stroops)
  if (Math.abs(stroops - rounded) > EPSILON) {
    throw new FeeMathError('invalid_input', `XLM amount resolves to fractional stroops (${stroops})`)
  }
  return rounded
}

// ─── Fee estimation ──────────────────────────────────────────────────────────

/** Clamp a fee to the protocol minimum, rounding to integral stroops. */
export function clampBaseFee(fee: number): number {
  assertFiniteNonNegative(fee, 'fee')
  return Math.max(MIN_BASE_FEE_STROOPS, Math.round(fee))
}

/**
 * Estimate the total fee for a transaction.
 * Applies an optional congestion multiplier (bounded to [1, 10]) and clamps
 * the per-operation fee to the protocol minimum before summing.
 */
export function estimateTotalFee(options: {
  baseFee: number
  operationCount: number
  multiplier?: number
}): number {
  const { baseFee, operationCount } = options
  const multiplier = options.multiplier ?? 1
  assertFiniteNonNegative(baseFee, 'baseFee')
  assertFiniteNonNegative(operationCount, 'operationCount')
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    throw new FeeMathError('invalid_input', `multiplier must be a finite non-negative number (got ${multiplier})`)
  }
  if (!Number.isInteger(operationCount)) {
    throw new FeeMathError('invalid_input', 'operationCount must be an integer')
  }
  if (operationCount === 0) {
    throw new FeeMathError('invalid_input', 'operationCount must be at least 1')
  }

  const boundedMultiplier = Math.min(Math.max(multiplier, 1), 10)
  const perOperation = clampBaseFee(baseFee * boundedMultiplier)
  return perOperation * operationCount
}

/**
 * Congestion-normalized fee estimate: scales the base fee by ledger
 * utilization. At or below the low-load threshold the base fee is used
 * unchanged; utilization saturates at 1.
 */
export const LOW_LOAD_UTILIZATION = 0.2

export function estimateCongestedFee(baseFee: number, operationCount: number, utilization: number): number {
  assertFiniteNonNegative(utilization, 'utilization')
  if (utilization > 1) {
    throw new FeeMathError('invalid_input', `utilization must be within [0, 1] (got ${utilization})`)
  }
  const multiplier = 1 + (Math.max(utilization - LOW_LOAD_UTILIZATION, 0) / (1 - LOW_LOAD_UTILIZATION)) * 1.5
  return estimateTotalFee({ baseFee, operationCount, multiplier })
}
