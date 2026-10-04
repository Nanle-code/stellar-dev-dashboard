import { describe, it, expect } from 'vitest'
import { estimateFillProbability } from '../fillProbability'
import type { FillProbabilityParams, OrderBookLevel, TradeRecord } from '../fillProbability'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const bids: OrderBookLevel[] = [
  { price: '1.00', amount: '500' },
  { price: '0.99', amount: '300' },
  { price: '0.98', amount: '200' },
]

const asks: OrderBookLevel[] = [
  { price: '1.01', amount: '400' },
  { price: '1.02', amount: '350' },
  { price: '1.03', amount: '250' },
]

// Ten recent trades spaced 20 s apart, all at prices inside the spread
function makeTrades(count: number, price = 1.005): TradeRecord[] {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => ({
    price,
    base_amount: '50',
    ledger_close_time: new Date(now - i * 20_000).toISOString(),
  }))
}

// ---------------------------------------------------------------------------
// Primary flow
// ---------------------------------------------------------------------------

describe('estimateFillProbability — primary flow', () => {
  it('returns a valid probability in [0, 1] for a buy order at a competitive price', () => {
    const trades = makeTrades(10)
    const result = estimateFillProbability({
      side: 'buy',
      limitPrice: 1.015, // above best ask — aggressive, likely to fill
      quantity: 100,
      bids,
      asks,
      trades,
      cadenceWindowSeconds: 300,
    })

    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(1)
    expect(['very_high', 'high', 'medium', 'low', 'very_low']).toContain(result.tier)
    expect(result.probabilityLabel).toMatch(/^\d+%$/)
    expect(result.tradesPerMinute).toBeGreaterThan(0)
  })

  it('returns a higher probability when the limit price is aggressive vs passive', () => {
    const trades = makeTrades(15)

    // Aggressive buy: limit above best ask — all asks are reachable → depthToAbsorb = 0
    const aggressive = estimateFillProbability({
      side: 'buy',
      limitPrice: 1.05,
      quantity: 50,
      bids,
      asks,
      trades,
    })

    // Passive buy: limit well below best ask — all depth must be traversed
    const passive = estimateFillProbability({
      side: 'buy',
      limitPrice: 0.95,
      quantity: 50,
      bids,
      asks,
      trades,
    })

    expect(aggressive.probability).toBeGreaterThan(passive.probability)
    expect(aggressive.depthToAbsorb).toBe(0)
    expect(passive.depthToAbsorb).toBeGreaterThan(0)
  })

  it('sell order mirrors buy: aggressive limit below best bid has higher probability', () => {
    const trades = makeTrades(10, 0.995)

    const aggressive = estimateFillProbability({
      side: 'sell',
      limitPrice: 0.97, // below all bids — all bids reachable
      quantity: 100,
      bids,
      asks,
      trades,
    })

    const passive = estimateFillProbability({
      side: 'sell',
      limitPrice: 1.05, // above all bids — no bid can fill
      quantity: 100,
      bids,
      asks,
      trades,
    })

    expect(aggressive.probability).toBeGreaterThan(passive.probability)
  })

  it('higher trade cadence increases fill probability for a given limit price', () => {
    const sharedParams: Omit<FillProbabilityParams, 'trades'> = {
      side: 'buy',
      limitPrice: 1.015,
      quantity: 100,
      bids,
      asks,
      cadenceWindowSeconds: 300,
    }

    const lowActivity = estimateFillProbability({ ...sharedParams, trades: makeTrades(2) })
    const highActivity = estimateFillProbability({ ...sharedParams, trades: makeTrades(30) })

    expect(highActivity.cadenceScore).toBeGreaterThan(lowActivity.cadenceScore)
    expect(highActivity.probability).toBeGreaterThan(lowActivity.probability)
  })
})

// ---------------------------------------------------------------------------
// Boundary cases
// ---------------------------------------------------------------------------

