import { describe, it, expect } from 'vitest'
import {
  calculatePriceImpactAndSlippage,
  enforceSlippageProtectionOrThrow,
  type OrderBookData,
  type AmmPoolData,
} from '../slippageProtection'

describe('Slippage Protection & Price Impact Engine', () => {
  const sampleOrderbook: OrderBookData = {
    bids: [
      { price: '1.00', amount: '100' },
      { price: '0.98', amount: '200' },
      { price: '0.95', amount: '500' },
    ],
    asks: [
      { price: '1.05', amount: '100' },
      { price: '1.08', amount: '200' },
      { price: '1.12', amount: '500' },
    ],
  }

  const samplePool: AmmPoolData = {
    reserveA: 10000,
    reserveB: 10000,
    feePercent: 0.3,
  }

  it('Primary Flow: calculates spot price, execution price, price impact, and minimum received for sell trade', () => {
    const result = calculatePriceImpactAndSlippage({
      tradeType: 'sell',
      amount: 50,
      orderbook: sampleOrderbook,
      slippageTolerancePercent: 0.5,
    })

    expect(result.isValid).toBe(true)
    expect(result.spotPrice).toBe(1.0)
    expect(result.executionPrice).toBe(1.0)
    expect(result.expectedOutput).toBe(50)
    expect(result.minimumReceived).toBeCloseTo(49.75, 2)
    expect(result.priceImpactPercent).toBe(0)
    expect(result.riskLevel).toBe('low')
  })

  it('Primary Flow: calculates price impact across multiple orderbook levels', () => {
    // Selling 150 base asset: 100 at 1.00 + 50 at 0.98 = total 149 output
    const result = calculatePriceImpactAndSlippage({
      tradeType: 'sell',
      amount: 150,
      orderbook: sampleOrderbook,
      slippageTolerancePercent: 2.0,
    })

    expect(result.isValid).toBe(true)
    expect(result.spotPrice).toBe(1.0)
    expect(result.expectedOutput).toBe(149)
    expect(result.executionPrice).toBeCloseTo(0.9933, 3)
    expect(result.priceImpactPercent).toBeGreaterThan(0)
    expect(result.minimumReceived).toBeCloseTo(146.02, 2)
  })

  it('Primary Flow (AMM): calculates price impact for constant product liquidity pool', () => {
    const result = calculatePriceImpactAndSlippage({
      tradeType: 'sell',
      amount: 100,
      pool: samplePool,
      slippageTolerancePercent: 5.0,
    })

    expect(result.isValid).toBe(true)
    expect(result.spotPrice).toBe(1.0)
    expect(result.expectedOutput).toBeGreaterThan(0)
    expect(result.priceImpactPercent).toBeGreaterThan(0)
  })

  it('Boundary Case: handles small trade amounts and exact slippage thresholds', () => {
    const result = calculatePriceImpactAndSlippage({
      tradeType: 'sell',
      amount: 0.001,
      orderbook: sampleOrderbook,
      slippageTolerancePercent: 0.1,
    })

    expect(result.isValid).toBe(true)
    expect(result.expectedOutput).toBeGreaterThan(0)
    expect(result.priceImpactPercent).toBe(0)
    expect(result.riskLevel).toBe('low')
  })

  it('Failure Path: blocks trade when price impact exceeds user-selected slippage tolerance', () => {
    // Large trade amount (700) that walks orderbook levels to price 0.95
    const result = calculatePriceImpactAndSlippage({
      tradeType: 'sell',
      amount: 700,
      orderbook: sampleOrderbook,
      slippageTolerancePercent: 0.5,
      maxPriceImpactThresholdPercent: 1.0,
    })

    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Trade blocked by slippage protection')
    expect(result.priceImpactPercent).toBeGreaterThan(0.5)
  })

  it('Failure Path: rejects insufficient orderbook liquidity', () => {
    const result = calculatePriceImpactAndSlippage({
      tradeType: 'sell',
      amount: 10000, // exceeds available 800
      orderbook: sampleOrderbook,
      slippageTolerancePercent: 1.0,
    })

    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Insufficient orderbook liquidity')
  })

  it('Failure Path: rejects invalid or negative trade amounts', () => {
    const result = calculatePriceImpactAndSlippage({
      tradeType: 'sell',
      amount: -10,
      orderbook: sampleOrderbook,
      slippageTolerancePercent: 0.5,
    })

    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Invalid trade amount')
  })

  it('Failure Path: rejects missing orderbook and pool data', () => {
    const result = calculatePriceImpactAndSlippage({
      tradeType: 'sell',
      amount: 10,
      orderbook: null,
      pool: null,
      slippageTolerancePercent: 0.5,
    })

    expect(result.isValid).toBe(false)
    expect(result.error).toContain('No orderbook or liquidity pool data')
  })

  it('Resilience: enforceSlippageProtectionOrThrow throws descriptive error on violation', () => {
    expect(() => {
      enforceSlippageProtectionOrThrow({
        tradeType: 'sell',
        amount: 700,
        orderbook: sampleOrderbook,
        slippageTolerancePercent: 0.5,
        maxPriceImpactThresholdPercent: 1.0,
      })
    }).toThrow(/Trade blocked by slippage protection/)
  })
})
