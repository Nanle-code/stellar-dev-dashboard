import type { InteractionType } from './interactionLog'
import { getFeatureUsage, detectPatterns, queryLog } from './interactionLog'
import { buildOrUpdateProfile, getProfile, getAccuracy } from './behaviorPrediction'
import type { BehaviorProfile } from './behaviorPrediction'
import { getSuggestionEffectiveness } from './proactiveSuggestions'

export interface PersonalizationSettings {
  enabled: boolean
  adaptDashboard: boolean
  suggestFeatures: boolean
  personalizeSearch: boolean
  rememberPreferences: boolean
  collectInteractionData: boolean
  shareAnonymousData: boolean
  dataRetentionDays: number
}

export interface DashboardAdaptation {
  recommendedWidgets: string[]
  hiddenWidgets: string[]
  layoutOrder: string[]
  density: 'compact' | 'comfortable' | 'spacious'
  theme: 'light' | 'dark' | 'auto'
  features: string[]
}

export interface UserPersona {
  type: 'developer' | 'trader' | 'analyst' | 'explorer' | 'power_user'
  confidence: number
  traits: string[]
}

export interface PersonalizationInsight {
  category: string
  label: string
  description: string
  confidence: number
  action: string
}

export interface PersonalizationSummary {
  userId: string
  persona: UserPersona | null
  topFeatures: string[]
  peakUsageHours: number[]
  averageSessionMinutes: number
  preferredActions: InteractionType[]
  suggestionEffectiveness: number
  predictionAccuracy: number
  adaptionApplied: boolean
  settings: PersonalizationSettings
  lastUpdated: number
}

const DEFAULT_SETTINGS: PersonalizationSettings = {
  enabled: true,
  adaptDashboard: true,
  suggestFeatures: true,
  personalizeSearch: true,
  rememberPreferences: true,
  collectInteractionData: true,
  shareAnonymousData: false,
  dataRetentionDays: 30,
}

const _settingsCache = new Map<string, PersonalizationSettings>()

const PERSONA_THRESHOLDS: Array<{
  type: UserPersona['type']
  traits: string[]
  score: (profile: BehaviorProfile, accuracy: number, suggestionEffectiveness: number) => number
}> = [
  {
    type: 'developer',
    traits: ['smart contract interaction', 'transaction building', 'network configuration'],
    score: (p, acc, eff) => {
      let s = 0
      if (p.preferredActions.includes('transaction_build')) s += 0.3
      if (p.featureAffinities['contracts'] ?? 0 > 0.1) s += 0.25
      if (p.topFeatures.some(f => f.includes('contract') || f.includes('build'))) s += 0.2
      if (p.activeHours.some((h, i) => h > 0 && (i < 6 || i > 22))) s += 0.15
      s += acc * 0.05
      s += eff * 0.05
      return s
    },
  },
  {
    type: 'trader',
    traits: ['payment transactions', 'balance monitoring', 'price tracking'],
    score: (p, acc, eff) => {
      let s = 0
      if (p.preferredActions.includes('transaction_submit')) s += 0.3
      if (p.featureAffinities['portfolio'] ?? 0 > 0.1) s += 0.2
      if (p.topFeatures.some(f => f.includes('portfolio') || f.includes('balance'))) s += 0.2
      s += acc * 0.15
      s += eff * 0.15
      return s
    },
  },
  {
    type: 'analyst',
    traits: ['data export', 'pattern analysis', 'report generation'],
    score: (p, acc, eff) => {
      let s = 0
      if (p.preferredActions.includes('export_data')) s += 0.3
      if (p.featureAffinities['analytics'] ?? 0 > 0.1) s += 0.25
      if (p.topFeatures.some(f => f.includes('analytics') || f.includes('export'))) s += 0.2
      s += acc * 0.1
      s += eff * 0.15
      return s
    },
  },
  {
    type: 'explorer',
    traits: ['feature discovery', 'network browsing', 'account searching'],
    score: (p, acc, eff) => {
      let s = 0
      if (p.preferredActions.includes('search')) s += 0.25
      if (p.preferredActions.includes('navigation')) s += 0.2
      if (p.topFeatures.length > 5) s += 0.2
      s += acc * 0.1
      s += eff * 0.15
      return s
    },
  },
  {
    type: 'power_user',
    traits: ['advanced features', 'keyboard shortcuts', 'custom workflows'],
    score: (p, acc, eff) => {
      let s = 0
      if (p.topFeatures.length > 8) s += 0.15
      if ((p.featureAffinities['settings'] ?? 0) > 0.1) s += 0.15
      if (p.preferredActions.includes('settings_change')) s += 0.15
      if (p.averageSessionDuration > 300000) s += 0.15
      s += p.patternAdherence * 0.2
      s += acc * 0.1
      s += eff * 0.1
      return s
    },
  },
]

