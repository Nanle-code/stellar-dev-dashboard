import React, { useState, useMemo } from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, Wallet, ArrowRightLeft } from 'lucide-react';
import {
  getSandboxAccounts,
  getSandboxTrades,
  calculateTradeMetrics,
  calculatePortfolioMetrics,
  type SandboxAccountFilter,
  type SandboxTradeQuery,
  type AccountArchetype,
  type TradeType,
  SandboxDatasetError,
} from '../../lib/sandboxAnalytics';
import { SAMPLE_SANDBOX_ACCOUNTS } from '../../fixtures/sandboxDatasets';

export default function SandboxAnalyticsDemo() {
  const [selectedArchetype, setSelectedArchetype] = useState<AccountArchetype>('retail_active');
  const [selectedPair, setSelectedPair] = useState<'XLM_USDC' | 'AQUA_XLM' | 'BTC_USDC'>(
    'XLM_USDC'
  );
  const [tradeTypeFilter, setTradeTypeFilter] = useState<'all' | TradeType>('all');
  const [demoError, setDemoError] = useState<string | null>(null);

  // Load account
  const accounts = useMemo(() => {
    try {
      const filter: SandboxAccountFilter = selectedArchetype
        ? { archetype: selectedArchetype }
        : {};
      return getSandboxAccounts(filter, { environment: 'sandbox' });
    } catch (err) {
      if (err instanceof SandboxDatasetError) {
        setDemoError(err.message);
      }
      return SAMPLE_SANDBOX_ACCOUNTS;
    }
  }, [selectedArchetype]);

  const activeAccount = accounts[0] || SAMPLE_SANDBOX_ACCOUNTS[0];

  // Portfolio metrics
  const portfolioMetrics = useMemo(() => {
    return calculatePortfolioMetrics(activeAccount);
  }, [activeAccount]);

  // Load trades for selected pair
  const trades = useMemo(() => {
    try {
      const query: SandboxTradeQuery = {
        tradeType: tradeTypeFilter === 'all' ? undefined : tradeTypeFilter,
      };

      if (selectedPair === 'XLM_USDC') {
        query.baseAsset = 'XLM';
        query.counterAsset = 'USDC';
      } else if (selectedPair === 'AQUA_XLM') {
        query.baseAsset = 'AQUA';
        query.counterAsset = 'XLM';
      } else if (selectedPair === 'BTC_USDC') {
        query.baseAsset = 'BTC';
        query.counterAsset = 'USDC';
      }

      return getSandboxTrades(query, { environment: 'sandbox' });
    } catch (err) {
      if (err instanceof SandboxDatasetError) {
        setDemoError(err.message);
      }
      return [];
    }
  }, [selectedPair, tradeTypeFilter]);

  // Market analytics metrics
  const tradeMetrics = useMemo(() => {
    return calculateTradeMetrics(trades);
  }, [trades]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '16px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 20px',
          background:
            'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(167, 139, 250, 0.08) 100%)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2
              style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}
            >
              Sandbox Analytics Demos
            </h2>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            >
              <ShieldCheck size={12} /> No Mainnet Credentials Required
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Anonymized Stellar Horizon account and DEX trade datasets for offline education,
            testing, and portfolio analytics demos.
          </p>
        </div>

        <button
          onClick={() => {
            setDemoError(null);
            setSelectedArchetype('retail_active');
            setSelectedPair('XLM_USDC');
            setTradeTypeFilter('all');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 'var(--radius-md, 8px)',
            background: 'var(--bg-elevated, #1e293b)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <RefreshCw size={13} /> Reset Demo State
        </button>
      </div>

      {demoError && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md, 8px)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '13px',
          }}
        >
          <AlertTriangle size={16} />
          <span>{demoError}</span>
        </div>
      )}

      {/* Account Archetype Selection */}
      <div
        style={{
          background: 'var(--bg-card, #111827)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={18} color="var(--primary, #00d4ff)" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              1. Select Account Archetype
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Anonymized Synthetic Public Key
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {SAMPLE_SANDBOX_ACCOUNTS.map((acc) => {
            const isSelected = acc.archetype === selectedArchetype;
            return (
              <button
                key={acc.id}
                onClick={() => setSelectedArchetype(acc.archetype)}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: isSelected
                    ? 'rgba(0, 212, 255, 0.08)'
                    : 'var(--bg-elevated, #1e293b)',
                  border: `1px solid ${isSelected ? 'var(--primary, #00d4ff)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '13px',
                    color: isSelected ? 'var(--primary, #00d4ff)' : 'var(--text-primary)',
                  }}
                >
                  {acc.displayName}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
                  {acc.description}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                  {acc.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Account Detail & Metrics */}
        {activeAccount && (
          <div
            style={{
              marginTop: 18,
              padding: '14px',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--bg-elevated, #1e293b)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Public Address
                </span>
                <div
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {activeAccount.id}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Estimated Portfolio
                  </span>
                  <div
                    style={{ fontSize: '15px', fontWeight: 700, color: 'var(--success, #22c55e)' }}
                  >
                    ${portfolioMetrics.totalValueUsd.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Diversification
                  </span>
                  <div
                    style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary, #00d4ff)' }}
                  >
                    {portfolioMetrics.diversificationScore}/100
                  </div>
                </div>
              </div>
            </div>

            {/* Asset breakdown */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {portfolioMetrics.allocations.map((item) => (
                <div
                  key={item.code}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border)',
                    fontSize: '11px',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.code}:{' '}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {item.amount.toLocaleString()} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Market Pair & Trade Analytics */}
      <div
        style={{
          background: 'var(--bg-card, #111827)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowRightLeft size={18} color="var(--amber, #f59e0b)" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              2. DEX Trade Flow & Market Analytics
            </h3>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={selectedPair}
              onChange={(e) => setSelectedPair(e.target.value as any)}
              style={{
                background: 'var(--bg-elevated, #1e293b)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <option value="XLM_USDC">XLM / USDC</option>
              <option value="AQUA_XLM">AQUA / XLM</option>
              <option value="BTC_USDC">BTC / USDC</option>
            </select>

            <select
              value={tradeTypeFilter}
              onChange={(e) => setTradeTypeFilter(e.target.value as any)}
              style={{
                background: 'var(--bg-elevated, #1e293b)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Trade Types</option>
              <option value="orderbook">Orderbook</option>
              <option value="liquidity_pool">Liquidity Pool (AMM)</option>
            </select>
          </div>
        </div>

        {/* Analytics KPI Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              padding: '12px',
              background: 'var(--bg-elevated, #1e293b)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Trade Count</div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginTop: 4 }}>
              {tradeMetrics.tradeCount}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: 2 }}>
              {tradeMetrics.orderbookCount} book / {tradeMetrics.liquidityPoolCount} AMM
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              background: 'var(--bg-elevated, #1e293b)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>VWAP (Avg Price)</div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginTop: 4 }}>
              ${tradeMetrics.vwap.toFixed(5)}
            </div>
            <div
              style={{
                fontSize: '10px',
                color: tradeMetrics.priceChange >= 0 ? '#22c55e' : '#ef4444',
                marginTop: 2,
              }}
            >
              {tradeMetrics.priceChange >= 0 ? '+' : ''}
              {tradeMetrics.priceChangePercent}%
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              background: 'var(--bg-elevated, #1e293b)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Base Volume</div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginTop: 4 }}>
              {tradeMetrics.totalVolumeBase.toLocaleString()}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: 2 }}>
              Buy: {tradeMetrics.buyVolume.toLocaleString()}
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              background: 'var(--bg-elevated, #1e293b)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Counter Volume</div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginTop: 4 }}>
              ${tradeMetrics.totalVolumeCounter.toLocaleString()}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: 2 }}>
              Sell: {tradeMetrics.sellVolume.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Trades Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border)',
                  textAlign: 'left',
                  color: 'var(--text-muted)',
                }}
              >
                <th style={{ padding: '8px 10px' }}>Time (UTC)</th>
                <th style={{ padding: '8px 10px' }}>Type</th>
                <th style={{ padding: '8px 10px' }}>Base Amount</th>
                <th style={{ padding: '8px 10px' }}>Price</th>
                <th style={{ padding: '8px 10px' }}>Counter Value</th>
                <th style={{ padding: '8px 10px' }}>Side</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}
                  >
                    No trades match the current filter.
                  </td>
                </tr>
              ) : (
                trades.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>
                      {t.ledger_close_time.replace('2026-09-25T', '').replace('Z', '')}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          background:
                            t.trade_type === 'liquidity_pool'
                              ? 'rgba(167, 139, 250, 0.15)'
                              : 'rgba(0, 212, 255, 0.15)',
                          color: t.trade_type === 'liquidity_pool' ? '#a78bfa' : '#00d4ff',
                        }}
                      >
                        {t.trade_type === 'liquidity_pool' ? 'AMM Pool' : 'Orderbook'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>
                      {parseFloat(t.base_amount).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>
                      ${parseFloat(t.price_r).toFixed(5)}
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)' }}>
                      ${parseFloat(t.counter_amount).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{ color: t.base_is_seller ? '#ef4444' : '#22c55e', fontWeight: 600 }}
                      >
                        {t.base_is_seller ? 'SELL' : 'BUY'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
