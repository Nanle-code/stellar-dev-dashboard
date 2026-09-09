/**
 * QueryPredictionEngine
 *
 * AI-powered query prediction engine that proactively suggests search queries
 * based on user context, current task, and historical search patterns.
 *
 * Features:
 * - Context-aware predictions (page, time, recent activity, wallet state)
 * - Historical pattern learning using TensorFlow.js
 * - Click/feedback-driven relevance improvement
 * - Proactive suggestion ranking
 * - Integration with existing search infrastructure
 *
 * Target: 70%+ relevance on suggestions, reduced search effort,
 *         contextually appropriate, continuously learning.
 */

import * as tf from '@tensorflow/tfjs'
import { classifyIntent, type SearchIntent } from './nlpSearchEngine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserContext {
  /** Current page/route the user is on */
  currentPage: string
  /** Recent actions (last 5 user actions) */
  recentActions: string[]
  /** Time of day (0-23) */
  hourOfDay: number
  /** Day of week (0=Sun, 6=Sat) */
  dayOfWeek: number
  /** Connected wallet address (if any) */
  connectedAddress?: string
  /** Current network (mainnet, testnet, etc.) */
  network: string
  /** Currently selected account/entity */
  selectedEntity?: string
  /** Active task (e.g. 'sending', 'viewing-tx', 'browsing') */
  activeTask?: string
  /** Transaction count in current session */
  sessionTxCount: number
  /** Search count in current session */
  sessionSearchCount: number
}

export interface HistoricalSearchPattern {
  /** The search query text */
  query: string
  /** When it was searched */
  timestamp: string
  /** Search intent classification */
  intent: SearchIntent['type']
  /** Whether user clicked a result */
  wasSuccessful: boolean
  /** Which result type was clicked */
  resultType?: string
  /** Context when the search was performed */
  context: UserContext
  /** Times this query has been used */
  usageCount: number
}

export interface QueryPrediction {
  /** Suggested query text */
  query: string
  /** Relevance score 0-1 */
  score: number
  /** Intent classification of predicted query */
  intent: SearchIntent['type']
  /** Why this was suggested */
  reason: QueryPredictionReason
  /** Confidence in prediction 0-1 */
  confidence: number
  /** Whether this was derived from ML model */
  mlGenerated: boolean
}

export type QueryPredictionReason =
  | 'frequent_search'
  | 'contextual_match'
  | 'time_based'
  | 'task_based'
  | 'recent_activity'
  | 'network_based'
  | 'entity_based'
  | 'ml_inferred'

export interface PredictionResult {
  /** Ranked list of predicted queries */
  predictions: QueryPrediction[]
  /** Context used for prediction */
  context: UserContext
  /** When predictions were generated */
  generatedAt: string
  /** Total prediction count */
  totalCount: number
}

export interface PredictionAccuracy {
  /** Overall prediction relevance rate 0-1 */
  overallRelevance: number
  /** Total suggestions shown */
  totalSuggestions: number
  /** Total suggestions clicked */
  totalClicks: number
  /** Click-through rate */
  clickThroughRate: number
  /** Accuracy over last 100 predictions */
  recentAccuracy: number
  /** Predictions by reason type */
  reasonBreakdown: Record<QueryPredictionReason, {
    shown: number
    clicked: number
    relevance: number
  }>
}

