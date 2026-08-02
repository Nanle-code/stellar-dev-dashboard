/**
 * expertiseEngine.ts — Adaptive UI Expertise Engine
 *
 * ML-powered expertise classification using multi-signal analysis,
 * weighted scoring, growth trend detection, and self-improving accuracy tracking.
 *
 * Integration Points:
 *  - ExpertiseContext consumes classify() for level resolution
 *  - useExpertiseTracking feeds signal data into the engine
 *  - DashboardLayout tracks session metrics and feeds them here
 */

import { collectExpertiseSignals, type ExpertiseLevel, type ExpertiseSignals } from './expertiseAdaptation';

// ─── Extended Signal Types ──────────────────────────────────────────────────

export interface ExtendedExpertiseSignals extends ExpertiseSignals {
  /** How many times each feature/panel has been opened (keyed by panel id) */
  featureUsageFrequency: Record<string, number>;
  /** Percentage of initiated tasks successfully completed (0–1) */
  taskCompletionRate: number;
  /** Ratio of failed actions to total actions (0–1) */
  errorRate: number;
  /** Number of keyboard shortcut invocations */
  shortcutUsageCount: number;
  /** Times advanced/developer panels were opened */
  advancedPanelOpens: number;
  /** Dwell time in seconds per feature category keyed by category name */
  timeOnTaskByCategory: Record<string, number>;
  /** How many unique features the user has explored (0–1 normalized) */
  explorationScore: number;
  /** Number of times API/advanced search was used */
  advancedSearchUsage: number;
  /** Number of custom configuration changes made */
  customizationCount: number;
  /** Timestamps of level-up events for growth tracking */
  levelUpHistory: string[];
  /** Historical accuracy of predictions (for self-improvement) */
  predictionAccuracyHistory: Array<{ predicted: ExpertiseLevel; actual: ExpertiseLevel; timestamp: string }>;
  /** Count of completed guided tutorials */
  completedTutorials: number;
  /** Number of WebSocket/real-time feature uses */
  realtimeFeatureUses: number;
}

export type ExpertiseTier = 'novice' | 'intermediate' | 'expert';

export interface ExpertiseProfile {
  level: ExpertiseTier;
  signals: ExtendedExpertiseSignals;
  confidence: number; // 0–1 how confident the classification is
  growthTrend: 'accelerating' | 'stable' | 'plateaued';
  nextMilestone: string | null; // what to do next to level up
  progressToNext: number; // 0–1 progress towards next level
  lastUpdated: string;
}

export interface FeatureVisibilityConfig {
  /** Whether the feature should be shown at all */
  visible: boolean;
  /** Whether the feature needs a tooltip/explanation */
  showGuidance: boolean;
  /** Whether the feature is highlighted/recommended */
  highlighted: boolean;
  /** Alternative simplified component to render */
  simplifiedComponent?: string;
  /** Minimum expertise level required to see this */
  minimumLevel: ExpertiseTier;
}

// ─── Weight Configuration ──────────────────────────────────────────────────

interface FactorWeight {
  signal: keyof ExtendedExpertiseSignals | 'composite';
  weight: number;
  transform: (value: number) => number; // maps raw signal → 0–1 score contribution
}

