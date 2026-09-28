/**
 * useQueryPrediction
 *
 * React hook that integrates the QueryPredictionEngine and SearchIntentClassifier
 * with the existing search infrastructure. Provides proactive query suggestions
 * based on user context, current task, and historical patterns.
 *
 * Features:
 * - Context-aware predictions that update as context changes
 * - Feedback loop for continuous learning
 * - Integration with existing search hooks
 * - Proactive suggestion display
 * - Accuracy tracking
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  QueryPredictionEngine,
  queryPredictionEngine,
  type UserContext,
  type QueryPrediction,
  type PredictionResult,
  type PredictionAccuracy,
} from '../lib/queryPredictionEngine'
import {
  SearchIntentClassifier,
  searchIntentClassifier,
  type IntentPrediction,
} from '../lib/searchIntentClassifier'
import { loadPreferences, type UserPreferences } from '../lib/userPreferences'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseQueryPredictionOptions {
  /** Current page/route */
  currentPage: string
  /** Recent user actions */
  recentActions?: string[]
  /** Currently connected wallet address */
  connectedAddress?: string
  /** Current network */
  network?: string
  /** Currently selected entity (account, tx hash, etc.) */
  selectedEntity?: string
  /** Active task description */
  activeTask?: string
  /** Session transaction count */
  sessionTxCount?: number
  /** Session search count */
  sessionSearchCount?: number
  /** Custom prediction engine instance */
  engine?: QueryPredictionEngine
  /** Custom intent classifier instance */
  classifier?: SearchIntentClassifier
  /** Polling interval for context changes (ms, 0 = no polling) */
  refreshIntervalMs?: number
  /** Enable ML model */
  enableML?: boolean
  /** Auto-train model when enough data */
  autoTrain?: boolean
}

