import React, { useEffect, useState } from 'react';
import { TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { useStore } from '../../lib/store';
import { fetchDefiOverview, buildYieldStrategies } from '../../lib/defiAnalytics';

type Risk = 'Low' | 'Medium' | 'High';

interface Strategy {
  label: string;
  apy: number;
  risk: { score: number; label: string };
  assets: string[];
  pool: Record<string, unknown>;
}

function fmt(n: number, d = 2) { return n.toLocaleString('en-US', { maximumFractionDigits: d }); }
function riskBadge(label: string) {
  const colors: Record<string, string> = { Low: '#22c55e', Medium: '#f59e0b', High: '#ef4444' };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px',
      borderRadius: 4, background: `${colors[label] ?? '#888'}22`, color: colors[label] ?? '#888',
      textTransform: 'uppercase',
    }}>{label}</span>
  );
}

export default function YieldFarming() {
  const { network } = useStore();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maxRisk, setMaxRisk] = useState<Risk>('Medium');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const pools = await fetchDefiOverview(network, 100);
      setStrategies(buildYieldStrategies(pools, maxRisk) as Strategy[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load strategies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [network, maxRisk]); // eslint-disable-line

  return (
    <section aria-labelledby="yf-title">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 id="yf-title" style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={18} /> Yield Farming Strategies
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Max Risk:{' '}
            <select
              value={maxRisk}
              onChange={(e) => setMaxRisk(e.target.value as Risk)}
              style={{
                marginLeft: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '4px 8px', fontSize: 12,
              }}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </label>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh strategies"
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '6px 10px', cursor: 'pointer',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {!loading && strategies.length === 0 && !error && (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No strategies found for the selected risk level.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {strategies.map((s, i) => (
          <div
            key={i}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '14px 18px',
              display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 16,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {s.assets.join(' / ')} · Risk score: {s.risk.score}/100
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>EST. APY</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: '#22c55e' }}>
                {fmt(s.apy, 1)}%
              </div>
            </div>
            <div>{riskBadge(s.risk.label)}</div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 20 }}>
        * APY estimates are based on 7-day average trading volume and 0.30% pool fees. Actual returns may vary.
        Always consider impermanent loss risk before providing liquidity.
      </p>
    </section>
  );
}
