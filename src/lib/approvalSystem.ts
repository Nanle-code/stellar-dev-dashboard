/**
 * Human Approval System for Incident Response (#593)
 *
 * Provides a structured approval workflow for automated incident response
 * actions that require human oversight. Integrates with the notification
 * system to alert operators and manages approval timeouts with escalation.
 *
 * Features:
 *  - Approval request queue with priority-based ordering
 *  - Configurable auto-approval for low-risk actions within time windows
 *  - Escalation chain for unaddressed approvals
 *  - Full audit trail of all approval decisions
 *  - Integration with existing notification channels
 */

import { createLogger } from '../utils/logger'
import { dispatchToChannels } from './alertChannels'
import { recordAudit, AuditCategory, AuditSeverity } from '../utils/audit.js'

const logger = createLogger('ApprovalSystem')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApprovalActionType = string

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'auto_approved' | 'auto_rejected'

export type ApprovalPriority = 'low' | 'medium' | 'high' | 'critical'

export interface ApprovalRequest {
  /** Unique request ID */
  id: string
  /** The incident ID this approval is for */
  incidentId: string
  /** The action requiring approval */
  action: ApprovalActionType
  /** Human-readable description of what needs approval */
  description: string
  /** Why this action is recommended */
  rationale: string
  /** Priority level */
  priority: ApprovalPriority
  /** Current status */
  status: ApprovalStatus
  /** Who created/requested this approval */
  requestedBy: string
  /** ISO timestamp when request was created */
  requestedAt: string
  /** ISO timestamp for expiry (auto-generation) */
  expiresAt: string
  /** Who approved/rejected (if resolved) */
  resolvedBy?: string
  /** When it was resolved */
  resolvedAt?: string
  /** Any reason for rejection */
  rejectionReason?: string
  /** Additional context */
  context?: Record<string, unknown>
}

export interface ApprovalQueueState {
  pending: ApprovalRequest[]
  resolved: ApprovalRequest[]
}

