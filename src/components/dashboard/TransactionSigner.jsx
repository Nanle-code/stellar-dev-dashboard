import React, { useState } from 'react'
import { useStore } from '../../lib/store'
import { signTransactionWithFreighter } from '../../lib/wallet/freighter'
import Card from './Card'

export default function TransactionSigner() {
  const { walletConnected, walletType, walletPublicKey, network } = useStore()
  const [xdr, setXdr] = useState('')
  const [signedXdr, setSignedXdr] = useState(null)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

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
      const networkName = network === 'mainnet' ? 'PUBLIC' : 'TESTNET'

      if (walletType === 'freighter') {
        result = await signTransactionWithFreighter(xdr.trim(), networkName)
      } else if (walletType === 'ledger') {
        setError('Ledger signing requires the device to be connected. Use the Builder tab to build and sign transactions.')
        setSigning(false)
        return
      } else {
        setError('No wallet connected. Connect a wallet first.')
        setSigning(false)
        return
      }

      setSignedXdr(result)
    } catch (err) {
      setError(err.message)
    } finally {
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
        </div>

        {/* XDR input */}
        <div>
          <label style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
            TRANSACTION XDR
          </label>
          <textarea
            value={xdr}
            onChange={(e) => setXdr(e.target.value)}
            placeholder="Paste the transaction XDR envelope here..."
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
              Signing…
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
