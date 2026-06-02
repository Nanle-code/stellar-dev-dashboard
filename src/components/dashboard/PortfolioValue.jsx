import React, { useEffect, useMemo, useState } from 'react'
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
  assessPortfolioRisk,
  generatePortfolioSummary,
} from '../../lib/portfolioAnalytics';
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
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  Activity,
  AlertTriangle,
  Target,
  DollarSign,
} from 'lucide-react';
import Card, { StatCard } from './Card';

const CHART_COLORS = [
  '#00d4ff',
  '#00ff88',
  '#ff6b6b',
  '#ffd93d',
  '#a78bfa',
  '#fb923c',
  '#ec4899',
  '#14b8a6',
];

// Helper component for section panels
function Panel({ title, children, style = {} }) {
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
      {title && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {title}
        </div>
      )}
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  );
}

export default function PortfolioValue() {
  const {
    accountData,
    connectedAddress,
    network,
    prices,
    setPrices,
    pricesLoading,
    setPricesLoading,
    setPricesError,
  } = useStore();
  const [activeView, setActiveView] = useState('overview'); // overview, allocation, performance, risk
  const [historicalData, setHistoricalData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const balances = accountData?.balances || [];

  // Determine which asset codes we need prices for
  const assetCodes = useMemo(() => {
    return balances.map((b) => (b.asset_type === 'native' ? 'XLM' : b.asset_code)).filter(Boolean);
  }, [balances]);

  useEffect(() => {
    if (assetCodes.length === 0) return;
    let cancelled = false;

    const load = async () => {
      setPricesLoading(true);
      try {
        const fetched = await fetchPrices(assetCodes);
        if (!cancelled) setPrices({ ...prices, ...fetched });
      } catch (err) {
        if (!cancelled) setPricesError(err.message);
      } finally {
        if (!cancelled) setPricesLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [assetCodes.join(',')]);
  const handleRefreshPrices = async () => {
    if (assetCodes.length === 0) return;

    setPricesLoading(true);
    try {
      const fetched = await refreshPrices(assetCodes);
      setPrices({ ...prices, ...fetched });
    } catch (err) {
      setPricesError(err.message);
    } finally {
      setPricesLoading(false);
    }
  };

  const portfolio = useMemo(() => calculatePortfolioValue(balances, prices), [balances, prices]);

  // Async pipeline for historical reconstruction
  useEffect(() => {
    if (!connectedAddress || !portfolio || !portfolio.items?.length) return;

    let cancelled = false;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const currentBalancesMap = {}
        portfolio.items.forEach(item => { currentBalancesMap[item.code] = item.amount })

        const server = getServer(network)
        const history = await fetchHistoricalPerformance(server, connectedAddress, currentBalancesMap, 30)
        
        if (!cancelled) setHistoricalData(history)
      } catch (err) { console.error('History load failed', err) }
      finally { if (!cancelled) setHistoryLoading(false) }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [connectedAddress, network, portfolio?.items?.length]);

  // Analytics calculations
  const analytics = useMemo(() => {
    if (!portfolio || !portfolio.items || portfolio.items.length === 0) return null;

    // Value reconstructed snapshots using available price data
    const historicalPerformance = historicalData.map((point) => {
      let totalValue = 0;
      Object.entries(point.balances).forEach(([code, amount]) => {
        totalValue += amount * (prices[code]?.usd || 0);
      });
      return { ...point, value: totalValue };
    });

    const allocation = calculateAssetAllocation(portfolio.items);
    const diversificationScore = calculateDiversificationScore(allocation);
    const concentrationRisks = identifyConcentrationRisks(allocation);
    const change24h = calculate24hPortfolioChange(portfolio.items);
    const volatility = calculateVolatility(historicalPerformance);
    const riskAssessment = assessPortfolioRisk({
      volatility,
      diversificationScore,
      concentrationRisks,
    });
    const summary = generatePortfolioSummary(portfolio.items, historicalPerformance);

    return {
      allocation,
      diversificationScore,
      concentrationRisks,
      change24h,
      historicalPerformance,
      volatility,
      riskAssessment,
      summary,
    };
  }, [portfolio, historicalData, prices]);

  if (!accountData) {
    return (
      <Card title="Portfolio Analytics" subtitle="Connect an account to view">
        <div
          style={{
            padding: '32px 18px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
          }}
        >
          No account connected
        </div>
      </Card>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: DollarSign },
    { id: 'allocation', label: 'Allocation', icon: PieChartIcon },
    { id: 'performance', label: 'Performance', icon: Activity },
    { id: 'risk', label: 'Risk', icon: AlertTriangle },
  ];

  return (
    <Card title="Portfolio Analytics" subtitle="Comprehensive portfolio analysis">
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleRefreshPrices}
            disabled={pricesLoading || assetCodes.length === 0}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              cursor: pricesLoading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {pricesLoading ? 'Refreshing prices...' : 'Refresh prices'}
          </button>
        </div>
        {/* View Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '12px',
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: isActive ? 'var(--cyan-dim)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--cyan)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'var(--cyan)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.borderColor = 'var(--cyan-dim)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {(pricesLoading || historyLoading) && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div className="spinner" />
          </div>
        )}

        {!pricesLoading && activeView === 'overview' && (
          <OverviewView portfolio={portfolio} analytics={analytics} />
        )}

        {!pricesLoading && activeView === 'allocation' && analytics && (
          <AllocationView analytics={analytics} />
        )}

        {!pricesLoading && activeView === 'performance' && analytics && (
          <PerformanceView analytics={analytics} portfolio={portfolio} />
        )}

        {!pricesLoading && activeView === 'risk' && analytics && <RiskView analytics={analytics} />}
      </div>
    </Card>
  );
}

// ─── Overview View ────────────────────────────────────────────────────────────

function OverviewView({ portfolio, analytics }) {
  if (!portfolio || !analytics) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
        No data available
      </div>
    );
  }

  const { totalUsd, items } = portfolio;
  const { change24h, diversificationScore, riskAssessment } = analytics;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Key Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        <StatCard
          label="Total Value"
          value={`$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          accent="var(--cyan)"
        />
        <StatCard
          label="24h Change"
          value={change24h !== null ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%` : '—'}
          sub={change24h !== null ? (change24h >= 0 ? 'Gain' : 'Loss') : ''}
          accent={change24h >= 0 ? 'var(--green)' : 'var(--red)'}
        />
        <StatCard
          label="Diversification"
          value={`${diversificationScore.toFixed(1)}/10`}
          sub={
            diversificationScore >= 7
              ? 'Well diversified'
              : diversificationScore >= 4
                ? 'Moderate'
                : 'Concentrated'
          }
          accent="var(--purple)"
        />
        <StatCard
          label="Risk Level"
          value={riskAssessment.level}
          sub={`Score: ${riskAssessment.score.toFixed(1)}/10`}
          accent={
            riskAssessment.level === 'Low'
              ? 'var(--green)'
              : riskAssessment.level === 'Medium'
                ? 'var(--yellow)'
                : 'var(--red)'
          }
        />
      </div>

      {/* Asset Holdings Table */}
      <Panel title="Asset Holdings">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
            padding: '8px 12px',
            fontSize: '10px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            borderBottom: '1px solid var(--border)',
            marginBottom: '8px',
          }}
        >
          <span>Asset</span>
          <span style={{ textAlign: 'right' }}>Balance</span>
          <span style={{ textAlign: 'right' }}>Price</span>
          <span style={{ textAlign: 'right' }}>Value</span>
          <span style={{ textAlign: 'right' }}>24h</span>
        </div>

        {items.map((item, i) => (
          <div
            key={item.code + i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
              padding: '10px 12px',
              fontSize: '12px',
              borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'var(--transition)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.code}</span>
            <span
              style={{
                textAlign: 'right',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {item.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </span>
            <span
              style={{
                textAlign: 'right',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {item.priceUsd !== null ? `$${item.priceUsd.toFixed(4)}` : '—'}
            </span>
            <span
              style={{ textAlign: 'right', color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}
            >
              {item.valueUsd !== null ? `$${item.valueUsd.toFixed(2)}` : '—'}
            </span>
            <span
              style={{
                textAlign: 'right',
                color:
                  item.change24h !== null
                    ? item.change24h >= 0
                      ? 'var(--green)'
                      : 'var(--red)'
                    : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '4px',
              }}
            >
              {item.change24h !== null ? (
                <>
                  {item.change24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {item.change24h.toFixed(2)}%
                </>
              ) : (
                '—'
              )}
            </span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

// ─── Allocation View ──────────────────────────────────────────────────────────

function AllocationView({ analytics }) {
  const { allocation, concentrationRisks } = analytics;

  const pieData = allocation.map((a) => ({
    name: a.asset,
    value: a.percentage,
    valueUsd: a.valueUsd,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Pie Chart */}
      <Panel title="Asset Allocation">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            alignItems: 'center',
          }}
        >
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} ${value.toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                }}
                formatter={(value, name, props) => [
                  `${value.toFixed(2)}% ($${props.payload.valueUsd.toFixed(2)})`,
                  props.payload.name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allocation.map((item, i) => (
              <div
                key={item.asset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    background: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.asset}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    ${item.valueUsd.toFixed(2)}
                  </div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cyan)' }}>
                  {item.percentage.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Concentration Risks */}
      {concentrationRisks.length > 0 && (
        <Panel title="Concentration Risks">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {concentrationRisks.map((risk, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--yellow-dim)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <AlertTriangle size={16} style={{ color: 'var(--yellow)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {risk.asset}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{risk.message}</div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--yellow)' }}>
                  {risk.percentage.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ─── Performance View ─────────────────────────────────────────────────────────

function PerformanceView({ analytics, portfolio }) {
  const { historicalPerformance, change24h } = analytics;
  const { items } = portfolio;

  // Prepare data for individual asset performance
  const assetPerformance = items
    .filter((item) => item.change24h !== null)
    .map((item) => ({
      asset: item.code,
      change: item.change24h,
      value: item.valueUsd,
    }))
    .sort((a, b) => b.change - a.change);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Historical Performance Chart */}
      <Panel
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Portfolio Value (30 Days)
            <div
              title="Network history truncation and Horizon pagination limits may affect data older than 30 days."
              style={{ cursor: 'help', opacity: 0.7 }}
            >
              <AlertTriangle size={12} />
            </div>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={historicalPerformance}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" stroke="var(--text-muted)" style={{ fontSize: '11px' }} />
            <YAxis
              stroke="var(--text-muted)"
              style={{ fontSize: '11px' }}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
              }}
              formatter={(value) => [`$${value.toFixed(2)}`, 'Value']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--cyan)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      {/* Asset Performance Bars */}
      <Panel title="24h Asset Performance">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={assetPerformance} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              type="number"
              stroke="var(--text-muted)"
              style={{ fontSize: '11px' }}
              tickFormatter={(value) => `${value.toFixed(1)}%`}
            />
            <YAxis
              type="category"
              dataKey="asset"
              stroke="var(--text-muted)"
              style={{ fontSize: '11px' }}
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
              }}
              formatter={(value, name, props) => [
                `${value.toFixed(2)}% ($${props.payload.value.toFixed(2)})`,
                'Change',
              ]}
            />
            <Bar dataKey="change" fill="var(--cyan)">
              {assetPerformance.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.change >= 0 ? 'var(--green)' : 'var(--red)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

// ─── Risk View ────────────────────────────────────────────────────────────────

function RiskView({ analytics }) {
  const { riskAssessment, diversificationScore, volatility } = analytics;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Risk Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        <StatCard
          label="Risk Level"
          value={riskAssessment.level}
          sub={`Score: ${riskAssessment.score.toFixed(1)}/10`}
          accent={
            riskAssessment.level === 'Low'
              ? 'var(--green)'
              : riskAssessment.level === 'Medium'
                ? 'var(--yellow)'
                : 'var(--red)'
          }
        />
        <StatCard
          label="Diversification"
          value={`${diversificationScore.toFixed(1)}/10`}
          sub={
            diversificationScore >= 7
              ? 'Well diversified'
              : diversificationScore >= 4
                ? 'Moderate'
                : 'Concentrated'
          }
          accent="var(--purple)"
        />
        <StatCard
          label="Volatility"
          value={`${volatility.toFixed(2)}%`}
          sub={volatility < 5 ? 'Low' : volatility < 15 ? 'Moderate' : 'High'}
          accent="var(--orange)"
        />
      </div>

      {/* Risk Assessment Details */}
      <Panel title="Risk Assessment">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {riskAssessment.factors.map((factor, i) => (
            <div
              key={i}
              style={{
                padding: '12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '4px',
                }}
              >
                {factor.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {factor.description}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Recommendations */}
      {riskAssessment.recommendations && riskAssessment.recommendations.length > 0 && (
        <Panel title="Recommendations">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {riskAssessment.recommendations.map((rec, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--cyan-dim)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <Target
                  size={14}
                  style={{ color: 'var(--cyan)', marginTop: '2px', flexShrink: 0 }}
                />
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {rec}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