export function getDefaultSettings(): PersonalizationSettings {
  return { ...DEFAULT_SETTINGS }
}

export function getSettings(userId: string): PersonalizationSettings {
  return _settingsCache.get(userId) ?? { ...DEFAULT_SETTINGS }
}

export function updateSettings(userId: string, partial: Partial<PersonalizationSettings>): PersonalizationSettings {
  const current = getSettings(userId)
  const updated = { ...current, ...partial }
  _settingsCache.set(userId, updated)
  return { ...updated }
}

export function resetSettings(userId: string): void {
  _settingsCache.delete(userId)
}

export async function determinePersona(userId: string): Promise<UserPersona> {
  const profile = getProfile(userId)
  if (!profile || profile.sampleCount < 20) {
    return { type: 'explorer', confidence: 0.3, traits: ['insufficient data'] }
  }

  const accuracy = getAccuracy(userId)
  const effectiveness = getSuggestionEffectiveness(userId)

  let best: { type: UserPersona['type']; score: number; traits: string[] } = {
    type: 'explorer',
    score: 0.3,
    traits: ['default'],
  }

  for (const threshold of PERSONA_THRESHOLDS) {
    const score = threshold.score(profile, accuracy, effectiveness)
    if (score > best.score) {
      best = { type: threshold.type, score, traits: threshold.traits }
    }
  }

  return {
    type: best.type,
    confidence: Math.min(1, best.score),
    traits: best.traits,
  }
}

export async function getDashboardAdaptation(userId: string): Promise<DashboardAdaptation> {
  const settings = getSettings(userId)
  if (!settings.enabled || !settings.adaptDashboard) {
    return {
      recommendedWidgets: [],
      hiddenWidgets: [],
      layoutOrder: [],
      density: 'comfortable',
      theme: 'auto',
      features: [],
    }
  }

  const profile = getProfile(userId)
  if (!profile || profile.sampleCount < 20) {
    return {
      recommendedWidgets: ['overview', 'network', 'recent'],
      hiddenWidgets: [],
      layoutOrder: ['overview', 'network', 'recent'],
      density: 'comfortable',
      theme: 'auto',
      features: [],
    }
  }

  const persona = await determinePersona(userId)
  const featureUsage = await getFeatureUsage(userId)

  const recommendedWidgets: string[] = []
  const hiddenWidgets: string[] = []
  const excluded = new Set<string>()

  for (const usage of featureUsage) {
    if (usage.trend === 'increasing' && usage.useCount > 3) {
      recommendedWidgets.push(usage.feature)
    }
    if (usage.trend === 'decreasing' && usage.lastUsed < Date.now() - 14 * 86400000) {
      hiddenWidgets.push(usage.feature)
      excluded.add(usage.feature)
    }
  }

  const widgetPreferences: Record<string, Record<string, number>> = {
    developer: { contracts: 0.9, transactions: 0.8, network: 0.7, analytics: 0.5 },
    trader: { portfolio: 0.9, transactions: 0.8, network: 0.7, alerts: 0.7 },
    analyst: { analytics: 0.9, transactions: 0.7, portfolio: 0.6, network: 0.5 },
    explorer: { network: 0.8, accounts: 0.8, transactions: 0.6, contracts: 0.5 },
    power_user: { transactions: 0.9, contracts: 0.8, analytics: 0.8, network: 0.7 },
  }

  const personaWidgets = widgetPreferences[persona.type] ?? {}
  for (const [widget, preference] of Object.entries(personaWidgets)) {
    if (!excluded.has(widget) && preference > 0.6) {
      if (!recommendedWidgets.includes(widget)) {
        recommendedWidgets.push(widget)
      }
    }
  }

  const layoutOrder = recommendedWidgets.slice()
  const allWidgets = ['overview', ...recommendedWidgets, 'network', 'recent']
  const finalOrder = Array.from(new Set(allWidgets))

  return {
    recommendedWidgets,
    hiddenWidgets,
    layoutOrder: finalOrder,
    density: profile.averageSessionDuration > 300000 ? 'compact' : 'comfortable',
    theme: 'auto',
    features: profile.topFeatures.slice(0, 5),
  }
}

