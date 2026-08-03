import React, { useState } from 'react'
import {
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Trash2,
  Info,
  CheckCircle2,
  Zap,
  Layers,
} from 'lucide-react'
import { useContractRecommendations } from '../../hooks/useContractRecommendations'

function Panel({ title, subtitle, children }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>{title}</div>
        {subtitle && (
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ padding: '18px' }}>{children}</div>
    </div>
  )
}

function ActionButton({ label, onClick, disabled, tone = 'primary', icon }) {
  const palette = tone === 'secondary'
    ? { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-bright)' }
    : { background: 'var(--cyan)', color: 'var(--bg-base)', border: 'none' }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 14px',
        background: disabled ? 'var(--bg-elevated)' : palette.background,
        color: disabled ? 'var(--text-muted)' : palette.color,
        border: disabled ? '1px solid var(--border)' : palette.border,
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        fontSize: '11px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'var(--transition)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {icon}{label}
    </button>
  )
}

function ConfidenceBadge({ confidence }) {
  const color = confidence >= 0.7 ? 'var(--green)' : confidence >= 0.4 ? 'var(--amber)' : 'var(--text-muted)'
  const label = confidence >= 0.7 ? 'High' : confidence >= 0.4 ? 'Medium' : 'Low'
  return (
    <span style={{
      fontSize: '9px',
      fontWeight: 700,
      color,
      border: `1px solid ${color}`,
      borderRadius: '999px',
      padding: '2px 8px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    }}>
      {label}
    </span>
  )
}

function QualityIndicator({ quality }) {
  const color = quality.status === 'high' ? 'var(--green)' : quality.status === 'medium' ? 'var(--amber)' : 'var(--text-muted)'
  const label = quality.status === 'high' ? 'High Accuracy' : quality.status === 'medium' ? 'Improving' : 'Learning'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color }}>
      {quality.status === 'high' ? <CheckCircle2 size={14} /> : <TrendingUp size={14} />}
      <span>{label} ({quality.accuracy}%)</span>
    </div>
  )
}