export interface ApprovalSystemConfig {
  /** Auto-approve threshold in ms (requests pending longer auto-resolve) */
  autoResolveTimeoutMs: number
  /** Maximum pending requests before alerting */
  maxPendingBeforeAlert: number
  /** Whether to auto-approve low-priority requests */
  autoApproveLowPriority: boolean
  /** Auto-approve window for low priority (ms) */
  autoApproveWindowMs: number
  /** First escalation delay (ms) */
  firstEscalationDelayMs: number
  /** Second escalation delay (ms) */
  secondEscalationDelayMs: number
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

let _config: ApprovalSystemConfig = {
  autoResolveTimeoutMs: 30 * 60 * 1000, // 30 minutes
  maxPendingBeforeAlert: 10,
  autoApproveLowPriority: true,
  autoApproveWindowMs: 5 * 60 * 1000, // 5 minutes
  firstEscalationDelayMs: 5 * 60 * 1000, // 5 minutes
  secondEscalationDelayMs: 15 * 60 * 1000, // 15 minutes
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const _state: ApprovalQueueState = {
  pending: [],
  resolved: [],
}

const MAX_RESOLVED = 500
const _subscribers = new Set<(state: ApprovalQueueState) => void>()
let _escalationTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export function configureApprovalSystem(overrides: Partial<ApprovalSystemConfig>): void {
  _config = { ..._config, ...overrides }
  logger.info('Approval system configured', _config)
}

export function getApprovalConfig(): ApprovalSystemConfig {
  return { ..._config }
}

// ---------------------------------------------------------------------------
// Request management
// ---------------------------------------------------------------------------

/**
 * Create an approval request for an action that requires human sign-off.
 */
export function createApprovalRequest(params: {
  incidentId: string
  action: ApprovalActionType
  description: string
  rationale: string
  priority?: ApprovalPriority
  requestedBy?: string
  context?: Record<string, unknown>
}): ApprovalRequest {
  const request: ApprovalRequest = {
    id: `approval-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    incidentId: params.incidentId,
    action: params.action,
    description: params.description,
    rationale: params.rationale,
    priority: params.priority || 'medium',
    status: 'pending',
    requestedBy: params.requestedBy || 'automation_engine',
    requestedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + _config.autoResolveTimeoutMs).toISOString(),
    context: params.context,
  }

  _state.pending.push(request)
  notifySubscribers()

  // Set up auto-resolve timer
  scheduleAutoResolve(request)

  // Set up escalation timers
  scheduleEscalation(request)

  // Check if we need to alert about queue size
  checkQueueSize()

  // Log the request
  recordAudit({
    action: 'approval.requested',
    category: AuditCategory.SECURITY,
    severity: mapPriorityToSeverity(request.priority),
    actor: request.requestedBy,
    outcome: 'success',
    metadata: {
      approvalId: request.id,
      incidentId: request.incidentId,
      action: request.action,
      priority: request.priority,
    },
  }).catch(() => {})

  // Notify about new approval request
  notifyNewRequest(request)

  logger.info('Approval request created', {
    id: request.id,
    incidentId: request.incidentId,
    action: request.action,
    priority: request.priority,
  })

  return request
}

/**
 * Approve a pending request.
 */
export function approveRequest(
  requestId: string,
  resolvedBy: string
): ApprovalRequest | null {
  const idx = _state.pending.findIndex((r) => r.id === requestId)
  if (idx === -1) {
    logger.warn('Approval request not found', { requestId })
    return null
  }

  const request = _state.pending[idx]
  request.status = 'approved'
  request.resolvedBy = resolvedBy
  request.resolvedAt = new Date().toISOString()

  _state.pending.splice(idx, 1)
  _state.resolved.unshift(request)
  trimResolved()

  // Clear timers
  clearTimers(requestId)

  notifySubscribers()

  recordAudit({
    action: 'approval.approved',
    category: AuditCategory.SECURITY,
    severity: AuditSeverity.INFO,
    actor: resolvedBy,
    target: request.action,
    outcome: 'success',
    metadata: {
      approvalId: request.id,
      incidentId: request.incidentId,
    },
  }).catch(() => {})

  logger.info('Approval request approved', {
    id: requestId,
    resolvedBy,
  })

  return request
}

/**
 * Reject a pending request with a reason.
 */
export function rejectRequest(
  requestId: string,
  resolvedBy: string,
  reason: string
): ApprovalRequest | null {
  const idx = _state.pending.findIndex((r) => r.id === requestId)
  if (idx === -1) {
    logger.warn('Approval request not found', { requestId })
    return null
  }

  const request = _state.pending[idx]
  request.status = 'rejected'
  request.resolvedBy = resolvedBy
  request.resolvedAt = new Date().toISOString()
  request.rejectionReason = reason

  _state.pending.splice(idx, 1)
  _state.resolved.unshift(request)
  trimResolved()

  // Clear timers
  clearTimers(requestId)

  notifySubscribers()

  recordAudit({
    action: 'approval.rejected',
    category: AuditCategory.SECURITY,
    severity: AuditSeverity.MEDIUM,
    actor: resolvedBy,
    target: request.action,
    outcome: 'denied',
    metadata: {
      approvalId: request.id,
      incidentId: request.incidentId,
      reason,
    },
  }).catch(() => {})

  logger.info('Approval request rejected', {
    id: requestId,
    resolvedBy,
    reason,
  })

  return request
}

// ---------------------------------------------------------------------------
// Auto-resolution
// ---------------------------------------------------------------------------

function scheduleAutoResolve(request: ApprovalRequest): void {
  const delay = _config.autoResolveTimeoutMs
  const timer = setTimeout(() => {
    autoResolveRequest(request.id)
  }, delay)

  _escalationTimers.set(`auto-${request.id}`, timer)
}

function autoResolveRequest(requestId: string): void {
  const idx = _state.pending.findIndex((r) => r.id === requestId)
  if (idx === -1) return

  const request = _state.pending[idx]

  // Auto-approve low priority if configured
  if (_config.autoApproveLowPriority && request.priority === 'low') {
    request.status = 'auto_approved'
  } else {
    request.status = 'expired'
  }

  request.resolvedAt = new Date().toISOString()
  request.resolvedBy = 'auto_resolver'

  _state.pending.splice(idx, 1)
  _state.resolved.unshift(request)
  trimResolved()

  clearTimers(requestId)
  notifySubscribers()

  recordAudit({
    action: 'approval.auto_resolved',
    category: AuditCategory.SECURITY,
    severity: AuditSeverity.INFO,
    actor: 'approval_system',
    outcome: 'success',
    metadata: {
      approvalId: request.id,
      autoResolved: true,
      status: request.status,
    },
  }).catch(() => {})

  logger.info('Request auto-resolved', {
    id: requestId,
    status: request.status,
  })
}

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

function scheduleEscalation(request: ApprovalRequest): void {
  // First escalation
  const firstTimer = setTimeout(() => {
    escalateRequest(request, 1)
  }, _config.firstEscalationDelayMs)
  _escalationTimers.set(`esc1-${request.id}`, firstTimer)

  // Second escalation
  const secondTimer = setTimeout(() => {
    escalateRequest(request, 2)
  }, _config.secondEscalationDelayMs)
  _escalationTimers.set(`esc2-${request.id}`, secondTimer)
}

function escalateRequest(request: ApprovalRequest, level: number): void {
  // Check if still pending
  if (_state.pending.findIndex((r) => r.id === request.id) === -1) return

  const escalationMsg =
    level === 1
      ? `Approval request ${request.id} has been pending for ${_config.firstEscalationDelayMs / 60000} minutes`
      : `URGENT: Approval request ${request.id} has been pending for ${_config.secondEscalationDelayMs / 60000} minutes`

  dispatchToChannels(
    {
      id: `escalation-${request.id}-${level}`,
      title: level === 1 ? 'Approval Escalation' : 'CRITICAL: Approval Overdue',
      description: `${escalationMsg}. Action: ${request.action}. Priority: ${request.priority}.`,
      severity: level === 1 ? 'warning' : 'critical',
      timestamp: new Date().toISOString(),
      tags: ['approval', 'escalation', `level-${level}`],
    },
    [{ type: 'in_app' }, { type: 'browser' }],
  )

  logger.warn(`Approval escalated level ${level}`, {
    requestId: request.id,
    incidentId: request.incidentId,
    action: request.action,
  })
}

// ---------------------------------------------------------------------------
// Query & subscribe
// ---------------------------------------------------------------------------

export function getPendingRequests(
  filter?: {
    priority?: ApprovalPriority
    incidentId?: string
  }
): ApprovalRequest[] {
  let pending = [..._state.pending]

  if (filter?.priority) {
    pending = pending.filter((r) => r.priority === filter.priority)
  }
  if (filter?.incidentId) {
    pending = pending.filter((r) => r.incidentId === filter.incidentId)
  }

  // Sort by priority (critical first) then by age (oldest first)
  return pending.sort((a, b) => {
    const priorityOrder: Record<ApprovalPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    }
    const pa = priorityOrder[a.priority]
    const pb = priorityOrder[b.priority]
    if (pa !== pb) return pa - pb
    return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
  })
}

export function getResolvedRequests(limit = 50): ApprovalRequest[] {
  return _state.resolved.slice(0, limit)
}

export function getApprovalQueueStats(): {
  totalPending: number
  critical: number
  high: number
  medium: number
  low: number
  oldestPendingMs: number
  requiresAttention: boolean
} {
  const pending = _state.pending
  const now = Date.now()

  let oldestAge = 0
  for (const r of pending) {
    const age = now - new Date(r.requestedAt).getTime()
    if (age > oldestAge) oldestAge = age
  }

  return {
    totalPending: pending.length,
    critical: pending.filter((r) => r.priority === 'critical').length,
    high: pending.filter((r) => r.priority === 'high').length,
    medium: pending.filter((r) => r.priority === 'medium').length,
    low: pending.filter((r) => r.priority === 'low').length,
    oldestPendingMs: oldestAge,
    requiresAttention: pending.length >= _config.maxPendingBeforeAlert ||
      pending.some((r) => r.priority === 'critical'),
  }
}

export function subscribeToApprovals(
  handler: (state: ApprovalQueueState) => void
): () => void {
  _subscribers.add(handler)
  return () => _subscribers.delete(handler)
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function notifyNewRequest(request: ApprovalRequest): void {
  dispatchToChannels(
    {
      id: request.id,
      title: `Approval Required: ${formatAction(request.action)}`,
      description: `${request.description}\n\nRationale: ${request.rationale}\nPriority: ${request.priority.toUpperCase()}`,
      severity: request.priority === 'critical' ? 'critical' : 'warning',
      timestamp: request.requestedAt,
      tags: ['approval-required', request.priority],
    },
    [{ type: 'in_app' }, { type: 'browser' }],
  )
}

function checkQueueSize(): void {
  if (_state.pending.length >= _config.maxPendingBeforeAlert) {
    dispatchToChannels(
      {
        id: `queue-alert-${Date.now()}`,
        title: 'Approval Queue Threshold Reached',
        description: `${_state.pending.length} pending approval requests. Some may auto-resolve if not addressed.`,
        severity: 'warning',
        timestamp: new Date().toISOString(),
        tags: ['approval-queue', 'alert'],
      },
      [{ type: 'in_app' }, { type: 'browser' }],
    )
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearTimers(requestId: string): void {
  for (const prefix of ['auto-', 'esc1-', 'esc2-']) {
    const key = `${prefix}${requestId}`
    const timer = _escalationTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      _escalationTimers.delete(key)
    }
  }
}

function notifySubscribers(): void {
  const state = { ..._state }
  for (const sub of _subscribers) {
    try {
      sub(state)
    } catch {
      // Swallow subscriber errors
    }
  }
}

function trimResolved(): void {
  if (_state.resolved.length > MAX_RESOLVED) {
    _state.resolved = _state.resolved.slice(0, MAX_RESOLVED)
  }
}

function mapPriorityToSeverity(priority: ApprovalPriority): AuditSeverity {
  switch (priority) {
    case 'critical':
      return AuditSeverity.CRITICAL
    case 'high':
      return AuditSeverity.HIGH
    case 'medium':
      return AuditSeverity.MEDIUM
    default:
      return AuditSeverity.LOW
  }
}

function formatAction(action: string): string {
  return action
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Export singleton
export const approvalSystem = {
  createRequest: createApprovalRequest,
  approve: approveRequest,
  reject: rejectRequest,
  getPending: getPendingRequests,
  getResolved: getResolvedRequests,
  getStats: getApprovalQueueStats,
  subscribe: subscribeToApprovals,
  configure: configureApprovalSystem,
  getConfig: getApprovalConfig,
}

export default approvalSystem
