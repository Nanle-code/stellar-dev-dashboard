import { describe, it, expect } from 'vitest'
import { RouteExplanation } from '../routeExplanation'

describe('RouteExplanation', () => {
  function makeRankedRoute(overrides: Record<string, unknown> = {}) {
    return {
      route: {
        path: ['assetA', 'assetB'],
        source_amount: '1000',
        destination_amount: '990',
        source_asset_code: 'XLM',
        destination_asset_code: 'USDC',
      },
      overallScore: 0.85,
      rank: 1,
      scores: {
        cost: 0.9,
        speed: 0.8,
        reliability: 0.85,
        slippage: 0.7,
      },
      ...overrides,
    }
  }

  it('generates explanation for a route', () => {
    const explainer = new RouteExplanation()
    const rankedRoute = makeRankedRoute()
    const explanation = explainer.generateExplanation(rankedRoute)

    expect(explanation.summary).toBeTruthy()
    expect(explanation.factors).toBeInstanceOf(Array)
    expect(explanation.recommendation).toBeTruthy()
    expect(typeof explanation.confidence).toBe('number')
    expect(explanation.warnings).toBeInstanceOf(Array)
  })

  it('generates positive factors for good routes', () => {
    const explainer = new RouteExplanation()
    const rankedRoute = makeRankedRoute({ rank: 1, overallScore: 0.9 })
    const explanation = explainer.generateExplanation(rankedRoute)

    const positiveFactors = explanation.factors.filter(f => f.type === 'positive')
    expect(positiveFactors.length).toBeGreaterThan(0)
  })

  it('generates warnings for complex routes', () => {
    const explainer = new RouteExplanation()
    const rankedRoute = makeRankedRoute({
      route: {
        path: ['A', 'B', 'C', 'D', 'E'],
        source_amount: '1000',
        destination_amount: '990',
        source_asset_code: 'XLM',
        destination_asset_code: 'USDC',
      },
    })

    const context = {
      slippagePrediction: { predictedSlippage: 0.04, riskLevel: 'high' },
    }
    const explanation = explainer.generateExplanation(rankedRoute, context)

    expect(explanation.warnings.length).toBeGreaterThan(0)
  })

  it('generates comparison explanation for top routes', () => {
    const explainer = new RouteExplanation()
    const topRoutes = [
      makeRankedRoute({ rank: 1, overallScore: 0.9 }),
      makeRankedRoute({ rank: 2, overallScore: 0.7 }),
    ]

    const comparison = explainer.generateComparisonExplanation(topRoutes)
    expect(comparison).not.toBeNull()
    expect(comparison!.summary).toBeTruthy()
    expect(comparison!.tradeoffs).toHaveLength(2)
  })

  it('returns null for comparison with less than 2 routes', () => {
    const explainer = new RouteExplanation()
    const comparison = explainer.generateComparisonExplanation([
      makeRankedRoute({ rank: 1 }),
    ])
    expect(comparison).toBeNull()
  })

  it('calculates confidence based on score consistency', () => {
    const explainer = new RouteExplanation()
    const consistentRoute = makeRankedRoute({
      scores: { cost: 0.8, speed: 0.8, reliability: 0.8, slippage: 0.8 },
    })
    const inconsistentRoute = makeRankedRoute({
      scores: { cost: 1.0, speed: 0.2, reliability: 0.9, slippage: 0.1 },
    })

    const consistentExplanation = explainer.generateExplanation(consistentRoute)
    const inconsistentExplanation = explainer.generateExplanation(inconsistentRoute)

    expect(consistentExplanation.confidence).toBeGreaterThanOrEqual(
      inconsistentExplanation.confidence
    )
  })
})
