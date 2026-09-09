/**
 * AnomalyExplanationPanel.tsx
 * Feature #591: Interactive UI panel for AI-powered anomaly explanations.
 *
 * Displays human-readable explanations for detected anomalies, shows feature
 * importance bars, provides actionable steps, and collects user feedback for
 * continuous learning.
 */

import React, { useState, useCallback } from 'react'
import {
  Brain,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Info,
  BarChart2,
  Star,
  X,
  Lightbulb,
  Code2,
} from 'lucide-react'
import type { AnomalyExplanation, ExplanationConfidence } from '../../lib/anomalyExplanation/anomalyExplainer'
import type { AnomalyExplanationSet } from '../../lib/anomalyExplanation'
import {
  recordAnomalyFeedback,
  getFeedbackStore,
} from '../../lib/anomalyExplanation'
import type { FeedbackRating } from '../../lib/anomalyExplanation'
import type { PatternSeverity } from '../../lib/transactionPatternAnalysis'

// ---------------------------------------------------------------------------
// Style helpers (match the rest of the dashboard's CSS-variable approach)
// ---------------------------------------------------------------------------

function severityColor(s: PatternSeverity): string {
  if (s === 'critical') return 'var(--red)'
  if (s === 'warning')  return 'var(--amber)'
  return 'var(--cyan)'
}

function severityBg(s: PatternSeverity): string {
  if (s === 'critical') return 'rgba(239,68,68,0.06)'
  if (s === 'warning')  return 'rgba(251,191,36,0.06)'
  return 'rgba(6,182,212,0.06)'
}

function confidenceColor(c: ExplanationConfidence): string {
  if (c === 'high')   return 'var(--green)'
  if (c === 'medium') return 'var(--amber)'
  return 'var(--text-muted)'
}

function confidenceLabel(c: ExplanationConfidence): string {
  if (c === 'high')   return 'High confidence'
  if (c === 'medium') return 'Medium confidence'
  return 'Low confidence'
}

function SeverityIcon({ severity }: { severity: PatternSeverity }) {
  if (severity === 'critical') return <ShieldAlert size={14} />
  if (severity === 'warning')  return <AlertTriangle size={14} />
  return <Info size={14} />
}

// ---------------------------------------------------------------------------
// Feature importance bar row
// ---------------------------------------------------------------------------

interface FeatureBarProps {
  name: string
  weight: number
  description: string
  observedValue: string
  typicalValue: string
  direction: 'above_normal' | 'below_normal' | 'unusual'
  color: string
}

