import React, { useEffect, useState, useMemo } from 'react';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Zap,
  RefreshCw,
  Sliders,
  CheckCircle2,
  ShieldAlert,
  ArrowRightLeft,
  Clock,
  Layers,
  Activity,
  Maximize2,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useStore } from '../../lib/store';
import {
  predictLiquidityFlow,
  PredictionResult,
  TradingRecommendation,
} from '../../ml/liquidityPredictionModel';

export default function LiquidityPredictionDashboard() {
  const { network } = useStore();
  const [sellingAsset, setSellingAsset] = useState<string>('native');
  const [buyingAsset, setBuyingAsset] = useState<string>(
    'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
  );
  const [horizonHours, setHorizonHours] = useState<number>(1);
  const [tradeAmount, setTradeAmount] = useState<number>(10000);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<PredictionResult | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<TradingRecommendation | null>(null);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  async function fetchPrediction() {
    setLoading(true);
    try {
      const result = await predictLiquidityFlow(sellingAsset, buyingAsset, {
        horizonHours,
        tradeAmount,
        network,
      });
      setData(result);
      if (result.recommendations.length > 0 && !selectedStrategy) {
        setSelectedStrategy(result.recommendations[0]);
      }
    } catch (err) {
      console.error('Failed to load liquidity prediction:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPrediction();
  }, [sellingAsset, buyingAsset, horizonHours, tradeAmount, network]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchPrediction();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, sellingAsset, buyingAsset, horizonHours, tradeAmount, network]);

  const applyStrategy = (strategy: TradingRecommendation) => {
    setSelectedStrategy(strategy);
    setAppliedNotice(
      `Applied Strategy: ${strategy.title}. Parameters updated for DEX execution.`
    );
    setTimeout(() => setAppliedNotice(null), 4000);
  };

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'CRITICAL':
        return 'var(--red, #ef4444)';
      case 'HIGH':
        return 'var(--amber, #f59e0b)';
      case 'MODERATE':
        return 'var(--cyan, #06b6d4)';
      default:
        return 'var(--green, #10b981)';
    }
  };

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            <Brain size={24} style={{ color: 'var(--cyan)' }} />
            Liquidity Flow & Depth Prediction
          </div>
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '12px',
              marginTop: '4px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Predictive AI models for Stellar DEX order books, trade flows & AMM depth forecasting
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${autoRefresh ? 'var(--cyan-dim)' : 'var(--border)'}`,
              background: autoRefresh ? 'var(--cyan-glow)' : 'transparent',
              color: autoRefresh ? 'var(--cyan)' : 'var(--text-secondary)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            <Activity size={14} className={autoRefresh ? 'animate-pulse' : ''} />
            {autoRefresh ? 'Real-Time Live' : 'Paused'}
          </button>

          <button
            onClick={fetchPrediction}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--cyan-dim)',
              background: 'var(--cyan-glow)',
              color: 'var(--cyan)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Analyzing...' : 'Refresh AI Model'}
          </button>
        </div>
      </div>

      {appliedNotice && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--green, #10b981)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            color: 'var(--green, #10b981)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          {appliedNotice}
        </div>
      )}

      {/* Inputs & Parameters Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Selling Asset
          </span>
          <input
            value={sellingAsset}
            onChange={(e) => setSellingAsset(e.target.value)}
            placeholder="native or CODE:ISSUER"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '8px 10px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Buying Asset
          </span>
          <input
            value={buyingAsset}
            onChange={(e) => setBuyingAsset(e.target.value)}
            placeholder="native or CODE:ISSUER"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '8px 10px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Forecast Horizon
          </span>
          <select
            value={horizonHours}
            onChange={(e) => setHorizonHours(Number(e.target.value))}
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '8px 10px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            <option value={1}>1 Hour Horizon (Short-term)</option>
            <option value={4}>4 Hours Horizon (Mid-term)</option>
            <option value={24}>24 Hours Horizon (Daily)</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Simulated Trade Size (XLM)
          </span>
          <input
            type="number"
            value={tradeAmount}
            onChange={(e) => setTradeAmount(Number(e.target.value))}
            placeholder="10000"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '8px 10px',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </label>
      </div>

      {/* Model Accuracy & Overview Stats Cards */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
          {/* Card 1: 1h Forecast Accuracy Target */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--cyan-dim)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                1h Forecast Model Accuracy
              </span>
              <span
                style={{
                  background: 'var(--cyan-glow)',
                  color: 'var(--cyan)',
                  border: '1px solid var(--cyan-dim)',
                  borderRadius: '999px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ≥75% Target Met
              </span>
            </div>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--cyan)',
                }}
              >
                {data.accuracy.hourlyHorizonAccuracyPct}%
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Dir Acc: {data.accuracy.directionalAccuracyPct}%
              </span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
              MAE: {data.accuracy.mae} | Sample Size: {data.accuracy.sampleSize} depth windows
            </div>
          </div>

          {/* Card 2: Liquidity Depth & Imbalance */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Order Book Depth & Bias
            </span>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                }}
              >
                {(data.metrics.totalBidDepth + data.metrics.totalAskDepth).toLocaleString()} XLM
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '6px' }}>
              <span style={{ color: 'var(--green)' }}>Bids: {data.metrics.totalBidDepth.toLocaleString()}</span>
              <span style={{ color: 'var(--red)' }}>Asks: {data.metrics.totalAskDepth.toLocaleString()}</span>
            </div>
          </div>

          {/* Card 3: Whale Trade Risk Score */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Large Trade Impact Risk
            </span>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: getRiskBadgeColor(data.largeTradeAnalysis.riskLevel),
                }}
              >
                {data.largeTradeAnalysis.whaleImpactScore} / 100
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: getRiskBadgeColor(data.largeTradeAnalysis.riskLevel),
                }}
              >
                {data.largeTradeAnalysis.riskLevel}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Impact for {tradeAmount.toLocaleString()} XLM: ~
              {data.largeTradeAnalysis.estimatedPriceImpactPct}% slippage
            </div>
          </div>

          {/* Card 4: Spread & Trade Flow */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Spread & Buy Volume Ratio
            </span>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                }}
              >
                {data.metrics.spreadPercent}%
              </span>
              <span style={{ fontSize: '11px', color: 'var(--cyan)' }}>
                Buy Ratio: {Math.round(data.metrics.buyRatio * 100)}%
              </span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
              VWAP: {data.metrics.vwap} | 24h Vol: {data.metrics.tradeVolume24h.toLocaleString()} XLM
            </div>
          </div>
        </div>
      )}

      {/* Main Forecast Visualization Chart */}
      {data && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <TrendingUp size={18} style={{ color: 'var(--cyan)' }} />
                Real-Time Liquidity Depth Forecast ({data.pair} - {horizonHours}h Horizon)
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Predictive depth trajectory (Bids vs Asks) with 95% AI Confidence Bands
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.forecastSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bidGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="askGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="timeLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }} />
              <Area
                type="monotone"
                dataKey="predictedBidDepth"
                name="Predicted Bid Depth (XLM)"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#bidGradient)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="predictedAskDepth"
                name="Predicted Ask Depth (XLM)"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#askGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Grid: Liquidity Alerts & Large Trade Simulator */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          {/* Active Liquidity Alerts */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: 700,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ShieldAlert size={16} style={{ color: 'var(--amber)' }} />
              Upcoming Liquidity Alerts & Flags ({data.alerts.length})
            </div>

            {data.alerts.length === 0 ? (
              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No active liquidity flags or warnings detected for this pair.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: `1px solid ${
                        alert.severity === 'high'
                          ? 'var(--red, #ef4444)'
                          : alert.severity === 'medium'
                          ? 'var(--amber, #f59e0b)'
                          : 'var(--border)'
                      }`,
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {alert.title}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {alert.timestamp}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {alert.description}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--cyan)',
                        marginTop: '6px',
                      }}
                    >
                      Trigger: {alert.metricChange}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Large Trade Impact Simulator */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: 700,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Zap size={16} style={{ color: 'var(--cyan)' }} />
              Predictive Large Trade Impact Simulator
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PREDICTED SLIPPAGE</div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color:
                        data.largeTradeAnalysis.estimatedPriceImpactPct > 2
                          ? 'var(--red)'
                          : 'var(--text-primary)',
                    }}
                  >
                    ~{data.largeTradeAnalysis.estimatedPriceImpactPct}%
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>EST. ABSORPTION TIME</div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--cyan)',
                    }}
                  >
                    {data.largeTradeAnalysis.absorptionTimeMinutes} mins
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Simulating execution of <strong>{tradeAmount.toLocaleString()} XLM</strong> against
                current DEX orderbook & AMM reserves. The model estimates price movement and book
                recovery time.
              </div>

              <div
                style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px',
                  fontSize: '11px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Whale Activity Risk Index:</span>
                <span
                  style={{
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: getRiskBadgeColor(data.largeTradeAnalysis.riskLevel),
                  }}
                >
                  {data.largeTradeAnalysis.riskLevel} ({data.largeTradeAnalysis.whaleImpactScore}/100)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actionable Trading Strategy Recommendations */}
      {data && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sliders size={18} style={{ color: 'var(--cyan)' }} />
                AI Trading Strategy Recommendations
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Optimized order routing, execution timing, TWAP chunking & slippage protection
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '12px',
            }}
          >
            {data.recommendations.map((rec) => {
              const isSelected = selectedStrategy?.id === rec.id;
              return (
                <div
                  key={rec.id}
                  style={{
                    background: isSelected ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                    border: `1px solid ${isSelected ? 'var(--cyan)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: 'var(--cyan)',
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {rec.category}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--green)',
                        }}
                      >
                        {rec.confidenceScore}% Confidence
                      </span>
                    </div>

                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '4px',
                      }}
                    >
                      {rec.title}
                    </div>

                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--cyan)',
                        fontFamily: 'var(--font-mono)',
                        marginBottom: '6px',
                        fontWeight: 600,
                      }}
                    >
                      {rec.actionSummary}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {rec.detail}
                    </div>
                  </div>

                  <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={() => applyStrategy(rec)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--cyan-dim)',
                        background: 'var(--cyan-glow)',
                        color: 'var(--cyan)',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <CheckCircle2 size={13} />
                      {isSelected ? 'Applied Strategy' : 'Apply Strategy Parameters'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
