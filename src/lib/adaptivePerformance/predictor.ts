/**
 * adaptivePerformance/predictor.ts
 *
 * Lightweight performance prediction model — Issue #586.
 *
 * Implementation: a single-layer logistic regressor with online stochastic
 * gradient descent. We intentionally avoid pulling in any ML runtime;
 * the entire model is a flat Float32Array of `weights` plus a `bias`
 * constant.
 *
 * Inputs are normalised feature vectors:
 *   - 0: device tier (0=low, 0.5=mid, 1=high)
 *   - 1: network tier (0=offline, 0.33=slow, 0.66=moderate, 1=fast)
 *   - 2: usage intensity (0=casual, 0.33=regular, 0.66=power, 1=expert)
 *   - 3: visible fraction (1 if visible, 0 if hidden)
 *   - 4: low battery flag (1 if low, 0 if not)
 *   - 5: measured RTT (normalised against [0, 2000]ms)
 *   - 6: violation rate (events per minute, clamp [0, 10])
 *
 * The model outputs a continuous "stress" score in [0, 1] which is then
 * discretised into the three adaptation tiers.
 *
 * Training happens via {@link PerformancePredictor.observe}. After each
 * feedback event, weights are nudged via a small learning-rate * (target - prediction)
 * update. This is the same update rule as perceptron learning but with a
 * sigmoid transform.
 */

import type {
  AdaptationProfile,
  DeviceProfile,
  FeedbackRecord,
  NetworkProfile,
  UsageProfile,
} from './types'

const FEATURE_DIM = 7

/** L2 decay applied to weights after every observation to bound drift. */
export const DEFAULT_L2 = 0.001
/** Hard cap on |weight_i| so an outlier cannot dominate the decision. */
export const DEFAULT_MAX_ABS_WEIGHT = 5
/** Hard upper bound on the total number of observations. */
export const DEFAULT_MAX_OBSERVATIONS = 10_000

/** Default weights — chosen so the initial adaptation is sensible without any training. */
export const DEFAULT_WEIGHTS: ReadonlyArray<number> = [
  -0.4, // device tier (positive device => less stress)
  -0.5, // network tier
  0.25, // usage intensity (heavy users => more stress)
  -0.15, // visibility (hidden => less stress => keep low tier)
  0.30, // low battery flag
  -0.35, // measured RTT normalised
  0.45, // violation rate
]

export const DEFAULT_BIAS = 0.55

export interface PredictorSnapshot {
  /** Continuous stress score in [0, 1]. */
  stress: number
  /** Adaptation tier mapped from the stress score. */
  tier: AdaptationProfile['tier']
  /** Confidence in the decision in [0, 1]. */
  confidence: number
  /** Feature vector that was passed in (for telemetry). */
  features: ReadonlyArray<number>
}

export class PerformancePredictor {
  private weights: number[]
  private bias: number
  private learningRate: number
  private l2: number
  private maxAbsWeight: number
  private maxObservations: number
  private observationCount = 0

  constructor(options: {
    weights?: number[]
    bias?: number
    learningRate?: number
    l2?: number
    maxAbsWeight?: number
    maxObservations?: number
  } = {}) {
    this.weights = (options.weights ?? [...DEFAULT_WEIGHTS]).slice(0, FEATURE_DIM)
    while (this.weights.length < FEATURE_DIM) this.weights.push(0)
    this.bias = options.bias ?? DEFAULT_BIAS
    this.learningRate = Math.max(0.001, Math.min(options.learningRate ?? 0.05, 0.5))
    this.l2 = Math.max(0, Math.min(options.l2 ?? DEFAULT_L2, 0.05))
    this.maxAbsWeight = Math.max(0.1, options.maxAbsWeight ?? DEFAULT_MAX_ABS_WEIGHT)
    this.maxObservations = Math.max(10, options.maxObservations ?? DEFAULT_MAX_OBSERVATIONS)
  }

  /** Returns a deep copy of the current weights — useful for tests / serialization. */
  exportWeights(): { weights: number[]; bias: number; observationCount: number } {
    return {
      weights: [...this.weights],
      bias: this.bias,
      observationCount: this.observationCount,
    }
  }

  /** Replace the model parameters. Useful when loading persisted state. */
  importWeights(next: { weights?: number[]; bias?: number }): void {
    if (Array.isArray(next.weights)) {
      this.weights = next.weights.slice(0, FEATURE_DIM)
      while (this.weights.length < FEATURE_DIM) this.weights.push(0)
    }
    if (typeof next.bias === 'number') this.bias = next.bias
  }

