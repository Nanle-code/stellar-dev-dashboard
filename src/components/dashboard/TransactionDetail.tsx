import React, { useEffect, useState } from 'react'
import type { Horizon } from '@stellar/stellar-sdk'
import { useStore } from '../../lib/store'
import { fetchTransactionDetails, getOperationLabel, shortAddress } from '../../lib/stellar'
import { getTransactionUrl } from '../../lib/externalExplorers'
import CopyableValue from './CopyableValue'
import { format } from 'date-fns'
import AddressLabelBadge from '../addressLabels/AddressLabelBadge'
import { useAddressLabels } from '../../hooks/useAddressLabels'
import {
  generateTransactionDescription,
  saveUserCorrection,
  recordUserFeedback,
  GeneratedDescriptionResult
} from '../../lib/aiTransactionDescription'

interface TransactionDetailData {
  transaction: Horizon.ServerApi.TransactionRecord
  operations: Horizon.ServerApi.OperationRecord[]
}

interface TransactionDetailProps {
  txHash: string
  onClose: () => void
}

export default function TransactionDetail({ txHash, onClose }: TransactionDetailProps) {
  const { network } = useStore()
  const { labelMap } = useAddressLabels()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TransactionDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // AI Description state
  const [aiResult, setAiResult] = useState<GeneratedDescriptionResult | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [customText, setCustomText] = useState('')
  const [feedbackGiven, setFeedbackGiven] = useState<'helpful' | 'unhelpful' | null>(null)
  const [feedbackNotice, setFeedbackNotice] = useState('')

  const addressLabels = React.useMemo(() => {
    const labels: Record<string, string> = {}
    Object.keys(labelMap).forEach((addr) => {
      labels[addr] = labelMap[addr].label
    })
    return labels
  }, [labelMap])

  useEffect(() => {
    if (!txHash) return

    let isMounted = true
    setLoading(true)
    setError(null)

    fetchTransactionDetails(txHash, network)
      .then(res => {
        if (isMounted) {
          setData(res)
          setLoading(false)

          // Generate AI Description
          const gen = generateTransactionDescription({
            id: res.transaction.id,
            hash: res.transaction.hash,
            created_at: res.transaction.created_at,
            fee_charged: res.transaction.fee_charged,
            operation_count: res.transaction.operation_count,
            successful: res.transaction.successful,
            memo: res.transaction.memo,
            memo_type: res.transaction.memo_type,
            source_account: res.transaction.source_account,
            operations: res.operations as any[]
          }, addressLabels)
          
          setAiResult(gen)
          setCustomText(gen.description)
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { isMounted = false }
  }, [txHash, network, addressLabels])

  const handleSaveCorrection = () => {
    if (!txHash || !customText.trim() || !aiResult) return
    const patternKey = `${aiResult.features.opTypes?.join('_')}:${aiResult.features.primaryAsset || 'XLM'}`
    saveUserCorrection(txHash, customText.trim(), patternKey)
    
    // Refresh AI result
    if (data) {
      const updated = generateTransactionDescription({
        id: data.transaction.id,
        hash: data.transaction.hash,
        created_at: data.transaction.created_at,
        fee_charged: data.transaction.fee_charged,
        operation_count: data.transaction.operation_count,
        successful: data.transaction.successful,
        memo: data.transaction.memo,
        memo_type: data.transaction.memo_type,
        source_account: data.transaction.source_account,
        operations: data.operations as any[]
      }, addressLabels)
      setAiResult(updated)
    }

    setIsEditing(false)
    setFeedbackNotice('Correction saved! System learned this pattern.')
    setTimeout(() => setFeedbackNotice(''), 4000)
  }

  const handleFeedback = (rating: 'helpful' | 'unhelpful') => {
    if (!aiResult) return
    recordUserFeedback({
      txHash,
      rating,
      originalDescription: aiResult.description,
      timestamp: new Date().toISOString()
    }, aiResult.templateId)

    setFeedbackGiven(rating)
    setFeedbackNotice(rating === 'helpful' ? 'Thank you for your feedback!' : 'Feedback recorded. Model weights updated.')
    setTimeout(() => setFeedbackNotice(''), 4000)
  }

  if (!txHash) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0, right: 0, bottom: 0, left: 0,
      zIndex: 100,
      display: 'flex',
      justifyContent: 'flex-end',
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(2px)',
      animation: 'fadeIn 0.2s ease-out'
    }} onClick={onClose}>
      <div style={{
        width: '540px',
        maxWidth: '100%',
        background: 'var(--bg-app)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>

        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              Transaction Details
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CopyableValue
                value={txHash}
                textStyle={{ fontSize: '13px', color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}
              >
                {shortAddress(txHash, 8)}
              </CopyableValue>
              {data && (
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  background: data.transaction.successful ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: data.transaction.successful ? 'var(--green)' : 'var(--red)',
                  border: `1px solid ${data.transaction.successful ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                }}>
                  {data.transaction.successful ? 'SUCCESS' : 'FAILED'}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
            padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '24px', lineHeight: 1 }}>&times;</span>
          </button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><div className="spinner" /></div>
          ) : error ? (
            <div style={{ color: 'var(--red)', padding: '20px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              Error loading transaction: {error}
            </div>
          ) : data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* AI Generated Description Card (#548) */}
              {aiResult && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
                  border: '1px solid rgba(147, 51, 234, 0.3)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>✨</span>
                      <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                        AI Human-Readable Description
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold',
                        background: 'rgba(59, 130, 246, 0.2)', color: 'var(--cyan)', border: '1px solid rgba(59, 130, 246, 0.4)'
                      }}>
                        {aiResult.category}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold',
                        background: aiResult.isUserOverride ? 'rgba(34, 197, 94, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                        color: aiResult.isUserOverride ? 'var(--green)' : '#c084fc'
                      }}>
                        {aiResult.isUserOverride ? 'User Correction' : `${Math.round(aiResult.confidence * 100)}% Confidence`}
                      </span>
                    </div>
                  </div>

                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                      <textarea
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        rows={3}
                        style={{
                          width: '100%',
                          background: 'var(--bg-app)',
                          border: '1px solid var(--border-bright)',
                          borderRadius: '6px',
                          color: 'var(--text-primary)',
                          padding: '10px',
                          fontSize: '13px',
                          fontFamily: 'inherit'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setIsEditing(false)}
                          style={{
                            padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border)',
                            background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveCorrection}
                          style={{
                            padding: '6px 12px', borderRadius: '4px', border: 'none',
                            background: 'var(--cyan)', color: '#000', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                          }}
                        >
                          Save & Learn Correction
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {aiResult.description}
                      </p>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', fontStyle: 'italic' }}>
                        Reasoning: {aiResult.reasoning}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px rgba(255,255,255,0.08) solid' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Feedback:</span>
                          <button
                            onClick={() => handleFeedback('helpful')}
                            style={{
                              background: feedbackGiven === 'helpful' ? 'rgba(34, 197, 94, 0.2)' : 'none',
                              border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 8px',
                              color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer'
                            }}
                          >
                            👍 Helpful
                          </button>
                          <button
                            onClick={() => handleFeedback('unhelpful')}
                            style={{
                              background: feedbackGiven === 'unhelpful' ? 'rgba(239, 68, 68, 0.2)' : 'none',
                              border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 8px',
                              color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer'
                            }}
                          >
                            👎 Not Helpful
                          </button>
                        </div>

                        <button
                          onClick={() => setIsEditing(true)}
                          style={{
                            background: 'none', border: '1px dashed var(--cyan)', borderRadius: '4px',
                            padding: '2px 10px', color: 'var(--cyan)', fontSize: '11px', cursor: 'pointer'
                          }}
                        >
                          ✏️ Edit / Correct
                        </button>
                      </div>

                      {feedbackNotice && (
                        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--green)', fontWeight: 'bold' }}>
                          {feedbackNotice}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <a
                  href={getTransactionUrl('stellarExpert', network, txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)',
                    color: 'var(--cyan)', fontSize: '12px', textDecoration: 'none',
                    transition: 'var(--transition)'
                  }}
                >
                  <span style={{ fontSize: '14px' }}>&#x1F50D;</span> Open in Stellar Expert
                </a>
              </div>

              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>Overview</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '12px', fontSize: '13px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Created At</div>
                  <div style={{ color: 'var(--text-primary)' }}>{format(new Date(data.transaction.created_at), 'MMM d, yyyy HH:mm:ss')}</div>

                  <div style={{ color: 'var(--text-muted)' }}>Source Account</div>
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    <AddressLabelBadge address={data.transaction.source_account} />
                    <CopyableValue value={data.transaction.source_account} textStyle={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
                      {shortAddress(data.transaction.source_account)}
                    </CopyableValue>
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>Fee Charged</div>
                  <div style={{ color: 'var(--text-primary)' }}>{data.transaction.fee_charged} stroops</div>

                  <div style={{ color: 'var(--text-muted)' }}>Memo</div>
                  <div style={{ color: 'var(--text-primary)', fontFamily: data.transaction.memo_type !== 'none' ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all' }}>
                    {data.transaction.memo_type === 'none' ? <span style={{ color: 'var(--text-muted)' }}>None</span> : `${data.transaction.memo_type}: ${data.transaction.memo}`}
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>Signatures</div>
                  <div style={{ color: 'var(--text-primary)' }}>{data.transaction.signatures?.length || 0}</div>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-primary)' }}>Operations ({data.operations.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.operations.map((op: Horizon.ServerApi.OperationRecord, i: number) => (
                    <div key={op.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)'
                        }}>
                          {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{getOperationLabel(op.type)}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ID: {op.id}</div>
                        </div>
                      </div>
                      <div style={{ padding: '16px', background: 'var(--bg-app)', overflowX: 'auto' }}>
                        <pre style={{ margin: 0, fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>
                          {JSON.stringify(op, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
