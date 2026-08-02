import type { InteractionEvent, InteractionType, FeatureUsageSummary, InteractionPattern } from './interactionLog'
import { queryLog, getFeatureUsage, detectPatterns } from './interactionLog'

export interface IntentPrediction {
  intent: string
  probability: number
  context: string
  alternativeIntents: Array<{ intent: string; probability: number }>
  features: number[]
  modelVersion: string
  timestamp: number
}

export interface NextActionPrediction {
  predictedAction: string
  actionType: InteractionType
  probability: number
  timeEstimate: number
  alternativeActions: Array<{ action: string; type: InteractionType; probability: number }>
  confidence: number
  features: number[]
  timestamp: number
}

export interface BehaviorProfile {
  userId: string
  topFeatures: string[]
  preferredActions: InteractionType[]
  activeHours: number[]
  averageSessionDuration: number
  featureAffinities: Record<string, number>
  actionProbabilities: Record<string, number>
  patternAdherence: number
  lastUpdated: number
  sampleCount: number
  accuracy: number
}

export interface PredictionFeedback {
  predictionId: string
  userId: string
  actualAction: string
  correct: boolean
  timestamp: number
}

export interface BehaviorPredictionConfig {
  minSamplesForProfile: number
  adaptationRate: number
  accuracyThreshold: number
  featureDecayDays: number
  maxFeatures: number
}

const DEFAULT_CONFIG: BehaviorPredictionConfig = {
  minSamplesForProfile: 20,
  adaptationRate: 0.15,
  accuracyThreshold: 0.7,
  featureDecayDays: 30,
  maxFeatures: 50,
}

const MODEL_VERSION = 'behavior-prediction-v1'
const _profiles = new Map<string, BehaviorProfile>()
const _feedback: PredictionFeedback[] = []

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function softmax(values: number[]): number[] {
  const max = Math.max(...values, 0)
  const exps = values.map(v => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => e / sum)
}

function extractFeatureVector(
  recentEvents: InteractionEvent[],
  featureUsage: FeatureUsageSummary[],
  patterns: InteractionPattern[]
): number[] {
  const now = Date.now()

  const recentCount = recentEvents.length
  const uniqueTypes = new Set(recentEvents.map(e => e.type)).size
  const uniqueTargets = new Set(recentEvents.map(e => e.target)).size
  const avgDuration = recentEvents.length > 0
    ? recentEvents.reduce((s, e) => s + e.duration, 0) / recentEvents.length
    : 0
  const recencyScore = recentEvents.length > 0
    ? recentEvents.reduce((s, e) => s + Math.exp(-(now - e.timestamp) / 3600000), 0) / recentEvents.length
    : 0
  const sessionCount = new Set(recentEvents.map(e => e.sessionId)).size
  const topFeatureCount = featureUsage.length
  const patternCount = patterns.length
  const avgPatternConfidence = patterns.length > 0
    ? patterns.reduce((s, p) => s + p.confidence, 0) / patterns.length
    : 0
  const featureDiversity = topFeatureCount > 0
    ? Math.min(1, uniqueTargets / topFeatureCount)
    : 0
  const hour = new Date().getHours()
  const hourNorm = hour / 24

  return [
    Math.log1p(recentCount) / 10,
    uniqueTypes / 15,
    uniqueTargets / 20,
    Math.log1p(avgDuration) / 10,
    recencyScore,
    Math.log1p(sessionCount) / 5,
    topFeatureCount / DEFAULT_CONFIG.maxFeatures,
    patternCount / 20,
    avgPatternConfidence,
    featureDiversity,
    hourNorm,
  ]
}

