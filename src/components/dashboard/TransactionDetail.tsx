import React, { useEffect, useState } from 'react'
import { useStore } from '../../lib/store'
import { fetchTransactionDetails } from '../../lib/stellar'
import { X, ExternalLink, CheckCircle, XCircle } from 'lucide-react'

export interface TransactionDetailProps {
  txHash: string
  onClose: () => void
}

export default function TransactionDetail({ txHash, onClose }: TransactionDetailProps) {
  const { network } = useStore()
  const [txDetails, setTxDetails] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    fetchTransactionDetails(txHash, network)
      .then((data) => {
        if (isMounted) {
          setTxDetails(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [txHash, network])

  const explorerUrl = network === 'mainnet'
    ? `https://stellar.expert/explorer/public/tx/${txHash}`
    : `https://stellar.expert/explorer/testnet/tx/${txHash}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Transaction details"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        maxWidth: '700px',
        width: '100%',
        margin: '0 auto',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, fontFamily: 'var(--font-display)' }}>
          Transaction Details
        </h2>
        <button
          onClick={onClose}
          aria-label="Close transaction details"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
        >
          <X size={20} />
        </button>
      </div>

      <div style={{ wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--cyan)', marginBottom: '16px' }}>
        {txHash}
      </div>

      {loading && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading transaction data...
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--red)', fontSize: '13px' }}>
          Failed to load transaction details: {error}
        </div>
      )}

      {!loading && !error && txDetails && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Status</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: (txDetails as Record<string, unknown>).successful ? 'var(--green)' : 'var(--red)' }}>
              {(txDetails as Record<string, unknown>).successful ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {(txDetails as Record<string, unknown>).successful ? 'Successful' : 'Failed'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Ledger</span>
            <span>{String((txDetails as Record<string, unknown>).ledger || 'N/A')}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Fee Paid</span>
            <span>{String((txDetails as Record<string, unknown>).fee_charged || 'N/A')} stroops</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Operation Count</span>
            <span>{String((txDetails as Record<string, unknown>).operation_count || 0)}</span>
          </div>

          <div style={{ marginTop: '12px', textAlign: 'right' }}>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--cyan)',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: '12px',
              }}
            >
              View on Stellar.Expert <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
