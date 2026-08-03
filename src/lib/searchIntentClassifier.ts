/**
 * SearchIntentClassifier
 *
 * ML-enhanced search intent classification built on top of the existing
 * NLP search engine's intent classification. Adds context awareness and
 * learning from user behavior to improve intent prediction accuracy.
 *
 * Integrates with nlpSearchEngine's classifyIntent but enhances it with:
 * - Context-weighted intent probabilities
 * - Historical intent patterns per user
 * - ML-based refinement using TensorFlow.js
 * - Intent transition probability modeling
 */

import * as tf from '@tensorflow/tfjs'
import { classifyIntent, type SearchIntent } from './nlpSearchEngine'
import type { UserContext } from './queryPredictionEngine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassifiedIntent extends SearchIntent {
  /** Alternative intents with probabilities */
  alternatives: IntentAlternative[]
  /** Whether ML model was used */
  mlEnhanced: boolean
  /** Context that influenced classification */
  contextHints: string[]
}

export interface IntentAlternative {
  type: SearchIntent['type']
  confidence: number
  reason: string
}

export interface IntentPattern {
  /** The search query text */
  query: string
  /** Intent classified */
  intent: SearchIntent['type']
  /** When this query was classified */
  timestamp: string
  /** Context at time of classification */
  context: UserContext
  /** User-corrected intent (if any) */
  correctedIntent?: SearchIntent['type']
}

export interface IntentPrediction {
  /** Predicted intent type */
  intent: SearchIntent['type']
  /** Probability 0-1 */
  probability: number
  /** Expected entities */
  expectedEntities: Partial<SearchIntent['entities']>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTENT_CONTEXT_MAP: Record<string, SearchIntent['type'][]> = {
  '/dashboard': ['general', 'account'],
  '/transactions': ['transaction', 'general'],
  '/operations': ['operation', 'transaction'],
  '/accounts': ['account', 'general'],
  '/contracts': ['contract', 'operation'],
  '/analytics': ['general', 'transaction'],
  '/portfolio': ['account', 'general'],
  '/search': ['general', 'transaction', 'account', 'contract', 'operation'],
  '/fees': ['transaction', 'general'],
}

// Intent transition probabilities (Markov-like)
// Given user just searched with intent X, what's the likely next intent?
const INTENT_TRANSITIONS: Record<SearchIntent['type'], Partial<Record<SearchIntent['type'], number>>> = {
  transaction: { account: 0.3, operation: 0.25, transaction: 0.25, general: 0.2 },
  account: { transaction: 0.35, operation: 0.25, account: 0.25, general: 0.15 },
  operation: { transaction: 0.35, account: 0.2, contract: 0.2, operation: 0.25 },
  contract: { operation: 0.3, transaction: 0.25, contract: 0.3, general: 0.15 },
  general: { transaction: 0.3, account: 0.25, operation: 0.2, contract: 0.1, general: 0.15 },
}

// ---------------------------------------------------------------------------
// Feature extraction for intent ML
// ---------------------------------------------------------------------------

function extractIntentFeatures(
  query: string,
  context: UserContext,
  baseIntent: SearchIntent,
  history: IntentPattern[]
): number[] {
  const queryLen = Math.min(query.length / 100, 1)
  const wordCount = Math.min(query.split(/\s+/).length / 10, 1)
  const hourNorm = context.hourOfDay / 24
  const dayNorm = context.dayOfWeek / 7
  const txCountNorm = Math.min(context.sessionTxCount / 100, 1)

  // Base intent one-hot
  const intentTypes: SearchIntent['type'][] = ['transaction', 'account', 'operation', 'contract', 'general']
  const baseIntentOH = intentTypes.map(t => (t === baseIntent.type ? 1 : 0))

  // Page encoding
  const pageHash = Array.from(context.currentPage).reduce((h, c) => h + c.charCodeAt(0), 0)
  const pageNorm = (pageHash % 100) / 100

  // Historical intent prevalence for this user
  const historyByIntent = new Map<SearchIntent['type'], number>()
  for (const h of history) {
    historyByIntent.set(h.intent, (historyByIntent.get(h.intent) || 0) + 1)
  }
  const totalHistory = history.length || 1
  const historyIntentOH = intentTypes.map(t => (historyByIntent.get(t) || 0) / totalHistory)

  // Last intent
  const lastIntent = history.length > 0 ? history[0].intent : 'general'
  const lastIntentOH = intentTypes.map(t => (t === lastIntent ? 1 : 0))

  // Whether query contains an address
  const hasAddress = /[A-Z0-9]{56}/.test(query) ? 1 : 0

  // Whether query contains amounts
  const hasAmount = /\d+(\.\d+)?/.test(query) ? 1 : 0

  return [
    queryLen,
    wordCount,
    hourNorm,
    dayNorm,
    txCountNorm,
    pageNorm,
    hasAddress,
    hasAmount,
    ...baseIntentOH,
    ...historyIntentOH,
    ...lastIntentOH,
  ]
}

// ---------------------------------------------------------------------------
// SearchIntentClassifier
// ---------------------------------------------------------------------------

export class SearchIntentClassifier {
  private model: tf.LayersModel | null = null
  private intentHistory: IntentPattern[] = []
  private correctionLog: Array<{ query: string; predicted: string; corrected: string }> = []
  private maxHistorySize = 500