export async function buildOrUpdateProfile(userId: string, config: Partial<BehaviorPredictionConfig> = {}): Promise<BehaviorProfile> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const since = Date.now() - cfg.featureDecayDays * 86400000

  const recentEvents = await queryLog({ userId, since, limit: 500 })
  const featureUsage = await getFeatureUsage(userId, since)
  const patterns = await detectPatterns(userId)

  const actionCounts = new Map<InteractionType, number>()
  for (const event of recentEvents) {
    actionCounts.set(event.type, (actionCounts.get(event.type) ?? 0) + 1)
  }

  const activeHours = new Array(24).fill(0)
  for (const event of recentEvents) {
    const h = new Date(event.timestamp).getHours()
    activeHours[h]++
  }

  const totalActions = recentEvents.length || 1
  const preferredActions = Array.from(actionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type]) => type)

  const topFeatures = featureUsage.slice(0, 10).map(f => f.feature)

  const totalDuration = recentEvents.reduce((s, e) => s + e.duration, 0)
  const averageSessionDuration = recentEvents.length > 0 ? totalDuration / recentEvents.length : 0

  const featureAffinities: Record<string, number> = {}
  for (const usage of featureUsage) {
    featureAffinities[usage.feature] = usage.avgSessionFrequency
  }

  const actionProbabilities: Record<string, number> = {}
  for (const [type, count] of actionCounts) {
    actionProbabilities[type] = count / totalActions
  }

  const patternAdherence = patterns.length > 0
    ? patterns.reduce((s, p) => s + p.confidence, 0) / Math.max(1, patterns.length)
    : 0

  const existing = _profiles.get(userId)
  const accuracy = existing?.accuracy ?? 0.5

  const profile: BehaviorProfile = {
    userId,
    topFeatures,
    preferredActions,
    activeHours,
    averageSessionDuration,
    featureAffinities,
    actionProbabilities,
    patternAdherence,
    lastUpdated: Date.now(),
    sampleCount: recentEvents.length,
    accuracy,
  }

  if (existing) {
    const rate = cfg.adaptationRate
    profile.topFeatures = rate > 0
      ? topFeatures.map((f, i) => existing.topFeatures[i] ?? f)
      : topFeatures
    profile.preferredActions = preferredActions
    profile.patternAdherence = rate * patternAdherence + (1 - rate) * existing.patternAdherence
    profile.averageSessionDuration = rate * averageSessionDuration + (1 - rate) * existing.averageSessionDuration
    profile.sampleCount = existing.sampleCount + recentEvents.filter(e => e.timestamp > existing.lastUpdated).length
  }

  _profiles.set(userId, profile)
  return profile
}

export async function predictIntent(userId: string, currentContext: string): Promise<IntentPrediction> {
  const profile = _profiles.get(userId)
  if (!profile || profile.sampleCount < 1) {
    return {
      intent: 'explore',
      probability: 0.3,
      context: currentContext,
      alternativeIntents: [
        { intent: 'browse', probability: 0.25 },
        { intent: 'transact', probability: 0.25 },
        { intent: 'monitor', probability: 0.2 },
      ],
      features: [],
      modelVersion: MODEL_VERSION,
      timestamp: Date.now(),
    }
  }

  const featureUsage = await getFeatureUsage(userId)
  const patterns = await detectPatterns(userId)
  const recentEvents = await queryLog({ userId, since: Date.now() - 86400000, limit: 100 })

  const features = extractFeatureVector(recentEvents, featureUsage, patterns)

  const recentTypes = recentEvents.slice(0, 10).map(e => e.type)
  const lastAction = recentTypes[0]

  const intentScores = new Map<string, number>()

  const actionMap: Record<string, string> = {
    transaction_submit: 'transact',
    transaction_build: 'transact',
    account_view: 'monitor',
    search: 'explore',
    feature_use: 'explore',
    page_view: 'browse',
    navigation: 'browse',
    export_data: 'analyze',
    settings_change: 'configure',
    network_switch: 'configure',
    alert_click: 'monitor',
  }

  const score = (base: number, weight: number) => base * (1 + weight * 0.2)

  for (const [action, intent] of Object.entries(actionMap)) {
    const prob = profile.actionProbabilities[action] ?? 0
    if (prob > 0) {
      intentScores.set(intent, (intentScores.get(intent) ?? 0) + score(prob, features[2] ?? 0))
    }
  }

  if (lastAction && actionMap[lastAction]) {
    const followIntent = actionMap[lastAction]
    intentScores.set(followIntent, (intentScores.get(followIntent) ?? 0) + 0.15)
  }

  const hour = new Date().getHours()
  if (profile.activeHours[hour] > 0) {
    intentScores.set('monitor', (intentScores.get('monitor') ?? 0) + 0.1)
  }

  if (intentScores.size === 0) {
    intentScores.set('explore', 0.3)
    intentScores.set('browse', 0.25)
    intentScores.set('transact', 0.25)
    intentScores.set('monitor', 0.2)
  }

  const sorted = Array.from(intentScores.entries())
    .sort((a, b) => b[1] - a[1])

  const scores = sorted.map(([, s]) => s)
  const probabilities = softmax(scores)

  const alternatives = sorted.slice(1).map(([intent], i) => ({
    intent,
    probability: probabilities[i + 1] ?? 0,
  }))

  return {
    intent: sorted[0][0],
    probability: probabilities[0],
    context: currentContext,
    alternativeIntents: alternatives,
    features,
    modelVersion: MODEL_VERSION,
    timestamp: Date.now(),
  }
}

