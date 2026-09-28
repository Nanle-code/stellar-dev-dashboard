import React, { useState, useEffect } from 'react'
import Card from './Card'
import { useStore } from '../../lib/store'
import { useAccountStream } from '../../hooks/useAccountStream'

const CHANNELS = [
  { id: 'effects', label: 'Effects' },
  { id: 'payments', label: 'Payments' },
  { id: 'operations', label: 'Operations' },
  { id: 'transactions', label: 'Transactions' },
]

const STATUS_COLORS: Record<string, string> = {
  idle: 'var(--text-muted)',
  connecting: 'var(--cyan, #06b6d4)',
  connected: 'var(--success, #22c55e)',
  reconnecting: 'var(--warning, #f59e0b)',
  error: 'var(--error, #ef4444)',
  disconnected: 'var(--text-muted)',
}

const STALE_STREAM_THRESHOLD_MS = 10_000

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

function describeEvent(event: { channel: string; record?: Record<string, unknown> }): string {
  const r = event.record ?? {}
  if (event.channel === 'payments') {
    const amount = (r.amount as string) ?? '?'
    const asset = (r.asset_code as string) ?? 'XLM'
    return `${amount} ${asset}: ${truncate(r.from as string)} → ${truncate(r.to as string)}`
  }
  if (event.channel === 'effects') {
    return `${r.type ?? 'effect'} ${r.amount ? `(${r.amount} ${r.asset_code ?? 'XLM'})` : ''}`
  }
  if (event.channel === 'operations') {
    return `${r.type ?? 'operation'} #${((r.id ?? '').toString()).slice(0, 12)}`
  }
  if (event.channel === 'transactions') {
    const ops = r.operation_count ?? '?'
    return `${ops} ops, fee ${r.fee_charged ?? '?'} stroops`
  }
  return JSON.stringify(r).slice(0, 80)
}

function truncate(s: unknown): string {
  if (!s || typeof s !== 'string') return '—'
  if (s.length <= 12) return s
  return `${s.slice(0, 5)}…${s.slice(-4)}`
}

export default function LiveActivityFeed() {
  const { connectedAddress, network } = useStore()
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['effects', 'payments'])
  const [isStale, setIsStale] = useState(false)

  const { events, status, lastEventAt, errored } = useAccountStream(
    connectedAddress,
    network,
    {
      channels: selectedChannels,
      bufferSize: 100,
      emitNotifications: true,
    },
  )

  useEffect(() => {
    if (status !== 'connected' || !lastEventAt) {
      setIsStale(false)
      return
    }

    const checkStale = setTimeout(() => {
      const timeSinceLastEvent = Date.now() - lastEventAt
      if (timeSinceLastEvent > STALE_STREAM_THRESHOLD_MS) {
        setIsStale(true)
      }
    }, STALE_STREAM_THRESHOLD_MS)

    return () => clearTimeout(checkStale)
  }, [status, lastEventAt])

  useEffect(() => {
    setIsStale(false)
  }, [connectedAddress, network])

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev
        return prev.filter((c) => c !== id)
      }
      return [...prev, id]
    })
  }

  return (
    <Card
      title="Live activity"
      subtitle={
        connectedAddress
          ? `Streaming for ${truncate(connectedAddress)} on ${network}`
          : 'Connect an account to start streaming'
      }
      action={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              border: `1px solid ${STATUS_COLORS[status]}`,
              color: STATUS_COLORS[status],
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: STATUS_COLORS[status],
                animation: status === 'connected' && !isStale ? 'pulse 1.6s infinite' : 'none',
              }}
            />
            {status}
            {isStale && status === 'connected' && ' (stale)'}
          </span>
          {lastEventAt && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              last event {formatTime(lastEventAt)}
            </span>
          )}
        </div>
      }
    >
      <div
        style={{
          display: 'flex',
          gap: '6px',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        {CHANNELS.map((ch) => {
          const active = selectedChannels.includes(ch.id)
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => toggleChannel(ch.id)}
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                border: `1px solid ${active ? 'var(--cyan, #06b6d4)' : 'var(--border)'}`,
                background: active ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                color: active ? 'var(--cyan, #06b6d4)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {ch.label}
            </button>
          )
        })}
      </div>

      {errored && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.08)',
            color: 'var(--error, #ef4444)',
            fontSize: '12px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          Stream stopped after multiple failures. Switch network or reconnect to retry.
        </div>
      )}

      {isStale && status === 'connected' && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(245, 158, 11, 0.08)',
            color: 'var(--warning, #f59e0b)',
            fontSize: '12px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          ⚠️ Stream connected but no updates for {(STALE_STREAM_THRESHOLD_MS / 1000).toFixed(0)}s.
          Check your account activity or network connection.
        </div>
      )}

      <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
        {!connectedAddress ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}
          >
            Connect an account to stream activity in real time.
          </div>
        ) : events.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}
          >
            Waiting for new {selectedChannels.join(', ')} events…
          </div>
        ) : (
          events.map((event: { pagingToken: string; receivedAt: number; channel: string; record?: Record<string, unknown> }, idx: number) => (
            <div
              key={`${event.pagingToken}-${idx}`}
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                fontSize: '12px',
                display: 'grid',
                gridTemplateColumns: '90px 100px 1fr',
                gap: '12px',
                alignItems: 'baseline',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                }}
              >
                {formatTime(event.receivedAt)}
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color: 'var(--cyan, #06b6d4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontSize: '10px',
                }}
              >
                {event.channel}
              </span>
              <span style={{ wordBreak: 'break-word' }}>{describeEvent(event)}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
