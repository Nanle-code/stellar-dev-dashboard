/**
 * Unit tests for Behavioral Biometrics — Anomaly Detection & Feature Extraction
 * #539 Behavioral Biometric Authentication for Transaction Signing
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  BehavioralAnomalyDetector,
  extractBehavioralFeatures,
  ANOMALY_THRESHOLD,
} from '../../lib/behavioralBiometrics/anomalyDetector'
import type { BehavioralSample } from '../../lib/behavioralBiometrics/collector'
import {
  BehavioralProfileBuilder,
  createEmptyProfile,
  MIN_SAMPLES_FOR_PROFILE,
  MAX_PROFILE_SAMPLES,
} from '../../lib/behavioralBiometrics/profileBuilder'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSample(overrides: Partial<BehavioralSample> = {}): BehavioralSample {
  return {
    keystrokeDurations:  [80, 85, 90, 78, 82],
    keystrokeIntervals:  [120, 130, 115, 125, 122],
    mouseVelocities:     [0.5, 0.6, 0.55, 0.52, 0.58],
    mouseAccelerations:  [0.05, 0.04, 0.06, 0.05],
    sessionDuration:     15_000,
    focusChanges:        0,
    pasteEvents:         0,
    backspaceCount:      1,
    totalKeystrokes:     20,
    timeToFirstKeystroke: 2000,
    timestamp:           Date.now(),
    ...overrides,
  }
}

/** Generate n near-identical samples for training a clean profile */
function makeNormalSamples(n: number): BehavioralSample[] {
  return Array.from({ length: n }, (_, i) =>
    makeSample({
      keystrokeDurations:  [80 + i % 5, 85, 82],
      keystrokeIntervals:  [120 + i % 3, 125, 118],
      timestamp:           Date.now() + i * 1000,
    })
  )
}

/** A clearly anomalous sample — very fast typing, lots of paste, many focus changes */
function makeAnomalousSample(): BehavioralSample {
  return makeSample({
    keystrokeDurations:  [5, 4, 6, 5, 3],   // unrealistically fast
    keystrokeIntervals:  [8, 9, 7, 8],       // near-instantaneous
    pasteEvents:         5,
    focusChanges:        20,
    sessionDuration:     500,
    timeToFirstKeystroke: 50,
    totalKeystrokes:     100,
    backspaceCount:      0,
  })
}

// ─── Feature Extraction Tests ──────────────────────────────────────────────────

describe('extractBehavioralFeatures', () => {
  it('returns a 13-element numeric array', () => {
    const features = extractBehavioralFeatures(makeSample())
    expect(features).toHaveLength(13)
  })

  it('all values are finite numbers (no NaN/Infinity)', () => {
    const features = extractBehavioralFeatures(makeSample())
    for (const v of features) {
      expect(Number.isFinite(v)).toBe(true)
    }
  })

  it('handles empty arrays without throwing', () => {
    const sample = makeSample({
      keystrokeDurations:  [],
      keystrokeIntervals:  [],
      mouseVelocities:     [],
      mouseAccelerations:  [],
      totalKeystrokes:     0,
    })
    const features = extractBehavioralFeatures(sample)
    expect(features).toHaveLength(13)
    expect(features.every(Number.isFinite)).toBe(true)
  })

  it('paste flag is 1 when pasteEvents > 0', () => {
    const withPaste = extractBehavioralFeatures(makeSample({ pasteEvents: 2 }))
    const noPaste   = extractBehavioralFeatures(makeSample({ pasteEvents: 0 }))
    expect(withPaste[10]).toBe(1)
    expect(noPaste[10]).toBe(0)
  })

  it('backspace ratio is bounded [0,1]', () => {
    const features = extractBehavioralFeatures(
      makeSample({ backspaceCount: 5, totalKeystrokes: 10 })
    )
    expect(features[11]).toBeGreaterThanOrEqual(0)
    expect(features[11]).toBeLessThanOrEqual(1)
  })

  it('anomalous sample produces different features than normal', () => {
    const normal    = extractBehavioralFeatures(makeSample())
    const anomalous = extractBehavioralFeatures(makeAnomalousSample())
    // At least one feature should differ
    const allSame = normal.every((v, i) => Math.abs(v - anomalous[i]) < 0.01)
    expect(allSame).toBe(false)
  })
})

// ─── BehavioralAnomalyDetector Tests ──────────────────────────────────────────

describe('BehavioralAnomalyDetector', () => {
  let detector: BehavioralAnomalyDetector

  beforeEach(() => {
    detector = new BehavioralAnomalyDetector({ nTrees: 20, sampleSize: 32 })
  })

  it('isTrained() returns false before fit()', () => {
    expect(detector.isTrained()).toBe(false)
  })

  it('isTrained() returns true after fit()', () => {
    const data = makeNormalSamples(15).map(extractBehavioralFeatures)
    detector.fit(data)
    expect(detector.isTrained()).toBe(true)
  })

  it('score() returns learning-mode result when not trained', () => {
    const result = detector.score(extractBehavioralFeatures(makeSample()))
    expect(result.isAnomaly).toBe(false)
    expect(result.confidence).toBe(0)
    expect(result.explanation).toMatch(/not yet trained/i)
  })

  it('score() returns finite score in [0,1] after training', () => {
    const data = makeNormalSamples(20).map(extractBehavioralFeatures)
    detector.fit(data)
    const result = detector.score(extractBehavioralFeatures(makeSample()))
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(1)
    expect(Number.isFinite(result.score)).toBe(true)
  })

  it('normal sample scores below ANOMALY_THRESHOLD after training on normal data', () => {
    // Train on 20 near-identical normal samples
    const data = makeNormalSamples(20).map(extractBehavioralFeatures)
    detector.fit(data)
    // Score a sample from the same distribution
    const result = detector.score(data[0])
    expect(result.score).toBeLessThan(ANOMALY_THRESHOLD)
    expect(result.isAnomaly).toBe(false)
  })

  it('serialization round-trips correctly', () => {
    const data = makeNormalSamples(15).map(extractBehavioralFeatures)
    detector.fit(data)

    const json = detector.toJSON() as any
    const restored = new BehavioralAnomalyDetector()
    restored.fromJSON(json)

    expect(restored.isTrained()).toBe(true)
    const original = detector.score(data[0])
    const after    = restored.score(data[0])
    expect(after.score).toBeCloseTo(original.score, 6)
  })

  it('handles fit() with a single sample without throwing', () => {
    expect(() => {
      const data = [extractBehavioralFeatures(makeSample())]
      detector.fit(data)
    }).not.toThrow()
  })
})

