/**
 * ProactiveSuggestions
 *
 * UI component that displays predicted search queries before the user
 * even starts typing. These contextual suggestions are powered by the
 * QueryPredictionEngine and adapt based on user behavior, current page,
 * active task, time of day, and historical patterns.
 *
 * Design goals:
 * - Visually appealing with smooth animations
 * - Non-intrusive when not needed
 * - Clear feedback mechanisms (click, dismiss, hover states)
 * - Accessible (keyboard navigable, screen reader friendly)
 * - Responsive across viewport sizes
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Lightbulb,
  Zap,
  TrendingUp,
  Clock,
  Target,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BarChart3,
  Search,
  History,
  Activity,
  Globe,
  ArrowRight,
} from 'lucide-react'
import type { QueryPrediction, QueryPredictionReason } from '../../lib/queryPredictionEngine'
import type { IntentPrediction } from '../../lib/searchIntentClassifier'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProactiveSuggestionsProps {
  /** Predicted queries to display */
  predictions: QueryPrediction[]
  /** Predicted intents */
  intentPredictions?: IntentPrediction[]
  /** Called when user clicks a suggestion */
  onSelect: (prediction: QueryPrediction) => void
  /** Called when user dismisses a suggestion */
  onDismiss?: (prediction: QueryPrediction) => void
  /** Whether to show as a dropdown or inline chips */
  variant?: 'chips' | 'cards' | 'inline'
  /** Max predictions to show */
  maxVisible?: number
  /** Show confidence indicator */
  showConfidence?: boolean
  /** Show reasoning indicator */
  showReason?: boolean
  /** Show intent predictions */
  showIntents?: boolean
  /** Title text */
  title?: string
  /** Whether suggestions are loading */
  loading?: boolean
  /** Additional class name */
  className?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REASON_ICONS: Record<QueryPredictionReason, React.ReactNode> = {
  frequent_search: <History size={12} />,
  contextual_match: <Target size={12} />,
  time_based: <Clock size={12} />,
  task_based: <Activity size={12} />,
  recent_activity: <Zap size={12} />,
  network_based: <Globe size={12} />,
  entity_based: <Search size={12} />,
  ml_inferred: <Sparkles size={12} />,
}

const REASON_LABELS: Record<QueryPredictionReason, string> = {
  frequent_search: 'Frequent',
  contextual_match: 'Context',
  time_based: 'Timely',
  task_based: 'Task',
  recent_activity: 'Recent',
  network_based: 'Network',
  entity_based: 'Related',
  ml_inferred: 'AI',
}

const CONFIDENCE_COLORS = {
  high: 'var(--green, #22c55e)',
  medium: 'var(--cyan, #06b6d4)',
  low: 'var(--text-muted, #6b7280)',
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return CONFIDENCE_COLORS.high
  if (confidence >= 0.45) return CONFIDENCE_COLORS.medium
  return CONFIDENCE_COLORS.low
}

// ---------------------------------------------------------------------------
// Chip variant sub-component
// ---------------------------------------------------------------------------

interface SuggestionChipProps {
  prediction: QueryPrediction
  onSelect: (p: QueryPrediction) => void
  onDismiss?: (p: QueryPrediction) => void
  showConfidence: boolean
  showReason: boolean
}