export async function predictNextAction(userId: string): Promise<NextActionPrediction> {
  const profile = _profiles.get(userId)
  if (!profile || profile.sampleCount < 1) {
    return {
      predictedAction: 'page_view',
      actionType: 'page_view',
      probability: 0.4,
      timeEstimate: 60000,
      alternativeActions: [
        { action: 'feature_use', type: 'feature_use', probability: 0.3 },
        { action: 'search', type: 'search', probability: 0.15 },
        { action: 'navigation', type: 'navigation', probability: 0.15 },
      ],
      confidence: 0.3,
      features: [],
      timestamp: Date.now(),
    }
  }

  const featureUsage = await getFeatureUsage(userId)
  const patterns = await detectPatterns(userId)
  const recentEvents = await queryLog({ userId, since: Date.now() - 86400000, limit: 100 })
  const features = extractFeatureVector(recentEvents, featureUsage, patterns)

  const actionScores = new Map<InteractionType, number>()
  for (const [type, prob] of Object.entries(profile.actionProbabilities)) {
    actionScores.set(type as InteractionType, prob)
  }

  const recentTypes = recentEvents.slice(0, 5).map(e => e.type)
  for (let i = 0; i < recentTypes.length - 1; i++) {
    const key = `${recentTypes[i]}->${recentTypes[i + 1]}`
    for (const pattern of patterns) {
      if (pattern.pattern === key || pattern.pattern.endsWith(key)) {
        const nextKey = `${recentTypes[recentTypes.length - 1]}->`
        for (const [type] of actionScores) {
          if (pattern.pattern === `${nextKey}${type}` || pattern.pattern.endsWith(`${nextKey}${type}`)) {
            actionScores.set(type, (actionScores.get(type) ?? 0) + pattern.confidence * 0.2)
          }
        }
      }
    }
  }

  if (profile.topFeatures.length > 0 && recentEvents.length > 0) {
    const lastTarget = recentEvents[0].target
    const topFeature = profile.topFeatures[0]
    if (lastTarget !== topFeature) {
      const affinity = profile.featureAffinities[topFeature] ?? 0
      actionScores.set('feature_use', (actionScores.get('feature_use') ?? 0) + affinity * 0.1)
    }
  }

  const sorted = Array.from(actionScores.entries())
    .sort((a, b) => b[1] - a[1])

  const scores = sorted.map(([, s]) => s)
  const probabilities = softmax(scores)

  const top = sorted[0]
  const alternatives = sorted.slice(1, 4).map(([action], i) => ({
    action,
    type: action,
    probability: probabilities[i + 1] ?? 0,
  }))

  const probability = probabilities[0]
  const confidence = profile.patternAdherence * probability

  const timeEstimate = Math.max(5000, Math.round(
    profile.averageSessionDuration * (1 - probability) * 2
  ))

  return {
    predictedAction: top[0],
    actionType: top[0],
    probability,
    timeEstimate,
    alternativeActions: alternatives,
    confidence,
    features,
    timestamp: Date.now(),
  }
}

export function recordPredictionFeedback(feedback: PredictionFeedback): void {
  _feedback.push(feedback)

  const profile = _profiles.get(feedback.userId)
  if (profile) {
    const recent = _feedback.filter(f => f.userId === feedback.userId).slice(-50)
    const correct = recent.filter(f => f.correct).length
    profile.accuracy = recent.length > 0 ? correct / recent.length : 0.5
    _profiles.set(feedback.userId, profile)
  }
}

export function getProfile(userId: string): BehaviorProfile | null {
  return _profiles.get(userId) ?? null
}

export function getAccuracy(userId: string): number {
  const profile = _profiles.get(userId)
  if (!profile) return 0
  const recent = _feedback.filter(f => f.userId === userId).slice(-100)
  if (recent.length === 0) return profile.accuracy
  return recent.filter(f => f.correct).length / recent.length
}

export function resetProfile(userId: string): void {
  _profiles.delete(userId)
  const toRemove = _feedback.filter(f => f.userId === userId).map(f => f.predictionId)
  for (const id of toRemove) {
    const idx = _feedback.findIndex(f => f.predictionId === id)
    if (idx >= 0) _feedback.splice(idx, 1)
  }
}

export function getConfig(): BehaviorPredictionConfig {
  return { ...DEFAULT_CONFIG }
}
