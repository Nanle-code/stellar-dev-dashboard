/**
 * Comprehensive Portfolio Analytics View
 * 
 * Features:
 * - Asset allocation pie chart
 * - Portfolio value line chart over time
 * - Performance metrics (ROI, volatility, Sharpe ratio)
 * - Account history comparison
 * - Real-time data updates
 * - Mobile responsive design
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useStore } from '../../lib/store'
import { fetchPrices, calculatePortfolioValue } from '../../lib/priceFeed'
import { getServer } from '../../lib/stellar'
import {
  calculateAssetAllocation,
  calculateDiversificationScore,
  identifyConcentrationRisks,
  calculate24hPortfolioChange,
  fetchHistoricalPerformance,
  calculateVolatility,
  calculateSharpeRatio,
  assessPortfolioRisk,
  generatePortfolioSummary,
} from '../../lib/portfolioAnalytics'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  Activity,
  AlertTriangle,
  Target,
  DollarSign,
  RefreshCw,
  Calendar,
  Info,
} from 'lucide-react'
import Card, { StatCard } from './Card'
import MobileChartContainer from '../charts/MobileChartContainer'
import { useResponsive } from '../../hooks/useResponsive'

// Constants
const CHART_COLORS = [
  '#00d4ff', // cyan
  '#00ff88', // green
  '#ff6b6b', // red
  '#ffd93d', // yellow
  '#a78bfa', // purple
  '#fb923c', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#8b5cf6', // violet
]

const TIME_RANGES = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
]

interface PanelProps {
  title?: string
  children: React.ReactNode
  style?: React.CSSProperties
  action?: React.ReactNode
}

// Helper component for section panels
function Panel({ title, children, style = {}, action }: PanelProps) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {(title || action) && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{title}</span>
          {action}
        </div>
      )}
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

// Format currency
const formatUSD = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Format percentage
const formatPercent = (value: number, decimals = 2) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

// Format large numbers
const formatCompact = (value: number) => {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
  return formatUSD(value)
}

export default function PortfolioAnalytics() {
  const {
    accountData,
    connectedAddress,
    network,
    prices,
    setPrices,
    pricesLoading,
    setPricesLoading,
    setPricesError,
  } = useStore()
  
  const { isMobile, isTablet } = useResponsive()
  const [timeRange, setTimeRange] = useState(30)
  const [historicalData, setHistoricalData] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  const balances = accountData?.balances || []

  // Determine which asset codes we need prices for
  const assetCodes = useMemo(() => {
    const codes = balances
      .map((b) => (b.asset_type === 'native' ? 'XLM' : b.asset_code))
      .filter(Boolean)
    return Array.from(new Set(codes))
  }, [balances])

  // Fetch prices
  const fetchAssetPrices = useCallback(async (force = false) => {
    if (assetCodes.length === 0) return

    setPricesLoading(true)
    try {
      const fetched = await fetchPrices(assetCodes, { forceRefresh: force })
      setPrices({ ...prices, ...fetched })
      setLastUpdate(new Date())
    } catch (err: any) {
      setPricesError(err.message)
    } finally {
      setPricesLoading(false)
    }
  }, [assetCodes.join(','), setPrices, setPricesLoading, setPricesError])

  // Initial price fetch
  useEffect(() => {
    fetchAssetPrices()
  }, [assetCodes.join(',')])

  // Auto-refresh prices every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchAssetPrices(true)
    }, 60000)

    return () => clearInterval(interval)
  }, [autoRefresh, fetchAssetPrices])

  // Calculate portfolio value
  const portfolio = useMemo(() => {
    return calculatePortfolioValue(balances, prices)
  }, [balances, prices])

  // Fetch historical performance data
  useEffect(() => {
    if (!connectedAddress || !portfolio || !portfolio.items?.length) return

    let cancelled = false
    const loadHistory = async () => {
      setHistoryLoading(true)
      try {
        const server = getServer(network)
        const currentBalances: Record<string, number> = {}
        
        for (const item of portfolio.items) {
          currentBalances[item.code] = item.amount
        }

        const history = await fetchHistoricalPerformance(
          server,
          connectedAddress,
          currentBalances,
          timeRange
        )

        // Convert balances to USD values
        const enrichedHistory = history.map((snapshot) => {
          let totalValue = 0
          for (const [code, amount] of Object.entries(snapshot.balances)) {
            const price = prices[code]?.usd || 0
            totalValue += amount * price
          }
          return {
            ...snapshot,
            value: totalValue,
          }
        })

        if (!cancelled) {
          setHistoricalData(enrichedHistory)
        }
      } catch (err) {
        console.warn('Failed to fetch historical data:', err)
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }

    loadHistory()
    return () => {
      cancelled = true
    }
  }, [connectedAddress, network, timeRange, portfolio.items?.length, prices])

  // Calculate comprehensive analytics
  const analytics = useMemo(() => {
    if (!portfolio.items || portfolio.items.length === 0) {
      return null
    }

    return generatePortfolioSummary(portfolio.items, historicalData)
  }, [portfolio, historicalData])

  // Calculate additional metrics
  const sharpeRatio = useMemo(() => {
    if (!analytics || !analytics.performance24h || !analytics.volatility) return null
    return calculateSharpeRatio(analytics.performance24h.changePercent, analytics.volatility)
  }, [analytics])

  // Loading state
  if (pricesLoading && !portfolio.totalUsd) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', padding: '40px' }}>
        <div className="spinner" />
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Loading portfolio data...
        </div>
      </div>
    )
  }

  // No data state
  if (!analytics || portfolio.items.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>
          Portfolio Analytics
        </div>
        <Card>
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Info size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>No Portfolio Data</div>
            <div style={{ fontSize: '13px' }}>
              Connect an account with balances to view comprehensive analytics
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const gridCols = isMobile ? 2 : isTablet ? 3 : 4

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>
            Portfolio Analytics
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: '8px 12px',
              background: autoRefresh ? 'var(--cyan)' : 'var(--bg-elevated)',
              color: autoRefresh ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} className={autoRefresh ? 'spin' : ''} />
            Auto-refresh
          </button>

          <button
            onClick={() => fetchAssetPrices(true)}
            disabled={pricesLoading}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: pricesLoading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              opacity: pricesLoading ? 0.6 : 1,
            }}
          >
            {pricesLoading ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`, 
        gap: '12px' 
      }}>
        <StatCard
          label="Total Value"
          value={formatUSD(portfolio.totalUsd || 0)}
          accent="var(--cyan)"
          sub={`${analytics.assetCount} assets`}
        />
        <StatCard
          label="24h Change"
          value={formatPercent(analytics.performance24h?.changePercent || 0)}
          accent={analytics.performance24h?.isPositive ? 'var(--green)' : 'var(--red)'}
          sub={formatUSD(analytics.performance24h?.change || 0)}
        />

        <StatCard
          label="Diversification"
          value={`${analytics.diversificationScore.toFixed(0)}/100`}
          accent={
            analytics.diversificationScore >= 70 ? 'var(--green)' : 
            analytics.diversificationScore >= 40 ? 'var(--amber)' : 'var(--red)'
          }
          sub={
            analytics.diversificationScore >= 70 ? 'Well diversified' :
            analytics.diversificationScore >= 40 ? 'Moderate' : 'Low diversity'
          }
        />
        <StatCard
          label="Risk Level"
          value={analytics.riskAssessment.level.toUpperCase()}
          accent={
            analytics.riskAssessment.level === 'low' ? 'var(--green)' :
            analytics.riskAssessment.level === 'medium' ? 'var(--amber)' : 'var(--red)'
          }
          sub={`Score: ${analytics.riskAssessment.score}/100`}
        />
        {!isMobile && (
          <>
            <StatCard
              label="Volatility"
              value={`${analytics.volatility.toFixed(2)}%`}
              accent="var(--purple)"
              sub={analytics.volatility < 5 ? 'Low' : analytics.volatility < 10 ? 'Moderate' : 'High'}
            />
            {sharpeRatio !== null && (
              <StatCard
                label="Sharpe Ratio"
                value={sharpeRatio.toFixed(2)}
                accent={sharpeRatio > 1 ? 'var(--green)' : sharpeRatio > 0 ? 'var(--amber)' : 'var(--red)'}
                sub={sharpeRatio > 1 ? 'Good' : sharpeRatio > 0 ? 'Fair' : 'Poor'}
              />
            )}
          </>
        )}
      </div>

      {/* Charts Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : '1fr 1fr', 
        gap: '16px' 
      }}>
        {/* Asset Allocation Pie Chart */}
        <Panel title="Asset Allocation">
          <MobileChartContainer allowZoom allowPan minHeight={isMobile ? 280 : 320}>
            <ResponsiveContainer width="100%" height={isMobile ? 280 : 320}>
              <PieChart>
                <Pie
                  data={analytics.allocation}
                  dataKey="allocation"
                  nameKey="code"
                  cx="50%"
                  cy="50%"
                  outerRadius={isMobile ? 80 : 100}
                  label={({ code, allocation }) => `${code} ${allocation.toFixed(1)}%`}
                  labelLine={true}
                >
                  {analytics.allocation.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                  }}
                  formatter={(value: any, name: any, props: any) => [
                    `${formatUSD(props.payload.valueUsd)} (${value.toFixed(2)}%)`,
                    props.payload.code,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </MobileChartContainer>
        </Panel>

        {/* Portfolio Value Over Time */}
        <Panel 
          title="Portfolio Value Over Time"
          action={
            <div style={{ display: 'flex', gap: '4px' }}>
              {TIME_RANGES.map((range) => (
                <button
                  key={range.days}
                  onClick={() => setTimeRange(range.days)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '10px',
                    background: timeRange === range.days ? 'var(--cyan)' : 'transparent',
                    color: timeRange === range.days ? 'var(--bg-primary)' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {range.label}
                </button>
              ))}
            </div>
          }
        >
          {historyLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: isMobile ? 280 : 320 }}>
              <div className="spinner" />
            </div>
          ) : historicalData.length > 0 ? (
            <MobileChartContainer allowZoom allowPan minHeight={isMobile ? 280 : 320}>
              <ResponsiveContainer width="100%" height={isMobile ? 280 : 320}>
                <AreaChart data={historicalData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--text-muted)', fontSize: isMobile ? 9 : 11 }}
                    tickFormatter={(date) => {
                      const d = new Date(date)
                      return `${d.getMonth() + 1}/${d.getDate()}`
                    }}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: isMobile ? 9 : 11 }}
                    tickFormatter={(value) => formatCompact(value)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px',
                    }}
                    formatter={(value: any) => [formatUSD(value), 'Value']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#00d4ff"
                    strokeWidth={2}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </MobileChartContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No historical data available
            </div>
          )}
        </Panel>
      </div>

      {/* Asset Performance Comparison */}
      <Panel title="Asset Performance (24h)">
        <MobileChartContainer allowPan minHeight={isMobile ? 220 : 280}>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
            <BarChart
              data={analytics.allocation}
              layout="vertical"
              margin={{ top: 5, right: 30, left: isMobile ? 40 : 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
              <XAxis
                type="number"
                tick={{ fill: 'var(--text-muted)', fontSize: isMobile ? 9 : 11 }}
                tickFormatter={(value) => `${value.toFixed(1)}%`}
              />
              <YAxis
                type="category"
                dataKey="code"
                tick={{ fill: 'var(--text-muted)', fontSize: isMobile ? 9 : 11 }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                }}
                formatter={(value: any, name: any, props: any) => [
                  formatPercent(props.payload.change24h || 0),
                  '24h Change',
                ]}
              />
              <Bar dataKey="change24h" radius={[0, 4, 4, 0]}>
                {analytics.allocation.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={(entry.change24h || 0) >= 0 ? 'var(--green)' : 'var(--red)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </MobileChartContainer>
      </Panel>

      {/* Detailed Holdings Table */}
      <Panel title="Portfolio Holdings">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: isMobile ? '11px' : '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Asset
                </th>
                <th style={{ textAlign: 'right', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Balance
                </th>
                <th style={{ textAlign: 'right', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Price
                </th>
                <th style={{ textAlign: 'right', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Value
                </th>
                <th style={{ textAlign: 'right', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Allocation
                </th>
                <th style={{ textAlign: 'right', padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  24h Change
                </th>
              </tr>
            </thead>
            <tbody>
              {analytics.allocation.map((asset: any, index: number) => (
                <tr
                  key={asset.code}
                  style={{
                    borderBottom: index < analytics.allocation.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >

                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {asset.code}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {asset.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {formatUSD(asset.priceUsd || 0)}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {formatUSD(asset.valueUsd || 0)}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {asset.allocation.toFixed(2)}%
                  </td>
                  <td
                    style={{
                      padding: '12px 8px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: (asset.change24h || 0) >= 0 ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      {(asset.change24h || 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {formatPercent(asset.change24h || 0)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Risk Assessment */}
      <Panel title="Risk Assessment">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px' }}>
            <div style={{ 
              padding: '16px', 
              background: 'var(--bg-card)', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                RISK LEVEL
              </div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: 700, 
                color: analytics.riskAssessment.level === 'low' ? 'var(--green)' :
                       analytics.riskAssessment.level === 'medium' ? 'var(--amber)' : 'var(--red)',
                textTransform: 'uppercase'
              }}>
                {analytics.riskAssessment.level}
              </div>
            </div>
            
            <div style={{ 
              padding: '16px', 
              background: 'var(--bg-card)', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                RISK SCORE
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {analytics.riskAssessment.score}/100
              </div>
            </div>

            <div style={{ 
              padding: '16px', 
              background: 'var(--bg-card)', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                CONCENTRATION RISKS
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {analytics.concentrationRisks.length}
              </div>
            </div>
          </div>

          {/* Risk Factors */}
          {analytics.riskAssessment.factors.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-muted)' }}>
                Risk Factors
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {analytics.riskAssessment.factors.map((factor: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-card)',
                      border: `1px solid ${
                        factor.impact === 'high' ? 'var(--red)' :
                        factor.impact === 'medium' ? 'var(--amber)' : 'var(--border)'
                      }`,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {factor.impact === 'high' && <AlertTriangle size={16} color="var(--red)" />}
                    <span style={{ color: 'var(--text-primary)' }}>{factor.factor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concentration Risks */}
          {analytics.concentrationRisks.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-muted)' }}>
                Concentrated Assets
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {analytics.concentrationRisks.map((risk: any) => (
                  <div
                    key={risk.code}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-card)',
                      border: `1px solid ${risk.riskLevel === 'high' ? 'var(--red)' : 'var(--amber)'}`,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {risk.code}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {risk.allocation.toFixed(1)}% of portfolio
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Performance Metrics Grid */}
      {!isMobile && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <StatCard
            label="Average Daily Return"
            value={historicalData.length > 1 ? 
              formatPercent(
                ((historicalData[historicalData.length - 1]?.value / historicalData[0]?.value - 1) / historicalData.length) * 100
              ) : 'N/A'
            }
            accent="var(--text-primary)"
          />

          <StatCard
            label="Highest Value Asset"
            value={analytics.topAssets[0]?.code || 'N/A'}
            accent="var(--cyan)"
            sub={analytics.topAssets[0] ? formatUSD(analytics.topAssets[0].valueUsd) : ''}
          />
          <StatCard
            label="Number of Assets"
            value={analytics.assetCount.toString()}
            accent="var(--green)"
            sub={`Avg: ${formatUSD(portfolio.totalUsd / analytics.assetCount)} each`}
          />
        </div>
      )}

      {/* Account History Comparison Info */}
      <Panel title="Account History">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Historical data is reconstructed from account effects over the selected time period.
            The chart shows your portfolio value changes based on balance movements and current asset prices.
          </div>
          
          {historicalData.length > 0 && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
              gap: '12px',
              marginTop: '8px'
            }}>
              <div style={{ 
                padding: '12px', 
                background: 'var(--bg-card)', 
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  PERIOD START
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatUSD(historicalData[0]?.value || 0)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {new Date(historicalData[0]?.timestamp).toLocaleDateString()}
                </div>
              </div>

              <div style={{ 
                padding: '12px', 
                background: 'var(--bg-card)', 
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  CURRENT VALUE
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatUSD(portfolio.totalUsd || 0)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {new Date().toLocaleDateString()}
                </div>
              </div>

              <div style={{ 
                padding: '12px', 
                background: 'var(--bg-card)', 
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  PERIOD CHANGE
                </div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: 600, 
                  color: (portfolio.totalUsd - (historicalData[0]?.value || 0)) >= 0 ? 'var(--green)' : 'var(--red)'
                }}>
                  {formatPercent(
                    ((portfolio.totalUsd - (historicalData[0]?.value || 0)) / (historicalData[0]?.value || 1)) * 100
                  )}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {formatUSD(portfolio.totalUsd - (historicalData[0]?.value || 0))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
