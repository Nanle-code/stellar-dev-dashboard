import React, { useEffect, useState } from 'react'
import type { Horizon } from '@stellar/stellar-sdk'
import { useStore } from '../../lib/store'
import { fetchTransactionDetails, getOperationLabel, shortAddress } from '../../lib/stellar'
import { getTransactionUrl } from '../../lib/externalExplorers'
import CopyableValue from './CopyableValue'
import { format } from 'date-fns'
import AddressLabelBadge from '../addressLabels/AddressLabelBadge'

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
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TransactionDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { isMounted = false }
  }, [txHash, network])

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
        width: '500px',
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