const FACTOR_WEIGHTS: FactorWeight[] = [
  {
    signal: 'sessionDurationMinutes',
    weight: 0.10,
    transform: (v) => Math.min(1, v / 120), // 2 hours = max score
  },
  {
    signal: 'advancedFeatureUses',
    weight: 0.15,
    transform: (v) => Math.min(1, v / 20), // 20 uses = max score
  },
  {
    signal: 'repeatedTaskCount',
    weight: 0.05,
    transform: (v) => Math.min(1, v / 10), // 10 repetitions = max
  },
  {
    signal: 'successfulActions',
    weight: 0.10,
    transform: (v) => Math.min(1, v / 50), // 50 actions = max
  },
  {
    signal: 'taskCompletionRate',
    weight: 0.12,
    transform: (v) => Math.min(1, Math.max(0, v)), // already 0–1
  },
  {
    signal: 'errorRate',
    weight: 0.08,
    transform: (v) => Math.min(1, Math.max(0, 1 - v)), // lower error = higher score
  },
  {
    signal: 'shortcutUsageCount',
    weight: 0.08,
    transform: (v) => Math.min(1, v / 15), // 15 shortcuts = max
  },
  {
    signal: 'advancedPanelOpens',
    weight: 0.10,
    transform: (v) => Math.min(1, v / 10), // 10 opens = max
  },
  {
    signal: 'explorationScore',
    weight: 0.10,
    transform: (v) => Math.min(1, Math.max(0, v)), // already 0–1
  },
  {
    signal: 'advancedSearchUsage',
    weight: 0.05,
    transform: (v) => Math.min(1, v / 8),
  },
  {
    signal: 'customizationCount',
    weight: 0.04,
    transform: (v) => Math.min(1, v / 5),
  },
  {
    signal: 'completedTutorials',
    weight: 0.03,
    transform: (v) => Math.min(1, v / 5),
  },
];

// ─── Thresholds ─────────────────────────────────────────────────────────────

const NOVICE_THRESHOLD = 0.25;   // 0–0.25 → novice
const INTERMEDIATE_THRESHOLD = 0.55; // 0.26–0.55 → intermediate
// 0.56+ → expert

const GROWTH_WINDOW_DAYS = 7;
const ACCURACY_HISTORY_LIMIT = 50;

// ─── Default Signals ────────────────────────────────────────────────────────

export function createDefaultExtendedSignals(): ExtendedExpertiseSignals {
  return {
    sessionDurationMinutes: 0,
    advancedFeatureUses: 0,
    repeatedTaskCount: 0,
    successfulActions: 0,
    featureUsageFrequency: {},
    taskCompletionRate: 0,
    errorRate: 0,
    shortcutUsageCount: 0,
    advancedPanelOpens: 0,
    timeOnTaskByCategory: {},
    explorationScore: 0,
    advancedSearchUsage: 0,
    customizationCount: 0,
    levelUpHistory: [],
    predictionAccuracyHistory: [],
    completedTutorials: 0,
    realtimeFeatureUses: 0,
  };
}

// ─── Scoring Functions ──────────────────────────────────────────────────────

/**
 * Compute a weighted composite score from the extended signals.
 * Returns a value between 0 and 1.
 */
export function computeWeightedScore(signals: Partial<ExtendedExpertiseSignals>): number {
  let totalScore = 0;
  let totalWeight = 0;

  for (const factor of FACTOR_WEIGHTS) {
    const rawValue = signals[factor.signal as keyof ExtendedExpertiseSignals];
    if (rawValue === undefined || rawValue === null) continue;

    const numericValue = typeof rawValue === 'number' ? rawValue : 0;
    const contribution = factor.transform(numericValue);
    totalScore += contribution * factor.weight;
    totalWeight += factor.weight;
  }

  // Compute composite signals if not directly provided
  if (signals.featureUsageFrequency) {
    const uniqueFeatures = Object.keys(signals.featureUsageFrequency).length;
    const featureScore = Math.min(1, uniqueFeatures / 15);
    totalScore += featureScore * 0.05;
    totalWeight += 0.05;
  }

  if (signals.timeOnTaskByCategory) {
    const categoriesWithTime = Object.values(signals.timeOnTaskByCategory).filter(t => t > 60).length;
    const focusScore = Math.min(1, categoriesWithTime / 5);
    totalScore += focusScore * 0.05;
    totalWeight += 0.05;
  }

  return totalWeight > 0 ? Math.min(1, Math.max(0, totalScore / totalWeight)) : 0;
}

/**
 * Classify expertise level from weighted score
 */
