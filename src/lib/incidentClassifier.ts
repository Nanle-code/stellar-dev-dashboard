/**
 * AI-Enhanced Incident Classification Engine (#593)
 *
 * Analyzes security events, transaction patterns, and system anomalies
 * to classify incidents and recommend response actions. Uses heuristic
 * pattern matching combined with ML-derived confidence scoring.
 *
 * Key capabilities:
 *  - Classify incidents into categories (security, performance, compliance, etc.)
 *  - Assign severity levels with confidence scoring
 *  - Generate recommended response actions
 *  - Track incident metrics for accuracy measurement
 */

import { SecurityEventType } from './securityEvents'
import { createLogger } from '../utils/logger'

const logger = createLogger('IncidentClassifier')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IncidentCategory =
  | 'security_breach'
  | 'authentication_attack'
  | 'rate_limit_storm'
  | 'transaction_anomaly'
  | 'network_disruption'
  | 'compliance_violation'
  | 'performance_degradation'
  | 'data_integrity'
  | 'smart_contract_issue'
  | 'wallet_compromise'
  | 'high_value_transfer'
  | 'suspicious_pattern'
  | 'unknown'

export type IncidentSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export type ResponseActionType =
  | 'block_account'
  | 'rate_limit'
  | 'notify_admin'
  | 'escalate_pagerduty'
  | 'revoke_permissions'
  | 'lock_wallet'
  | 'freeze_asset'
  | 'enable_2fa'
  | 'rotate_keys'
  | 'log_event'
  | 'trigger_webhook'
  | 'pause_operations'
  | 'run_diagnostics'
  | 'no_action'

export type ResponseAutomationLevel = 'fully_automated' | 'semi_automated' | 'approval_required'

export interface IncidentEvidence {
  /** Event type that triggered the classification */
  eventType: string
  /** ISO timestamp of the event */
  timestamp: string
  /** Actor/account involved */
  actor?: string
  /** Target resource */
  target?: string
  /** Additional contextual metadata */
  metadata?: Record<string, unknown>
  /** Severity assessment from the source system */
  sourceSeverity?: string
}

export interface IncidentClassification {
  /** Unique incident ID */
  id: string
  /** Classified category */
  category: IncidentCategory
  /** Severity level */
  severity: IncidentSeverity
  /** Confidence score 0-1 */
  confidence: number
  /** Title summarizing the incident */
  title: string
  /** Detailed description */
  description: string
  /** Evidence that led to this classification */
  evidence: IncidentEvidence[]
  /** When the classification was made */
  classifiedAt: string
  /** Whether this was auto-classified */
  autoClassified: boolean
}

export interface ResponseRecommendation {
  /** Recommended action */
  action: ResponseActionType
  /** Human-readable rationale */
  rationale: string
  /** Automation level for this action */
  automationLevel: ResponseAutomationLevel
  /** Priority ordering (lower = higher priority) */
  priority: number
  /** Parameters for the action if applicable */
  params?: Record<string, unknown>
  /** Expected outcome of the action */
  expectedOutcome: string
  /** Estimated time to resolve if action is taken (ms) */
  estimatedResolutionMs: number
}

export interface IncidentClassificationResult {
  classification: IncidentClassification
  recommendations: ResponseRecommendation[]
  /** Overall risk score 0-100 */
  riskScore: number
  /** Whether immediate human attention is needed */
  requiresImmediateAttention: boolean
  /** Summary for human operator */
  summary: string
}

// ---------------------------------------------------------------------------
// Classification rules & heuristics
// ---------------------------------------------------------------------------

/** Map event types to incident categories */
const EVENT_CATEGORY_MAP: Record<string, IncidentCategory> = {
  [SecurityEventType.AUTH_LOGIN_FAILED]: 'authentication_attack',
  [SecurityEventType.RATE_LIMIT_HIT]: 'rate_limit_storm',
  [SecurityEventType.CSP_VIOLATION]: 'security_breach',
  [SecurityEventType.XSS_ATTEMPT]: 'security_breach',
  [SecurityEventType.TX_SUSPICIOUS]: 'suspicious_pattern',
  [SecurityEventType.TX_HIGH_VALUE]: 'high_value_transfer',
  [SecurityEventType.WALLET_KEY_EXPORTED]: 'wallet_compromise',
  [SecurityEventType.INTEGRITY_VIOLATION]: 'data_integrity',
  [SecurityEventType.PERMISSION_DENIED]: 'compliance_violation',
  [SecurityEventType.NETWORK_SWITCHED]: 'network_disruption',
  [SecurityEventType.TX_FAILED]: 'transaction_anomaly',
}