  // -----------------------------------------------------------------------
  // Core classification
  // -----------------------------------------------------------------------

  /**
   * Classify a search query's intent, enhanced with context and ML.
   * Returns a rich classification including alternatives.
   */
  classify(query: string, context?: UserContext): ClassifiedIntent {
    const baseIntent = classifyIntent(query)

    // Build context hints
    const contextHints: string[] = []

    // Check context-based intent boost
    if (context) {
      const pageIntents = INTENT_CONTEXT_MAP[context.currentPage] ||
        Object.values(INTENT_CONTEXT_MAP).flat()

      if (pageIntents.includes(baseIntent.type)) {
        contextHints.push(`Page context "${context.currentPage}" supports ${baseIntent.type} intent`)
      }

      if (context.activeTask) {
        contextHints.push(`Active task "${context.activeTask}" influences intent prediction`)
      }
    }

    // Generate alternatives
    const alternatives = this.generateAlternatives(query, baseIntent, context)

    // Try ML refinement
    let mlEnhanced = false
    if (this.model && context && this.intentHistory.length >= 5) {
      try {
        const mlResult = this.mlClassify(query, context, baseIntent)
        if (mlResult && mlResult.confidence > baseIntent.confidence) {
          mlEnhanced = true
          contextHints.push('ML model refined classification')

          return {
            ...mlResult,
            alternatives,
            mlEnhanced,
            contextHints,
          }
        }
      } catch {
        // ML failed, fall through to base
      }
    }

    return {
      ...baseIntent,
      alternatives,
      mlEnhanced,
      contextHints,
    }
  }

  /**
   * Predict the most likely intent BEFORE user types, based on context alone.
   */
  predictIntent(context: UserContext): IntentPrediction[] {
    const predictions: IntentPrediction[] = []

    // 1. Context-based prediction
    const pageIntents = INTENT_CONTEXT_MAP[context.currentPage]
    if (pageIntents) {
      for (let i = 0; i < pageIntents.length; i++) {
        const intentType = pageIntents[i]
        // Earlier entries get higher probability
        const probability = Math.max(0.3, 0.8 - i * 0.2)

        predictions.push({
          intent: intentType,
          probability,
          expectedEntities: this.getExpectedEntitiesForIntent(intentType, context),
        })
      }
    }

    // 2. Last-intent transition
    if (this.intentHistory.length > 0) {
      const lastIntent = this.intentHistory[0].intent
      const transitions = INTENT_TRANSITIONS[lastIntent]
      if (transitions) {
        for (const [nextIntent, probability] of Object.entries(transitions)) {
          if (!predictions.some(p => p.intent === nextIntent)) {
            predictions.push({
              intent: nextIntent as SearchIntent['type'],
              probability: probability as number,
              expectedEntities: this.getExpectedEntitiesForIntent(
                nextIntent as SearchIntent['type'],
                context
              ),
            })
          } else {
            // Boost existing probability
            const existing = predictions.find(p => p.intent === nextIntent)!
            existing.probability = Math.min(1, existing.probability + (probability as number) * 0.3)
          }
        }
      }
    }

    // Sort by probability
    predictions.sort((a, b) => b.probability - a.probability)

    return predictions
  }

