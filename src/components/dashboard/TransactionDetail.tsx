import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useStore } from '../../lib/store'
import { fetchTransactionDetails } from '../../lib/stellar'
import Card from './Card'

interface TransactionDetailProps {
  txHash: string
  onClose: () => void
}

type TransactionDetails = Awaited<ReturnType<typeof fetchTransactionDetails>>

interface OperationSummary {
  id: string
  type: string
  source_account?: string
  from?: string
  to?: string
  destination?: string
  amount?: string
  asset_code?: string
  asset_type?: string
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 0.3fr) 1fr', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <dt style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{label}</dt>
      <dd style={{ margin: 0, color: 'var(--text-primary)', fontSize: '12px', fontFamily: mono ? 'var(--font-mono)' : undefined, overflowWrap: 'anywhere' }}>{value || '—'}</dd>
    </div>
  )
}

export default function TransactionDetail({ txHash, onClose }: TransactionDetailProps) {
  const network = useStore((state) => state.network)
  const [details, setDetails] = useState<TransactionDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setDetails(null)
    fetchTransactionDetails(txHash, network)
      .then((result) => { if (active) setDetails(result) })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [txHash, network])

  const transaction = details?.transaction
  const explorerUrl = network === 'mainnet'
    ? `https://stellar.expert/explorer/public/tx/${encodeURIComponent(txHash)}`
    : `https://stellar.expert/explorer/${network}/tx/${encodeURIComponent(txHash)}`

  return (
    <Card
      title="Transaction Details"
      subtitle={`${network} · ${txHash}`}
      action={(
        <div style={{ display: 'flex', gap: '6px' }}>
          <a href={explorerUrl} target="_blank" rel="noreferrer" aria-label="Open transaction in Stellar Expert" title="Open in Stellar Expert" style={{ color: 'var(--text-secondary)', padding: '6px' }}>
            <ExternalLink size={16} aria-hidden="true" />
          </a>
          <button type="button" onClick={onClose} aria-label="Back to transactions" title="Back to transactions" style={{ background: 'transparent', border: 0, color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px' }}>
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    >
      <div style={{ padding: '16px 18px' }}>
        {loading && <div role="status" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading transaction…</div>}
        {error && <div role="alert" style={{ color: 'var(--red)', fontSize: '13px' }}>{error}</div>}
        {transaction && (
          <>
            <dl style={{ margin: 0 }}>
              <DetailRow label="Hash" value={transaction.hash} mono />
              <DetailRow label="Status" value={transaction.successful ? 'Successful' : 'Failed'} />
              <DetailRow label="Ledger" value={String(transaction.ledger)} />
              <DetailRow label="Created" value={new Date(transaction.created_at).toLocaleString()} />
              <DetailRow label="Source account" value={transaction.source_account} mono />
              <DetailRow label="Fee charged" value={`${transaction.fee_charged} stroops`} />
              <DetailRow label="Memo" value={transaction.memo ?? ''} />
              <DetailRow label="Operations" value={String(transaction.operation_count)} />
            </dl>
            <h2 style={{ margin: '20px 0 8px', fontSize: '13px', color: 'var(--text-primary)' }}>Operations</h2>
            {details.operations.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No operations found.</div>
            ) : (
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' }}>
                {details.operations.map((record) => {
                  const operation = record as unknown as OperationSummary
                  return (
                    <li key={operation.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{operation.type.replaceAll('_', ' ')}</div>
                      <div style={{ marginTop: '5px', display: 'grid', gap: '3px', color: 'var(--text-muted)', fontSize: '11px', overflowWrap: 'anywhere' }}>
                        {(operation.source_account || operation.from) && <span>From: {operation.source_account || operation.from}</span>}
                        {(operation.destination || operation.to) && <span>To: {operation.destination || operation.to}</span>}
                        {operation.amount && <span>Amount: {operation.amount} {operation.asset_code || (operation.asset_type === 'native' ? 'XLM' : '')}</span>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </Card>
  )
}