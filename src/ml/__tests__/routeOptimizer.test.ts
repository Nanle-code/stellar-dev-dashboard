import { describe, it, expect } from 'vitest'
import { RouteOptimizer } from '../routeOptimizer'

describe('RouteOptimizer', () => {
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
    const optimizer = new RouteOptimizer()
    expect(optimizer).toBeDefined()
    const stats = optimizer.getRouteStats()
    expect(stats.totalEntries).toBe(0)
  })

  it('initializes with custom config', () => {
    const optimizer = new RouteOptimizer({ learningRate: 0.5, epsilon: 0.5 })
    expect(optimizer).toBeDefined()
  })

  it('selects an action from available routes', () => {
    const optimizer = new RouteOptimizer()
    const state = { sourceAsset: 'XLM', destAsset: 'USDC', amount: 1000, liquidity: 0.5, fee: 0.01 }
    const routes = [makeRoute(), makeRoute({ source_amount: '2000' })]
    const action = optimizer.selectAction(state, routes)
    expect(action).toBeGreaterThanOrEqual(0)
    expect(action).toBeLessThan(routes.length)
  })

  it('optimizes returns a selected route and confidence', () => {
    const optimizer = new RouteOptimizer()
    const state = { sourceAsset: 'XLM', destAsset: 'USDC', amount: 1000, liquidity: 0.5, fee: 0.01 }
    const routes = [makeRoute(), makeRoute({ source_amount: '2000' })]
    const result = optimizer.optimize(state, routes)

    expect(result.selectedRoute).toBeDefined()
    expect(result.routeIndex).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.allRoutes).toHaveLength(2)
  })

  it('updates Q-values after execution', () => {
    const optimizer = new RouteOptimizer()
    const state = { sourceAsset: 'XLM', destAsset: 'USDC', amount: 1000, liquidity: 0.5, fee: 0.01 }
    const routes = [makeRoute()]
    const executionResult = { expectedDestination: '990', actualSlippage: 0.005 }

    optimizer.optimize(state, routes, executionResult)
    const stats = optimizer.getRouteStats()
    expect(stats.totalEntries).toBeGreaterThan(0)
  })

  it('calculates reward correctly', () => {
    const optimizer = new RouteOptimizer()
    const route = makeRoute({ destination_amount: '1000' })
    const executionResult = { expectedDestination: '990', actualSlippage: 0.01 }

    const reward = optimizer.calculateReward(route, executionResult)
    expect(typeof reward).toBe('number')
  })

  it('decays epsilon over time', () => {
    const optimizer = new RouteOptimizer({ epsilon: 0.5 })
    const state = { sourceAsset: 'XLM', destAsset: 'USDC', amount: 1000, liquidity: 0.5, fee: 0.01 }
    const routes = [makeRoute()]

    const initialEpsilon = optimizer.epsilon
    for (let i = 0; i < 10; i++) {
      optimizer.optimize(state, routes)
    }
    expect(optimizer.epsilon).toBeLessThan(initialEpsilon)
  })

  it('save and load work correctly', () => {
    const optimizer = new RouteOptimizer()
    const state = { sourceAsset: 'XLM', destAsset: 'USDC', amount: 1000, liquidity: 0.5, fee: 0.01 }
    const routes = [makeRoute()]

    optimizer.optimize(state, routes)
    const saved = optimizer.save()
    expect(saved.qTable).toBeDefined()
    expect(saved.config).toBeDefined()

    const loaded = RouteOptimizer.load(saved)
    const stats = loaded.getRouteStats()
    expect(stats.totalEntries).toBe(optimizer.getRouteStats().totalEntries)
  })

  it('buckets amounts correctly', () => {
    const optimizer = new RouteOptimizer()
    expect(optimizer.bucketAmount(50)).toBe('small')
    expect(optimizer.bucketAmount(500)).toBe('medium')
    expect(optimizer.bucketAmount(5000)).toBe('large')
    expect(optimizer.bucketAmount(50000)).toBe('whale')
  })

  it('estimates slippage based on hops and amount', () => {
    const optimizer = new RouteOptimizer()
    const smallRoute = makeRoute({ path: ['A'], source_amount: '100' })
    const largeRoute = makeRoute({ path: ['A', 'B', 'C', 'D'], source_amount: '50000' })

    const smallSlippage = optimizer.estimateSlippage(smallRoute)
    const largeSlippage = optimizer.estimateSlippage(largeRoute)
    expect(largeSlippage).toBeGreaterThan(smallSlippage)
  })
})
