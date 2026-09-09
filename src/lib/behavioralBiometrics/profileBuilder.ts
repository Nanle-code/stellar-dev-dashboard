/**
 * Behavioral Profile Builder
 *
 * Manages user behavioral profiles over time.
 * Profiles are established after MIN_SAMPLES_FOR_PROFILE signed transactions,
 * then adapt to gradual behavioral drift via exponential moving average.
 */

import type { BehavioralSample } from './collector'
import {
  BehavioralAnomalyDetector,
  extractBehavioralFeatures,
  type AnomalyResult,
} from './anomalyDetector'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum signed transactions before profile is established */
export const MIN_SAMPLES_FOR_PROFILE = 10

/** Maximum raw samples retained in profile (rolling window) */
export const MAX_PROFILE_SAMPLES = 50

/**
 * Adaptation rate for exponential moving average of anomaly scores.
 * Higher = profile adapts faster to new behavior.
 */
export const ADAPTATION_RATE = 0.15

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BehavioralProfile {
  userId: string
  samples: BehavioralSample[]
  featureHistory: number[][]
  trainedAt: number | null
  sampleCount: number
  isEstablished: boolean
  lastUpdated: number
  modelState: object | null
  /** Rolling EMA of recent anomaly scores — tracks drift over time */
  adaptationScore: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function createEmptyProfile(userId: string): BehavioralProfile {
  return {
    userId,
    samples: [],
    featureHistory: [],
    trainedAt: null,
    sampleCount: 0,
    isEstablished: false,
    lastUpdated: Date.now(),
    modelState: null,
    adaptationScore: 0,
  }
}

// ─── Profile Builder ──────────────────────────────────────────────────────────

export class BehavioralProfileBuilder {
  private profile: BehavioralProfile
  private detector: BehavioralAnomalyDetector

  constructor(userId: string) {
    this.profile = createEmptyProfile(userId)
    this.detector = new BehavioralAnomalyDetector({ nTrees: 50, sampleSize: 64 })
  }

  /**
   * Add a new behavioral sample (called after each successful transaction sign).
   * Automatically retrains the model when thresholds are met.
   */
  addSample(sample: BehavioralSample): void {
    const features = extractBehavioralFeatures(sample)

    // Rolling window for raw samples
    this.profile.samples = [...this.profile.samples, sample].slice(-MAX_PROFILE_SAMPLES)

    // Feature history also capped
    this.profile.featureHistory = [
      ...this.profile.featureHistory,
      features,
    ].slice(-MAX_PROFILE_SAMPLES)

    this.profile.sampleCount++
    this.profile.lastUpdated = Date.now()

    // Once established, update adaptation score with EMA before retraining
    if (this.profile.isEstablished && this.detector.isTrained()) {
      const result = this.detector.score(features)
      this.profile.adaptationScore =
        ADAPTATION_RATE * result.score +
        (1 - ADAPTATION_RATE) * this.profile.adaptationScore
    }

    // Establish profile and/or retrain when we have enough samples
    if (this.profile.sampleCount >= MIN_SAMPLES_FOR_PROFILE) {
      this.profile.isEstablished = true
      this._retrain()
    }
  }

  /**
   * Evaluate a sample against the current profile.
   * Returns a learning-mode result if the profile is not yet established.
   */
  evaluate(sample: BehavioralSample): AnomalyResult {
    if (!this.profile.isEstablished) {
      const needed = this.getSamplesNeeded()
      return {
        score: 0,
        isAnomaly: false,
        confidence: 0,
        explanation: `Profile not yet established — ${needed} more transaction${needed === 1 ? '' : 's'} needed to learn your behavior`,
      }
    }

    const features = extractBehavioralFeatures(sample)
    return this.detector.score(features)
  }

  getProfile(): BehavioralProfile {
    return { ...this.profile }
  }

  /**
   * Restore a previously saved profile (e.g. loaded from IndexedDB).
   * Also restores the ML model state.
   */
  loadProfile(profile: BehavioralProfile): void {
    this.profile = { ...profile }
    if (profile.modelState) {
      this.detector.fromJSON(
        profile.modelState as {
          nTrees: number
          sampleSize: number
          trees: never[]
        },
      )
    }
  }

  getSamplesNeeded(): number {
    return Math.max(0, MIN_SAMPLES_FOR_PROFILE - this.profile.sampleCount)
  }

  /** Train (or retrain) the Isolation Forest with the current feature history */
  private _retrain(): void {
    if (this.profile.featureHistory.length < 2) return
    this.detector.fit(this.profile.featureHistory)
    this.profile.trainedAt = Date.now()
    this.profile.modelState = this.detector.toJSON()
  }
}

export function createProfileBuilder(userId: string): BehavioralProfileBuilder {
  return new BehavioralProfileBuilder(userId)
}
