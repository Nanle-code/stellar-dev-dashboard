import { describe, it, expect } from 'vitest'
import { SlippagePredictor } from '../slippagePredictor'

describe('SlippagePredictor', () => {
  function makeRoute(overrides: Record<string, unknown> = {}) {
    return {
      path: ['assetA', 'assetB'],
      source_amount: '1000',
      destination_amount: '990',
      source_asset_code: 'XLM',
      destination_asset_code: 'USDC',
      ...overrides,
    }
  }

  it('initializes with default config', () => {
    const predictor = new SlippagePredictor()
    expect(predictor).toBeDefined()
  })

  it('predicts slippage for a simple route', () => {
    const predictor = new SlippagePredictor()
    const route = makeRoute()
    const result = predictor.predictSlippage(route)

    expect(result.predictedSlippage).toBeGreaterThanOrEqual(0)
    expect(result.predictedSlippage).toBeLessThanOrEqual(0.1)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel)
    expect(result.breakdown).toBeDefined()
  })

  it('predicts higher slippage for more hops', () => {
    const predictor = new SlippagePredictor()
    const route2Hops = makeRoute({ path: ['A', 'B'] })
    const route5Hops = makeRoute({ path: ['A', 'B', 'C', 'D', 'E'] })

    const result2 = predictor.predictSlippage(route2Hops)
    const result5 = predictor.predictSlippage(route5Hops)

    expect(result5.predictedSlippage).toBeGreaterThanOrEqual(result2.predictedSlippage)
  })

  it('adds and uses historical data', () => {
    const predictor = new SlippagePredictor()
    predictor.addHistoricalData('XLM-USDC', {
      slippage: 0.02,
      amount: 1000,
      liquidity: 0.5,
      hops: 2,
    })

    const route = makeRoute()
    const result = predictor.predictSlippage(route)
    expect(result).toBeDefined()
  })

  it('calculates volatility from historical data', () => {
    const predictor = new SlippagePredictor()
    for (let i = 0; i < 10; i++) {
      predictor.addHistoricalData('XLM-USDC', {
        slippage: 0.01 + Math.random() * 0.02,
        amount: 1000,
        liquidity: 0.5,
        hops: 2,
      })
    }

    const volatility = predictor.calculateVolatility('XLM-USDC')
    expect(volatility).toBeGreaterThanOrEqual(0)
  })

  it('returns recommended slippage tolerance', () => {
    const predictor = new SlippagePredictor()
    const route = makeRoute()
    const result = predictor.predictSlippage(route)

    const tolerance = predictor.getRecommendedSlippageTolerance(
      result.predictedSlippage,
      result.riskLevel
    )
    expect(tolerance).toBeGreaterThanOrEqual(result.predictedSlippage)
  })

  it('returns correct risk levels', () => {
    const predictor = new SlippagePredictor()
    expect(predictor.getRiskLevel(0.005)).toBe('low')
    expect(predictor.getRiskLevel(0.02)).toBe('medium')
    expect(predictor.getRiskLevel(0.04)).toBe('high')
    expect(predictor.getRiskLevel(0.06)).toBe('critical')
  })

  it('save and load work correctly', () => {
    const predictor = new SlippagePredictor()
    predictor.addHistoricalData('XLM-USDC', {
      slippage: 0.02,
      amount: 1000,
      liquidity: 0.5,
      hops: 2,
    })

    const saved = predictor.save()
    expect(saved.historicalData).toBeDefined()
    expect(saved.modelWeights).toBeDefined()

    const loaded = SlippagePredictor.load(saved)
    const route = makeRoute()
    const result = loaded.predictSlippage(route)
    expect(result).toBeDefined()
  })
})
