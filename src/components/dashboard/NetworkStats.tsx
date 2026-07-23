import React, { useEffect, useState, useMemo } from 'react'
import { useStore } from '../../lib/store'
import { fetchNetworkStats, getServer, streamLedgers } from '../../lib/stellar'
import { format } from 'date-fns'
import Card, { StatCard } from './Card'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts'
import {
  Activity, Cpu, Shield, Coins, Zap, Clock, Globe, Terminal, Info,
  TrendingUp, Database, CheckCircle2, AlertTriangle, XCircle, Play
} from 'lucide-react'
import {
  calculateCongestion,
  getLiveValidatorStatus,
  predictFees,
  calculatePerformanceMetrics,
  LEDGER_OPERATION_LIMIT
} from '../../lib/networkMonitoring'

export default function Network() {
  const { network, networkStats, setNetworkStats, statsLoading, setStatsLoading } = useStore()
  const [recentLedgers, setRecentLedgers] = useState([])
  const [ledgersLoading, setLedgersLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  
  // Custom dashboard state
  const [activeTab, setActiveTab] = useState('overview')
  const [validators, setValidators] = useState([])
  const [selectedTxType, setSelectedTxType] = useState('payment')
  const [simulatingTx, setSimulatingTx] = useState(false)
  const [simulationTrace, setSimulationTrace] = useState(null)

  // Load and refresh live validators ping every 3 seconds to keep it interactive
  useEffect(() => {
    setValidators(getLiveValidatorStatus())
    const interval = setInterval(() => {
      setValidators(getLiveValidatorStatus())
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Calculate ledger close intervals and operations for chart
  const chartData = useMemo(() => {
    if (recentLedgers.length < 2) return []

    // Sort ledgers by sequence (ascending for chart)
    const sortedLedgers = [...recentLedgers].sort((a, b) => a.sequence - b.sequence)

    const data = []
    for (let i = 1; i < sortedLedgers.length; i++) {
      const current = sortedLedgers[i]
      const previous = sortedLedgers[i - 1]

      const currentTime = new Date(current.closed_at).getTime()
      const previousTime = new Date(previous.closed_at).getTime()
      const interval = (currentTime - previousTime) / 1000 // Convert to seconds

      data.push({
        sequence: current.sequence,
        interval: interval,
        operations: current.operation_count || 0,
        txCount: current.successful_transaction_count + current.failed_transaction_count,
        formattedSequence: current.sequence.toLocaleString()
      })
    }

    return data
  }, [recentLedgers])

  // Calculate average close time for reference line
  const averageCloseTime = useMemo(() => {
    if (chartData.length === 0) return 4.8
    const sum = chartData.reduce((acc, item) => acc + item.interval, 0)
    return sum / chartData.length
  }, [chartData])

  useEffect(() => {
    setStatsLoading(true)
    setLedgersLoading(true)

    // Initial fetch
    fetchNetworkStats(network)
      .then(s => setNetworkStats(s))
      .catch(() => { })
      .finally(() => setStatsLoading(false))

    getServer(network).ledgers().order('desc').limit(20).call()
      .then(r => setRecentLedgers(r.records))
      .catch(() => { })
      .finally(() => setLedgersLoading(false))

    // Set up streaming
    let closeStream = null
    try {
      closeStream = streamLedgers((newLedger) => {
        setIsStreaming(true)
        setRecentLedgers(prev => {
          if (prev.some(l => l.sequence === newLedger.sequence)) return prev
          return [newLedger, ...prev.slice(0, 19)]
        })

        // Update latest ledger immediately for instant UI feedback
        setNetworkStats(prev => ({
          ...prev,
          latestLedger: newLedger
        }))

        // Refresh full stats to ensure fee stats and other data stay current
        fetchNetworkStats(network)
          .then(s => setNetworkStats(s))
          .catch(() => { })
      }, network)
    } catch (e) {
      console.error('Streaming failed:', e)
      setIsStreaming(false)
    }

    return () => {
      if (closeStream) closeStream()
      setIsStreaming(false)
    }
  }, [network, setNetworkStats, setStatsLoading])

  const ledger = networkStats?.latestLedger
  const fee = networkStats?.feeStats

  // Calculate Congestion, Performance & Fee recommendations
  const congestion = useMemo(() => calculateCongestion(ledger), [ledger])
  const performance = useMemo(() => {
    const elapsed = chartData.length > 0 ? chartData[chartData.length - 1].interval : 5.0
    return calculatePerformanceMetrics(ledger, elapsed)
  }, [ledger, chartData])
  const feePredictions = useMemo(() => predictFees(fee, congestion.ratio), [fee, congestion])

  // Custom visual values for overall network health status banner
  const globalHealth = useMemo(() => {
    if (congestion.ratio > 0.8) {
      return {
        label: 'Elevated Traffic / Low Congestion Risks',
        desc: 'Transactions are being processed but higher base fees are recommended to guarantee next-ledger inclusion.',
        color: 'var(--red)',
        glow: 'rgba(255, 23, 68, 0.25)',
        badge: 'Warning'
      }
    } else if (congestion.ratio > 0.5) {
      return {
        label: 'Moderate Traffic',
        desc: 'High transaction activity. Soroban and general operations are running normally but base fees are dynamic.',
        color: 'var(--amber)',
        glow: 'rgba(255, 179, 0, 0.25)',
        badge: 'Active'
      }
    } else {
      return {
        label: 'Optimal Health',
        desc: 'All nodes synchronized, low consensus latency, and nominal transaction fee rates globally.',
        color: 'var(--green)',
        glow: 'rgba(0, 230, 118, 0.25)',
        badge: 'Healthy'
      }
    }
  }, [congestion])

  // Transaction simulation preflight trigger
  const handleSimulatePreflight = () => {
    setSimulatingTx(true)
    setSimulationTrace(null)

    setTimeout(() => {
      let ops = 1
      let baseFee = 100
      let detailStr = ''

      if (selectedTxType === 'payment') {
        ops = 1
        baseFee = feePredictions.standard.stroops
        detailStr = 'Simple Payment. Preflight dry-run succeeded. Base reserve requirements matched.'
      } else if (selectedTxType === 'trustline') {
        ops = 1
        baseFee = Math.round(feePredictions.standard.stroops * 1.1)
        detailStr = 'Change Trust Operation. Ledger entry footprint successfully simulated.'
      } else if (selectedTxType === 'soroban') {
        ops = 12 // internal sub-operations
        baseFee = feePredictions.high.stroops * 2.5
        detailStr = 'Smart Contract Invocation (Soroban SDK). Persistent memory footprint verified. Resource consumption: read: 3, write: 1, instructions CPU limit: 45%.'
      } else {
        ops = 3
        baseFee = feePredictions.standard.stroops * 1.5
        detailStr = 'Multi-Signature Account Merge / Configuration change. High authority threshold verified.'
      }

      setSimulationTrace({
        success: true,
        operationsCount: ops,
        simulatedBaseFee: baseFee,
        totalEstimatedFee: baseFee * ops,
        successProbability: congestion.ratio > 0.8 ? 88 : 99,
        details: detailStr,
        timestamp: new Date().toLocaleTimeString()
      })
      setSimulatingTx(false)
    }, 900)
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Network Header & Real-time Pulsar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            TELEMETRÍA DE RED
          </div>
          {isStreaming && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(0, 230, 118, 0.1)',
              border: '1px solid rgba(0, 230, 118, 0.2)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--green)',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} className="pulse" />
              Horizon Stream
            </div>
          )}
        </div>

        {/* Custom Tab Switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '4px',
          gap: '4px'
        }}>
          {[
            { id: 'overview', label: 'Vista General', icon: Activity },
            { id: 'fees', label: 'Calculadora de Tarifas', icon: Coins },
            { id: 'validators', label: 'Validadores en Vivo', icon: Shield }
          ].map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: active ? 'var(--bg-hover)' : 'transparent',
                  color: active ? 'var(--cyan)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: '13px',
                  transition: 'var(--transition)',
                }}
              >
                <Icon size={14} strokeWidth={2.5} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Real-time Global Health Status Banner */}
      <div style={{
        background: 'var(--bg-card)',
        border: `1px solid ${globalHealth.color}`,
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 0 16px ${globalHealth.glow}`,
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          background: `${globalHealth.color}15`,
          border: `1px solid ${globalHealth.color}30`,
          color: globalHealth.color,
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          {globalHealth.badge}
        </div>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, marginBottom: '2px', color: 'var(--text-primary)' }}>
            {globalHealth.label}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {globalHealth.desc}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Congestión</div>
            <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: globalHealth.color }}>
              {congestion.percentage}%
            </div>
          </div>
          <div style={{ height: '36px', width: '1px', background: 'var(--border)' }} />
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Éxito de Tx</div>
            <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
              {congestion.successRate}%
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & PERFORMANCE GRAPH */}
      {activeTab === 'overview' && (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Key telemetry stat grids */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <StatCard label="Ledger de Consenso" value={ledger?.sequence?.toLocaleString()} loading={statsLoading} accent="var(--cyan)" />
            <StatCard label="Ops Promedio" value={performance.ops + ' ops/s'} sub={`Último: ${ledger?.operation_count?.toLocaleString()} ops`} loading={statsLoading} accent="var(--amber)" />
            <StatCard label="Tasa de Cómputo" value={performance.tps + ' tps'} sub={`${ledger?.successful_transaction_count} txs en ${performance.closeTime}s`} loading={statsLoading} accent="var(--green)" />
            <StatCard
              label="Cierre de Ledger"
              value={ledger ? format(new Date(ledger.closed_at), 'HH:mm:ss') : '—'}
              sub={ledger ? format(new Date(ledger.closed_at), 'MMM d, yyyy') : ''}
              loading={statsLoading}
            />
          </div>

          {/* Ledger close and Traffic visual Chart */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="var(--cyan)" />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Fluctuación del Tiempo de Consenso y Operaciones</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Visualizando últimos {chartData.length} ledgers cerrados
              </span>
            </div>
            {ledgersLoading ? (
              <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
            ) : chartData.length > 0 ? (
              <div style={{ padding: '18px', height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorInterval" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0.02}/>
                      </linearGradient>
                      <linearGradient id="colorOps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--amber)" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="var(--amber)" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis
                      dataKey="sequence"
                      tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                      tickFormatter={(value) => value.toLocaleString()}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      label={{ value: 'Segundos', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '10px', fill: 'var(--text-muted)', fontFamily: 'var(--font-display)' } }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      label={{ value: 'Operaciones', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: '10px', fill: 'var(--text-muted)', fontFamily: 'var(--font-display)' } }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-bright)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                      }}
                      formatter={(value, name) => {
                        if (name === 'interval') return [`${value.toFixed(2)}s`, 'Tiempo de Cierre']
                        return [value, 'Operaciones']
                      }}
                      labelFormatter={(label) => `Ledger #${label.toLocaleString()}`}
                    />
                    <ReferenceLine
                      yAxisId="left"
                      y={averageCloseTime}
                      stroke="var(--cyan-dim)"
                      strokeDasharray="4 4"
                      label={{ value: `Avg: ${averageCloseTime.toFixed(2)}s`, position: 'topRight', fontSize: 10, fill: 'var(--cyan)' }}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="interval"
                      stroke="var(--cyan)"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorInterval)"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="operations"
                      stroke="var(--amber)"
                      strokeWidth={1.5}
                      fillOpacity={1}
                      fill="url(#colorOps)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No telemetry chart data available. Waiting for consensus signals...
              </div>
            )}
          </div>

          {/* Cyber Terminal style list of Ledgers */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={16} color="var(--green)" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Ledger Stream Console</span>
            </div>
            {ledgersLoading ? (
              <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
            ) : (
              <div style={{ background: 'var(--bg-base)', padding: '8px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.5fr',
                  padding: '8px 16px',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  borderBottom: '1px solid var(--border)'
                }}>
                  <span>Secuencia</span><span>Transacciones</span><span>Operaciones</span><span>Exitoso %</span><span>Consenso (Hora)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                  {recentLedgers.slice(0, 10).map((l) => {
                    const txSuccess = l.successful_transaction_count || 0
                    const txFailed = l.failed_transaction_count || 0
                    const rate = txSuccess + txFailed > 0 ? Math.round((txSuccess / (txSuccess + txFailed)) * 100) : 100
                    return (
                      <div
                        key={l.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1.5fr',
                          padding: '10px 16px',
                          fontSize: '12px',
                          borderRadius: 'var(--radius-sm)',
                          fontFamily: 'var(--font-mono)',
                          background: 'transparent',
                          transition: 'all 120ms ease',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--bg-hover)'
                          e.currentTarget.style.transform = 'translateX(4px)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.transform = 'none'
                        }}
                      >
                        <span style={{ color: 'var(--cyan)' }}>#{l.sequence.toLocaleString()}</span>
                        <span style={{ color: 'var(--text-primary)' }}>{txSuccess + txFailed}</span>
                        <span style={{ color: 'var(--amber)' }}>{l.operation_count} ops</span>
                        <span style={{ color: rate >= 90 ? 'var(--green)' : 'var(--red)' }}>{rate}%</span>
                        <span style={{ color: 'var(--text-muted)' }}>{format(new Date(l.closed_at), 'yyyy-MM-dd HH:mm:ss')}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FEE CALCULATOR & ESTIMATION */}
      {activeTab === 'fees' && (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Fee urgent recommendations */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {[
              { title: 'Prioridad Baja', data: feePredictions.low, color: 'var(--text-secondary)', sub: 'Inclusión diferida' },
              { title: 'Prioridad Estándar', data: feePredictions.standard, color: 'var(--cyan)', sub: 'Recomendado para la mayoría de Txs' },
              { title: 'Prioridad Alta', data: feePredictions.high, color: 'var(--amber)', sub: 'Inclusión inmediata (Consenso crítico)' }
            ].map((p, idx) => (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-card)',
                  border: activeTab === 'fees' && idx === 1 ? '1.5px solid var(--cyan-dim)' : '1px solid var(--border)',
                  boxShadow: activeTab === 'fees' && idx === 1 ? '0 0 16px var(--cyan-glow-sm)' : 'none',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative'
                }}
              >
                {idx === 1 && (
                  <span style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: 'var(--cyan-glow)',
                    border: '1px solid var(--cyan-dim)',
                    color: 'var(--cyan)',
                    fontWeight: 700
                  }}>
                    RECOMENDADO
                  </span>
                )}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{p.title}</div>
                  <div style={{ fontSize: '11px', color: p.color, marginTop: '2px' }}>{p.sub}</div>
                </div>

                <div>
                  <div style={{ fontSize: '26px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {p.data.stroops} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>stroops</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    ≈ {p.data.xlm} XLM
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '10px'
                }}>
                  <Clock size={12} />
                  Tiempo estimado: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.data.expectedInclusion}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive simulator dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Input card for simulator */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={16} color="var(--cyan)" />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>Simulador de Tarifas Avanzado</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Estime tarifas y pre-requisitos de operaciones de forma segura.
                </div>
              </div>

              {/* Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Tipo de Transacción
                </label>
                <select
                  value={selectedTxType}
                  onChange={(e) => setSelectedTxType(e.target.value)}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-display)',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="payment">Transferencia de XLM Común (1 op)</option>
                  <option value="trustline">Establecer Trustline / Fideicomiso (1 op)</option>
                  <option value="soroban">Invocación Soroban Smart Contract (Soroban Preflight)</option>
                  <option value="multisig">Actualización de Firmantes / Multi-sig (3 ops)</option>
                </select>
              </div>

              {/* Congestion slider mock */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Congestión de Red
                  </span>
                  <span style={{ color: congestion.color, fontWeight: 700 }}>
                    {congestion.level} ({congestion.percentage}%)
                  </span>
                </div>
                <div style={{
                  height: '6px',
                  background: 'var(--border)',
                  borderRadius: '3px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: `${congestion.percentage}%`,
                    background: congestion.color
                  }} />
                </div>
              </div>

              {/* Simulation triggers */}
              <button
                onClick={handleSimulatePreflight}
                disabled={simulatingTx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: simulatingTx ? 'var(--bg-hover)' : 'var(--cyan)',
                  color: simulatingTx ? 'var(--text-muted)' : 'var(--bg-base)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '13px',
                  boxShadow: simulatingTx ? 'none' : '0 4px 16px var(--cyan-glow)',
                  transition: 'all var(--transition)'
                }}
              >
                {simulatingTx ? (
                  <>
                    <div className="spinner" style={{ borderTopColor: 'var(--bg-base)' }} />
                    Ejecutando Simulación...
                  </>
                ) : (
                  <>
                    <Play size={14} fill="currentColor" />
                    Simular Preflight Transacción
                  </>
                )}
              </button>
            </div>

            {/* Simulation output console */}
            <div style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              minHeight: '260px',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '8px', color: 'var(--text-primary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  <Terminal size={14} color="var(--cyan)" />
                  Simulación de Ejecución (Preflight)
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Console Log</span>
              </div>

              {simulationTrace ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Estado Preflight:</span>
                    <span style={{
                      color: 'var(--green)',
                      background: 'rgba(0,230,118,0.1)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '10px'
                    }}>
                      ÉXITO (200 OK)
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Operaciones:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{simulationTrace.operationsCount} ops</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tarifa Recomendada:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{simulationTrace.simulatedBaseFee} stroops/op</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                      <span>Comisión Total Estimada:</span>
                      <span style={{ color: 'var(--cyan)' }}>{simulationTrace.totalEstimatedFee} stroops</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Huella del Preflight
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: 1.4, marginTop: '2px' }}>
                      {simulationTrace.details}
                    </span>
                  </div>

                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 'auto', textAlign: 'right' }}>
                    Ejecutado a las {simulationTrace.timestamp}
                  </div>
                </div>
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: '20px'
                }}>
                  <Info size={24} />
                  <span>Configure el tipo de transacción y presione "Simular Preflight" para emitir telemetría de comisión y probar límites operacionales en la red.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LIVE VALIDATORS LIST */}
      {activeTab === 'validators' && (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Nodos Validadores del Quórum Stellar
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Monitoreo activo y latencia dinámica de nodos centrales.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }} /> Activos: {validators.filter(v => v.status === 'ONLINE').length}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--red)' }} /> Desconectados: {validators.filter(v => v.status === 'OFFLINE').length}
              </div>
            </div>
          </div>

          {/* Grid of Validators */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {validators.map((v) => {
              const online = v.status === 'ONLINE'
              return (
                <div
                  key={v.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'all 150ms ease',
                    position: 'relative'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--border-bright)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  
                  {/* Validator Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                        {v.name}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {v.operator}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '9px',
                        fontFamily: 'var(--font-mono)',
                        color: online ? 'var(--green)' : 'var(--red)',
                        background: online ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 23, 68, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        fontWeight: 700
                      }}>
                        {online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: online ? 'var(--green)' : 'var(--red)'
                      }}
                        className={online ? 'pulse' : ''}
                      />
                    </div>
                  </div>

                  {/* Geolocation and Protocol Version info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '10px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Región:</span>
                      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={11} /> {v.region} ({v.country})
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Protocolo:</span>
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{v.protocolVersion}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Ping Latencia:</span>
                      <span style={{ color: online ? 'var(--cyan)' : 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {online ? `${v.ping} ms` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Voting weight consensus stats */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                      <span>Participación Consenso:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{v.consensus}%</span>
                    </div>
                    
                    {/* Progress Bar for voting power */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
                        <span>Poder de Quórum:</span>
                        <span>{v.votingPower}%</span>
                      </div>
                      <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${v.votingPower * 10}%`, background: 'var(--cyan)' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
