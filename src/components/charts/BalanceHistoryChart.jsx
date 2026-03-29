import React, { useMemo } from 'react'
import { useStore } from '../../lib/store'
import { formatXLMValue, TOOLTIP_STYLE, AXIS_TICK_STYLE, CHART_COLORS } from '../../lib/chartUtils'
import { formatXLM } from '../../lib/stellar'
import Card from '../dashboard/Card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

export default function BalanceHistoryChart() {
  const { accountData } = useStore()

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

  const barColors = [CHART_COLORS.cyan, CHART_COLORS.amber, CHART_COLORS.green, CHART_COLORS.red, '#8884d8', '#82ca9d']

  return (
    <Card title="Balance Overview" subtitle="Current asset balances">
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Bar chart */}
        <div style={{ height: Math.max(200, balanceData.length * 40) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={balanceData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK_STYLE} tickFormatter={(v) => v.toLocaleString()} />
              <YAxis
                type="category" dataKey="asset" tick={AXIS_TICK_STYLE}
                width={60}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [formatXLMValue(value, 4), 'Balance']}
              />
              <Bar dataKey="balance" name="Balance" radius={[0, 4, 4, 0]}>
                {balanceData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary table */}
        <div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            padding: '8px 12px', fontSize: '10px', color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '1px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Asset</span>
            <span style={{ textAlign: 'right' }}>Balance</span>
            <span style={{ textAlign: 'right' }}>Trust Limit</span>
          </div>
          {balanceData.map((item, i) => (
            <div
              key={item.asset + i}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                padding: '10px 12px', fontSize: '12px',
                borderBottom: i < balanceData.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: barColors[i % barColors.length], fontWeight: 600 }}>
                {item.asset}
              </span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {item.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {item.limit !== null ? formatXLM(item.limit) : '∞'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
