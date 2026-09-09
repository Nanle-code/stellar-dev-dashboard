/**
 * src/components/adaptive/PerformanceModeSelector.tsx
 *
 * Compact selector that lets users override the Adaptive Performance
 * Engine. Shows the current tier / accuracy / locked knobs and exposes
 * three override modes:
 *
 *   - `auto`           — full engine control
 *   - `quality`        — bias towards richer visuals
 *   - `balanced`       — neutral middle ground
 *   - `speed`          — bias towards low CPU / network usage
 *   - `battery-saver`  — force the most conservative tier
 *
 * The component also surfaces the rolling engine accuracy (used to verify
 * that "adaptations are appropriate 90% of the time") and offers a one-
 * click unlock for any knob the user previously locked.
 */

import { useMemo } from 'react'
import { useAdaptivePerformance } from '../../hooks/useAdaptivePerformance'
import type { PerformanceMode } from '../../lib/adaptivePerformance'

export interface PerformanceModeSelectorProps {
  /** Optional className forwarded to the outer container. */
  className?: string
  /** Hide the accuracy tile — useful in compact dashboards. */
  hideAccuracy?: boolean
  /** Hide the lock/unlock tile — useful for read-only contexts. */
  hideLocks?: boolean
  /** Called whenever the user picks a different mode. */
  onModeChange?: (mode: PerformanceMode) => void
}

const MODES: ReadonlyArray<{
  id: PerformanceMode
  label: string
  description: string
  emoji: string
}> = [
  {
    id: 'auto',
    label: 'Auto',
    description: 'Let the engine decide based on your device, network & usage.',
    emoji: '🤖',
  },
  {
    id: 'quality',
    label: 'Quality',
    description: 'Favour richer visuals and richer data.',
    emoji: '✨',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Neutral trade-off between quality and speed.',
    emoji: '⚖️',
  },
  {
    id: 'speed',
    label: 'Speed',
    description: 'Bias towards low CPU usage and low network usage.',
    emoji: '⚡',
  },
  {
    id: 'battery-saver',
    label: 'Battery saver',
    description: 'Lock the dashboard to the lowest-impact tier.',
    emoji: '🔋',
  },
]

const TIER_BADGE: Record<string, { label: string; tone: string }> = {
  high: { label: 'High quality', tone: 'var(--green, #4ade80)' },
  balanced: { label: 'Balanced', tone: 'var(--cyan, #06b6d4)' },
  'battery-saver': { label: 'Battery saver', tone: 'var(--amber, #f59e0b)' },
}

