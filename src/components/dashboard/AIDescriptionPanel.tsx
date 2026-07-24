import React, { useState, useEffect } from 'react'
import { Sparkles, Brain, CheckCircle, ThumbsUp, ThumbsDown, Edit3, Trash2, Play, Search } from 'lucide-react'
import {
  generateTransactionDescription,
  getSystemAccuracyMetrics,
  getLearnedRules,
  getStoredOverrides,
  saveUserCorrection,
  recordUserFeedback,
  NLGAccuracyMetrics,
  LearnedRule,
  GeneratedDescriptionResult
} from '../../lib/aiTransactionDescription'
import { useAddressLabels } from '../../hooks/useAddressLabels'

export default function AIDescriptionPanel() {
  const { labelMap } = useAddressLabels()
  const [metrics, setMetrics] = useState<NLGAccuracyMetrics>(getSystemAccuracyMetrics())
  const [learnedRules, setLearnedRules] = useState<LearnedRule[]>(getLearnedRules())
  const [overrides, setOverrides] = useState<Record<string, string>>(getStoredOverrides())

  // Playground state
  const [sampleType, setSampleType] = useState('payment')
  const [sampleAmount, setSampleAmount] = useState('100')
  const [sampleAsset, setSampleAsset] = useState('USDC')
  const [sampleMemo, setSampleMemo] = useState('sep-24 deposit ref-1029')
  const [playgroundResult, setPlaygroundResult] = useState<GeneratedDescriptionResult | null>(null)

  const addressLabels = React.useMemo(() => {
    const labels: Record<string, string> = {}
    Object.keys(labelMap).forEach((addr) => {
      labels[addr] = labelMap[addr].label
    })
    return labels
  }, [labelMap])

  const runPlayground = () => {
    const tx = {
      id: 'pg_sample_tx',
      hash: '0x' + Math.random().toString(36).slice(2).repeat(4).slice(0, 64),
      created_at: new Date().toISOString(),
      source_account: 'GAKD4XU7X3J4S6K5L8P9O0I1U2Y3T4R5E6W7Q8A9',
      memo: sampleMemo,
      memo_type: sampleMemo ? 'MEMO_TEXT' : 'none',
      operations: [
        sampleType === 'payment'
          ? { type: 'payment', amount: sampleAmount, asset_code: sampleAsset, from: 'GAKD...', to: 'GBBB...' }
          : sampleType === 'swap'
          ? { type: 'path_payment_strict_send', source_amount: sampleAmount, source_asset_code: sampleAsset, destination_amount: '15', destination_asset_code: 'XLM' }
          : sampleType === 'contract'
          ? { type: 'invoke_host_function', function_name: 'deposit_liquidity', contract_id: 'CCONTRACT999' }
          : { type: 'change_trust', asset_code: sampleAsset }
      ]
    }

    const res = generateTransactionDescription(tx as any, addressLabels)
    setPlaygroundResult(res)
  }

  useEffect(() => {
    runPlayground()
  }, [sampleType, sampleAmount, sampleAsset, sampleMemo])

  const refreshData = () => {
    setMetrics(getSystemAccuracyMetrics())
    setLearnedRules(getLearnedRules())
    setOverrides(getStoredOverrides())
  }

  const handleClearRule = (patternKey: string) => {
    try {
      const current = getLearnedRules().filter(r => r.patternKey !== patternKey)
      localStorage.setItem('stellar:ai_tx_desc_learned_rules', JSON.stringify(current))
      refreshData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleClearOverride = (txHash: string) => {
    try {
      const current = getStoredOverrides()
      delete current[txHash]
      localStorage.setItem('stellar:ai_tx_desc_overrides', JSON.stringify(current))
      refreshData()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
        border: '1px solid rgba(147, 51, 234, 0.3)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Sparkles size={24} style={{ color: 'var(--cyan)' }} />
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              AI Transaction Description Engine (#548)
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', maxWidth: '650px', lineHeight: 1.5 }}>
            Automated Natural Language Generation (NLG) system powered by ML template selection. Generates accurate human-readable transaction narratives and continuously learns from user feedback and corrections.
          </p>
        </div>

        {/* System Accuracy Metric Badge */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-bright)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 24px',
          textAlign: 'center',
          minWidth: '180px'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', tracking: '0.05em' }}>
            System Accuracy Rate
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: metrics.accuracyPercentage >= 85 ? 'var(--green)' : 'var(--cyan)', margin: '4px 0' }}>
            {metrics.accuracyPercentage}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <CheckCircle size={12} /> Target &gt;= 85% Met
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Generated</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px' }}>
            {metrics.totalGenerated}
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Helpful Ratings</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--green)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThumbsUp size={20} /> {metrics.helpfulCount}
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>User Corrections</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--cyan)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={20} /> {metrics.correctionsCount}
          </div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Learned Pattern Rules</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#c084fc', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Brain size={20} /> {learnedRules.length}
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Playground & Corrections Manager */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Interactive NLG Playground */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Play size={18} style={{ color: 'var(--cyan)' }} />
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>NLG Description Playground</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Operation Type
              </label>
              <select
                value={sampleType}
                onChange={(e) => setSampleType(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', background: 'var(--bg-app)', border: '1px solid var(--border)',
                  borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px'
                }}
              >
                <option value="payment">Payment / Transfer</option>
                <option value="swap">DEX Swap / Path Payment</option>
                <option value="contract">Soroban Contract Call</option>
                <option value="trustline">Change Trustline</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Amount</label>
                <input
                  type="text"
                  value={sampleAmount}
                  onChange={(e) => setSampleAmount(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Asset</label>
                <input
                  type="text"
                  value={sampleAsset}
                  onChange={(e) => setSampleAsset(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Memo Content</label>
              <input
                type="text"
                value={sampleMemo}
                onChange={(e) => setSampleMemo(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px' }}
              />
            </div>

            {playgroundResult && (
              <div style={{
                marginTop: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-bright)',
                borderRadius: '8px',
                padding: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--cyan)', marginBottom: '6px' }}>
                  <span>Generated Description</span>
                  <span>{Math.round(playgroundResult.confidence * 100)}% Confidence</span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  {playgroundResult.description}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Template: <code style={{ color: 'var(--cyan)' }}>{playgroundResult.templateId}</code> | Reasoning: {playgroundResult.reasoning}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Learned Pattern Rules & User Corrections Manager */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Brain size={18} style={{ color: '#c084fc' }} />
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Learned Rules & Corrections</h3>
          </div>

          {learnedRules.length === 0 && Object.keys(overrides).length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '30px 0' }}>
              No custom corrections or learned rules recorded yet. Edit a transaction description in the Transaction Details drawer to train the AI!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '380px', overflowY: 'auto' }}>
              {learnedRules.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                    Learned Pattern Rules ({learnedRules.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {learnedRules.map((rule) => (
                      <div key={rule.id} style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '12px', color: '#c084fc', fontFamily: 'var(--font-mono)' }}>{rule.patternKey}</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>{rule.customTemplate}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Matched {rule.matchCount} time(s)</div>
                        </div>
                        <button
                          onClick={() => handleClearRule(rule.patternKey)}
                          style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '4px' }}
                          title="Delete Learned Rule"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(overrides).length > 0 && (
                <div>
                  <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>
                    Specific Transaction Overrides ({Object.keys(overrides).length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(overrides).map(([hash, text]) => (
                      <div key={hash} style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>{hash.slice(0, 16)}...</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>{text}</div>
                        </div>
                        <button
                          onClick={() => handleClearOverride(hash)}
                          style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '4px' }}
                          title="Remove Override"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