export async function personalizeSearchResults(
  userId: string,
  query: string,
  results: Array<{ id: string; type: string; score: number }>
): Promise<Array<{ id: string; type: string; score: number }>> {
  const settings = getSettings(userId)
  if (!settings.enabled || !settings.personalizeSearch) return results

  const profile = getProfile(userId)
  if (!profile || profile.topFeatures.length === 0) return results

  const boosted = results.map(result => {
    let boost = 0
    if (profile.topFeatures.includes(result.type)) boost += 0.15
    if (profile.preferredActions.includes(result.type as InteractionType)) boost += 0.1
    if (profile.featureAffinities[result.type] ?? 0 > 0.1) boost += 0.1
    return { ...result, score: result.score * (1 + boost) }
  })

  return boosted.sort((a, b) => b.score - a.score)
}

export async function getPersonalizationSummary(userId: string): Promise<PersonalizationSummary> {
  const settings = getSettings(userId)
  const profile = getProfile(userId)
  const accuracy = getAccuracy(userId)
  const effectiveness = getSuggestionEffectiveness(userId)
  const persona = profile && profile.sampleCount >= 20 ? await determinePersona(userId) : null

  return {
    userId,
    persona,
    topFeatures: profile?.topFeatures ?? [],
    peakUsageHours: profile?.activeHours
      ? profile.activeHours
          .map((count, hour) => ({ hour, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map(({ hour }) => hour)
      : [],
    averageSessionMinutes: profile ? Math.round(profile.averageSessionDuration / 60000) : 0,
    preferredActions: profile?.preferredActions ?? [],
    suggestionEffectiveness: effectiveness,
    predictionAccuracy: accuracy,
    adaptionApplied: settings.adaptDashboard,
    settings,
    lastUpdated: profile?.lastUpdated ?? Date.now(),
  }
}

export async function refreshPersonalization(userId: string): Promise<void> {
  await buildOrUpdateProfile(userId)
}

export async function clearPersonalizationData(userId: string): Promise<void> {
  const { clearLog, clearUserData } = await import('./interactionLog')
  const { resetProfile } = await import('./behaviorPrediction')
  await clearUserData(userId)
  resetProfile(userId)
  resetSettings(userId)
}

// ─── Profile-based personalization API (used by PersonalizationPanel) ─────────

const PROFILE_STORAGE_KEY = 'stellar_personalization_profile'

export interface PersonalizationProfile {
  userId?: string
  version?: number
  /** List of recorded interactions (each with type, target, timestamp) */
  interactionHistory: Array<{ type: string; target: string; timestamp: number; metadata?: Record<string, unknown> }>
  /** Map of tab name → visit count */
  tabFrequency: Record<string, number>
  /** Map of widget type → net usage count */
  widgetFrequency: Record<string, number>
  /** Map of feature name → usage count */
  featureFrequency: Record<string, number>
  /** Map of correction target → correction count */
  corrections: Record<string, number>
  /** Map of widget target → explicit preference value */
  explicitPreferences: Record<string, number>
  /** Dismissed widget suggestions */
  dismissedSuggestions: string[]
  /** Accepted widget suggestions */
  acceptedSuggestions: string[]
  /** Whether learning mode is active */
  learningEnabled: boolean
  /** How much transparency to show: full / summary / minimal */
  transparencyLevel: 'full' | 'summary' | 'minimal'
  /** ISO timestamp of last update */
  lastUpdated: string
}

export interface PersonalizationStats {
  totalInteractions: number
  uniqueTabsVisited: number
  uniqueWidgetsUsed: number
  suggestionsAccepted: number
  estimatedEfficiencyGain: number
  learningActive: boolean
  topTabs: Array<{ tab: string; count: number }>
  topWidgets: Array<{ widget: string; count: number }>
}

export interface WidgetScore {
  widgetType: string
  score: number
  reason: string
}

export function createDefaultProfile(userId?: string): PersonalizationProfile {
  return {
    userId: userId ?? `user-${Math.random().toString(36).slice(2, 9)}`,
    version: 1,
    interactionHistory: [],
    tabFrequency: {},
    widgetFrequency: {},
    featureFrequency: {},
    corrections: {},
    explicitPreferences: {},
    dismissedSuggestions: [],
    acceptedSuggestions: [],
    learningEnabled: true,
    transparencyLevel: 'full',
    lastUpdated: new Date().toISOString(),
  }
}

export function getWidgetEfficiencyScore(profile: PersonalizationProfile, widgetType: string): number {
  const usage = profile.widgetFrequency[widgetType] ?? 0
  const corrections = profile.corrections[`widget_${widgetType}`] ?? profile.corrections[widgetType] ?? 0
  return Math.max(0, 50 + usage * 10 - corrections * 10)
}

export async function loadPersonalizationProfile(): Promise<PersonalizationProfile> {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (raw) return { ...createDefaultProfile(), ...JSON.parse(raw) }
  } catch {
    // ignore parse errors
  }
  return createDefaultProfile()
}

export async function savePersonalizationProfile(profile: PersonalizationProfile): Promise<void> {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ ...profile, lastUpdated: new Date().toISOString() }))
  } catch {
    // ignore storage errors
  }
}

