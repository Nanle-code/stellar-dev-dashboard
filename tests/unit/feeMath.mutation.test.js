/**
 * Fee-math unit tests backing the Stryker mutation gate (#895).
 *
 * These tests are the surviving-variant harness for `src/lib/feeMath.ts`:
 * Stryker runs this suite against every mutation of the module and the gate
 * requires a minimum mutation score (see stryker.conf.json → thresholds.break).
 *
 * Coverage: primary flow, boundary cases (protocol minimum, utilization
 * thresholds, rounding), and failure paths (invalid input, fractional
 * stroops, out-of-range values).
 */
import { describe, expect, it } from 'vitest'
import {
  stroopsToXlm,
  xlmToStroops,
  clampBaseFee,
  estimateTotalFee,
  estimateCongestedFee,
  FeeMathError,
  MIN_BASE_FEE_STROOPS,
  STROOPS_PER_XLM,
  LOW_LOAD_UTILIZATION,
} from '../../src/lib/feeMath'

describe('stroopsToXlm', () => {
  it('converts stroops to a 7-decimal XLM string (primary flow)', () => {
    expect(stroopsToXlm(10_000_000)).toBe('1.0000000')
    expect(stroopsToXlm(100)).toBe('0.0000100')
    expect(stroopsToXlm(1_500_000)).toBe('0.1500000')
  })

  it('handles zero and small amounts (boundary)', () => {
    expect(stroopsToXlm(0)).toBe('0.0000000')
    expect(stroopsToXlm(1)).toBe('0.0000001')
  })

  it('rejects negative and non-finite input (failure path)', () => {
    expect(() => stroopsToXlm(-1)).toThrow(FeeMathError)
    expect(() => stroopsToXlm(NaN)).toThrow(FeeMathError)
    expect(() => stroopsToXlm(Infinity)).toThrow(FeeMathError)
    expect(() => stroopsToXlm(/** @type {any} */ ('100'))).toThrow(FeeMathError)
  })
})

describe('xlmToStroops', () => {
  it('converts XLM to integral stroops (primary flow)', () => {
    expect(xlmToStroops(1)).toBe(10_000_000)
    expect(xlmToStroops('1.5')).toBe(15_000_000)
    expect(xlmToStroops('0.0000001')).toBe(1)
    expect(xlmToStroops(0.0000100)).toBe(100)
  })

  it('handles zero (boundary)', () => {
    expect(xlmToStroops(0)).toBe(0)
    expect(xlmToStroops('0')).toBe(0)
    expect(xlmToStroops('0.0')).toBe(0)
  })

  it('rejects fractional stroops (failure path)', () => {
    expect(() => xlmToStroops('0.00000005')).toThrow(/fractional stroops/)
    expect(() => xlmToStroops(0.00000005)).toThrow(/fractional stroops/)
  })

  it('rejects malformed and negative input (failure path)', () => {
    expect(() => xlmToStroops('')).toThrow(/Invalid XLM amount/)
    expect(() => xlmToStroops('abc')).toThrow(/Invalid XLM amount/)
    expect(() => xlmToStroops('1e3')).toThrow(/Invalid XLM amount/)
    expect(() => xlmToStroops(-1)).toThrow(FeeMathError)
    expect(() => xlmToStroops(NaN)).toThrow(FeeMathError)
  })
})

describe('clampBaseFee', () => {
  it('keeps fees at or above the 100 stroop protocol minimum (boundary)', () => {
    expect(clampBaseFee(100)).toBe(MIN_BASE_FEE_STROOPS)
    expect(clampBaseFee(150)).toBe(150)
    expect(clampBaseFee(99)).toBe(100)
    expect(clampBaseFee(0)).toBe(100)
  })

  it('rounds fractional fees to integral stroops', () => {
    expect(clampBaseFee(100.4)).toBe(100)
    expect(clampBaseFee(100.6)).toBe(101)
  })

  it('rejects invalid input (failure path)', () => {
    expect(() => clampBaseFee(-5)).toThrow(FeeMathError)
    expect(() => clampBaseFee(NaN)).toThrow(FeeMathError)
  })
})

describe('estimateTotalFee', () => {
  it('computes base fee × operations (primary flow)', () => {
    expect(estimateTotalFee({ baseFee: 100, operationCount: 1 })).toBe(100)
    expect(estimateTotalFee({ baseFee: 250, operationCount: 4 })).toBe(1000)
  })

  it('applies the congestion multiplier and clamps to the protocol minimum', () => {
    expect(estimateTotalFee({ baseFee: 200, operationCount: 2, multiplier: 1.5 })).toBe(600)
    // 50 × 1.0 = 50 → clamped to 100 per op.
    expect(estimateTotalFee({ baseFee: 50, operationCount: 3 })).toBe(300)
  })

  it('bounds the multiplier to [1, 10] (boundary)', () => {
    // Below 1 behaves as 1.
    expect(estimateTotalFee({ baseFee: 300, operationCount: 1, multiplier: 0.5 })).toBe(300)
    // Above 10 is capped at 10.
    expect(estimateTotalFee({ baseFee: 100, operationCount: 1, multiplier: 50 })).toBe(1000)
  })

  it('rejects invalid inputs (failure path)', () => {
    expect(() => estimateTotalFee({ baseFee: 100, operationCount: 0 })).toThrow(/at least 1/)
    expect(() => estimateTotalFee({ baseFee: 100, operationCount: 1.5 })).toThrow(/integer/)
    expect(() => estimateTotalFee({ baseFee: -100, operationCount: 1 })).toThrow(FeeMathError)
    expect(() => estimateTotalFee({ baseFee: 100, operationCount: 1, multiplier: -2 })).toThrow(/multiplier/)
    expect(() => estimateTotalFee({ baseFee: NaN, operationCount: 1 })).toThrow(FeeMathError)
  })
})

describe('estimateCongestedFee', () => {
  it('returns the unmodified estimate under low load (boundary at LOW_LOAD_UTILIZATION)', () => {
    const baseline = estimateTotalFee({ baseFee: 100, operationCount: 1 })
    expect(LOW_LOAD_UTILIZATION).toBe(0.2)
    expect(estimateCongestedFee(100, 1, 0)).toBe(baseline)
    expect(estimateCongestedFee(100, 1, 0.1)).toBe(baseline)
    expect(estimateCongestedFee(100, 1, 0.2)).toBe(baseline)
  })

  it('scales up with utilization above the low-load threshold', () => {
    const low = estimateCongestedFee(100, 1, 0.2)
    const mid = estimateCongestedFee(100, 1, 0.6)
    const full = estimateCongestedFee(100, 1, 1)

    expect(mid).toBeGreaterThan(low)
    expect(full).toBe(250) // multiplier 2.5 at full utilization
  })

  it('rejects out-of-range utilization (failure path)', () => {
    expect(() => estimateCongestedFee(100, 1, 1.5)).toThrow(/within \[0, 1\]/)
    expect(() => estimateCongestedFee(100, 1, -0.5)).toThrow(FeeMathError)
    expect(() => estimateCongestedFee(100, 1, NaN)).toThrow(FeeMathError)
  })
})

describe('constants', () => {
  it('pins the protocol constants', () => {
    expect(MIN_BASE_FEE_STROOPS).toBe(100)
    expect(STROOPS_PER_XLM).toBe(10_000_000)
  })
})
