import React, { useEffect, useState } from 'react'
import { useStore } from '../../lib/store'
import {
  fetchClaimableBalances,
  formatClaimPredicate,
  isValidPublicKey,
} from '../../lib/stellar'
import { buildTransaction, simulateTransaction } from '../../lib/transactionBuilder'
import CopyableValue from './CopyableValue'

function shortId(id) {
  return id ? `${id.slice(0, 10)}…${id.slice(-6)}` : '—'
}

export default function ClaimableBalances() {
  const { connectedAddress, network } = useStore()
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [claimState, setClaimState] = useState({}) // { [balanceId]: { loading, result, error } }

  useEffect(() => {
    if (!connectedAddress || !isValidPublicKey(connectedAddress)) {
      setBalances([])
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    fetchClaimableBalances(connectedAddress, network)
      .then((records) => { if (active) setBalances(records) })
      .catch((err) => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [connectedAddress, network])

  async function handleSimulateClaim(balanceId) {
    setClaimState((prev) => ({ ...prev, [balanceId]: { loading: true, result: null, error: null } }))
    try {
      const result = await simulateTransaction({
        sourceAccount: connectedAddress,
        operations: [{ type: 'claimClaimableBalance', params: { balanceId } }],
        network,
      })
      setClaimState((prev) => ({ ...prev, [balanceId]: { loading: false, result, error: null } }))
    } catch (err) {
      setClaimState((prev) => ({ ...prev, [balanceId]: { loading: false, result: null, error: err.message } }))
    }
  }

  if (!connectedAddress) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Connect an account to view claimable balances.
      </div>
    )
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>
          Claimable Balances
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Pending claimable balances for the connected account
        </div>
      </div>

      {loading && (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
      )}

      {error && (
        <div style={{ color: 'var(--red)', fontSize: '13px', padding: '12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--red)' }}>
          {error}
        </div>
      )}

      {!loading && !error && balances.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '24px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          No claimable balances found for this account.
        </div>
      )}

      {balances.map((bal) => {
        const myClaimant = bal.claimants.find((c) => c.destination === connectedAddress)
        const state = claimState[bal.id] || {}
        return (
          <div
            key={bal.id}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                <CopyableValue value={bal.id}>{shortId(bal.id)}</CopyableValue>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--cyan)', fontFamily: 'var(--font-mono)', background: 'var(--cyan-glow)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cyan-dim)' }}>
                {bal.asset}
              </span>
            </div>

            {/* Details */}
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Row label="Amount" value={`${parseFloat(bal.amount).toLocaleString()} ${bal.asset.split(':')[0]}`} accent="var(--cyan)" />
              <Row label="Sponsor" value={bal.sponsor} mono copyValue={bal.sponsor} />
              <Row label="Ledger" value={bal.last_modified_ledger} />
              {myClaimant && (
                <Row
                  label="Your Predicate"
                  value={formatClaimPredicate(myClaimant.predicate)}
                  mono={false}
                />
              )}
            </div>

            {/* All claimants */}
            {bal.claimants.length > 1 && (
              <details style={{ padding: '0 18px 14px' }}>
                <summary style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                  {bal.claimants.length} claimants
                </summary>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {bal.claimants.map((c, i) => (
                    <div key={i} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <CopyableValue value={c.destination}>{c.destination.slice(0, 8)}…{c.destination.slice(-6)}</CopyableValue>
                      <span style={{ color: 'var(--text-muted)' }}>{formatClaimPredicate(c.predicate)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Claim action */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => handleSimulateClaim(bal.id)}
                disabled={state.loading}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--cyan-dim)',
                  background: 'var(--cyan-glow)',
                  color: 'var(--cyan)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  cursor: state.loading ? 'not-allowed' : 'pointer',
                  opacity: state.loading ? 0.6 : 1,
                }}
              >
                {state.loading ? 'Simulating…' : 'Simulate Claim'}
              </button>

              {state.result && (
                <span style={{ fontSize: '11px', color: 'var(--green)' }}>
                  ✓ Simulation OK — fee ~{state.result.fee ?? state.result.minFee ?? '?'} stroops
                </span>
              )}
              {state.error && (
                <span style={{ fontSize: '11px', color: 'var(--red)' }}>✗ {state.error}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Row({ label, value, mono = true, accent, copyValue }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', flexShrink: 0 }}>{label}</span>
      {copyValue ? (
        <CopyableValue value={copyValue} textStyle={{ fontSize: '12px', color: accent || 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all', textAlign: 'right' }}>
          {value ?? '—'}
        </CopyableValue>
      ) : (
        <span style={{ fontSize: '12px', color: accent || 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all', textAlign: 'right' }}>
          {value ?? '—'}
        </span>
      )}
    </div>
  )
}
