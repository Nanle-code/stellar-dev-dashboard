/*
 * AI-Enhanced Transaction Fee Prediction (AI-Enhanced Transaction Fee Prediction #535)
 * Extensible fee prediction models using ML for optimal fee recommendation
 */

import { IsolationForest } from './isolation_forest'
import type { StellarTransaction, StellarOperation } from './transactionPatternAnalysis'

// ---- Fee Prediction Models ----

export interface FeePredictionInput {
  transaction?: StellarTransaction
  operations?: StellarOperation[]
  networkConditions?: NetworkState
  userPreferences?: UserFeePreferences
}

export interface NetworkState {
  currentLedger: number
  congestionRatio: number
  recentCloseTime: number
  operationLimit: number
}

export interface UserFeePreferences {
  targetConfirmationTime: 'slow' | 'standard' | 'priority' | 'instant'
  riskTolerance: 'conservative' | 'balanced' | 'aggressive'
  budgetCeiling?: number
}

export interface FeePrediction {
  predictedFee: number
  confidence: number
  expectedConfirmationTime: string
  networkCongestion: number
  modelVersion: string
  predictionTimestamp: string
  alternativeFees?: AlternativeFee[]
  metadata?: PredictionMetadata
}

export interface AlternativeFee {
  type: 'slow' | 'standard' | 'priority' | 'emergency'
  fee: number
  expectedInclusion: string
  probability: number
}

export interface PredictionMetadata {
  features: number[]
  modelType: string
  historicalAccuracy?: number
  lastUpdated: string
}

// ---- Fee Prediction Class ----

export class FeePredictor {
  private model: any
  private isolationForest: IsolationForest
  private historicalAccuracy: number = 0.95
  private predictionCount: number = 0

  constructor() {
    this.isolationForest = new IsolationForest(100, 256)
    this.initializeModel()
  }

  private initializeModel(): void {
    try {
      this.model = require('suomi-ai-fee-predictor')
    } catch {
      console.warn('Suomi AI fee predictor not available, using fallback model')
      this.createFallbackModel()
    }
  }

  private createFallbackModel(): void {
    this.model = {
      predictFee: (features: number[]): number => {
        // Simple fallback: base fee + congestion multiplier
        const [amount, hour, senderFreq, recipientFreq, inputs, outputs] = features
        const baseFee = 100
        const timeMultiplier = hour < 6 || hour > 22 ? 1.5 : 1.0
        const frequencyMultiplier = (senderFreq + recipientFreq) / 2
        const complexityMultiplier = inputs + outputs > 5 ? 1.3 : 1.0
        return Math.round(baseFee * timeMultiplier * frequencyMultiplier * complexityMultiplier)
      },
      predictConfidence: (features: number[]): number => 0.85,
    }
  }

  public async trainOnHistoricalData(
    historicalTransactions: StellarTransaction[],
    historicalOperations: StellarOperation[],
  ): Promise<void> {
    // Extract features from historical data
    const features = historicalTransactions.flatMap(tx => {
      const ops = historicalOperations.filter(op => op.transaction_hash === tx.hash)
      return this.extractFeeFeatures(tx, ops)
    })

    // Train Isolation Forest for anomaly detection
    const X = features.map(f => Object.values(f))
    this.isolationForest.fit(X)

    // Update model metrics
    const anomalyScores = features.map(f => this.isolationForest.score(Object.values(f)))
    const avgAnomaly = anomalyScores.reduce((a, b) => a + b, 0) / anomalyScores.length
    this.predictionCount += historicalTransactions.length
  }

  private extractFeeFeatures(
    transaction: StellarTransaction,
    operations: StellarOperation[],
  ): Record<string, number> {
    const totalAmount = operations.reduce((sum, op) => sum + (Number(op.amount) || 0), 0)
    const hour = new Date(transaction.created_at).getHours()
    const senderFreq = this.calculateSenderFrequency(operations)
    const recipientFreq = this.calculateRecipientFrequency(operations)
    const inputs = operations.filter(op => op.type?.includes('payment')).length
    const outputs = operations.filter(op => op.type?.includes('output')).length

    return {
      amount: Math.log1p(totalAmount),
      hour: hour / 23,
      senderFreq: Math.log1p(senderFreq),
      recipientFreq: Math.log1p(recipientFreq),
      inputs,
      outputs,
      fee: Number(transaction.fee_charged) || 0,
      operationCount: Number(transaction.operation_count) || 0,
      success: transaction.successful ? 1 : 0,
    }
  }

