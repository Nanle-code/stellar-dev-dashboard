/*
 * Fee Prediction Integration Service (AI-Enhanced Transaction Fee Prediction #535)
 * Integrates ML-based fee prediction with transaction building and network monitoring
 */

import { FeePredictor } from './feePredictor'
import { StellarNetworkMonitor, type NetworkState } from './feePredictor'
import type { BuildTransactionParams } from './stellar'
import type { FeePredictionInput, UserFeePreferences } from './feePredictor'

// ---- Configuration ----

export interface IntegrationConfig {
  enableRealTimeMonitoring: boolean
  predictionHistorySize: number
  accuracyThreshold: number
  maxFeeIncreasePercentage: number
  cachePredictions: boolean
}

export const DEFAULT_CONFIG: IntegrationConfig = {
  enableRealTimeMonitoring: true,
  predictionHistorySize: 1000,
  accuracyThreshold: 0.90,
  maxFeeIncreasePercentage: 50,
  cachePredictions: true,
}

// ---- Fee Prediction Cache ----

export interface CachedPrediction {
  fee: number
  confidence: number
  timestamp: string
  key: string
  ttl: number
}

export class FeePredictionCache {
  private cache: Map<string, CachedPrediction> = new Map()
  private maxSize: number

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
  }

  set(key: string, prediction: CachedPrediction): void {
    // Evict oldest if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, prediction)
  }

  get(key: string): CachedPrediction | undefined {
    const prediction = this.cache.get(key)
    if (!prediction) return undefined

    // Check if prediction is expired (24 hours)
    const age = Date.now() - new Date(prediction.timestamp).getTime()
    if (age > prediction.ttl * 1000) {
      this.cache.delete(key)
      return undefined
    }

    return prediction
  }

  clear(): void {
    this.cache.clear()
  }
}

// ---- Integration Service ----

export class FeePredictionIntegration {
  private predictor: FeePredictor
  private monitor: StellarNetworkMonitor
  private cache: FeePredictionCache
  private config: IntegrationConfig
  private predictionHistory: Array<{ input: FeePredictionInput; prediction: any; timestamp: string }> = []

  constructor(config?: Partial<IntegrationConfig>) {
    this.predictor = new FeePredictor()
    this.monitor = new StellarNetworkMonitor()
    this.cache = new FeePredictionCache(config?.predictionHistorySize)
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Start monitoring if enabled
    if (this.config.enableRealTimeMonitoring) {
      this.startRealTimeUpdates()
    }
  }

  private startRealTimeUpdates(): void {
    let lastState: NetworkState | null = null

    this.monitor.subscribe(async (state: NetworkState) => {
      // Only update if state changed significantly
      if (lastState && this.isStateSimilar(lastState, state)) {
        return
      }

      lastState = state

      // Invalidate predictions when network conditions change
      if (this.config.cachePredictions) {
        this.cache.clear()
      }
    })
  }

  private isStateSimilar(a: NetworkState, b: NetworkState): boolean {
    return (
      Math.abs(a.congestionRatio - b.congestionRatio) < 0.1 &&
      Math.abs(a.recentCloseTime - b.recentCloseTime) < 2.0
    )
  }

  // ---- Public API ----

  async predictFeeForTransaction(
    params: BuildTransactionParams & {
      userPreferences?: UserFeePreferences
      sourceAccount?: string
    }
  ): Promise<{ prediction: any; transaction?: any; errors?: string[] }> {
    try {
      // Build fee prediction input
      const predictionInput: FeePredictionInput = {
        operations: params.operations,
        transaction: undefined, // Will be populated if simulating
        userPreferences: params.userPreferences,
      }

      // Get network state
      const networkState = await this.monitor.getCurrentState()

      // Add network conditions to prediction input
      predictionInput.networkConditions = networkState

      // Create cache key
      const cacheKey = this.createCacheKey(predictionInput, networkState)

      // Check cache first
      let prediction = this.config.cachePredictions
        ? this.cache.get(cacheKey)
        : undefined

      if (!prediction) {
        // Generate new prediction
        prediction = await this.predictor.predictFee(predictionInput)

        // Cache the prediction
        if (this.config.cachePredictions) {
          this.cache.set(cacheKey, {
            fee: prediction.predictedFee,
            confidence: prediction.confidence,
            timestamp: prediction.predictionTimestamp,
            key: cacheKey,
            ttl: 24 * 60 * 60, // 24 hours
          })
        }

        // Store in history
        this.addToHistory(predictionInput, prediction)
      } else {
        // Convert cached data to full prediction object
        prediction = {
          predictedFee: prediction.fee,
          confidence: prediction.confidence,
          expectedConfirmationTime: this.calculateTimeForFee(prediction.fee, params.userPreferences),
          networkCongestion: networkState.congestionRatio,
          modelVersion: '2.0.0',
          predictionTimestamp: prediction.timestamp,
        }
      }

      // Build transaction with predicted fee
      const transaction = await this.buildTransactionWithFee(
        params,
        prediction.predictedFee
      )

      return {
        prediction,
        transaction,
      }
    } catch (error) {
      return {
        errors: [error instanceof Error ? error.message : 'Fee prediction failed'],
      }
    }
  }

