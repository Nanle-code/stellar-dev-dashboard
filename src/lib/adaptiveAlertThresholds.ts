export type AlertFeedback = 'true_positive' | 'false_positive' | 'false_negative' | 'confirmed' | 'dismissed'
export type AlertOutcome = 'true_positive' | 'false_positive' | 'false_negative'

export interface AdaptiveThresholdConfig {
  baselineThreshold: number
  minThreshold?: number
  maxThreshold?: number
  learningRate?: number
  smoothing?: number
}

export interface ThresholdOptimizationContext {
  currentValue: number
  baselineThreshold?: number
  feedback?: AlertFeedback
  severity?: 'info' | 'warning' | 'critical'
}

export interface AlertQualityMetrics {
  truePositiveCount: number
  falsePositiveCount: number
  falseNegativeCount: number
  totalAlerts: number
  precision: number
  sensitivity: number
  falsePositiveRate: number
  falseNegativeRate: number
  qualityScore: number
  adaptationScore: number
}

export interface ThresholdOptimizationResult {
  recommendedThreshold: number
  appliedAdjustment: number
  quality: AlertQualityMetrics
}

export interface AdaptiveThresholdSnapshot {
  baselineThreshold: number
  currentThreshold: number
  minThreshold: number
  maxThreshold: number
  learningRate: number
  smoothing: number
  truePositiveCount: number
  falsePositiveCount: number
  falseNegativeCount: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function evaluateAlertQuality(metrics: {
  truePositiveCount: number
  falsePositiveCount: number
  falseNegativeCount: number
  totalAlerts?: number
}): AlertQualityMetrics {
  const truePositiveCount = metrics.truePositiveCount
  const falsePositiveCount = metrics.falsePositiveCount
  const falseNegativeCount = metrics.falseNegativeCount
  const totalAlerts = metrics.totalAlerts ?? truePositiveCount + falsePositiveCount + falseNegativeCount

  const precision = truePositiveCount + falsePositiveCount > 0
    ? truePositiveCount / (truePositiveCount + falsePositiveCount)
    : 1
  const sensitivity = truePositiveCount + falseNegativeCount > 0
    ? truePositiveCount / (truePositiveCount + falseNegativeCount)
    : 1
  const falsePositiveRate = totalAlerts > 0 ? falsePositiveCount / totalAlerts : 0
  const falseNegativeRate = totalAlerts > 0 ? falseNegativeCount / totalAlerts : 0
  const qualityScore = (precision * 0.6) + (sensitivity * 0.4)
  const adaptationScore = Math.max(0, 1 - (falsePositiveRate * 0.7 + falseNegativeRate * 0.3))

  return {
    truePositiveCount,
    falsePositiveCount,
    falseNegativeCount,
    totalAlerts,
    precision,
    sensitivity,
    falsePositiveRate,
    falseNegativeRate,
    qualityScore,
    adaptationScore,
  }
}

export class AdaptiveThresholdController {
  private readonly config: Required<Pick<AdaptiveThresholdConfig, 'minThreshold' | 'maxThreshold' | 'learningRate' | 'smoothing'>> & AdaptiveThresholdConfig
  private currentThreshold: number
  private truePositiveCount = 0
  private falsePositiveCount = 0
  private falseNegativeCount = 0

  constructor(config: AdaptiveThresholdConfig) {
    this.config = {
      baselineThreshold: config.baselineThreshold,
      minThreshold: config.minThreshold ?? 1,
      maxThreshold: config.maxThreshold ?? config.baselineThreshold * 3,
      learningRate: config.learningRate ?? 0.08,
      smoothing: config.smoothing ?? 0.35,
    }
    this.currentThreshold = config.baselineThreshold
  }

  getCurrentThreshold(): number {
    return this.currentThreshold
  }

  toSnapshot(): AdaptiveThresholdSnapshot {
    return {
      baselineThreshold: this.config.baselineThreshold,
      currentThreshold: this.currentThreshold,
      minThreshold: this.config.minThreshold,
      maxThreshold: this.config.maxThreshold,
      learningRate: this.config.learningRate,
      smoothing: this.config.smoothing,
      truePositiveCount: this.truePositiveCount,
      falsePositiveCount: this.falsePositiveCount,
      falseNegativeCount: this.falseNegativeCount,
    }
  }

  static fromSnapshot(snapshot: AdaptiveThresholdSnapshot): AdaptiveThresholdController {
    const controller = new AdaptiveThresholdController({
      baselineThreshold: snapshot.baselineThreshold,
      minThreshold: snapshot.minThreshold,
      maxThreshold: snapshot.maxThreshold,
      learningRate: snapshot.learningRate,
      smoothing: snapshot.smoothing,
    })

    controller.currentThreshold = snapshot.currentThreshold
    controller.truePositiveCount = snapshot.truePositiveCount
    controller.falsePositiveCount = snapshot.falsePositiveCount
    controller.falseNegativeCount = snapshot.falseNegativeCount

    return controller
  }

  observeOutcome(outcome: AlertOutcome): AlertQualityMetrics {
    if (outcome === 'true_positive') {
      this.truePositiveCount += 1
    } else if (outcome === 'false_positive') {
      this.falsePositiveCount += 1
    } else {
      this.falseNegativeCount += 1
    }

    return this.getQualityMetrics()
  }

  getQualityMetrics(): AlertQualityMetrics {
    return evaluateAlertQuality({
      truePositiveCount: this.truePositiveCount,
      falsePositiveCount: this.falsePositiveCount,
      falseNegativeCount: this.falseNegativeCount,
    })
  }

  optimize(context: ThresholdOptimizationContext): ThresholdOptimizationResult {
    const baselineThreshold = context.baselineThreshold ?? this.currentThreshold
    const severityScale = context.severity === 'critical' ? 1.2 : context.severity === 'warning' ? 1.05 : 1
    const learningRate = this.config.learningRate * severityScale
    const distance = Math.max(0, Math.abs(context.currentValue - baselineThreshold) / Math.max(1, baselineThreshold))

    let adjustment = 0
    if (context.feedback === 'false_positive') {
      adjustment = baselineThreshold * learningRate * (1 + distance)
    } else if (context.feedback === 'false_negative') {
      adjustment = -(baselineThreshold * learningRate * (1 + distance))
    } else if (context.feedback === 'confirmed' || context.feedback === 'true_positive') {
      adjustment = baselineThreshold * learningRate * 0.25
    } else if (context.feedback === 'dismissed') {
      adjustment = -(baselineThreshold * learningRate * 0.25)
    } else {
      adjustment = context.currentValue > baselineThreshold
        ? baselineThreshold * learningRate * 0.5 * distance
        : -(baselineThreshold * learningRate * 0.25 * distance)
    }

    const candidateThreshold = clamp(
      baselineThreshold + adjustment,
      this.config.minThreshold,
      this.config.maxThreshold,
    )

    const smoothedThreshold = this.currentThreshold + (candidateThreshold - this.currentThreshold) * this.config.smoothing
    this.currentThreshold = clamp(smoothedThreshold, this.config.minThreshold, this.config.maxThreshold)

    return {
      recommendedThreshold: this.currentThreshold,
      appliedAdjustment: this.currentThreshold - baselineThreshold,
      quality: this.getQualityMetrics(),
    }
  }
}