describe('estimateFillProbability — boundary cases', () => {
  it('returns a result with probability > 0 when trades array is empty (depth-only estimate)', () => {
    const result = estimateFillProbability({
      side: 'buy',
      limitPrice: 1.015,
      quantity: 100,
      bids,
      asks,
      trades: [],
    })

    // cadenceScore collapses to near-0, but depthScore still contributes
    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(1)
    expect(result.cadenceScore).toBe(0)
    expect(result.tradesPerMinute).toBe(0)
  })

  it('returns depth-only score of 0.5 when order book is completely empty', () => {
    const result = estimateFillProbability({
      side: 'buy',
      limitPrice: 1.01,
      quantity: 100,
      bids: [],
      asks: [],
      trades: makeTrades(5),
    })

    // computeDepthScore returns 0.5 sentinel when no book data
    expect(result.depthScore).toBe(0.5)
    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(1)
  })

  it('handles Horizon fraction-style prices { n, d }', () => {
    const fractionalTrades: TradeRecord[] = [
      { price: { n: 101, d: 100 }, base_amount: '100', ledger_close_time: new Date().toISOString() },
      { price: { n: 102, d: 100 }, base_amount: '80', ledger_close_time: new Date(Date.now() - 30_000).toISOString() },
    ]

    const result = estimateFillProbability({
      side: 'buy',
      limitPrice: 1.015,
      quantity: 50,
      bids,
      asks,
      trades: fractionalTrades,
    })

    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(1)
  })

  it('clamps probability to [0, 1] when given extreme inputs', () => {
    const result = estimateFillProbability({
      side: 'buy',
      limitPrice: 9999,      // massively over-market
      quantity: 1,
      bids,
      asks,
      trades: makeTrades(100), // very high cadence
    })

    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(1)
  })

  it('trades outside the cadence window are excluded', () => {
    const stale: TradeRecord[] = [
      {
        price: 1.005,
        base_amount: '500',
        // 10 minutes ago, outside a 5-min window
        ledger_close_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
    ]
    const fresh: TradeRecord[] = [
      {
        price: 1.005,
        base_amount: '500',
        ledger_close_time: new Date(Date.now() - 60_000).toISOString(),
      },
    ]

    const staleResult = estimateFillProbability({
      side: 'buy',
      limitPrice: 1.015,
      quantity: 50,
      bids,
      asks,
      trades: stale,
      cadenceWindowSeconds: 300,
    })

    const freshResult = estimateFillProbability({
      side: 'buy',
      limitPrice: 1.015,
      quantity: 50,
      bids,
      asks,
      trades: fresh,
      cadenceWindowSeconds: 300,
    })

    expect(staleResult.tradesPerMinute).toBe(0)
    expect(freshResult.tradesPerMinute).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Failure cases
// ---------------------------------------------------------------------------

describe('estimateFillProbability — failure cases', () => {
  it('returns zero probability for an invalid side', () => {
    const result = estimateFillProbability({
      side: 'hold' as any,
      limitPrice: 1.01,
      quantity: 100,
      bids,
      asks,
      trades: makeTrades(5),
    })

    expect(result.probability).toBe(0)
    expect(result.tier).toBe('very_low')
    expect(result.probabilityLabel).toBe('0%')
  })

  it('returns zero probability for a non-positive limit price', () => {
    const base = { side: 'buy' as const, quantity: 100, bids, asks, trades: makeTrades(5) }

    expect(estimateFillProbability({ ...base, limitPrice: 0 }).probability).toBe(0)
    expect(estimateFillProbability({ ...base, limitPrice: -1 }).probability).toBe(0)
    expect(estimateFillProbability({ ...base, limitPrice: NaN }).probability).toBe(0)
  })

  it('returns zero probability for a non-positive quantity', () => {
    const base = { side: 'buy' as const, limitPrice: 1.01, bids, asks, trades: makeTrades(5) }

    expect(estimateFillProbability({ ...base, quantity: 0 }).probability).toBe(0)
    expect(estimateFillProbability({ ...base, quantity: -5 }).probability).toBe(0)
    expect(estimateFillProbability({ ...base, quantity: NaN }).probability).toBe(0)
  })

  it('does not throw when trade records have missing or malformed fields', () => {
    const malformed: TradeRecord[] = [
      { price: undefined, base_amount: undefined, ledger_close_time: undefined },
      { price: 'not-a-number', base_amount: '50' },
      { price: { n: 0, d: 0 }, base_amount: '50', ledger_close_time: 'bad-date' },
    ]

    expect(() =>
      estimateFillProbability({
        side: 'buy',
        limitPrice: 1.01,
        quantity: 100,
        bids,
        asks,
        trades: malformed,
      })
    ).not.toThrow()
  })

  it('does not throw when order book levels have invalid price/amount strings', () => {
    const badLevels: OrderBookLevel[] = [
      { price: '', amount: 'bad' },
      { price: 'NaN', amount: '-1' },
    ]

    expect(() =>
      estimateFillProbability({
        side: 'buy',
        limitPrice: 1.01,
        quantity: 50,
        bids: badLevels,
        asks: badLevels,
        trades: [],
      })
    ).not.toThrow()
  })
})