export function classifyFromScore(score: number): ExpertiseTier {
  if (score >= INTERMEDIATE_THRESHOLD) return 'expert';
  if (score >= NOVICE_THRESHOLD) return 'intermediate';
  return 'novice';
}

/**
 * Calculate confidence in the classification based on signal richness
 */
export function computeConfidence(signals: Partial<ExtendedExpertiseSignals>): number {
  const populatedSignals = FACTOR_WEIGHTS.filter(f => {
    const v = signals[f.signal as keyof ExtendedExpertiseSignals];
    return v !== undefined && v !== null && v !== 0;
  }).length;

  const totalFactors = FACTOR_WEIGHTS.length;
  const baseConfidence = populatedSignals / totalFactors;

  // Boost confidence if we have extended signal data
  if (signals.featureUsageFrequency && Object.keys(signals.featureUsageFrequency).length > 0) {
    return Math.min(1, baseConfidence + 0.15);
  }

  return Math.min(1, baseConfidence + 0.1);
}

// ─── Growth Detection ──────────────────────────────────────────────────────

/**
 * Detect growth trend by comparing recent signal data to historical baseline.
 * This helps determine if the user is actively improving.
 */
export function detectGrowthTrend(
  signals: ExtendedExpertiseSignals
): 'accelerating' | 'stable' | 'plateaued' {
  const history = signals.levelUpHistory || [];
  if (history.length < 2) return 'stable';

  const recent = history.slice(-3);
  if (recent.length < 2) return 'stable';

  // Calculate time between level-ups
  const intervals: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    intervals.push(
      new Date(recent[i]).getTime() - new Date(recent[i - 1]).getTime()
    );
  }

  if (intervals.length < 2) return 'stable';

  // If intervals are decreasing, they're accelerating
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const lastInterval = intervals[intervals.length - 1];

  if (lastInterval < avgInterval * 0.7) return 'accelerating';
  if (lastInterval > avgInterval * 1.3) return 'plateaued';
  return 'stable';
}

// ─── Progress & Milestone Calculation ───────────────────────────────────────

interface LevelBoundary {
  level: ExpertiseTier;
  minScore: number;
  maxScore: number;
}

const LEVEL_BOUNDARIES: LevelBoundary[] = [
  { level: 'novice', minScore: 0, maxScore: NOVICE_THRESHOLD },
  { level: 'intermediate', minScore: NOVICE_THRESHOLD, maxScore: INTERMEDIATE_THRESHOLD },
  { level: 'expert', minScore: INTERMEDIATE_THRESHOLD, maxScore: 1 },
];

export function computeProgressToNext(score: number, currentLevel: ExpertiseTier): number {
  const boundary = LEVEL_BOUNDARIES.find(b => b.level === currentLevel);
  if (!boundary) return 0;

  const range = boundary.maxScore - boundary.minScore;
  if (range <= 0) return 1;

  const progress = (score - boundary.minScore) / range;
  return Math.min(1, Math.max(0, progress));
}

export function getNextMilestone(score: number, currentLevel: ExpertiseTier): string | null {
  if (currentLevel === 'expert') return null;

  const nextLevel = currentLevel === 'novice' ? 'intermediate' : 'expert';
  const nextBoundary = LEVEL_BOUNDARIES.find(b => b.level === nextLevel);
  if (!nextBoundary) return null;

  const scoreNeeded = nextBoundary.minScore - score;
  if (scoreNeeded <= 0) return 'Ready to level up!';

  return `Continue using advanced features to reach ${nextLevel} level`;
}

// ─── Main Classification ────────────────────────────────────────────────────

/**
 * Full expertise profile generation.
 * This is the main entry point for the ML-powered classification engine.
 */
