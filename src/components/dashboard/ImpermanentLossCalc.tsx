import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Calculator } from 'lucide-react';
import { calculateImpermanentLoss, buildILCurve } from '../../lib/defiAnalytics';

function fmt(n: number, d = 2) { return n.toLocaleString('en-US', { maximumFractionDigits: d }); }

export default function ImpermanentLossCalc() {
  const [depositA, setDepositA] = useState('1000');
  const [depositB, setDepositB] = useState('1000');
  const [currentA, setCurrentA] = useState('');
  const [currentB, setCurrentB] = useState('');

  const result = useMemo(() => {
    const dA = parseFloat(depositA) || 0;
    const dB = parseFloat(depositB) || 0;
    const cA = parseFloat(currentA) || dA;
    const cB = parseFloat(currentB) || dB;
    if (!dA || !dB || !cA || !cB) return null;
    const initialRatio = dA / dB;
    const currentRatio = cA / cB;
    const { ilPercent, poolValue } = calculateImpermanentLoss(initialRatio, currentRatio);
    const totalDeposit = dA + dB;
    const ilDollar = totalDeposit * (1 - poolValue);
    return { ilPercent, ilDollar, poolValue, holdValue: totalDeposit, poolTotal: totalDeposit * poolValue };
  }, [depositA, depositB, currentA, currentB]);

  const curve = useMemo(() => buildILCurve(40), []);

  const input = (label: string, val: string, set: (v: string) => void, ph = '') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
      <input
        type="number"
        value={val}
        onChange={(e) => set(e.target.value)}
        placeholder={ph}
        style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
          padding: '8px 10px', fontSize: 13, fontFamily: 'var(--font-mono)',
        }}
      />
    </label>
  );

  const riskColor = (pct: number) => pct < -5 ? '#ef4444' : pct < -2 ? '#f59e0b' : '#22c55e';

  return (
    <section aria-labelledby="il-title">
      <h2 id="il-title" style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Calculator size={18} /> Impermanent Loss Calculator
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Inputs */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20 }}>
          <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Deposit Prices (USD)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {input('Asset A price', depositA, setDepositA, 'e.g. 1000')}
            {input('Asset B price', depositB, setDepositB, 'e.g. 1000')}
          </div>
          <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '16px 0 12px' }}>Current Prices (USD)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {input('Asset A price', currentA, setCurrentA, 'Leave blank = same')}
            {input('Asset B price', currentB, setCurrentB, 'Leave blank = same')}
          </div>
        </div>

        {/* Result */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20 }}>
          <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Result</h3>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>IMPERMANENT LOSS</div>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-mono)', color: riskColor(result.ilPercent) }}>
                  {fmt(result.ilPercent, 3)}%
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Hold Value', `$${fmt(result.holdValue)}`],
                  ['Pool Value', `$${fmt(result.poolTotal)}`],
                  ['Loss (USD)', `−$${fmt(Math.abs(result.ilDollar))}`],
                  ['Pool Factor', fmt(result.poolValue, 4)],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-primary)' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Enter prices above to calculate.</div>
          )}
        </div>
      </div>

      {/* IL Curve */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20 }}>
        <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>IL vs Price Ratio Change</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={curve} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="priceMultiplier" tickFormatter={(v) => `${v}x`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <YAxis tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
              formatter={(v: number) => [`${v.toFixed(3)}%`, 'IL']}
              labelFormatter={(l) => `Price: ${l}x`}
            />
            <ReferenceLine x={1} stroke="var(--text-muted)" strokeDasharray="4 4" label={{ value: 'Entry', fill: 'var(--text-muted)', fontSize: 11 }} />
            <Line type="monotone" dataKey="ilPercent" stroke="#ef4444" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