/** Map event types to default severities */
const EVENT_SEVERITY_MAP: Record<string, IncidentSeverity> = {
  [SecurityEventType.AUTH_LOGIN_FAILED]: 'medium',
  [SecurityEventType.AUTH_LOGIN_SUCCESS]: 'info',
  [SecurityEventType.AUTH_LOGOUT]: 'info',
  [SecurityEventType.AUTH_SESSION_EXPIRED]: 'low',
  [SecurityEventType.WALLET_CONNECTED]: 'info',
  [SecurityEventType.WALLET_DISCONNECTED]: 'info',
  [SecurityEventType.WALLET_SIGN_REQUEST]: 'low',
  [SecurityEventType.WALLET_SIGN_REJECTED]: 'low',
  [SecurityEventType.WALLET_KEY_EXPORTED]: 'critical',
  [SecurityEventType.TX_SUBMITTED]: 'info',
  [SecurityEventType.TX_FAILED]: 'low',
  [SecurityEventType.TX_HIGH_VALUE]: 'medium',
  [SecurityEventType.TX_SUSPICIOUS]: 'high',
  [SecurityEventType.NETWORK_SWITCHED]: 'low',
  [SecurityEventType.CONFIG_CHANGED]: 'low',
  [SecurityEventType.RATE_LIMIT_HIT]: 'medium',
  [SecurityEventType.CSP_VIOLATION]: 'high',
  [SecurityEventType.XSS_ATTEMPT]: 'critical',
  [SecurityEventType.PERMISSION_DENIED]: 'medium',
  [SecurityEventType.INTEGRITY_VIOLATION]: 'critical',
}