export function generateExpertiseProfile(
  extendedSignals: Partial<ExtendedExpertiseSignals>,
  storedOverride?: string | null
): ExpertiseProfile {
  // Check for manual override first
  if (storedOverride === 'novice' || storedOverride === 'intermediate' || storedOverride === 'expert') {
    const signals = { ...createDefaultExtendedSignals(), ...extendedSignals };
    return {
      level: storedOverride,
      signals: signals as ExtendedExpertiseSignals,
      confidence: 1.0,
      growthTrend: 'stable',
      nextMilestone: null,
      progressToNext: 1,
      lastUpdated: new Date().toISOString(),
    };
  }

  const score = computeWeightedScore(extendedSignals);
  const level = classifyFromScore(score);
  const confidence = computeConfidence(extendedSignals);
  const signals = { ...createDefaultExtendedSignals(), ...extendedSignals } as ExtendedExpertiseSignals;
  const growthTrend = detectGrowthTrend(signals);
  const progressToNext = computeProgressToNext(score, level);
  const nextMilestone = getNextMilestone(score, level);

  return {
    level,
    signals,
    confidence,
    growthTrend,
    nextMilestone,
    progressToNext,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Accuracy Tracking ──────────────────────────────────────────────────────

/**
 * Record a prediction accuracy observation for self-improvement.
 */
export function recordAccuracyObservation(
  signals: ExtendedExpertiseSignals,
  predicted: ExpertiseTier,
  actual: ExpertiseTier
): ExtendedExpertiseSignals {
  const history = [...(signals.predictionAccuracyHistory || [])];
  history.push({
    predicted,
    actual,
    timestamp: new Date().toISOString(),
  });

  // Keep only the last N entries
  if (history.length > ACCURACY_HISTORY_LIMIT) {
    history.splice(0, history.length - ACCURACY_HISTORY_LIMIT);
  }

  return {
    ...signals,
    predictionAccuracyHistory: history,
  };
}

/**
 * Calculate current prediction accuracy from history.
 */
export function getPredictionAccuracy(
  signals: ExtendedExpertiseSignals
): { accuracy: number; totalPredictions: number; correctPredictions: number } {
  const history = signals.predictionAccuracyHistory || [];
  if (history.length === 0) {
    return { accuracy: 0, totalPredictions: 0, correctPredictions: 0 };
  }

  const correct = history.filter(h => h.predicted === h.actual).length;
  return {
    accuracy: correct / history.length,
    totalPredictions: history.length,
    correctPredictions: correct,
  };
}

// ─── Feature Visibility Config Factory ──────────────────────────────────────

/**
 * Generate feature visibility configuration based on expertise level.
 * This drives the progressive disclosure system.
 */
export function getFeatureVisibilityForLevel(level: ExpertiseTier): Record<string, FeatureVisibilityConfig> {
  const configs: Record<string, FeatureVisibilityConfig> = {
    // Core features - visible to all
    overview: { visible: true, showGuidance: true, highlighted: level === 'novice', minimumLevel: 'novice' },
    account: { visible: true, showGuidance: true, highlighted: level === 'novice', minimumLevel: 'novice' },
    transactions: { visible: true, showGuidance: level !== 'expert', highlighted: false, minimumLevel: 'novice' },
    network: { visible: true, showGuidance: false, highlighted: false, minimumLevel: 'novice' },
    faucet: { visible: true, showGuidance: true, highlighted: level === 'novice', minimumLevel: 'novice' },

    // Intermediate features - visible to intermediate+
    builder: { visible: level !== 'novice', showGuidance: level === 'intermediate', highlighted: level === 'intermediate', minimumLevel: 'intermediate' },
    contracts: { visible: level !== 'novice', showGuidance: level === 'intermediate', highlighted: level === 'intermediate', minimumLevel: 'intermediate' },
    assets: { visible: level !== 'novice', showGuidance: level === 'intermediate', highlighted: false, minimumLevel: 'intermediate' },
    anchors: { visible: level !== 'novice', showGuidance: level === 'intermediate', highlighted: false, minimumLevel: 'intermediate' },
    search: { visible: level !== 'novice', showGuidance: true, highlighted: false, minimumLevel: 'intermediate' },
    wallet: { visible: level !== 'novice', showGuidance: level === 'intermediate', highlighted: false, minimumLevel: 'intermediate' },
    signer: { visible: level !== 'novice', showGuidance: level === 'intermediate', highlighted: false, minimumLevel: 'intermediate' },
    multisig: { visible: level !== 'novice', showGuidance: level === 'intermediate', highlighted: false, minimumLevel: 'intermediate' },
    charts: { visible: level !== 'novice', showGuidance: false, highlighted: false, minimumLevel: 'intermediate' },
    analytics: { visible: level !== 'novice', showGuidance: false, highlighted: false, minimumLevel: 'intermediate' },
    portfolio: { visible: level !== 'novice', showGuidance: level === 'intermediate', highlighted: false, minimumLevel: 'intermediate' },
    liveActivity: { visible: level !== 'novice', showGuidance: false, highlighted: false, minimumLevel: 'intermediate' },

    // Expert features - only visible to experts
    governance: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    devToolbar: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    compliance: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    security: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    txPatterns: { visible: level === 'expert', showGuidance: false, highlighted: level === 'expert', minimumLevel: 'expert' },
    capacityPlanning: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    audit: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    collaboration: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    monitoringDashboards: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    systemHealth: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    logAnalyzer: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    dataExport: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    settings: { visible: true, showGuidance: false, highlighted: false, minimumLevel: 'novice' },
    designSystem: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    featureFlags: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    pathExplorer: { visible: level !== 'novice', showGuidance: false, highlighted: false, minimumLevel: 'intermediate' },
    realtime: { visible: level !== 'novice', showGuidance: false, highlighted: false, minimumLevel: 'intermediate' },
    dex: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    compare: { visible: level !== 'novice', showGuidance: false, highlighted: false, minimumLevel: 'intermediate' },
    cacheStats: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    claimableBalances: { visible: level !== 'novice', showGuidance: false, highlighted: false, minimumLevel: 'intermediate' },
    did: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    alertRules: { visible: level !== 'novice', showGuidance: false, highlighted: false, minimumLevel: 'intermediate' },
    portfolioAnalytics: { visible: level !== 'novice', showGuidance: false, highlighted: false, minimumLevel: 'intermediate' },
    paymentChannels: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    txSimulator: { visible: level !== 'novice', showGuidance: false, highlighted: false, minimumLevel: 'intermediate' },
    advancedSim: { visible: level === 'expert', showGuidance: false, highlighted: false, minimumLevel: 'expert' },
    performance: { visible: level !== 'novice', showGuidance: false, highlighted: false, minimumLevel: 'intermediate' },
  };

  return configs;
}

// ─── UI Adaptation Helpers ──────────────────────────────────────────────────

/**
 * Get a simplified view mode string for the dashboard.
 * Novices see a simplified layout, experts see full detail.
 */
export function getDashboardViewMode(level: ExpertiseTier): 'simplified' | 'standard' | 'detailed' {
  switch (level) {
    case 'novice': return 'simplified';
    case 'intermediate': return 'standard';
    case 'expert': return 'detailed';
  }
}

/**
 * Determine if tooltips/guidance should be shown for a given component.
 */
export function shouldShowGuidance(level: ExpertiseTier, featureName: string): boolean {
  const configs = getFeatureVisibilityForLevel(level);
  const config = configs[featureName];
  return config?.showGuidance ?? false;
}

/**
 * Get appropriate tooltip complexity level.
 */
export function getTooltipDetail(level: ExpertiseTier): 'simple' | 'normal' | 'advanced' {
  switch (level) {
    case 'novice': return 'simple';
    case 'intermediate': return 'normal';
    case 'expert': return 'advanced';
  }
}

