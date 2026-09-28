import React, { useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { useStore } from '../../lib/store'
import type { LedgerStatsEntry } from '../../lib/store'
import { connectLedgerStream } from '../../lib/streaming'
import { format } from 'date-fns'

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  connected:    { color: 'var(--green)',      label: 'Live' },
  connecting:   { color: 'var(--amber)',      label: 'Connecting' },
  reconnecting: { color: 'var(--amber)',      label: 'Reconnecting' },
  error:        { color: 'var(--red)',        label: 'Error' },
  disconnected: { color: 'var(--text-muted)', label: 'Disconnected' },
}

export default function LedgerStatsWidget() {
  const {
    network,
    streamStatus, setStreamStatus, setStreamError,
    ledgerHistory, baseFeeHistory, failedTxPercent, addLedgerStatsEntry,
  } = useStore()

  useEffect(() => {
    const cleanup = connectLedgerStream(
      network,
      (raw: Record<string, unknown>) => {
        const entry: LedgerStatsEntry = {
          sequence:        Number(raw.sequence)          || 0,
          closedAt:        String(raw.closed_at          ?? ''),
          baseFee:         Number(raw.base_fee_in_stroops ?? raw.base_fee ?? 100),
          operationCount:  Number(raw.operation_count)   || 0,
          txSuccessCount:  Number(raw.successful_transaction_count) || 0,
          txFailedCount:   Number(raw.failed_transaction_count)     || 0,
        }
        addLedgerStatsEntry(entry)
        setStreamError(null)
      },
      (status: string) => {
        setStreamStatus(status)
        if (status === 'error') setStreamError('Connection lost – reconnecting…')
        else if (status === 'connected') setStreamError(null)
      },
    )
    return cleanup
  }, [network])

  const latest = ledgerHistory[0]
  const { color, label } = STATUS_CONFIG[streamStatus] ?? STATUS_CONFIG.disconnected
  const isLive = streamStatus === 'connected'
  const chartData = [...baseFeeHistory].reverse().map((fee, i) => ({ i, fee }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700 }}>
          Ledger Statistics
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '3px 9px', borderRadius: '20px',
          background: `${color}1a`, border: `1px solid ${color}33`,
          fontSize: '11px', fontWeight: 600, color, textTransform: 'uppercase' as const, letterSpacing: '1px',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%', background: color,
            boxShadow: isLive ? `0 0 8px ${color}` : 'none',
          }} className={isLive ? 'pulse' : ''} />
          {label}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {[
          { label: 'Latest Ledger',  value: latest?.sequence?.toLocaleString() ?? '—',     color: 'var(--cyan)' },
          { label: 'Operations',     value: latest?.operationCount?.toLocaleString() ?? '—', color: 'var(--amber)' },
          { label: 'Failed Tx %',    value: latest ? `${failedTxPercent}%` : '—',            color: failedTxPercent > 5 ? 'var(--red)' : 'var(--green)' },
          { label: 'Close Time',     value: latest?.closedAt ? format(new Date(latest.closedAt), 'HH:mm:ss') : '—', color: 'var(--text-primary)' },
        ].map(({ label: l, value, color: c }) => (
          <div key={l} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '12px 14px',
          }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: '6px' }}>
              {l}
            </div>
            <div style={{ fontSize: '18px', fontFamily: 'var(--font-mono)', color: c, fontWeight: 700 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Base fee sparkline */}
      {chartData.length > 1 && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '12px 14px',
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: '8px' }}>
            Base Fee Trend (stroops)
          </div>
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="fee" stroke="var(--cyan)" dot={false} strokeWidth={2} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: '11px' }}
                formatter={(v: number) => [`${v} stroops`, 'Base fee']}
                labelFormatter={() => ''}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Loading state */}
      {ledgerHistory.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
          {streamStatus === 'connecting' || streamStatus === 'reconnecting'
            ? <><div className="spinner" style={{ margin: '0 auto 8px' }} />Connecting to Horizon…</>
            : 'No data yet'}
        </div>
      )}
    </div>
  )
}
