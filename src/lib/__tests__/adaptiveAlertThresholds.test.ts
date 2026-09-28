import { AdaptiveThresholdController, evaluateAlertQuality } from '../adaptiveAlertThresholds'

describe('AdaptiveThresholdController', () => {
  it('raises the recommended threshold after repeated false-positive feedback', () => {
    const controller = new AdaptiveThresholdController({
      baselineThreshold: 100,
      minThreshold: 10,
      maxThreshold: 250,
      smoothing: 0.35,
    })

    const first = controller.optimize({ currentValue: 108, feedback: 'false_positive' })
    const second = controller.optimize({ currentValue: 112, feedback: 'false_positive' })

    expect(first.recommendedThreshold).toBeGreaterThan(100)
    expect(second.recommendedThreshold).toBeGreaterThan(first.recommendedThreshold)
    expect(second.recommendedThreshold).toBeLessThanOrEqual(250)
  })

  it('tracks alert quality metrics from observed outcomes', () => {
    const controller = new AdaptiveThresholdController({ baselineThreshold: 80 })

    controller.observeOutcome('true_positive')
    controller.observeOutcome('false_positive')
    controller.observeOutcome('true_positive')

    const quality = controller.getQualityMetrics()

    expect(quality.falsePositiveRate).toBeCloseTo(0.3333333333)
    expect(quality.sensitivity).toBe(1)
    expect(quality.adaptationScore).toBeGreaterThan(0)
  })

  it('reports a quality score that reflects both precision and sensitivity', () => {
    const quality = evaluateAlertQuality({
      truePositiveCount: 8,
      falsePositiveCount: 2,
      falseNegativeCount: 1,
      totalAlerts: 11,
    })

    expect(quality.precision).toBeCloseTo(0.8)
    expect(quality.sensitivity).toBeCloseTo(0.8888888889)
    expect(quality.qualityScore).toBeGreaterThan(0.75)
  })
})