export interface QueryPredictionConfig {
  /** Max predictions to return */
  maxPredictions: number
  /** Minimum confidence threshold */
  minConfidence: number
  /** Weight of historical patterns (0-1) */
  historyWeight: number
  /** Weight of context matching (0-1) */
  contextWeight: number
  /** Weight of ML model (0-1) */
  mlWeight: number
  /** Enable learning from feedback */
  enableLearning: boolean
  /** How many historical searches to consider */
  maxHistorySize: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: QueryPredictionConfig = {
  maxPredictions: 8,
  minConfidence: 0.3,
  historyWeight: 0.4,
  contextWeight: 0.35,
  mlWeight: 0.25,
  enableLearning: true,
  maxHistorySize: 500,
}

const PAGE_QUERY_MAP: Record<string, string[]> = {
  '/dashboard': ['account balance', 'recent transactions', 'network status'],
  '/transactions': ['payments', 'failed transactions', 'transaction hash'],
  '/operations': ['payment operations', 'create account', 'manage offer'],
  '/accounts': ['account balance', 'account created', 'account merge'],
  '/contracts': ['invoke contract', 'deploy contract', 'contract state'],
  '/analytics': ['fee analysis', 'volume trends', 'counterparty activity'],
  '/portfolio': ['asset holdings', 'portfolio value', 'token balances'],
  '/settings': ['preferences', 'network config', 'api keys'],
  '/search': ['recent searches', 'saved searches', 'advanced filters'],
  '/fees': ['fee prediction', 'fee history', 'fee optimization'],
}

const TIME_BASED_QUERIES: Record<number, string[]> = {
  0: ['overnight transactions', 'night activity', 'batch payments'],
  6: ['morning balances', 'overnight changes', 'new blocks'],
  9: ['market open', 'active accounts', 'recent operations'],
  12: ['midday summary', 'pending transactions', 'fee estimates'],
  15: ['afternoon activity', 'volume analysis', 'counterparty check'],
  18: ['evening settlement', 'daily summary', 'pending offers'],
  21: ['end of day', 'tomorrow predictions', 'network health'],
}

const WEEKEND_QUERIES = ['weekend activity', 'scheduled payments', 'weekly summary']

const TASK_QUERY_MAP: Record<string, string[]> = {
  sending: ['recipient address', 'fee estimate', 'recent sent payments'],
  'viewing-tx': ['transaction details', 'operation list', 'memo search'],
  browsing: ['popular accounts', 'recent activity', 'network stats'],
  analyzing: ['fee analysis', 'pattern detection', 'counterparty insights'],
  building: ['contract template', 'transaction builder', 'XDR decode'],
  monitoring: ['account activity', 'alerts', 'pending transactions'],
}

// ---------------------------------------------------------------------------
// Feature extraction for ML
// ---------------------------------------------------------------------------

function extractPredictionFeatures(
  context: UserContext,
  history: HistoricalSearchPattern[],
  candidateQueries: string[]
): number[][] {
  const hourNorm = context.hourOfDay / 24
  const dayNorm = context.dayOfWeek / 7
  const txCountNorm = Math.min(context.sessionTxCount / 100, 1)
  const searchCountNorm = Math.min(context.sessionSearchCount / 50, 1)

  // Page encoding (hash to numeric)
  const pageHash = Array.from(context.currentPage).reduce((h, c) => h + c.charCodeAt(0), 0)
  const pageNorm = (pageHash % 100) / 100

  const features: number[][] = []

  for (const query of candidateQueries) {
    // How many times has this query been used?
    const historyMatches = history.filter(h => h.query === query)
    const usageCount = historyMatches.reduce((sum, h) => sum + h.usageCount, 0)
    const usageNorm = Math.min(usageCount / 20, 1)

    // How recently was it used?
    let recencyScore = 0
    if (historyMatches.length > 0) {
      const latest = historyMatches.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0]
      const hoursSince = (Date.now() - new Date(latest.timestamp).getTime()) / 3600000
      recencyScore = Math.max(0, 1 - hoursSince / 168) // Decay over 1 week
    }

    // Success rate of this query
    const successRate = historyMatches.length > 0
      ? historyMatches.filter(h => h.wasSuccessful).length / historyMatches.length
      : 0.5

    // Query length normalization
    const queryLenNorm = Math.min(query.length / 50, 1)

    features.push([
      hourNorm,
      dayNorm,
      txCountNorm,
      searchCountNorm,
      pageNorm,
      usageNorm,
      recencyScore,
      successRate,
      queryLenNorm,
    ])
  }

  return features
}

// ---------------------------------------------------------------------------
// QueryPredictionEngine
// ---------------------------------------------------------------------------

