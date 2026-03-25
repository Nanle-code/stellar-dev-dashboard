import React, { useState } from 'react'
import { useStore } from '../../lib/store'
import { isValidPublicKey, fetchAccount, fetchTransactions, fetchOperations } from '../../lib/stellar'

export default function ConnectPanel() {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const {
    network, setConnectedAddress, setAccountData,
    setAccountLoading, setTransactions, setTxLoading,
    setOperations, setOpsLoading, setActiveTab,
    setTxNextCursor, setTxHasMore,
    setOpsNextCursor, setOpsHasMore,
  } = useStore()

  async function handleConnect() {
    const addr = input.trim()
    if (!isValidPublicKey(addr)) {
      setError('Invalid Stellar public key')
      return
    }
    setError('')
    setAccountLoading(true)
    try {
      const account = await fetchAccount(addr, network)
      setConnectedAddress(addr)
      setAccountData(account)
      setActiveTab('overview')

      // Fetch tx & ops in background
      setTxLoading(true)
      setOpsLoading(true)
      fetchTransactions(addr, network)
        .then(({ records, nextCursor, hasMore }) => {
          setTransactions(records)
          setTxNextCursor(nextCursor)
          setTxHasMore(hasMore)
        })
        .catch(() => {
          setTransactions([])
          setTxNextCursor(null)
          setTxHasMore(false)
        })
        .finally(() => {
          setTxLoading(false)
        })

      fetchOperations(addr, network)
        .then(({ records, nextCursor, hasMore }) => {
          setOperations(records)
          setOpsNextCursor(nextCursor)
          setOpsHasMore(hasMore)
        })
        .catch(() => {
          setOperations([])
          setOpsNextCursor(null)
          setOpsHasMore(false)
        })
        .finally(() => {
          setOpsLoading(false)
        })
    } catch (e) {
      setError('Account not found on ' + network)
    } finally {
      setAccountLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '32px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '42px',
          fontWeight: 800,
          color: 'var(--cyan)',
          letterSpacing: '-1px',
          lineHeight: 1,
          marginBottom: '10px',
        }}>✦ STELLAR</div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          color: 'var(--text-secondary)',
          fontWeight: 500,
        }}>Developer Dashboard</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Enter a public key to explore accounts, transactions & contracts
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '540px' }}>
        <div style={{
          display: 'flex',
          gap: '10px',
          background: 'var(--bg-card)',
          border: `1px solid ${error ? 'var(--red)' : 'var(--border-bright)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '6px 6px 6px 16px',
          transition: 'var(--transition)',
        }}>
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleConnect()}
            placeholder="G... public key"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <button
            onClick={handleConnect}
            style={{
              padding: '9px 20px',
              background: 'var(--cyan)',
              color: 'var(--bg-base)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'var(--transition)',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--cyan-dim)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--cyan)'}
          >
            CONNECT →
          </button>
        </div>
        {error && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--red)', paddingLeft: '4px' }}>
            ✗ {error}
          </div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        width: '100%',
        maxWidth: '540px',
      }}>
        {[
          { icon: '◉', label: 'Account & Balances', desc: 'Assets, sequence number, thresholds' },
          { icon: '⇄', label: 'Transactions', desc: 'Full history, operations, memos' },
          { icon: '◻', label: 'Soroban Contracts', desc: 'Contract data & interaction' },
        ].map(f => (
          <div key={f.label} style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
          }}>
            <div style={{ fontSize: '18px', marginBottom: '6px' }}>{f.icon}</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>{f.label}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
