import React, { useState, useCallback } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  ArrowUpDown,
  FileWarning,
  ListChecks,
  Brain,
  Target,
  Shield,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  Clock,
  Users,
  Activity,
  BarChart3,
  RefreshCw,
  History,
} from 'lucide-react'
import { useUpgradeImpactAnalysis } from '../../hooks/useUpgradeImpactAnalysis'
import type { ContractSpec, UpgradeAnalysisResult } from '../../lib/upgradeAnalysis'

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        {icon}
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>{title}</span>
      </div>
      <div style={{ padding: '18px' }}>{children}</div>
    </div>
  )
}

function Badge({ label, variant }: { label: string; variant: 'critical' | 'high' | 'medium' | 'low' | 'safe' | 'info' }) {
  const colors: Record<string, { bg: string; text: string }> = {
    critical: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
    high: { bg: 'rgba(249,115,22,0.15)', text: '#f97316' },
    medium: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
    low: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
    safe: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
    info: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
  }
  const c = colors[variant] || colors.info
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 8px',
      borderRadius: 'var(--radius-sm)',
      background: c.bg,
      color: c.text,
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    }}>
      {label}
    </span>
  )
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 0.8 ? '#22c55e' : score >= 0.5 ? '#eab308' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
        <div style={{
          height: '8px',
          background: 'var(--bg-elevated)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.round(score * 100)}%`,
            height: '100%',
            background: color,
            borderRadius: '4px',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '14px',
        fontWeight: 700,
        color,
        minWidth: '40px',
        textAlign: 'right',
      }}>
        {Math.round(score * 100)}%
      </span>
    </div>
  )
}

