import React, { useState } from 'react'
import { useStore } from '../../lib/store'
import { fetchPaymentPaths } from '../../lib/stellar'

const PRESET_ASSETS = [
  { label: 'XLM (native)', value: { type: 'native', code: 'XLM' } },
  { label: 'USDC (testnet)', value: { type: 'credit', code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' } },
  { label: 'USDC (mainnet)', value: { type: 'credit', code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' } },
]

function AssetInput({ label, value, onChange }) {
  const [mode, setMode] = useState('preset') // 'preset' | 'custom'
  const [customCode, setCustomCode] = useState('')
  const [customIssuer, setCustomIssuer] = useState('')

  const inputStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    padding: '7px 10px',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
  }

  const toggleStyle = (active) => ({
    padding: '4px 10px',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    background: active ? 'var(--cyan-glow)' : 'transparent',
    border: `1px solid ${active ? 'var(--cyan)' : 'var(--border)'}`,
    color: active ? 'var(--cyan)' : 'var(--text-muted)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'var(--transition)',
  })

  function handlePresetChange(e) {
    const preset = PRESET_ASSETS.find(a => a.label === e.target.value)
    if (preset) onChange(preset.value)
  }

  function handleCustomChange(code, issuer) {
    if (code === 'XLM' && !issuer) {
      onChange({ type: 'native', code: 'XLM' })
    } else if (code && issuer) {
      onChange({ type: 'credit', code, issuer })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button style={toggleStyle(mode === 'preset')} onClick={() => setMode('preset')}>Preset</button>
          <button style={toggleStyle(mode === 'custom')} onClick={() => setMode('custom')}>Custom</button>
        </div>
      </div>
      {mode === 'preset' ? (
        <select onChange={handlePresetChange} style={{ ...inputStyle, cursor: 'pointer' }}
          defaultValue="">
          <option value="" disabled>Select asset…</option>
          {PRESET_ASSETS.map(a => <option key={a.label} value={a.label}>{a.label}</option>)}
        </select>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input
            placeholder="Asset code (e.g. USDC, or XLM for native)"
            style={inputStyle}
            value={customCode}
            onChange={e => { setCustomCode(e.target.value.toUpperCase()); handleCustomChange(e.target.value.toUpperCase(), customIssuer) }}
          />
          {customCode !== 'XLM' && (
            <input
              placeholder="Issuer public key"
              style={inputStyle}
              value={customIssuer}
              onChange={e => { setCustomIssuer(e.target.value); handleCustomChange(customCode, e.target.value) }}
            />
          )}
        </div>
      )}
      {value && (
        <div style={{ fontSize: '11px', color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
          {value.type === 'native' ? '✦ XLM (native)' : `✦ ${value.code}`}
        </div>
      )}
    </div>
  )
}

function PathCard({ path, mode, index }) {
  const sourceAmount = parseFloat(path.source_amount)
  const destAmount = parseFloat(path.destination_amount)
  const rate = mode === 'strict-send'
    ? (destAmount / sourceAmount).toFixed(6)
    : (sourceAmount / destAmount).toFixed(6)

  // Estimate slippage vs best path (index 0 = best)
  const slippage = index === 0 ? null : null // computed by parent

  function assetLabel(a) {
    if (a.asset_type === 'native') return 'XLM'
    return a.asset_code
  }

  const pathAssets = path.path || []

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${index === 0 ? 'var(--cyan-dim)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      position: 'relative',
    }}>
      {index === 0 && (
        <div style={{
          position: 'absolute', top: '12px', right: '14px',
          fontSize: '10px', color: 'var(--cyan)', fontFamily: 'var(--font-mono)',
          background: 'var(--cyan-glow)', border: '1px solid var(--cyan-dim)',
          borderRadius: 'var(--radius-sm)', padding: '2px 8px', letterSpacing: '1px',
        }}>BEST RATE</div>
      )}

      {/* Path route */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <AssetBadge label={assetLabel(path.source_asset_type !== undefined ? path : { asset_type: path.source_asset_type, asset_code: path.source_asset_code })} isSource />
        {pathAssets.map((a, i) => (
          <React.Fragment key={i}>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
            <AssetBadge label={assetLabel(a)} />
          </React.Fragment>
        ))}
        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
        <AssetBadge label={assetLabel({ asset_type: path.destination_asset_type, asset_code: path.destination_asset_code })} isDest />
      </div>

      {/* Amounts & rate */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <Metric label="Send" value={`${sourceAmount.toLocaleString('en-US', { maximumFractionDigits: 7 })} ${assetLabel({ asset_type: path.source_asset_type, asset_code: path.source_asset_code })}`} />
        <Metric label="Receive" value={`${destAmount.toLocaleString('en-US', { maximumFractionDigits: 7 })} ${assetLabel({ asset_type: path.destination_asset_type, asset_code: path.destination_asset_code })}`} accent="var(--green)" />
        <Metric label={mode === 'strict-send' ? 'Rate (dest/src)' : 'Rate (src/dest)'} value={rate} accent="var(--cyan)" />
      </div>

      {path.slippagePct !== undefined && (
        <div style={{ fontSize: '11px', color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
          ~{path.slippagePct}% vs best path
        </div>
      )}
    </div>
  )
}

function AssetBadge({ label, isSource, isDest }) {
  return (
    <span style={{
      padding: '3px 8px',
      background: isSource ? 'var(--cyan-glow)' : isDest ? 'rgba(74,222,128,0.08)' : 'var(--bg-surface)',
      border: `1px solid ${isSource ? 'var(--cyan-dim)' : isDest ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-sm)',
      fontSize: '11px',
      fontFamily: 'var(--font-mono)',
      color: isSource ? 'var(--cyan)' : isDest ? 'var(--green)' : 'var(--text-secondary)',
    }}>{label}</span>
  )
}

function Metric({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: accent || 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

export default function PathExplorer() {
  const { network } = useStore()
  const [sourceAsset, setSourceAsset] = useState(null)
  const [destAsset, setDestAsset] = useState(null)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('strict-send')
  const [paths, setPaths] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleFind() {
    if (!sourceAsset || !destAsset || !amount) return
    setLoading(true)
    setError(null)
    setPaths(null)
    try {
      const results = await fetchPaymentPaths({ sourceAsset, destAsset, amount, mode, network })
      // Sort by best rate and annotate slippage
      const sorted = [...results].sort((a, b) => {
        const rateA = mode === 'strict-send'
          ? parseFloat(a.destination_amount) / parseFloat(a.source_amount)
          : parseFloat(a.source_amount) / parseFloat(a.destination_amount)
        const rateB = mode === 'strict-send'
          ? parseFloat(b.destination_amount) / parseFloat(b.source_amount)
          : parseFloat(b.source_amount) / parseFloat(b.destination_amount)
        return mode === 'strict-send' ? rateB - rateA : rateA - rateB
      })
      const bestRate = sorted[0]
        ? (mode === 'strict-send'
          ? parseFloat(sorted[0].destination_amount) / parseFloat(sorted[0].source_amount)
          : parseFloat(sorted[0].source_amount) / parseFloat(sorted[0].destination_amount))
        : 1
      const annotated = sorted.map((p, i) => {
        if (i === 0) return p
        const rate = mode === 'strict-send'
          ? parseFloat(p.destination_amount) / parseFloat(p.source_amount)
          : parseFloat(p.source_amount) / parseFloat(p.destination_amount)
        const slippagePct = (((bestRate - rate) / bestRate) * 100).toFixed(2)
        return { ...p, slippagePct }
      })
      setPaths(annotated)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const canSearch = sourceAsset && destAsset && amount && parseFloat(amount) > 0

  const modeToggle = (m, label) => (
    <button
      onClick={() => setMode(m)}
      style={{
        padding: '6px 14px',
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
        background: mode === m ? 'var(--cyan-glow)' : 'transparent',
        border: `1px solid ${mode === m ? 'var(--cyan)' : 'var(--border)'}`,
        color: mode === m ? 'var(--cyan)' : 'var(--text-secondary)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        transition: 'var(--transition)',
      }}
    >{label}</button>
  )

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Path Explorer</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            Find DEX conversion paths via Horizon
          </div>
        </div>
        <div style={{
          padding: '6px 12px',
          background: network === 'testnet' ? 'var(--amber-glow)' : 'var(--green-glow)',
          border: `1px solid ${network === 'testnet' ? 'var(--amber)' : 'var(--green)'}`,
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px',
          color: network === 'testnet' ? 'var(--amber)' : 'var(--green)',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>{network}</div>
      </div>

      {/* Form */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Mode */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>Mode</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {modeToggle('strict-send', 'Strict Send')}
            {modeToggle('strict-receive', 'Strict Receive')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {mode === 'strict-send'
              ? 'Fix the amount you send — see how much you receive'
              : 'Fix the amount you receive — see how much you need to send'}
          </div>
        </div>

        {/* Assets + amount */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <AssetInput label="Source Asset" value={sourceAsset} onChange={setSourceAsset} />
          <AssetInput label="Destination Asset" value={destAsset} onChange={setDestAsset} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {mode === 'strict-send' ? 'Amount to Send' : 'Amount to Receive'}
          </span>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 100"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              padding: '9px 12px',
              width: '200px',
              outline: 'none',
            }}
          />
        </div>

        <button
          onClick={handleFind}
          disabled={!canSearch || loading}
          style={{
            alignSelf: 'flex-start',
            padding: '9px 24px',
            background: canSearch && !loading ? 'var(--cyan-glow)' : 'transparent',
            border: `1px solid ${canSearch && !loading ? 'var(--cyan)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            color: canSearch && !loading ? 'var(--cyan)' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            cursor: canSearch && !loading ? 'pointer' : 'not-allowed',
            transition: 'var(--transition)',
            letterSpacing: '0.5px',
          }}
        >
          {loading ? 'Searching…' : 'Find Paths'}
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div className="spinner" />
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-lg)', padding: '16px 20px',
          color: '#ef4444', fontFamily: 'var(--font-mono)', fontSize: '13px',
        }}>
          {error}
        </div>
      )}

      {paths !== null && !loading && (
        paths.length === 0 ? (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '40px',
            textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px',
          }}>
            No payment paths found for this pair on {network}. Try different assets or a different network.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {paths.length} path{paths.length !== 1 ? 's' : ''} found — sorted by best rate
            </div>
            {paths.map((p, i) => <PathCard key={i} path={p} mode={mode} index={i} />)}
          </div>
        )
      )}
    </div>
  )
}
