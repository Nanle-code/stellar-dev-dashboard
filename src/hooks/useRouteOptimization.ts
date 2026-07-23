import { useCallback } from 'react'
import { useRouteOptimizationStore } from '../lib/routeOptimizationStore'

interface RouteOptimizationParams {
  sourceAsset: string
  destAsset: string
  amount: number
  liquidity?: number
  fee?: number
}

interface Route {
  path?: string[]
  source_amount?: string
  destination_amount?: string
  source_asset_code?: string
  destination_asset_code?: string
}

export function useRouteOptimization() {
  const {
    rankedRoutes,
    selectedRoute,
    slippagePredictions,
    routeExplanations,
    isLoading,
    error,
    settings,
    setRankedRoutes,
    setSelectedRoute,
    setSlippagePredictions,
    setRouteExplanations,
    setLoading,
    setError,
    addOptimizationHistory,
    updatePerformanceMetrics,
  } = useRouteOptimizationStore()

  const optimizeRoutes = useCallback(async (
    availableRoutes: Route[],
    params: RouteOptimizationParams
  ) => {
    if (!availableRoutes || availableRoutes.length === 0) {
      setError('No routes available for optimization')
      return null
    }

    setLoading(true)
    setError(null)

    try {
      const ranked = rankRoutesByCriteria(availableRoutes, params)
      setRankedRoutes(ranked)

      const predictions = availableRoutes.map(route =>
        predictSlippageForRoute(route, params)
      )
      setSlippagePredictions(predictions)

      const explanations = ranked.map((rankedRoute, index) =>
        generateRouteExplanation(rankedRoute, predictions[index])
      )
      setRouteExplanations(explanations)

      const bestRoute = ranked[0]
      setSelectedRoute(bestRoute?.route || null)

      addOptimizationHistory({
        timestamp: Date.now(),
        params,
        routeCount: availableRoutes.length,
        selectedRoute: bestRoute,
        improvement: calculateImprovement(availableRoutes, bestRoute),
      })

      return {
        rankedRoutes: ranked,
        slippagePredictions: predictions,
        routeExplanations: explanations,
        selectedRoute: bestRoute,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Optimization failed'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [setRankedRoutes, setSlippagePredictions, setRouteExplanations, setSelectedRoute, setError, setLoading, addOptimizationHistory])

  const selectRoute = useCallback((route: Route) => {
    setSelectedRoute(route)
  }, [setSelectedRoute])

  const recordExecution = useCallback((
    route: Route,
    result: { success: boolean; actualSlippage: number; executionTime: number }
  ) => {
    const metrics = {
      totalOptimizations: 1,
      avgImprovement: result.success ? 1 : 0,
      successRate: result.success ? 1 : 0,
    }
    updatePerformanceMetrics(metrics)
  }, [updatePerformanceMetrics])

  return {
    routes,
    rankedRoutes,
    selectedRoute,
    slippagePredictions,
    routeExplanations,
    isLoading,
    error,
    settings,
    optimizeRoutes,
    selectRoute,
    recordExecution,
    clearOptimization,
  }
}

function rankRoutesByCriteria(
  routes: Route[],
  params: RouteOptimizationParams
): Array<{ route: Route; overallScore: number; rank: number; scores: Record<string, number> }> {
  const scored = routes.map((route, index) => {
    const costScore = calculateCostScore(route)
    const speedScore = calculateSpeedScore(route)
    const reliabilityScore = calculateReliabilityScore(route)
    const slippageScore = calculateSlippageScore(route, params)

    const overallScore =
      costScore * 0.35 +
      speedScore * 0.25 +
      reliabilityScore * 0.25 +
      slippageScore * 0.15

    return {
      route,
      originalIndex: index,
      overallScore,
      scores: {
        cost: costScore,
        speed: speedScore,
        reliability: reliabilityScore,
        slippage: slippageScore,
      },
    }
  })

  scored.sort((a, b) => b.overallScore - a.overallScore)
  scored.forEach((item, index) => {
    item.rank = index + 1
  })

  return scored
}

function calculateCostScore(route: Route): number {
  const sourceAmount = parseFloat(route.source_amount || '0')
  const destAmount = parseFloat(route.destination_amount || '0')
  if (destAmount === 0) return 0
  const efficiency = destAmount / sourceAmount
  return Math.min(1, efficiency)
}

function calculateSpeedScore(route: Route): number {
  const hops = route.path?.length || 0
  return Math.max(0, 1 - hops * 0.15)
}

function calculateReliabilityScore(route: Route): number {
  const hops = route.path?.length || 0
  if (hops <= 2) return 0.9
  if (hops <= 3) return 0.7
  return 0.5
}

function calculateSlippageScore(route: Route, params: RouteOptimizationParams): number {
  const hops = route.path?.length || 0
  const amount = params.amount
  const baseSlippage = hops * 0.001
  const amountFactor = amount > 10000 ? 0.005 : 0.001
  const predictedSlippage = baseSlippage + amountFactor
  return 1 - Math.min(1, predictedSlippage * 10)
}

function predictSlippageForRoute(
  route: Route,
  params: RouteOptimizationParams
): {
  predictedSlippage: number
  confidence: number
  riskLevel: string
  breakdown: Record<string, number>
} {
  const hops = route.path?.length || 0
  const amount = params.amount
  const liquidity = params.liquidity || 0.5

  const hopScore = Math.min(1, hops * 0.15)
  const liquidityScore = liquidity >= 0.8 ? 0.1 : liquidity >= 0.5 ? 0.3 : liquidity >= 0.3 ? 0.5 : 0.8
  const amountScore = amount < 100 ? 0.1 : amount < 1000 ? 0.2 : amount < 10000 ? 0.4 : 0.6

  const predictedSlippage =
    hopScore * 0.25 +
    liquidityScore * 0.30 +
    amountScore * 0.20 +
    0.5 * 0.15 +
    0.3 * 0.10

  const riskLevel = predictedSlippage < 0.01 ? 'low' :
    predictedSlippage < 0.03 ? 'medium' :
    predictedSlippage < 0.05 ? 'high' : 'critical'

  return {
    predictedSlippage: Math.min(0.1, Math.max(0, predictedSlippage)),
    confidence: 0.7,
    riskLevel,
    breakdown: {
      hopContribution: hopScore * 0.25,
      liquidityContribution: liquidityScore * 0.30,
      amountContribution: amountScore * 0.20,
    },
  }
}

function generateRouteExplanation(
  rankedRoute: { route: Route; overallScore: number; rank: number; scores: Record<string, number> },
  slippagePrediction: { predictedSlippage: number; riskLevel: string }
): {
  summary: string
  factors: Array<{ type: string; label: string; detail: string }>
  recommendation: string
  warnings: string[]
} {
  const { route, overallScore, rank, scores } = rankedRoute
  const hops = route.path?.length || 0
  const destAmount = parseFloat(route.destination_amount || '0')
  const sourceAmount = parseFloat(route.source_amount || '0')
  const efficiency = sourceAmount > 0 ? (destAmount / sourceAmount * 100).toFixed(1) : '0'

  const factors: Array<{ type: string; label: string; detail: string }> = []

  if (scores.cost > 0.7) {
    factors.push({ type: 'positive', label: 'Cost Efficiency', detail: 'Excellent value for your transaction.' })
  } else if (scores.cost < 0.3) {
    factors.push({ type: 'negative', label: 'Cost Efficiency', detail: 'More expensive than alternatives.' })
  }

  if (hops <= 2) {
    factors.push({ type: 'positive', label: 'Simplicity', detail: `Only ${hops} step${hops !== 1 ? 's' : ''}.` })
  } else if (hops >= 4) {
    factors.push({ type: 'warning', label: 'Complexity', detail: `${hops} hops increase slippage risk.` })
  }

  if (slippagePrediction.riskLevel === 'low') {
    factors.push({ type: 'positive', label: 'Low Slippage Risk', detail: 'Minimal slippage expected.' })
  } else if (slippagePrediction.riskLevel === 'high') {
    factors.push({ type: 'warning', label: 'Slippage Risk', detail: 'Higher slippage may occur.' })
  }

  const warnings: string[] = []
  if (hops >= 4) warnings.push('Multi-hop routes have higher failure risk.')
  if (slippagePrediction.riskLevel === 'high' || slippagePrediction.riskLevel === 'critical') {
    warnings.push('Consider setting higher slippage tolerance.')
  }

  return {
    summary: rank === 1
      ? `Recommended route with ${hops} hop${hops !== 1 ? 's' : ''} and ${efficiency}% efficiency.`
      : `Route #${rank} with ${hops} hop${hops !== 1 ? 's' : ''} and ${efficiency}% efficiency.`,
    factors,
    recommendation: rank === 1 && overallScore > 0.8
      ? 'Strongly recommended - best balance of cost, speed, and reliability.'
      : rank === 1
        ? 'Recommended as the best available option.'
        : 'Consider this as an alternative.',
    warnings,
  }
}

function calculateImprovement(
  allRoutes: Route[],
  bestRoute: { route: Route; overallScore: number } | undefined
): number {
  if (!bestRoute || allRoutes.length < 2) return 0
  const avgScore = allRoutes.reduce((sum, route) => {
    const score = calculateCostScore(route) * 0.35 +
      calculateSpeedScore(route) * 0.25 +
      calculateReliabilityScore(route) * 0.25 +
      0.5 * 0.15
    return sum + score
  }, 0) / allRoutes.length
  return ((bestRoute.overallScore - avgScore) / avgScore) * 100
}

export default useRouteOptimization