export class QueryPredictionEngine {
  private config: QueryPredictionConfig
  private searchHistory: HistoricalSearchPattern[] = []
  private model: tf.LayersModel | null = null
  private feedbackLog: Array<{
    query: string
    clicked: boolean
    context: UserContext
    timestamp: string
  }> = []
  private lastPredictionHash: string = ''

  // Accuracy tracking
  private shownCount = 0
  private clickCount = 0
  private recentClicks: boolean[] = [] // rolling window of last 100
  private reasonStats: Map<QueryPredictionReason, { shown: number; clicked: number }> = new Map()

  constructor(config: Partial<QueryPredictionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // -----------------------------------------------------------------------
  // History management
  // -----------------------------------------------------------------------

  /** Record a search that was performed (for learning) */
  recordSearch(pattern: Omit<HistoricalSearchPattern, 'usageCount'>): void {
    const existing = this.searchHistory.find(
      h => h.query === pattern.query && h.context.currentPage === pattern.context.currentPage
    )

    if (existing) {
      existing.usageCount += 1
      existing.wasSuccessful = pattern.wasSuccessful || existing.wasSuccessful
      existing.timestamp = pattern.timestamp
    } else {
      this.searchHistory.push({ ...pattern, usageCount: 1 })
    }

    // Trim history
    if (this.searchHistory.length > this.config.maxHistorySize) {
      this.searchHistory.sort((a, b) => b.usageCount - a.usageCount)
      this.searchHistory = this.searchHistory.slice(0, this.config.maxHistorySize)
    }
  }

  /** Record feedback on a suggestion (clicked or ignored) */
  recordFeedback(query: string, context: UserContext, clicked: boolean): void {
    this.feedbackLog.push({
      query,
      clicked,
      context,
      timestamp: new Date().toISOString(),
    })

    if (this.feedbackLog.length > 1000) {
      this.feedbackLog = this.feedbackLog.slice(-1000)
    }

    this.shownCount++
    if (clicked) this.clickCount++

    this.recentClicks.push(clicked)
    if (this.recentClicks.length > 100) {
      this.recentClicks.shift()
    }
  }

  /** Track reason-based accuracy */
  trackReason(reason: QueryPredictionReason, clicked: boolean): void {
    const stats = this.reasonStats.get(reason) || { shown: 0, clicked: 0 }
    stats.shown++
    if (clicked) stats.clicked++
    this.reasonStats.set(reason, stats)
  }

  /** Get search history */
  getHistory(): HistoricalSearchPattern[] {
    return [...this.searchHistory]
  }

  /** Load history from external source */
  loadHistory(history: HistoricalSearchPattern[]): void {
    this.searchHistory = history.slice(0, this.config.maxHistorySize)
  }

  /** Clear all history */
  clearHistory(): void {
    this.searchHistory = []
    this.feedbackLog = []
    this.shownCount = 0
    this.clickCount = 0
    this.recentClicks = []
    this.reasonStats.clear()
    this.lastPredictionHash = ''
  }

  // -----------------------------------------------------------------------
  // Prediction
  // -----------------------------------------------------------------------

  /**
   * Predict queries based on user context and historical patterns.
   * This is the main entry point.
   */
  predict(context: UserContext): PredictionResult {
    const predictions: QueryPrediction[] = []
    const seen = new Set<string>()

    // 1. Frequent searches
    this.addFrequentSearchPredictions(context, predictions, seen)

    // 2. Context-based predictions
    this.addContextualPredictions(context, predictions, seen)

    // 3. Time-based predictions
    this.addTimeBasedPredictions(context, predictions, seen)

    // 4. Task-based predictions
    this.addTaskBasedPredictions(context, predictions, seen)

    // 5. Recent-activity-based predictions
    this.addRecentActivityPredictions(context, predictions, seen)

    // 6. Entity-based predictions
    this.addEntityBasedPredictions(context, predictions, seen)

    // 7. ML-inferred predictions
    this.addMLPredictions(context, predictions, seen)

    // 8. Network-based predictions
    this.addNetworkBasedPredictions(context, predictions, seen)

    // Score and rank
    const scored = this.rankPredictions(predictions, context)

    // Filter by confidence
    const filtered = scored.filter(p => p.confidence >= this.config.minConfidence)

    // Limit results
    const final = filtered.slice(0, this.config.maxPredictions)

    // Compute hash to avoid duplicate renders
    this.lastPredictionHash = final.map(p => p.query).join('|')

    return {
      predictions: final,
      context,
      generatedAt: new Date().toISOString(),
      totalCount: final.length,
    }
  }

  /** Compute a lightweight hash of the context without running full predictions */
  private computeContextHash(context: UserContext): string {
    return [
      context.currentPage,
      context.hourOfDay,
      context.dayOfWeek,
      context.connectedAddress || '',
      context.network,
      context.selectedEntity || '',
      context.activeTask || '',
    ].join('|')
  }

  private lastContextHash: string = ''

  /** Check if predictions would be the same as last batch */
  hasPredictionsChanged(context: UserContext): boolean {
    const newHash = this.computeContextHash(context)
    if (newHash !== this.lastContextHash) {
      this.lastContextHash = newHash
      return true
    }
    return false
  }

  // -----------------------------------------------------------------------
  // Prediction sources
  // -----------------------------------------------------------------------

  private addFrequentSearchPredictions(
    context: UserContext,
    predictions: QueryPrediction[],
    seen: Set<string>
  ): void {
    const frequent = [...this.searchHistory]
      .filter(h => h.usageCount >= 2)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5)

    for (const pattern of frequent) {
      if (seen.has(pattern.query)) continue
      seen.add(pattern.query)

      const recencyDays = (Date.now() - new Date(pattern.timestamp).getTime()) / 86400000
      const recencyFactor = Math.max(0.3, 1 - recencyDays / 30)

      predictions.push({
        query: pattern.query,
        score: 0.7 * recencyFactor,
        intent: pattern.intent,
        reason: 'frequent_search',
        confidence: 0.6 * recencyFactor,
        mlGenerated: false,
      })
    }
  }

