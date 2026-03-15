import React, { useState } from 'react'
import { useStore } from '../../lib/store'
import { fundTestnetAccount, isValidPublicKey } from '../../lib/stellar'

export default function Faucet() {
  const { connectedAddress, faucetLoading, setFaucetLoading, faucetResult, setFaucetResult } = useStore()
  const [input, setInput] = useState(connectedAddress || '')
  const [error, setError] = useState('')

  async function handleFund() {
    const addr = input.trim()
    if (!isValidPublicKey(addr)) { setError('Invalid public key'); return }
    setError('')
    setFaucetResult(null)
    setFaucetLoading(true)
    try {
      const result = await fundTestnetAccount(addr)
      setFaucetResult({ success: true, address: addr, data: result })
    } catch (e) {
      setFaucetResult({ success: false, error: e.message })
    } finally {
      setFaucetLoading(false)
    }
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Testnet Faucet</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fund any testnet account with 10,000 XLM via Friendbot</div>
      </div>

      {/* Fund card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--amber)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: '0 0 24px var(--amber-glow)',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>⬡</span>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Friendbot</div>
          <span style={{
            marginLeft: 'auto',
            padding: '3px 8px',
            background: 'var(--amber-glow)',
            border: '1px solid var(--amber)',
            borderRadius: '3px',
            fontSize: '10px',
            color: 'var(--amber)',
            letterSpacing: '1px',
          }}>TESTNET ONLY</span>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Friendbot creates and funds accounts with 10,000 XLM on testnet.
            It can also re-fund existing accounts.
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <input
              value={input}
              onChange={e => { setInput(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleFund()}
              placeholder="G... public key to fund"
              style={{
                flex: 1,
                background: 'var(--bg-elevated)',
                border: `1px solid ${error ? 'var(--red)' : 'var(--border-bright)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
            <button
              onClick={handleFund}
              disabled={faucetLoading}
              style={{
                padding: '10px 20px',
                background: faucetLoading ? 'var(--bg-elevated)' : 'var(--amber)',
                color: faucetLoading ? 'var(--text-muted)' : 'var(--bg-base)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: faucetLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
              }}
            >
              {faucetLoading ? <><div className="spinner" />Funding…</> : 'FUND ACCOUNT →'}
            </button>
          </div>
          {error && <div style={{ fontSize: '12px', color: 'var(--red)' }}>✗ {error}</div>}

          {connectedAddress && input !== connectedAddress && (
            <button
              onClick={() => setInput(connectedAddress)}
              style={{ fontSize: '11px', color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              ← Use connected address
            </button>
          )}
        </div>
      </div>

      {/* Result */}
      {faucetResult && (
        <div className="animate-in" style={{
          background: 'var(--bg-card)',
          border: `1px solid ${faucetResult.success ? 'var(--green)' : 'var(--red)'}`,
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: faucetResult.success ? '0 0 24px var(--green-glow)' : '0 0 24px var(--red-glow)',
        }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{faucetResult.success ? '✓' : '✗'}</span>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', color: faucetResult.success ? 'var(--green)' : 'var(--red)' }}>
              {faucetResult.success ? 'Account Funded!' : 'Funding Failed'}
            </div>
          </div>
          <div style={{ padding: '16px 18px' }}>
            {faucetResult.success ? (
              <>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Address funded:</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', marginBottom: '14px' }}>
                  {faucetResult.address}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--green)' }}>
                  ✓ 10,000 XLM added to account on testnet
                </div>
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--red)' }}>{faucetResult.error}</div>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>About Friendbot</div>
          Friendbot is Stellar's official testnet faucet. It activates new accounts with the minimum XLM reserve
          and can refund existing accounts. The faucet is rate-limited per address. This feature is disabled on Mainnet.
        </div>
      </div>
    </div>
  )
}
