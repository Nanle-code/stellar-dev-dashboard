import React, { useMemo } from 'react'
import { useStore } from '../../lib/store'
import { TOOLTIP_STYLE, AXIS_TICK_STYLE, CHART_COLORS } from '../../lib/chartUtils'
import Card from '../dashboard/Card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format } from 'date-fns'

const PIE_COLORS = [CHART_COLORS.cyan, CHART_COLORS.amber, CHART_COLORS.green, CHART_COLORS.red, '#8884d8', '#82ca9d']

export default function AccountActivityChart() {
  const { transactions, operations, txLoading, opsLoading } = useStore()

  // Group transactions by day
  const txByDay = useMemo(() => {
    if (!transactions || transactions.length === 0) return []

    const grouped = {}
    for (const tx of transactions) {
      const day = format(new Date(tx.created_at), 'MMM d')
      if (!grouped[day]) grouped[day] = { day, successful: 0, failed: 0 }
      if (tx.successful) grouped[day].successful++
      else grouped[day].failed++
    }

    return Object.values(grouped).reverse()
  }, [transactions])

  // Group operations by type
  const opsByType = useMemo(() => {
    if (!operations || operations.length === 0) return []

    const grouped = {}
    for (const op of operations) {
      const type = op.type_i !== undefined
        ? op.type
        : 'unknown'
      const label = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      if (!grouped[label]) grouped[label] = { name: label, count: 0 }
      grouped[label].count++
    }

    return Object.values(grouped).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [operations])

  const loading = txLoading || opsLoading

  return (
    <Card title="Account Activity" subtitle="Transaction & operation breakdown">
      {loading ? (
        <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : transactions.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          No transaction data available
        </div>
      ) : (
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Transactions by day */}
          {txByDay.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '10px', textTransform: 'uppercase' }}>
                Transactions by Day
              </div>
              <div style={{ height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={txByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={AXIS_TICK_STYLE} />
                    <YAxis tick={AXIS_TICK_STYLE} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="successful" name="Successful" fill={CHART_COLORS.green} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="failed" name="Failed" fill={CHART_COLORS.red} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Operation types pie chart */}
          {opsByType.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.8px', marginBottom: '10px', textTransform: 'uppercase' }}>
                Operation Types
              </div>
              <div style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={opsByType}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: 'var(--text-muted)' }}
                    >
                      {opsByType.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
