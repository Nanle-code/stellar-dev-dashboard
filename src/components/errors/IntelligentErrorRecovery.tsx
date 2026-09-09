/**
 * IntelligentErrorRecovery.tsx
 *
 * UI component that displays personalized, expertise-aware error recovery guidance.
 * Shows classified error info, ranked solutions with confidence scores,
 * step-by-step recovery instructions, and collects resolution feedback
 * to improve future recommendations.
 *
 * Integrates with:
 *   - useErrorRecoveryGuidance hook
 *   - ErrorBoundary / ErrorFallback
 *   - Existing design system CSS variables
 */

import React, { useState, useCallback } from 'react'
import { useErrorRecoveryGuidance } from '../../hooks/useErrorRecoveryGuidance'
import type { RecoveryGuidance, RecommendedSolution, ExpertiseLevel } from '../../lib/errorHandling/ErrorRecoveryEngine'
import { ERROR_CATEGORIES } from '../../utils/errorHandler'

// ─── Visual helpers ───────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  [ERROR_CATEGORIES.NETWORK]: '🌐',
  [ERROR_CATEGORIES.VALIDATION]: '⚠️',
  [ERROR_CATEGORIES.STELLAR]: '⭐',
  [ERROR_CATEGORIES.AUTHENTICATION]: '🔐',
  [ERROR_CATEGORIES.PERMISSION]: '🚫',
  [ERROR_CATEGORIES.RATE_LIMIT]: '⏱️',
  [ERROR_CATEGORIES.UNKNOWN]: '❌',
}

const SEVERITY_COLORS: Record<string, string> = {
  low: 'var(--amber, #f59e0b)',
  medium: 'var(--cyan, #06b6d4)',
  high: 'var(--red, #ef4444)',
  critical: 'var(--red, #ef4444)',
}

const EXPERTISE_LABELS: Record<ExpertiseLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
}

const EXPERTISE_DESCRIPTIONS: Record<ExpertiseLevel, string> = {
  beginner: 'Simple, jargon-free explanations',
  intermediate: 'Technical context with key terms',
  expert: 'Full technical detail and API references',
}

function confidencePercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'var(--green, #22c55e)'
  if (confidence >= 0.5) return 'var(--amber, #f59e0b)'
  return 'var(--red, #ef4444)'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ExpertiseSelectorProps {
  level: ExpertiseLevel
  onChange: (level: ExpertiseLevel) => void
}