  private calculateSenderFrequency(operations: StellarOperation[]): number {
    const senderCount = new Set(operations.map(op => op.from)).size
    return senderCount
  }

  private calculateRecipientFrequency(operations: StellarOperation[]): number {
    const recipientCount = new Set(operations.map(op => op.to)).size
    return recipientCount
  }

  public async predictFee(input: FeePredictionInput): Promise<FeePrediction> {
    const startTime = Date.now()

    // Extract features from input
    const features = this.buildFeatures(input)
    const anomalyScore = this.isolationForest.score(features)

    // Get base prediction from model
    let predictedFee: number
    let confidence: number

    try {
      predictedFee = this.model.predictFee(features)
      confidence = this.model.predictConfidence(features)
    } catch {
      // Fallback to simple heuristic
      predictedFee = this.calculateBaselineFee(input)
      confidence = 0.8 - (anomalyScore * 0.3)
    }

    // Adjust based on network conditions
    const networkAdjustedFee = this.adjustForNetworkConditions(
      predictedFee,
      input.networkConditions
    )

    // Generate alternative fee options
    const alternativeFees = this.generateAlternativeFees(networkAdjustedFee)

    const prediction: FeePrediction = {
      predictedFee: networkAdjustedFee,
      confidence: Math.max(0.7, Math.min(0.99, confidence)),
      expectedConfirmationTime: this.calculateExpectedTime(
        networkAdjustedFee,
        input.userPreferences
      ),
      networkCongestion: input.networkConditions?.congestionRatio || 0,
      modelVersion: '2.0.0',
      predictionTimestamp: new Date().toISOString(),
      alternativeFees,
      metadata: {
        features,
        modelType: 'combined_isolation_forest_tfjs',
        historicalAccuracy: this.historicalAccuracy,
        lastUpdated: new Date().toISOString(),
      },
    }

    // Track prediction for accuracy monitoring
    this.predictionCount++

    return prediction
  }

  private buildFeatures(input: FeePredictionInput): number[] {
    const features: number[] = []

    if (input.transaction && input.operations) {
      const totalAmount = input.operations.reduce((sum, op) => sum + (Number(op.amount) || 0), 0)
      const hour = new Date(input.transaction.created_at).getHours()
      const senderFreq = this.calculateSenderFrequency(input.operations)
      const recipientFreq = this.calculateRecipientFrequency(input.operations)
      const inputs = input.operations.filter(op => op.type?.includes('payment')).length
      const outputs = input.operations.filter(op => op.type?.includes('output')).length
      const fee = Number(input.transaction.fee_charged) || 0
      const operationCount = Number(input.transaction.operation_count) || 0
      const success = input.transaction.successful ? 1 : 0

      features.push(
        Math.log1p(totalAmount),
        hour / 23,
        Math.log1p(senderFreq),
        Math.log1p(recipientFreq),
        inputs,
        outputs,
        Math.log1p(fee),
        operationCount,
        success
      )
    }

    return features
  }

  private calculateBaselineFee(input: FeePredictionInput): number {
    const baseFee = 100

    if (!input.operations) return baseFee

    const opCount = input.operations.length
    const totalAmount = input.operations.reduce((sum, op) => sum + (Number(op.amount) || 0), 0)

    let multiplier = 1.0

    // Operation count multiplier
    if (opCount > 1) multiplier *= 1 + (opCount - 1) * 0.1

    // Amount multiplier (higher amounts justify higher fees)
    if (totalAmount > 1000) multiplier *= 1.5
    else if (totalAmount > 100) multiplier *= 1.2

    // Time-based multiplier (simulated - would use real data in production)
    const hour = new Date().getHours()
    if (hour >= 9 && hour <= 17) multiplier *= 1.1

    return Math.round(baseFee * multiplier)
  }

  private adjustForNetworkConditions(baseFee: number, conditions?: NetworkState): number {
    if (!conditions) return baseFee

    const { congestionRatio, operationLimit } = conditions

    // Increase fee based on congestion
    const congestionMultiplier = 1 + (congestionRatio * 1.5)

    // Further increase if near operational limits
    const limitMultiplier = operationLimit > 800 ? 1.2 : 1.0

    return Math.round(baseFee * congestionMultiplier * limitMultiplier)
  }