  private addContextualPredictions(
    context: UserContext,
    predictions: QueryPrediction[],
    seen: Set<string>
  ): void {
    // Match current page to query templates — prefer the longest (most specific) prefix match
    let bestMatch: { queries: string[] } | null = null
    let bestMatchLen = 0

    for (const [pagePattern, queries] of Object.entries(PAGE_QUERY_MAP)) {
      if (
        context.currentPage === pagePattern ||
        (context.currentPage.startsWith(pagePattern + '/') && pagePattern.length > bestMatchLen)
      ) {
        bestMatch = { queries }
        bestMatchLen = pagePattern.length
      }
    }

    // Fall back to exact-only if no prefix match
    if (!bestMatch && PAGE_QUERY_MAP[context.currentPage]) {
      bestMatch = { queries: PAGE_QUERY_MAP[context.currentPage] }
    }

    if (!bestMatch) return

    for (const query of bestMatch.queries) {
      if (seen.has(query)) continue

      const matchingHistory = this.searchHistory.filter(
        h => h.query === query && h.context.currentPage === context.currentPage
      )
      const boost = Math.min(matchingHistory.length * 0.15, 0.4)

      seen.add(query)
      predictions.push({
        query,
        score: 0.5 + boost,
        intent: classifyIntent(query).type,
        reason: 'contextual_match',
        confidence: 0.5 + boost,
        mlGenerated: false,
      })
    }
  }

  private addTimeBasedPredictions(
    context: UserContext,
    predictions: QueryPrediction[],
    seen: Set<string>
  ): void {
    // Time-of-day based
    for (const [hour, queries] of Object.entries(TIME_BASED_QUERIES)) {
      const h = parseInt(hour, 10)
      if (Math.abs(context.hourOfDay - h) <= 2) {
        for (const query of queries) {
          if (seen.has(query)) continue
          seen.add(query)
          predictions.push({
            query,
            score: 0.45,
            intent: classifyIntent(query).type,
            reason: 'time_based',
            confidence: 0.4,
            mlGenerated: false,
          })
        }
      }
    }

    // Weekend-specific
    if (context.dayOfWeek === 0 || context.dayOfWeek === 6) {
      for (const query of WEEKEND_QUERIES) {
        if (seen.has(query)) continue
        seen.add(query)
        predictions.push({
          query,
          score: 0.4,
          intent: 'general',
          reason: 'time_based',
          confidence: 0.35,
          mlGenerated: false,
        })
      }
    }
  }

