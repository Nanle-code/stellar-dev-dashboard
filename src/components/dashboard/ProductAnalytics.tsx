import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrackEvent {
  id: string;
  name: string;
  count: number;
  trend: number;
  lastSeen: string;
  category: string;
}

interface FunnelStep {
  name: string;
  users: number;
  convRate: number;
  dropOff: number;
}

interface RetentionRow {
  cohort: string;
  size: number;
  weeks: number[];
}

interface FeatureFlag {
  id: string;
  name: string;
  usage: number;
  dau: number;
  enabled: boolean;
  variant?: string;
  experiment?: boolean;
}

interface ConsentItem {
  id: string;
  label: string;
  required: boolean;
  enabled: boolean;
}

// ─── Shared Components ────────────────────────────────────────────────────────

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', ...style }}>
    {children}
  </div>
);

const Badge = ({ label, color }: { label: string; color?: string }) => (
  <span style={{
    padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
    fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px',
    background: `${color ?? 'var(--cyan, #06b6d4)'}22`,
    color: color ?? 'var(--cyan, #06b6d4)',
    border: `1px solid ${color ?? 'var(--cyan, #06b6d4)'}55`,
  }}>{label}</span>
);

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div style={{ marginBottom: '20px' }}>
    <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{title}</div>
    {subtitle && <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>}
  </div>
);

