import { GasPredictionModel, extractFeatures, type GasPrediction, type GasPredictionFeatures, type GasPredictionFeedback } from './gasPredictionModel'

export interface CostThreshold {
  id: string
  label: string
  maxResourceFee: number
  enabled: boolean
  notifyOnExceed: boolean
}

export interface GasPredictionConfig {
  enableRealTimeUpdates: boolean
  updateIntervalMs: number
  accuracyThreshold: number
  maxHistorySize: number
}

const DEFAULT_CONFIG: GasPredictionConfig = {
  enableRealTimeUpdates: true,
  updateIntervalMs: 30000,
  accuracyThreshold: 0.9,
  maxHistorySize: 1000,
}

export class GasPredictionService {
  private model: GasPredictionModel
  private config: GasPredictionConfig
  private thresholds: CostThreshold[] = []
  private subscribers: Set<(prediction: GasPrediction) => void> = new Set()
  private intervalId: ReturnType<typeof setInterval> | null = null
  private lastPrediction: GasPrediction | null = null
  private lastFeatures: GasPredictionFeatures | null = null
  private callCounts: Map<string, number> = new Map()
  private trainingData: { features: GasPredictionFeatures[]; costs: number[]; instructions: number[] } = {
    features: [], costs: [], instructions: [],
  }

  constructor(config?: Partial<GasPredictionConfig>) {
    this.model = new GasPredictionModel()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.model.initialize()
  }

  async predictGas(params: {
    argCount: number
    argTypes: string[]
    argLengths: number[]
    contractId: string
    functionName: string
    congestionRatio?: number
    ledgerCloseTime?: number
    storageEntryCount?: number
    functionComplexity?: number
    isWrite?: boolean
  }): Promise<GasPrediction> {
    const key = `${params.contractId}:${params.functionName}`
    const callCount = this.callCounts.get(key) || 0
    this.callCounts.set(key, callCount + 1)

    const features = extractFeatures({
      argCount: params.argCount,
      argTypes: params.argTypes,
      argLengths: params.argLengths,
      contractCallCount: callCount,
      congestionRatio: params.congestionRatio ?? 0.5,
      ledgerCloseTime: params.ledgerCloseTime ?? 5,
      storageEntryCount: params.storageEntryCount ?? 0,
      functionComplexity: params.functionComplexity ?? 3,
      isWrite: params.isWrite ?? false,
    })

    this.lastFeatures = features
    const prediction = this.model.predict(features)
    this.lastPrediction = prediction

    this.notifySubscribers(prediction)

    if (this.thresholds.some(t => t.enabled && prediction.predictedMinResourceFee > t.maxResourceFee)) {
      prediction.warning = prediction.warning
        ? `${prediction.warning}. Exceeds configured cost threshold.`
        : 'Predicted gas cost exceeds configured cost threshold.'
    }

    return prediction
  }

  recordActualCost(params: {
    contractId: string
    functionName: string
    predictedFee: number
    actualFee: number
    predictedInstructions: number
    actualInstructions: number
  }): void {
    const feedback: GasPredictionFeedback = {
      predictedFee: params.predictedFee,
      actualFee: params.actualFee,
      predictedInstructions: params.predictedInstructions,
      actualInstructions: params.actualInstructions,
      contractId: params.contractId,
      functionName: params.functionName,
      timestamp: new Date().toISOString(),
    }

    this.model.recordPredictionAccuracy(feedback)

    if (this.lastFeatures) {
      this.trainingData.features.push(this.lastFeatures)
      this.trainingData.costs.push(params.actualFee)
      this.trainingData.instructions.push(params.actualInstructions)

      if (this.trainingData.features.length >= 10) {
        this.model.train(this.trainingData.features, this.trainingData.costs, this.trainingData.instructions)
      }
    }
  }

  setThresholds(thresholds: CostThreshold[]): void {
    this.thresholds = thresholds
  }

  getThresholds(): CostThreshold[] {
    return [...this.thresholds]
  }

  subscribe(callback: (prediction: GasPrediction) => void): () => void {
    this.subscribers.add(callback)
    if (this.lastPrediction) callback(this.lastPrediction)
    return () => { this.subscribers.delete(callback) }
  }

  startRealTimeUpdates(): void {
    if (this.intervalId) return
    this.intervalId = setInterval(() => {
      if (this.lastFeatures && this.config.enableRealTimeUpdates) {
        const prediction = this.model.predict(this.lastFeatures)
        this.lastPrediction = prediction
        this.notifySubscribers(prediction)
      }
    }, this.config.updateIntervalMs)
  }

  stopRealTimeUpdates(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  getMetrics() {
    const modelMetrics = this.model.getMetrics()
    return {
      ...modelMetrics,
      thresholdsConfigured: this.thresholds.length,
      thresholdsExceeded: this.thresholds.filter(t => t.enabled && this.lastPrediction
        ? this.lastPrediction.predictedMinResourceFee > t.maxResourceFee
        : false).length,
      subscriberCount: this.subscribers.size,
    }
  }

  getPredictionHistory(): GasPredictionFeedback[] {
    return this.model.getPredictionHistory()
  }

  private notifySubscribers(prediction: GasPrediction): void {
    this.subscribers.forEach(cb => {
      try { cb(prediction) } catch { }
    })
  }

  dispose(): void {
    this.stopRealTimeUpdates()
    this.subscribers.clear()
    this.model.dispose()
  }
}

let defaultService: GasPredictionService | null = null

export function getGasPredictionService(): GasPredictionService {
  if (!defaultService) {
    defaultService = new GasPredictionService()
    defaultService.startRealTimeUpdates()
  }
  return defaultService
}