export async function resetPersonalization(): Promise<PersonalizationProfile> {
  const fresh = createDefaultProfile()
  await savePersonalizationProfile(fresh)
  return fresh
}

export async function recordInteraction(
  profile: PersonalizationProfile,
  event: { type: string; target: string; metadata?: Record<string, unknown> },
): Promise<PersonalizationProfile> {
  if (!profile.learningEnabled) return profile
  const updated: PersonalizationProfile = {
    ...profile,
    interactionHistory: [
      ...profile.interactionHistory,
      { type: event.type, target: event.target, timestamp: Date.now(), metadata: event.metadata },
    ],
    tabFrequency:
      event.type === 'tab_visit'
        ? { ...profile.tabFrequency, [event.target]: (profile.tabFrequency[event.target] ?? 0) + 1 }
        : profile.tabFrequency,
    widgetFrequency:
      event.type === 'widget_add'
        ? { ...profile.widgetFrequency, [event.target]: (profile.widgetFrequency[event.target] ?? 0) + 1 }
        : event.type === 'widget_remove'
          ? { ...profile.widgetFrequency, [event.target]: Math.max(0, (profile.widgetFrequency[event.target] ?? 0) - 1) }
          : profile.widgetFrequency,
    featureFrequency:
      event.type === 'feature_use'
        ? { ...profile.featureFrequency, [event.target]: (profile.featureFrequency[event.target] ?? 0) + 1 }
        : profile.featureFrequency,
    corrections:
      event.type === 'correction'
        ? { ...profile.corrections, [event.target]: (profile.corrections[event.target] ?? 0) + 1 }
        : profile.corrections,
    explicitPreferences:
      event.type === 'explicit_feedback'
        ? { ...profile.explicitPreferences, [event.target]: Number(event.metadata?.value) || 0 }
        : profile.explicitPreferences,
    lastUpdated: new Date().toISOString(),
  }
  await savePersonalizationProfile(updated)
  return updated
}

