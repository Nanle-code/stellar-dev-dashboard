/**
 * IncidentResponsePanel (#593)
 *
 * Dashboard component for the AI-Enhanced Incident Response Automation system.
 * Displays incident classifications, automated response execution, and
 * human approval queue in an integrated dashboard panel.
 *
 * Features:
 *  - Incident classification viewer with severity indicators
 *  - Automated response execution with real-time status
 *  - Human approval queue with action buttons
 *  - Response time and automation rate metrics
 *  - Integration with existing notification and alert systems
 */

import React, { useState, useMemo } from 'react'
import {
  type IncidentClassification,
} from '../lib/incidentClassifier'
import {
  type AutomationRunResult,
} from '../lib/incidentResponseAutomation'
import type { ApprovalRequest } from '../lib/approvalSystem'
import { useIncidentResponse } from '../hooks/useIncidentResponse'
import { Shield, AlertTriangle, CheckCircle, Clock, XCircle, Zap, ThumbsUp, ThumbsDown, Activity, RefreshCw } from 'lucide-react'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
}

const headerTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: '13px',
  flex: 1,
}

const contentStyle: React.CSSProperties = {
  padding: '18px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  fontWeight: 600,
}

const badgeStyle = (severity: string): React.CSSProperties => {
  const colors: Record<string, string> = {
    info: 'var(--cyan)',
    low: 'var(--green)',
    medium: 'var(--amber)',
    high: 'var(--orange)',
    critical: 'var(--red)',
  }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    background: `${colors[severity] || 'var(--text-muted)'}20`,
    border: `1px solid ${colors[severity] || 'var(--border)'}`,
    color: colors[severity] || 'var(--text-primary)',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }
}

const cardStyle: React.CSSProperties = {
  padding: '12px 14px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const buttonBaseStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-bright)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  transition: 'var(--transition)',
}

const primaryButtonStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  background: 'var(--accent)',
  border: '1px solid var(--accent)',
  color: '#fff',
}

const dangerButtonStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  border: '1px solid var(--red)',
  color: 'var(--red)',
}

const metricCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  padding: '12px',
  background: 'var(--bg-base)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  flex: 1,
}

const metricValueStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
}

const metricLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  const icons: Record<string, React.ReactNode> = {
    info: null,
    low: null,
    medium: <AlertTriangle size={10} />,
    high: <AlertTriangle size={10} />,
    critical: <AlertTriangle size={10} />,
  }
  return <span style={badgeStyle(severity)}>{icons[severity]}{severity}</span>
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    completed: { color: 'var(--green)', background: 'var(--green)15' },
    executing: { color: 'var(--amber)', background: 'var(--amber)15' },
    failed: { color: 'var(--red)', background: 'var(--red)15' },
    skipped: { color: 'var(--text-muted)', background: 'var(--border)50' },
    awaiting_approval: { color: 'var(--cyan)', background: 'var(--cyan)15' },
    pending: { color: 'var(--text-muted)', background: 'var(--border)30' },
  }
  const s = styles[status] || styles.pending
  const icons: Record<string, React.ReactNode> = {
    completed: <CheckCircle size={10} />,
    executing: <RefreshCw size={10} />,
    failed: <XCircle size={10} />,
    skipped: null,
    awaiting_approval: <Clock size={10} />,
    pending: <Clock size={10} />,
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '10px',
        fontWeight: 600,
        ...s,
      }}
    >
      {icons[status]}{status.replace(/_/g, ' ')}
    </span>
  )
}

function MetricCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent?: string
}) {
  return (
    <div
      style={{
        ...metricCardStyle,
        ...(accent ? { borderColor: accent } : {}),
      }}
    >
      <div style={{ marginBottom: '2px' }}>{icon}</div>
      <div style={metricValueStyle}>{value}</div>
      <div style={metricLabelStyle}>{label}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function IncidentResponsePanel() {
  const {
    recentClassifications,
    recentRuns,
    automationMetrics,
    pendingApprovals,
    approveRequest,
    rejectRequest,
    approvalStats,
    error,
    lastIncident,
  } = useIncidentResponse()

  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  // Convert automation metrics to display format
  const displayMetrics = useMemo(() => ({
    automated: `${Math.round(automationMetrics.automatedRate * 100)}%`,
    avgResponseTime: automationMetrics.averageResponseTimeMs < 1000
      ? `${Math.round(automationMetrics.averageResponseTimeMs)}ms`
      : `${(automationMetrics.averageResponseTimeMs / 1000).toFixed(1)}s`,
    total: automationMetrics.totalAutomatedResponses,
    success: automationMetrics.successfulResponses,
  }), [automationMetrics])

  return (
    <div style={panelStyle} data-testid="incident-response-panel">
      {/* Header */}
      <div style={headerStyle}>
        <Shield size={16} style={{ color: 'var(--accent)' }} />
        <span style={headerTitleStyle}>Incident Response</span>
        {lastIncident && (
          <SeverityBadge severity={lastIncident.classification.severity} />
        )}
      </div>

      <div style={contentStyle}>
        {/* Metrics Bar */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Automation Metrics</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <MetricCard
              label="Automated"
              value={displayMetrics.automated}
              icon={<Zap size={14} style={{ color: 'var(--accent)' }} />}
              accent="var(--accent)"
            />
            <MetricCard
              label="Avg Response"
              value={displayMetrics.avgResponseTime}
              icon={<Clock size={14} style={{ color: 'var(--cyan)' }} />}
            />
            <MetricCard
              label="Total Responses"
              value={displayMetrics.total}
              icon={<Activity size={14} style={{ color: 'var(--green)' }} />}
            />
            <MetricCard
              label="Success Rate"
              value={
                displayMetrics.total > 0
                  ? `${Math.round((displayMetrics.success / displayMetrics.total) * 100)}%`
                  : '—'
              }
              icon={<CheckCircle size={14} style={{ color: 'var(--green)' }} />}
            />
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--red)15',
              border: '1px solid var(--red)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--red)',
              fontSize: '12px',
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Approval Queue */}
        <div style={sectionStyle}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={sectionTitleStyle}>
              Pending Approvals ({pendingApprovals.length})
              {approvalStats.requiresAttention && (
                <span
                  style={{
                    marginLeft: '6px',
                    color: 'var(--red)',
                    fontWeight: 700,
                  }}
                >
                  ⚠
                </span>
              )}
            </div>
            {pendingApprovals.filter((a) => a.priority === 'critical').length >
              0 && (
              <span style={badgeStyle('critical')}>
                {pendingApprovals.filter((a) => a.priority === 'critical').length}{' '}
                Critical
              </span>
            )}
          </div>

          {pendingApprovals.length === 0 ? (
            <div style={cardStyle}>
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  textAlign: 'center',
                }}
              >
                No pending approvals
              </span>
            </div>
          ) : (
            pendingApprovals.slice(0, 5).map((request) => (
              <ApprovalCard
                key={request.id}
                request={request}
                onApprove={() => {
                  approveRequest(request.id)
                  setRejectingId(null)
                }}
                onReject={() => {
                  setRejectingId(
                    rejectingId === request.id ? null : request.id
                  )
                  setRejectReason('')
                }}
                isRejecting={rejectingId === request.id}
                rejectReason={rejectReason}
                onRejectReasonChange={setRejectReason}
                onConfirmReject={() => {
                  rejectRequest(request.id, rejectReason || 'Rejected by operator')
                  setRejectingId(null)
                  setRejectReason('')
                }}
                onCancelReject={() => setRejectingId(null)}
              />
            ))
          )}
        </div>

        {/* Recent Classifications */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>
            Recent Incidents ({recentClassifications.length})
          </div>
          {recentClassifications.length === 0 ? (
            <div style={cardStyle}>
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  textAlign: 'center',
                }}
              >
                No incidents classified yet
              </span>
            </div>
          ) : (
            recentClassifications.slice(0, 5).map((classification) => (
              <ClassificationCard
                key={classification.id}
                classification={classification}
              />
            ))
          )}
        </div>

        {/* Recent Response Runs */}
        {recentRuns.length > 0 && (
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              Recent Responses ({recentRuns.length})
            </div>
            {recentRuns.slice(0, 3).map((run) => (
              <RunResultCard key={run.incidentId} run={run} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card sub-components
// ---------------------------------------------------------------------------

function ApprovalCard({
  request,
  onApprove,
  onReject,
  isRejecting,
  rejectReason,
  onRejectReasonChange,
  onConfirmReject,
  onCancelReject,
}: {
  request: ApprovalRequest
  onApprove: () => void
  onReject: () => void
  isRejecting: boolean
  rejectReason: string
  onRejectReasonChange: (val: string) => void
  onConfirmReject: () => void
  onCancelReject: () => void
}) {
  const age = Date.now() - new Date(request.requestedAt).getTime()
  const ageStr =
    age < 60000
      ? `${Math.round(age / 1000)}s ago`
      : `${Math.round(age / 60000)}m ago`

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {request.description}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              marginTop: '2px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <span style={badgeStyle(request.priority)}>{request.priority}</span>
            <span>{ageStr}</span>
          </div>
        </div>

        {!isRejecting && (
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={onApprove}
              style={primaryButtonStyle}
              title="Approve"
            >
              <ThumbsUp size={12} />
              Approve
            </button>
            <button
              onClick={onReject}
              style={dangerButtonStyle}
              title="Reject"
            >
              <ThumbsDown size={12} />
              Reject
            </button>
          </div>
        )}
      </div>

      {isRejecting && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            paddingTop: '6px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => onRejectReasonChange(e.target.value)}
            placeholder="Reason for rejection..."
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border-bright)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 10px',
              color: 'var(--text-primary)',
              fontSize: '11px',
              width: '100%',
              boxSizing: 'border-box',
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirmReject()
              if (e.key === 'Escape') onCancelReject()
            }}
          />
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button onClick={onCancelReject} style={buttonBaseStyle}>
              Cancel
            </button>
            <button
              onClick={onConfirmReject}
              style={{
                ...dangerButtonStyle,
                opacity: rejectReason.trim() ? 1 : 0.5,
              }}
              disabled={!rejectReason.trim()}
            >
              Confirm Reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ClassificationCard({
  classification,
}: {
  classification: IncidentClassification
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <SeverityBadge severity={classification.severity} />
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {classification.title}
        </span>
      </div>
      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
        }}
      >
        {classification.description.slice(0, 150)}
        {classification.description.length > 150 ? '…' : ''}
      </div>
      <div
        style={{
          display: 'flex',
          gap: '10px',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}
      >
        <span>
          Confidence: {Math.round(classification.confidence * 100)}%
        </span>
        <span>Evidence: {classification.evidence.length} items</span>
        <span>
          {new Date(classification.classifiedAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  )
}

function RunResultCard({ run }: { run: AutomationRunResult }) {
  const completed = run.actionResults.filter(
    (r) => r.status === 'completed'
  ).length
  const failed = run.actionResults.filter(
    (r) => r.status === 'failed'
  ).length
  const pending = run.actionResults.filter(
    (r) => r.status === 'awaiting_approval'
  ).length

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {run.success ? (
            <CheckCircle size={12} style={{ color: 'var(--green)' }} />
          ) : (
            <XCircle size={12} style={{ color: 'var(--red)' }} />
          )}
          <span>{run.incidentId.slice(0, 16)}…</span>
        </div>
        <span
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
          }}
        >
          {run.totalResponseTimeMs}ms
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {completed > 0 && (
          <StatusBadge status="completed" />
        )}
        {failed > 0 && (
          <StatusBadge status="failed" />
        )}
        {pending > 0 && (
          <StatusBadge status="awaiting_approval" />
        )}
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {completed} ok, {failed} failed, {pending} pending
        </span>
      </div>
    </div>
  )
}