  private addTaskBasedPredictions(
    context: UserContext,
    predictions: QueryPrediction[],
    seen: Set<string>
  ): void {
    if (!context.activeTask) return

    const taskQueries = TASK_QUERY_MAP[context.activeTask]
    if (!taskQueries) return

    for (const query of taskQueries) {
      if (seen.has(query)) continue
      seen.add(query)

      // Boost if user commonly searches this during this task
      const taskMatch = this.searchHistory.filter(
        h => h.query === query && h.context.activeTask === context.activeTask
      )
      const boost = Math.min(taskMatch.length * 0.2, 0.5)

      predictions.push({
        query,
        score: 0.55 + boost,
        intent: classifyIntent(query).type,
        reason: 'task_based',
        confidence: 0.5 + boost,
        mlGenerated: false,
      })
    }
  }

  private addRecentActivityPredictions(
    context: UserContext,
    predictions: QueryPrediction[],
    seen: Set<string>
  ): void {
    if (context.recentActions.length === 0) return

    // Derive queries from recent actions
    const actionQueries: string[] = []

    for (const action of context.recentActions) {
      if (action.includes('viewed_account')) {
        const addr = action.split(':')[1]
        if (addr) actionQueries.push(`account ${addr}`)
      } else if (action.includes('viewed_transaction')) {
        const hash = action.split(':')[1]
        if (hash) actionQueries.push(`transaction ${hash}`)
      } else if (action.includes('viewed_contract')) {
        actionQueries.push('invoke contract')
      } else if (action.includes('sent_payment')) {
        actionQueries.push('payment history')
        actionQueries.push('recent payments')
      }
    }

    for (const query of actionQueries) {
      if (seen.has(query)) continue
      const confidence = 0.65
      seen.add(query)
      predictions.push({
        query,
        score: 0.6,
        intent: classifyIntent(query).type,
        reason: 'recent_activity',
        confidence,
        mlGenerated: false,
      })
    }
  }

  private addEntityBasedPredictions(
    context: UserContext,
    predictions: QueryPrediction[],
    seen: Set<string>
  ): void {
    if (!context.selectedEntity && !context.connectedAddress) return

    const entity = context.selectedEntity || context.connectedAddress

    if (entity) {
      const entityQueries = [
        `account ${entity}`,
        `transactions to ${entity}`,
        `recent activity ${entity}`,
        `counterparty ${entity}`,
      ]

      for (const query of entityQueries) {
        if (seen.has(query)) continue
        seen.add(query)
        predictions.push({
          query,
          score: 0.55,
          intent: 'account',
          reason: 'entity_based',
          confidence: 0.55,
          mlGenerated: false,
        })
      }
    }
  }

  private addNetworkBasedPredictions(
    context: UserContext,
    predictions: QueryPrediction[],
    seen: Set<string>
  ): void {
    const networkQueries: Record<string, string[]> = {
      mainnet: ['mainnet activity', 'live transactions', 'network fees'],
      testnet: ['testnet faucet', 'test account', 'test transaction'],
      futurenet: ['soroban contracts', 'futurenet status', 'smart contract'],
    }

    const queries = networkQueries[context.network]
    if (!queries) return

    for (const query of queries) {
      if (seen.has(query)) continue
      seen.add(query)
      predictions.push({
        query,
        score: 0.4,
        intent: 'general',
        reason: 'network_based',
        confidence: 0.35,
        mlGenerated: false,
      })
    }
  }

