import React, { useState, useEffect } from 'react'
import { fetchTransactionDetails } from '../../lib/stellar'
import { getTransactionUrl } from '../../lib/externalExplorers'
import CopyableValue from './CopyableValue'

export default function TransactionDetail({ txHash, network, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!txHash) {
      setData(null)
      return
    }
    
    let isMounted = true
    setLoading(true)
    setError(null)

    fetchTransactionDetails(txHash, network)
      .then(details => {
        if (isMounted) setData(details)
      })
      .catch(err => {
        if (isMounted) setError(err.message || 'Failed to load transaction details')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [txHash, network])

  if (!txHash) return null

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-surface)',
          height: '100%',
          overflowY: 'auto',
          borderLeft: '1px solid var(--border)',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '20px' }}>Transaction Details</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition)'
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >&times;</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="spinner" />
          </div>
        ) : error ? (
          <div style={{ color: 'var(--red)', padding: '20px', textAlign: 'center', background: 'var(--red-glow)', borderRadius: 'var(--radius-md)', border: '1px solid var(--red)' }}>
            {error}
          </div>
        ) : data ? (
          <>
            <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Hash</span>
                <a 
                  href={getTransactionUrl('stellarExpert', network, data.transaction.hash)}
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: 'var(--cyan)', textDecoration: 'none' }}
                >
                  Open in Stellar Expert ↗
                </a>
              </div>
              <CopyableValue 
                value={data.transaction.hash} 
                containerStyle={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-bright)' }}
                textStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px', wordBreak: 'break-all', color: 'var(--cyan)' }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <DetailItem label="Status" value={data.transaction.successful ? 'Success' : 'Failed'} color={data.transaction.successful ? 'var(--green)' : 'var(--red)'} />
                <DetailItem label="Ledger" value={data.transaction.ledger_attr} />
                <DetailItem label="Fee Charged" value={`${data.transaction.fee_charged} stroops`} />
                <DetailItem label="Max Fee" value={`${data.transaction.max_fee} stroops`} />
                <DetailItem label="Memo" value={data.transaction.memo || 'None'} sub={data.transaction.memo_type} />
                <DetailItem label="Created At" value={new Date(data.transaction.created_at).toLocaleString()} />
              </div>
            </section>

            <section>
              <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Operations ({data.operations.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.operations.map((op, idx) => (
                  <div key={op.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{op.type.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>#{idx + 1}</span>
                    </div>
                    <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'var(--font-mono)', overflowX: 'auto', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {JSON.stringify(op, (key, val) => ['_links', 'transaction', 'id', 'paging_token'].includes(key) ? undefined : val, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Envelope XDR</h3>
              <div style={{ position: 'relative' }}>
                <pre style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', fontSize: '11px', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {data.transaction.envelope_xdr}
                </pre>
                <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                  <CopyableValue value={data.transaction.envelope_xdr} title="Copy envelope XDR" />
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

function DetailItem({ label, value, color, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ fontSize: '13px', color: color || 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
      {sub && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{sub}</span>}
    </div>
  )
}