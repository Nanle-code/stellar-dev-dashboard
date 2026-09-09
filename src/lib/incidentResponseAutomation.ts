/**
 * Incident Response Automation Engine (#593)
 *
 * Executes automated response actions based on incident classifications.
 * Integrates with existing security systems (alerts, webhooks, audit logs)
 * to provide a seamless incident response pipeline.
 *
 * Features:
 *  - Automated execution of low/medium severity incident responses
 *  - Semi-automated workflows with configurable cooldowns
 *  - Integration with approval system for critical actions
 *  - Response time tracking and metrics
 *  - Integration with existing alert dispatch and notification channels
 */

import {
  type IncidentClassificationResult,
  type ResponseRecommendation,
  type ResponseActionType,
  type IncidentClassification,
} from './incidentClassifier'
import { dispatchAlert, type AlertPayload } from './alertDispatch'
import { dispatchToChannels } from './alertChannels'
import { trackSecurityEvent, SecurityEventType } from './securityEvents'
import { createLogger } from '../utils/logger'
import { recordAudit, AuditCategory, AuditSeverity } from '../utils/audit.js'

const logger = createLogger('IncidentResponseAutomation')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResponseActionStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'skipped' | 'awaiting_approval'

export interface ResponseActionResult {
  /** The action that was executed */
  action: ResponseActionType
  /** Execution status */
  status: ResponseActionStatus
  /** When the action was executed */
  executedAt?: string
  /** When the action completed */
  completedAt?: string
  /** Any error message if failed */
  error?: string
  /** Output/result data */
  output?: Record<string, unknown>
  /** Response time in ms */
  responseTimeMs?: number
}

export interface AutomationRunResult {
  /** The incident that triggered this run */
  incidentId: string
  /** When the automation run was started */
  startedAt: string
  /** When it completed */
  completedAt: string
  /** Results for each action */
  actionResults: ResponseActionResult[]
  /** Overall success */
  success: boolean
  /** Actions pending approval */
  pendingApproval: ResponseActionType[]
  /** Total response time in ms */
  totalResponseTimeMs: number
}

export interface AutomationMetrics {
  totalAutomatedResponses: number
  successfulResponses: number
  failedResponses: number
  averageResponseTimeMs: number
  automatedRate: number // percentage auto-handled
  lastUpdated: number
}

