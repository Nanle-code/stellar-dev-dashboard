import { describe, it, expect } from 'vitest'
import { RouteRanker } from '../routeRanker'

describe('RouteRanker', () => {
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

  it('initializes with default criteria', () => {
    const ranker = new RouteRanker()
    expect(ranker).toBeDefined()
  })

  it('ranks routes by multiple criteria', () => {
    const ranker = new RouteRanker()
    const routes = [
      makeRoute({ source_amount: '1000', destination_amount: '995', path: ['A'] }),
      makeRoute({ source_amount: '1000', destination_amount: '980', path: ['A', 'B', 'C'] }),
      makeRoute({ source_amount: '1000', destination_amount: '990', path: ['A', 'B'] }),
    ]

    const ranked = ranker.rankRoutes(routes)
    expect(ranked).toHaveLength(3)
    expect(ranked[0].rank).toBe(1)
    expect(ranked[0].overallScore).toBeGreaterThanOrEqual(ranked[1].overallScore)
    expect(ranked[1].overallScore).toBeGreaterThanOrEqual(ranked[2].overallScore)
  })

  it('calculates cost score based on efficiency', () => {
    const ranker = new RouteRanker()
    const efficientRoute = makeRoute({ source_amount: '100', destination_amount: '99' })
    const inefficientRoute = makeRoute({ source_amount: '100', destination_amount: '80' })

    const efficientScore = ranker.calculateCostScore(efficientRoute)
    const inefficientScore = ranker.calculateCostScore(inefficientRoute)

    expect(efficientScore).toBeLessThan(inefficientScore)
  })

  it('calculates speed score based on hop count', () => {
    const ranker = new RouteRanker()
    const fastRoute = makeRoute({ path: ['A'] })
    const slowRoute = makeRoute({ path: ['A', 'B', 'C', 'D', 'E'] })

    const fastScore = ranker.calculateSpeedScore(fastRoute)
    const slowScore = ranker.calculateSpeedScore(slowRoute)

    expect(fastScore).toBeGreaterThan(slowScore)
  })

  it('calculates reliability score', () => {
    const ranker = new RouteRanker()
    const simpleRoute = makeRoute({ path: ['A'] })
    const complexRoute = makeRoute({ path: ['A', 'B', 'C', 'D'] })

    const simpleScore = ranker.calculateReliabilityScore(simpleRoute)
    const complexScore = ranker.calculateReliabilityScore(complexRoute)

    expect(simpleScore).toBeGreaterThanOrEqual(0)
    expect(complexScore).toBeGreaterThanOrEqual(0)
    expect(simpleScore).toBeGreaterThanOrEqual(complexScore)
  })

  it('adds historical execution data', () => {
    const ranker = new RouteRanker()
    const route = makeRoute()

    ranker.addHistoricalExecution(route, {
      success: true,
      slippage: 0.01,
      executionTime: 500,
      actualAmount: 990,
    })

    const insights = ranker.getRouteInsights(route)
    expect(insights.hasHistory).toBe(true)
    expect(insights.successRate).toBe(1)
    expect(insights.executionCount).toBe(1)
  })

  it('returns no history for unknown routes', () => {
    const ranker = new RouteRanker()
    const route = makeRoute()
    const insights = ranker.getRouteInsights(route)

    expect(insights.hasHistory).toBe(false)
  })

  it('generates correct insights', () => {
    const ranker = new RouteRanker()
    const route = makeRoute()

    for (let i = 0; i < 10; i++) {
      ranker.addHistoricalExecution(route, {
        success: true,
        slippage: 0.005,
        executionTime: 500,
        actualAmount: 990,
      })
    }

    const insights = ranker.getRouteInsights(route)
    expect(insights.insight).toContain('Highly reliable')
    expect(insights.insight).toContain('minimal slippage')
  })

  it('save and load work correctly', () => {
    const ranker = new RouteRanker()
    const route = makeRoute()

    ranker.addHistoricalExecution(route, {
      success: true,
      slippage: 0.01,
      executionTime: 500,
      actualAmount: 990,
    })

    const saved = ranker.save()
    expect(saved.criteria).toBeDefined()
    expect(saved.historicalPerformance).toBeDefined()

    const loaded = RouteRanker.load(saved)
    const insights = loaded.getRouteInsights(route)
    expect(insights.hasHistory).toBe(true)
  })
})
