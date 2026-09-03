import React, { useMemo, useRef, useState } from 'react'
import { useStore } from '../../lib/store'
import { useResponsive } from '../../hooks/useResponsive'
import { TOOLTIP_STYLE, AXIS_TICK_STYLE, CHART_COLORS } from '../../lib/chartUtils'
import {
  exportChartDataAsCsv,
  exportPng,
  exportSvg,
  downloadJson,
  safeFilename,
  buildColorMap,
} from '../../utils/chartUtils'
import Card from '../dashboard/Card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format } from 'date-fns'
import { Download } from 'lucide-react'

const PIE_COLORS = [CHART_COLORS.cyan, CHART_COLORS.amber, CHART_COLORS.green, CHART_COLORS.red, '#8884d8', '#82ca9d']

export default function AccountActivityChart() {
  const { transactions, operations, txLoading, opsLoading } = useStore()
  const { isMobile } = useResponsive()
  const [exportOpen, setExportOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const txChartRef = useRef(null)
  const opsChartRef = useRef(null)

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
      const type = op.type_i !== undefined ? op.type : 'unknown'
      const label = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      if (!grouped[label]) grouped[label] = { name: label, count: 0 }
      grouped[label].count++
    }

    return Object.values(grouped).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [operations])

  const colorMap = useMemo(() => buildColorMap(opsByType.map((o) => o.name), PIE_COLORS), [opsByType])

  const loading = txLoading || opsLoading

  const closeMenu = () => setExportOpen(false)

  const exportCsvCombined = () => {
    const rows = [
      ...txByDay.map((row) => ({ section: 'tx_by_day', ...row })),
      ...opsByType.map((row) => ({ section: 'ops_by_type', ...row })),
    ]
    exportChartDataAsCsv(rows, safeFilename('account-activity', 'csv'))
    closeMenu()
  }

  const exportJsonCombined = () => {
    downloadJson({ txByDay, opsByType }, 'account-activity')
    closeMenu()
  }

  const exportTxPng = async () => {
    await exportPng(txChartRef.current, 'tx-by-day', { background: '#0f1820', scale: 2 })
    closeMenu()
  }

  const exportOpsPng = async () => {
    await exportPng(opsChartRef.current, 'ops-by-type', { background: '#0f1820', scale: 2 })
    closeMenu()
  }

  const exportTxSvg = () => { exportSvg(txChartRef.current, 'tx-by-day'); closeMenu() }
  const exportOpsSvg = () => { exportSvg(opsChartRef.current, 'ops-by-type'); closeMenu() }

  const hasAny = txByDay.length > 0 || opsByType.length > 0

  return (
    <Card
      title="Account Activity"
      subtitle="Transaction & operation breakdown"
      action={
        hasAny && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setExportOpen((o) => !o)} title="Export" style={iconBtn}>
              <Download size={13} /> Export
            </button>
            {exportOpen && (
              <div style={dropdownStyle} onMouseLeave={closeMenu}>
                <DropdownItem onClick={exportCsvCombined}>Export CSV</DropdownItem>
                <DropdownItem onClick={exportJsonCombined}>Export JSON</DropdownItem>
                <Sep />
                <DropdownItem onClick={exportTxPng} disabled={txByDay.length === 0}>PNG · Tx by Day</DropdownItem>
                <DropdownItem onClick={exportTxSvg} disabled={txByDay.length === 0}>SVG · Tx by Day</DropdownItem>
                <DropdownItem onClick={exportOpsPng} disabled={opsByType.length === 0}>PNG · Ops by Type</DropdownItem>
                <DropdownItem onClick={exportOpsSvg} disabled={opsByType.length === 0}>SVG · Ops by Type</DropdownItem>
              </div>
            )}
          </div>
        )
      }
    >
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
          {selected && (
            <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', padding: '12px', color: 'var(--text-primary)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <strong>{selected.label}</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{selected.type === 'day' ? 'Transactions by day' : 'Operations by type'}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{selected.value}</div>
            </div>
          )}

          {/* Transactions by day */}
          {txByDay.length > 0 && (
            <div>
              <div style={sectionLabel}>Transactions by Day</div>
              <div ref={txChartRef} style={{ height: isMobile ? 180 : 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={txByDay} onClick={(e) => e?.activePayload?.[0] && setSelected({ type: 'day', label: e.activeLabel, value: `${e.activePayload[0].payload.successful} successful / ${e.activePayload[0].payload.failed} failed` })} margin={{ left: isMobile ? -8 : 0, right: isMobile ? -8 : 0, top: 8, bottom: 0 }} barSize={isMobile ? 14 : 18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ ...AXIS_TICK_STYLE, fontSize: isMobile ? 10 : 11 }} angle={isMobile ? -20 : 0} textAnchor={isMobile ? 'end' : 'middle'} />
                    <YAxis tick={AXIS_TICK_STYLE} allowDecimals={false} width={isMobile ? 32 : 48} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 11, paddingTop: isMobile ? 4 : 0 }} layout={isMobile ? 'horizontal' : 'horizontal'} verticalAlign="bottom" align="center" />
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
              <div style={sectionLabel}>Operation Types</div>
              <div ref={opsChartRef} style={{ height: isMobile ? 220 : 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={opsByType}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={isMobile ? 60 : 80}
                      label={isMobile ? false : ({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={!isMobile}
                      onClick={(entry) => setSelected({ type: 'operation', label: entry.name, value: `${entry.value} operations` })}
                    >
                      {opsByType.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={colorMap[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 11 }} verticalAlign="bottom" align={isMobile ? 'center' : 'right'} layout={isMobile ? 'horizontal' : 'vertical'} />
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

const sectionLabel = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  letterSpacing: '0.8px',
  marginBottom: '10px',
  textTransform: 'uppercase',
}

const iconBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 26,
  padding: '0 10px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
  fontSize: '11px',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
}

const dropdownStyle = {
  position: 'absolute',
  top: '32px',
  right: 0,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
  minWidth: 200,
  padding: '4px',
  zIndex: 50,
}

function DropdownItem({ children, onClick, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
        fontSize: '12px',
        padding: '8px 12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: 'var(--radius-sm)',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
}
