import React, { useState } from 'react'
import { useStore } from '../../lib/store'
import { fetchContractInfo, isValidContractId, getSorobanServer, NETWORKS } from '../../lib/stellar'

export default function Contracts() {
  const { network, contractId, setContractId, contractData, setContractData, contractLoading, setContractLoading, contractError, setContractError } = useStore()
  const [input, setInput] = useState('')
  const [ledgerEntries, setLedgerEntries] = useState([])

  async function handleFetch() {
    const id = input.trim()
    setContractId(id)
    setContractError(null)
    setContractData(null)
    setLedgerEntries([])

    if (!id) { setContractError('Enter a contract ID'); return }

    setContractLoading(true)
    try {
      const server = getSorobanServer(network)
      const result = await fetchContractInfo(id, network)
      setContractData(result)
    } catch (e) {
      setContractError(e.message || 'Failed to fetch contract')
    } finally {
      setContractLoading(false)
    }
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Soroban Contracts</div>

      {/* Search */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
      }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.5px' }}>
          Enter a Soroban contract address (C...) to inspect
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFetch()}
            placeholder="C... contract address"
            style={{
              flex: 1,
              background: 'var(--bg-elevated)',
              border: `1px solid ${contractError ? 'var(--red)' : 'var(--border-bright)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
              outline: 'none',
              transition: 'var(--transition)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--cyan-dim)'}
            onBlur={e => e.target.style.borderColor = contractError ? 'var(--red)' : 'var(--border-bright)'}
          />
          <button
            onClick={handleFetch}
            disabled={contractLoading}
            style={{
              padding: '10px 20px',
              background: contractLoading ? 'var(--bg-elevated)' : 'var(--cyan)',
              color: contractLoading ? 'var(--text-muted)' : 'var(--bg-base)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: contractLoading ? 'not-allowed' : 'pointer',
              transition: 'var(--transition)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {contractLoading ? <><div className="spinner" /> Loading</> : 'INSPECT →'}
          </button>
        </div>
        {contractError && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--red)' }}>✗ {contractError}</div>
        )}
      </div>

      {/* Contract data */}
      {contractData && (
        <div className="animate-in">
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--cyan-dim)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 0 24px var(--cyan-glow-sm)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Contract Found</div>
            </div>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '1px' }}>CONTRACT DATA</div>
              <pre style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                overflowX: 'auto',
                lineHeight: 1.6,
                fontFamily: 'var(--font-mono)',
              }}>
                {JSON.stringify(contractData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Info panel when empty */}
      {!contractData && !contractLoading && !contractError && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>◻</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>
            Soroban Contract Explorer
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '340px', margin: '0 auto', lineHeight: 1.6 }}>
            Enter a contract address above to inspect its ledger data, instance storage, and WASM hash on {network === 'testnet' ? 'Testnet' : 'Mainnet'}.
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Contract Instance', desc: 'View Wasm hash & storage' },
              { label: 'Ledger Keys', desc: 'Inspect persistent data' },
              { label: 'Network RPC', desc: NETWORKS[network].sorobanUrl },
            ].map(item => (
              <div key={item.label} style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '12px',
                textAlign: 'left',
                minWidth: '180px',
              }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '3px' }}>{item.label}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
