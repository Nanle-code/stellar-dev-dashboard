import React, { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { fetchAccount } from '../../lib/stellar'
import { isFreighterInstalled, connectFreighter } from '../../lib/wallet/freighter'
import { disconnectLedger } from '../../lib/wallet/ledger'
import {
  HARDWARE_WALLET_DEVICES,
  LEDGER_DERIVATION_PATHS,
  connectHardwareWallet,
} from '../../lib/wallet/devices'
import { connectWalletConnect, disconnectWalletConnect } from '../../lib/wallet/walletconnect'
import { isXBullInstalled, connectXBull } from '../../lib/wallet/xbull'
import {ed, connectLobstr, buildSocialRecoveryConfig } from '../../lib/wallet/lobstr'
import { isSolarInstalledsolar'
import {
  appendSecurityAuditLog,
  buildTransactionConfirmationSummary,
  detectPhishingRisk,
  readSecurityAuditLog,
  getSessionSecurityPosture,
} from '../../lib/wallet/security'
import { Card } from './Card'

// ─── Wallet Definitions ───────────────────────────────────────────────────────

const SOFTWARE_WALLETS = [
  {
    id: 'freighter',
    name: 'Freighter',
    icon: '✦',
    description: 'Browser extension wallet by Stellar',
    type: 'extension',
  },
  {
    id: 'xbull',
    name: 'xBull Wallet',
    icon: '⚡',
    description: 'Browser extension + mobile connector',
    type: 'extension',
  },
  {
    id: 'lobstr',
    name: 'LOBSTR',
    icon: '🌟',
    description: 'Mobile wallet with social recovery (SEP-0007)',
    type: 'mobile',
  },
  {
    id: 'solar',
    name: 'Solar Wallet',
    icon: '☀',
    description: 'Mobile & desktop wallet (SEP-0007)',
    type: 'mobile',
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect v2',
    icon: '⬡',
    description: 'Scan QR code with any WC-compatible mobile wallet',
    type: 'walletconnect',
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SecurityBadge({ posture }) {
  const color =
    posture.tier === 'high'
      ? 'var(--green)'
      : posture.tier === 'medium'
      ? 'var(--amber)'
      : 'var(--red)'
  return (
    <div
      style={{
        border: `1px solid ${color}`,
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)',
 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
        }}
      >
        Session Security: {posture.tier}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Score {posture.score}/100
      </div>
      {posture.factors.length > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {posture.factors.join(' · ')}
        </div>
      )}
    </div>
  )
}

function WalletButton({ wallet, onClick, connecting, activeId }) {
  const isActive = activeId === wallet.id
  return (
    <button
      onClick={() => onClick(wallet.id)}
      disabled={connecting}
      aria-label={`Connect ${wallet.name}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        14px 16px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-primary)',
        cursor: connecting ? 'wait' : 'pointer',
        transition: 'var(--transition)',
        opacity: connecting ? 0.65 : 1,
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span style={{ fontSize: '22px', minWidth: '28px', textAlign: 'center' }}>
        {wallet.icon}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px' }}>
          {wallet.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {wallet.description}
        </div>
      </div>
      {connecting && isActive && (
        <div className="spinner" style={{ marginLeft: 'auto', flexShrink: 0 }} />
      )}
    </button>
  )
}

// ─── Social Recover─

function SocialRecoveryPanel() {
  const [guardians, setGuardians] = useState('')
  const [threshold, setThreshold] = useState(1)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState(null)

  const handleBuild = () => {
    setErr(null)
    setResult(null)
    try {
      const keys = guardians
        .split(/[\n,]+/)
        .map((k) => k.trim())
        .filter(Boolean)
      const config = buildSocialRecoveryConfig(keys, Number(threshold))
      setResult(config)
    } catch ( {
      setErr(e.message)
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        background: 'var(--bg-elevated)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
        }}
      >
        Social Recovery Setup (LOBSTR)
      </div>
      <textarea
        value={guardians}
        onChange={(e) => setGuardians(e.target.value)}
        placeholder="Guardian G... public keys, one per line or comma-separated"
        rows={3}
        style={{
          width: '100%',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Threshold:
        </label>
        <input
          type="number"
          min={1}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          style={{
            width: '60px',
   'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px',
            color: 'var(--text-primary)',
            fontSize: '12px',
          }}
        />
        <button
          onClick={handleBuild}
          style={{
            padding: '6px 14px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Build Config
        </button>
      </div>
      {err && (
        <div style={{ fontSize: '11px', color: 'var(--red)' }}>{err}</div>
      )}
      {result && (
        <pre
          style={{
            margin: 0,
            fontSize: '11px',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WalletConnect() {
  const {
    network,
    walletConnected,
    walletType,
    walletPublicKey,
    setWalletConnected,
    disconnectWallet,
    setConnectedAddress,
    setAccountData,
    setAccountLoading,
    setAccountError,
  } = useStore()

  const [connecting, setConnecting] = useState(false)
  const [connectingId, setConnectingId] = useState(null)
  const [error, setError] = useState(null)
  const [ledgerTransport, setLedgerTransport] = useState(null)
  const [manualHardwareKey, setManualHardwareKey] = useState('')
  const [selectedDerivationPath, setSelectedDerivationPath] = useState(LEDGER_DERIVATION_PATHS[0].path)
  const [safetyInput, setSafetyInput] = useState('https://stellar.org')
  const [auditLog, setAuditLog] = useState(() => readSecurityAuditLog())
  const [showSocialRecovery, setShowSocialRecovery] = useState(false)

  const phishingState = useMemo(() => detectPhishingRisk(safetyInput), [safetyInput])

  const posture = useMemo(
    () =>
      getSessionSecurityPosture({
        walletType,
        mode: walletType === 'trezor' || walletType === 'keystone' ? 'watch-only' : 'native-signing',
        phishingSafe: phishingState.safe,
      }),
    [phishingState.safe, walletType]
  )

  const refreshAudit = (entry) => setAuditLog(appendSecurityAuditLog(entry))

  const connectCommon = async (type, publicKey, options = {}) => {
    setWallet type, publicKey)
    setConnectedAddress(publicKey)
    refreshAudit({
      action: 'wallet_connected',
      status: 'success',
      details: `${type} connected${options.mode ? ` (${options.mode})` : ''}`,
    })

    setAccountLoading(true)
    try {
      const account = await fetchAccount(publicKey, network)
      setAccountData(account)
      refreshAudit({
        action: 'account_loaded',
        status: 'success',
        details: `Fetched account ${publicKey.slice(0, 6)}...`,
      })
    } catch (err) {
      setAccountError(err.message)
      refreshAudit({ action: 'account_load_error', status: 'error', details: err.message })
    } finally {
      setAccountLoading(false)
    }
  }

  const handleSoftwareConnect = async (walletId) => {
    setConnecting(true)
    setConnectingId(walletId)
    setError(null)

    try {
      switch (walletId) {
        case 'freighter': {
          const installed = await isFreighterInstalled()
          if (!installed) {
            throw new Error('Freighter is ninstalled. Get it at https://freighter.app')
          }
          const result = await connectFreighter()
          await connectCommon('freighter', result.publicKey)
          break
        }

        case 'xbull': {
          const result = await connectXBull()
          await connectCommon('xbull', result.publicKey, {
            mode: isXBullInstalled() ? 'extension' : 'connector',
          })
          break
        }

        case 'lobstr': {
          const result = await connectLobstr()
          await connectCommon('lobstr', result.publicKey, { mode: result.mode })
          break
        }

        case 'solar': {
          const result = await connectSolar()
          await connectCommon('solar', result.publicKey, { mode: result.mode })
          break
        }

        case 'walletconnect': {
          const result = await connectWalletConnect(network)
          await connectCommon('walletconnect', result.publicKey, { mode: 'walletconnect-v2' })
          break
        }

        default:
          throw new Error(`Unknown wallet type: ${walletId}`)
      }
    } catch (err) {
      setError(err.message)
      refreshAudit({
        action: 'wallet_connect_failed',
        status: 'error',
        details: `${walletId}: ${err.message}`,
      })
    } finally {
      setConnecting(false)
      setConnectingId(null)
    }
 color: 'var(--red)',
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </Card>
  )
}
 <div style={{ color: 'var(--text-muted)' }}>
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '12px',
              background: 'var(--red-glow)',
              border: '1px solid var(--red)',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
             key={entry.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                    {entry.action}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>{entry.details}</div>
                      {auditLog.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              No security events yet.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '180px',
                overflowY: 'auto',
              }}
            >
              {auditLog.slice(0, 8).map((entry) => (
                <div
                  Security Audit Log */}
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            padding: '12px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            Security Audit Log
          </div>
     
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              boxSizing: 'border-box',
            }}
          />
          <div
            style={{
              fontSize: '12px',
              color: phishingState.safe ? 'var(--green)' : 'var(--red)',
            }}
          >
            {phishingState.reason}
          </div>
        </div>

        {/* ,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
            }}
          >
            Phishing Protection
          </div>
          <input
            value={safetyInput}
            onChange={(e) => setSafetyInput(e.target.value)}
            placeholder="Paste site or transaction destination"
            aria-label="Phishing detection input"
            style={{
              width: '100%',
              background: 'var(--bg-card)',ocialRecovery && <SocialRecoveryPanel />}
        </div>

        {/* Phishing Protection */}
        <div
          style={{
            border: `1px solid ${phishingState.safe ? 'var(--green)' : 'var(--red)'}`,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              fontSize: '11px' <div>
          <button
            onClick={() => setShowSocialRecovery((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '11px',
              cursor: 'pointer',
              padding: '4px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
            }}
          >
            {showSocialRecovery ? '▾' : '▸'} Social Recovery Setup
          </button>
          {showS         <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {device.features.join(' · ')}
              </div>
              {connecting && connectingId === device.id && (
                <div
                  className="spinner"
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Social Recovery */}
       var(--text-primary)',
                cursor: connecting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                flexDirection: 'column',
                gap: '2px',
                position: 'relative',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '12px' }}>{device.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {device.description}
              </div>
         {HARDWARE_WALLET_DEVICES.map((device) => (
            <button
              key={device.id}
              onClick={() => handleHardwareConnect(device.id)}
              disabled={connecting}
              aria-label={`Connect ${device.name}`}
              style={{
                padding: '10px 12px',
                textAlign: 'left',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: ' public key for Trezor / Keystone (watch-only)"
            aria-label="Hardware wallet public key"
            style={{
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              boxSizing: 'border-box',
            }}
          />

      mily: 'var(--font-mono)',
                fontSize: '11px',
              }}
            >
              {LEDGER_DERIVATION_PATHS.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Watch-only key input for Trezor / Keystone */}
          <input
            value={manualHardwareKey}
            onChange={(e) => setManualHardwareKey(e.target.value)}
            placeholder="G...             Ledger account (derivation path)
            </label>
            <select
              id="ledger-path-select"
              value={selectedDerivationPath}
              onChange={(e) => setSelectedDerivationPath(e.target.value)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px',
                color: 'var(--text-primary)',
                fontFa   style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
            }}
          >
            Hardware Wallets
          </div>

          {/* Ledger derivation path selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              style={{ fontSize: '11px', color: 'var(--text-muted)' }}
              htmlFor="ledger-path-select"
            >
 ck={handleSoftwareConnect}
              connecting={connecting}
              activeId={connectingId}
            />
          ))}
        </div>

        {/* Hardware Wallets */}
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            background: 'var(--bg-elevated)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div
         and WalletConnect v2">
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SecurityBadge posture={posture} />

        {/* Software / Mobile / WalletConnect wallets */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {SOFTWARE_WALLETS.map((wallet) => (
            <WalletButton
              key={wallet.id}
              wallet={wallet}
              onCli        borderRadius: 'var(--radius-md)',
              color: 'var(--red)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              transition: 'var(--transition)',
            }}
          >
            Disconnect Wallet
          </button>
        </div>
      </Card>
    )
  }

  // ─── Connect State ───────────────────────────────────────────────────────

  return (
    <Card title="Connect Wallet" subtitle="Software, mobile, hardware,  <pre
              style={{
                margin: 0,
                fontSize: '11px',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {JSON.stringify(confirmationSummary, null, 2)}
            </pre>
          </div>

          <button
            onClick={handleDisconnect}
            style={{
              padding: '10px 16px',
              background: 'var(--red-glow)',
              border: '1px solid var(--red)',
      px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              padding: '12px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
              }}
            >
              Confirmation Preview
            </div>
           ',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                wordBreak: 'break-all',
                lineHeight: 1.5,
                padding: '10px 12px',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
            >
              {walletPublicKey}
            </div>
          </div>

          <div
            style={{
              border: '1g: '0.5px',
              }}
            >
              {walletType} Connected
            </span>
          </div>

          <div>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}
            >
              Public Key
            </div>
            <div
              style={{
                fontSize: '12pxdius-md)',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--green)',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontSize: '12px',
                color: 'var(--green)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacin {
    return (
      <Card title="Wallet Connected" subtitle={walletType}>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <SecurityBadge posture={posture} />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              background: 'var(--green-glow)',
              border: '1px solid var(--green)',
              borderRadius: 'var(--ra     details: `${walletType || 'wallet'} disconnected`,
    })
    disconnectWallet()
    setConnectedAddress(null)
    setAccountData(null)
  }

  const confirmationSummary = buildTransactionConfirmationSummary({
    network,
    operationCount: 0,
    totalAmount: '0',
    destination: walletPublicKey || 'N/A',
    memo: 'Wallet connect safety preview',
    riskLevel: phishingState.safe ? 'low' : 'high',
  })

  // ─── Connected State ─────────────────────────────────────────────────────

  if (walletConnected)rr.message}`,
      })
    } finally {
      setConnecting(false)
      setConnectingId(null)
    }
  }

  const handleDisconnect = async () => {
    if (walletType === 'ledger' && ledgerTransport) {
      disconnectLedger(ledgerTransport)
      setLedgerTransport(null)
    }
    if (walletType === 'walletconnect') {
      try {
        await disconnectWalletConnect()
      } catch {
        // Already disconnected
      }
    }

    refreshAudit({
      action: 'wallet_disconnected',
      status: 'info',
 allet(walletId, {
        manualPublicKey: manualHardwareKey,
        derivationPath: walletId === 'ledger' ? selectedDerivationPath : undefined,
      })

      if (walletId === 'ledger' && result.transport) {
        setLedgerTransport(result.transport)
      }

      await connectCommon(walletId, result.publicKey, { mode: result.mode })
    } catch (err) {
      setError(err.message)
      refreshAudit({
        action: 'hardware_connect_failed',
        status: 'error',
        details: `${walletId}: ${e  }

  const handleHardwareConnect = async (walletId) => {
    setConnecting(true)
    setConnectingId(walletId)
    setError(null)

    try {
      const result = await connectHardwareW