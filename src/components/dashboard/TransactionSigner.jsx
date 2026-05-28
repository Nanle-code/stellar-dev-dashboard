import React, { useState } from 'react'
import { useStore } from '../../lib/store'
import { signTransactionWithFreighter } from '../../lib/wallet/freighter'
import { signXdrWithLedger, isLedgerSupported, getActiveLedgerSession } from '../../lib/wallet/ledger'
import { NETWORKS } from '../../lib/stellar'
import Card from './Card'

export default function TransactionSigner() {
  const { walletConnected, walletType, walletPublicKey, network } = useStore()
  const [xdr, setXdr] = useState('')
  const [signedXdr, setSignedXdr] = useState(null)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [ledgerPrompt, setLedgerPrompt] = useState(false)

  const networkPassphrase = NETWORKS[network]?.passphrase || NETWORKS.testnet.passphrase

  const handleSign = async () => {
    if (!xdr.trim()) {
      setError('Please enter a transaction XDR to sign')
      return
    }

    setSigning(true)
    setError(null)
    setSignedXdr(null)

    try {
      let result = null

      if (walletType === 'freighter') {
        const networkName = network === 'mainnet' ? 'PUBLIC' : 'TESTNET'
        result = await signTransactionWithFreighter(xdr.trim(), networkName)
      } else if (walletType === 'ledger') {
        await _signWithLedger()
        return // _signWithLedger manages its own state
      } else {
        throw new Error('No wallet connected. Connect a wallet first.')
      }

      setSignedXdr(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setSigning(false)
    }
  }

  const _signWithLedger = async () => {
    // Check browser support first
    const supported = await isLedgerSupported()
    if (!supported) {
      setError(
        'WebUSB/WebHID is not supported in this browser. ' +
        'Please use Chrome or a Chromium-based browser to sign with Ledger.'
      )
      setSigning(false)
      return
    }

    // If we already have a live stellarApp session from WalletConnect, use it.
    // Otherwise, prompt the user to reconnect via the Wallet tab.
    const { stellarApp, publicKey } = getActiveLedgerSession()
    if (!stellarApp) {
      setError(
        'Ledger session not found. Please connect your Ledger in the Wallet tab first, ' +
        'then return here to sign.'
      )
      setSigning(false)
      return
    }

    try {
      setLedgerPrompt(true)
      const signed = await signXdrWithLedger(
        xdr.trim(),
        networkPassphrase,
        stellarApp,
        publicKey || walletPublicKey
      )
      setSignedXdr(signed)
    } catch (err) {
      setError(err.message)
    } finally {
      setLedgerPrompt(false)
      setSigning(false)
    }
  }

  const handleCopy = () => {
    if (signedXdr) {
      navigator.clipboard.writeText(signedXdr)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!walletConnected) {
    return (
      <Card title="Transaction Signer" subtitle="Sign transactions with your wallet">
        <div style={{
          padding: '32px 18px', textAlign: 'center',
          color: 'var(--text-muted)', fontSize: '13px',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>✎</div>
          Connect a wallet to sign transactions.
          <br />
          <span style={{ fontSize: '11px' }}>Use the Wallet tab to connect Freighter or Ledger.</span>
        </div>
      </Card>
    )
  }

  return (
    <Card title="Transaction Signer" subtitle={`Signing with ${walletType}`}>
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Signer info */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 12px',
          background: 'var(--cyan-glow)',
          border: '1px solid var(--cyan-dim)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px', color: 'var(--cyan)',
        }}>
          <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Signer:</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {walletPublicKey?.slice(0, 8)}…{walletPublicKey?.slice(-8)}
          </span>
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{walletType}</span>
        </div>

        {/* Ledger device prompt banner */}
        {ledgerPrompt && (
          <div style={{
            padding: '12px',
            background: 'var(--amber-glow, rgba(245,158,11,0.1))',
            border: '1px solid var(--amber, #f59e0b)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            color: 'var(--amber, #f59e0b)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '18px' }}>🔐</span>
            Review and confirm the transaction on your Ledger device…
          </div>
        )}

        {/* XDR input */}
        <div>
          <label style={{
            fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px',
            textTransform: 'uppercase', display: 'block', marginBottom: '6px',
          }}>
            TRANSACTION XDR
          </label>
          <textarea
            value={xdr}
            onChange={(e) => setXdr(e.target.value)}
            placeholder="Paste the unsigned transaction XDR envelope here…"
            rows={5}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              resize: 'vertical',
              lineHeight: 1.5,
              outline: 'none',
            }}
          />
        </div>

        {/* Sign button */}
        <button
          onClick={handleSign}
          disabled={signing || !xdr.trim()}
          style={{
            padding: '12px 20px',
            background: signing ? 'transparent' : 'var(--cyan-glow)',
            border: `1px solid ${signing ? 'var(--border)' : 'var(--cyan)'}`,
            borderRadius: 'var(--radius-md)',
            color: signing ? 'var(--text-muted)' : 'var(--cyan)',
            fontSize: '13px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            cursor: signing ? 'wait' : 'pointer',
            transition: 'var(--transition)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            opacity: !xdr.trim() ? 0.5 : 1,
          }}
        >
          {signing ? (
            <>
              <div className="spinner" />
              {ledgerPrompt ? 'Waiting for Ledger…' : 'Signing…'}
            </>
          ) : (
            'Sign Transaction'
          )}
        </button>

        {/* Error */}
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

        {/* Signed result */}
        {signedXdr && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                SIGNED XDR
              </label>
              <button
                onClick={handleCopy}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: '11px',
                  color: copied ? 'var(--green)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  transition: 'var(--transition)',
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{
              padding: '12px',
              background: 'var(--bg-base)',
              border: '1px solid var(--green)',
              borderRadius: 'var(--radius-md)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              wordBreak: 'break-all',
              lineHeight: 1.5,
              maxHeight: '120px',
              overflowY: 'auto',
            }}>
              {signedXdr}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
