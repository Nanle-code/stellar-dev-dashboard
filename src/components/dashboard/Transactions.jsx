import React, { useState } from 'react'
import { useStore } from '../../lib/store'
import { shortAddress, getOperationLabel, fetchTransactions, fetchOperations } from '../../lib/stellar'
import CopyableValue from './CopyableValue'
import { format } from 'date-fns'

export default function Transactions() {
  const {
    connectedAddress,
    transactions,
    txLoading,
    appendTransactions,
    txNextCursor,
    txHasMore,
    txPagingLoading,
    setTxNextCursor,
    setTxHasMore,
    setTxPagingLoading,
    operations,
    opsLoading,
    appendOperations,
    opsNextCursor,
    opsHasMore,
    opsPagingLoading,
    setOpsNextCursor,
    setOpsHasMore,
    setOpsPagingLoading,
    network,
  } = useStore()
  const [view, setView] = useState('transactions')

  async function handleLoadMoreTransactions() {
    if (!connectedAddress || !txHasMore || !txNextCursor || txPagingLoading) return

    setTxPagingLoading(true)
    try {
      const { records, nextCursor, hasMore } = await fetchTransactions(connectedAddress, network, 20, txNextCursor)
      appendTransactions(records)
      setTxNextCursor(nextCursor)
      setTxHasMore(hasMore)
    } finally {
      setTxPagingLoading(false)
    }
  }

  async function handleLoadMoreOperations() {
    if (!connectedAddress || !opsHasMore || !opsNextCursor || opsPagingLoading) return

    setOpsPagingLoading(true)
    try {
      const { records, nextCursor, hasMore } = await fetchOperations(connectedAddress, network, 20, opsNextCursor)
      appendOperations(records)
      setOpsNextCursor(nextCursor)
      setOpsHasMore(hasMore)
    } finally {
      setOpsPagingLoading(false)
    }
  }

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
          ) : (
            <>
              {transactions.map((tx, i) => (
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
                      <CopyableValue
                        value={tx.hash}
                        title="Copy transaction hash"
                        containerStyle={{ fontSize: '12px', color: 'var(--cyan)', fontFamily: 'var(--font-mono)', minWidth: 0, flex: 1 }}
                        textStyle={{ display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
                      >
                        {tx.hash}
                      </CopyableValue>
                      <a
                        href={`https://stellar.expert/explorer/${network}/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '11px', color: 'var(--cyan)', flexShrink: 0 }}
                      >
                        ↗
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
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
                {txHasMore || txPagingLoading ? (
                  <button
                    onClick={handleLoadMoreTransactions}
                    disabled={txPagingLoading}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-bright)',
                      background: txPagingLoading ? 'var(--bg-elevated)' : 'transparent',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      cursor: txPagingLoading ? 'not-allowed' : 'pointer',
                      opacity: txPagingLoading ? 0.8 : 1,
                    }}
                  >
                    {txPagingLoading ? 'Loading...' : 'Load More'}
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No more transactions</span>
                )}
              </div>
            </>
          )}
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
          ) : (
            <>
              {operations.map((op, i) => (
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
                        {getOperationLabel(op.type)}
                      </span>
                    </div>
                    {op.from && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        from: <CopyableValue value={op.from} title="Copy source public key" textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{shortAddress(op.from)}</CopyableValue>
                      </div>
                    )}
                    {op.to && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        to: <CopyableValue value={op.to} title="Copy destination public key" textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{shortAddress(op.to)}</CopyableValue>
                      </div>
                    )}
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
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
                {opsHasMore || opsPagingLoading ? (
                  <button
                    onClick={handleLoadMoreOperations}
                    disabled={opsPagingLoading}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-bright)',
                      background: opsPagingLoading ? 'var(--bg-elevated)' : 'transparent',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      cursor: opsPagingLoading ? 'not-allowed' : 'pointer',
                      opacity: opsPagingLoading ? 0.8 : 1,
                    }}
                  >
                    {opsPagingLoading ? 'Loading...' : 'Load More'}
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No more operations</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
