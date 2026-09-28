import React, { useEffect, useState, useCallback } from 'react'
import { buildComparativeHealthReport, type ComparativeHealthReport } from '../../lib/networkHealthScorecard'
import { fetchNetworkStats } from '../../lib/stellar'
import { Activity, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react'

interface NetworkHealthScorecardProps {
  /** Injected for tests; defaults to fetching live stats via the dashboard lib. */
  fetchHealth?: (_network: 'mainnet' | 'testnet') => Promise<any>
  /** Injected for tests; builds the comparative report from snapshots. */
  buildReport?: typeof buildComparativeHealthReport
}

const GRADE_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  degraded: '#f59e0b',
  critical: '#ef4444',
  unavailable: '#64748b',
}

function toHealthInput(network: 'mainnet' | 'testnet', stats: any) {
  return {
    network,
    latestLedgerSequence: stats?.latestLedger?.sequence ?? null,
    latestLedgerClosedAt: stats?.latestLedger?.closed_at ?? null,
    baseFeeStroops: stats?.feeStats?.last_ledger_base_fee ?? null,
    operationCount: stats?.latestLedger?.operation_count ?? null,
    successfulTransactionCount: stats?.latestLedger?.successful_transaction_count ?? null,
    failedTransactionCount: stats?.latestLedger?.failed_transaction_count ?? null,
  }
}

const cardStyle: React.CSSProperties = {
  borderTop: '1px solid #1a2332',
  paddingTop: '10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const gradeBadgeStyle = (color: string): React.CSSProperties => ({
  fontSize: '9px',
  fontFamily: 'var(--font-mono)',
  color,
  background: `${color}1a`,
  border: `1px solid ${color}55`,
  padding: '1px 6px',
  borderRadius: '8px',
  fontWeight: 700,
  textTransform: 'uppercase',
})

export default function NetworkHealthScorecard({ fetchHealth, buildReport }: NetworkHealthScorecardProps) {
  const [report, setReport] = useState<ComparativeHealthReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const reportFn = buildReport ?? buildComparativeHealthReport
      const fetched = fetchHealth ?? (async (network: 'mainnet' | 'testnet') => toHealthInput(network, await fetchNetworkStats(network)))
      const next = await reportFn(fetched, ['mainnet', 'testnet'])
      setReport(next)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [fetchHealth, buildReport])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div data-testid="network-health-scorecard" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={11} /> Network Health Scorecard
        </span>
        <button
          onClick={load}
          disabled={loading}
          title="Refresh comparative health scorecard"
          style={{
            border: '1px solid #253040', borderRadius: '4px', background: '#1a2332',
            color: 'var(--text-muted)', cursor: loading ? 'not-allowed' : 'pointer',
            padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px',
          }}
        >
          <RefreshCw size={10} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {loadError && (
        <div data-testid="scorecard-error" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#ef4444' }}>
          <AlertTriangle size={11} /> Scorecard failed to load: {loadError}
        </div>
      )}

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Side-by-side scores */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[report.mainnet, report.testnet].map((entry) => {
              const color = GRADE_COLORS[entry.ok && entry.score ? entry.score.grade : 'unavailable']
              return (
                <div
                  key={entry.network}
                  data-testid={`scorecard-${entry.network}`}
                  style={{
                    background: '#0d1520', border: `1px solid ${color}44`, borderRadius: '6px', padding: '8px',
                    display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '64px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {entry.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                    </span>
                    {entry.ok && entry.score ? (
                      <span style={gradeBadgeStyle(color)}>{entry.score.grade}</span>
                    ) : (
                      <span style={gradeBadgeStyle(color)}>N/A</span>
                    )}
                  </div>
                  {entry.ok && entry.score ? (
                    <>
                      <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>
                        {entry.score.score}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/100</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {entry.score.indicators.map((ind) => (
                          <span
                            key={ind.key}
                            title={`${ind.label}: ${ind.value}`}
                            style={{ fontSize: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                          >
                            {ind.label.split(' ')[0]} {ind.subScore}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div data-testid={`scorecard-${entry.network}-error`} style={{ fontSize: '9px', color: '#ef4444', lineHeight: 1.4 }}>
                      {entry.error || 'Unavailable'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Leader + insights */}
          {report.insights.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', fontSize: '9px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <Activity size={10} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{report.insights.join(' ')}</span>
            </div>
          )}

          {/* Caveats */}
          {report.caveats.length > 0 && (
            <div data-testid="scorecard-caveats" style={{ fontSize: '8px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {report.caveats.map((caveat, i) => (
                <div key={i}>• {caveat}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && !report && (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '4px 0' }}>Loading scorecard…</div>
      )}
    </div>
  )
}
