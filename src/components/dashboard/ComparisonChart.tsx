import React, { useMemo, type ReactNode } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts'
import type { TooltipProps } from 'recharts'
import type { ComparisonSlot } from '../../lib/store'
import type { Horizon } from '@stellar/stellar-sdk'
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_TICK_STYLE, formatCompactNumber } from '../../lib/chartUtils'
import { formatXLM, shortAddress } from '../../lib/stellar'

interface ComparisonChartProps {
  comparisonSlots: ComparisonSlot[]
}

interface BalanceDatum {
  name: string
  [key: string]: number | string
}

interface ActivityDatum {
  name: string
  [key: string]: number | string
}

interface RadarDatum {
  metric: string
  [key: string]: number | string
}

const SLOT_COLORS = [
  CHART_COLORS.cyan,
  CHART_COLORS.amber,
  CHART_COLORS.green,
  CHART_COLORS.red,
  '#b388ff'
]

export default function ComparisonChart({ comparisonSlots }: ComparisonChartProps) {
  const activeSlots = comparisonSlots.filter(s => s.data && !s.error && s.key)

  const balanceData: BalanceDatum[] = useMemo(() => {
    if (activeSlots.length === 0) return []
    const entry: BalanceDatum = { name: 'XLM Balance' }
    activeSlots.forEach((slot, i) => {
      const balStr = (slot.data as Horizon.AccountResponse).balances.find(b => b.asset_type === 'native')?.balance || '0'
      entry[`slot_${i}`] = parseFloat(balStr)
    })
    return [entry]
  }, [activeSlots])

  const activityData: ActivityDatum[] = useMemo(() => {
    if (activeSlots.length === 0) return []
    const assetsEntry: ActivityDatum = { name: 'Assets' }
    const subentriesEntry: ActivityDatum = { name: 'Subentries' }
    
    activeSlots.forEach((slot, i) => {
      const otherAssets = (slot.data as Horizon.AccountResponse).balances.filter(b => b.asset_type !== 'native')
      assetsEntry[`slot_${i}`] = otherAssets.length
      subentriesEntry[`slot_${i}`] = (slot.data as Horizon.AccountResponse).subentry_count
    })
    
    return [assetsEntry, subentriesEntry]
  }, [activeSlots])

  const radarData: RadarDatum[] = useMemo(() => {
    if (activeSlots.length < 2) return []

    const getMax = (extractFn: (s: typeof activeSlots[0]) => number) => Math.max(...activeSlots.map(s => extractFn(s)), 1)
    
    const maxBal = getMax(s => parseFloat((s.data as Horizon.AccountResponse).balances.find(b => b.asset_type === 'native')?.balance || '0'))
    const maxAssets = getMax(s => (s.data as Horizon.AccountResponse).balances.filter(b => b.asset_type !== 'native').length)
    const maxSubentries = getMax(s => (s.data as Horizon.AccountResponse).subentry_count)
    const maxSeq = getMax(s => parseFloat((s.data as Horizon.AccountResponse).sequence || '0'))
    const maxSigners = getMax(s => (s.data as Horizon.AccountResponse).signers?.length || 1)

    return [
      { metric: 'Balance', ...Object.fromEntries(activeSlots.map((s, i) => [`slot_${i}`, (parseFloat((s.data as Horizon.AccountResponse).balances.find(b => b.asset_type === 'native')?.balance || '0') / maxBal) * 100])) },
      { metric: 'Assets', ...Object.fromEntries(activeSlots.map((s, i) => [`slot_${i}`, ((s.data as Horizon.AccountResponse).balances.filter(b => b.asset_type !== 'native').length / maxAssets) * 100])) },
      { metric: 'Subentries', ...Object.fromEntries(activeSlots.map((s, i) => [`slot_${i}`, ((s.data as Horizon.AccountResponse).subentry_count / maxSubentries) * 100])) },
      { metric: 'Signers', ...Object.fromEntries(activeSlots.map((s, i) => [`slot_${i}`, (((s.data as Horizon.AccountResponse).signers?.length || 1) / maxSigners) * 100])) },
    ]
  }, [activeSlots])

  if (activeSlots.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
        Add at least one account to view charts
      </div>
    )
  }

  const CustomBalanceTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div style={TOOLTIP_STYLE} className="p-3">
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px' }}>XLM BALANCE</div>
          {payload.map((entry, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '4px' }}>
              <span style={{ color: entry.color, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                {shortAddress(activeSlots[idx].key, 4)}:
              </span>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{formatXLM(entry.value?.toString() || '0')} XLM</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const CustomRadarTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div style={TOOLTIP_STYLE} className="p-3">
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase' }}>{label} Strength</div>
          {payload.map((entry, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '4px' }}>
              <span style={{ color: entry.color, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                {shortAddress(activeSlots[idx].key, 4)}:
              </span>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{Math.round(entry.value || 0)}%</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', animation: 'var(--fade-in)' }}>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '20px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>
          Balance Comparison
        </div>
        <div style={{ height: '220px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={balanceData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK_STYLE} tickFormatter={formatCompactNumber} axisLine={false} tickLine={false} />
              <RechartsTooltip content={<CustomBalanceTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
                formatter={(_value: string, _entry: unknown, index: number) => <span style={{ fontFamily: 'var(--font-mono)' }}>{shortAddress(activeSlots[index]?.key || '', 4)}</span>} />
              {activeSlots.map((slot, i) => (
                <Bar key={slot.key} dataKey={`slot_${i}`} name={`slot_${i}`} fill={SLOT_COLORS[i % SLOT_COLORS.length]} radius={[4, 4, 0, 0] as [number, number, number, number]} maxBarSize={40} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '20px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>
          Relative Strength (Normalized)
        </div>
        <div style={{ height: '220px' }}>
          {activeSlots.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text-secondary)', fontSize: 11 } as React.CSSProperties} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <RechartsTooltip content={<CustomRadarTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' } as React.CSSProperties}
                  formatter={(_value: string, _entry: unknown, index: number) => <span style={{ fontFamily: 'var(--font-mono)' }}>{shortAddress(activeSlots[index]?.key || '', 4)}</span>} />
                {activeSlots.map((slot, i) => (
                  <Radar key={slot.key} name={`slot_${i}`} dataKey={`slot_${i}`} stroke={SLOT_COLORS[i % SLOT_COLORS.length]} fill={SLOT_COLORS[i % SLOT_COLORS.length]} fillOpacity={0.3} />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          ) : (
             <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
               Add at least 2 accounts to see radar chart
             </div>
          )}
        </div>
      </div>

      <div style={{ gridColumn: '1 / -1', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '20px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '16px' }}>
          Activity & Assets
        </div>
        <div style={{ height: '220px' }}>
          <ResponsiveContainer width="100%" height="100%">
             <BarChart data={activityData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
              <RechartsTooltip contentStyle={TOOLTIP_STYLE as React.CSSProperties} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' } as React.CSSProperties}
                formatter={(_value: string, _entry: unknown, index: number) => <span style={{ fontFamily: 'var(--font-mono)' }}>{shortAddress(activeSlots[index]?.key || '', 4)}</span>} />
              {activeSlots.map((slot, i) => (
                <Bar key={slot.key} dataKey={`slot_${i}`} fill={SLOT_COLORS[i % SLOT_COLORS.length]} radius={[4, 4, 0, 0] as [number, number, number, number]} maxBarSize={40} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