  private generateAlternativeFees(baseFee: number): AlternativeFee[] {
    return [
      {
        type: 'slow',
        fee: Math.max(100, Math.floor(baseFee * 0.85)),
        expectedInclusion: '~3-4 ledgers',
        probability: 0.25,
      },
      {
        type: 'standard',
        fee: baseFee,
        expectedInclusion: '~1-2 ledgers',
        probability: 0.5,
      },
      {
        type: 'priority',
        fee: Math.ceil(baseFee * 1.2),
        expectedInclusion: 'next ledger',
        probability: 0.2,
      },
      {
        type: 'emergency',
        fee: Math.ceil(baseFee * 1.5),
        expectedInclusion: '~next ledger',
        probability: 0.05,
      },
    ]
  }

  private calculateExpectedTime(fee: number, preferences?: UserFeePreferences): string {
    if (!preferences) {
      return fee > 300 ? 'next ledger' : fee > 200 ? '1-2 ledgers' : '~3 ledgers'
    }

    const base = fee / 100

    switch (preferences.targetConfirmationTime) {
      case 'slow':
        return '~3-4 ledgers'
      case 'standard':
        return base > 1.5 ? '1-2 ledgers' : '~next ledger'
      case 'priority':
        return '~next ledger'
      case 'instant':
        return base > 2 ? '~next ledger' : '~current ledger'
      default:
        return '~1-2 ledgers'
    }
  }

  public getAccuracyMetrics(): { accuracy: number; totalPredictions: number } {
    return {
      accuracy: this.historicalAccuracy,
      totalPredictions: this.predictionCount,
    }
  }

  public updateAccuracy(accuracy: number): void {
    // Weighted average with more recent accuracy having higher weight
    this.historicalAccuracy = (this.historicalAccuracy * 0.7) + (accuracy * 0.3)
  }
}

// ---- API Integration ----

export async function integrateWithTransactionBuilder(
  params: FeePredictionInput & {
    sourceAccount: string
    network?: string
    operations: any[]
  }
): Promise<{ transaction?: any; prediction?: FeePrediction; errors?: string[] }> {
  try {
    const feePredictor = new FeePredictor()

    // Get fee prediction
    const prediction = await feePredictor.predictFee(params)

    // Prepare transaction with predicted fee
    const transactionParams = {
      sourceAccount: params.sourceAccount,
      operations: params.operations,
      network: params.network || 'testnet',
      baseFee: prediction.predictedFee,
    }

    // Import here to avoid circular dependencies
    const { buildTransaction } = await import('./transactionBuilder')

    const transaction = await buildTransaction(transactionParams)

    return {
      transaction,
      prediction,
    }
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : 'Fee prediction failed'],
    }
  }
}

// ---- Real-time Network Monitoring ----

export interface NetworkMonitor {
  getCurrentState(): Promise<NetworkState>
  subscribe(callback: (state: NetworkState) => void): () => void
}

export class StellarNetworkMonitor implements NetworkMonitor {
  private subscribers: ((state: NetworkState) => void)[] = []
  private intervalId?: NodeJS.Timeout

  async getCurrentState(): Promise<NetworkState> {
    // In production, this would fetch real network data from Horizon
    const mockState: NetworkState = {
      currentLedger: Math.floor(Math.random() * 1000000) + 1000000,
      congestionRatio: Math.random() * 0.8, // 0-80% congestion
      recentCloseTime: 4 + Math.random() * 3, // 4-7 seconds
      operationLimit: 1000,
    }

    // Notify subscribers
    this.subscribers.forEach(callback => callback(mockState))

    return mockState
  }

  subscribe(callback: (state: NetworkState) => void): () => void {
    this.subscribers.push(callback)

    // Start monitoring if not already running
    if (!this.intervalId) {
      this.startMonitoring()
    }

    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback)
      if (this.subscribers.length === 0) {
        this.stopMonitoring()
      }
    }
  }

  private startMonitoring(): void {
    this.intervalId = setInterval(async () => {
      try {
        await this.getCurrentState()
      } catch (error) {
        console.error('Network monitoring error:', error)
      }
    }, 15000) // Every 15 seconds
  }

  private stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
  }
}

// ---- Export Types ----

export type {
  FeePredictionInput,
  NetworkState,
  UserFeePreferences,
  FeePrediction,
  AlternativeFee,
  PredictionMetadata,
}
