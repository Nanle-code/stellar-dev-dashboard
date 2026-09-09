import { describe, it, expect } from 'vitest'
import { RouteHistory } from '../routeHistory'

describe('RouteHistory', () => {
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
    const history = new RouteHistory()
    expect(history).toBeDefined()
  })

  it('records execution data', () => {
    const history = new RouteHistory()
    const route = makeRoute()

    const record = history.recordExecution({
      route,
      params: { sourceAsset: 'XLM', destAsset: 'USDC', amount: 1000 },
      result: {
        success: true,
        actualSlippage: 0.01,
        executionTime: 500,
        actualAmount: 990,
      },
    })

    expect(record.id).toBeTruthy()
    expect(record.timestamp).toBeGreaterThan(0)
    expect(record.metrics.success).toBe(true)
    expect(record.metrics.actualSlippage).toBe(0.01)
  })

  it('tracks route performance over multiple executions', () => {
    const history = new RouteHistory()
    const route = makeRoute()

    for (let i = 0; i < 5; i++) {
      history.recordExecution({
        route,
        params: { sourceAsset: 'XLM', destAsset: 'USDC', amount: 1000 },
        result: {
          success: true,
          actualSlippage: 0.01,
          executionTime: 500,
          actualAmount: 990,
        },
      })
    }

    const performance = history.getRoutePerformance(route)
    expect(performance).not.toBeNull()
    expect(performance!.executions).toBe(5)
    expect(performance!.successRate).toBe(1)
  })

  it('returns null for unknown routes', () => {
    const history = new RouteHistory()
    const route = makeRoute()
    const performance = history.getRoutePerformance(route)
    expect(performance).toBeNull()
  })

  it('returns top routes sorted by success rate', () => {
    const history = new RouteHistory()
    const goodRoute = makeRoute({ path: ['A'] })
    const badRoute = makeRoute({ path: ['A', 'B'] })

    for (let i = 0; i < 5; i++) {
      history.recordExecution({
        route: goodRoute,
        params: { sourceAsset: 'XLM', destAsset: 'USDC', amount: 1000 },
        result: { success: true, actualSlippage: 0.01, executionTime: 500, actualAmount: 990 },
      })
      history.recordExecution({
        route: badRoute,
        params: { sourceAsset: 'XLM', destAsset: 'USDC', amount: 1000 },
        result: { success: i < 2, actualSlippage: 0.03, executionTime: 1000, actualAmount: 970 },
      })
    }

    const topRoutes = history.getTopRoutes(5)
    expect(topRoutes.length).toBeGreaterThanOrEqual(2)
    expect(topRoutes[0].successRate).toBeGreaterThanOrEqual(topRoutes[1].successRate)
  })

  it('returns recent executions in reverse chronological order', () => {
    const history = new RouteHistory()
    const route = makeRoute()

    history.recordExecution({
      route,
      params: {},
      result: { success: true, actualSlippage: 0.01, executionTime: 500, actualAmount: 990 },
    })
    history.recordExecution({
      route,
      params: {},
      result: { success: false, actualSlippage: 0.05, executionTime: 1000, actualAmount: 950 },
    })

    const recent = history.getRecentExecutions(10)
    expect(recent).toHaveLength(2)
    expect(recent[0].metrics.success).toBe(false)
    expect(recent[1].metrics.success).toBe(true)
  })

  it('generates analytics for a time range', () => {
    const history = new RouteHistory()
    const route = makeRoute()

    history.recordExecution({
      route,
      params: {},
      result: { success: true, actualSlippage: 0.01, executionTime: 500, actualAmount: 990 },
    })

    const analytics = history.getAnalytics(24 * 60 * 60 * 1000)
    expect(analytics.totalExecutions).toBe(1)
    expect(analytics.successRate).toBe(1)
    expect(analytics.avgSlippage).toBe(0.01)
  })

  it('prunes old data', () => {
    const history = new RouteHistory({ retentionDays: 1 })
    const route = makeRoute()

    history.recordExecution({
      route,
      params: {},
      result: { success: true, actualSlippage: 0.01, executionTime: 500, actualAmount: 990 },
    })

    expect(history.executions.length).toBe(1)

    history.executions[0].timestamp = Date.now() - 1000 * 60 * 60 * 25
    history.pruneOldData()
    expect(history.executions.length).toBe(0)
  })

  it('save and load work correctly', () => {
    const history = new RouteHistory()
    const route = makeRoute()

    history.recordExecution({
      route,
      params: {},
      result: { success: true, actualSlippage: 0.01, executionTime: 500, actualAmount: 990 },
    })

    const saved = history.save()
    expect(saved.executions).toBeDefined()
    expect(saved.routeStats).toBeDefined()

    const loaded = RouteHistory.load(saved)
    const performance = loaded.getRoutePerformance(route)
    expect(performance).not.toBeNull()
    expect(performance!.executions).toBe(1)
  })
})
