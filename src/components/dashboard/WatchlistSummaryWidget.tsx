import { useAccountWatch } from '../../hooks/useAccountWatch'
import { formatXLM } from '../../lib/stellar'

export default function WatchlistSummaryWidget() {
  const { accounts, insights, changes, lastVisitAt, markAllSeen } = useAccountWatch()
  return (
    <section aria-label="Watchlist summary" style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>Watchlist changes</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
            {lastVisitAt ? `Since ${new Date(lastVisitAt).toLocaleString()}` : 'Changes will appear after the first refresh'}
          </p>
        </div>
        <button type="button" onClick={markAllSeen} disabled={changes.length === 0} style={{ padding: '6px 10px', cursor: changes.length ? 'pointer' : 'not-allowed' }}>
          Mark all seen
        </button>
      </div>
      {accounts.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Pin an account to start your watchlist.</p>
      ) : (
        <>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{insights?.totalAccounts ?? accounts.length} watched entities · {formatXLM(insights?.totalXlm ?? 0)} XLM</p>
          {changes.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No balance changes since the last refresh.</p> : changes.map((change) => (
            <div key={change.accountAddress} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <strong>{change.label || `${change.accountAddress.slice(0, 5)}…${change.accountAddress.slice(-4)}`}</strong>
              {change.balanceDeltas.map((delta) => <div key={`${change.accountAddress}:${delta.assetCode}`} style={{ color: delta.balance >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 12 }}>{delta.assetCode}: {delta.balance >= 0 ? '+' : ''}{formatXLM(delta.balance)}</div>)}
            </div>
          ))}
        </>
      )}
    </section>
  )
}
