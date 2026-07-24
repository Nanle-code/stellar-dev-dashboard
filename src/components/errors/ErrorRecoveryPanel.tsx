/**
 * ErrorRecoveryPanel.tsx — D-057
 *
 * Collapsible panel that shows real-time service health and lets the user
 * trigger manual healing. Designed to be embedded in the SystemHealth tab
 * or surfaced as an overlay when overall health degrades.
 */

import React, { useState } from 'react'
import { useErrorRecovery } from '../../hooks/useErrorRecovery'
import type { ServiceStatus, OverallHealth } from '../../lib/errorHandling/SelfHealingManager'

// ─── Visual helpers ───────────────────────────────────────────────────────────

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'var(--green, #22c55e)',
  degraded: 'var(--amber, #f59e0b)',
  recovering: 'var(--cyan, #06b6d4)',
  down: 'var(--red, #ef4444)',
  unknown: 'var(--text-muted, #6b7280)',
}

const HEALTH_ICONS: Record<string, string> = {
  healthy: '✅',
  degraded: '⚠️',
  recovering: '🔄',
  down: '🔴',
  unknown: '❓',
}

const HEALTH_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  recovering: 'Recovering',
  down: 'Down',
  unknown: 'Unknown',
}

function healthColor(health: string): string {
  return HEALTH_COLORS[health] ?? HEALTH_COLORS.unknown
}

function healthIcon(health: string): string {
  return HEALTH_ICONS[health] ?? HEALTH_ICONS.unknown
}

function healthLabel(health: string): string {
  return HEALTH_LABELS[health] ?? 'Unknown'
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ServiceRowProps {
  status: ServiceStatus
  onHeal: (id: string) => Promise<void>
  onReset: (id: string) => void
}

function ServiceRow({ status, onHeal, onReset }: ServiceRowProps) {
  const [healing, setHealing] = useState(false)
  const color = healthColor(status.health)

  const handleHeal = async () => {
    setHealing(true)
    try {
      await onHeal(status.id)
    } finally {
      setHealing(false)
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '12px',
        alignItems: 'start',
        padding: '12px',
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${color}33`,
        marginBottom: '8px',
      }}
    >
      {/* Left: service info */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px' }}>{healthIcon(status.health)}</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {status.id}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: `${color}22`,
              color,
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {healthLabel(status.health)}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Stat label="Last OK" value={formatRelativeTime(status.lastSuccess)} />
          <Stat label="Last fail" value={formatRelativeTime(status.lastFailure)} />
          <Stat label="Failures" value={String(status.failureCount)} />
          <Stat label="Recovery attempts" value={String(status.recoveryAttempts)} />
        </div>

        {status.recoveryAction && (
          <div
            style={{
              marginTop: '6px',
              fontSize: '12px',
              color: 'var(--cyan)',
              fontStyle: 'italic',
            }}
          >
            ↳ {status.recoveryAction}
          </div>
        )}
      </div>

      {/* Right: action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '80px' }}>
        {status.health !== 'healthy' && (
          <ActionButton
            onClick={handleHeal}
            loading={healing}
            label="Heal"
            loadingLabel="Healing…"
            primary
          />
        )}
        <ActionButton
          onClick={() => onReset(status.id)}
          label="Reset"
          loadingLabel=""
          primary={false}
        />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
      <span style={{ marginRight: '4px' }}>{label}:</span>
      <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  )
}

interface ActionButtonProps {
  onClick: () => void
  loading?: boolean
  label: string
  loadingLabel: string
  primary: boolean
}

function ActionButton({ onClick, loading, label, loadingLabel, primary }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '6px 12px',
        background: primary ? 'var(--cyan)' : 'var(--bg-hover)',
        color: primary ? 'var(--bg-base)' : 'var(--text-secondary)',
        border: primary ? 'none' : '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        transition: 'var(--transition)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        whiteSpace: 'nowrap',
      }}
    >
      {loading && (
        <span
          style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      )}
      {loading ? loadingLabel : label}
    </button>
  )
}

// ─── Overall health summary bar ───────────────────────────────────────────────

function HealthSummaryBar({ overall, isRecovering, onHealAll }: {
  overall: OverallHealth
  isRecovering: boolean
  onHealAll: () => Promise<void>
}) {
  const [healing, setHealing] = useState(false)
  const color = healthColor(overall)

  const handleHealAll = async () => {
    setHealing(true)
    try {
      await onHealAll()
    } finally {
      setHealing(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: `${color}11`,
        border: `1px solid ${color}44`,
        borderRadius: 'var(--radius-md)',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>{healthIcon(overall)}</span>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--text-primary)',
            }}
          >
            System Health: {healthLabel(overall)}
          </div>
          {isRecovering && (
            <div style={{ fontSize: '12px', color: 'var(--cyan)' }}>
              Auto-recovery in progress…
            </div>
          )}
        </div>
      </div>

      {overall !== 'healthy' && (
        <ActionButton
          onClick={handleHealAll}
          loading={healing}
          label="Heal All"
          loadingLabel="Healing…"
          primary
        />
      )}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export interface ErrorRecoveryPanelProps {
  /** Collapse the panel by default */
  defaultCollapsed?: boolean
  /** Filter to specific service IDs */
  serviceFilter?: string[]
}

export function ErrorRecoveryPanel({
  defaultCollapsed = false,
  serviceFilter,
}: ErrorRecoveryPanelProps) {
  const { statuses, overallHealth, isRecovering, healNow, resetService } = useErrorRecovery()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const visible = serviceFilter
    ? statuses.filter((s) => serviceFilter.includes(s.id))
    : statuses

  if (visible.length === 0) return null

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'transparent',
          border: 'none',
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
          cursor: 'pointer',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>🛡️</span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '14px',
            }}
          >
            Error Recovery &amp; Self-Healing
          </span>
          {isRecovering && (
            <span
              style={{
                padding: '2px 8px',
                background: 'var(--cyan)22',
                color: 'var(--cyan)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              RECOVERING
            </span>
          )}
          {overallHealth !== 'healthy' && overallHealth !== 'unknown' && !isRecovering && (
            <span
              style={{
                padding: '2px 8px',
                background: `${healthColor(overallHealth)}22`,
                color: healthColor(overallHealth),
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {healthLabel(overallHealth).toUpperCase()}
            </span>
          )}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
          {collapsed ? '▼ Show' : '▲ Hide'}
        </span>
      </button>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: '16px 18px' }}>
          <HealthSummaryBar
            overall={overallHealth}
            isRecovering={isRecovering}
            onHealAll={() => healNow()}
          />

          {visible.map((status) => (
            <ServiceRow
              key={status.id}
              status={status}
              onHeal={healNow}
              onReset={resetService}
            />
          ))}
        </div>
      )}

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default ErrorRecoveryPanel