function FeatureBar({
  name, weight, description, observedValue, typicalValue, direction, color,
}: FeatureBarProps) {
  const [hovered, setHovered] = useState(false)
  const dirLabel = direction === 'above_normal' ? '↑ above normal'
    : direction === 'below_normal' ? '↓ below normal'
    : '⚡ unusual'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 10px',
        borderRadius: 'var(--radius-sm)',
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
        <span style={{ fontSize: '10px', color, fontFamily: 'var(--font-mono)' }}>{dirLabel}</span>
      </div>

      {/* Weight bar */}
      <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '4px', overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.round(weight * 100)}%`,
            height: '100%',
            background: color,
            borderRadius: '2px',
            transition: 'width 0.6s ease',
          }}
        />
      </div>

      {hovered && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          <span>{description}</span>
          <span style={{ marginLeft: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {observedValue} · typical: {typicalValue}
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Star rating widget
// ---------------------------------------------------------------------------

interface StarRatingProps {
  value: FeedbackRating
  onChange: (v: FeedbackRating) => void
}

function StarRating({ value, onChange }: StarRatingProps) {
  const [hovered, setHovered] = useState<number>(0)
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n as FeedbackRating)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`Rate ${n} star${n !== 1 ? 's' : ''}`}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            color: n <= (hovered || value) ? 'var(--amber)' : 'var(--border)',
            transition: 'color 0.1s',
          }}
        >
          <Star size={14} fill={n <= (hovered || value) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feedback form (inline, collapsible)
// ---------------------------------------------------------------------------

interface FeedbackFormProps {
  explanation: AnomalyExplanation
  onSubmit: () => void
}

function FeedbackForm({ explanation, onSubmit }: FeedbackFormProps) {
  const [helpful, setHelpful] = useState<boolean | null>(null)
  const [rating, setRating] = useState<FeedbackRating>(3)
  const [actionTaken, setActionTaken] = useState<string>('')
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = useCallback(() => {
    if (helpful === null) return
    recordAnomalyFeedback(
      explanation,
      helpful,
      rating,
      actionTaken || null,
      comment,
    )
    setSubmitted(true)
    setTimeout(onSubmit, 1200)
  }, [helpful, rating, actionTaken, comment, explanation, onSubmit])

  if (submitted) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px', color: 'var(--green)' }}>
        <CheckCircle size={14} />
        <span style={{ fontSize: '12px' }}>Thanks for your feedback!</span>
      </div>
    )
  }

  return (
    <div style={{ padding: '10px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
        Was this explanation helpful?
      </div>

      {/* Thumbs row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        {[true, false].map(val => (
          <button
            key={String(val)}
            onClick={() => setHelpful(val)}
            aria-pressed={helpful === val}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${helpful === val ? (val ? 'var(--green)' : 'var(--red)') : 'var(--border)'}`,
              background: helpful === val ? (val ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') : 'transparent',
              color: helpful === val ? (val ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)',
              cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s',
            }}
          >
            {val ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />}
            {val ? 'Yes' : 'No'}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rating:</span>
          <StarRating value={rating} onChange={setRating} />
        </div>
      </div>

      {/* Action taken */}
      {explanation.actionItems.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            Which step did you take? (optional)
          </label>
          <select
            value={actionTaken}
            onChange={e => setActionTaken(e.target.value)}
            style={{
              width: '100%', fontSize: '11px', padding: '4px 6px',
              background: 'var(--background)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
            }}
          >
            <option value="">Select an action…</option>
            {explanation.actionItems.map((a, i) => (
              <option key={i} value={a}>{a.length > 60 ? a.slice(0, 57) + '…' : a}</option>
            ))}
          </select>
        </div>
      )}

      {/* Comment */}
      <textarea
        placeholder="Optional comment…"
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={2}
        style={{
          width: '100%', fontSize: '11px', padding: '6px',
          background: 'var(--background)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
          resize: 'none', boxSizing: 'border-box', marginBottom: '8px',
        }}
      />

      <button
        onClick={handleSubmit}
        disabled={helpful === null}
        style={{
          padding: '5px 14px', fontSize: '12px', fontWeight: 600,
          borderRadius: 'var(--radius-sm)',
          background: helpful !== null ? 'var(--accent)' : 'var(--border)',
          color: helpful !== null ? 'var(--accent-contrast, #fff)' : 'var(--text-muted)',
          border: 'none', cursor: helpful !== null ? 'pointer' : 'default',
          transition: 'background 0.15s',
        }}
      >
        Submit feedback
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single explanation card
// ---------------------------------------------------------------------------

interface ExplanationCardProps {
  explanation: AnomalyExplanation
  defaultExpanded?: boolean
}

