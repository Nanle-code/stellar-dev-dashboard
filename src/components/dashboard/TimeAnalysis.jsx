import React, { useMemo } from 'react'
import { useStore } from '../../lib/store'
import { shortAddress } from '../../lib/stellar'
import { useAddressLabels } from '../../hooks/useAddressLabels'
import { TOOLTIP_STYLE, AXIS_TICK_STYLE } from '../../lib/chartUtils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Cell,
} from 'recharts'
import { format, getHours, getDay, parseISO } from 'date-fns'

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`)
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CHART_HEIGHT = 200

const COLORS = {
  cyan: '#00e5ff',
  amber: '#ffb300',
  purple: '#8b5cf6',
  green: '#00e676',
  red: '#ff1744',
  indigo: '#6366f1',
  teal: '#14b8a6',
}

function opsTimeRanges(operations) {
  const hours = new Array(24).fill(0)
  const days = new Array(7).fill(0)
  const weeks = {}
  const dailyVolumes = {}
  const typeCounts = {}
  const heatmap = {}
  let totalXlm = 0
  let firstDate = null
  let lastDate = null

  for (const op of operations) {
    if (!op.created_at) continue
    const d = typeof op.created_at === 'string' ? parseISO(op.created_at) : new Date(op.created_at)
    const h = getHours(d)
    const day = getDay(d)
    const dayKey = format(d, 'yyyy-MM-dd')
    const weekLabel = format(d, "yyyy-'W'ww")

    hours[h]++
    days[day]++
    weeks[weekLabel] = (weeks[weekLabel] || 0) + 1

    if (!dailyVolumes[dayKey]) dailyVolumes[dayKey] = { date: dayKey, xlm: 0, tx: 0 }
    dailyVolumes[dayKey].tx++
    if (op.amount) {
      const amt = parseFloat(op.amount)
      if (!isNaN(amt) && amt > 0) {
        dailyVolumes[dayKey].xlm += amt
        totalXlm += amt
      }
    }

    const type = op.type || 'unknown'
    typeCounts[type] = (typeCounts[type] || 0) + 1

    const hmKey = `${day}-${h}`
    heatmap[hmKey] = (heatmap[hmKey] || 0) + 1

    const ts = d.getTime()
    if (!firstDate || ts < firstDate) firstDate = ts
    if (!lastDate || ts > lastDate) lastDate = ts
  }

  return { hours, days, weeks, dailyVolumes, typeCounts, heatmap, totalXlm, firstDate, lastDate }
}

function heatmapColor(count, max) {
  if (max === 0) return '#0f1820'
  const ratio = count / max
  if (ratio > 0.8) return '#00e5ff'
  if (ratio > 0.6) return '#00b8cc'
  if (ratio > 0.4) return '#0d6b7a'
  if (ratio > 0.2) return '#0a3d4a'
  if (ratio > 0.05) return '#081e2e'
  return '#0f1820'
}

const CUSTOM_TOOLTIP = {
  ...TOOLTIP_STYLE,
  background: '#0d1520',
  border: '1px solid #1a2332',
}

export default function TimeAnalysis() {
  const operations = useStore((s) => s.operations)
  const { labelMap } = useAddressLabels()

  const analysis = useMemo(() => opsTimeRanges(operations), [operations])

  const hourlyData = useMemo(() => {
    return HOUR_LABELS.map((label, i) => ({
      hour: label,
      count: analysis.hours[i],
    }))
  }, [analysis.hours])

  const dailyData = useMemo(() => {
    return DAY_LABELS.map((label, i) => ({
      day: label,
      count: analysis.days[i],
    }))
  }, [analysis.days])

  const weeklyData = useMemo(() => {
    return Object.entries(analysis.weeks)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week))
  }, [analysis.weeks])

  const volumeData = useMemo(() => {
    return Object.values(analysis.dailyVolumes)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [analysis.dailyVolumes])

  const opTypeData = useMemo(() => {
    return Object.entries(analysis.typeCounts)
      .map(([type, count]) => ({
        type: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }, [analysis.typeCounts])

  const heatmapData = useMemo(() => {
    const max = Math.max(...Object.values(analysis.heatmap), 1)
    return DAY_LABELS.map((label, dayIdx) => ({
      day: label,
      hours: Array.from({ length: 24 }, (_, h) => {
        const count = analysis.heatmap[`${dayIdx}-${h}`] || 0
        return { hour: h, count, color: heatmapColor(count, max), pct: max > 0 ? count / max : 0 }
      }),
    }))
  }, [analysis.heatmap])

  const timeSpan = useMemo(() => {
    if (!analysis.firstDate || !analysis.lastDate) return 'N/A'
    const days = Math.round((analysis.lastDate - analysis.firstDate) / (1000 * 60 * 60 * 24))
    return `${format(analysis.firstDate, 'MMM d, yyyy')} – ${format(analysis.lastDate, 'MMM d, yyyy')} (${days}d)`
  }, [analysis.firstDate, analysis.lastDate])

  const topAddresses = useMemo(() => {
    const addrCount = {}
    for (const op of operations) {
      for (const field of ['from', 'to', 'source_account', 'account']) {
        if (op[field]) addrCount[op[field]] = (addrCount[op[field]] || 0) + 1
      }
    }
    return Object.entries(addrCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [operations])

  if (!operations || operations.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No operation data available for time analysis.
      </div>
    )
  }

  const totalOps = operations.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: '1px', background: '#1a2332', borderRadius: '8px', overflow: 'hidden',
      }}>
        <SummaryStat label="Total Operations" value={totalOps.toLocaleString()} color={COLORS.cyan} />
        <SummaryStat label="Time Span" value={timeSpan} color={COLORS.indigo} small />
        <SummaryStat label="Volume (XLM)" value={analysis.totalXlm > 0 ? formatXLM(analysis.totalXlm) : '—'} color={COLORS.amber} />
        <SummaryStat label="Op Types" value={Object.keys(analysis.typeCounts).length} color={COLORS.purple} />
        <SummaryStat label="Peak Hour" value={`${hourlyData.reduce((a, b) => a.count > b.count ? a : b).hour}`} color={COLORS.teal} />
      </div>

      {/* Chart grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Hourly Activity */}
        <ChartCard title="Hourly Activity" subtitle="Operations by hour of day">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={hourlyData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2332" />
              <XAxis dataKey="hour" tick={{ ...AXIS_TICK_STYLE, fontSize: 9 }} interval={3} />
              <YAxis tick={AXIS_TICK_STYLE} allowDecimals={false} width={32} />
              <Tooltip contentStyle={CUSTOM_TOOLTIP} formatter={(v) => [v, 'Operations']} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {hourlyData.map((entry, i) => (
                  <Cell key={i} fill={entry.count > 0 ? COLORS.cyan : '#1a2332'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Daily Activity */}
        <ChartCard title="Daily Activity" subtitle="Operations by day of week">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2332" />
              <XAxis dataKey="day" tick={AXIS_TICK_STYLE} />
              <YAxis tick={AXIS_TICK_STYLE} allowDecimals={false} width={32} />
              <Tooltip contentStyle={CUSTOM_TOOLTIP} formatter={(v) => [v, 'Operations']} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {dailyData.map((entry, i) => (
                  <Cell key={i} fill={entry.count > 0 ? COLORS.purple : '#1a2332'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Weekly Activity (full width) */}
      <ChartCard title="Weekly Activity" subtitle="Operations per week">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2332" />
            <XAxis dataKey="week" tick={{ ...AXIS_TICK_STYLE, fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={AXIS_TICK_STYLE} allowDecimals={false} width={32} />
            <Tooltip contentStyle={CUSTOM_TOOLTIP} formatter={(v) => [v, 'Operations']} />
            <Bar dataKey="count" fill={COLORS.indigo} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Volume Trends + Op Frequencies side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <ChartCard title="Volume Trends" subtitle="XLM volume per day">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <AreaChart data={volumeData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2332" />
              <XAxis dataKey="date" tick={{ ...AXIS_TICK_STYLE, fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={AXIS_TICK_STYLE} width={40} tickFormatter={(v) => formatXLM(v)} />
              <Tooltip contentStyle={CUSTOM_TOOLTIP} formatter={(v) => [formatXLM(v), 'XLM']} labelFormatter={(l) => `Date: ${l}`} />
              <Area type="monotone" dataKey="xlm" stroke={COLORS.amber} fill={COLORS.amber} fillOpacity={0.15} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Operation Types" subtitle="Frequency by operation type">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={opTypeData} layout="vertical" margin={{ top: 4, right: 4, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2332" />
              <XAxis type="number" tick={AXIS_TICK_STYLE} allowDecimals={false} />
              <YAxis type="category" dataKey="type" tick={{ ...AXIS_TICK_STYLE, fontSize: 9 }} width={80} />
              <Tooltip contentStyle={CUSTOM_TOOLTIP} formatter={(v) => [v, 'Count']} />
              <Bar dataKey="count" radius={[0, 2, 2, 0]}>
                {opTypeData.map((_, i) => (
                  <Cell key={i} fill={[COLORS.cyan, COLORS.purple, COLORS.amber, COLORS.green, COLORS.red, COLORS.indigo, COLORS.teal][i % 7]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Account Activity Patterns — custom heatmap + top addresses */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <ChartCard title="Activity Heatmap" subtitle="Hour × Day of week">
          <div style={{ padding: '8px', overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '32px repeat(24, 1fr)', gap: '1px', minWidth: '400px' }}>
              <div style={{ fontSize: '8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }} />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} style={{ fontSize: '7px', color: 'var(--text-muted)', textAlign: 'center', paddingBottom: '2px' }}>
                  {h}
                </div>
              ))}
              {heatmapData.map((row) => (
                <React.Fragment key={row.day}>
                  <div style={{ fontSize: '8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', paddingRight: '4px' }}>
                    {row.day}
                  </div>
                  {row.hours.map((cell) => (
                    <div
                      key={cell.hour}
                      title={`${row.day} ${cell.hour}:00 — ${cell.count} ops`}
                      style={{
                        aspectRatio: '1',
                        background: cell.color,
                        borderRadius: '1px',
                        minHeight: '10px',
                        transition: 'var(--transition)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.outline = '1px solid var(--text-secondary)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.outline = 'none' }}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '9px', color: 'var(--text-muted)' }}>
              <span>Low</span>
              {[0.05, 0.2, 0.4, 0.6, 0.8].map((pct) => (
                <span key={pct} style={{ width: '12px', height: '12px', background: heatmapColor(pct, 1), borderRadius: '2px', display: 'inline-block' }} />
              ))}
              <span>High</span>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Top Addresses" subtitle="Most active counterparties">
          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {topAddresses.map(([addr, count], i) => (
              <div key={addr} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 6px', borderRadius: '4px', background: i % 2 === 0 ? '#0d1520' : 'transparent',
                fontSize: '10px',
              }}>
                <span style={{ width: '14px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
                  {i + 1}
                </span>
                <span style={{
                  height: `${Math.max(4, (count / topAddresses[0][1]) * 20)}px`,
                  width: '3px', borderRadius: '2px',
                  background: [COLORS.cyan, COLORS.purple, COLORS.amber, COLORS.green, COLORS.red, COLORS.indigo, COLORS.teal][i % 7],
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {labelMap[addr]?.label || shortAddress(addr)}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {shortAddress(addr)} · {count} ops
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

function SummaryStat({ label, value, color, small }) {
  return (
    <div style={{
      flex: 1, padding: '10px 12px', background: '#0d1520',
      display: 'flex', flexDirection: 'column', gap: '2px',
    }}>
      <div style={{ fontSize: '9px', color: color || 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{
        fontSize: small ? '11px' : '16px',
        fontWeight: 700,
        color: 'var(--text-primary)',
        fontFamily: small ? 'var(--font-mono)' : 'var(--font-display)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div style={{
      background: '#0d1520',
      border: '1px solid #1a2332',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a2332' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>{subtitle}</div>
      </div>
      <div style={{ padding: '4px' }}>
        {children}
      </div>
    </div>
  )
}

function formatXLM(amount) {
  if (amount === 0 || amount === '0') return '0'
  const v = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(v)) return '—'
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
  if (v >= 1) return v.toFixed(1)
  return v.toFixed(4)
}
