import React, { useEffect, useState } from 'react';
import { Sliders, CheckCircle, AlertTriangle } from 'lucide-react';
import { useStore } from '../../lib/store';
import { suggestRebalancing } from '../../lib/defiAnalytics';
import { fetchPrices, calculatePortfolioValue } from '../../lib/priceFeed';
import { getServer } from '../../lib/stellar';

interface Suggestion {
  asset: string;
  action: 'buy' | 'sell';
  amount: number;
  currentPct: number;
  targetPct: number;
}

function fmt(n: number, d = 2) { return n.toLocaleString('en-US', { maximumFractionDigits: d }); }

const DEFAULT_TARGETS: Record<string, number> = { XLM: 0.5, USDC: 0.3, AQUA: 0.2 };

export default function PortfolioRebalancer() {
  const { connectedAddress, network } = useStore();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [targetInput, setTargetInput] = useState(
    Object.entries(DEFAULT_TARGETS).map(([a, w]) => `${a}:${(w * 100).toFixed(0)}`).join(', ')
  );
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalWeight, setTotalWeight] = useState(100);

  function parseTargets(input: string) {
    const map: Record<string, number> = {};
    let sum = 0;
    for (const part of input.split(',')) {
      const [asset, pct] = part.trim().split(':');
      if (asset && pct) {
        const w = parseFloat(pct) / 100;
        if (!isNaN(w) && w > 0) { map[asset.trim()] = w; sum += w; }
      }
    }
    setTotalWeight(Math.round(sum * 100));
    return map;
  }

  async function analyze() {
    if (!connectedAddress) { setError('Connect an account first.'); return; }
    setLoading(true);
    setError('');
    try {
      const server = getServer(network);
      const account = await server.loadAccount(connectedAddress);
      const assetCodes = account.balances.map((b: Record<string, string>) =>
        b.asset_type === 'native' ? 'XLM' : b.asset_code
      );
      const prices = await fetchPrices(assetCodes);
      const portfolio = calculatePortfolioValue(account.balances, prices);
      const holdings = (portfolio?.items || []).map((item: Record<string, unknown>) => ({
        asset: item.code as string,
        value: (item.valueUsd as number) ?? 0,
      })).filter((h: { value: number }) => h.value > 0);
      const t = parseTargets(targetInput);
      setTargets(t);
      setSuggestions(suggestRebalancing(holdings, t) as Suggestion[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to analyze portfolio');
    } finally {
      setLoading(false);
    }
  }

  const actionColor = (a: string) => a === 'buy' ? '#22c55e' : '#ef4444';

  return (
    <section aria-labelledby="rebalancer-title">
      <h2 id="rebalancer-title" style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sliders size={18} /> Portfolio Rebalancer
      </h2>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Target Allocation</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Enter comma-separated ASSET:PERCENT pairs (e.g. <code>XLM:50, USDC:30, AQUA:20</code>)
        </p>
        <textarea
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value)}
          rows={2}
          style={{
            width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '8px 10px',
            fontSize: 13, fontFamily: 'var(--font-mono)', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button
            onClick={analyze}
            disabled={loading || !connectedAddress}
            style={{
              background: 'var(--cyan, #06b6d4)', color: '#0a0a0a', border: 'none',
              borderRadius: 'var(--radius-sm)', padding: '8px 18px', fontWeight: 700, cursor: 'pointer',
              opacity: loading || !connectedAddress ? 0.6 : 1, fontSize: 13,
            }}
          >
            {loading ? 'Analyzing…' : 'Analyze & Suggest'}
          </button>
          {totalWeight !== 100 && (
            <span style={{ fontSize: 12, color: '#f59e0b' }}>⚠ Weights sum to {totalWeight}% (should be 100%)</span>
          )}
        </div>
        {error && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, marginTop: 12 }}>
            <AlertTriangle size={15} /> {error}
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20 }}>
          <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Suggested Rebalancing Trades
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {suggestions.map((s) => (
              <div
                key={s.asset}
                style={{
                  display: 'grid', gridTemplateColumns: '24px 1fr auto auto',
                  alignItems: 'center', gap: 12,
                  background: approved[s.asset] ? 'rgba(34,197,94,0.06)' : 'var(--bg-elevated)',
                  border: `1px solid ${approved[s.asset] ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                }}
              >
                <input
                  type="checkbox"
                  checked={!!approved[s.asset]}
                  onChange={(e) => setApproved((prev) => ({ ...prev, [s.asset]: e.target.checked }))}
                  aria-label={`Approve ${s.action} ${s.asset}`}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.asset}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                    {fmt(s.currentPct)}% → {fmt(s.targetPct)}%
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  ${fmt(s.amount)}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: `${actionColor(s.action)}22`, color: actionColor(s.action),
                  textTransform: 'uppercase',
                }}>
                  {s.action}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              disabled={!Object.values(approved).some(Boolean)}
              style={{
                background: 'var(--cyan, #06b6d4)', color: '#0a0a0a', border: 'none',
                borderRadius: 'var(--radius-sm)', padding: '8px 18px', fontWeight: 700, cursor: 'pointer',
                opacity: !Object.values(approved).some(Boolean) ? 0.5 : 1, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <CheckCircle size={14} /> Execute Approved ({Object.values(approved).filter(Boolean).length})
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              * Review and approve individual trades before execution
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
