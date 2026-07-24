import { describe, it, expect } from 'vitest'
import * as Adaptive from '../../../src/lib/adaptivePerformance'
import AdaptiveDefault from '../../../src/lib/adaptivePerformance'
import { PerformancePredictor } from '../../../src/lib/adaptivePerformance'

describe('adaptivePerformance index', () => {
  it('re-exports every public surface', () => {
    expect(typeof Adaptive.initAdaptiveEngine).toBe('function')
    expect(typeof Adaptive.subscribeAdaptiveEngine).toBe('function')
    expect(typeof Adaptive.getAdaptiveSnapshot).toBe('function')
    expect(typeof Adaptive.setPerformanceMode).toBe('function')
    expect(typeof Adaptive.lockAdaptation).toBe('function')
    expect(typeof Adaptive.unlockAdaptation).toBe('function')
    expect(typeof Adaptive.unlockAllAdaptations).toBe('function')
    expect(typeof Adaptive.refreshAdaptiveSnapshot).toBe('function')
    expect(typeof Adaptive.submitFeedback).toBe('function')
    expect(typeof Adaptive.trackAdaptiveInteraction).toBe('function')
    expect(typeof Adaptive.exportPredictorWeights).toBe('function')
    expect(typeof Adaptive.importPredictorWeights).toBe('function')
    expect(typeof Adaptive.resetPredictorWeights).toBe('function')
    expect(typeof Adaptive.getAccuracy).toBe('function')
    expect(typeof Adaptive.getPendingDecisionCount).toBe('function')

    expect(typeof Adaptive.initDeviceProfiler).toBe('function')
    expect(typeof Adaptive.getDeviceProfile).toBe('function')
    expect(typeof Adaptive.subscribeDevice).toBe('function')
    expect(typeof Adaptive.initNetworkProfiler).toBe('function')
    expect(typeof Adaptive.getNetworkProfile).toBe('function')
    expect(typeof Adaptive.subscribeNetwork).toBe('function')
    expect(typeof Adaptive.probeNetwork).toBe('function')
    expect(typeof Adaptive.initUsageTracker).toBe('function')
    expect(typeof Adaptive.getUsageProfile).toBe('function')
    expect(typeof Adaptive.recordInteraction).toBe('function')
    expect(typeof Adaptive.subscribeUsage).toBe('function')
    expect(typeof Adaptive.initAccuracyTracker).toBe('function')
    expect(typeof Adaptive.getAccuracyReport).toBe('function')
    expect(typeof Adaptive.recordFeedback).toBe('function')
    expect(typeof Adaptive.clearAccuracyHistory).toBe('function')

    expect(PerformancePredictor.prototype.predict).toBeDefined()
    expect(Adaptive.DEFAULT_WEIGHTS.length).toBe(7)
    expect(Adaptive.DEFAULT_BIAS).toBeTypeOf('number')
  })

  it('default export is the engine module', () => {
    expect(typeof AdaptiveDefault.initAdaptiveEngine).toBe('function')
    expect(typeof AdaptiveDefault.submitFeedback).toBe('function')
  })
})