// ─── BehavioralProfileBuilder Tests ───────────────────────────────────────────

describe('BehavioralProfileBuilder', () => {
  let builder: BehavioralProfileBuilder

  beforeEach(() => {
    builder = new BehavioralProfileBuilder('test-user-GXXX')
  })

  it('starts with empty profile and 0 sampleCount', () => {
    const p = builder.getProfile()
    expect(p.sampleCount).toBe(0)
    expect(p.isEstablished).toBe(false)
    expect(p.userId).toBe('test-user-GXXX')
  })

  it('getSamplesNeeded() returns MIN_SAMPLES_FOR_PROFILE initially', () => {
    expect(builder.getSamplesNeeded()).toBe(MIN_SAMPLES_FOR_PROFILE)
  })

  it('evaluate() returns learning-mode result before profile established', () => {
    const result = builder.evaluate(makeSample())
    expect(result.isAnomaly).toBe(false)
    expect(result.confidence).toBe(0)
    expect(result.explanation).toMatch(/profile not yet established/i)
  })

  it('isEstablished becomes true after MIN_SAMPLES_FOR_PROFILE samples', () => {
    for (let i = 0; i < MIN_SAMPLES_FOR_PROFILE; i++) {
      builder.addSample(makeSample({ timestamp: Date.now() + i }))
    }
    const p = builder.getProfile()
    expect(p.isEstablished).toBe(true)
    expect(p.sampleCount).toBe(MIN_SAMPLES_FOR_PROFILE)
  })

  it('sampleCount increments with each addSample()', () => {
    builder.addSample(makeSample())
    builder.addSample(makeSample())
    expect(builder.getProfile().sampleCount).toBe(2)
    expect(builder.getSamplesNeeded()).toBe(MIN_SAMPLES_FOR_PROFILE - 2)
  })

  it('samples array is capped at MAX_PROFILE_SAMPLES', () => {
    for (let i = 0; i < MAX_PROFILE_SAMPLES + 10; i++) {
      builder.addSample(makeSample({ timestamp: Date.now() + i }))
    }
    expect(builder.getProfile().samples.length).toBeLessThanOrEqual(MAX_PROFILE_SAMPLES)
  })

  it('evaluate() returns a result (not learning) after profile is established', () => {
    const samples = makeNormalSamples(MIN_SAMPLES_FOR_PROFILE)
    for (const s of samples) builder.addSample(s)

    const result = builder.evaluate(makeSample())
    // After establishing on normal data, a normal sample should not be anomaly
    // (confidence > 0 means model is active)
    expect(result.explanation).not.toMatch(/profile not yet established/i)
  })

  it('loadProfile() restores state including modelState', () => {
    // Build profile in one builder
    const samples = makeNormalSamples(MIN_SAMPLES_FOR_PROFILE)
    for (const s of samples) builder.addSample(s)

    const saved = builder.getProfile()
    expect(saved.modelState).not.toBeNull()

    // Restore in a new builder
    const newBuilder = new BehavioralProfileBuilder('test-user-GXXX')
    newBuilder.loadProfile(saved)
    const restored = newBuilder.getProfile()

    expect(restored.isEstablished).toBe(true)
    expect(restored.sampleCount).toBe(MIN_SAMPLES_FOR_PROFILE)
  })

  it('evaluate() on established profile returns score in [0,1]', () => {
    const samples = makeNormalSamples(MIN_SAMPLES_FOR_PROFILE)
    for (const s of samples) builder.addSample(s)

    const result = builder.evaluate(makeSample())
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(1)
  })
})

// ─── createEmptyProfile Tests ──────────────────────────────────────────────────

describe('createEmptyProfile', () => {
  it('creates a profile with correct defaults', () => {
    const profile = createEmptyProfile('GTEST123')
    expect(profile.userId).toBe('GTEST123')
    expect(profile.sampleCount).toBe(0)
    expect(profile.isEstablished).toBe(false)
    expect(profile.samples).toEqual([])
    expect(profile.featureHistory).toEqual([])
    expect(profile.modelState).toBeNull()
    expect(profile.trainedAt).toBeNull()
  })
})

// ─── ANOMALY_THRESHOLD constant ────────────────────────────────────────────────

describe('ANOMALY_THRESHOLD', () => {
  it('is defined and between 0 and 1', () => {
    expect(ANOMALY_THRESHOLD).toBeGreaterThan(0)
    expect(ANOMALY_THRESHOLD).toBeLessThan(1)
  })
})