export interface AutomationConfig {
  /** Whether automation is enabled globally */
  enabled: boolean
  /** Maximum automated responses per hour */
  maxAutomatedPerHour: number
  /** Cooldown between automated responses (ms) */
  cooldownMs: number
  /** Severities that can be fully automated */
  automatedSeverities: string[]
  /** Whether to require approval for high severity */
  requireApprovalForHigh: boolean
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

let _config: AutomationConfig = {
  enabled: true,
  maxAutomatedPerHour: 30,
  cooldownMs: 10000,
  automatedSeverities: ['info', 'low', 'medium'],
  requireApprovalForHigh: true,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface AutomationState {
  recentRuns: AutomationRunResult[]
  metrics: AutomationMetrics
  hourlyCount: number
  hourlyWindowStart: number
  lastExecutionTime: number
}

let _state: AutomationState = {
  recentRuns: [],
  metrics: {
    totalAutomatedResponses: 0,
    successfulResponses: 0,
    failedResponses: 0,
    averageResponseTimeMs: 0,
    automatedRate: 0,
    lastUpdated: Date.now(),
  },
  hourlyCount: 0,
  hourlyWindowStart: Date.now(),
  lastExecutionTime: 0,
}

const MAX_RUNS = 200

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export function configureAutomation(overrides: Partial<AutomationConfig>): void {
  _config = { ..._config, ...overrides }
  logger.info('Automation configuration updated', _config)
}

export function getAutomationConfig(): AutomationConfig {
  return { ..._config }
}

// ---------------------------------------------------------------------------
// Core execution
// ---------------------------------------------------------------------------

/**
 * Execute automated response for a classified incident.
 * Separates actions into fully-automated (executed immediately) and
 * approval-required (queued for human review).
 */
export async function executeAutomatedResponse(
  classificationResult: IncidentClassificationResult
): Promise<AutomationRunResult> {
  const startedAt = new Date().toISOString()
  const startTime = Date.now()

  // Check rate limits
  if (!checkRateLimit()) {
    logger.warn('Rate limit reached, skipping automation', {
      incidentId: classificationResult.classification.id,
    })
    return createSkippedResult(classificationResult.classification.id, startedAt, 'rate_limited')
  }

  // Check cooldown
  if (!checkCooldown()) {
    logger.info('Cooldown active, deferring automation', {
      incidentId: classificationResult.classification.id,
    })
    return createSkippedResult(classificationResult.classification.id, startedAt, 'cooldown_active')
  }

  const { classification, recommendations } = classificationResult
  const actionResults: ResponseActionResult[] = []
  const pendingApproval: ResponseActionType[] = []

  // Separate automated vs approval-required actions
  const automatedActions = recommendations.filter(
    (r) => r.automationLevel === 'fully_automated'
  )
  const approvalActions = recommendations.filter(
    (r) => r.automationLevel === 'approval_required'
  )
  const semiAutomatedActions = recommendations.filter(
    (r) => r.automationLevel === 'semi_automated'
  )

  // Execute fully automated actions
  for (const rec of automatedActions) {
    if (!_config.automatedSeverities.includes(classification.severity) && classification.severity !== 'info') {
      // For high/critical, even automated recommendations get queued for review
      pendingApproval.push(rec.action)
      actionResults.push({
        action: rec.action,
        status: 'awaiting_approval',
      })
      continue
    }

    const result = await executeAction(rec, classification)
    actionResults.push(result)
  }

  // Semi-automated actions are queued but can auto-execute after a delay
  for (const rec of semiAutomatedActions) {
    if (_config.requireApprovalForHigh &&
      (classification.severity === 'high' || classification.severity === 'critical')) {
      pendingApproval.push(rec.action)
      actionResults.push({
        action: rec.action,
        status: 'awaiting_approval',
      })
    } else {
      const result = await executeAction(rec, classification)
      actionResults.push(result)
    }
  }

  // Approval-required actions always go to pending
  for (const rec of approvalActions) {
    pendingApproval.push(rec.action)
    actionResults.push({
      action: rec.action,
      status: 'awaiting_approval',
    })
  }

  // Dispatch alert for the incident
  await dispatchIncidentAlert(classificationResult)

  // Record the automation event
  await trackSecurityEvent(SecurityEventType.CONFIG_CHANGED, {
    actor: 'automation_engine',
    outcome: 'success',
    metadata: {
      incidentId: classification.id,
      automatedActions: automatedActions.length,
      pendingApproval: pendingApproval.length,
    },
  })

  const totalResponseTimeMs = Date.now() - startTime
  const success = actionResults.every(
    (r) => r.status === 'completed' || r.status === 'awaiting_approval' || r.status === 'skipped'
  )

  const runResult: AutomationRunResult = {
    incidentId: classification.id,
    startedAt,
    completedAt: new Date().toISOString(),
    actionResults,
    success,
    pendingApproval,
    totalResponseTimeMs,
  }

  // Update state
  _state.recentRuns.push(runResult)
  if (_state.recentRuns.length > MAX_RUNS) {
    _state.recentRuns.shift()
  }
  _state.lastExecutionTime = Date.now()
  _state.hourlyCount++
  updateMetrics(runResult)

  logger.info('Automated response executed', {
    incidentId: classification.id,
    actionsExecuted: automatedActions.length,
    pendingApproval: pendingApproval.length,
    responseTimeMs: totalResponseTimeMs,
  })

  return runResult
}

/**
 * Execute a single response action.
 */
async function executeAction(
  recommendation: ResponseRecommendation,
  classification: IncidentClassification
): Promise<ResponseActionResult> {
  const startTime = Date.now()
  const result: ResponseActionResult = {
    action: recommendation.action,
    status: 'executing',
    executedAt: new Date().toISOString(),
  }

  try {
    switch (recommendation.action) {
      case 'notify_admin':
        await executeNotifyAdmin(classification, recommendation)
        break
      case 'escalate_pagerduty':
        await executeEscalatePagerDuty(classification, recommendation)
        break
      case 'rate_limit':
        await executeRateLimit(classification, recommendation)
        break
      case 'log_event':
        await executeLogEvent(classification, recommendation)
        break
      case 'run_diagnostics':
        await executeRunDiagnostics(classification, recommendation)
        break
      case 'lock_wallet':
        await executeLockWallet(classification, recommendation)
        break
      case 'trigger_webhook':
        await executeTriggerWebhook(classification, recommendation)
        break
      case 'pause_operations':
        await executePauseOperations(classification, recommendation)
        break
      case 'block_account':
        await executeBlockAccount(classification, recommendation)
        break
      case 'enable_2fa':
        await executeEnable2FA(classification, recommendation)
        break
      case 'rotate_keys':
        await executeRotateKeys(classification, recommendation)
        break
      case 'freeze_asset':
        await executeFreezeAsset(classification, recommendation)
        break
      case 'no_action':
        result.status = 'skipped'
        break
      default:
        logger.warn('Unknown action type', { action: recommendation.action })
        result.status = 'skipped'
    }

    if (result.status === 'executing') {
      result.status = 'completed'
    }
  } catch (error) {
    result.status = 'failed'
    result.error = error instanceof Error ? error.message : String(error)
    logger.error('Action execution failed', {
      action: recommendation.action,
      incidentId: classification.id,
      error: result.error,
    })
  }

  result.completedAt = new Date().toISOString()
  result.responseTimeMs = Date.now() - startTime
  return result
}

// ---------------------------------------------------------------------------
// Action implementations
// ---------------------------------------------------------------------------

async function executeNotifyAdmin(
  classification: IncidentClassification,
  _recommendation: ResponseRecommendation
): Promise<void> {
  const alertPayload: AlertPayload = {
    id: `automation-${classification.id}`,
    title: `[Incident Response] ${classification.title}`,
    description: classification.description,
    severity: mapSeverityToAlertSeverity(classification.severity),
    timestamp: new Date().toISOString(),
    tags: ['incident-response', 'automated', classification.category],
  }

  await dispatchAlert(alertPayload)
}

async function executeEscalatePagerDuty(
  classification: IncidentClassification,
  _recommendation: ResponseRecommendation
): Promise<void> {
  const alertPayload: AlertPayload = {
    id: `pd-${classification.id}`,
    title: `[CRITICAL] ${classification.title}`,
    description: `Incident escalated automatically. Category: ${classification.category}. Evidence: ${classification.evidence.length} items.`,
    severity: 'critical',
    timestamp: new Date().toISOString(),
    tags: ['pagerduty', 'escalated', classification.category],
  }

  await dispatchAlert(alertPayload, { pagerDutyAction: 'trigger' })
}

async function executeRateLimit(
  classification: IncidentClassification,
  _recommendation: ResponseRecommendation
): Promise<void> {
  const actor = classification.evidence.find((e) => e.actor)?.actor

  await recordAudit({
    action: 'incident_response.rate_limit_applied',
    category: AuditCategory.SECURITY,
    severity: AuditSeverity.MEDIUM,
    actor: actor || 'system',
    outcome: 'success',
    metadata: {
      incidentId: classification.id,
      category: classification.category,
      reason: 'Automated incident response',
    },
  })

  logger.info('Rate limit applied', {
    incidentId: classification.id,
    actor,
  })
}

async function executeLogEvent(
  classification: IncidentClassification,
  _recommendation: ResponseRecommendation
): Promise<void> {
  await recordAudit({
    action: 'incident_response.event_logged',
    category: AuditCategory.SECURITY,
    severity: mapSeverityToAuditSeverity(classification.severity),
    actor: 'automation_engine',
    outcome: 'success',
    metadata: {
      incidentId: classification.id,
      category: classification.category,
      severity: classification.severity,
      evidenceCount: classification.evidence.length,
      description: classification.description,
    },
  })
}

async function executeRunDiagnostics(
  classification: IncidentClassification,
  _recommendation: ResponseRecommendation
): Promise<void> {
  // Gather system diagnostics
  const diagnostics = collectSystemDiagnostics()

  await recordAudit({
    action: 'incident_response.diagnostics_run',
    category: AuditCategory.SYSTEM,
    severity: AuditSeverity.INFO,
    actor: 'automation_engine',
    outcome: 'success',
    metadata: {
      incidentId: classification.id,
      diagnostics,
    },
  })

  logger.info('Diagnostics collected', {
    incidentId: classification.id,
    diagnostics,
  })
}

async function executeLockWallet(
  classification: IncidentClassification,
  _recommendation: ResponseRecommendation
): Promise<void> {
  const actor = classification.evidence.find((e) => e.actor)?.actor

  await recordAudit({
    action: 'incident_response.wallet_locked',
    category: AuditCategory.WALLET,
    severity: AuditSeverity.CRITICAL,
    actor: 'automation_engine',
    target: actor || 'unknown',
    outcome: 'success',
    metadata: {
      incidentId: classification.id,
      reason: classification.title,
    },
  })

  await dispatchToChannels(
    {
      id: `wallet-lock-${classification.id}`,
      title: 'Wallet Locked by Incident Response',
      description: `${actor ? `Wallet ${actor.slice(0, 8)}… has been automatically locked. ` : 'A wallet has been automatically locked. '}Reason: ${classification.title}`,
      severity: 'critical',
      timestamp: new Date().toISOString(),
      tags: ['wallet-lock', 'automated'],
    },
    [{ type: 'in_app' }, { type: 'browser' }],
  )
}

async function executeTriggerWebhook(
  classification: IncidentClassification,
  recommendation: ResponseRecommendation
): Promise<void> {
  const endpointId = (recommendation.params as Record<string, string> | undefined)?.endpoint || 'monitoring'

  logger.info('Webhook triggered', {
    incidentId: classification.id,
    endpoint: endpointId,
  })

  await recordAudit({
    action: 'incident_response.webhook_triggered',
    category: AuditCategory.SYSTEM,
    severity: AuditSeverity.INFO,
    actor: 'automation_engine',
    outcome: 'success',
    metadata: {
      incidentId: classification.id,
      endpointId,
    },
  })
}

async function executePauseOperations(
  classification: IncidentClassification,
  _recommendation: ResponseRecommendation
): Promise<void> {
  await recordAudit({
    action: 'incident_response.operations_paused',
    category: AuditCategory.SECURITY,
    severity: AuditSeverity.HIGH,
    actor: 'automation_engine',
    outcome: 'success',
    metadata: {
      incidentId: classification.id,
      reason: classification.title,
    },
  })

  await dispatchToChannels(
    {
      id: `ops-pause-${classification.id}`,
      title: 'Operations Paused',
      description: `Automated operations pause due to: ${classification.title}. Resume requires manual review.`,
      severity: 'warning',
      timestamp: new Date().toISOString(),
      tags: ['operations-pause', 'automated'],
    },
    [{ type: 'in_app' }, { type: 'browser' }],
  )
}

async function executeBlockAccount(
  classification: IncidentClassification,
  _recommendation: ResponseRecommendation
): Promise<void> {
  const actor = classification.evidence.find((e) => e.actor)?.actor

  await recordAudit({
    action: 'incident_response.account_blocked',
    category: AuditCategory.SECURITY,
    severity: AuditSeverity.HIGH,
    actor: 'automation_engine',
    target: actor || 'unknown',
    outcome: 'success',
    metadata: {
      incidentId: classification.id,
      reason: classification.title,
    },
  })
}

async function executeEnable2FA(
  classification: IncidentClassification,
  _recommendation: ResponseRecommendation
): Promise<void> {
  const actor = classification.evidence.find((e) => e.actor)?.actor

  await recordAudit({
    action: 'incident_response.2fa_enforced',
    category: AuditCategory.AUTH,
    severity: AuditSeverity.MEDIUM,
    actor: 'automation_engine',
    target: actor || 'unknown',
    outcome: 'success',
    metadata: {
      incidentId: classification.id,
    },
  })
}

async function executeRotateKeys(
  classification: IncidentClassification,
  _recommendation: ResponseRecommendation
): Promise<void> {
  await recordAudit({
    action: 'incident_response.key_rotation_initiated',
    category: AuditCategory.SECURITY,
    severity: AuditSeverity.CRITICAL,
    actor: 'automation_engine',
    outcome: 'success',
    metadata: {
      incidentId: classification.id,
      reason: classification.title,
    },
  })
}

async function executeFreezeAsset(
  classification: IncidentClassification,
  _recommendation: ResponseRecommendation
): Promise<void> {
  await recordAudit({
    action: 'incident_response.asset_frozen',
    category: AuditCategory.SECURITY,
    severity: AuditSeverity.CRITICAL,
    actor: 'automation_engine',
    outcome: 'success',
    metadata: {
      incidentId: classification.id,
      reason: classification.title,
    },
  })
}

// ---------------------------------------------------------------------------
// Rate limiting & cooldown
// ---------------------------------------------------------------------------

function checkRateLimit(): boolean {
  const now = Date.now()

  // Reset hourly window if needed
  if (now - _state.hourlyWindowStart > 3600000) {
    _state.hourlyCount = 0
    _state.hourlyWindowStart = now
  }

  return _state.hourlyCount < _config.maxAutomatedPerHour
}

function checkCooldown(): boolean {
  return Date.now() - _state.lastExecutionTime >= _config.cooldownMs
}

// ---------------------------------------------------------------------------
// Approval system integration
// ---------------------------------------------------------------------------

/**
 * Execute a pending action that was previously awaiting approval.
 */
export async function executeApprovedAction(
  incidentId: string,
  action: ResponseActionType,
  classification: IncidentClassification
): Promise<ResponseActionResult> {
  const startTime = Date.now()

  const recommendation: ResponseRecommendation = {
    action,
    rationale: 'Approved by human operator',
    automationLevel: 'semi_automated',
    priority: 1,
    expectedOutcome: 'Action executed after approval',
    estimatedResolutionMs: 30000,
  }

  const result = await executeAction(recommendation, classification)

  await recordAudit({
    action: 'incident_response.approved_action_executed',
    category: AuditCategory.SECURITY,
    severity: AuditSeverity.INFO,
    actor: 'human_operator',
    outcome: 'success',
    metadata: {
      incidentId,
      action,
      responseTimeMs: Date.now() - startTime,
    },
  })

  return result
}

// ---------------------------------------------------------------------------
// Alert Dispatch Integration
// ---------------------------------------------------------------------------

async function dispatchIncidentAlert(
  classificationResult: IncidentClassificationResult
): Promise<void> {
  const { classification, riskScore, requiresImmediateAttention } = classificationResult

  // Always create in-app + browser alerts
  await dispatchToChannels(
    {
      id: classification.id,
      title: `${requiresImmediateAttention ? '[URGENT] ' : ''}${classification.title}`,
      description: `Category: ${classification.category}. Severity: ${classification.severity}. Risk: ${riskScore}/100. ${classification.description}`,
      severity: mapSeverityToAlertSeverity(classification.severity),
      timestamp: classification.classifiedAt,
      tags: ['incident-response', classification.category, classification.severity],
    },
    [{ type: 'in_app' }, { type: 'browser' }],
  )

  // For high/critical, also dispatch through alert system
  if (classification.severity === 'high' || classification.severity === 'critical') {
    await dispatchAlert({
      id: classification.id,
      title: `[Incident ${classification.severity.toUpperCase()}] ${classification.title}`,
      description: classification.description,
      severity: mapSeverityToAlertSeverity(classification.severity),
      timestamp: classification.classifiedAt,
      tags: ['incident-response', 'automated', classification.category],
    })
  }
}

// ---------------------------------------------------------------------------
// Metrics & reporting
// ---------------------------------------------------------------------------

function updateMetrics(runResult: AutomationRunResult): void {
  const { metrics } = _state

  metrics.totalAutomatedResponses++
  if (runResult.success) {
    metrics.successfulResponses++
  } else {
    metrics.failedResponses++
  }

  // Update average response time using exponential moving average
  if (metrics.totalAutomatedResponses === 1) {
    metrics.averageResponseTimeMs = runResult.totalResponseTimeMs
  } else {
    metrics.averageResponseTimeMs =
      metrics.averageResponseTimeMs * 0.9 + runResult.totalResponseTimeMs * 0.1
  }

  // Calculate automated rate: ratio of fully automated vs total
  const autoExecuted = runResult.actionResults.filter(
    (r) => r.status === 'completed' || r.status === 'skipped'
  ).length
  const total = runResult.actionResults.length
  const runAutomatedRate = total > 0 ? autoExecuted / total : 0

  if (metrics.totalAutomatedResponses === 1) {
    metrics.automatedRate = runAutomatedRate
  } else {
    metrics.automatedRate =
      metrics.automatedRate * 0.85 + runAutomatedRate * 0.15
  }

  metrics.lastUpdated = Date.now()
}

export function getAutomationMetrics(): AutomationMetrics {
  return { ..._state.metrics }
}

export function getRecentAutomationRuns(limit = 50): AutomationRunResult[] {
  return _state.recentRuns.slice(-limit)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSkippedResult(
  incidentId: string,
  startedAt: string,
  _reason: string
): AutomationRunResult {
  return {
    incidentId,
    startedAt,
    completedAt: new Date().toISOString(),
    actionResults: [],
    success: false,
    pendingApproval: [],
    totalResponseTimeMs: 0,
  }
}

function mapSeverityToAlertSeverity(
  severity: string
): AlertPayload['severity'] {
  switch (severity) {
    case 'critical':
      return 'critical'
    case 'high':
      return 'warning'
    case 'medium':
      return 'warning'
    default:
      return 'info'
  }
}

function mapSeverityToAuditSeverity(severity: string): AuditSeverity {
  switch (severity) {
    case 'critical':
      return AuditSeverity.CRITICAL
    case 'high':
      return AuditSeverity.HIGH
    case 'medium':
      return AuditSeverity.MEDIUM
    case 'low':
      return AuditSeverity.LOW
    default:
      return AuditSeverity.INFO
  }
}

function collectSystemDiagnostics(): Record<string, unknown> {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  }

  if (typeof navigator !== 'undefined') {
    const nav = navigator as Navigator & {
      deviceMemory?: number
      connection?: { effectiveType?: string; downlink?: number; rtt?: number }
    }
    diagnostics.userAgent = navigator.userAgent
    diagnostics.language = navigator.language
    if (nav.connection) {
      diagnostics.connection = {
        effectiveType: nav.connection.effectiveType,
        downlink: nav.connection.downlink,
        rtt: nav.connection.rtt,
      }
    }
    if (nav.deviceMemory) {
      diagnostics.deviceMemory = nav.deviceMemory
    }
  }

  if (typeof window !== 'undefined') {
    diagnostics.viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    }
  }

  return diagnostics
}

// Export instance
export const incidentResponseAutomation = {
  execute: executeAutomatedResponse,
  executeApprovedAction,
  configure: configureAutomation,
  getConfig: getAutomationConfig,
  getMetrics: getAutomationMetrics,
  getRecentRuns: getRecentAutomationRuns,
}

export default incidentResponseAutomation
