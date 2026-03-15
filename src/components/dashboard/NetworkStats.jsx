import React, { useEffect, useState } from 'react'
import { useStore } from '../../lib/store'
import { fetchNetworkStats, getServer } from '../../lib/stellar'
import { format } from 'date-fns'
import { StatCard } from './Card'

export default function Network() {
  const { network, networkStats, setNetworkStats, statsLoading, setStatsLoading } = useStore()
  const [recentLedgers, setRecentLedgers] = useState([])
  const [ledgersLoading, setLedgersLoading] = useState(false)

  useEffect(() => {
    setStatsLoading(true)
    setLedgersLoading(true)

    fetchNetworkStats(network)
      .then(s => setNetworkStats(s))
      .catch(() => {})
      .finally(() => setStatsLoading(false))

    getServer(network).ledgers().order('desc').limit(10).call()
      .then(r => setRecentLedgers(r.records))
      .catch(() => {})
      .finally(() => setLedgersLoading(false))
  }, [network])

  const ledger = networkStats?.latestLedger
  const fee = networkStats?.feeStats

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Network</div>

      {/* Key stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <StatCard label="Latest Ledger" value={ledger?.sequence?.toLocaleString()} loading={statsLoading} accent="var(--cyan)" />
        <StatCard label="Base Fee" value={fee ? fee.last_ledger_base_fee + ' stroops' : '—'} loading={statsLoading} />
        <StatCard
          label="Closed At"
          value={ledger ? format(new Date(ledger.closed_at), 'HH:mm:ss') : '—'}
          sub={ledger ? format(new Date(ledger.closed_at), 'MMM d, yyyy') : ''}
          loading={statsLoading}
        />
        <StatCard label="Tx Count" value={ledger?.successful_transaction_count?.toLocaleString()} sub="successful in last ledger" loading={statsLoading} accent="var(--green)" />
        <StatCard label="Failed Tx" value={ledger?.failed_transaction_count?.toLocaleString()} sub="failed in last ledger" loading={statsLoading} accent="var(--red)" />
        <StatCard label="Op Count" value={ledger?.operation_count?.toLocaleString()} sub="in last ledger" loading={statsLoading} accent="var(--amber)" />
      </div>

      {/* Fee Stats */}
      {fee && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Fee Statistics</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', background: 'var(--border)' }}>
            {[
              ['Min Fee', fee.min_accepted_fee],
              ['Mode Fee', fee.mode_accepted_fee],
              ['Median Fee', fee.median_accepted_fee],
              ['Max Fee', fee.max_accepted_fee],
              ['P10', fee.p10_accepted_fee],
              ['P90', fee.p90_accepted_fee],
            ].map(([label, val]) => (
              <div key={label} style={{ background: 'var(--bg-card)', padding: '14px 18px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '6px' }}>{label}</div>
                <div style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {val} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>stroops</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Ledgers */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Recent Ledgers</div>
        {ledgersLoading ? (
          <div style={{ padding: '32px', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '8px 18px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--border)' }}>
              <span>Sequence</span><span>Tx</span><span>Ops</span><span>Closed</span>
            </div>
            {recentLedgers.map((l, i) => (
              <div key={l.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                padding: '10px 18px',
                fontSize: '12px',
                borderBottom: i < recentLedgers.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'var(--transition)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>{l.sequence.toLocaleString()}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{l.successful_transaction_count}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{l.operation_count}</span>
                <span style={{ color: 'var(--text-muted)' }}>{format(new Date(l.closed_at), 'HH:mm:ss')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
