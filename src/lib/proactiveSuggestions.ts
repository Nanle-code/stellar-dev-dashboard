import type { InteractionType } from './interactionLog'
import { queryLog } from './interactionLog'
import {
  predictIntent,
  predictNextAction,
  getProfile,
  recordPredictionFeedback,
} from './behaviorPrediction'
import type { IntentPrediction, NextActionPrediction, BehaviorProfile } from './behaviorPrediction'

export type SuggestionCategory =
  | 'feature'
  | 'workflow'
  | 'insight'
  | 'shortcut'
  | 'reminder'
  | 'discovery'

export type SuggestionPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Suggestion {
  id: string
  userId: string
  category: SuggestionCategory
  priority: SuggestionPriority
  title: string
  description: string
  action: {
    type: string
    target: string
    metadata: Record<string, unknown>
  }
  score: number
  expiresAt: number
  context: string
  createdAt: number
}

export interface SuggestionFeedback {
  suggestionId: string
  userId: string
  action: 'shown' | 'clicked' | 'dismissed' | 'helpful' | 'not_helpful'
  timestamp: number
}

export interface ProactiveSuggestionState {
  enabled: boolean
  maxSuggestions: number
  cooldownMinutes: number
  categories: SuggestionCategory[]
  minScore: number
}

const DEFAULT_STATE: ProactiveSuggestionState = {
  enabled: true,
  maxSuggestions: 3,
  cooldownMinutes: 15,
  categories: ['feature', 'workflow', 'insight', 'shortcut', 'reminder', 'discovery'],
  minScore: 0.3,
}

const _suggestionHistory = new Map<string, Suggestion[]>()
const _feedbackLog: SuggestionFeedback[] = []

