import { describe, it, expect } from 'vitest';
import {
  computePoolTradeStats,
  buildVolumeTrend,
  estimatePoolFeeApr,
  explainInvalidPool,
  type PoolTradeInput,
} from '../../../src/lib/poolMetrics';

function trade(
  id: string,
  minutesAgo: number,
  baseAmount: number,
  counterAmount = baseAmount * 2,
  now = Date.now(),
): PoolTradeInput {
  return {
    id,
    base_amount: String(baseAmount),
    counter_amount: String(counterAmount),
    ledger_close_time: new Date(now - minutesAgo * 60_000).toISOString(),
  };
}

const HEALTHY_POOL = {
  feeBps: 30,
  reserveA: '100000',
  reserveB: '100000',
  totalReserveValue: '200000',
};

describe('explainInvalidPool (failure paths)', () => {
  it('rejects missing pool data', () => {
    expect(explainInvalidPool(null)).toMatch(/missing/i);
    expect(explainInvalidPool(undefined)).toMatch(/missing/i);
    expect(explainInvalidPool('pool')).toMatch(/missing/i);
  });

  it('rejects invalid fee tiers', () => {
    expect(explainInvalidPool({ feeBps: -5, totalReserveValue: 100 })).toMatch(/fee tier/i);
    expect(explainInvalidPool({ totalReserveValue: 100 })).toMatch(/fee tier/i);
    expect(explainInvalidPool({ feeBps: 'abc', totalReserveValue: 100 })).toMatch(/fee tier/i);
  });

  it('rejects pools without liquidity', () => {
    expect(explainInvalidPool({ feeBps: 30, totalReserveValue: '0' })).toMatch(/reserves are empty/i);
    expect(explainInvalidPool({ feeBps: 30, reserveA: 0, reserveB: 0 })).toMatch(/reserves are empty/i);
  });

  it('accepts a well-formed pool', () => {
    expect(explainInvalidPool(HEALTHY_POOL)).toBeNull();
  });
});

describe('computePoolTradeStats (primary flow)', () => {
  it('sums volume and measures the observation window', () => {
    const now = Date.now();
    const stats = computePoolTradeStats([
      trade('a', 240, 100, 200, now),
      trade('b', 120, 300, 600, now),
      trade('c', 10, 50, 100, now),
    ]);

    expect(stats.validTradeCount).toBe(3);
    expect(stats.volumeBase).toBe(450);
    expect(stats.volumeCounter).toBe(900);
    expect(stats.windowHours).toBeCloseTo(3.83, 1);
    expect(stats.skippedCount).toBe(0);
    // Three trades is below the low-sample threshold.
    expect(stats.warnings.some((w) => w.code === 'low-sample')).toBe(true);
  });

  it('reports a low-sample warning below the confidence threshold (boundary)', () => {
    const stats = computePoolTradeStats([trade('a', 10, 100), trade('b', 5, 100)]);
    expect(stats.validTradeCount).toBe(2);
    expect(stats.warnings.some((w) => w.code === 'low-sample')).toBe(true);
  });

  it('does not warn at the low-sample threshold', () => {
    const now = Date.now();
    const trades = Array.from({ length: 5 }, (_, i) => trade(`t${i}`, i * 10 + 10, 10, 20, now));
    const stats = computePoolTradeStats(trades);
    expect(stats.validTradeCount).toBe(5);
    expect(stats.warnings.some((w) => w.code === 'low-sample')).toBe(false);
  });

  it('flags stale trade windows', () => {
    const now = Date.now();
    const stats = computePoolTradeStats([trade('old', 12 * 60, 100, 100, now)]);
    expect(stats.warnings.some((w) => w.code === 'stale-trades')).toBe(true);
  });
});

describe('computePoolTradeStats (failure paths)', () => {
  it('handles null, undefined, and non-array input', () => {
    expect(computePoolTradeStats(null).validTradeCount).toBe(0);
    expect(computePoolTradeStats(undefined).volumeBase).toBe(0);
    expect(computePoolTradeStats('nope' as unknown as PoolTradeInput[]).volumeBase).toBe(0);
  });

  it('skips malformed records and reports the count', () => {
    const stats = computePoolTradeStats([
      null as unknown as PoolTradeInput,
      { id: 'no-amounts' },
      { id: 'bad', base_amount: 'not-a-number', counter_amount: '12' },
      { id: 'negative', base_amount: '-5', counter_amount: '10' },
      trade('good', 30, 42),
    ]);

    expect(stats.validTradeCount).toBe(1);
    expect(stats.volumeBase).toBe(42);
    expect(stats.skippedCount).toBe(4);
    expect(stats.warnings.some((w) => w.code === 'skipped-records')).toBe(true);
  });

  it('tolerates missing timestamps without counting them as skipped', () => {
    const stats = computePoolTradeStats([{ id: 'a', base_amount: '10', counter_amount: '20' }]);
    expect(stats.validTradeCount).toBe(1);
    expect(stats.windowHours).toBe(0);
    expect(stats.skippedCount).toBe(0);
  });
});