  /** Compute the normalised feature vector for a snapshot. Pure & deterministic. */
  static features(device: DeviceProfile, network: NetworkProfile, usage: UsageProfile): number[] {
    const deviceScore = device.tier === 'high' ? 1 : device.tier === 'mid' ? 0.5 : 0
    const networkScore =
      network.tier === 'fast' ? 1
      : network.tier === 'moderate' ? 0.66
      : network.tier === 'slow' ? 0.33
      : 0
    const usageScore =
      usage.intensity === 'expert' ? 1
      : usage.intensity === 'power' ? 0.66
      : usage.intensity === 'regular' ? 0.33
      : 0
    const rtt = network.measuredLatencyMs ?? network.rttMs ?? 200
    const rttNorm = clamp01(rtt / 2000)
    const violationRate = clamp01(usage.violationsPerMinute / 10)
    return [
      deviceScore,
      networkScore,
      usageScore,
      device.isVisible ? 1 : 0,
      device.isLowBattery ? 1 : 0,
      rttNorm,
      violationRate,
    ]
  }

  /**
   * Run the model. The returned snapshot contains the stress score, the
   * discretised tier, and a confidence metric based on the distance from
   * the decision boundary.
   */
  predict(device: DeviceProfile, network: NetworkProfile, usage: UsageProfile): PredictorSnapshot {
    const features = PerformancePredictor.features(device, network, usage)
    const z = dot(features, this.weights) + this.bias
    const stress = sigmoid(z)
    const tier = discretiseTier(stress, device, network)
    const boundaryDistance = Math.abs(stress - 0.5)
    const confidence = clamp01(0.5 + boundaryDistance)
    return { stress, tier, confidence, features }
  }

  /**
   * Update the model using a feedback record. The "expected" tier is
   * derived from the feedback record's tier on success, and inverted when
   * the engine logs a violation while staying on a high tier
   * ("false negative").
   */
  observe(
    feedback: FeedbackRecord,
    device: DeviceProfile,
    network: NetworkProfile,
    usage: UsageProfile
  ): void {
    if (this.observationCount >= this.maxObservations) return // Cap observations to bound drift
    const features = PerformancePredictor.features(device, network, usage)
    const prediction = sigmoid(dot(features, this.weights) + this.bias)

    // Construct the target signal from the feedback record:
    //   - 'success' feedback reinforces the chosen tier (prediction -> match label)
    //   - 'failure' feedback nudges the model towards the opposite extreme
    let target: number
    switch (feedback.tier) {
      case 'high':
        target = feedback.outcome === 1 ? 0.15 : 0.85
        break
      case 'balanced':
        target = feedback.outcome === 1 ? 0.5 : prediction > 0.5 ? 0.2 : 0.8
        break
      case 'battery-saver':
        target = feedback.outcome === 1 ? 0.85 : 0.15
        break
    }

    const error = target - prediction
    for (let i = 0; i < this.weights.length; i++) {
      // Update via online SGD with L2 decay for stability.
      this.weights[i] += this.learningRate * error * features[i] - this.l2 * this.weights[i]
      // Hard clip weights to prevent runaway drift.
      if (this.weights[i] > this.maxAbsWeight) this.weights[i] = this.maxAbsWeight
      else if (this.weights[i] < -this.maxAbsWeight) this.weights[i] = -this.maxAbsWeight
    }
    this.bias += this.learningRate * error
    if (this.bias > this.maxAbsWeight) this.bias = this.maxAbsWeight
    else if (this.bias < -this.maxAbsWeight) this.bias = -this.maxAbsWeight
    this.observationCount += 1
  }
}

function dot(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) s += a[i] * b[i]
  return s
}

function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x)
    return 1 / (1 + z)
  }
  const z = Math.exp(x)
  return z / (1 + z)
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function discretiseTier(stress: number, device: DeviceProfile, network: NetworkProfile): AdaptationProfile['tier'] {
  // Hard guards — never propose "high" when the device is explicitly low-end
  // or when the user has explicitly opted into data-saver.
  if (device.tier === 'low' && stress < 0.55) return 'battery-saver'
  if (network.saveData) return 'battery-saver'
  if (device.isLowBattery && stress > 0.4) return 'battery-saver'

  if (stress <= 0.4) return 'high'
  if (stress <= 0.7) return 'balanced'
  return 'battery-saver'
}
