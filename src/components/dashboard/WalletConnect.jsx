import React, { useState } from 'react'
import { useStore } from '../../lib/store'
import { isFreighterInstalled, connectFreighter } from '../../lib/wallet/freighter'
import { isLedgerSupported, connectLedger, disconnectLedger } from '../../lib/wallet/ledger'
import { fetchAccount } from '../../lib/stellar'
import Card from './Card'

const WALLET_TYPES = [
  {
    id: 'freighter',
    name: 'Freighter',
    icon: '✦',
    description: 'Browser extension wallet',
  },
  {
    id: 'ledger',
    name: 'Ledger',
    icon: '⬡',
    description: 'Hardware wallet (USB)',
  },
]

export default function WalletConnect() {
  const {
    network, walletConnected, walletType, walletPublicKey,
    setWalletConnected, disconnectWallet,
    setConnectedAddress, setAccountData, setAccountLoading, setAccountError,
  } = useStore()

  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)
  const [ledgerTransport, setLedgerTransport] = useState(null)

  const handleConnect = async (type) => {
    setConnecting(true)
    setError(null)

    try {
      let publicKey = null

      if (type === 'freighter') {
        const installed = await isFreighterInstalled()
        if (!installed) {
          throw new Error('Freighter wallet is not installed. Get it at https://freighter.app')
        }
        const result = await connectFreighter()
        publicKey = result.publicKey
      } else if (type === 'ledger') {
        const supported = await isLedgerSupported()
        if (!supported) {
          throw new Error('WebUSB is not supported in this browser. Try Chrome.')
        }
        const result = await connectLedger()
        publicKey = result.publicKey
        setLedgerTransport(result.transport)
      }

      if (publicKey) {
        setWalletConnected(true, type, publicKey)
        setConnectedAddress(publicKey)

        // Load account data
        setAccountLoading(true)
        try {
          const account = await fetchAccount(publicKey, network)
          setAccountData(account)
        } catch (err) {
          setAccountError(err.message)
        } finally {
          setAccountLoading(false)
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = () => {
    if (walletType === 'ledger' && ledgerTransport) {
      disconnectLedger(ledgerTransport)
      setLedgerTransport(null)
    }
    disconnectWallet()
    setConnectedAddress(null)
    setAccountData(null)
  }

  if (walletConnected) {
    return (
      <Card title="Wallet Connected" subtitle={walletType}>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px',
            background: 'var(--green-glow)',
            border: '1px solid var(--green)',
            borderRadius: 'var(--radius-md)',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {walletType} Connected
            </span>
          </div>

          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
              PUBLIC KEY
            </div>
            <div style={{
              fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
              wordBreak: 'break-all', lineHeight: 1.5,
              padding: '10px 12px',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}>
              {walletPublicKey}
            </div>
          </div>

          <button
            onClick={handleDisconnect}
            style={{
              padding: '10px 16px',
              background: 'var(--red-glow)',
              border: '1px solid var(--red)',
              borderRadius: 'var(--radius-md)',
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

  return (
    <Card title="Connect Wallet" subtitle="Choose a wallet to connect">
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {WALLET_TYPES.map((wallet) => (
          <button
            key={wallet.id}
            onClick={() => handleConnect(wallet.id)}
            disabled={connecting}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '16px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              cursor: connecting ? 'wait' : 'pointer',
              transition: 'var(--transition)',
              opacity: connecting ? 0.6 : 1,
              textAlign: 'left',
              width: '100%',
            }}
            onMouseEnter={(e) => {
              if (!connecting) {
                e.currentTarget.style.borderColor = 'var(--cyan-dim)'
                e.currentTarget.style.background = 'var(--bg-hover)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = 'var(--bg-elevated)'
            }}
          >
            <span style={{ fontSize: '24px', opacity: 0.85 }}>{wallet.icon}</span>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px' }}>
                {wallet.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {wallet.description}
              </div>
            </div>
            {connecting && (
              <div className="spinner" style={{ marginLeft: 'auto' }} />
            )}
          </button>
        ))}

        {error && (
          <div style={{
            padding: '12px',
            background: 'var(--red-glow)',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            color: 'var(--red)',
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        <div style={{
          fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5,
          padding: '10px 12px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
        }}>
          You can also enter a public key manually on the Connect Panel to explore any account without a wallet.
        </div>
      </div>
    </Card>
  )
}