function ExpertiseSelector({ level, onChange }: ExpertiseSelectorProps) {
  const levels: ExpertiseLevel[] = ['beginner', 'intermediate', 'expert']
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px' }}>
        Level:
      </span>
      {levels.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          style={{
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: level === l ? 'var(--cyan)' : 'var(--bg-elevated)',
            color: level === l ? 'var(--bg-base)' : 'var(--text-muted)',
            transition: 'var(--transition)',
          }}
        >
          {EXPERTISE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}

interface SolutionCardProps {
  solution: RecommendedSolution
  expertiseLevel: ExpertiseLevel
  errorSignature: string
  onResolve: (solutionId: string, successful: boolean) => void
  index: number
}

function SolutionCard({ solution, expertiseLevel, errorSignature, onResolve, index }: SolutionCardProps) {
  const [expanded, setExpanded] = useState(index === 0)
  const [currentStep, setCurrentStep] = useState(0)
  const [resolved, setResolved] = useState<boolean | null>(null)

  const s = solution.solution
  const conf = solution.confidence

  const handleResolve = useCallback(
    (successful: boolean) => {
      setResolved(successful)
      onResolve(s.id, successful)
    },
    [s.id, onResolve],
  )

  const handleNextStep = () => {
    if (currentStep < solution.adaptedSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${resolved === true ? 'var(--green, #22c55e)' : resolved === false ? 'var(--red, #ef4444)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transition: 'var(--transition)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <span
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'var(--cyan)',
              color: 'var(--bg-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {index + 1}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '13px', fontFamily: 'var(--font-display)' }}>
              {s.title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {s.summary}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Confidence badge */}
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: `${confidenceColor(conf)}22`,
              color: confidenceColor(conf),
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {confidencePercent(conf)}
          </span>
          {/* Learned stats */}
          {solution.attempts > 0 && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {solution.successes}/{solution.attempts} ok
            </span>
          )}
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Body */}
      {expanded && !resolved && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Explanation (expertise-aware) */}
          <div
            style={{
              padding: '12px',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              marginBottom: '12px',
              fontSize: '13px',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Explanation ({EXPERTISE_LABELS[expertiseLevel]})
            </div>
            {s.explanation[expertiseLevel]}
          </div>

          {/* Prerequisites */}
          {s.prerequisites && s.prerequisites.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Prerequisites
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                {s.prerequisites.map((pre, i) => (
                  <li key={i}>{pre}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {solution.adaptedSteps.map((step, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '10px 12px',
                  background: i === currentStep ? 'var(--cyan)11' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  border: i === currentStep ? '1px solid var(--cyan)44' : '1px solid transparent',
                  opacity: i <= currentStep ? 1 : 0.5,
                  transition: 'var(--transition)',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: i < currentStep ? 'var(--green, #22c55e)' : i === currentStep ? 'var(--cyan)' : 'var(--bg-elevated)',
                    color: i <= currentStep ? 'var(--bg-base)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '1px',
                  }}
                >
                  {i < currentStep ? '✓' : step.step}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {step.title}
                    {step.automated && (
                      <span style={{ marginLeft: '6px', fontSize: '9px', padding: '1px 5px', background: 'var(--cyan)22', color: 'var(--cyan)', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                        AUTO
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {step.description}
                  </div>
                  {step.expectedOutcome && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                      → {step.expectedOutcome}
                    </div>
                  )}
                  {step.actionLabel && i === currentStep && (
                    <button
                      style={{
                        marginTop: '8px',
                        padding: '4px 12px',
                        background: 'var(--cyan)',
                        color: 'var(--bg-base)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {step.actionLabel}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Step navigation */}
          {solution.adaptedSteps.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                onClick={handlePrevStep}
                disabled={currentStep === 0}
                style={{
                  padding: '4px 12px',
                  fontSize: '11px',
                  background: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                  opacity: currentStep === 0 ? 0.4 : 1,
                }}
              >
                ← Previous
              </button>
              <button
                onClick={handleNextStep}
                disabled={currentStep === solution.adaptedSteps.length - 1}
                style={{
                  padding: '4px 12px',
                  fontSize: '11px',
                  background: 'var(--bg-card)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: currentStep === solution.adaptedSteps.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: currentStep === solution.adaptedSteps.length - 1 ? 0.4 : 1,
                }}
              >
                Next →
              </button>
            </div>
          )}

          {/* Resolution feedback */}
          <div
            style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Did this help?</span>
            <button
              onClick={() => handleResolve(true)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                background: 'var(--green, #22c55e)22',
                color: 'var(--green, #22c55e)',
                border: '1px solid var(--green, #22c55e)44',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              ✓ Yes, it worked
            </button>
            <button
              onClick={() => handleResolve(false)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                background: 'var(--red, #ef4444)22',
                color: 'var(--red, #ef4444)',
                border: '1px solid var(--red, #ef4444)44',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}
            >
              ✗ No, still failing
            </button>
          </div>
        </div>
      )}

      {/* Resolved state */}
      {resolved !== null && (
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: resolved ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)',
          }}
        >
          {resolved ? '✓' : '✗'} {resolved ? 'Great! This solution worked. The system will remember this for next time.' : 'Thanks for the feedback. Try the next solution below or report the issue.'}
        </div>
      )}
    </div>
  )
}

interface ClassificationBadgeProps {
  guidance: RecoveryGuidance
}

function ClassificationBadge({ guidance }: ClassificationBadgeProps) {
  const { category, severity, subType, confidence } = guidance.classification
  const icon = CATEGORY_ICONS[category] || '❌'
  const color = SEVERITY_COLORS[severity] || 'var(--red)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        background: `${color}11`,
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${color}33`,
        marginBottom: '16px',
      }}
    >
      <span style={{ fontSize: '28px' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: `${color}22`,
              color,
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {category}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-muted)',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {severity}
          </span>
          {subType !== 'generic' && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)',
                color: 'var(--cyan)',
                fontSize: '10px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {subType}
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {guidance.classification.errorMessage}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>Recovery Confidence</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: confidenceColor(confidence), fontFamily: 'var(--font-mono)' }}>
          {confidencePercent(confidence)}
        </div>
      </div>
    </div>
  )
}

interface RecoveryStatsBarProps {
  stats: ReturnType<typeof useErrorRecoveryGuidance>['stats']
}

function RecoveryStatsBar({ stats }: RecoveryStatsBarProps) {
  if (stats.totalAttempts === 0) return null

  const rate = Math.round(stats.successRate * 100)
  const rateColor = rate >= 80 ? 'var(--green, #22c55e)' : rate >= 50 ? 'var(--amber, #f59e0b)' : 'var(--red, #ef4444)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '8px 16px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        marginBottom: '12px',
        fontSize: '11px',
        color: 'var(--text-muted)',
      }}
    >
      <span>📊 Recovery Stats:</span>
      <span style={{ color: rateColor, fontWeight: 700 }}>{rate}% success</span>
      <span>{stats.totalSuccesses}/{stats.totalAttempts} resolved</span>
      {Object.entries(stats.byCategory).slice(0, 3).map(([cat, data]) => (
        <span key={cat} style={{ fontFamily: 'var(--font-mono)' }}>
          {cat}: {Math.round(data.rate * 100)}%
        </span>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface IntelligentErrorRecoveryProps {
  /** Pre-analyzed guidance to display (optional) */
  guidance?: RecoveryGuidance | null
  /** Error to analyze (if guidance not provided) */
  error?: unknown
  /** Context for the error */
  context?: string
  /** Whether to show the expertise selector */
  showExpertiseSelector?: boolean
  /** Whether to show recovery stats */
  showStats?: boolean
  /** Called when the user closes the recovery panel */
  onClose?: () => void
}

export function IntelligentErrorRecovery({
  guidance: initialGuidance,
  error,
  context,
  showExpertiseSelector = true,
  showStats = true,
  onClose,
}: IntelligentErrorRecoveryProps) {
  const {
    guidance: hookGuidance,
    analyzeError,
    recordSuccess,
    recordFailure,
    expertiseLevel,
    setExpertise,
    stats,
  } = useErrorRecoveryGuidance()

  // Use provided guidance or analyze the error
  const guidance = initialGuidance || hookGuidance

  // Analyze error on mount if provided and no guidance
  React.useEffect(() => {
    if (!guidance && error) {
      analyzeError(error, context)
    }
  }, [error]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResolve = useCallback(
    (solutionId: string, successful: boolean) => {
      if (guidance) {
        const errorSig = `${guidance.classification.category}::${guidance.classification.errorMessage}`
        if (successful) {
          recordSuccess(solutionId, errorSig, context)
        } else {
          recordFailure(solutionId, errorSig, context)
        }
      }
    },
    [guidance, recordSuccess, recordFailure, context],
  )

  if (!guidance) {
    return null
  }

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🧠</span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--text-primary)',
            }}
          >
            Intelligent Error Recovery
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {showExpertiseSelector && (
            <ExpertiseSelector level={expertiseLevel} onChange={setExpertise} />
          )}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 18px' }}>
        {/* Stats bar */}
        {showStats && <RecoveryStatsBar stats={stats} />}

        {/* Error classification */}
        <ClassificationBadge guidance={guidance} />

        {/* Expertise hint */}
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', fontStyle: 'italic' }}>
          Explanations adapted for: {EXPERTISE_LABELS[expertiseLevel]} — {EXPERTISE_DESCRIPTIONS[expertiseLevel]}
        </div>

        {/* Solutions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {guidance.solutions.map((sol, i) => (
            <SolutionCard
              key={sol.solution.id}
              solution={sol}
              expertiseLevel={expertiseLevel}
              errorSignature={`${guidance.classification.category}::${guidance.classification.errorMessage}`}
              onResolve={handleResolve}
              index={i}
            />
          ))}
        </div>

        {/* Related info */}
        {guidance.solutions.length === 0 && (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}
          >
            No solutions found for this error. Please report it so we can add recovery guidance.
          </div>
        )}
      </div>
    </div>
  )
}

export default IntelligentErrorRecovery