  async updateNetworkState(): Promise<NetworkState> {
    return this.monitor.getCurrentState()
  }

  // ---- Transaction Building ----

  private async buildTransactionWithFee(
    params: BuildTransactionParams,
    predictedFee: number
  ): Promise<any> {
    // Import here to avoid circular dependencies
    const { buildTransaction } = await import('./stellar')

    // Create a copy with the predicted fee
    const transactionParams: BuildTransactionParams = {
      ...params,
      baseFee: predictedFee,
    }

    return buildTransaction(transactionParams)
  }

  // ---- Historical Accuracy Tracking ----

  async recordPredictionAccuracy(
    prediction: any,
    actualFee?: number,
    confirmationTime?: number
  ): Promise<void> {
    if (!actualFee) {
      return // Cannot compute accuracy without actual values
    }

    // Calculate accuracy metrics
    const feeAccuracy = 1 - Math.abs(prediction.predictedFee - actualFee) / actualFee
    const accuracyScore = Math.max(0, feeAccuracy)

    // Update predictor's accuracy
    this.predictor.updateAccuracy(accuracyScore)

    // Store in history for analytics
    const historyEntry = {
      input: prediction.input,
      prediction,
      timestamp: new Date().toISOString(),
      actualFee,
      confirmationTime,
      accuracy: accuracyScore,
    }

    this.addToHistory(prediction.input, prediction, historyEntry)

    // Check if accuracy is below threshold and trigger model retraining
    if (accuracyScore < this.config.accuracyThreshold) {
      console.warn(`Fee prediction accuracy below threshold: ${accuracyScore.toFixed(2)}`)
      // In production, this would trigger model retraining
    }
  }

  // ---- Analytics and Monitoring ----

  getPredictionMetrics(): {
    accuracy: number
    totalPredictions: number
    recentAccuracy: number
    cacheHitRate: number
  } {
    const predictorMetrics = this.predictor.getAccuracyMetrics()
    const recentPredictions = this.predictionHistory.filter(
      p => new Date(p.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    )

    const recentAccuracy = recentPredictions.length > 0
      ? recentPredictions.reduce((sum, p) => sum + (p.accuracy || 0), 0) / recentPredictions.length
      : 0

    const cacheSize = this.cache['cache'].size
    const cacheHitRate = this.config.cachePredictions && this.predictionHistory.length > 0
      ? cacheSize / this.config.predictionHistorySize
      : 0

    return {
      accuracy: predictorMetrics.accuracy,
      totalPredictions: predictorMetrics.totalPredictions,
      recentAccuracy,
      cacheHitRate,
    }
  }

  // ---- Utility Methods ----

  private createCacheKey(
    input: FeePredictionInput,
    networkState: NetworkState
  ): string {
    const keyData = JSON.stringify({
      operations: input.operations?.length || 0,
      networkCongestion: networkState.congestionRatio,
      operationCount: input.operations?.length || 0,
    })

    return btoa(keyData).slice(0, 16)
  }

  private calculateTimeForFee(
    fee: number,
    preferences?: UserFeePreferences
  ): string {
    if (!preferences) {
      return fee > 300 ? 'next ledger' : fee > 200 ? '1-2 ledgers' : '~3 ledgers'
    }

    switch (preferences.targetConfirmationTime) {
      case 'slow':
        return '~3-4 ledgers'
      case 'standard':
        return fee > 250 ? '1-2 ledgers' : '~next ledger'
      case 'priority':
        return '~next ledger'
      case 'instant':
        return fee > 400 ? '~next ledger' : '~current ledger'
      default:
        return '~1-2 ledgers'
    }
  }

  private addToHistory(
    input: FeePredictionInput,
    prediction: any,
    extra?: any
  ): void {
    const historyEntry = {
      input,
      prediction,
      timestamp: new Date().toISOString(),
      ...extra,
    }

    this.predictionHistory.push(historyEntry)

    // Trim history if it gets too large
    if (this.predictionHistory.length > this.config.predictionHistorySize) {
      this.predictionHistory = this.predictionHistory.slice(-this.config.predictionHistorySize)
    }
  }

  // ---- Configuration ----

  updateConfig(newConfig: Partial<IntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // Clear cache if cache settings changed
    if (newConfig.cachePredictions !== undefined) {
      this.cache.clear()
    }
  }

  // ---- Cleanup ----

  cleanup(): void {
    // Stop network monitoring
    // Note: Implementation depends on monitor interface
  }
}

// ---- Export Types ----

export type {
  IntegrationConfig,
  CachedPrediction,
}
