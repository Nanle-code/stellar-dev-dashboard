import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useResponsive } from '../../hooks/useResponsive'
import { useStore } from '../../lib/store'
import { getServer } from '../../lib/stellar'
import { formatCompactNumber, TOOLTIP_STYLE, AXIS_TICK_STYLE, CHART_COLORS } from '../../lib/chartUtils'
import { exportPng, exportSvg, downloadJson, exportChartDataAsCsv, safeFilename } from '../../utils/chartUtils'
import Card from '../dashboard/Card'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, Brush,
} from 'recharts'
import { format } from 'date-fns'
import { RefreshCw, Download, Eye, EyeOff } from 'lucide-react'

const SERIES = [
  { id: 'txCount',  label: 'Successful', color: CHART_COLORS.green },
  { id: 'failedTx', label: 'Failed',     color: CHART_COLORS.red },
  { id: 'opCount',  label: 'Operations', color: CHART_COLORS.cyan },
]

export default function NetworkMetricsChart() {
  const { network } = useStore()
  const { isMobile } = useResponsive()
  const [ledgerData, setLedgerData] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [hidden, setHidden] = useState(() => new Set())
  const [selected, setSelected] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)

  const txChartRef = useRef(null)
  const opsChartRef = useRef(null)

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
  }, [network, refreshTick])

  const maxTx = useMemo(() => {
    if (ledgerData.length === 0) return 10
    return Math.max(...ledgerData.map((d) => d.txCount + d.failedTx), 10)
  }, [ledgerData])

  const isHidden = (id) => hidden.has(id)
  const toggleSeries = useCallback((id) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const handleExportCsv = () => {
    exportChartDataAsCsv(ledgerData, safeFilename('network-metrics', 'csv'))
    setExportOpen(false)
  }
  const handleExportJson = () => {
    downloadJson(ledgerData, 'network-metrics')
    setExportOpen(false)
  }
  const handleExportPng = async (which) => {
    const ref = which === 'tx' ? txChartRef : opsChartRef
    await exportPng(ref.current, `network-${which}`, { background: '#0f1820', scale: 2 })
    setExportOpen(false)
  }
  const handleExportSvg = (which) => {
    const ref = which === 'tx' ? txChartRef : opsChartRef
    exportSvg(ref.current, `network-${which}`)
    setExportOpen(false)
  }

  return (
    <Card
      title="Network Metrics"
      subtitle="Transactions & operations per ledger"
      action={
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {SERIES.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleSeries(s.id)}
              title={`${isHidden(s.id) ? 'Show' : 'Hide'} ${s.label}`}
              style={toggleStyle(s.color, isHidden(s.id))}
            >
              {isHidden(s.id) ? <EyeOff size={11} /> : <Eye size={11} />}
              {s.label}
            </button>
          ))}

          <button onClick={() => setRefreshTick((n) => n + 1)} title="Refresh" style={iconBtn}>
            <RefreshCw size={13} className={loading ? 'spinner-icon' : ''} />
          </button>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setExportOpen((o) => !o)} title="Export" style={iconBtn}>
              <Download size={13} />
            </button>
            {exportOpen && (
              <div style={dropdownStyle} onMouseLeave={() => setExportOpen(false)}>
                <DropdownItem onClick={handleExportCsv}>Export CSV</DropdownItem>
                <DropdownItem onClick={handleExportJson}>Export JSON</DropdownItem>
                <DropdownItem onClick={() => handleExportPng('tx')}>PNG · Transactions</DropdownItem>
                <DropdownItem onClick={() => handleExportPng('ops')}>PNG · Operations</DropdownItem>
                <DropdownItem onClick={() => handleExportSvg('tx')}>SVG · Transactions</DropdownItem>
                <DropdownItem onClick={() => handleExportSvg('ops')}>SVG · Operations</DropdownItem>
              </div>
            )}
          </div>
        </div>
      }
    >
      {loading && ledgerData.length === 0 ? (
        <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : ledgerData.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          No ledger data available
        </div>
      ) : (
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tx count bar chart with brush */}
          <div>
            <div style={sectionLabel}>Transactions per Ledger</div>
            <div ref={txChartRef} style={{ height: isMobile ? 200 : 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ledgerData}
                  onClick={(e) => e?.activePayload?.[0] && setSelected(e.activePayload[0].payload)}
                  margin={{ top: isMobile ? 8 : 0, right: isMobile ? 10 : 0, left: 0, bottom: isMobile ? 0 : 0 }}
                  barCategoryGap={isMobile ? '25%' : '15%'}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={AXIS_TICK_STYLE} interval="preserveStartEnd" minTickGap={isMobile ? 8 : 15} />
                  <YAxis tick={AXIS_TICK_STYLE} domain={[0, maxTx]} tickFormatter={formatCompactNumber} width={isMobile ? 40 : 60} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 11, paddingTop: isMobile ? 6 : 0 }} />
                  {!isHidden('txCount') && (
                    <Bar dataKey="txCount" name="Successful" fill={CHART_COLORS.green} radius={[2, 2, 0, 0]} />
                  )}
                  {!isHidden('failedTx') && (
                    <Bar dataKey="failedTx" name="Failed" fill={CHART_COLORS.red} radius={[2, 2, 0, 0]} />
                  )}
                  <Brush
                    dataKey="label"
                    height={isMobile ? 16 : 20}
                    stroke={CHART_COLORS.cyan}
                    travellerWidth={isMobile ? 6 : 8}
                    fill="rgba(0, 229, 255, 0.05)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Operations area chart */}
          {!isHidden('opCount') && (
            <div>
              <div style={sectionLabel}>Operations per Ledger</div>
              <div ref={opsChartRef} style={{ height: isMobile ? 180 : 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={ledgerData}
                    onClick={(e) => e?.activePayload?.[0] && setSelected(e.activePayload[0].payload)}
                    margin={{ top: isMobile ? 8 : 0, right: isMobile ? 10 : 0, left: 0, bottom: isMobile ? 0 : 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={AXIS_TICK_STYLE} interval="preserveStartEnd" minTickGap={isMobile ? 8 : 15} />
                    <YAxis tick={AXIS_TICK_STYLE} tickFormatter={formatCompactNumber} width={isMobile ? 40 : 60} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Area
                      type="monotone" dataKey="opCount" name="Operations"
                      stroke={CHART_COLORS.cyan} fill={CHART_COLORS.cyan}
                      fillOpacity={0.15} strokeWidth={2}
                    />
                    <Brush
                      dataKey="label"
                      height={isMobile ? 16 : 20}
                      stroke={CHART_COLORS.cyan}
                      travellerWidth={isMobile ? 6 : 8}
                      fill="rgba(0, 229, 255, 0.05)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Pinned-selection details */}
          {selected && (
            <div style={pinnedStyle}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Pinned Ledger #{selected.sequence}
              </div>
              <div style={{ display: 'flex', gap: '18px', marginTop: '6px', fontSize: '12px', flexWrap: 'wrap' }}>
                <span>Closed: <strong>{selected.label}</strong></span>
                <span style={{ color: CHART_COLORS.green }}>Success: {selected.txCount}</span>
                <span style={{ color: CHART_COLORS.red }}>Failed: {selected.failedTx}</span>
                <span style={{ color: CHART_COLORS.cyan }}>Ops: {selected.opCount}</span>
                <button onClick={() => setSelected(null)} style={clearBtn}>clear</button>
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
  justifyContent: 'center',
  width: 26,
  height: 26,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}

const dropdownStyle = {
  position: 'absolute',
  top: '32px',
  right: 0,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
  minWidth: 180,
  padding: '4px',
  zIndex: 50,
}

function DropdownItem({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        color: 'var(--text-primary)',
        fontSize: '12px',
        padding: '8px 12px',
        cursor: 'pointer',
        borderRadius: 'var(--radius-sm)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

function toggleStyle(color, isOff) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: 26,
    padding: '0 8px',
    background: isOff ? 'transparent' : `${color}1a`,
    border: `1px solid ${isOff ? 'var(--border)' : color}`,
    borderRadius: 'var(--radius-sm)',
    color: isOff ? 'var(--text-muted)' : color,
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
  }
}

const pinnedStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--cyan-dim)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 14px',
}

const clearBtn = {
  marginLeft: 'auto',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-muted)',
  fontSize: '11px',
  padding: '2px 8px',
  cursor: 'pointer',
}