const Stat = ({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) => (
  <Card style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '26px', fontWeight: 800, color: color ?? 'var(--cyan, #06b6d4)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '11px', color: sub.startsWith('+') ? '#22c55e' : '#ef4444', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{sub}</div>}
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{label}</div>
  </Card>
);

const MiniBar = ({ value, max, color }: { value: number; max: number; color?: string }) => (
  <div style={{ height: '6px', background: 'var(--bg-canvas)', borderRadius: '4px', overflow: 'hidden' }}>
    <div style={{ width: `${Math.min((value / max) * 100, 100)}%`, height: '100%', background: color ?? 'var(--cyan, #06b6d4)', borderRadius: '4px', transition: 'width 0.8s ease' }} />
  </div>
);

// ─── Mock Data ────────────────────────────────────────────────────────────────

const EVENTS: TrackEvent[] = [
  { id: 'e1', name: 'wallet_connected', count: 8420, trend: 12.3, lastSeen: '2s ago', category: 'auth' },
  { id: 'e2', name: 'transaction_sent', count: 5210, trend: -3.1, lastSeen: '8s ago', category: 'core' },
  { id: 'e3', name: 'page_viewed', count: 43200, trend: 5.7, lastSeen: '1s ago', category: 'navigation' },
  { id: 'e4', name: 'contract_deployed', count: 890, trend: 22.0, lastSeen: '3m ago', category: 'core' },
  { id: 'e5', name: 'faucet_requested', count: 2100, trend: 8.4, lastSeen: '15s ago', category: 'tools' },
  { id: 'e6', name: 'portfolio_viewed', count: 6730, trend: 14.2, lastSeen: '5s ago', category: 'analytics' },
  { id: 'e7', name: 'search_performed', count: 18900, trend: -1.8, lastSeen: '2s ago', category: 'navigation' },
  { id: 'e8', name: 'settings_changed', count: 1230, trend: 0.4, lastSeen: '2m ago', category: 'settings' },
];

const USER_PROPS = [
  { key: 'network', values: ['testnet (62%)', 'mainnet (28%)', 'futurenet (10%)'] },
  { key: 'wallet_type', values: ['Freighter (71%)', 'WalletConnect (19%)', 'Other (10%)'] },
  { key: 'country', values: ['US (34%)', 'DE (12%)', 'NG (9%)', 'Other (45%)'] },
  { key: 'plan', values: ['Free (81%)', 'Pro (19%)'] },
];

const FUNNELS: Record<string, FunnelStep[]> = {
  onboarding: [
    { name: 'Landed on App', users: 10000, convRate: 100, dropOff: 0 },
    { name: 'Connected Wallet', users: 6200, convRate: 62, dropOff: 38 },
    { name: 'Viewed Overview', users: 4800, convRate: 77.4, dropOff: 22.6 },
    { name: 'First Transaction', users: 2100, convRate: 43.7, dropOff: 56.3 },
    { name: 'Returned Next Day', users: 1400, convRate: 66.7, dropOff: 33.3 },
  ],
  transaction: [
    { name: 'Opened Builder', users: 5000, convRate: 100, dropOff: 0 },
    { name: 'Filled Form', users: 3800, convRate: 76, dropOff: 24 },
    { name: 'Signed TX', users: 3100, convRate: 81.6, dropOff: 18.4 },
    { name: 'Submitted', users: 2900, convRate: 93.5, dropOff: 6.5 },
    { name: 'Confirmed', users: 2850, convRate: 98.3, dropOff: 1.7 },
  ],
};

const RETENTION_DATA: RetentionRow[] = [
  { cohort: 'Jun W1', size: 1200, weeks: [100, 58, 44, 39, 35, 32, 30, 28] },
  { cohort: 'Jun W2', size: 980, weeks: [100, 61, 46, 41, 37, 34, 31] },
  { cohort: 'Jun W3', size: 1100, weeks: [100, 55, 42, 38, 34, 30] },
  { cohort: 'Jun W4', size: 890, weeks: [100, 63, 48, 43, 39] },
  { cohort: 'Jul W1', size: 1350, weeks: [100, 59, 45, 40] },
  { cohort: 'Jul W2', size: 1020, weeks: [100, 64, 50] },
  { cohort: 'Jul W3', size: 760, weeks: [100, 60] },
];

const FEATURES: FeatureFlag[] = [
  { id: 'f1', name: 'Portfolio Analytics', usage: 84, dau: 4200, enabled: true },
  { id: 'f2', name: 'DEX Explorer', usage: 61, dau: 3050, enabled: true },
  { id: 'f3', name: 'AI Tx Patterns', usage: 37, dau: 1850, enabled: true },
  { id: 'f4', name: 'Multi-Sig Manager', usage: 22, dau: 1100, enabled: true },
  { id: 'f5', name: 'New TX Builder', usage: 48, dau: 2400, enabled: true, experiment: true, variant: 'B' },
  { id: 'f6', name: 'Governance (beta)', usage: 12, dau: 600, enabled: false, experiment: true, variant: 'A' },
  { id: 'f7', name: 'DID Management', usage: 9, dau: 450, enabled: true },
  { id: 'f8', name: 'Live Activity Feed', usage: 71, dau: 3550, enabled: true },
];

const CONSENT_ITEMS: ConsentItem[] = [
  { id: 'c1', label: 'Essential cookies', required: true, enabled: true },
  { id: 'c2', label: 'Analytics & usage data', required: false, enabled: true },
  { id: 'c3', label: 'Performance monitoring', required: false, enabled: false },
  { id: 'c4', label: 'Marketing & re-targeting', required: false, enabled: false },
  { id: 'c5', label: 'Third-party integrations', required: false, enabled: false },
];

// ─── Step 1 – Tracking ────────────────────────────────────────────────────────

function Tracking() {
  const [tab, setTab] = useState<'events' | 'props' | 'session'>('events');
  const [liveCount, setLiveCount] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setLiveCount(n => n + Math.floor(Math.random() * 4));
      setPulse(true);
      setTimeout(() => setPulse(false), 300);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const maxCount = Math.max(...EVENTS.map(e => e.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Event Tracking" subtitle="Capture and analyse every meaningful user interaction across the dashboard." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Events Today" value="86.7K" color="var(--cyan,#06b6d4)" sub="+12.3%" />
        <Stat label="Unique Users" value="4,210" color="#22c55e" sub="+8.7%" />
        <Stat label="Avg Session" value="6m 12s" color="#a78bfa" sub="+1m 4s" />
        <Stat label="Live Now" value={liveCount + 142} color={pulse ? '#f97316' : '#eab308'} />
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '0', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', alignSelf: 'flex-start' }}>
        {(['events', 'props', 'session'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize',
            background: tab === t ? 'var(--cyan-glow-sm,rgba(6,182,212,.15))' : 'transparent',
            borderBottom: tab === t ? '2px solid var(--cyan,#06b6d4)' : '2px solid transparent',
            color: tab === t ? 'var(--cyan,#06b6d4)' : 'var(--text-muted)', transition: 'var(--transition)',
          }}>{t === 'props' ? 'User Properties' : t === 'session' ? 'Sessions' : 'Events'}</button>
        ))}
      </div>

      {tab === 'events' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Event Name</span><span>{EVENTS.length} tracked events</span>
          </div>
          {EVENTS.map(ev => (
            <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 100px', gap: '12px', padding: '11px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--cyan,#06b6d4)', marginBottom: '4px' }}>{ev.name}</div>
                <MiniBar value={ev.count} max={maxCount} color="var(--cyan,#06b6d4)" />
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>{ev.count.toLocaleString()}</div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: ev.trend >= 0 ? '#22c55e' : '#ef4444', textAlign: 'right' }}>
                {ev.trend >= 0 ? '▲' : '▼'} {Math.abs(ev.trend)}%
              </div>
              <Badge label={ev.category} />
            </div>
          ))}
        </Card>
      )}

      {tab === 'props' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {USER_PROPS.map(prop => (
            <Card key={prop.key}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>{prop.key.replace('_', ' ')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {prop.values.map(v => (
                  <div key={v} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{v.split(' ')[0]}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan,#06b6d4)' }}>{v.split(' ')[1]}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'session' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { label: 'Avg Duration', value: '6m 12s', icon: '⏱️' },
            { label: 'Pages / Session', value: '4.8', icon: '📄' },
            { label: 'Bounce Rate', value: '22%', icon: '↩️' },
            { label: 'New vs Returning', value: '38 / 62%', icon: '👥' },
            { label: 'Peak Hour', value: '14:00 UTC', icon: '⚡' },
            { label: '30-Day Sessions', value: '128K', icon: '📊' },
          ].map(s => (
            <Card key={s.label} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '22px' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{s.label}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 2 – Funnels ─────────────────────────────────────────────────────────

function Funnels() {
  const [activeFunnel, setActiveFunnel] = useState<'onboarding' | 'transaction'>('onboarding');
  const steps = FUNNELS[activeFunnel];
  const maxUsers = steps[0].users;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Funnel Analytics" subtitle="Track user journeys from first touch to final conversion and pinpoint drop-off points." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <Stat label="Overall Conv." value={`${Math.round((steps[steps.length - 1].users / maxUsers) * 100)}%`} color="#22c55e" />
        <Stat label="Biggest Drop" value={`${Math.max(...steps.map(s => s.dropOff))}%`} color="#ef4444" />
        <Stat label="Avg Steps Done" value={`${(steps.filter(s => s.dropOff < 30).length)}`} color="#a78bfa" />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        {(['onboarding', 'transaction'] as const).map(f => (
          <button key={f} onClick={() => setActiveFunnel(f)} style={{
            padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
            background: activeFunnel === f ? 'rgba(6,182,212,.15)' : 'var(--bg-elevated)',
            border: `1px solid ${activeFunnel === f ? 'var(--cyan,#06b6d4)' : 'var(--border)'}`,
            color: activeFunnel === f ? 'var(--cyan,#06b6d4)' : 'var(--text-muted)', transition: 'var(--transition)',
          }}>{f} funnel</button>
        ))}
      </div>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {steps.map((step, i) => (
            <div key={step.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '8px', fontFamily: 'var(--font-mono)' }}>{i + 1}.</span>
                  {step.name}
                </span>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{step.users.toLocaleString()}</span>
                  {i > 0 && <span style={{ fontSize: '11px', color: step.dropOff > 30 ? '#ef4444' : '#22c55e', fontFamily: 'var(--font-mono)' }}>
                    ↓ {step.dropOff}% drop
                  </span>}
                </div>
              </div>
              <div style={{ height: '28px', background: 'var(--bg-canvas)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${(step.users / maxUsers) * 100}%`, height: '100%',
                  background: i === 0 ? 'var(--cyan,#06b6d4)' : step.dropOff > 30 ? 'linear-gradient(90deg,#f97316,#ef4444)' : 'linear-gradient(90deg,#22c55e,#06b6d4)',
                  borderRadius: '6px', transition: 'width 1s ease',
                  display: 'flex', alignItems: 'center', paddingLeft: '10px',
                }} >
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#000', fontFamily: 'var(--font-mono)' }}>{step.convRate}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Drop-off analysis */}
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Drop-off Analysis</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {steps.filter(s => s.dropOff > 20).sort((a, b) => b.dropOff - a.dropOff).map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,.2)' }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.users.toLocaleString()} users — {maxUsers - s.users} did not continue</div>
              </div>
              <Badge label={`${s.dropOff}% drop`} color="#ef4444" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Step 3 – Retention ───────────────────────────────────────────────────────

function Retention() {
  const maxVal = 100;
  const getColor = (v: number) => {
    if (v >= 60) return '#22c55e';
    if (v >= 40) return '#eab308';
    if (v >= 20) return '#f97316';
    return '#ef4444';
  };

  const avgRetention = RETENTION_DATA.reduce((a, r) => a + (r.weeks[1] ?? 0), 0) / RETENTION_DATA.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Retention & Cohort Analysis" subtitle="Understand how users return over time and identify churn risk signals." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Week-1 Retention" value={`${Math.round(avgRetention)}%`} color="#22c55e" />
        <Stat label="30-Day Retention" value="31%" color="#eab308" />
        <Stat label="Churn Rate" value="9.2%" color="#ef4444" sub="-1.4%" />
        <Stat label="Cohorts Tracked" value={RETENTION_DATA.length} color="#a78bfa" />
      </div>

      {/* Cohort heatmap */}
      <Card style={{ overflowX: 'auto', padding: '0' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 700 }}>Cohort Retention Heatmap</div>
        <div style={{ padding: '16px', overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Cohort</th>
                <th style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>Size</th>
                {Array.from({ length: 8 }, (_, i) => (
                  <th key={i} style={{ padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>W{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RETENTION_DATA.map(row => (
                <tr key={row.cohort}>
                  <td style={{ padding: '6px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.cohort}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{row.size.toLocaleString()}</td>
                  {Array.from({ length: 8 }, (_, i) => {
                    const val = row.weeks[i];
                    return (
                      <td key={i} style={{ padding: '4px 6px', textAlign: 'center' }}>
                        {val !== undefined ? (
                          <div style={{
                            width: '42px', height: '28px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: i === 0 ? 'var(--bg-canvas)' : `${getColor(val)}33`,
                            color: i === 0 ? 'var(--text-muted)' : getColor(val),
                            fontWeight: 700, fontSize: '11px',
                          }}>
                            {val}%
                          </div>
                        ) : (
                          <div style={{ width: '42px', height: '28px', background: 'var(--bg-canvas)', borderRadius: '4px', opacity: 0.3 }} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Churn signals */}
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Churn Risk Signals</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { signal: '56.3% of new users never complete first transaction', severity: 'high' },
            { signal: 'Jun W3 cohort shows lowest Week-2 retention (42%)', severity: 'medium' },
            { signal: 'Users without wallet events churn 3× faster', severity: 'high' },
            { signal: 'Session length < 2min correlates with 80% churn', severity: 'medium' },
          ].map(s => (
            <div key={s.signal} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: `1px solid ${s.severity === 'high' ? 'rgba(239,68,68,.25)' : 'rgba(234,179,8,.25)'}` }}>
              <span style={{ fontSize: '14px', marginTop: '1px' }}>{s.severity === 'high' ? '🔴' : '🟡'}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.signal}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Step 4 – Features ────────────────────────────────────────────────────────

function Features() {
  const [features, setFeatures] = useState<FeatureFlag[]>(FEATURES);
  const [abExpanded, setAbExpanded] = useState<string | null>(null);
  const maxDau = Math.max(...features.map(f => f.dau));

  const toggleFeature = useCallback((id: string) => {
    setFeatures(prev => prev.map(f => f.id === id && !f.experiment ? { ...f, enabled: !f.enabled } : f));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Feature Analytics & Experimentation" subtitle="Track feature adoption, run A/B tests, and experiment safely with targeted rollouts." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Features Active" value={features.filter(f => f.enabled).length} color="var(--cyan,#06b6d4)" />
        <Stat label="Experiments" value={features.filter(f => f.experiment).length} color="#a78bfa" />
        <Stat label="Top Usage" value={`${Math.max(...features.map(f => f.usage))}%`} color="#22c55e" />
        <Stat label="Total Feature DAU" value={features.reduce((a, b) => a + b.dau, 0).toLocaleString()} color="#f97316" />
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 80px 90px 80px 60px', gap: '12px' }}>
          <span>Feature</span><span>DAU</span><span>Usage %</span><span>Status</span><span>Toggle</span>
        </div>
        {features.map(f => (
          <div key={f.id}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 80px 60px', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: f.experiment ? 'pointer' : 'default' }}
              onClick={() => f.experiment && setAbExpanded(abExpanded === f.id ? null : f.id)}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{f.name}</span>
                  {f.experiment && <Badge label={`A/B v${f.variant}`} color="#a78bfa" />}
                </div>
                <MiniBar value={f.dau} max={maxDau} color={f.enabled ? 'var(--cyan,#06b6d4)' : 'var(--text-muted)'} />
              </div>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right' }}>{f.dau.toLocaleString()}</span>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: f.usage > 60 ? '#22c55e' : f.usage > 30 ? '#eab308' : '#ef4444', textAlign: 'right' }}>{f.usage}%</span>
              <Badge label={f.enabled ? 'Active' : 'Off'} color={f.enabled ? '#22c55e' : 'var(--text-muted)'} />
              <button onClick={e => { e.stopPropagation(); toggleFeature(f.id); }} disabled={f.experiment}
                style={{ width: '34px', height: '20px', borderRadius: '10px', border: 'none', cursor: f.experiment ? 'not-allowed' : 'pointer', background: f.enabled ? 'var(--cyan,#06b6d4)' : 'var(--bg-canvas)', position: 'relative', transition: 'background 0.3s', opacity: f.experiment ? 0.5 : 1 }}>
                <div style={{ position: 'absolute', top: '2px', left: f.enabled ? '16px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.3s' }} />
              </button>
            </div>
            {abExpanded === f.id && f.experiment && (
              <div style={{ padding: '12px 16px', background: 'rgba(167,139,250,.06)', borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
                <div style={{ fontWeight: 700, marginBottom: '8px', color: '#a78bfa' }}>A/B Experiment — Variant {f.variant}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[{ label: 'Control (A)', conv: '12.4%', users: '2,400' }, { label: `Variant ${f.variant}`, conv: '14.8%', users: '2,380' }].map(v => (
                    <div key={v.label} style={{ padding: '10px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>{v.label}</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#a78bfa' }}>{v.conv}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>conv · {v.users} users</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Step 5 – Privacy ─────────────────────────────────────────────────────────

function Privacy() {
  const [consent, setConsent] = useState<ConsentItem[]>(CONSENT_ITEMS);
  const [anonymised, setAnonymised] = useState(true);
  const [gdprView, setGdprView] = useState<'checklist' | 'dsar' | 'retention'>('checklist');

  const toggleConsent = (id: string) => {
    setConsent(prev => prev.map(c => (c.id === id && !c.required) ? { ...c, enabled: !c.enabled } : c));
  };

  const GDPR_CHECKLIST = [
    { item: 'Data Processing Records (Art. 30)', done: true },
    { item: 'Privacy Policy Published', done: true },
    { item: 'Cookie Banner with Granular Consent', done: false },
    { item: 'Data Breach Response Plan', done: true },
    { item: 'Right-to-Erasure Workflow', done: false },
    { item: 'Data Protection Officer Appointed', done: false },
    { item: 'Cross-border Transfer Safeguards', done: true },
    { item: 'PII Encrypted at Rest', done: true },
  ];

  const score = Math.round((GDPR_CHECKLIST.filter(g => g.done).length / GDPR_CHECKLIST.length) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Privacy & Compliance" subtitle="GDPR compliance status, consent management, and data anonymisation controls." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="GDPR Score" value={`${score}%`} color={score >= 80 ? '#22c55e' : '#eab308'} />
        <Stat label="Consents Active" value={consent.filter(c => c.enabled).length} color="var(--cyan,#06b6d4)" />
        <Stat label="PII Anonymised" value={anonymised ? 'ON' : 'OFF'} color={anonymised ? '#22c55e' : '#ef4444'} />
        <Stat label="Open DSARs" value={2} color="#f97316" />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        {(['checklist', 'dsar', 'retention'] as const).map(v => (
          <button key={v} onClick={() => setGdprView(v)} style={{
            padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
            background: gdprView === v ? 'rgba(6,182,212,.15)' : 'var(--bg-elevated)',
            border: `1px solid ${gdprView === v ? 'var(--cyan,#06b6d4)' : 'var(--border)'}`,
            color: gdprView === v ? 'var(--cyan,#06b6d4)' : 'var(--text-muted)', transition: 'var(--transition)',
          }}>{v === 'dsar' ? 'Data Requests' : v}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Left: dynamic panel */}
        <Card>
          {gdprView === 'checklist' && (
            <>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>GDPR Compliance Checklist</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {GDPR_CHECKLIST.map(g => (
                  <div key={g.item} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '14px' }}>{g.done ? '✅' : '❌'}</span>
                    <span style={{ fontSize: '12px', color: g.done ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: g.done ? 'line-through' : 'none' }}>{g.item}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {gdprView === 'dsar' && (
            <>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Data Subject Access Requests</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { id: 'DSAR-001', type: 'Data Export', user: 'G...XBK4', status: 'In Progress', due: '3d' },
                  { id: 'DSAR-002', type: 'Right to Erasure', user: 'G...M7PQ', status: 'Open', due: '12d' },
                  { id: 'DSAR-003', type: 'Rectification', user: 'G...N2RS', status: 'Completed', due: '—' },
                ].map(r => (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '80px 100px 80px 70px 50px', gap: '8px', padding: '8px 10px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontFamily: 'var(--font-mono)', alignItems: 'center' }}>
                    <span style={{ color: 'var(--cyan,#06b6d4)' }}>{r.id}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{r.type}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{r.user}</span>
                    <Badge label={r.status} color={r.status === 'Completed' ? '#22c55e' : r.status === 'Open' ? '#ef4444' : '#eab308'} />
                    <span style={{ color: 'var(--text-muted)' }}>{r.due}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {gdprView === 'retention' && (
            <>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Data Retention Policies</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { type: 'Event logs', period: '90 days', action: 'Auto-delete' },
                  { type: 'Session recordings', period: '30 days', action: 'Auto-delete' },
                  { type: 'User profiles', period: '2 years', action: 'Archive' },
                  { type: 'Transaction data', period: '7 years', action: 'Compliance hold' },
                  { type: 'Error traces', period: '14 days', action: 'Auto-delete' },
                ].map(r => (
                  <div key={r.type} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: '8px', padding: '8px 10px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', fontSize: '12px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{r.type}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan,#06b6d4)' }}>{r.period}</span>
                    <Badge label={r.action} color={r.action === 'Auto-delete' ? '#ef4444' : r.action === 'Archive' ? '#eab308' : '#a78bfa'} />
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Right: consent + anonymisation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Card>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Consent Management</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {consent.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{c.label}</div>
                    {c.required && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Required</div>}
                  </div>
                  <button disabled={c.required} onClick={() => toggleConsent(c.id)} style={{ width: '38px', height: '22px', borderRadius: '11px', border: 'none', cursor: c.required ? 'not-allowed' : 'pointer', background: c.enabled ? 'var(--cyan,#06b6d4)' : 'var(--bg-canvas)', position: 'relative', transition: 'background 0.3s', opacity: c.required ? 0.7 : 1 }}>
                    <div style={{ position: 'absolute', top: '3px', left: c.enabled ? '18px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.3s' }} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>Data Anonymisation</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>PII auto-anonymisation</span>
              <button onClick={() => setAnonymised(!anonymised)} style={{ width: '38px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer', background: anonymised ? '#22c55e' : 'var(--bg-canvas)', position: 'relative', transition: 'background 0.3s' }}>
                <div style={{ position: 'absolute', top: '3px', left: anonymised ? '18px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.3s' }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { field: 'Public Keys', method: 'Prefix truncation' },
                { field: 'IP Addresses', method: 'Last-octet removal' },
                { field: 'User Agents', method: 'Device generalisation' },
              ].map(a => (
                <div key={a.field} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '6px 8px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{a.field}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{a.method}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'tracking', label: 'Tracking', icon: '📡', short: 'Tracking' },
  { id: 'funnels', label: 'Funnels', icon: '🔽', short: 'Funnels' },
  { id: 'retention', label: 'Retention', icon: '🔄', short: 'Retention' },
  { id: 'features', label: 'Features', icon: '🧪', short: 'Features' },
  { id: 'privacy', label: 'Privacy', icon: '🔒', short: 'Privacy' },
] as const;

type StepId = typeof STEPS[number]['id'];

export default function ProductAnalytics() {
  const [activeStep, setActiveStep] = useState<StepId>('tracking');
  const idx = STEPS.findIndex(s => s.id === activeStep);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <span style={{ fontSize: '22px' }}>📈</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, margin: 0 }}>Product Analytics</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Understand user behaviour, optimise conversion, and ship features with confidence.</p>
      </div>

      {/* Step nav */}
      <div style={{ display: 'flex', gap: '0', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {STEPS.map((step, i) => {
          const isActive = activeStep === step.id;
          const isDone = i < idx;
          return (
            <button key={step.id} onClick={() => setActiveStep(step.id)} style={{
              flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer',
              background: isActive ? 'rgba(6,182,212,.12)' : 'transparent',
              borderRight: i < STEPS.length - 1 ? '1px solid var(--border)' : 'none',
              borderBottom: isActive ? '2px solid var(--cyan,#06b6d4)' : '2px solid transparent',
              color: isActive ? 'var(--cyan,#06b6d4)' : isDone ? '#22c55e' : 'var(--text-muted)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'var(--transition)',
            }}>
              <span style={{ fontSize: '13px' }}>{isDone ? '✅' : step.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{i + 1}. {step.short}</span>
            </button>
          );
        })}
      </div>

      {activeStep === 'tracking' && <Tracking />}
      {activeStep === 'funnels' && <Funnels />}
      {activeStep === 'retention' && <Retention />}
      {activeStep === 'features' && <Features />}
      {activeStep === 'privacy' && <Privacy />}

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
        <button disabled={idx === 0} onClick={() => setActiveStep(STEPS[idx - 1].id)} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: idx === 0 ? 0.4 : 1 }}>← Previous</button>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center', fontFamily: 'var(--font-mono)' }}>Step {idx + 1} of {STEPS.length}</span>
        <button disabled={idx === STEPS.length - 1} onClick={() => setActiveStep(STEPS[idx + 1].id)} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, background: idx === STEPS.length - 1 ? 'var(--bg-elevated)' : 'var(--cyan,#06b6d4)', border: '1px solid var(--border)', cursor: idx === STEPS.length - 1 ? 'not-allowed' : 'pointer', color: idx === STEPS.length - 1 ? 'var(--text-muted)' : '#000', opacity: idx === STEPS.length - 1 ? 0.4 : 1 }}>Next →</button>
      </div>
    </div>
  );
}
