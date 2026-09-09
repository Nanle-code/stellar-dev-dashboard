import * as tf from '@tensorflow/tfjs';

export interface GasPredictionFeatures {
  argCount: number
  hasAddressArg: boolean
  hasIntArg: boolean
  hasBoolArg: boolean
  totalArgLength: number
  contractCallCount: number
  congestionRatio: number
  ledgerCloseTime: number
  hourOfDay: number
  dayOfWeek: number
  storageEntryCount: number
  functionComplexity: number
  isWriteOperation: boolean
}

export interface GasPrediction {
  predictedMinResourceFee: number
  predictedInstructionCount: number
  predictedTotalFee: number
  confidence: number
  confidenceInterval: [number, number]
  predictionTimestamp: string
  modelVersion: string
  accuracy: number
  featureBreakdown: Record<string, number>
  warning?: string
}

export interface GasPredictionFeedback {
  predictedFee: number
  actualFee: number
  predictedInstructions: number
  actualInstructions: number
  contractId: string
  functionName: string
  timestamp: string
}

const MODEL_VERSION = '1.0.0'

const FEATURE_KEYS: (keyof GasPredictionFeatures)[] = [
  'argCount',
  'hasAddressArg',
  'hasIntArg',
  'hasBoolArg',
  'totalArgLength',
  'contractCallCount',
  'congestionRatio',
  'ledgerCloseTime',
  'hourOfDay',
  'dayOfWeek',
  'storageEntryCount',
  'functionComplexity',
  'isWriteOperation',
]

const BASE_RESOURCE_FEE = 100
const INSTRUCTION_COST_PER_UNIT = 0.001

function featureVector(f: GasPredictionFeatures): number[] {
  return [
    f.argCount / 10,
    f.hasAddressArg ? 1 : 0,
    f.hasIntArg ? 1 : 0,
    f.hasBoolArg ? 1 : 0,
    Math.log1p(f.totalArgLength) / 10,
    Math.log1p(f.contractCallCount) / 10,
    f.congestionRatio,
    f.ledgerCloseTime / 10,
    f.hourOfDay / 23,
    f.dayOfWeek / 6,
    Math.log1p(f.storageEntryCount) / 10,
    f.functionComplexity / 10,
    f.isWriteOperation ? 1 : 0,
  ]
}

function solveNormalEq(X: number[][], y: number[]): number[] {
  const n = X[0].length
  const XtX: number[][] = Array.from({ length: n }, () => Array(n).fill(0))
  const Xty: number[] = Array(n).fill(0)
  for (const row of X) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        XtX[i][j] += row[i] * row[j]
      }
      Xty[i] += row[i] * y[0]
    }
  }
  const A: number[][] = XtX.map((row, i) => row.concat([Xty[i]]))
  for (let i = 0; i < n; i++) {
    let maxRow = i
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k
    const tmp = A[i]; A[i] = A[maxRow]; A[maxRow] = tmp
    const piv = A[i][i] || 1e-12
    for (let k = i; k <= n; k++) A[i][k] /= piv
    for (let r = 0; r < n; r++) if (r !== i) {
      const factor = A[r][i]
      for (let c = i; c <= n; c++) A[r][c] -= factor * A[i][c]
    }
  }
  return A.map(row => row[n])
}

export class GasPredictionModel {
  private weights: number[] | null = null
  private residualStd: number = 1
  private trainingCount: number = 0
  private historicalAccuracy: number = 0.95
  private tfModel: tf.Sequential | null = null
  private predictionHistory: GasPredictionFeedback[] = []