  private addMLPredictions(
    context: UserContext,
    predictions: QueryPrediction[],
    seen: Set<string>
  ): void {
    // Collect candidate queries
    const candidateQueries = this.getCandidateQueries(context)

    if (candidateQueries.length === 0 || !this.model) return

    try {
      const features = extractPredictionFeatures(context, this.searchHistory, candidateQueries)
      const tensor = tf.tensor2d(features)
      const scores = this.model.predict(tensor) as tf.Tensor
      const scoreData = Array.from(scores.dataSync())

      tensor.dispose()
      scores.dispose()

      // Map scores to predictions
      for (let i = 0; i < candidateQueries.length; i++) {
        const query = candidateQueries[i]
        if (seen.has(query)) continue
        const mlScore = scoreData[i] || 0

        if (mlScore > 0.3) {
          seen.add(query)
          predictions.push({
            query,
            score: mlScore,
            intent: classifyIntent(query).type,
            reason: 'ml_inferred',
            confidence: mlScore,
            mlGenerated: true,
          })
        }
      }
    } catch (err) {
      console.warn('ML prediction failed, falling back to heuristic predictions:', err)
    }
  }

  private getCandidateQueries(context: UserContext): string[] {
    const candidates = new Set<string>()

    // Add frequent queries
    for (const h of this.searchHistory.slice(0, 10)) {
      candidates.add(h.query)
    }

    // Add context-matched queries — prefer longest (most specific) prefix match
    let bestMatchLen = 0
    for (const [pagePattern, queries] of Object.entries(PAGE_QUERY_MAP)) {
      if (
        context.currentPage === pagePattern ||
        (context.currentPage.startsWith(pagePattern + '/') && pagePattern.length > bestMatchLen)
      ) {
        for (const q of queries) candidates.add(q)
        bestMatchLen = pagePattern.length
      }
    }
    if (bestMatchLen === 0 && PAGE_QUERY_MAP[context.currentPage]) {
      for (const q of PAGE_QUERY_MAP[context.currentPage]) candidates.add(q)
    }

    // Add task queries
    if (context.activeTask && TASK_QUERY_MAP[context.activeTask]) {
      for (const q of TASK_QUERY_MAP[context.activeTask]) {
        candidates.add(q)
      }
    }

    return Array.from(candidates).slice(0, 20)
  }

  // -----------------------------------------------------------------------
  // Ranking
  // -----------------------------------------------------------------------

  private rankPredictions(
    predictions: QueryPrediction[],
    context: UserContext
  ): QueryPrediction[] {
    // Apply diversity penalty - don't show too many queries of the same type
    const typeCounts = new Map<SearchIntent['type'], number>()

    return predictions
      .map(p => {
        const typeCount = typeCounts.get(p.intent) || 0
        typeCounts.set(p.intent, typeCount + 1)

        // Diversity penalty
        const diversityPenalty = typeCount > 2 ? 0.7 : typeCount > 1 ? 0.85 : 1

        // Apply weighting
        let finalScore = p.score * diversityPenalty

        // Boost historical success
        const histMatch = this.searchHistory.find(h => h.query === p.query)
        if (histMatch?.wasSuccessful) {
          finalScore *= 1.2
        }

        // Apply feedback boost
        const feedbackEntries = this.feedbackLog.filter(f => f.query === p.query)
        const clickRate = feedbackEntries.length > 0
          ? feedbackEntries.filter(f => f.clicked).length / feedbackEntries.length
          : 0.5

        finalScore *= (0.8 + clickRate * 0.4)

        // Apply config weights based on reason (blend, don't zero out)
        switch (p.reason) {
          case 'frequent_search':
            finalScore = finalScore * 0.7 + this.config.historyWeight * 0.3
            break
          case 'contextual_match':
          case 'task_based':
          case 'entity_based':
            finalScore = finalScore * 0.6 + this.config.contextWeight * 0.4
            break
          case 'ml_inferred':
            finalScore = finalScore * 0.5 + this.config.mlWeight * 0.5
            break
          case 'time_based':
          case 'network_based':
          case 'recent_activity':
            finalScore = finalScore * 0.5 + 0.3
            break
        }

        return {
          ...p,
          score: finalScore,
          confidence: Math.min(1, finalScore * 1.2),
        }
      })
      .sort((a, b) => b.score - a.score)
  }