  // -----------------------------------------------------------------------
  // Alternatives generation
  // -----------------------------------------------------------------------

  private generateAlternatives(
    query: string,
    baseIntent: SearchIntent,
    context?: UserContext
  ): IntentAlternative[] {
    const alternatives: IntentAlternative[] = []
    const lowerQuery = query.toLowerCase()

    // If query could match multiple intents
    if (lowerQuery.includes('contract') && baseIntent.type !== 'contract') {
      alternatives.push({
        type: 'contract',
        confidence: 0.4,
        reason: 'Query contains "contract" keyword',
      })
    }

    if (lowerQuery.includes('payment') && baseIntent.type !== 'transaction') {
      alternatives.push({
        type: 'transaction',
        confidence: 0.45,
        reason: 'Query mentions payments',
      })
    }

    if (lowerQuery.includes('account') && baseIntent.type !== 'account') {
      alternatives.push({
        type: 'account',
        confidence: 0.45,
        reason: 'Query mentions accounts',
      })
    }

    if (lowerQuery.includes('balance') && baseIntent.type !== 'account') {
      alternatives.push({
        type: 'account',
        confidence: 0.5,
        reason: 'Query mentions balance',
      })
    }

    // Context-based alternatives
    if (context) {
      const pageIntents = INTENT_CONTEXT_MAP[context.currentPage] || []
      for (const altIntent of pageIntents) {
        if (altIntent !== baseIntent.type && !alternatives.some(a => a.type === altIntent)) {
          alternatives.push({
            type: altIntent,
            confidence: 0.35,
            reason: `Context page "${context.currentPage}" suggests ${altIntent} intent`,
          })
        }
      }
    }

    return alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 3)
  }

  // -----------------------------------------------------------------------
  // Expected entities per intent
  // -----------------------------------------------------------------------

  private getExpectedEntitiesForIntent(
    intentType: SearchIntent['type'],
    context: UserContext
  ): Partial<SearchIntent['entities']> {
    const entities: Partial<SearchIntent['entities']> = {}

    if (intentType === 'account' && context.connectedAddress) {
      entities.addresses = [context.connectedAddress]
    }

    if (intentType === 'transaction' && context.sessionTxCount > 0) {
      entities.operationTypes = ['payment']
    }

    return entities
  }

  // -----------------------------------------------------------------------
  // Learning
  // -----------------------------------------------------------------------

  /** Record a classified intent for learning */
  record(pattern: IntentPattern): void {
    this.intentHistory.unshift(pattern)
    if (this.intentHistory.length > this.maxHistorySize) {
      this.intentHistory = this.intentHistory.slice(0, this.maxHistorySize)
    }
  }

  /** Record a user correction of intent classification */
  recordCorrection(query: string, predictedIntent: string, correctedIntent: string): void {
    this.correctionLog.push({ query, predicted: predictedIntent, corrected: correctedIntent })
    if (this.correctionLog.length > 100) {
      this.correctionLog.shift()
    }

    // Update the relevant history entry
    const entry = this.intentHistory.find(h => h.query === query)
    if (entry) {
      entry.correctedIntent = correctedIntent as SearchIntent['type']
    }
  }

  // -----------------------------------------------------------------------
  // ML Model
  // -----------------------------------------------------------------------

