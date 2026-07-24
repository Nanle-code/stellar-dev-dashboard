import { useState, useCallback, useMemo, useEffect } from 'react'
import { useStore } from '../lib/store'
import {
  getRecommendations,
  recordInteraction,
  recordFeedback,
  getInteractionHistory,
  getPopularFunctions,
  getFeedbackStats,
  getRecommendationQuality,
  clearInteractionHistory,
} from '../lib/contractRecommendations'

export function useContractRecommendations({
  contractFunctions = [],
  contractId = '',
  currentFunction = '',
  context = 'operations',
  count = 5,
  autoTrack = true,
} = {}) {
  const network = useStore((s) => s.network)
  const [recommendations, setRecommendations] = useState([])
  const [history, setHistory] = useState([])
  const [popularFunctions, setPopularFunctions] = useState([])
  const [feedbackStats, setFeedbackStats] = useState({ total: 0, helpful: 0, helpfulRate: 0 })
  const [quality, setQuality] = useState({ accuracy: 0, sampleSize: 0, status: 'learning' })
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  useEffect(() => {
    if (!contractFunctions || contractFunctions.length === 0) {
      setRecommendations([])
      return
    }

    const recs = getRecommendations({
      contractFunctions,
      contractId,
      currentFunction,
      network,
      context,
      count,
    })
    setRecommendations(recs)
  }, [contractFunctions, contractId, currentFunction, network, context, count, lastRefresh])

  useEffect(() => {
    setHistory(getInteractionHistory())
    setPopularFunctions(getPopularFunctions(contractId, network))
    setFeedbackStats(getFeedbackStats())
    setQuality(getRecommendationQuality())
  }, [contractId, network, lastRefresh])

  const track = useCallback((interaction) => {
    const entry = recordInteraction(interaction)
    setLastRefresh(Date.now())
    return entry
  }, [])

  const feedback = useCallback((recommendationId, helpful, actualFunction) => {
    recordFeedback(recommendationId, helpful, actualFunction)
    setLastRefresh(Date.now())
  }, [])

  const refresh = useCallback(() => {
    setLastRefresh(Date.now())
  }, [])

  const clearHistory = useCallback(() => {
    clearInteractionHistory()
    setLastRefresh(Date.now())
  }, [])

  return {
    recommendations,
    history,
    popularFunctions,
    feedbackStats,
    quality,
    track,
    feedback,
    refresh,
    clearHistory,
  }
}

export default useContractRecommendations
