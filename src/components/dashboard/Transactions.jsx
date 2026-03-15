import React, { useState } from 'react'
import { useStore } from '../../lib/store'
import { shortAddress } from '../../lib/stellar'
import { format } from 'date-fns'

export default function Transactions() {
  const { transactions, txLoading, operations, opsLoading, network } = useStore()
  const [view, setView] = useState('transactions')

  const Tab = ({ id, label }) => (
    <button
      onClick={() => setView(id)}
      style={{
        padding: '7px 16px',
        background: view === id ? 'var(--cyan-glow)' : 'transparent',
        border: `1px solid ${view === id ? 'var(--cyan-dim)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        color: view === id ? 'var(--cyan)' : 'var(--text-secondary)',
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
        transition: 'var(--transition)',
      }}
    >{label}</button>
  )

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>History</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Tab id="transactions" label="Transactions" />
          <Tab id="operations" label="Operations" />
        </div>
      </div>

      {view === 'transactions' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <span>Hash</span>
            <span>Ops · Time</span>
          </div>
          {txLoading ? (
            <div style={{ padding: '32px', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No transactions found</div>
          ) : transactions.map((tx, i) => (
            <div key={tx.id} style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '12px',
              alignItems: 'center',
              padding: '12px 18px',
              borderBottom: i < transactions.length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'var(--transition)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: tx.successful ? 'var(--green)' : 'var(--red)', flexShrink: 0, display: 'inline-block' }} />
                  <a
                    href={`https://stellar.expert/explorer/${network}/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: 'var(--cyan)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {tx.hash}
                  </a>
                </div>
                {tx.memo && (
                  <div style={{ fontSize: '11px', color: 'var(--amber)', marginLeft: '15px' }}>
                    memo: {tx.memo}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '15px' }}>
                  fee: {tx.fee_charged} stroops
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {tx.operation_count} op{tx.operation_count !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {format(new Date(tx.created_at), 'MMM d, HH:mm')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'operations' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <span>Type · Details</span>
            <span>Time</span>
          </div>
          {opsLoading ? (
            <div style={{ padding: '32px', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
          ) : operations.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No operations found</div>
          ) : operations.map((op, i) => (
            <div key={op.id} style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '12px',
              alignItems: 'center',
              padding: '12px 18px',
              borderBottom: i < operations.length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'var(--transition)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                  <span style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-bright)',
                    borderRadius: '3px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    color: 'var(--cyan)',
                    marginRight: '8px',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {op.type.replace(/_/g, ' ')}
                  </span>
                </div>
                {op.from && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>from: {shortAddress(op.from)}</div>}
                {op.to && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to: {shortAddress(op.to)}</div>}
                {op.amount && (
                  <div style={{ fontSize: '11px', color: 'var(--amber)' }}>
                    {parseFloat(op.amount).toFixed(4)} {op.asset_code || 'XLM'}
                  </div>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                {format(new Date(op.created_at), 'MMM d, HH:mm')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