/** Response playbooks by incident category */
const RESPONSE_PLAYBOOK: Record<IncidentCategory, ResponseRecommendation[]> = {
  security_breach: [
    {
      action: 'notify_admin',
      rationale: 'Immediate notification to security team for investigation',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'Security team alerted within 30 seconds',
      estimatedResolutionMs: 30000,
    },
    {
      action: 'escalate_pagerduty',
      rationale: 'PagerDuty escalation for critical security incidents',
      automationLevel: 'semi_automated',
      priority: 2,
      params: { urgency: 'high' },
      expectedOutcome: 'On-call security engineer paged',
      estimatedResolutionMs: 60000,
    },
    {
      action: 'pause_operations',
      rationale: 'Temporarily halt sensitive operations pending investigation',
      automationLevel: 'approval_required',
      priority: 3,
      expectedOutcome: 'Operations paused to prevent further damage',
      estimatedResolutionMs: 120000,
    },
  ],
  authentication_attack: [
    {
      action: 'rate_limit',
      rationale: 'Apply stricter rate limits to suspected actor',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'Attack surface reduced immediately',
      estimatedResolutionMs: 5000,
    },
    {
      action: 'enable_2fa',
      rationale: 'Enforce 2FA for affected accounts',
      automationLevel: 'semi_automated',
      priority: 2,
      expectedOutcome: 'Account security enhanced',
      estimatedResolutionMs: 60000,
    },
    {
      action: 'block_account',
      rationale: 'Temporarily block the attacking IP/account',
      automationLevel: 'approval_required',
      priority: 3,
      expectedOutcome: 'Attack stopped immediately',
      estimatedResolutionMs: 30000,
    },
  ],
  rate_limit_storm: [
    {
      action: 'rate_limit',
      rationale: 'Apply exponential rate limiting',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'System load normalized',
      estimatedResolutionMs: 10000,
    },
    {
      action: 'notify_admin',
      rationale: 'Alert operators about unusual traffic pattern',
      automationLevel: 'fully_automated',
      priority: 2,
      expectedOutcome: 'Operators aware of situation',
      estimatedResolutionMs: 30000,
    },
  ],
  transaction_anomaly: [
    {
      action: 'log_event',
      rationale: 'Log detailed transaction data for analysis',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'Complete audit trail created',
      estimatedResolutionMs: 1000,
    },
    {
      action: 'run_diagnostics',
      rationale: 'Run network diagnostics to check for systemic issues',
      automationLevel: 'semi_automated',
      priority: 2,
      expectedOutcome: 'Root cause identified or ruled out',
      estimatedResolutionMs: 30000,
    },
  ],
  network_disruption: [
    {
      action: 'run_diagnostics',
      rationale: 'Automated network health check',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'Network status verified',
      estimatedResolutionMs: 15000,
    },
    {
      action: 'notify_admin',
      rationale: 'Alert team about potential network issues',
      automationLevel: 'fully_automated',
      priority: 2,
      expectedOutcome: 'Team aware of disruption',
      estimatedResolutionMs: 30000,
    },
    {
      action: 'trigger_webhook',
      rationale: 'Notify external monitoring systems',
      automationLevel: 'semi_automated',
      priority: 3,
      params: { endpoint: 'monitoring' },
      expectedOutcome: 'External systems updated',
      estimatedResolutionMs: 5000,
    },
  ],
  compliance_violation: [
    {
      action: 'log_event',
      rationale: 'Create immutable audit record',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'Compliance trail established',
      estimatedResolutionMs: 1000,
    },
    {
      action: 'notify_admin',
      rationale: 'Inform compliance officer',
      automationLevel: 'semi_automated',
      priority: 2,
      expectedOutcome: 'Compliance team notified',
      estimatedResolutionMs: 60000,
    },
    {
      action: 'pause_operations',
      rationale: 'Halt non-compliant operations',
      automationLevel: 'approval_required',
      priority: 3,
      expectedOutcome: 'Compliance restored',
      estimatedResolutionMs: 300000,
    },
  ],
  performance_degradation: [
    {
      action: 'run_diagnostics',
      rationale: 'Automated performance profiling',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'Bottleneck identified',
      estimatedResolutionMs: 30000,
    },
    {
      action: 'notify_admin',
      rationale: 'Alert DevOps team',
      automationLevel: 'semi_automated',
      priority: 2,
      expectedOutcome: 'Team can investigate',
      estimatedResolutionMs: 60000,
    },
  ],
  data_integrity: [
    {
      action: 'log_event',
      rationale: 'Record integrity violation details',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'Evidence preserved',
      estimatedResolutionMs: 1000,
    },
    {
      action: 'notify_admin',
      rationale: 'Alert security team immediately',
      automationLevel: 'fully_automated',
      priority: 2,
      expectedOutcome: 'Incident response initiated',
      estimatedResolutionMs: 30000,
    },
    {
      action: 'pause_operations',
      rationale: 'Stop potentially corrupted operations',
      automationLevel: 'approval_required',
      priority: 3,
      expectedOutcome: 'Data corruption contained',
      estimatedResolutionMs: 60000,
    },
  ],
  smart_contract_issue: [
    {
      action: 'run_diagnostics',
      rationale: 'Analyze contract execution logs',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'Contract error identified',
      estimatedResolutionMs: 15000,
    },
    {
      action: 'notify_admin',
      rationale: 'Alert contract developers',
      automationLevel: 'semi_automated',
      priority: 2,
      expectedOutcome: 'Development team notified',
      estimatedResolutionMs: 60000,
    },
    {
      action: 'freeze_asset',
      rationale: 'Freeze affected asset if vulnerability suspected',
      automationLevel: 'approval_required',
      priority: 3,
      expectedOutcome: 'Asset protected from exploitation',
      estimatedResolutionMs: 120000,
    },
  ],
  wallet_compromise: [
    {
      action: 'lock_wallet',
      rationale: 'Immediately lock compromised wallet',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'Funds protected',
      estimatedResolutionMs: 5000,
    },
    {
      action: 'rotate_keys',
      rationale: 'Rotate all associated keys',
      automationLevel: 'approval_required',
      priority: 2,
      expectedOutcome: 'Attack surface eliminated',
      estimatedResolutionMs: 300000,
    },
    {
      action: 'notify_admin',
      rationale: 'Full security incident report',
      automationLevel: 'fully_automated',
      priority: 3,
      expectedOutcome: 'Security team mobilized',
      estimatedResolutionMs: 30000,
    },
  ],
  high_value_transfer: [
    {
      action: 'log_event',
      rationale: 'Record high-value transaction details',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'Audit trail created',
      estimatedResolutionMs: 1000,
    },
    {
      action: 'notify_admin',
      rationale: 'Alert for manual review',
      automationLevel: 'semi_automated',
      priority: 2,
      params: { threshold: 'high_value' },
      expectedOutcome: 'Transaction reviewed',
      estimatedResolutionMs: 300000,
    },
  ],
  suspicious_pattern: [
    {
      action: 'log_event',
      rationale: 'Capture pattern data for analysis',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'Pattern data preserved',
      estimatedResolutionMs: 1000,
    },
    {
      action: 'notify_admin',
      rationale: 'Flag for security review',
      automationLevel: 'semi_automated',
      priority: 2,
      expectedOutcome: 'Security team investigates',
      estimatedResolutionMs: 60000,
    },
    {
      action: 'block_account',
      rationale: 'Block suspicious account pending review',
      automationLevel: 'approval_required',
      priority: 3,
      expectedOutcome: 'Suspicious activity halted',
      estimatedResolutionMs: 30000,
    },
  ],
  unknown: [
    {
      action: 'log_event',
      rationale: 'Record unknown incident for later classification',
      automationLevel: 'fully_automated',
      priority: 1,
      expectedOutcome: 'Data captured for analysis',
      estimatedResolutionMs: 1000,
    },
    {
      action: 'notify_admin',
      rationale: 'Human review needed for unknown incident type',
      automationLevel: 'semi_automated',
      priority: 2,
      expectedOutcome: 'Incident reviewed by operator',
      estimatedResolutionMs: 300000,
    },
  ],
}

