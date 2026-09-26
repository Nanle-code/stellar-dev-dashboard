import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { Activity, RefreshCw, AlertTriangle, TrendingUp, Shield } from 'lucide-react';
import { useStore } from '../../lib/store';
import { fetchDefiOverview, identifyProtocol } from '../../lib/defiAnalytics';
import ImpermanentLossCalc from './ImpermanentLossCalc';
import YieldFarming from './YieldFarming';
import PortfolioRebalancer from './PortfolioRebalancer';

type Tab = 'overview' | 'il' | 'yield' | 'rebalancer';

interface Pool {
  id: string;
  apy: number;
  risk: { score: number; label: string };
  reserves?: Array<{ asset?: string; asset_type?: string; amount?: string }>;
  totalValueXLM?: string | number;
  fee_bp?: number;
}

function fmt(n: number, d = 2) { return n.toLocaleString('en-US', { maximumFractionDigits: d }); }
function assetCode(asset?: string) {
  if (!asset || asset === 'native') return 'XLM';
  return asset.split(':')[0];
}
function riskColor(label: string) {
  const m: Record<string, string> = { Low: '#22c55e', Medium: '#f59e0b', High: '#ef4444' };
  return m[label] ?? '#888';
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Protocol Overview' },
  { id: 'yield', label: 'Yield Strategies' },
  { id: 'il', label: 'Impermanent Loss' },
  { id: 'rebalancer', label: 'Rebalancer' },
];

export default function DeFiAnalytics() {
  const { network } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDefiOverview(network, 50);
      setPools(data as Pool[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch DeFi data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (activeTab === 'overview') load(); }, [network, activeTab]); // eslint-disable-line

  const topPools = [...pools].sort((a, b) => b.apy - a.apy).slice(0, 10);
  const chartData = topPools.map((p) => ({
    name: (p.reserves || []).slice(0, 2).map((r) => assetCode(r.asset ?? r.asset_type)).join('/'),
    apy: +p.apy.toFixed(2),
    risk: p.risk.score,
  }));

  const stats = [
    { label: 'Protocols Tracked', value: pools.length, icon: <Activity size={16} /> },
    { label: 'Avg APY', value: pools.length ? `${fmt(pools.reduce((s, p) => s + p.apy, 0) / pools.length, 1)}%` : '—', icon: <TrendingUp size={16} /> },
    { label: 'Low Risk Pools', value: pools.filter((p) => p.risk.label === 'Low').length, icon: <Shield size={16} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={22} /> DeFi Analytics
        </h1>
        {activeTab === 'overview' && (
          <button
            onClick={load}
            disabled={loading}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '6px 12px', cursor: 'pointer',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            aria-selected={activeTab === t.id}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px',
              fontSize: 13, fontWeight: activeTab === t.id ? 700 : 400,
              color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === t.id ? '2px solid var(--cyan, #06b6d4)' : '2px solid transparent',
              transition: 'color 0.15s, border-bottom-color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {error && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13 }}>
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            {stats.map((s) => (
              <div key={s.label} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '16px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11, marginBottom: 8 }}>
                  {s.icon} {s.label}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* APY Chart */}
          {chartData.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20 }}>
              <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Top Pools by APY</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 16, bottom: 24, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} angle={-30} textAnchor="end" />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number) => [`${v}%`, 'APY']}
                  />
                  <Bar dataKey="apy" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pool Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Liquidity Pools</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {['Pool', 'Protocol', 'TVL (XLM)', 'Fee', 'Est. APY', 'Risk'].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading pools…</td></tr>
                  )}
                  {!loading && pools.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No pools found.</td></tr>
                  )}
                  {pools.map((pool) => {
                    const assets = (pool.reserves || []).map((r) => assetCode(r.asset ?? r.asset_type));
                    const protocol = identifyProtocol(assets[0]);
                    return (
                      <tr key={pool.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{assets.join('/')}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{protocol.name}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>{fmt(parseFloat(String(pool.totalValueXLM)) || 0, 0)}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>{pool.fee_bp ? `${pool.fee_bp / 100}%` : '0.30%'}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: '#22c55e', fontWeight: 700 }}>{fmt(pool.apy, 2)}%</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                            background: `${riskColor(pool.risk.label)}22`, color: riskColor(pool.risk.label),
                          }}>{pool.risk.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'yield' && <YieldFarming />}
      {activeTab === 'il' && <ImpermanentLossCalc />}
      {activeTab === 'rebalancer' && <PortfolioRebalancer />}
    </div>
  );
}