function ChangeRow({ change, expanded, onToggle }: {
  change: UpgradeAnalysisResult['diff']['changes'][0]
  expanded: boolean
  onToggle: () => void
}) {
  const iconMap: Record<string, React.ReactNode> = {
    'function-removed': <AlertCircle size={14} color="#ef4444" />,
    'function-added': <CheckCircle2 size={14} color="#22c55e" />,
    'parameter-removed': <AlertTriangle size={14} color="#f97316" />,
    'parameter-added': <Info size={14} color="#3b82f6" />,
    'parameter-type-changed': <FileWarning size={14} color="#f97316" />,
    'return-type-changed': <ArrowUpDown size={14} color="#eab308" />,
    'function-renamed': <AlertTriangle size={14} color="#ef4444" />,
  }

  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '8px 0',
          cursor: 'pointer',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {change.category === 'breaking' ? (
          <AlertTriangle size={14} color="#ef4444" style={{ marginTop: '2px', flexShrink: 0 }} />
        ) : (
          <Info size={14} color="#3b82f6" style={{ marginTop: '2px', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>{change.description}</span>
            <Badge label={change.category} variant={change.category === 'breaking' ? 'high' : 'info'} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Impact: {Math.round(change.impactScore * 100)}%
          </div>
        </div>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>
      {expanded && (
        <div style={{
          padding: '10px 12px',
          margin: '0 0 8px 22px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          fontSize: '12px',
          lineHeight: 1.6,
        }}>
          <div style={{ marginBottom: '4px' }}><strong>Detail:</strong> {change.detail}</div>
          {change.oldValue !== undefined && (
            <div style={{ marginBottom: '4px' }}>
              <strong>Old:</strong> <code style={{ fontSize: '11px' }}>{JSON.stringify(change.oldValue)}</code>
            </div>
          )}
          {change.newValue !== undefined && (
            <div>
              <strong>New:</strong> <code style={{ fontSize: '11px' }}>{JSON.stringify(change.newValue)}</code>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RecommendationCard({ rec }: { rec: UpgradeAnalysisResult['migrationRecommendations'][0] }) {
  const [expanded, setExpanded] = useState(false)
  const priorityColors = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-md)',
      padding: '12px',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <Lightbulb size={16} color={priorityColors[rec.priority]} style={{ marginTop: '2px', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{rec.title}</span>
            <Badge label={rec.priority} variant={rec.priority} />
            <Badge label={rec.riskLevel} variant={rec.riskLevel} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>{rec.description}</div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Effort: <strong>{rec.effort}</strong></span>
            <span>Complexity: <strong>{rec.complexity}</strong></span>
            <span>Affected: <strong>{rec.affectedUsers}</strong></span>
          </div>
          <div
            onClick={() => setExpanded(!expanded)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '8px',
              fontSize: '11px',
              color: 'var(--cyan)',
              cursor: 'pointer',
            }}
          >
            {expanded ? 'Hide' : 'Show'} migration steps {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </div>
          {expanded && (
            <div style={{ marginTop: '8px' }}>
              <ol style={{ paddingLeft: '18px', fontSize: '12px', lineHeight: 1.8 }}>
                {rec.migrationSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              {rec.codeExample && (
                <pre style={{
                  background: 'var(--bg-base)',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  marginTop: '8px',
                  overflow: 'auto',
                  lineHeight: 1.5,
                }}>
                  {rec.codeExample}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RiskFactorCard({ factor }: { factor: UpgradeAnalysisResult['impactPrediction']['riskFactors'][0] }) {
  const colors = { high: '#ef4444', medium: '#f97316', low: '#eab308' }
  return (
    <div style={{
      padding: '10px',
      borderLeft: `3px solid ${colors[factor.severity]}`,
      marginBottom: '8px',
      background: 'var(--bg-elevated)',
      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <AlertCircle size={12} color={colors[factor.severity]} />
        <span style={{ fontSize: '12px', fontWeight: 600 }}>{factor.name}</span>
        <Badge label={factor.severity} variant={factor.severity} />
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{factor.description}</div>
      <div style={{ fontSize: '11px', color: 'var(--cyan)' }}>Mitigation: {factor.mitigation}</div>
    </div>
  )
}

export function UpgradeImpactAnalysis() {
  const {
    result,
    loading,
    error,
    history,
    accuracy,
    runAnalysis,
    submitFeedback,
    refreshHistory,
  } = useUpgradeImpactAnalysis()

  const [expandedChanges, setExpandedChanges] = useState<Set<number>>(new Set())
  const [viewTab, setViewTab] = useState<'overview' | 'changes' | 'recommendations' | 'history'>('overview')
  const [oldSpecInput, setOldSpecInput] = useState('')
  const [newSpecInput, setNewSpecInput] = useState('')
  const [contractId, setContractId] = useState('')

  const toggleChange = useCallback((idx: number) => {
    setExpandedChanges(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  const handleAnalyze = useCallback(async () => {
    let oldSpec: ContractSpec | null = null
    let newSpec: ContractSpec = { functions: [], errorTypes: [], customTypes: [] }

    try {
      if (oldSpecInput.trim()) {
        oldSpec = JSON.parse(oldSpecInput)
      }
      if (newSpecInput.trim()) {
        newSpec = JSON.parse(newSpecInput)
      } else {
        return
      }
      await runAnalysis(oldSpec, newSpec, contractId)
    } catch (err) {
      // Error handled by hook
    }
  }, [oldSpecInput, newSpecInput, contractId, runAnalysis])

  const handleRecordOutcome = useCallback((actual: 'none' | 'low' | 'medium' | 'high' | 'critical') => {
    if (!result) return
    submitFeedback(
      result.diff.contractId,
      result.diff.oldVersion,
      result.diff.newVersion,
      result.diff.totalChanges,
      result.diff.breakingCount,
      actual
    )
  }, [result, submitFeedback])

  const summaryIcon = (status: string) => {
    switch (status) {
      case 'safe': return <CheckCircle2 size={24} color="#22c55e" />
      case 'caution': return <Info size={24} color="#eab308" />
      case 'breaking': return <AlertTriangle size={24} color="#f97316" />
      case 'critical': return <AlertCircle size={24} color="#ef4444" />
      default: return <Info size={24} />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} />
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', margin: 0 }}>
            Upgrade Impact Analysis
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={refreshHistory}
            style={{
              padding: '6px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <History size={14} /> History ({history.length})
          </button>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '18px',
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)' }}>
              Old Contract Spec (JSON)
            </label>
            <textarea
              value={oldSpecInput}
              onChange={e => setOldSpecInput(e.target.value)}
              placeholder='{"functions":[],"errorTypes":[],"customTypes":[]}'
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                resize: 'vertical',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)' }}>
              New Contract Spec (JSON)
            </label>
            <textarea
              value={newSpecInput}
              onChange={e => setNewSpecInput(e.target.value)}
              placeholder='{"functions":[],"errorTypes":[],"customTypes":[]}'
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                resize: 'vertical',
              }}
            />
          </div>
          <div style={{ width: '200px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)' }}>
              Contract ID (optional)
            </label>
            <input
              value={contractId}
              onChange={e => setContractId(e.target.value)}
              placeholder="CCY... or G..."
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                marginBottom: '8px',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !newSpecInput.trim()}
              style={{
                width: '100%',
                padding: '8px 16px',
                background: loading ? 'var(--bg-elevated)' : 'var(--cyan)',
                color: loading ? 'var(--text-muted)' : 'var(--bg-base)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {loading ? <RefreshCw size={14} /> : <Brain size={14} />}
              {loading ? 'Analyzing...' : 'Analyze Impact'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#ef4444',
          fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {result && !loading && (
        <>
          <Section title={`Summary: ${result.summary.title}`} icon={summaryIcon(result.summary.status)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{result.summary.description}</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '12px',
              }}>
                <div style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444' }}>{result.summary.breakingChanges}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Breaking Changes</div>
                </div>
                <div style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#3b82f6' }}>{result.summary.nonBreakingChanges}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Non-Breaking Changes</div>
                </div>
                <div style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--cyan)' }}>{result.summary.recommendations}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Recommendations</div>
                </div>
                <div style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444' }}>{result.summary.criticalIssues}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Critical Issues</div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
                Analysis completed in {result.analysisTime}ms
              </div>
            </div>
          </Section>

          <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
            {(['overview', 'changes', 'recommendations', 'history'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setViewTab(tab)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: viewTab === tab ? '2px solid var(--cyan)' : '2px solid transparent',
                  color: viewTab === tab ? 'var(--cyan)' : 'var(--text-muted)',
                  fontWeight: viewTab === tab ? 700 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab === 'overview' && <><BarChart3 size={14} style={{ marginRight: '4px' }} /> Overview</>}
                {tab === 'changes' && <><ArrowUpDown size={14} style={{ marginRight: '4px' }} /> Changes ({result.diff.changes.length})</>}
                {tab === 'recommendations' && <><ListChecks size={14} style={{ marginRight: '4px' }} /> Recommendations</>}
                {tab === 'history' && <><History size={14} style={{ marginRight: '4px' }} /> History</>}
              </button>
            ))}
          </div>

          {viewTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Section title="Compatibility Score" icon={<Target size={16} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <ScoreGauge score={result.compatibility.overall} label="Overall Compatibility" />
                  <ScoreGauge score={result.compatibility.apiCompatibility} label="API Compatibility" />
                  <ScoreGauge score={result.compatibility.storageCompatibility} label="Storage Compatibility" />
                  <ScoreGauge score={result.compatibility.behavioralCompatibility} label="Behavioral Compatibility" />
                  <ScoreGauge score={result.compatibility.integrationImpact} label="Integration Impact" />
                </div>
              </Section>

              <Section title="ML Impact Prediction" icon={<Brain size={16} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '12px' }}>Predicted Severity</span>
                    <Badge
                      label={result.impactPrediction.overallSeverity}
                      variant={result.impactPrediction.overallSeverity === 'critical' ? 'critical' : result.impactPrediction.overallSeverity === 'high' ? 'high' : result.impactPrediction.overallSeverity === 'medium' ? 'medium' : result.impactPrediction.overallSeverity === 'low' ? 'low' : 'safe'}
                    />
                  </div>
                  <ScoreGauge score={result.impactPrediction.breakingProbability} label="Breaking Probability" />
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Migration Effort</span>
                      <strong>{result.impactPrediction.migrationEffort}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Affected Integrations</span>
                      <strong>{result.impactPrediction.estimatedAffectedIntegrations}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Predicted Downstream Failures</span>
                      <strong>{result.impactPrediction.predictedDownstreamFailures}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>ML Confidence</span>
                      <strong>{Math.round(result.impactPrediction.confidence * 100)}%</strong>
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>Model accuracy: {accuracy.accuracy}% ({accuracy.status})</span>
                  </div>

                  {result.impactPrediction.riskFactors.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Risk Factors</div>
                      {result.impactPrediction.riskFactors.map((rf, i) => (
                        <RiskFactorCard key={i} factor={rf} />
                      ))}
                    </div>
                  )}
                </div>
              </Section>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Was this prediction accurate?</span>
                {(['none', 'low', 'medium', 'high', 'critical'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => handleRecordOutcome(v)}
                    style={{
                      padding: '4px 10px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewTab === 'changes' && (
            <Section title={`All Changes (${result.diff.changes.length})`} icon={<ArrowUpDown size={16} />}>
              {result.diff.changes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <CheckCircle2 size={24} style={{ margin: '0 auto 8px' }} />
                  No changes detected between contract versions
                </div>
              ) : (
                <div>
                  {result.diff.changes.map((change, idx) => (
                    <ChangeRow
                      key={idx}
                      change={change}
                      expanded={expandedChanges.has(idx)}
                      onToggle={() => toggleChange(idx)}
                    />
                  ))}
                </div>
              )}
            </Section>
          )}

          {viewTab === 'recommendations' && (
            <Section title={`Migration Recommendations (${result.migrationRecommendations.length})`} icon={<ListChecks size={16} />}>
              {result.migrationRecommendations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <CheckCircle2 size={24} style={{ margin: '0 auto 8px' }} />
                  No migration recommendations needed
                </div>
              ) : (
                <div>
                  {result.migrationRecommendations.map((rec, idx) => (
                    <RecommendationCard key={idx} rec={rec} />
                  ))}
                </div>
              )}
            </Section>
          )}

          {viewTab === 'history' && (
            <Section title={`Upgrade History (${history.length})`} icon={<History size={16} />}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <History size={24} style={{ margin: '0 auto 8px' }} />
                  No upgrade history yet. Submit feedback after analysis to build history.
                </div>
              ) : (
                <div>
                  {[...history].reverse().slice(0, 20).map((entry, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '12px',
                    }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{entry.contractId.slice(0, 12)}... {entry.oldVersion} → {entry.newVersion}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          {entry.changes} changes ({entry.breakingChanges} breaking)
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Badge label={entry.actualImpact} variant={entry.actualImpact === 'high' || entry.actualImpact === 'critical' ? 'high' : entry.actualImpact === 'medium' ? 'medium' : entry.actualImpact === 'low' ? 'low' : 'safe'} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}
        </>
      )}

      {!result && !loading && !error && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: 'var(--bg-card)',
          border: '1px dashed var(--border-bright)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <Brain size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Analyze Contract Upgrades</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Paste old and new contract specs above to detect breaking changes and get migration recommendations
          </div>
        </div>
      )}
    </div>
  )
}

export default UpgradeImpactAnalysis