export function PerformanceModeSelector({
  className,
  hideAccuracy = false,
  hideLocks = false,
  onModeChange,
}: PerformanceModeSelectorProps) {
  const {
    snapshot,
    ready,
    setPerformanceMode,
    submitFeedback,
    locked,
    unlockAdaptation,
    refresh,
  } = useAdaptivePerformance('PerformanceModeSelector')

  const activeMode = snapshot?.mode ?? 'auto'
  const tier = snapshot?.adaptation.tier ?? 'balanced'
  const accuracy = snapshot?.accuracy
  const decisions = snapshot?.decisionsObserved ?? 0
  const badge = TIER_BADGE[tier]

  const accuracyLabel = useMemo(() => {
    if (accuracy === undefined) return 'No data yet'
    const pct = Math.round(accuracy * 100)
    return `${pct}% appropriate (${decisions} sample${decisions === 1 ? '' : 's'})`
  }, [accuracy, decisions])

  const handleMode = (next: PerformanceMode) => {
    setPerformanceMode(next)
    if (onModeChange) onModeChange(next)
    // Mode switch counts as positive feedback for the chosen tier.
    void submitFeedback(1, 'user-override')
  }

  const handleRevert = () => {
    setPerformanceMode('quality')
    // The "revert to a richer tier" path counts as a negative signal
    // for whatever tier was previously active.
    void submitFeedback(0, 'user-override', { tierOverride: snapshot?.adaptation.tier })
  }

  return (
    <section
      className={className}
      role="region"
      aria-label="Adaptive performance"
      style={{
        padding: '14px 16px',
        border: '1px solid var(--border, #2a2a3a)',
        borderRadius: '12px',
        background: 'var(--bg-surface, #14141c)',
        color: 'var(--text-primary, #e5e7eb)',
        fontFamily: 'var(--font-mono, ui-monospace)',
        fontSize: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'background 220ms ease, border-color 220ms ease',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.4px' }}>
            Adaptive performance
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--text-muted, #9ca3af)',
            }}
          >
            <span
              aria-hidden
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: badge?.tone ?? 'var(--text-muted)',
                boxShadow: `0 0 8px ${badge?.tone ?? 'transparent'}`,
              }}
            />
            {badge?.label ?? '—'} · confidence {Math.round((snapshot?.adaptation.confidence ?? 1) * 100)}%
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            padding: '4px 10px',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'background 160ms ease',
          }}
          aria-label="Re-probe device and network"
        >
          ↻ Refresh
        </button>
      </header>

      <fieldset
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '6px',
          border: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        <legend
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            padding: '0 4px',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}
        >
          Quality vs Speed
        </legend>
        {MODES.map((mode) => {
          const active = activeMode === mode.id
          return (
            <label
              key={mode.id}
              style={{
                cursor: 'pointer',
                padding: '8px 10px',
                border: `1px solid ${active ? 'var(--cyan, #06b6d4)' : 'var(--border)'}`,
                borderRadius: '10px',
                background: active ? 'var(--cyan-glow, rgba(6,182,212,0.12))' : 'var(--bg-elevated, #1f1f2e)',
                color: active ? 'var(--cyan)' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 160ms ease',
              }}
            >
              <input
                type="radio"
                name="adaptive-performance-mode"
                value={mode.id}
                checked={active}
                onChange={() => handleMode(mode.id)}
                style={{ accentColor: 'var(--cyan, #06b6d4)' }}
                aria-describedby={`mode-${mode.id}-desc`}
              />
              <span style={{ fontSize: '14px' }}>{mode.emoji}</span>
              <span style={{ fontWeight: 600 }}>{mode.label}</span>
              <span
                id={`mode-${mode.id}-desc`}
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  display: 'block',
                  gridColumn: '1 / -1',
                }}
              >
                {mode.description}
              </span>
            </label>
          )
        })}
      </fieldset>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: hideAccuracy ? '1fr' : '1fr 1fr',
          gap: '8px',
        }}
      >
        {!hideAccuracy && (
          <div
            style={{
              padding: '8px 10px',
              border: '1px dashed var(--border)',
              borderRadius: '8px',
              background: 'var(--bg-elevated)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
            }}
            aria-label="engine accuracy"
          >
            <div style={{ fontWeight: 600 }}>Accuracy</div>
            <div>{accuracyLabel}</div>
          </div>
        )}

        {!hideLocks && (
          <div
            style={{
              padding: '8px 10px',
              border: '1px dashed var(--border)',
              borderRadius: '8px',
              background: 'var(--bg-elevated)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
            }}
            aria-label="locked knobs"
          >
            <div style={{ fontWeight: 600 }}>Locked knobs</div>
            {locked.length === 0 ? (
              <div>None — engine controls everything.</div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {locked.map((key) => (
                  <li
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '2px 0',
                    }}
                  >
                    <span>{key}</span>
                    <button
                      type="button"
                      onClick={() => unlockAdaptation(key)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--cyan)',
                        cursor: 'pointer',
                        fontSize: '10px',
                      }}
                    >
                      Unlock
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {ready ? 'Engine running' : 'Initialising…'}
          {snapshot?.network.isOffline ? ' · ⚠ Offline mode' : null}
        </div>
        {activeMode === 'auto' && tier === 'battery-saver' ? (
          <button
            type="button"
            onClick={handleRevert}
            style={{
              background: 'var(--amber-glow, rgba(245,158,11,0.15))',
              border: '1px solid var(--amber, #f59e0b)',
              borderRadius: '8px',
              color: 'var(--amber, #f59e0b)',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Revert to quality
          </button>
        ) : null}
      </div>
    </section>
  )
}

export default PerformanceModeSelector
