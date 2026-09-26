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
  getParameterSuggestions,
  detectParameterAnomalies,
} from '../lib/contractRecommendations'

/**
 * A contract function descriptor accepted by the recommendations engine.
 */
export interface ContractFunctionDescriptor {
  name: string;
  doc?: string;
  summary?: string;
  parameters?: Array<{ name?: string; type: string; [key: string]: unknown }>;
  returnType?: string;
  [key: string]: unknown;
}

/**
 * Options accepted by the {@link useContractRecommendations} hook.
 */
export interface UseContractRecommendationsOptions {
  contractFunctions?: ContractFunctionDescriptor[];
  contractId?: string;
  currentFunction?: string;
  context?: string;
  count?: number;
  autoTrack?: boolean;
}

/**
 * A single function recommendation.
 */
export interface ContractRecommendation {
  functionName: string;
  score: number;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Feedback statistics for recommendations.
 */
export interface RecommendationFeedbackStats {
  total: number;
  helpful: number;
  helpfulRate: number;
}

/**
 * Quality estimate for the recommendation model.
 */
export interface RecommendationQuality {
  accuracy: number;
  sampleSize: number;
  status: string;
}

/**
 * An interaction entry recorded by the recommendations engine.
 */
export type ContractInteraction = Record<string, unknown>;

/**
 * Return value of the {@link useContractRecommendations} hook.
 */
export interface UseContractRecommendationsReturn {
  recommendations: ContractRecommendation[];
  history: ContractInteraction[];
  popularFunctions: string[];
  feedbackStats: RecommendationFeedbackStats;
  quality: RecommendationQuality;
  track: (interaction: ContractInteraction) => ContractInteraction;
  feedback: (recommendationId: string, helpful: boolean, actualFunction?: string) => void;
  refresh: () => void;
  clearHistory: () => void;
  getParamSuggestions: (funcName: string, paramDefs: unknown[]) => unknown;
  getAnomalies: (funcName: string, args: unknown[], paramDefs: unknown) => unknown;
}

export function useContractRecommendations({
  contractFunctions = [],
  contractId = '',
  currentFunction = '',
  context = 'operations',
  count = 5,
  autoTrack = true,
}: UseContractRecommendationsOptions = {}): UseContractRecommendationsReturn {
  const network = useStore((s) => s.network)
  const [recommendations, setRecommendations] = useState<ContractRecommendation[]>([])
  const [history, setHistory] = useState<ContractInteraction[]>([])
  const [popularFunctions, setPopularFunctions] = useState<string[]>([])
  const [feedbackStats, setFeedbackStats] = useState<RecommendationFeedbackStats>({ total: 0, helpful: 0, helpfulRate: 0 })
  const [quality, setQuality] = useState<RecommendationQuality>({ accuracy: 0, sampleSize: 0, status: 'learning' })
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now())

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

  const track = useCallback((interaction: ContractInteraction): ContractInteraction => {
    const entry = recordInteraction(interaction)
    setLastRefresh(Date.now())
    return entry
  }, [])

  const feedback = useCallback((recommendationId: string, helpful: boolean, actualFunction?: string): void => {
    recordFeedback(recommendationId, helpful, actualFunction)
    setLastRefresh(Date.now())
  }, [])

  const refresh = useCallback((): void => {
    setLastRefresh(Date.now())
  }, [])

  const clearHistory = useCallback((): void => {
    clearInteractionHistory()
    setLastRefresh(Date.now())
  }, [])

  const getParamSuggestions = useCallback((funcName: string, paramDefs: unknown[]): unknown => {
    return getParameterSuggestions(contractId, funcName, paramDefs)
  }, [contractId])

  const getAnomalies = useCallback((funcName: string, args: unknown[], paramDefs: unknown): unknown => {
    return detectParameterAnomalies({
      contractId,
      functionName: funcName,
      args,
      parameterDefinitions: paramDefs
    })
  }, [contractId])

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
    getParamSuggestions,
    getAnomalies,
  }
}

export default useContractRecommendations