describe('buildVolumeTrend', () => {
  it('buckets trades oldest → newest with per-bucket volume', () => {
    const now = Date.now();
    const trades = [
      trade('old', 180, 10, 20, now),
      trade('mid', 90, 20, 40, now),
      trade('new', 5, 70, 140, now),
    ];

    const trend = buildVolumeTrend(trades, { buckets: 3 });

    expect(trend.buckets).toHaveLength(3);
    expect(trend.totalVolume).toBeCloseTo(100, 5);
    expect(trend.buckets[0].volume).toBe(10);
    expect(trend.buckets[1].volume).toBe(20);
    expect(trend.buckets[2].volume).toBe(70);
    expect(trend.buckets[2].tradeCount).toBe(1);
  });

  it('keeps a minimum one-hour window for bursts (boundary)', () => {
    const trend = buildVolumeTrend([trade('a', 2, 50), trade('b', 1, 25)], { buckets: 4 });
    expect(trend.buckets).toHaveLength(4);
    expect(trend.totalVolume).toBe(75);
    // Window ends at the newest trade, so a tight burst lands in the last bucket.
    expect(trend.buckets[3].volume).toBe(75);
    expect(trend.buckets[3].tradeCount).toBe(2);
    expect(trend.buckets[0].volume).toBe(0);
  });

  it('returns empty buckets when no trades carry timestamps', () => {
    const trend = buildVolumeTrend([{ id: 'x', base_amount: '5', counter_amount: '5' }]);
    expect(trend.buckets).toEqual([]);
    expect(trend.totalVolume).toBe(0);
  });

  it('rejects bucket counts outside 1–48 (failure path)', () => {
    expect(() => buildVolumeTrend([], { buckets: 0 })).toThrow(/between 1 and 48/);
    expect(() => buildVolumeTrend([], { buckets: 2.5 })).toThrow(/between 1 and 48/);
    expect(() => buildVolumeTrend([], { buckets: 100 })).toThrow(/between 1 and 48/);
  });
});

describe('estimatePoolFeeApr', () => {
  it('annualizes observed volume into fee APR (primary flow)', () => {
    const now = Date.now();
    // ~21h of trades totalling 1000 base units; 0.3% fee tier.
    const trades = Array.from({ length: 12 }, (_, i) => trade(`t${i}`, i * 115 + 10, 1000 / 12, 0, now));
    const stats = computePoolTradeStats(trades, { now });
    const estimate = estimatePoolFeeApr(HEALTHY_POOL, stats);

    expect(estimate.feeApr).not.toBeNull();
    expect(estimate.extrapolated).toBe(true);
    // Volume is scaled from the observed window up to a 24h rate.
    expect(estimate.volumePerDay).toBeCloseTo(1000 * (24 / stats.windowHours), 0);
    expect(estimate.dailyFees).toBeCloseTo(estimate.volumePerDay * 0.003, 1);
    // APR = (dailyFees / TVL) * 365 * 100
    expect(estimate.feeApr).toBeCloseTo((estimate.volumePerDay * 0.003 / 200000) * 365 * 100, 3);
    expect(estimate.reason).toBeNull();
  });

  it('marks short windows as extrapolated (boundary)', () => {
    const now = Date.now();
    const stats = computePoolTradeStats([trade('a', 30, 100, 0, now)], { now });
    const estimate = estimatePoolFeeApr(HEALTHY_POOL, stats);

    expect(estimate.extrapolated).toBe(true);
    expect(estimate.warnings.some((w) => w.code === 'extrapolated-volume')).toBe(true);
    // Clamped to a 1h window: 100 * 24 daily volume.
    expect(estimate.volumePerDay).toBeCloseTo(2400, 5);
  });

  it('falls back to counter volume when base amounts are absent', () => {
    const stats = computePoolTradeStats([
      { id: 'a', base_amount: undefined, counter_amount: '500', ledger_close_time: new Date().toISOString() },
    ]);
    const estimate = estimatePoolFeeApr(HEALTHY_POOL, stats);
    expect(estimate.volumePerDay).toBeGreaterThan(0);
    expect(estimate.feeApr).not.toBeNull();
  });

  it('returns a clear reason for a pool without reserves (failure path)', () => {
    const stats = computePoolTradeStats([trade('a', 30, 100)]);
    const estimate = estimatePoolFeeApr({ feeBps: 30, totalReserveValue: '0' }, stats);
    expect(estimate.feeApr).toBeNull();
    expect(estimate.reason).toMatch(/reserves are empty/i);
  });

  it('returns a clear reason when no trades exist (failure path)', () => {
    const estimate = estimatePoolFeeApr(HEALTHY_POOL, computePoolTradeStats(null));
    expect(estimate.feeApr).toBeNull();
    expect(estimate.reason).toMatch(/no recent trades/i);
  });

  it('propagates stats warnings into the estimate', () => {
    const stats = computePoolTradeStats([trade('a', 30, 100)]);
    const estimate = estimatePoolFeeApr(HEALTHY_POOL, stats);
    expect(estimate.warnings.some((w) => w.code === 'low-sample')).toBe(true);
  });
});
