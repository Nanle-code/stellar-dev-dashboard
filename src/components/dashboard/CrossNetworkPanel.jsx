import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useStore } from '../../lib/store'
import { probeNetworkStatuses, compareAccountsAcrossNetworks, NETWORK_LABELS, NETWORK_ORDER } from '../../lib/crossNetwork'
import { shortAddress } from '../../lib/stellar'
import { Globe, CheckCircle, XCircle, RefreshCw, Activity, X } from 'lucide-react'

function statusColor(status) {
  return status === 'up' ? '#22c55e' : '#ef4444'
}

export default function CrossNetworkPanel({ onClose }) {
  const network = useStore((s) => s.network)
  const connectedAddress = useStore((s) => s.connectedAddress)
  const setNetwork = useStore((s) => s.setNetwork)

  const [probeResults, setProbeResults] = useState([])
  const [comparison, setComparison] = useState(null)
  const [comparing, setComparing] = useState(false)
  const [probing, setProbing] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const handleProbe = useCallback(async () => {
    setProbing(true)
    try {
      const results = await probeNetworkStatuses()
      if (mountedRef.current) setProbeResults(results)
    } catch { /* best-effort */ }
    if (mountedRef.current) setProbing(false)
  }, [])

  useEffect(() => { handleProbe() }, [handleProbe])

  const handleCompare = useCallback(async () => {
    if (!connectedAddress) return
    setComparing(true)
    try {
      const results = await compareAccountsAcrossNetworks(connectedAddress)
      if (mountedRef.current) setComparison(results)
    } catch { /* best-effort */ }
    if (mountedRef.current) setComparing(false)
  }, [connectedAddress])

  const handleSwitchNetwork = useCallback((target) => {
    if (target !== network) setNetwork(target)
  }, [network, setNetwork])

  return (
    <>
    <div style={{
      padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px',
      fontSize: '11px', height: '100%', overflow: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Globe size={13} /> Network Status
        </span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={handleProbe}
            disabled={probing}
            title="Re-probe all networks"
            style={{
              border: '1px solid #253040', borderRadius: '4px', background: '#1a2332',
              color: 'var(--text-muted)', cursor: 'pointer', padding: '3px 6px',
              display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px',
            }}
          >
            <RefreshCw size={11} className={probing ? 'spin' : ''} /> Probe
          </button>
          {onClose && (
            <button onClick={onClose} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {NETWORK_ORDER.map((key) => {
          const probe = probeResults.find((r) => r.network === key)
          const isActive = key === network
          return (
            <button
              key={key}
              onClick={() => handleSwitchNetwork(key)}
              disabled={key === 'custom'}
              title={key === 'custom' ? 'Configure in settings' : `Switch to ${NETWORK_LABELS[key] || key}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '7px 8px', borderRadius: '6px',
                border: isActive ? '1px solid #06b6d460' : '1px solid transparent',
                background: isActive ? '#06b6d410' : 'transparent',
                cursor: key === 'custom' ? 'not-allowed' : 'pointer',
                transition: 'var(--transition)',
                opacity: key === 'custom' ? 0.4 : 1,
              }}
              onMouseEnter={(e) => { if (!isActive && key !== 'custom') e.currentTarget.style.background = '#0f1a2a' }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                background: probe ? statusColor(probe.status) : '#4a6578',
                boxShadow: probe?.status === 'up' ? '0 0 6px #22c55e60' : 'none',
              }} />
              <span style={{
                flex: 1, textAlign: 'left', fontSize: '11px', fontWeight: isActive ? 600 : 400,
                color: isActive ? '#06b6d4' : 'var(--text-primary)',
              }}>
                {NETWORK_LABELS[key] || key}
              </span>
              {isActive && <span style={{ fontSize: '9px', color: '#06b6d4', fontFamily: 'var(--font-mono)' }}>ACTIVE</span>}
              {probe && (
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {probe.horizonMs != null ? `${probe.horizonMs}ms` : '—'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {connectedAddress && (
        <>
          <div style={{ borderTop: '1px solid #1a2332', marginTop: '4px', paddingTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Activity size={11} /> Account Comparison
              </span>
              <button
                onClick={handleCompare}
                disabled={comparing}
                style={{
                  border: '1px solid #253040', borderRadius: '4px', background: '#1a2332',
                  color: 'var(--text-muted)', cursor: 'pointer', padding: '3px 6px',
                  fontSize: '9px', display: 'flex', alignItems: 'center', gap: '3px',
                }}
              >
                <RefreshCw size={10} className={comparing ? 'spin' : ''} /> Compare
              </button>
            </div>

            {comparison === null ? (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '4px 0' }}>
                Click &quot;Compare&quot; to fetch {shortAddress(connectedAddress)} across mainnet, testnet, futurenet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {comparison.map((result) => (
                  <div
                    key={result.network}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 8px', borderRadius: '4px', background: '#0d1520',
                      fontSize: '10px',
                    }}
                  >
                    {result.success ? (
                      <CheckCircle size={11} color="#22c55e" style={{ flexShrink: 0 }} />
                    ) : (
                      <XCircle size={11} color="#ef4444" style={{ flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {NETWORK_LABELS[result.network] || result.network}
                      </div>
                      {result.success ? (
                        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
                          {parseFloat(result.balance || '0').toFixed(4)} XLM · {result.subentryCount} subentries · seq {result.sequence?.slice(0, 12)}
                        </div>
                      ) : (
                        <div style={{ color: '#ef4444', fontSize: '9px' }}>{result.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #1a2332', paddingTop: '8px', fontSize: '9px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <strong>Network-aware actions:</strong>
            <ul style={{ margin: '4px 0 0 0', paddingLeft: '14px' }}>
              <li>Each network has independent account state</li>
              <li>Transactions cannot cross networks</li>
              <li>Testnet XLM has no real value</li>
              <li>Address may exist on one network but not another</li>
            </ul>
          </div>
        </>
      )}
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </>
  )
}