  /** Initialize the TFJS intent classification model */
  async initModel(): Promise<void> {
    try {
      this.model = await tf.loadLayersModel('indexeddb://stellar-intent-classifier-model')
      this.model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
      })
    } catch {
      const numFeatures = 7 + 5 + 5 + 5 // features + baseIntentOH + historyOH + lastIntentOH = 22
      const intentTypes = 5

      const model = tf.sequential()
      model.add(tf.layers.dense({ units: 20, activation: 'relu', inputShape: [numFeatures] }))
      model.add(tf.layers.dropout({ rate: 0.15 }))
      model.add(tf.layers.dense({ units: 12, activation: 'relu' }))
      model.add(tf.layers.dense({ units: intentTypes, activation: 'softmax' }))

      model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
      })

      this.model = model
    }
  }

  /** Train the intent classifier model */
  async trainModel(): Promise<{ accuracy: number; loss: number }> {
    if (!this.model) {
      await this.initModel()
    }

    if (this.intentHistory.length < 10) {
      return { accuracy: 0, loss: 0 }
    }

    const trainingData = this.prepareTrainingData()
    if (trainingData.features.length === 0) {
      return { accuracy: 0, loss: 0 }
    }

    const xs = tf.tensor2d(trainingData.features)
    const ys = tf.tensor2d(trainingData.labels)

    const history = await this.model!.fit(xs, ys, {
      epochs: 15,
      batchSize: Math.min(16, trainingData.features.length),
      shuffle: true,
      verbose: 0,
    })

    try {
      await this.model!.save('indexeddb://stellar-intent-classifier-model')
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

  private prepareTrainingData(): { features: number[][]; labels: number[][] } {
    const intentTypes: SearchIntent['type'][] = ['transaction', 'account', 'operation', 'contract', 'general']
    const features: number[][] = []
    const labels: number[][] = []

    for (const pattern of this.intentHistory) {
      const baseIntent = classifyIntent(pattern.query)
      const feats = extractIntentFeatures(pattern.query, pattern.context, baseIntent, this.intentHistory)

      // One-hot encode the actual intent (or corrected intent)
      const actualIntent = pattern.correctedIntent || pattern.intent
      const oneHot = intentTypes.map(t => (t === actualIntent ? 1 : 0))

      features.push(feats)
      labels.push(oneHot)

      // Duplicate corrected entries for emphasis
      if (pattern.correctedIntent) {
        features.push(feats)
        labels.push(oneHot)
      }
    }

    return { features, labels }
  }

  private mlClassify(
    query: string,
    context: UserContext,
    baseIntent: SearchIntent
  ): SearchIntent | null {
    if (!this.model) return null

    try {
      const features = extractIntentFeatures(query, context, baseIntent, this.intentHistory)
      const tensor = tf.tensor2d([features])
      const predTensor = this.model.predict(tensor) as tf.Tensor
      const probs = Array.from(predTensor.dataSync())

      tensor.dispose()
      predTensor.dispose()

      const intentTypes: SearchIntent['type'][] = ['transaction', 'account', 'operation', 'contract', 'general']
      const maxIdx = probs.indexOf(Math.max(...probs))
      const maxConf = probs[maxIdx]

      if (maxConf > baseIntent.confidence && intentTypes[maxIdx] !== baseIntent.type) {
        // ML overrides the base classification
        return {
          type: intentTypes[maxIdx],
          entities: baseIntent.entities,
          query: baseIntent.query,
          confidence: maxConf,
        }
      }
    } catch {
      // ML failed
    }

    return null
  }

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  /** Get classifier statistics */
  getStatistics() {
    const correctCount = this.correctionLog.length
    const intentCounts = new Map<SearchIntent['type'], number>()
    for (const h of this.intentHistory) {
      intentCounts.set(h.intent, (intentCounts.get(h.intent) || 0) + 1)
    }

    return {
      historySize: this.intentHistory.length,
      correctionCount: correctCount,
      intentDistribution: Object.fromEntries(intentCounts),
      modelLoaded: this.model !== null,
    }
  }

  /** Get intent history */
  getHistory(): IntentPattern[] {
    return [...this.intentHistory]
  }

  /** Clear all data */
  clear(): void {
    this.intentHistory = []
    this.correctionLog = []
    this.model = null
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const searchIntentClassifier = new SearchIntentClassifier()
