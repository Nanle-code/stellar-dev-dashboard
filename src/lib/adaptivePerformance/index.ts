/**
 * adaptivePerformance/index.ts
 *
 * Public entry point for the Adaptive Performance Engine — Issue #586.
 *
 * Consumers usually only need this module; the sub-modules are exposed
 * for advanced use cases (custom predictors, isolated profilers, etc.).
 */

export type {
  AdaptationProfile,
  AdaptiveEngineSnapshot,
  DeviceProfile,
  DeviceTier,
  FeedbackRecord,
  FeedbackSource,
  NetworkProfile,
  NetworkTier,
  PerformanceMode,
  UsageIntensity,
  UsageProfile,
} from './types'

export {
  initAdaptiveEngine,
  subscribeAdaptiveEngine,
  getAdaptiveSnapshot,
  setPerformanceMode,
  lockAdaptation,
  unlockAdaptation,
  unlockAllAdaptations,
  refreshAdaptiveSnapshot,
  submitFeedback,
  trackAdaptiveInteraction,
  exportPredictorWeights,
  importPredictorWeights,
  resetPredictorWeights,
  getAccuracy,
  getDecisionCount,
} from './engine'

export {
  PerformancePredictor,
  DEFAULT_WEIGHTS,
  DEFAULT_BIAS,
  type PredictorSnapshot,
} from './predictor'

export {
  initDeviceProfiler,
  getDeviceProfile,
  subscribeDevice,
} from './deviceProfiler'

export {
  initNetworkProfiler,
  getNetworkProfile,
  subscribeNetwork,
  probeNetwork,
} from './networkProfiler'

export {
  initUsageTracker,
  getUsageProfile,
  recordInteraction,
  subscribeUsage,
} from './usageTracker'

export {
  initAccuracyTracker,
  getAccuracyReport,
  recordFeedback,
  clearAccuracyHistory,
  type AccuracyReport,
} from './accuracyTracker'

// Default export — the engine singleton surface.
import * as engine from './engine'
export default engine