export default function ContractRecommendations({
  contractFunctions = [],
  contractId = '',
  currentFunction = '',
  onSelectFunction = null,
  standalone = true,
}) {
  const [context, setContext] = useState('operations')
  const [feedbackGiven, setFeedbackGiven] = useState({})
  const [showExplanation, setShowExplanation] = useState(null)

  const {
    recommendations,
    history,
    popularFunctions,
    feedbackStats,
    quality,
    track,
    feedback,
    refresh,
    clearHistory,
  } = useContractRecommendations({
    contractFunctions,
    contractId,
    currentFunction,
    context,
    count: 6,
  })

  const containerStyle = standalone ? {} : { display: 'none' }

  function handleSelectFunction(fn) {
    track({
      contractId,
      functionName: fn.functionName,
      network: 'testnet',
      status: 'recommended',
    })
    if (onSelectFunction) onSelectFunction(fn.functionName)
  }

  function handleFeedback(recId, helpful, fnName) {
    feedback(recId, helpful, fnName)
    setFeedbackGiven((prev) => ({ ...prev, [recId]: helpful }))
  }

  const contexts = [
    { id: 'operations', label: 'Operations', icon: <Zap size={13} /> },
    { id: 'deployment', label: 'Deployment', icon: <Layers size={13} /> },
    { id: 'management', label: 'Management', icon: <BarChart3 size={13} /> },
  ]

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Lightbulb size={20} style={{ color: 'var(--amber)' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>
            AI Contract Recommendations
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <ActionButton
            label="Refresh"
            onClick={refresh}
            tone="secondary"
            icon={<RefreshCw size={12} />}
          />
          <ActionButton
            label="Clear History"
            onClick={clearHistory}
            tone="secondary"
            icon={<Trash2 size={12} />}
          />
        </div>
      </div>

      <QualityIndicator quality={quality} />

      <Panel
        title="Recommendation Context"
        subtitle="Adjust suggestions based on your current task."
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {contexts.map((ctx) => (
            <button
              key={ctx.id}
              onClick={() => setContext(ctx.id)}
              style={{
                padding: '8px 14px',
                background: context === ctx.id ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                border: `1px solid ${context === ctx.id ? 'var(--cyan-dim)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                color: context === ctx.id ? 'var(--cyan)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: context === ctx.id ? 700 : 400,
              }}
            >
              {ctx.icon}{ctx.label}
            </button>
          ))}
        </div>
      </Panel>

      {recommendations.length === 0 && (
        <Panel
          title="No Recommendations Yet"
          subtitle="Interact with contracts to receive personalized recommendations."
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '24px',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}>
            <Lightbulb size={32} style={{ opacity: 0.3 }} />
            <div style={{ textAlign: 'center', lineHeight: 1.6 }}>
              The recommendation engine learns from your contract interactions.<br />
              Start by inspecting and invoking contract functions.<br />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>
                Functions with ABI metadata will receive the best recommendations.
              </span>
            </div>
          </div>
        </Panel>
      )}

      {recommendations.length > 0 && (
        <Panel
          title={`Recommended Functions (${recommendations.length})`}
          subtitle="AI-powered suggestions based on your usage patterns and common use cases."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recommendations.map((rec, idx) => {
              const isFeedbackGiven = feedbackGiven[rec.id]
              return (
                <div
                  key={rec.id}
                  style={{
                    background: idx === 0 ? 'rgba(251, 191, 36, 0.05)' : 'var(--bg-elevated)',
                    border: `1px solid ${idx === 0 ? 'var(--amber-dim)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    transition: 'var(--transition)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        {idx === 0 && (
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            color: 'var(--amber)',
                            border: '1px solid var(--amber-dim)',
                            borderRadius: '999px',
                            padding: '2px 8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}>
                            Top Pick
                          </span>
                        )}
                        <code style={{
                          fontSize: '13px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--cyan)',
                          fontWeight: 600,
                        }}>
                          {rec.functionName}
                        </code>
                        <ConfidenceBadge confidence={rec.confidence} />
                      </div>

                      {rec.signature && (
                        <div style={{
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          marginBottom: '6px',
                          lineHeight: 1.5,
                        }}>
                          {rec.signature}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {rec.reasons.slice(0, 3).map((reason, ri) => (
                          <span key={ri} style={{
                            fontSize: '10px',
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-base)',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            border: '1px solid var(--border)',
                          }}>
                            {reason}
                          </span>
                        ))}
                      </div>

                      {showExplanation === rec.id && (
                        <div style={{
                          marginTop: '8px',
                          padding: '8px 10px',
                          background: 'var(--bg-base)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                          border: '1px solid var(--border)',
                        }}>
                          {rec.explanation}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleSelectFunction(rec)}
                        title="Use this function"
                        style={{
                          padding: '6px 10px',
                          background: 'var(--cyan-glow)',
                          border: '1px solid var(--cyan-dim)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--cyan)',
                          cursor: 'pointer',
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Use
                      </button>
                      <button
                        onClick={() => setShowExplanation(showExplanation === rec.id ? null : rec.id)}
                        title="Explain recommendation"
                        style={{
                          padding: '4px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Info size={13} />
                      </button>
                    </div>
                  </div>

                  <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Score: {rec.score}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleFeedback(rec.id, true, rec.functionName)}
                        style={{
                          padding: '3px 8px',
                          background: isFeedbackGiven === true ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                          border: `1px solid ${isFeedbackGiven === true ? 'var(--green)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-sm)',
                          color: isFeedbackGiven === true ? 'var(--green)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <ThumbsUp size={11} /> Helpful
                      </button>
                      <button
                        onClick={() => handleFeedback(rec.id, false, rec.functionName)}
                        style={{
                          padding: '3px 8px',
                          background: isFeedbackGiven === false ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                          border: `1px solid ${isFeedbackGiven === false ? 'var(--red)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-sm)',
                          color: isFeedbackGiven === false ? 'var(--red)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <ThumbsDown size={11} /> Not Helpful
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {popularFunctions.length > 0 && (
          <Panel
            title="Popular Functions"
            subtitle="Most frequently invoked functions across your sessions."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {popularFunctions.slice(0, 8).map((pf, idx) => (
                <div key={pf.functionName} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  background: 'var(--bg-base)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px', width: '16px' }}>#{idx + 1}</span>
                    <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{pf.functionName}</code>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{pf.count} calls</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <Panel
          title="Recommendation Quality"
          subtitle="How well the system is performing."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Accuracy</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{quality.accuracy}%</span>
            </div>
            <div style={{
              height: '4px',
              background: 'var(--bg-elevated)',
              borderRadius: '999px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${quality.accuracy}%`,
                height: '100%',
                background: quality.accuracy >= 80 ? 'var(--green)' : quality.accuracy >= 50 ? 'var(--amber)' : 'var(--cyan)',
                borderRadius: '999px',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>Sample: {quality.sampleSize} interactions</span>
              <span>Feedback: {feedbackStats.total} ratings ({feedbackStats.helpfulRate}% helpful)</span>
            </div>
          </div>
        </Panel>
      </div>

      {history.length > 0 && (
        <Panel
          title="Recent Interactions"
          subtitle="Last 10 contract function calls."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {history.slice(0, 10).map((entry) => (
              <div key={entry.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 8px',
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
              }}>
                <code style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--cyan)',
                  fontWeight: 600,
                  minWidth: '120px',
                }}>
                  {entry.functionName}
                </code>
                <span style={{ color: 'var(--text-muted)', flex: 1 }}>
                  {entry.contractId?.slice(0, 12)}...
                </span>
                <span style={{
                  color: entry.status === 'success' ? 'var(--green)' : entry.status === 'error' ? 'var(--red)' : 'var(--text-muted)',
                  fontSize: '10px',
                  textTransform: 'capitalize',
                }}>
                  {entry.status}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