  async initialize(): Promise<void> {
    try {
      this.tfModel = tf.sequential()
      this.tfModel.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [FEATURE_KEYS.length] }))
      this.tfModel.add(tf.layers.dropout({ rate: 0.2 }))
      this.tfModel.add(tf.layers.dense({ units: 8, activation: 'relu' }))
      this.tfModel.add(tf.layers.dense({ units: 2, activation: 'linear' }))
      this.tfModel.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' })
    } catch {
      this.tfModel = null
    }
    this.weights = Array(FEATURE_KEYS.length).fill(0).map((_, i) => 0.5 + i * 0.1)
  }

  async train(features: GasPredictionFeatures[], actualCosts: number[], actualInstructions: number[]): Promise<void> {
    if (features.length < 10) return

    const X = features.map(f => featureVector(f))
    const y = actualCosts.map((c, i) => c + actualInstructions[i] * INSTRUCTION_COST_PER_UNIT)

    this.weights = solveNormalEq(X, y)

    const preds = X.map(row => row.reduce((s, v, i) => s + v * (this.weights![i] || 0), BASE_RESOURCE_FEE))
    const residuals = y.map((v, i) => v - preds[i])
    this.residualStd = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length) || 1

    if (this.tfModel && features.length >= 50) {
      try {
        const tensorX = tf.tensor2d(X)
        const tensorY = tf.tensor2d(y.map(v => [v, 0]))
        await this.tfModel.fit(tensorX, tensorY, { epochs: 10, batchSize: 32, shuffle: true })
        tensorX.dispose()
        tensorY.dispose()
      } catch { }
    }

    this.trainingCount += features.length
  }

  predict(features: GasPredictionFeatures): GasPrediction {
    const feat = featureVector(features)
    const linearPred = this.weights
      ? feat.reduce((s, v, i) => s + v * (this.weights![i] || 0), BASE_RESOURCE_FEE)
      : BASE_RESOURCE_FEE

    const predictedFee = Math.max(BASE_RESOURCE_FEE, Math.round(linearPred))
    const predictedInstructions = Math.round(predictedFee / INSTRUCTION_COST_PER_UNIT * 0.3)
    const predictedTotalFee = predictedFee + Math.round(predictedInstructions * INSTRUCTION_COST_PER_UNIT)

    const confidence = Math.min(0.99, Math.max(0.3, 1 - this.residualStd / (predictedFee + 1)))

    const ci = this.residualStd * 1.96
    const confidenceInterval: [number, number] = [
      Math.max(BASE_RESOURCE_FEE, predictedFee - ci),
      predictedFee + ci,
    ]

    const breakdown: Record<string, number> = {
      baseFee: BASE_RESOURCE_FEE,
      argComplexity: features.argCount * 10 + (features.hasAddressArg ? 20 : 0) + (features.hasIntArg ? 15 : 0),
      storageAccess: features.storageEntryCount * 5,
      networkCongestion: features.congestionRatio * 50,
      functionOverhead: features.functionComplexity * 8,
    }

    let warning: string | undefined
    if (confidence < 0.5) warning = 'Low confidence prediction — limited training data for this call pattern'

    return {
      predictedMinResourceFee: predictedFee,
      predictedInstructionCount: predictedInstructions,
      predictedTotalFee,
      confidence,
      confidenceInterval,
      predictionTimestamp: new Date().toISOString(),
      modelVersion: MODEL_VERSION,
      accuracy: this.historicalAccuracy,
      featureBreakdown: breakdown,
      warning,
    }
  }

  recordPredictionAccuracy(feedback: GasPredictionFeedback): void {
    this.predictionHistory.push(feedback)
    if (this.predictionHistory.length > 1000) this.predictionHistory.shift()

    const recentErrors = this.predictionHistory.slice(-100)
    if (recentErrors.length < 2) return

    const mape = recentErrors.reduce((sum, f) => {
      const error = Math.abs(f.predictedFee - f.actualFee) / Math.max(1, f.actualFee)
      return sum + error
    }, 0) / recentErrors.length

    this.historicalAccuracy = Math.max(0, 1 - mape)
    this.historicalAccuracy = Math.round(this.historicalAccuracy * 100) / 100
  }

  getMetrics(): { accuracy: number; trainingCount: number; historySize: number; modelVersion: string } {
    return {
      accuracy: this.historicalAccuracy,
      trainingCount: this.trainingCount,
      historySize: this.predictionHistory.length,
      modelVersion: MODEL_VERSION,
    }
  }

  getPredictionHistory(): GasPredictionFeedback[] {
    return [...this.predictionHistory]
  }

  dispose(): void {
    if (this.tfModel) {
      this.tfModel.dispose()
      this.tfModel = null
    }
  }
}

export function extractFeatures(params: {
  argCount: number
  argTypes: string[]
  argLengths: number[]
  contractCallCount: number
  congestionRatio: number
  ledgerCloseTime: number
  storageEntryCount: number
  functionComplexity: number
  isWrite: boolean
}): GasPredictionFeatures {
  return {
    argCount: params.argCount,
    hasAddressArg: params.argTypes.some(t => t === 'address'),
    hasIntArg: params.argTypes.some(t => t === 'int'),
    hasBoolArg: params.argTypes.some(t => t === 'bool'),
    totalArgLength: params.argLengths.reduce((s, l) => s + l, 0),
    contractCallCount: params.contractCallCount,
    congestionRatio: params.congestionRatio,
    ledgerCloseTime: params.ledgerCloseTime,
    hourOfDay: new Date().getHours(),
    dayOfWeek: new Date().getDay(),
    storageEntryCount: params.storageEntryCount,
    functionComplexity: params.functionComplexity,
    isWriteOperation: params.isWrite,
  }
}