  // -----------------------------------------------------------------------
  // ML Model
  // -----------------------------------------------------------------------

  /** Initialize the TFJS prediction model */
  async initModel(): Promise<void> {
    try {
      this.model = await tf.loadLayersModel('indexeddb://stellar-query-prediction-model')
      this.model.compile({
        optimizer: 'adam',
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
      })
    } catch {
      const model = tf.sequential()
      model.add(tf.layers.dense({ units: 24, activation: 'relu', inputShape: [9] }))
      model.add(tf.layers.dropout({ rate: 0.2 }))
      model.add(tf.layers.dense({ units: 16, activation: 'relu' }))
      model.add(tf.layers.dropout({ rate: 0.1 }))
      model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }))

      model.compile({
        optimizer: 'adam',
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
      })

      this.model = model
    }
  }

  /** Train the model on historical data */
  async trainModel(
    context: UserContext,
    positiveQueries: string[],
    negativeQueries: string[]
  ): Promise<{ accuracy: number; loss: number }> {
    if (!this.model) {
      await this.initModel()
    }

    const allQueries = [...positiveQueries, ...negativeQueries]
    const labels = [
      ...positiveQueries.map(() => 1),
      ...negativeQueries.map(() => 0),
    ]

    if (allQueries.length < 4) {
      return { accuracy: 0, loss: 0 }
    }

    const features = extractPredictionFeatures(context, this.searchHistory, allQueries)

    const xs = tf.tensor2d(features)
    const ys = tf.tensor2d(labels.map(l => [l]))

    const history = await this.model!.fit(xs, ys, {
      epochs: 10,
      batchSize: Math.min(8, allQueries.length),
      shuffle: true,
      verbose: 0,
    })

    try {
      await this.model!.save('indexeddb://stellar-query-prediction-model')
    } catch {
      // Ignore save errors in test environments
    }

    xs.dispose()
    ys.dispose()

    const acc = history.history.accuracy
      ? (history.history.accuracy[history.history.accuracy.length - 1] as number)
      : 1
    const loss = history.history.loss
      ? (history.history.loss[history.history.loss.length - 1] as number)
      : 0

    return { accuracy: acc, loss }
  }

  // -----------------------------------------------------------------------
  // Accuracy & Statistics
  // -----------------------------------------------------------------------

  /** Get prediction accuracy metrics */
  getAccuracy(): PredictionAccuracy {
    const recentAccuracy = this.recentClicks.length > 0
      ? this.recentClicks.filter(c => c).length / this.recentClicks.length
      : 0

    const breakdown: Record<string, { shown: number; clicked: number; relevance: number }> = {}
    for (const [reason, stats] of this.reasonStats.entries()) {
      breakdown[reason] = {
        shown: stats.shown,
        clicked: stats.clicked,
        relevance: stats.shown > 0 ? stats.clicked / stats.shown : 0,
      }
    }

    return {
      overallRelevance: this.shownCount > 0 ? this.clickCount / this.shownCount : 0,
      totalSuggestions: this.shownCount,
      totalClicks: this.clickCount,
      clickThroughRate: this.shownCount > 0 ? this.clickCount / this.shownCount : 0,
      recentAccuracy,
      reasonBreakdown: breakdown as PredictionAccuracy['reasonBreakdown'],
    }
  }

  /** Get engine statistics */
  getStatistics() {
    return {
      historySize: this.searchHistory.length,
      feedbackLogSize: this.feedbackLog.length,
      accuracy: this.getAccuracy(),
      modelLoaded: this.model !== null,
      config: { ...this.config },
    }
  }

  /** Update configuration */
  updateConfig(partial: Partial<QueryPredictionConfig>): void {
    this.config = { ...this.config, ...partial }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const queryPredictionEngine = new QueryPredictionEngine()
