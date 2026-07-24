import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../lib/store'
import { useResponsive } from '../../hooks/useResponsive'
import { formatXLMValue, TOOLTIP_STYLE, AXIS_TICK_STYLE, CHART_COLORS } from '../../lib/chartUtils'
import { fetchAccount, formatXLM, getServer } from '../../lib/stellar'
import { sparklinePath, throttle } from '../../utils/chartUtils'
import Card from '../dashboard/Card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Pause, Play, RefreshCw } from 'lucide-react'
import { fetchHistoricalPerformance } from '../../lib/portfolioAnalytics'

const BAR_COLORS = [CHART_COLORS.cyan, CHART_COLORS.amber, CHART_COLORS.green, CHART_COLORS.red, '#8884d8', '#82ca9d']
const POLL_OPTIONS = [
  { value: 0,     label: 'Off' },
  { value: 5000,  label: '5s' },
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '60s' },
]
const HISTORY_LIMIT = 30

export default function BalanceHistoryChart() {
  const { accountData, connectedAddress, network, setAccountData } = useStore()
  const { isMobile } = useResponsive()
  const [pollMs, setPollMs] = useState(15000)
  const [tickAt, setTickAt] = useState(null)
  const [pulse, setPulse] = useState(false)
  // Track per-asset balance over time so we can render a sparkline trend.
  const historyRef = useRef(new Map())
  const [historySnapshot, setHistorySnapshot] = useState(0) // version counter

  const balanceData = useMemo(() => {
    if (!accountData?.balances) return []
    return accountData.balances.map((b) => {
      const code = b.asset_type === 'native' ? 'XLM' : (b.asset_code || b.asset_type)
      return {
        asset: code,
        balance: parseFloat(b.balance) || 0,
        limit: b.limit ? parseFloat(b.limit) : null,
      }
    }).sort((a, b) => b.balance - a.balance)
  }, [accountData])

  // Seed history from Horizon pagination engine on mount/address change
  useEffect(() => {
    if (!connectedAddress || balanceData.length === 0) return

    const seedHistory = async () => {
      try {
        const server = getServer(network)
        const currentMap = {}
        balanceData.forEach(b => { currentMap[b.asset] = b.balance })
        
        // Fetch last 7 days of snapshots to populate trends
        const snapshots = await fetchHistoricalPerformance(server, connectedAddress, currentMap, 7)
        
        const map = historyRef.current
        snapshots.forEach(snap => {
          Object.entries(snap.balances).forEach(([asset, balance]) => {
            const arr = map.get(asset) ?? []
            map.set(asset, [...arr, balance].slice(-HISTORY_LIMIT))
          })
        })
        setHistorySnapshot(n => n + 1)
      } catch (e) { console.warn('History seeding failed', e) }
    }
    seedHistory()
  }, [connectedAddress, network, balanceData])

  // Append the current balance snapshot to per-asset history (capped).
  useEffect(() => {
    if (balanceData.length === 0) return
    const map = historyRef.current
    for (const item of balanceData) {
      const arr = map.get(item.asset) ?? []
      const next = [...arr, item.balance]
      if (next.length > HISTORY_LIMIT) next.shift()
      map.set(item.asset, next)
    }
    setHistorySnapshot((n) => n + 1)
  }, [balanceData])

  // Real-time polling: re-fetch the account on the chosen interval and pulse
  // the indicator on each update. Throttled so rapid clicks don't spam Horizon.
  const refresh = useMemo(
    () =>
      throttle(async () => {
        if (!connectedAddress) return
        try {
          const fresh = await fetchAccount(connectedAddress, network, 'balance-chart')
          setAccountData(fresh)
          setTickAt(Date.now())
          setPulse(true)
          setTimeout(() => setPulse(false), 600)
        } catch {
          // Silent: keep showing the last known balances
        }
      }, 1500),
    [connectedAddress, network, setAccountData],
  )

  useEffect(() => {
    if (!pollMs || !connectedAddress) return undefined
    const id = setInterval(refresh, pollMs)
    return () => clearInterval(id)
  }, [pollMs, refresh, connectedAddress])

  if (!accountData) {
    return (
      <Card title="Balance Overview" subtitle="Connect an account to view">
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          No account connected
        </div>
      </Card>
    )
  }

  if (balanceData.length === 0) {
    return (
      <Card title="Balance Overview" subtitle="Current asset balances">
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          No balances found
        </div>
      </Card>
    )
  }

  return (
    <Card
      title="Balance Overview"
      subtitle="Current asset balances"
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LiveBadge pulse={pulse} active={pollMs > 0} updatedAt={tickAt} />

          <select
            value={pollMs}
            onChange={(e) => setPollMs(Number(e.target.value))}
            title="Auto-refresh interval"
            style={selectStyle}
          >
            {POLL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <button
            onClick={() => setPollMs((p) => (p > 0 ? 0 : 15000))}
            title={pollMs > 0 ? 'Pause auto-refresh' : 'Resume auto-refresh'}
            style={iconBtn}
          >
            {pollMs > 0 ? <Pause size={13} /> : <Play size={13} />}
          </button>

          <button onClick={refresh} title="Refresh now" style={iconBtn}>
            <RefreshCw size={13} />
          </button>
        </div>
      }
    >
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Bar chart */}
        <div style={{ height: Math.max(isMobile ? 180 : 220, balanceData.length * (isMobile ? 36 : 40)) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={balanceData} layout="vertical" margin={{ left: isMobile ? 0 : 10, right: isMobile ? 18 : 30, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK_STYLE} tickFormatter={(v) => v.toLocaleString()} />
              <YAxis
                type="category" dataKey="asset" tick={AXIS_TICK_STYLE}
                width={isMobile ? 60 : 80}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [formatXLMValue(value, 4), 'Balance']}
              />
              <Bar dataKey="balance" name="Balance" radius={[0, 4, 4, 0]} barSize={isMobile ? 14 : 18}>
                {balanceData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary cards with live trend sparkline */}
        <div style={{ display: 'grid', gap: isMobile ? '12px' : '0' }}>
          {!isMobile && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 90px 1fr',
              padding: '8px 12px', fontSize: '10px', color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '1px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span>Asset</span>
              <span style={{ textAlign: 'right' }}>Balance</span>
              <span style={{ textAlign: 'center' }}>Trend</span>
              <span style={{ textAlign: 'right' }}>Trust Limit</span>
            </div>
          )}

          {balanceData.map((item, i) => {
            const series = historyRef.current.get(item.asset) || []
            const color = BAR_COLORS[i % BAR_COLORS.length]
            const delta = series.length > 1 ? series[series.length - 1] - series[0] : 0
            return isMobile ? (
              <div
                key={item.asset + i}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '14px',
                  display: 'grid',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                  <span style={{ color, fontWeight: 700 }}>{item.asset}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {item.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <span>Trend</span>
                  <Sparkline values={series} color={delta >= 0 ? CHART_COLORS.green : CHART_COLORS.red} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <span>Trust Limit</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{item.limit !== null ? formatXLM(item.limit) : '∞'}</span>
                </div>
              </div>
            ) : (
              <div
                key={item.asset + i}
                data-history-snapshot={historySnapshot}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 90px 1fr',
                  padding: '10px 12px', fontSize: '12px',
                  borderBottom: i < balanceData.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'var(--transition)',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color, fontWeight: 600 }}>{item.asset}</span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {item.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
                <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Sparkline values={series} color={delta >= 0 ? CHART_COLORS.green : CHART_COLORS.red} />
                </span>
                <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {item.limit !== null ? formatXLM(item.limit) : '∞'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function Sparkline({ values, color }) {
  const { d, width, height } = sparklinePath(values, { width: 80, height: 18 })
  if (!d) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
  }
  return (
    <svg width={width} height={height} aria-label="balance trend" role="img">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  )
}

function LiveBadge({ pulse, active, updatedAt }) {
  return (
    <div
      title={updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : 'Awaiting first update'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: active ? 'rgba(0, 230, 118, 0.08)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? CHART_COLORS.green : 'var(--border)'}`,
        borderRadius: 999,
        fontSize: 10,
        color: active ? CHART_COLORS.green : 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: active ? CHART_COLORS.green : 'var(--text-muted)',
          boxShadow: pulse ? `0 0 0 4px ${CHART_COLORS.green}33` : 'none',
          transition: 'box-shadow 600ms ease-out',
        }}
      />
      {active ? 'Live' : 'Paused'}
    </div>
  )
}

const iconBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}

const selectStyle = {
  height: 26,
  padding: '0 6px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
}