export interface UseQueryPredictionResult {
  /** Predicted queries the user might search for */
  predictions: QueryPrediction[]
  /** Predicted search intents before typing */
  intentPredictions: IntentPrediction[]
  /** Whether predictions are being computed */
  loading: boolean
  /** The current user context */
  context: UserContext
  /** Accept a prediction (user clicked it) */
  acceptPrediction: (prediction: QueryPrediction) => void
  /** Dismiss a prediction (user saw but ignored) */
  dismissPrediction: (prediction: QueryPrediction) => void
  /** Record a search the user actually performed */
  recordSearch: (query: string, wasSuccessful: boolean, resultType?: string) => void
  /** Force refresh predictions */
  refresh: () => void
  /** Accuracy metrics */
  accuracy: PredictionAccuracy | null
  /** Whether the ML model is loaded */
  mlReady: boolean
  /** Whether there's enough data for predictions */
  hasEnoughData: boolean
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQueryPrediction({
  currentPage,
  recentActions = [],
  connectedAddress,
  network = 'testnet',
  selectedEntity,
  activeTask,
  sessionTxCount = 0,
  sessionSearchCount = 0,
  engine = queryPredictionEngine,
  classifier = searchIntentClassifier,
  refreshIntervalMs = 0,
  enableML = true,
  autoTrain = true,
}: UseQueryPredictionOptions): UseQueryPredictionResult {
  const [predictions, setPredictions] = useState<QueryPrediction[]>([])
  const [intentPredictions, setIntentPredictions] = useState<IntentPrediction[]>([])
  const [loading, setLoading] = useState(false)
  const [accuracy, setAccuracy] = useState<PredictionAccuracy | null>(null)
  const [mlReady, setMlReady] = useState(false)
  const mlInitRef = useRef(false)
  const trainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Build context object
  const context = useMemo<UserContext>(() => ({
    currentPage,
    recentActions,
    hourOfDay: new Date().getHours(),
    dayOfWeek: new Date().getDay(),
    connectedAddress,
    network,
    selectedEntity,
    activeTask,
    sessionTxCount,
    sessionSearchCount,
  }), [
    currentPage, recentActions, connectedAddress, network,
    selectedEntity, activeTask, sessionTxCount, sessionSearchCount,
  ])

  // Initialize ML model
  useEffect(() => {
    if (!enableML || mlInitRef.current) return
    mlInitRef.current = true

    const init = async () => {
      try {
        await engine.initModel()
        await classifier.initModel()
        setMlReady(true)
      } catch {
        // ML not available in this environment
        setMlReady(false)
      }
    }

    init()
  }, [enableML, engine, classifier])

  // Compute predictions
  const computePredictions = useCallback(() => {
    setLoading(true)
    try {
      const result = engine.predict(context)
      setPredictions(result.predictions)

      const intentPreds = classifier.predictIntent(context)
      setIntentPredictions(intentPreds)

      setAccuracy(engine.getAccuracy())
    } catch (err) {
      console.error('Query prediction failed:', err)
    } finally {
      setLoading(false)
    }
  }, [engine, classifier, context])

  // Initial prediction + context change
  useEffect(() => {
    computePredictions()
  }, [computePredictions])

  // Polling refresh
  useEffect(() => {
    if (refreshIntervalMs <= 0) return

    const interval = setInterval(() => {
      if (engine.hasPredictionsChanged(context)) {
        computePredictions()
      }
    }, refreshIntervalMs)

    return () => clearInterval(interval)
  }, [refreshIntervalMs, engine, context, computePredictions])

  // Auto-train when enough new data has accumulated
  const trainRef = useRef<{ lastTrainCount: number; lastIntentCount: number }>({
    lastTrainCount: 0,
    lastIntentCount: 0,
  })

  useEffect(() => {
    if (!autoTrain || !mlReady) return

    if (trainTimeoutRef.current) clearTimeout(trainTimeoutRef.current)

    trainTimeoutRef.current = setTimeout(async () => {
      const history = engine.getHistory()
      const intentHistory = classifier.getHistory()

      // Only train if we have at least +5 new entries since last training
      const newSearches = history.length - trainRef.current.lastTrainCount
      const newIntents = intentHistory.length - trainRef.current.lastIntentCount

      if (history.length >= 10 && (newSearches >= 5 || newIntents >= 5)) {
        trainRef.current.lastTrainCount = history.length
        trainRef.current.lastIntentCount = intentHistory.length

        const positiveQueries = history
          .filter(h => h.wasSuccessful)
          .map(h => h.query)
        const negativeQueries = history
          .filter(h => !h.wasSuccessful)
          .slice(0, 20)
          .map(h => h.query)

        try {
          await Promise.all([
            engine.trainModel(context, positiveQueries, negativeQueries),
            classifier.trainModel(),
          ])
        } catch {
          // Training failed, continue without ML
        }
      }
    }, 2000)

    return () => {
      if (trainTimeoutRef.current) clearTimeout(trainTimeoutRef.current)
    }
  }, [autoTrain, mlReady, engine, classifier, context])

  // Accept a prediction
  const acceptPrediction = useCallback((prediction: QueryPrediction) => {
    engine.recordFeedback(prediction.query, context, true)
    engine.trackReason(prediction.reason, true)
    setAccuracy(engine.getAccuracy())
  }, [engine, context])

  // Dismiss a prediction
  const dismissPrediction = useCallback((prediction: QueryPrediction) => {
    engine.recordFeedback(prediction.query, context, false)
    engine.trackReason(prediction.reason, false)
    setAccuracy(engine.getAccuracy())
  }, [engine, context])

  // Record an actual search
  const recordSearch = useCallback((query: string, wasSuccessful: boolean, resultType?: string) => {
    const intent = classifier.classify(query, context)

    engine.recordSearch({
      query,
      timestamp: new Date().toISOString(),
      intent: intent.type,
      wasSuccessful,
      resultType,
      context,
    })

    classifier.record({
      query,
      intent: intent.type,
      timestamp: new Date().toISOString(),
      context,
    })

    // Refresh predictions after recording
    setTimeout(() => computePredictions(), 100)
  }, [engine, classifier, context, computePredictions])

  // Manual refresh
  const refresh = useCallback(() => {
    computePredictions()
  }, [computePredictions])

  const hasEnoughData = engine.getHistory().length >= 3

  return {
    predictions,
    intentPredictions,
    loading,
    context,
    acceptPrediction,
    dismissPrediction,
    recordSearch,
    refresh,
    accuracy,
    mlReady,
    hasEnoughData,
  }
}

export default useQueryPrediction