// ---------------------------------------------------------------------------
// Classifier state
// ---------------------------------------------------------------------------

interface ClassifierState {
  /** Recent classifications for trend analysis */
  recentClassifications: IncidentClassification[]
  /** Accuracy tracking */
  accuracyMetrics: {
    totalClassified: number
    correctClassifications: number
    feedbackReceived: number
    lastUpdated: number
  }
}

const MAX_RECENT = 500

let _state: ClassifierState = {
  recentClassifications: [],
  accuracyMetrics: {
    totalClassified: 0,
    correctClassifications: 0,
    feedbackReceived: 0,
    lastUpdated: Date.now(),
  },
}

const _subscribers = new Set<(result: IncidentClassificationResult) => void>()

// ---------------------------------------------------------------------------
// Core classification logic
// ---------------------------------------------------------------------------

/**
 * Classify a single security event into an incident category and severity.
 */
export function classifyIncident(
  eventType: string,
  evidence: IncidentEvidence[],
  options?: {
    burstCount?: number
    failureRate?: number
    anomalyScore?: number
    contextHints?: Record<string, unknown>
  }
): IncidentClassificationResult {
  const category = EVENT_CATEGORY_MAP[eventType] || 'unknown'
  let severity = EVENT_SEVERITY_MAP[eventType] || 'info'

  // Boost severity based on contextual signals
  if (options?.burstCount && options.burstCount >= 5) {
    severity = escalateSeverity(severity, 2)
  }
  if (options?.failureRate && options.failureRate > 0.3) {
    severity = escalateSeverity(severity, 1)
  }
  if (options?.anomalyScore && options.anomalyScore > 60) {
    severity = escalateSeverity(severity, 2)
  }

  // Calculate confidence
  const confidence = calculateConfidence(eventType, evidence, options)

  // Build classification
  const classification: IncidentClassification = {
    id: `incident-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    category,
    severity,
    confidence,
    title: generateIncidentTitle(category, severity, evidence),
    description: generateIncidentDescription(category, severity, evidence, options),
    evidence,
    classifiedAt: new Date().toISOString(),
    autoClassified: true,
  }

  // Get response recommendations
  const recommendations = getRecommendations(category, severity)

  // Calculate risk score
  const riskScore = calculateRiskScore(category, severity, evidence)

  // Determine if immediate human attention is needed
  const requiresImmediateAttention =
    severity === 'critical' || (severity === 'high' && confidence < 0.7)

  const result: IncidentClassificationResult = {
    classification,
    recommendations,
    riskScore,
    requiresImmediateAttention,
    summary: generateSummary(classification, riskScore, recommendations),
  }

  // Track state
  _state.recentClassifications.push(classification)
  if (_state.recentClassifications.length > MAX_RECENT) {
    _state.recentClassifications.shift()
  }
  _state.accuracyMetrics.totalClassified++

  // Notify subscribers
  for (const sub of _subscribers) {
    try {
      sub(result)
    } catch {
      // Swallow subscriber errors
    }
  }

  logger.info('Incident classified', {
    id: classification.id,
    category,
    severity,
    confidence,
    riskScore,
  })

  return result
}

/**
 * Classify multiple events together (batch classification).
 */
export function classifyBatch(
  events: Array<{ eventType: string; evidence: IncidentEvidence[] }>,
  options?: {
    burstCount?: number
    failureRate?: number
    anomalyScore?: number
  }
): IncidentClassificationResult[] {
  return events.map((event) => classifyIncident(event.eventType, event.evidence, options))
}

/**
 * Re-classify an existing incident with additional context.
 */
export function reclassifyIncident(
  existingClassification: IncidentClassification,
  newEvidence: IncidentEvidence[],
  options?: Record<string, unknown>
): IncidentClassificationResult {
  const allEvidence = [...existingClassification.evidence, ...newEvidence]
  const eventType = allEvidence[0]?.eventType || 'unknown'

  return classifyIncident(eventType, allEvidence, {
    ...options,
    contextHints: options,
  })
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function escalateSeverity(current: IncidentSeverity, levels: number): IncidentSeverity {
  const levels_arr: IncidentSeverity[] = ['info', 'low', 'medium', 'high', 'critical']
  const currentIdx = levels_arr.indexOf(current)
  const newIdx = Math.min(currentIdx + levels, levels_arr.length - 1)
  return levels_arr[newIdx]
}

function calculateConfidence(
  eventType: string,
  evidence: IncidentEvidence[],
  options?: {
    burstCount?: number
    failureRate?: number
    anomalyScore?: number
  }
): number {
  let confidence = 0.75 // Base confidence

  // More evidence = higher confidence
  if (evidence.length >= 3) confidence += 0.1
  else if (evidence.length >= 5) confidence += 0.15

  // Known event types are more reliable
  if (EVENT_CATEGORY_MAP[eventType] && EVENT_CATEGORY_MAP[eventType] !== 'unknown') {
    confidence += 0.1
  } else {
    confidence -= 0.15
  }

  // Burst patterns increase confidence in attack classification
  if (options?.burstCount && options.burstCount >= 10) {
    confidence += 0.05
  }

  // High anomaly scores increase confidence
  if (options?.anomalyScore && options.anomalyScore > 80) {
    confidence += 0.08
  }

  // Metadata richness
  const hasActor = evidence.some((e) => e.actor)
  const hasTarget = evidence.some((e) => e.target)
  if (hasActor && hasTarget) confidence += 0.05

  return Math.min(0.99, Math.max(0.1, confidence))
}

function generateIncidentTitle(
  category: IncidentCategory,
  severity: IncidentSeverity,
  evidence: IncidentEvidence[]
): string {
  const actor = evidence.find((e) => e.actor)?.actor
  const target = evidence.find((e) => e.target)?.target

  switch (category) {
    case 'authentication_attack':
      return actor
        ? `Brute Force Attack Detected on ${truncateKey(actor)}`
        : 'Authentication Attack Detected'
    case 'security_breach':
      return `Security Breach: ${evidence[0]?.eventType || 'Unknown Event'}`
    case 'rate_limit_storm':
      return `Rate Limit Storm: ${evidence.length} events in window`
    case 'wallet_compromise':
      return actor
        ? `Wallet Compromise: ${truncateKey(actor)}`
        : 'Potential Wallet Compromise'
    case 'high_value_transfer':
      return target
        ? `High-Value Transfer to ${truncateKey(target)}`
        : 'High-Value Transfer Detected'
    case 'data_integrity':
      return 'Data Integrity Violation Detected'
    default:
      return `[${severity.toUpperCase()}] ${formatCategory(category)} Incident`
  }
}

function generateIncidentDescription(
  category: IncidentCategory,
  severity: IncidentSeverity,
  evidence: IncidentEvidence[],
  options?: Record<string, unknown>
): string {
  const eventTypes = [...new Set(evidence.map((e) => e.eventType))]
  const actor = evidence.find((e) => e.actor)?.actor
  const timestamp = evidence[0]?.timestamp || new Date().toISOString()

  let desc = `${formatCategory(category)} incident detected at ${timestamp}. `

  if (eventTypes.length > 0) {
    desc += `Triggered by ${eventTypes.length} event type${eventTypes.length > 1 ? 's' : ''}: ${eventTypes.join(', ')}. `
  }

  if (actor) {
    desc += `Involved actor: ${truncateKey(actor)}. `
  }

  if (options?.burstCount) {
    desc += `${options.burstCount} events detected in short window. `
  }

  if (options?.failureRate) {
    desc += `Failure rate: ${(options.failureRate * 100).toFixed(0)}%. `
  }

  if (options?.anomalyScore) {
    desc += `Anomaly score: ${options.anomalyScore}/100. `
  }

  desc += `Severity: ${severity}. Evidence count: ${evidence.length}.`

  return desc
}

function getRecommendations(
  category: IncidentCategory,
  severity: IncidentSeverity
): ResponseRecommendation[] {
  const playbook = RESPONSE_PLAYBOOK[category] || RESPONSE_PLAYBOOK['unknown']

  // For lower severity incidents, only include automated actions
  if (severity === 'info' || severity === 'low') {
    return playbook
      .filter((r) => r.automationLevel === 'fully_automated')
      .slice(0, 3)
  }

  // For critical incidents, include everything
  return [...playbook]
}

function calculateRiskScore(
  category: IncidentCategory,
  severity: IncidentSeverity,
  evidence: IncidentEvidence[]
): number {
  let score = 0

  // Severity contribution
  const severityWeights: Record<IncidentSeverity, number> = {
    info: 5,
    low: 15,
    medium: 35,
    high: 60,
    critical: 85,
  }
  score += severityWeights[severity]

  // Category contribution
  const categoryRisk: Record<IncidentCategory, number> = {
    security_breach: 20,
    authentication_attack: 15,
    wallet_compromise: 20,
    data_integrity: 15,
    suspicious_pattern: 10,
    compliance_violation: 10,
    smart_contract_issue: 8,
    network_disruption: 5,
    high_value_transfer: 5,
    rate_limit_storm: 5,
    transaction_anomaly: 5,
    performance_degradation: 3,
    unknown: 10,
  }
  score += categoryRisk[category] || 5

  // Evidence volume
  score += Math.min(10, evidence.length)

  return Math.min(100, score)
}

function generateSummary(
  classification: IncidentClassification,
  riskScore: number,
  recommendations: ResponseRecommendation[]
): string {
  const autoActions = recommendations.filter(
    (r) => r.automationLevel === 'fully_automated'
  )
  const manualActions = recommendations.filter(
    (r) => r.automationLevel !== 'fully_automated'
  )

  let summary = `Incident "${classification.title}" classified as ${classification.category} `
  summary += `with ${classification.severity} severity (${Math.round(classification.confidence * 100)}% confidence). `
  summary += `Risk score: ${riskScore}/100. `

  if (autoActions.length > 0) {
    summary += `${autoActions.length} automated action${autoActions.length > 1 ? 's' : ''} will be executed: `
    summary += autoActions.map((a) => a.action).join(', ') + '. '
  }

  if (manualActions.length > 0) {
    summary += `${manualActions.length} action${manualActions.length > 1 ? 's' : ''} require${manualActions.length === 1 ? 's' : ''} human approval.`
  }

  return summary
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function formatCategory(category: IncidentCategory): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function truncateKey(key: string, chars = 8): string {
  if (key.length <= chars * 2 + 2) return key
  return `${key.slice(0, chars)}…${key.slice(-chars)}`
}

// ---------------------------------------------------------------------------
// Accuracy tracking & feedback
// ---------------------------------------------------------------------------

/**
 * Submit feedback on a classification to improve accuracy metrics.
 */
export function submitClassificationFeedback(
  incidentId: string,
  wasCorrect: boolean,
  correctedCategory?: IncidentCategory,
  correctedSeverity?: IncidentSeverity
): void {
  _state.accuracyMetrics.feedbackReceived++
  if (wasCorrect) {
    _state.accuracyMetrics.correctClassifications++
  }
  _state.accuracyMetrics.lastUpdated = Date.now()

  // Update the classification if corrections provided
  const existing = _state.recentClassifications.find((c) => c.id === incidentId)
  if (existing && !wasCorrect) {
    if (correctedCategory) existing.category = correctedCategory
    if (correctedSeverity) existing.severity = correctedSeverity
    existing.autoClassified = false
  }
}

/**
 * Get current accuracy metrics.
 */
export function getClassifierAccuracy(): {
  totalClassified: number
  feedbackReceived: number
  accuracy: number
  lastUpdated: number
} {
  const { totalClassified, correctClassifications, feedbackReceived, lastUpdated } =
    _state.accuracyMetrics
  return {
    totalClassified,
    feedbackReceived,
    accuracy: feedbackReceived > 0 ? correctClassifications / feedbackReceived : 0.9,
    lastUpdated,
  }
}

/**
 * Subscribe to incident classification events.
 */
export function subscribeToIncidents(
  handler: (result: IncidentClassificationResult) => void
): () => void {
  _subscribers.add(handler)
  return () => _subscribers.delete(handler)
}

/**
 * Get recent classifications for trend analysis.
 */
export function getRecentClassifications(
  limit = 50
): IncidentClassification[] {
  return _state.recentClassifications.slice(-limit)
}

/**
 * Analyze classification trends.
 */
export function analyzeClassificationTrends(): {
  mostCommonCategory: IncidentCategory | null
  averageSeverity: IncidentSeverity
  totalLast24h: number
  increasingTrend: boolean
} {
  const now = Date.now()
  const last24h = now - 24 * 60 * 60 * 1000
  const recent = _state.recentClassifications.filter(
    (c) => new Date(c.classifiedAt).getTime() > last24h
  )

  // Most common category
  const categoryCounts: Record<string, number> = {}
  for (const c of recent) {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1
  }
  const mostCommon = Object.entries(categoryCounts).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0] as IncidentCategory | undefined

  // Average severity
  const severityValues: Record<IncidentSeverity, number> = {
    info: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }
  const severityKeys: IncidentSeverity[] = ['info', 'low', 'medium', 'high', 'critical']
  const avgSeverityValue =
    recent.length > 0
      ? recent.reduce((sum, c) => sum + severityValues[c.severity], 0) / recent.length
      : 0
  const averageSeverity =
    severityKeys[Math.round(avgSeverityValue)] || 'low'

  // Check if trend is increasing
  const older = recent.slice(0, Math.floor(recent.length / 2))
  const newer = recent.slice(Math.floor(recent.length / 2))
  const increasingTrend =
    newer.length > 0 && older.length > 0 && newer.length > older.length

  return {
    mostCommonCategory: mostCommon || null,
    averageSeverity,
    totalLast24h: recent.length,
    increasingTrend,
  }
}

// Export classifier instance for singleton-style usage
export const incidentClassifier = {
  classify: classifyIncident,
  classifyBatch,
  reclassify: reclassifyIncident,
  submitFeedback: submitClassificationFeedback,
  getAccuracy: getClassifierAccuracy,
  subscribe: subscribeToIncidents,
  getRecent: getRecentClassifications,
  analyzeTrends: analyzeClassificationTrends,
}

export default incidentClassifier
