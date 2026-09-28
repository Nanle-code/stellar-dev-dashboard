import { getStoredValue, setStoredValue } from './storage'

export type InteractionType =
  | 'page_view'
  | 'feature_use'
  | 'navigation'
  | 'search'
  | 'transaction_submit'
  | 'transaction_build'
  | 'account_view'
  | 'network_switch'
  | 'export_data'
  | 'settings_change'
  | 'widget_interaction'
  | 'alert_click'
  | 'suggestion_click'
  | 'suggestion_dismiss'
  | 'feedback_given'

export interface InteractionEvent {
  id: string
  userId: string
  type: InteractionType
  target: string
  metadata: Record<string, unknown>
  timestamp: number
  sessionId: string
  duration: number
}

export interface FeatureUsageSummary {
  feature: string
  useCount: number
  lastUsed: number
  firstUsed: number
  avgSessionFrequency: number
  trend: 'increasing' | 'decreasing' | 'stable'
  totalDuration: number
}

export interface SessionSummary {
  sessionId: string
  startedAt: number
  endedAt: number
  duration: number
  eventCount: number
  featuresUsed: string[]
  pagesViewed: string[]
  userId: string
}

export interface InteractionPattern {
  pattern: string
  confidence: number
  frequency: number
  lastObserved: number
  sequence: InteractionType[]
}

export interface InteractionLogQuery {
  userId?: string
  type?: InteractionType
  since?: number
  until?: number
  target?: string
  sessionId?: string
  limit?: number
  offset?: number
}

const STORAGE_KEY = 'interaction-log'
const PATTERNS_KEY = 'interaction-patterns'
const MAX_LOG_ENTRIES = 5000
const PATTERN_MIN_OCCURRENCES = 3
const PATTERN_LOOKBACK_WINDOW = 7 * 24 * 60 * 60 * 1000

let _log: InteractionEvent[] = []
let _hydrated = false

async function hydrate(): Promise<void> {
  if (_hydrated || typeof window === 'undefined') return
  _hydrated = true
  try {
    const stored = await getStoredValue(STORAGE_KEY)
    if (Array.isArray(stored)) _log = stored.slice(-MAX_LOG_ENTRIES)
  } catch {
    _log = []
  }
}

async function persist(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    await setStoredValue(STORAGE_KEY, _log.slice(-MAX_LOG_ENTRIES))
  } catch {
    // best-effort
  }
}

let _sessionId: string | null = null
let _sessionStart: number = 0
let _sessionFeatures = new Set<string>()
let _sessionPages = new Set<string>()

export function startSession(userId: string): string {
  _sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  _sessionStart = Date.now()
  _sessionFeatures.clear()
  _sessionPages.clear()
  return _sessionId
}

export function getCurrentSessionId(): string | null {
  return _sessionId
}