function ExplanationCard({ explanation, defaultExpanded = false }: ExplanationCardProps) {
  const [expanded, setExpanded]         = useState(defaultExpanded)
  const [showFeatures, setShowFeatures] = useState(false)
  const [showTechnical, setShowTechnical] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(
    getFeedbackStore().hasFeedback(explanation.id)
  )

  const color = severityColor(explanation.severity)
  const confColor = confidenceColor(explanation.confidence)

  return (
    <div
      style={{
        background: severityBg(explanation.severity),
        border: `1px solid ${color}22`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        transition: 'var(--transition)',
      }}
    >
      {/* ── Header row ── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(e => !e)}
        onKeyDown={e => e.key === 'Enter' && setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '12px 14px', cursor: 'pointer',
        }}
      >
        <span style={{ color, marginTop: '2px', flexShrink: 0 }}>
          <SeverityIcon severity={explanation.severity} />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
            {explanation.headline}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {explanation.category}
            </span>
            <span style={{ fontSize: '10px', color: confColor }}>
              {confidenceLabel(explanation.confidence)}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              magnitude {explanation.anomalyMagnitude}%
            </span>
          </div>
        </div>

        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {/* Confidence bar */}
      <div style={{ margin: '0 14px 10px', height: '2px', background: 'var(--border)', borderRadius: '1px', overflow: 'hidden' }}>
        <div style={{
          width: `${explanation.anomalyMagnitude}%`,
          height: '100%',
          background: color,
          borderRadius: '1px',
          transition: 'width 0.6s ease',
        }} />
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div style={{ padding: '0 14px 14px' }}>

          {/* Summary */}
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
            {explanation.summary}
          </p>

          {/* Action items */}
          {explanation.actionItems.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <Lightbulb size={12} color="var(--amber)" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Recommended actions
                </span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {explanation.actionItems.map((action, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '5px' }}>
                    <span style={{ fontSize: '10px', color, fontWeight: 700, marginTop: '2px', flexShrink: 0 }}>
                      {i + 1}.
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {action}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Feature importance (collapsible) */}
          {explanation.topFeatures.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <button
                onClick={() => setShowFeatures(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                  marginBottom: showFeatures ? '8px' : '0',
                }}
              >
                <BarChart2 size={12} color="var(--text-muted)" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Contributing factors
                </span>
                {showFeatures ? <ChevronUp size={11} color="var(--text-muted)" /> : <ChevronDown size={11} color="var(--text-muted)" />}
              </button>

              {showFeatures && explanation.topFeatures.map((f, i) => (
                <FeatureBar
                  key={i}
                  name={f.name}
                  weight={f.weight}
                  description={f.description}
                  observedValue={f.observedValue}
                  typicalValue={f.typicalValue}
                  direction={f.direction}
                  color={color}
                />
              ))}
            </div>
          )}

          {/* Technical details (collapsible) */}
          <div style={{ marginBottom: '10px' }}>
            <button
              onClick={() => setShowTechnical(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                marginBottom: showTechnical ? '6px' : '0',
              }}
            >
              <Code2 size={12} color="var(--text-muted)" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Technical details
              </span>
              {showTechnical ? <ChevronUp size={11} color="var(--text-muted)" /> : <ChevronDown size={11} color="var(--text-muted)" />}
            </button>

            {showTechnical && (
              <p style={{
                fontSize: '11px', fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)', lineHeight: 1.6,
                background: 'var(--surface)', padding: '8px 10px',
                borderRadius: 'var(--radius-sm)', margin: 0,
              }}>
                {explanation.technicalContext}
              </p>
            )}
          </div>

          {/* Feedback */}
          {!feedbackDone && !showFeedback && (
            <button
              onClick={() => setShowFeedback(true)}
              style={{
                fontSize: '11px', color: 'var(--text-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                textDecoration: 'underline', padding: '0',
              }}
            >
              Was this explanation helpful?
            </button>
          )}

          {showFeedback && !feedbackDone && (
            <FeedbackForm
              explanation={explanation}
              onSubmit={() => { setFeedbackDone(true); setShowFeedback(false) }}
            />
          )}

          {feedbackDone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--green)', fontSize: '11px' }}>
              <CheckCircle size={11} />
              Feedback recorded — explanations will improve over time.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export interface AnomalyExplanationPanelProps {
  explanationSet: AnomalyExplanationSet
  onClose?: () => void
  /** If true, the overall explanation is shown at the top */
  showOverall?: boolean
}

export default function AnomalyExplanationPanel({
  explanationSet,
  onClose,
  showOverall = true,
}: AnomalyExplanationPanelProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || explanationSet.count === 0) return null

  const { patternExplanations, overallExplanation } = explanationSet

  return (
    <div
      role="region"
      aria-label="AI Anomaly Explanations"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Brain size={16} color="var(--accent)" />
          <div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              AI Anomaly Explanations
            </span>
            <span
              style={{
                marginLeft: '8px', fontSize: '10px', fontWeight: 600,
                padding: '2px 6px', borderRadius: '999px',
                background: 'var(--accent)', color: 'var(--accent-contrast, #fff)',
              }}
            >
              {explanationSet.count}
            </span>
          </div>
          {explanationSet.hasHighConfidence && (
            <span
              style={{
                fontSize: '10px', padding: '2px 7px', borderRadius: '999px',
                background: 'rgba(34,197,94,0.12)', color: 'var(--green)', fontWeight: 600,
              }}
            >
              High confidence
            </span>
          )}
        </div>

        {onClose && (
          <button
            onClick={() => { setDismissed(true); onClose() }}
            aria-label="Close explanations panel"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '2px',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Overall explanation first (if notable) */}
        {showOverall && overallExplanation && (
          <ExplanationCard
            key={overallExplanation.id}
            explanation={overallExplanation}
            defaultExpanded={patternExplanations.length === 0}
          />
        )}

        {/* Per-pattern explanations */}
        {patternExplanations.map((exp, i) => (
          <ExplanationCard
            key={exp.id}
            explanation={exp}
            defaultExpanded={i === 0 && !overallExplanation}
          />
        ))}

        {/* Footer hint */}
        <div
          style={{
            fontSize: '10px', color: 'var(--text-muted)',
            textAlign: 'center', paddingTop: '4px',
          }}
        >
          Explanations are generated client-side and improve with your feedback.
        </div>
      </div>
    </div>
  )
}
