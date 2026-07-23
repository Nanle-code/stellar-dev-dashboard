import { useState, useCallback } from 'react'

interface SlippagePrediction {
  predictedSlippage: number
  confidence: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  breakdown: {
    hopContribution: number
    liquidityContribution: number
    amountContribution: number
    volatilityContribution: number
    timeContribution: number
  }
  recommendedTolerance: number
}

interface SlippagePredictionParams {
  sourceAsset: string
  destAsset: string
  amount: number
  hops: number
  liquidity?: number
}

export function useSlippagePrediction() {
  const [history, setHistory] = useState<Map<string, SlippagePrediction[]>>(new Map())

  const predictSlippage = useCallback((params: SlippagePredictionParams): SlippagePrediction => {
    const { hops, amount, liquidity = 0.5, sourceAsset, destAsset } = params
    const assetPair = `${sourceAsset}-${destAsset}`

    const hopScore = Math.min(1, hops * 0.15)
    const liquidityScore = liquidity >= 0.8 ? 0.1 : liquidity >= 0.5 ? 0.3 : liquidity >= 0.3 ? 0.5 : 0.8
    const amountScore = amount < 100 ? 0.1 : amount < 1000 ? 0.2 : amount < 10000 ? 0.4 : amount < 100000 ? 0.6 : 0.9
    const volatilityScore = calculateVolatilityScore(assetPair, history)
    const timeScore = getTimeOfDayScore()

    const predictedSlippage =
      hopScore * 0.25 +
      liquidityScore * 0.30 +
      amountScore * 0.20 +
      volatilityScore * 0.15 +
      timeScore * 0.10

    const clampedSlippage = Math.min(0.1, Math.max(0, predictedSlippage))
    const riskLevel = getRiskLevel(clampedSlippage)
    const confidence = calculateConfidence(assetPair, history)
    const recommendedTolerance = getRecommendedTolerance(clampedSlippage, riskLevel)

    const prediction: SlippagePrediction = {
      predictedSlippage: clampedSlippage,
      confidence,
      riskLevel,
      breakdown: {
        hopContribution: hopScore * 0.25,
        liquidityContribution: liquidityScore * 0.30,
        amountContribution: amountScore * 0.20,
        volatilityContribution: volatilityScore * 0.15,
        timeContribution: timeScore * 0.10,
      },
      recommendedTolerance,
    }

    const pairHistory = history.get(assetPair) || []
    pairHistory.push(prediction)
    if (pairHistory.length > 50) pairHistory.shift()
    setHistory(new Map(history).set(assetPair, pairHistory))

    return prediction
  }, [history])

  const getHistoricalAverage = useCallback((assetPair: string): SlippagePrediction | null => {
    const pairHistory = history.get(assetPair)
    if (!pairHistory || pairHistory.length === 0) return null

    const avgSlippage = pairHistory.reduce((sum, p) => sum + p.predictedSlippage, 0) / pairHistory.length
    const avgConfidence = pairHistory.reduce((sum, p) => sum + p.confidence, 0) / pairHistory.length

    return {
      predictedSlippage: avgSlippage,
      confidence: avgConfidence,
      riskLevel: getRiskLevel(avgSlippage),
      breakdown: {
        hopContribution: 0,
        liquidityContribution: 0,
        amountContribution: 0,
        volatilityContribution: 0,
        timeContribution: 0,
      },
      recommendedTolerance: getRecommendedTolerance(avgSlippage, getRiskLevel(avgSlippage)),
    }
  }, [history])

  const getRiskAssessment = useCallback((prediction: SlippagePrediction): {
    level: string
    message: string
    action: string
  } => {
    switch (prediction.riskLevel) {
      case 'low':
        return {
          level: 'low',
          message: 'Minimal slippage expected. Safe to proceed.',
          action: 'Use default slippage tolerance.',
        }
      case 'medium':
        return {
          level: 'medium',
          message: 'Moderate slippage risk. Monitor execution.',
          action: 'Consider setting 1.5x slippage tolerance.',
        }
      case 'high':
        return {
          level: 'high',
          message: 'Higher slippage risk. Proceed with caution.',
          action: 'Set 2x slippage tolerance or reduce amount.',
        }
      case 'critical':
        return {
          level: 'critical',
          message: 'Very high slippage risk. Execution may fail.',
          action: 'Split transaction or wait for better conditions.',
        }
    }
  }, [])

  return {
    predictSlippage,
    getHistoricalAverage,
    getRiskAssessment,
    history: Array.from(history.entries()),
  }
}

function calculateVolatilityScore(
  assetPair: string,
  history: Map<string, SlippagePrediction[]>
): number {
  const pairHistory = history.get(assetPair)
  if (!pairHistory || pairHistory.length < 2) return 0.5

  const recent = pairHistory.slice(-10)
  const slippages = recent.map(p => p.predictedSlippage)
  const mean = slippages.reduce((a, b) => a + b, 0) / slippages.length
  const variance = slippages.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / slippages.length
  return Math.sqrt(variance)
}

function getTimeOfDayScore(): number {
  const hour = new Date().getHours()
  if (hour >= 8 && hour <= 16) return 0.2
  if (hour >= 16 && hour <= 20) return 0.4
  return 0.6
}

function getRiskLevel(slippage: number): 'low' | 'medium' | 'high' | 'critical' {
  if (slippage < 0.01) return 'low'
  if (slippage < 0.03) return 'medium'
  if (slippage < 0.05) return 'high'
  return 'critical'
}

function calculateConfidence(
  assetPair: string,
  history: Map<string, SlippagePrediction[]>
): number {
  const pairHistory = history.get(assetPair)
  if (!pairHistory) return 0.3
  if (pairHistory.length < 10) return 0.5
  if (pairHistory.length < 50) return 0.7
  return 0.9
}

function getRecommendedTolerance(slippage: number, riskLevel: string): number {
  const multipliers: Record<string, number> = {
    low: 1.5,
    medium: 2.0,
    high: 2.5,
    critical: 3.0,
  }
  return slippage * (multipliers[riskLevel] || 2.0)
}

export default useSlippagePrediction