export async function recordSuggestionAccepted(
  profile: PersonalizationProfile,
  widgetType: string,
): Promise<PersonalizationProfile> {
  const updated: PersonalizationProfile = {
    ...profile,
    acceptedSuggestions: [...new Set([...profile.acceptedSuggestions, widgetType])],
    dismissedSuggestions: profile.dismissedSuggestions.filter(w => w !== widgetType),
    lastUpdated: new Date().toISOString(),
  }
  await savePersonalizationProfile(updated)
  return updated
}

export async function recordSuggestionDismissed(
  profile: PersonalizationProfile,
  widgetType: string,
): Promise<PersonalizationProfile> {
  const updated: PersonalizationProfile = {
    ...profile,
    dismissedSuggestions: [...new Set([...profile.dismissedSuggestions, widgetType])],
    acceptedSuggestions: profile.acceptedSuggestions.filter(w => w !== widgetType),
    lastUpdated: new Date().toISOString(),
  }
  await savePersonalizationProfile(updated)
  return updated
}

export function computePersonalizationStats(profile: PersonalizationProfile): PersonalizationStats {
  const topTabs = Object.entries(profile.tabFrequency)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([tab, count]) => ({ tab, count }))

  const topWidgets = Object.entries(profile.widgetFrequency)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([widget, count]) => ({ widget, count }))

  const uniqueTabsVisited = topTabs.length
  const uniqueWidgetsUsed = topWidgets.length

  return {
    totalInteractions: profile.interactionHistory.length,
    uniqueTabsVisited,
    uniqueWidgetsUsed,
    suggestionsAccepted: profile.acceptedSuggestions.length,
    estimatedEfficiencyGain: Math.min(95, Math.round(profile.interactionHistory.length / 10) + profile.acceptedSuggestions.length * 5),
    learningActive: profile.learningEnabled,
    topTabs,
    topWidgets,
  }
}

export function computeWidgetRecommendations(
  profile: PersonalizationProfile,
  availableTypes: string[],
  currentWidgets: string[],
  limit?: number,
): WidgetScore[] {
  const excluded = new Set(currentWidgets)
  const recs = availableTypes
    .filter(type => !excluded.has(type))
    .map(type => {
      const usage = profile.widgetFrequency[type] ?? 0
      const accepted = profile.acceptedSuggestions.includes(type)
      const dismissed = profile.dismissedSuggestions.includes(type)
      const corrections = profile.corrections[`widget_${type}`] ?? profile.corrections[type] ?? 0
      let score = 5 + usage * 10
      if (accepted) score += 30
      if (dismissed) score -= 80
      score -= corrections * 5
      score += Math.random() * 5
      const reason =
        usage > 0
          ? `You've used this widget ${usage} times — it fits your workflow well.`
          : accepted
            ? 'Previously added to your layout.'
            : dismissed
              ? 'Marked as not useful; you can add it manually.'
              : 'Might complement your existing setup.'
      return { widgetType: type, score, reason }
    })
    .sort((a, b) => b.score - a.score)
  return limit ? recs.slice(0, limit) : recs
}

export function identifyPeakUsageHours(profile: PersonalizationProfile): number[] {
  const hourCounts = new Map<number, number>()
  for (const entry of profile.interactionHistory) {
    const hour = new Date(entry.timestamp).getHours()
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
  }
  return [...hourCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => hour)
}

export function detectPowerUser(profile: PersonalizationProfile): boolean {
  return profile.interactionHistory.length > 100 || Object.keys(profile.tabFrequency).length > 6
}

export function detectCasualUser(profile: PersonalizationProfile): boolean {
  return Object.keys(profile.tabFrequency).length < 3
}

export function computeLayoutCompactnessScore(profile: PersonalizationProfile): number {
  if (detectPowerUser(profile)) return 0.7
  if (detectCasualUser(profile)) return 0.3
  return 0.5
}
