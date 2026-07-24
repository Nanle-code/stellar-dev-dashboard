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
