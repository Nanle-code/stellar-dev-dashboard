import React, { useState, useEffect, useCallback } from 'react'
import { useStore } from '../../lib/store'
import {
  PredictiveFeatureSuggestions as PFS,
  globalPredictiveSuggestions,
  type Suggestion,
} from '../../lib/predictiveFeatureSuggestions'
import { Lightbulb, X, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'

interface Props {
  onNavigate: (tab: string) => void
}

export default function PredictiveFeatureSuggestions({ onNavigate }: Props) {
  const { activeTab } = useStore()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [disabled, setDisabled] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [engine] = useState<PFS>(globalPredictiveSuggestions)

  useEffect(() => {
    engine.initialize().then(() => {
      setDisabled(engine.isDisabled())
      if (!engine.isDisabled()) {
        const results = engine.getSuggestions(activeTab, 3)
        const filtered = results.filter(s => !dismissedIds.has(s.featureId))
        setSuggestions(filtered)
      }
    })
  }, [engine, activeTab, dismissedIds])

  useEffect(() => {
    if (!disabled) {
      engine.recordInteraction(activeTab, activeTab)
    }
  }, [engine, activeTab, disabled])

  const handleUse = useCallback((suggestion: Suggestion) => {
    engine.recordFeedback(`sug-${suggestion.featureId}-${Date.now()}`, suggestion.featureId, 'used')
    setDismissedIds(prev => new Set(prev).add(suggestion.featureId))
    onNavigate(suggestion.featureId)
  }, [engine, onNavigate])

  const handleThumbsUp = useCallback((suggestion: Suggestion) => {
    engine.recordFeedback(`sug-${suggestion.featureId}-${Date.now()}`, suggestion.featureId, 'thumbsUp')
    setDismissedIds(prev => new Set(prev).add(suggestion.featureId))
  }, [engine])

  const handleThumbsDown = useCallback((suggestion: Suggestion) => {
    engine.recordFeedback(`sug-${suggestion.featureId}-${Date.now()}`, suggestion.featureId, 'thumbsDown')
    setDismissedIds(prev => new Set(prev).add(suggestion.featureId))
  }, [engine])

  const handleDismiss = useCallback((suggestion: Suggestion) => {
    engine.recordFeedback(`sug-${suggestion.featureId}-${Date.now()}`, suggestion.featureId, 'dismissed')
    setDismissedIds(prev => new Set(prev).add(suggestion.featureId))
  }, [engine])

  const handleToggleDisabled = useCallback(async () => {
    const next = !disabled
    setDisabled(next)
    await engine.setDisabled(next)
    if (!next) {
      setDismissedIds(new Set())
      const results = engine.getSuggestions(activeTab, 3)
      setSuggestions(results)
    }
  }, [disabled, engine, activeTab])

  if (disabled || suggestions.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        zIndex: 1050,
        maxWidth: '340px',
        width: '100%',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'var(--bg-elevated)',
            borderBottom: collapsed ? 'none' : '1px solid var(--border)',
            cursor: 'pointer',
          }}
          onClick={() => setCollapsed(!collapsed)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="var(--cyan, #06b6d4)" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Suggestions
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleToggleDisabled() }}
              title="Disable suggestions"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '11px',
              }}
            >
              <X size={14} />
            </button>
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>

        {!collapsed && (
          <div style={{ padding: '8px' }}>
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.featureId}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  marginBottom: '6px',
                  transition: 'var(--transition)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--cyan, #06b6d4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lightbulb size={14} color="var(--cyan, #06b6d4)" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {suggestion.feature.label}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        background: suggestion.confidence === 'high'
                          ? 'rgba(6, 182, 212, 0.15)'
                          : suggestion.confidence === 'medium'
                          ? 'rgba(251, 191, 36, 0.15)'
                          : 'rgba(148, 163, 184, 0.15)',
                        color: suggestion.confidence === 'high'
                          ? 'var(--cyan, #06b6d4)'
                          : suggestion.confidence === 'medium'
                          ? '#fbbf24'
                          : 'var(--text-tertiary)',
                      }}
                    >
                      {suggestion.confidence}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                  {suggestion.reason}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => handleUse(suggestion)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: 'var(--cyan, #06b6d4)',
                      color: '#0a0a0a',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                    }}
                  >
                    Open
                  </button>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => handleThumbsUp(suggestion)}
                      title="Good suggestion"
                      style={{
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '12px',
                      }}
                    >
                      <ThumbsUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThumbsDown(suggestion)}
                      title="Not relevant"
                      style={{
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '12px',
                      }}
                    >
                      <ThumbsDown size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismiss(suggestion)}
                      title="Dismiss"
                      style={{
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '12px',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ padding: '6px 4px 2px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleToggleDisabled}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  textDecoration: 'underline',
                  padding: '2px',
                }}
              >
                Disable suggestions
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
