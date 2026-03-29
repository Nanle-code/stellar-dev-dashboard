import React, { useEffect, useState, useMemo } from 'react'
import { useStore } from '../../lib/store'
import { getServer } from '../../lib/stellar'
import { formatCompactNumber, TOOLTIP_STYLE, AXIS_TICK_STYLE, CHART_COLORS } from '../../lib/chartUtils'
import Card from '../dashboard/Card'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts'
import { format } from 'date-fns'

export default function NetworkMetricsChart() {
  const { network } = useStore()
  const [ledgerData, setLedgerData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getServer(network).ledgers().order('desc').limit(30).call()
      .then((result) => {
        if (cancelled) return
        const records = result.records.reverse().map((l) => ({
          sequence: l.sequence,
          txCount: l.successful_transaction_count,
          failedTx: l.failed_transaction_count,
          opCount: l.operation_count,
          closedAt: l.closed_at,
          label: format(new Date(l.closed_at), 'HH:mm:ss'),
        }))
        setLedgerData(records)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [network])

  const maxTx = useMemo(() => {
    if (ledgerData.length === 0) return 10
    return Math.max(...ledgerData.map((d) => d.txCount + d.failedTx), 10)
  }, [ledgerData])

  return (
    <Card title="Network Metrics" subtitle="Transactions & operations per ledger">
      {loading ? (
        <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : ledgerData.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          No ledger data available
        </div>
      ) : (
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tx count area chart */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '10px', textTransform: 'uppercase' }}>
              Transactions per Ledger
            </div>
            <div style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ledgerData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={AXIS_TICK_STYLE} interval="preserveStartEnd" />
                  <YAxis tick={AXIS_TICK_STYLE} domain={[0, maxTx]} tickFormatter={formatCompactNumber} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="txCount" name="Successful" fill={CHART_COLORS.green} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="failedTx" name="Failed" fill={CHART_COLORS.red} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Operations area chart */}
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '10px', textTransform: 'uppercase' }}>
              Operations per Ledger
            </div>
            <div style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ledgerData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={AXIS_TICK_STYLE} interval="preserveStartEnd" />
                  <YAxis tick={AXIS_TICK_STYLE} tickFormatter={formatCompactNumber} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area
                    type="monotone" dataKey="opCount" name="Operations"
                    stroke={CHART_COLORS.cyan} fill={CHART_COLORS.cyan}
                    fillOpacity={0.15} strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
