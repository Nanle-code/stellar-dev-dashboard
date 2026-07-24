/**
 * BiometricAuthOverlay
 *
 * Displayed during transaction signing to show:
 * - Real-time behavioral data collection progress
 * - Confidence score and anomaly result
 * - Learning mode progress (samples collected vs needed)
 * - Challenge UI when anomaly is detected (warn mode)
 */

import React, { useEffect, useRef, useState } from 'react'
import type { AnomalyResult } from '../../lib/behavioralBiometrics/anomalyDetector'
import type { BehavioralProfile } from '../../lib/behavioralBiometrics/profileBuilder'
import { MIN_SAMPLES_FOR_PROFILE } from '../../lib/behavioralBiometrics/profileBuilder'
import type { BiometricAuthStatus } from '../../lib/behavioralBiometrics/store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  status: BiometricAuthStatus
  profile: BehavioralProfile | null
  lastResult: AnomalyResult | null
  /** Called when user accepts the anomaly warning and proceeds anyway */
  onProceedAnyway: () => void
  /** Called when user cancels the signing due to anomaly */
  onCancel: () => void
  /** Called when overlay is dismissed after a passed/learning state */
  onDismiss: () => void
  /** Whether strict mode is enabled (blocks on anomaly vs just warns) */
  strictMode: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score < 0.4) return 'var(--green, #22c55e)'
  if (score < 0.62) return 'var(--amber, #f59e0b)'
  return 'var(--red, #ef4444)'
}

function statusLabel(status: BiometricAuthStatus): string {
  switch (status) {
    case 'collecting': return 'Analyzing behavior…'
    case 'evaluating': return 'Evaluating profile…'
    case 'passed':     return 'Identity verified ✓'
    case 'failed':     return 'Anomaly detected'
    case 'learning':   return 'Learning your behavior…'
    case 'disabled':   return 'Biometrics disabled'
    default:           return 'Idle'
  }
}