function SuggestionChip({
  prediction,
  onSelect,
  onDismiss,
  showConfidence,
  showReason,
}: SuggestionChipProps) {
  const [hovered, setHovered] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissed(true)
    onDismiss?.(prediction)
  }

  return (
    <button
      onClick={() => onSelect(prediction)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        background: hovered
          ? 'var(--bg-elevated)'
          : 'var(--bg-card)',
        border: `1px solid ${hovered ? getConfidenceColor(prediction.confidence) : 'var(--border)'}`,
        borderRadius: '999px',
        cursor: 'pointer',
        fontSize: '12px',
        color: 'var(--text-primary)',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-sans)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        boxShadow: hovered
          ? `0 2px 8px ${getConfidenceColor(prediction.confidence)}20`
          : 'none',
      }}
      aria-label={`Search for "${prediction.query}"`}
      title={`${prediction.query} (${Math.round(prediction.confidence * 100)}% confidence)`}
    >
      {prediction.mlGenerated && (
        <Sparkles size={11} color="var(--cyan)" />
      )}
      <span>{prediction.query}</span>

      {showConfidence && prediction.confidence >= 0.6 && (
        <span
          style={{
            fontSize: '10px',
            color: getConfidenceColor(prediction.confidence),
            fontWeight: 600,
            paddingLeft: '2px',
          }}
        >
          {Math.round(prediction.confidence * 100)}%
        </span>
      )}

      {showReason && (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            fontSize: '9px',
            color: 'var(--text-muted)',
            paddingLeft: '2px',
            borderLeft: '1px solid var(--border)',
          }}
        >
          {REASON_ICONS[prediction.reason]}
          {REASON_LABELS[prediction.reason]}
        </span>
      )}

      {onDismiss && hovered && (
        <button
          onClick={handleDismiss}
          aria-label={`Dismiss suggestion "${prediction.query}"`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: 'var(--bg-hover)',
            cursor: 'pointer',
            marginLeft: '2px',
            border: 'none',
            padding: 0,
          }}
        >
          <X size={10} color="var(--text-muted)" />
        </button>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Card variant sub-component
// ---------------------------------------------------------------------------

interface SuggestionCardProps {
  prediction: QueryPrediction
  onSelect: (p: QueryPrediction) => void
  onDismiss?: (p: QueryPrediction) => void
  showConfidence: boolean
  index: number
}

function SuggestionCard({
  prediction,
  onSelect,
  onDismiss,
  showConfidence,
  index,
}: SuggestionCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={() => onSelect(prediction)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        background: hovered ? 'var(--bg-elevated)' : 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.15s ease',
        animationDelay: `${index * 50}ms`,
        animation: 'fadinup-proactive 0.3s ease both',
      }}
      aria-label={`Search for "${prediction.query}"`}
    >
      {/* Icon */}
      <div
        style={{
          flexShrink: 0,
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: prediction.mlGenerated
            ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(6, 182, 212, 0.05))'
            : 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: prediction.mlGenerated
            ? 'var(--cyan)'
            : 'var(--text-muted)',
        }}
      >
        {prediction.mlGenerated ? <Sparkles size={14} /> : <Search size={14} />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {prediction.query}
        </div>
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '2px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {REASON_ICONS[prediction.reason]}
            {REASON_LABELS[prediction.reason]}
          </span>
          <span>•</span>
          <span>{prediction.intent}</span>
        </div>
      </div>

      {/* Confidence bar */}
      {showConfidence && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              background: 'var(--bg-hover)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.round(prediction.confidence * 100)}%`,
                background: getConfidenceColor(prediction.confidence),
                borderRadius: '2px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '9px',
              color: getConfidenceColor(prediction.confidence),
              fontWeight: 600,
            }}
          >
            {Math.round(prediction.confidence * 100)}%
          </span>
        </div>
      )}

      {/* Arrow */}
      {hovered && (
        <ArrowRight
          size={14}
          color="var(--text-muted)"
          style={{ flexShrink: 0, opacity: 0.5 }}
        />
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Intent prediction pills
// ---------------------------------------------------------------------------

interface IntentPillsProps {
  intents: IntentPrediction[]
  onSelectIntent?: (intent: string) => void
}

function IntentPills({ intents, onSelectIntent }: IntentPillsProps) {
  if (!intents.length) return null

  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {intents.slice(0, 3).map((ip) => (
        <button
          key={ip.intent}
          onClick={() => onSelectIntent?.(ip.intent)}
          style={{
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '10px',
            fontWeight: 500,
            border: '1px solid var(--border)',
            background: `rgba(6, 182, 212, ${ip.probability * 0.1})`,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `rgba(6, 182, 212, 0.2)`
            e.currentTarget.style.borderColor = 'var(--cyan)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `rgba(6, 182, 212, ${ip.probability * 0.1})`
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          {ip.intent} ({Math.round(ip.probability * 100)}%)
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ProactiveSuggestions: React.FC<ProactiveSuggestionsProps> = ({
  predictions,
  intentPredictions,
  onSelect,
  onDismiss,
  variant = 'chips',
  maxVisible = 6,
  showConfidence = true,
  showReason = true,
  showIntents = true,
  title = 'Suggested Searches',
  loading = false,
  className,
}) => {
  const [scrollPos, setScrollPos] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const visible = predictions.slice(0, maxVisible)

  const handleScroll = (direction: 'left' | 'right') => {
    const container = scrollRef.current
    if (!container) return
    const scrollAmount = 200
    const newPos = direction === 'left'
      ? Math.max(0, scrollPos - scrollAmount)
      : scrollPos + scrollAmount
    container.scrollTo({ left: newPos, behavior: 'smooth' })
    setScrollPos(newPos)
  }

  // Track scroll position
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const handleScrollEvent = () => {
      setScrollPos(container.scrollLeft)
    }

    container.addEventListener('scroll', handleScrollEvent, { passive: true })
    return () => container.removeEventListener('scroll', handleScrollEvent)
  }, [])

  if (!visible.length && !loading) {
    return null
  }

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        animation: 'fadin-proactive 0.3s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Lightbulb size={13} color="var(--cyan)" />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {title}
          </span>
          {loading && (
            <div
              style={{
                width: '14px',
                height: '14px',
                border: '2px solid var(--border)',
                borderTopColor: 'var(--cyan)',
                borderRadius: '50%',                    animation: 'spin-proactive 0.6s linear infinite',
              }}
            />
          )}
        </div>

        {/* Navigation arrows (only for chips variant) */}
        {variant === 'chips' && visible.length > 3 && (
          <div style={{ display: 'flex', gap: '2px' }}>
            <button
              onClick={() => handleScroll('left')}
              disabled={scrollPos <= 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '22px',
                height: '22px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-muted)',
                cursor: scrollPos <= 0 ? 'default' : 'pointer',
                opacity: scrollPos <= 0 ? 0.4 : 1,
                padding: 0,
              }}
              aria-label="Scroll suggestions left"
            >
              <ChevronLeft size={12} />
            </button>
            <button
              onClick={() => handleScroll('right')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '22px',
                height: '22px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 0,
              }}
              aria-label="Scroll suggestions right"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Intent predictions */}
      {showIntents && intentPredictions && intentPredictions.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <IntentPills intents={intentPredictions} />
        </div>
      )}

      {/* No predictions state */}
      {!loading && !visible.length && (
        <div
          style={{
            padding: '12px',
            textAlign: 'center',
            fontSize: '12px',
            color: 'var(--text-muted)',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border)',
          }}
        >
          <Sparkles size={14} style={{ marginBottom: '4px', opacity: 0.5 }} />
          <div>Search more to get personalized suggestions</div>
        </div>
      )}

      {/* Chips variant */}
      {variant === 'chips' && visible.length > 0 && (
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            paddingBottom: '4px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {visible.map((prediction) => (
            <SuggestionChip
              key={prediction.query}
              prediction={prediction}
              onSelect={onSelect}
              onDismiss={onDismiss}
              showConfidence={showConfidence}
              showReason={showReason}
            />
          ))}
        </div>
      )}

      {/* Cards variant */}
      {variant === 'cards' && visible.length > 0 && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          {visible.map((prediction, idx) => (
            <SuggestionCard
              key={prediction.query}
              prediction={prediction}
              onSelect={onSelect}
              onDismiss={onDismiss}
              showConfidence={showConfidence}
              index={idx}
            />
          ))}
        </div>
      )}

      {/* Inline variant */}
      {variant === 'inline' && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {visible.map((prediction) => (
            <button
              key={prediction.query}
              onClick={() => onSelect(prediction)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--text-primary)',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <TrendingUp size={12} color={getConfidenceColor(prediction.confidence)} />
              <span style={{ flex: 1 }}>{prediction.query}</span>
              {showReason && (
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                  {REASON_LABELS[prediction.reason]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}      {/* Global keyframe animation styles — injected once */}
      <style>{`
        @keyframes fadin-proactive {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadinup-proactive {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin-proactive {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}
      </style>
    </div>
  )
}

export default ProactiveSuggestions
export { REASON_LABELS, REASON_ICONS, getConfidenceColor }
