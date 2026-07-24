import React, { useEffect } from 'react'
import { useStore } from '../../lib/store'
import type { StreamLedger } from '../../lib/store'
import { connectLedgerStream } from '../../lib/streaming'
import { format } from 'date-fns'

interface LedgerDisplayEntry {
  id?: string
  sequence: number
  successful_transaction_count: number
  failed_transaction_count: number
  operation_count: number
  closed_at: string
  [key: string]: unknown
}

interface StatusConfigEntry {
  color: string
  label: string
}

const STATUS_CONFIG: Record<string, StatusConfigEntry> = {
  connected:     { color: 'var(--green)',  label: 'Live' },
  connecting:    { color: 'var(--amber)',  label: 'Connecting' },
  reconnecting:  { color: 'var(--amber)',  label: 'Reconnecting' },
  error:         { color: 'var(--red)',    label: 'Error' },
  disconnected:  { color: 'var(--text-muted)', label: 'Disconnected' },
}

export default function RealTimeLedger() {
  const {
    network,
    streamStatus, setStreamStatus,
    streamLedgers, addStreamLedger, clearStreamLedgers,
    setStreamError,
  } = useStore()

  useEffect(() => {
    clearStreamLedgers()

    const cleanup = connectLedgerStream(
      network,
      (ledger: Record<string, unknown>) => {
        addStreamLedger(ledger)
        setStreamError(null)
      },
      (status: string) => {
        setStreamStatus(status)
        if (status === 'error') {
          setStreamError('Connection lost – reconnecting…')
        } else if (status === 'connected') {
          setStreamError(null)
        }
      },
    )

    return cleanup
  }, [network])

  const { color, label } = STATUS_CONFIG[streamStatus] ?? STATUS_CONFIG.disconnected
  const isLive = streamStatus === 'connected'

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>
          Real-Time Ledgers
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '20px',
          background: `${color}1a`,
          border: `1px solid ${color}33`,
          fontSize: '11px',
          fontWeight: 600,
          color,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: color,
            boxShadow: isLive ? `0 0 8px ${color}` : 'none',
          }} className={isLive ? 'pulse' : ''} />
          {label}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '8px', textTransform: 'uppercase' }}>Latest Ledger</div>
          <div style={{ fontSize: '22px', fontFamily: 'var(--font-mono)', color: 'var(--cyan)', fontWeight: 700 }}>
            {streamLedgers[0]?.sequence?.toLocaleString() ?? '—'}
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '8px', textTransform: 'uppercase' }}>Transactions</div>
          <div style={{ fontSize: '22px', fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 700 }}>
            {streamLedgers[0]?.successful_transaction_count?.toLocaleString() ?? '—'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>in last ledger</div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '8px', textTransform: 'uppercase' }}>Operations</div>
          <div style={{ fontSize: '22px', fontFamily: 'var(--font-mono)', color: 'var(--amber)', fontWeight: 700 }}>
            {streamLedgers[0]?.operation_count?.toLocaleString() ?? '—'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>in last ledger</div>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
            Ledger Feed
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {streamLedgers.length > 0 ? `${streamLedgers.length} ledger${streamLedgers.length !== 1 ? 's' : ''}` : 'Waiting for stream…'}
          </span>
        </div>

        {streamLedgers.length === 0 ? (
          <div style={{ padding: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            {streamStatus === 'connecting' || streamStatus === 'reconnecting' ? (
              <>
                <div className="spinner" />
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {streamStatus === 'reconnecting' ? 'Reconnecting to Horizon…' : 'Connecting to Horizon…'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No ledgers received yet</div>
            )}
          </div>
        ) : (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr 1fr',
              padding: '8px 18px',
              fontSize: '10px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span>Sequence</span>
              <span>Tx (ok)</span>
              <span>Tx (fail)</span>
              <span>Ops</span>
              <span>Closed At</span>
            </div>

            {streamLedgers.map((raw, i) => {
              const l = raw as LedgerDisplayEntry
              return (
              <div
                key={l.id ?? l.sequence}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr 1fr',
                  padding: '10px 18px',
                  fontSize: '12px',
                  borderBottom: i < streamLedgers.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'var(--transition)',
                  background: i === 0 ? 'var(--cyan-glow)' : 'transparent',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { if (i !== 0) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { if (i !== 0) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontWeight: i === 0 ? 700 : 400 }}>
                  {l.sequence?.toLocaleString()}
                </span>
                <span style={{ color: 'var(--green)' }}>
                  {l.successful_transaction_count ?? '—'}
                </span>
                <span style={{ color: l.failed_transaction_count > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                  {l.failed_transaction_count ?? '—'}
                </span>
                <span style={{ color: 'var(--amber)' }}>
                  {l.operation_count ?? '—'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {l.closed_at ? format(new Date(l.closed_at), 'HH:mm:ss') : '—'}
                </span>
              </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