function generateId(): string {
  return `suggestion-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function scoreBasedOnContext(
  profile: BehaviorProfile | null,
  intent: IntentPrediction,
  nextAction: NextActionPrediction,
  context: string
): number {
  let score = 0

  if (profile) {
    score += profile.patternAdherence * 0.2
    score += profile.accuracy * 0.15
  }

  score += intent.probability * 0.25
  score += nextAction.probability * 0.2
  score += nextAction.confidence * 0.1

  score += (1 - nextAction.probability) * 0.1

  return Math.min(1, Math.max(0, score))
}

function buildFeatureSuggestions(
  userId: string,
  profile: BehaviorProfile | null,
  intent: IntentPrediction,
  context: string
): Suggestion[] {
  const suggestions: Suggestion[] = []
  const now = Date.now()

  if (intent.intent === 'transact') {
    suggestions.push({
      id: generateId(),
      userId,
      category: 'feature',
      priority: 'high',
      title: 'Optimize Transaction Fees',
      description: 'Use AI-powered fee prediction to optimize your transaction costs',
      action: { type: 'navigate', target: '/transactions/build', metadata: { autoOpenFeePrediction: true } },
      score: 0.85 + intent.probability * 0.1,
      expiresAt: now + 3600000,
      context,
      createdAt: now,
    })
    suggestions.push({
      id: generateId(),
      userId,
      category: 'workflow',
      priority: 'medium',
      title: 'Batch Similar Transactions',
      description: 'Combine multiple operations into a single transaction to save fees',
      action: { type: 'navigate', target: '/transactions/build', metadata: { mode: 'batch' } },
      score: 0.65 + intent.probability * 0.05,
      expiresAt: now + 3600000,
      context,
      createdAt: now,
    })
  }

  if (intent.intent === 'monitor') {
    suggestions.push({
      id: generateId(),
      userId,
      category: 'insight',
      priority: 'high',
      title: 'Network Activity Alert',
      description: 'Recent congestion detected — review your pending transactions',
      action: { type: 'navigate', target: '/network', metadata: { filter: 'congestion' } },
      score: 0.8 + intent.probability * 0.1,
      expiresAt: now + 3600000,
      context,
      createdAt: now,
    })
    suggestions.push({
      id: generateId(),
      userId,
      category: 'feature',
      priority: 'medium',
      title: 'Set Up Account Watch',
      description: 'Monitor specific accounts for activity and balance changes',
      action: { type: 'navigate', target: '/accounts/watch', metadata: {} },
      score: 0.6 + intent.probability * 0.05,
      expiresAt: now + 3600000,
      context,
      createdAt: now,
    })
  }

  if (intent.intent === 'explore') {
    suggestions.push({
      id: generateId(),
      userId,
      category: 'discovery',
      priority: 'low',
      title: 'Try Smart Contract Explorer',
      description: 'Discover and interact with Soroban smart contracts on Stellar',
      action: { type: 'navigate', target: '/contracts', metadata: {} },
      score: 0.55 + intent.probability * 0.05,
      expiresAt: now + 7200000,
      context,
      createdAt: now,
    })
  }

  if (intent.intent === 'analyze') {
    suggestions.push({
      id: generateId(),
      userId,
      category: 'insight',
      priority: 'high',
      title: 'Export Transaction Analysis',
      description: 'Generate a comprehensive report of your recent transaction patterns',
      action: { type: 'navigate', target: '/analytics/export', metadata: { format: 'csv' } },
      score: 0.75 + intent.probability * 0.1,
      expiresAt: now + 3600000,
      context,
      createdAt: now,
    })
  }

  if (profile && profile.topFeatures.length > 0) {
    const lastFeature = profile.topFeatures[0]
    const hour = new Date().getHours()
    const peakHour = profile.activeHours.indexOf(Math.max(...profile.activeHours))

    if (hour === peakHour || Math.abs(hour - peakHour) <= 1) {
      suggestions.push({
        id: generateId(),
        userId,
        category: 'reminder',
        priority: 'medium',
        title: `Continue with ${lastFeature}`,
        description: `You frequently use ${lastFeature} during this time`,
        action: { type: 'navigate', target: `/${lastFeature}`, metadata: {} },
        score: 0.7 + (profile.patternAdherence ?? 0) * 0.1,
        expiresAt: now + 3600000,
        context,
        createdAt: now,
      })
    }
  }

  return suggestions
}

function buildShortcutSuggestions(
  userId: string,
  profile: BehaviorProfile | null,
  nextAction: NextActionPrediction,
  context: string
): Suggestion[] {
  const suggestions: Suggestion[] = []
  const now = Date.now()

  if (nextAction.actionType === 'transaction_submit' || nextAction.actionType === 'transaction_build') {
    suggestions.push({
      id: generateId(),
      userId,
      category: 'shortcut',
      priority: 'critical',
      title: 'Quick Transaction Builder',
      description: 'Build and submit a transaction in one click',
      action: { type: 'quickAction', target: 'transaction_builder', metadata: {} },
      score: 0.9 + nextAction.probability * 0.05,
      expiresAt: now + 1800000,
      context,
      createdAt: now,
    })
  }

  if (nextAction.actionType === 'account_view' || nextAction.actionType === 'search') {
    const recentAccounts = profile?.topFeatures.filter(f => f.startsWith('account:') || f.startsWith('GA')) ?? []
    if (recentAccounts.length > 0) {
      suggestions.push({
        id: generateId(),
        userId,
        category: 'shortcut',
        priority: 'high',
        title: 'View Recent Account',
        description: `Continue where you left off with account ${recentAccounts[0].replace('account:', '')}`,
        action: { type: 'navigate', target: `/accounts/${recentAccounts[0].replace('account:', '')}`, metadata: {} },
        score: 0.75 + nextAction.confidence * 0.1,
        expiresAt: now + 1800000,
        context,
        createdAt: now,
      })
    }
  }

  return suggestions
}

export async function generateSuggestions(userId: string, context: string = 'default'): Promise<Suggestion[]> {
  const state = getState()
  if (!state.enabled) return []

  const profile = getProfile(userId)
  const intent = await predictIntent(userId, context)
  const nextAction = await predictNextAction(userId)

  let suggestions: Suggestion[] = []
  suggestions.push(...buildFeatureSuggestions(userId, profile, intent, context))
  suggestions.push(...buildShortcutSuggestions(userId, profile, nextAction, context))

  const contextScore = scoreBasedOnContext(profile, intent, nextAction, context)
  for (const suggestion of suggestions) {
    suggestion.score = suggestion.score * 0.6 + contextScore * 0.4
  }

  suggestions.sort((a, b) => b.score - a.score)
  suggestions = suggestions.filter(s => state.categories.includes(s.category))
  suggestions = suggestions.filter(s => s.score >= state.minScore)

  const cooldowns = _suggestionHistory.get(userId) ?? []
  const cooldownEnd = Date.now() - state.cooldownMinutes * 60000
  suggestions = suggestions.filter(s => {
    const existing = cooldowns.find(h => h.title === s.title)
    return !existing || existing.createdAt < cooldownEnd
  })

  suggestions = suggestions.slice(0, state.maxSuggestions)

  _suggestionHistory.set(userId, [
    ...suggestions,
    ...cooldowns,
  ].slice(-50))

  return suggestions
}

export function recordSuggestionFeedback(feedback: SuggestionFeedback): void {
  _feedbackLog.push(feedback)

  if (feedback.action === 'helpful') {
    recordPredictionFeedback({
      predictionId: feedback.suggestionId,
      userId: feedback.userId,
      actualAction: feedback.action,
      correct: true,
      timestamp: feedback.timestamp,
    })
  } else if (feedback.action === 'not_helpful') {
    recordPredictionFeedback({
      predictionId: feedback.suggestionId,
      userId: feedback.userId,
      actualAction: feedback.action,
      correct: false,
      timestamp: feedback.timestamp,
    })
  }
}

export function getSuggestionEffectiveness(userId: string): number {
  const userFeedback = _feedbackLog.filter(f => f.userId === userId)
  const actionable = userFeedback.filter(f => f.action === 'clicked' || f.action === 'helpful')
  const total = userFeedback.filter(f => f.action === 'shown' || f.action === 'clicked' || f.action === 'helpful' || f.action === 'not_helpful')
  return total.length > 0 ? actionable.length / total.length : 0
}

export function getSuggestionHistory(userId: string): Suggestion[] {
  return _suggestionHistory.get(userId) ?? []
}

export function getFeedbackLog(userId: string): SuggestionFeedback[] {
  return _feedbackLog.filter(f => f.userId === userId)
}

let _state: ProactiveSuggestionState = { ...DEFAULT_STATE }

export function getState(): ProactiveSuggestionState {
  return { ..._state }
}

export function updateState(partial: Partial<ProactiveSuggestionState>): ProactiveSuggestionState {
  _state = { ..._state, ...partial }
  return { ..._state }
}

export function resetState(): void {
  _state = { ...DEFAULT_STATE }
}

export function resetSuggestionState(): void {
  _suggestionHistory.clear()
  _feedbackLog.length = 0
}