export async function logInteraction(
  userId: string,
  type: InteractionType,
  target: string,
  metadata: Record<string, unknown> = {},
  duration: number = 0
): Promise<InteractionEvent> {
  await hydrate()

  if (!_sessionId) startSession(userId)

  const event: InteractionEvent = {
    id: `interaction-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId,
    type,
    target,
    metadata,
    timestamp: Date.now(),
    sessionId: _sessionId!,
    duration,
  }

  _log.push(event)

  if (type === 'feature_use' || type === 'widget_interaction') {
    _sessionFeatures.add(target)
  }
  if (type === 'page_view') {
    _sessionPages.add(target)
  }

  if (_log.length > MAX_LOG_ENTRIES) {
    _log = _log.slice(-MAX_LOG_ENTRIES)
  }

  await persist()
  return event
}

export async function endSession(): Promise<SessionSummary | null> {
  if (!_sessionId) return null

  const summary: SessionSummary = {
    sessionId: _sessionId,
    startedAt: _sessionStart,
    endedAt: Date.now(),
    duration: Date.now() - _sessionStart,
    eventCount: _log.filter(e => e.sessionId === _sessionId).length,
    featuresUsed: Array.from(_sessionFeatures),
    pagesViewed: Array.from(_sessionPages),
    userId: _log.find(e => e.sessionId === _sessionId)?.userId ?? '',
  }

  _sessionId = null
  _sessionStart = 0
  _sessionFeatures.clear()
  _sessionPages.clear()

  return summary
}

export async function queryLog(query: InteractionLogQuery): Promise<InteractionEvent[]> {
  await hydrate()
  let results = _log.slice()

  if (query.userId) results = results.filter(e => e.userId === query.userId)
  if (query.type) results = results.filter(e => e.type === query.type)
  if (query.target) results = results.filter(e => e.target === query.target)
  if (query.sessionId) results = results.filter(e => e.sessionId === query.sessionId)
  if (query.since) results = results.filter(e => e.timestamp >= query.since!)
  if (query.until) results = results.filter(e => e.timestamp <= query.until!)

  results.sort((a, b) => b.timestamp - a.timestamp)

  const offset = query.offset ?? 0
  const limit = query.limit ?? 100
  return results.slice(offset, offset + limit)
}

export async function getFeatureUsage(userId: string, since?: number): Promise<FeatureUsageSummary[]> {
  await hydrate()
  const events = _log.filter(e => {
    if (e.userId !== userId) return false
    if (since && e.timestamp < since) return false
    return e.type === 'feature_use' || e.type === 'widget_interaction'
  })

  const featureMap = new Map<string, { count: number; first: number; last: number; totalDuration: number; timestamps: number[] }>()

  for (const event of events) {
    const existing = featureMap.get(event.target) ?? {
      count: 0,
      first: event.timestamp,
      last: event.timestamp,
      totalDuration: 0,
      timestamps: [],
    }
    existing.count++
    existing.last = Math.max(existing.last, event.timestamp)
    existing.first = Math.min(existing.first, event.timestamp)
    existing.totalDuration += event.duration
    existing.timestamps.push(event.timestamp)
    featureMap.set(event.target, existing)
  }

  const halfWindow = PATTERN_LOOKBACK_WINDOW / 2
  const now = Date.now()

  return Array.from(featureMap.entries())
    .map(([feature, data]) => {
      const recent = data.timestamps.filter(t => t > now - halfWindow).length
      const older = data.timestamps.filter(t => t <= now - halfWindow && t > now - PATTERN_LOOKBACK_WINDOW).length
      const recentRate = recent / (halfWindow / 86400000)
      const olderRate = older / (halfWindow / 86400000)
      const trend: 'increasing' | 'decreasing' | 'stable' =
        recentRate > olderRate * 1.2 ? 'increasing'
        : recentRate < olderRate * 0.8 ? 'decreasing'
        : 'stable'

      const sessionCount = new Set(
        _log.filter(e => e.userId === userId && (e.type === 'feature_use' || e.type === 'widget_interaction')).map(e => e.sessionId)
      ).size

      return {
        feature,
        useCount: data.count,
        lastUsed: data.last,
        firstUsed: data.first,
        avgSessionFrequency: sessionCount > 0 ? data.count / sessionCount : 0,
        trend,
        totalDuration: data.totalDuration,
      }
    })
    .sort((a, b) => b.useCount - a.useCount)
}

export async function detectPatterns(userId: string): Promise<InteractionPattern[]> {
  await hydrate()
  const userEvents = _log
    .filter(e => e.userId === userId && e.timestamp > Date.now() - PATTERN_LOOKBACK_WINDOW)
    .sort((a, b) => a.timestamp - b.timestamp)

  const patterns: InteractionPattern[] = []

  const typeSequence = userEvents.map(e => e.type)
  const targetSequence = userEvents.map(e => e.target)

  const bigramMap = new Map<string, { count: number; lastObserved: number }>()
  for (let i = 0; i < typeSequence.length - 1; i++) {
    const key = `${typeSequence[i]}->${typeSequence[i + 1]}`
    const existing = bigramMap.get(key) ?? { count: 0, lastObserved: 0 }
    existing.count++
    existing.lastObserved = Math.max(existing.lastObserved, userEvents[i + 1].timestamp)
    bigramMap.set(key, existing)
  }

  for (const [pattern, data] of bigramMap) {
    if (data.count >= PATTERN_MIN_OCCURRENCES) {
      const [from, to] = pattern.split('->') as [InteractionType, InteractionType]
      patterns.push({
        pattern,
        confidence: Math.min(1, data.count / (typeSequence.length * 0.1)),
        frequency: data.count,
        lastObserved: data.lastObserved,
        sequence: [from, to],
      })
    }
  }

  const featurePairs = new Map<string, { count: number; lastObserved: number }>()
  for (let i = 0; i < targetSequence.length - 1; i++) {
    const key = `${targetSequence[i]}->${targetSequence[i + 1]}`
    const existing = featurePairs.get(key) ?? { count: 0, lastObserved: 0 }
    existing.count++
    existing.lastObserved = Math.max(existing.lastObserved, userEvents[i + 1].timestamp)
    featurePairs.set(key, existing)
  }

  for (const [pattern, data] of featurePairs) {
    if (data.count >= PATTERN_MIN_OCCURRENCES) {
      patterns.push({
        pattern: `feature:${pattern}`,
        confidence: Math.min(1, data.count / (targetSequence.length * 0.1)),
        frequency: data.count,
        lastObserved: data.lastObserved,
        sequence: ['feature_use' as InteractionType, 'feature_use' as InteractionType],
      })
    }
  }

  patterns.sort((a, b) => b.confidence - a.confidence)
  return patterns
}

export async function clearLog(): Promise<void> {
  _log = []
  await persist()
}

export async function clearUserData(userId: string): Promise<void> {
  await hydrate()
  _log = _log.filter(e => e.userId !== userId)
  await persist()
}

export function getLogStats(): { totalEvents: number; totalSessions: number; oldestEvent: number; newestEvent: number } {
  if (_log.length === 0) return { totalEvents: 0, totalSessions: 0, oldestEvent: 0, newestEvent: 0 }
  const sessions = new Set(_log.map(e => e.sessionId))
  return {
    totalEvents: _log.length,
    totalSessions: sessions.size,
    oldestEvent: _log.reduce((min, e) => Math.min(min, e.timestamp), Infinity),
    newestEvent: _log.reduce((max, e) => Math.max(max, e.timestamp), -Infinity),
  }
}