/** Animated confidence ring (SVG circle) */
function ConfidenceRing({ score, status }: { score: number; status: BiometricAuthStatus }) {
  const R = 36
  const circ = 2 * Math.PI * R
  const fill = status === 'collecting' || status === 'evaluating'
    ? circ * 0.3  // pulse animation coverage
    : circ * (1 - score)

  const color = status === 'passed'
    ? 'var(--green, #22c55e)'
    : status === 'failed'
      ? 'var(--red, #ef4444)'
      : status === 'learning'
        ? 'var(--cyan, #06b6d4)'
        : scoreColor(score)

  return (
    <svg width={88} height={88} viewBox="0 0 88 88" aria-hidden="true">
      {/* Track */}
      <circle
        cx={44} cy={44} r={R}
        fill="none"
        stroke="var(--border, rgba(255,255,255,0.1))"
        strokeWidth={6}
      />
      {/* Score arc */}
      <circle
        cx={44} cy={44} r={R}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${circ - fill} ${fill}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dasharray 0.5s ease, stroke 0.4s ease',
          filter: `drop-shadow(0 0 4px ${color})`,
        }}
      />
      {/* Center icon / score */}
      <text
        x={44} y={48}
        textAnchor="middle"
        fontSize={status === 'collecting' || status === 'evaluating' ? 18 : 13}
        fill={color}
        fontFamily="var(--font-mono, monospace)"
        fontWeight={700}
      >
        {status === 'collecting' || status === 'evaluating'
          ? '…'
          : status === 'learning'
            ? '📖'
            : status === 'passed'
              ? '✓'
              : status === 'failed'
                ? '!'
                : `${Math.round((1 - score) * 100)}%`}
      </text>
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BiometricAuthOverlay({
  status,
  profile,
  lastResult,
  onProceedAnyway,
  onCancel,
  onDismiss,
  strictMode,
}: Props) {
  const [dotCount, setDotCount] = useState(1)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Animate dots while collecting
  useEffect(() => {
    if (status === 'collecting' || status === 'evaluating') {
      timerRef.current = setInterval(() => setDotCount((d) => (d % 3) + 1), 500)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status])

  const samplesCollected = profile?.sampleCount ?? 0
  const samplesNeeded = Math.max(0, MIN_SAMPLES_FOR_PROFILE - samplesCollected)
  const learningPercent = Math.min(100, Math.round((samplesCollected / MIN_SAMPLES_FOR_PROFILE) * 100))
  const score = lastResult?.score ?? 0
  const confidenceScore = lastResult ? Math.round((1 - score) * 100) : 0

  const isAnomaly = lastResult?.isAnomaly ?? false
  const showChallenge = isAnomaly && status === 'failed'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Behavioral Biometric Authentication"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: 'var(--bg-elevated, #111)',
          border: `1px solid ${showChallenge ? 'var(--red, #ef4444)' : status === 'passed' ? 'var(--green, #22c55e)' : 'var(--border, rgba(255,255,255,0.1))'}`,
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '28px 24px',
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: showChallenge
            ? '0 0 32px rgba(239,68,68,0.3)'
            : status === 'passed'
              ? '0 0 32px rgba(34,197,94,0.2)'
              : '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--text-muted, #6b7280)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            Behavioral Biometrics
          </div>
        </div>

        {/* Ring + Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <ConfidenceRing score={score} status={status} />

          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 700,
              color: status === 'passed'
                ? 'var(--green, #22c55e)'
                : status === 'failed'
                  ? 'var(--red, #ef4444)'
                  : 'var(--text-primary, #f9fafb)',
              marginBottom: '4px',
            }}>
              {statusLabel(status)}{(status === 'collecting' || status === 'evaluating') ? '.'.repeat(dotCount) : ''}
            </div>

            {/* Profile status */}
            {profile?.isEstablished ? (
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #9ca3af)' }}>
                {samplesCollected} sessions profiled
                {lastResult && (
                  <span style={{ marginLeft: '6px', color: scoreColor(score) }}>
                    · confidence {confidenceScore}%
                  </span>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #9ca3af)' }}>
                Learning mode · {samplesNeeded} more to establish profile
              </div>
            )}
          </div>
        </div>

        {/* Learning progress bar */}
        {!profile?.isEstablished && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: 'var(--text-muted, #9ca3af)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              <span>Learning Progress</span>
              <span>{samplesCollected}/{MIN_SAMPLES_FOR_PROFILE} transactions</span>
            </div>
            <div style={{
              height: '4px',
              background: 'var(--bg-base, #0a0a0a)',
              borderRadius: '2px',
              overflow: 'hidden',
              border: '1px solid var(--border, rgba(255,255,255,0.08))',
            }}>
              <div style={{
                height: '100%',
                width: `${learningPercent}%`,
                background: 'var(--cyan, #06b6d4)',
                borderRadius: '2px',
                transition: 'width 0.4s ease',
                boxShadow: '0 0 8px var(--cyan, #06b6d4)',
              }} />
            </div>
          </div>
        )}

        {/* Anomaly details */}
        {lastResult && status !== 'learning' && (
          <div style={{
            background: showChallenge
              ? 'rgba(239,68,68,0.08)'
              : 'var(--bg-base, rgba(0,0,0,0.3))',
            border: `1px solid ${showChallenge ? 'var(--red, #ef4444)' : 'var(--border, rgba(255,255,255,0.06))'}`,
            borderRadius: 'var(--radius-sm, 6px)',
            padding: '10px 12px',
            fontSize: '11px',
            color: showChallenge
              ? 'var(--red, #ef4444)'
              : 'var(--text-secondary, #9ca3af)',
            lineHeight: 1.6,
          }}>
            {lastResult.explanation}
          </div>
        )}

        {/* Action buttons */}
        {showChallenge && !strictMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              fontSize: '11px',
              color: 'var(--amber, #f59e0b)',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 'var(--radius-sm, 6px)',
              padding: '8px 12px',
              lineHeight: 1.5,
            }}>
              ⚠ Unusual behavior detected. You can still proceed, but please verify this is you.
            </div>
            <button
              onClick={onProceedAnyway}
              style={{
                padding: '10px 16px',
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid var(--amber, #f59e0b)',
                borderRadius: 'var(--radius-md, 8px)',
                color: 'var(--amber, #f59e0b)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Proceed Anyway
            </button>
            <button
              onClick={onCancel}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: '1px solid var(--border, rgba(255,255,255,0.1))',
                borderRadius: 'var(--radius-md, 8px)',
                color: 'var(--text-muted, #6b7280)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono, monospace)',
                cursor: 'pointer',
              }}
            >
              Cancel Transaction
            </button>
          </div>
        )}

        {showChallenge && strictMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              fontSize: '11px',
              color: 'var(--red, #ef4444)',
              lineHeight: 1.5,
            }}>
              Strict mode is enabled. Transaction signing is blocked due to anomalous behavior.
            </div>
            <button
              onClick={onCancel}
              style={{
                padding: '10px 16px',
                background: 'var(--red-glow, rgba(239,68,68,0.1))',
                border: '1px solid var(--red, #ef4444)',
                borderRadius: 'var(--radius-md, 8px)',
                color: 'var(--red, #ef4444)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel Transaction
            </button>
          </div>
        )}

        {(status === 'passed' || status === 'learning') && (
          <button
            onClick={onDismiss}
            style={{
              padding: '10px 16px',
              background: status === 'passed'
                ? 'rgba(34,197,94,0.1)'
                : 'var(--cyan-glow, rgba(6,182,212,0.1))',
              border: `1px solid ${status === 'passed' ? 'var(--green, #22c55e)' : 'var(--cyan, #06b6d4)'}`,
              borderRadius: 'var(--radius-md, 8px)',
              color: status === 'passed' ? 'var(--green, #22c55e)' : 'var(--cyan, #06b6d4)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {status === 'passed' ? 'Continue Signing' : 'Continue (Learning)'}
          </button>
        )}

        {/* Footer note */}
        <div style={{
          fontSize: '10px',
          color: 'var(--text-muted, #6b7280)',
          textAlign: 'center',
          opacity: 0.7,
        }}>
          Behavioral data is processed locally — nothing leaves your device
        </div>
      </div>
    </div>
  )
}
