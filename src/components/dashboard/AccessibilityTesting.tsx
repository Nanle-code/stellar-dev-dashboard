import React, { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TestStatus = 'pass' | 'fail' | 'warn' | 'pending';
type ImpactLevel = 'critical' | 'serious' | 'moderate' | 'minor';

interface AxeViolation {
  id: string;
  rule: string;
  impact: ImpactLevel;
  description: string;
  affectedNodes: number;
  page: string;
  wcag: string;
  fix: string;
}

interface ScoreSnapshot {
  date: string;
  score: number;
  violations: number;
}

interface KeyboardTest {
  id: string;
  name: string;
  category: 'navigation' | 'focus' | 'skip' | 'trap';
  status: TestStatus;
  description: string;
  component?: string;
}

interface ScreenReaderTest {
  id: string;
  name: string;
  type: 'aria' | 'live-region' | 'reader';
  status: TestStatus;
  detail: string;
}

// ─── Shared Primitives ────────────────────────────────────────────────────────

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', ...style }}>
    {children}
  </div>
);

const IMPACT_PALETTE: Record<ImpactLevel | string, { bg: string; color: string; border: string }> = {
  critical: { bg: 'rgba(239,68,68,.12)', color: '#ef4444', border: 'rgba(239,68,68,.35)' },
  serious:  { bg: 'rgba(249,115,22,.12)', color: '#f97316', border: 'rgba(249,115,22,.35)' },
  moderate: { bg: 'rgba(234,179,8,.12)', color: '#eab308', border: 'rgba(234,179,8,.35)' },
  minor:    { bg: 'rgba(6,182,212,.1)', color: 'var(--cyan,#06b6d4)', border: 'rgba(6,182,212,.3)' },
};

const STATUS_PALETTE: Record<TestStatus, { icon: string; color: string }> = {
  pass:    { icon: '✅', color: '#22c55e' },
  fail:    { icon: '❌', color: '#ef4444' },
  warn:    { icon: '⚠️', color: '#eab308' },
  pending: { icon: '⏳', color: 'var(--text-muted)' },
};

const ImpactBadge = ({ impact }: { impact: ImpactLevel | string }) => {
  const p = IMPACT_PALETTE[impact] ?? IMPACT_PALETTE.minor;
  return (
    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px', background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
      {impact}
    </span>
  );
};

const StatusBadge = ({ status }: { status: TestStatus }) => {
  const p = STATUS_PALETTE[status];
  return <span style={{ fontSize: '13px' }}>{p.icon}</span>;
};

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div style={{ marginBottom: '20px' }}>
    <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{title}</div>
    {subtitle && <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>}
  </div>
);

const Stat = ({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) => (
  <Card style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '26px', fontWeight: 800, color: color ?? 'var(--cyan,#06b6d4)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '11px', color: sub.includes('+') ? '#22c55e' : '#ef4444', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{sub}</div>}
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{label}</div>
  </Card>
);

const MiniBar = ({ value, max, color }: { value: number; max: number; color?: string }) => (
  <div style={{ height: '6px', background: 'var(--bg-canvas)', borderRadius: '4px', overflow: 'hidden' }}>
    <div style={{ width: `${Math.min((value / max) * 100, 100)}%`, height: '100%', background: color ?? 'var(--cyan,#06b6d4)', borderRadius: '4px', transition: 'width 0.8s ease' }} />
  </div>
);

// ─── Mock Data ────────────────────────────────────────────────────────────────

const AXE_VIOLATIONS: AxeViolation[] = [
  { id: 'v1', rule: 'color-contrast', impact: 'serious', description: 'Elements must have sufficient color contrast', affectedNodes: 14, page: '/overview', wcag: '1.4.3 AA', fix: 'Increase foreground/background ratio to ≥ 4.5:1' },
  { id: 'v2', rule: 'image-alt', impact: 'critical', description: 'Images must have alternate text', affectedNodes: 3, page: '/transactions', wcag: '1.1.1 A', fix: 'Add descriptive alt attribute to all <img> elements' },
  { id: 'v3', rule: 'button-name', impact: 'critical', description: 'Buttons must have discernible text', affectedNodes: 7, page: '/builder', wcag: '4.1.2 A', fix: 'Add aria-label or visible text to all icon-only buttons' },
  { id: 'v4', rule: 'label', impact: 'serious', description: 'Form elements must have labels', affectedNodes: 5, page: '/settings', wcag: '1.3.1 A', fix: 'Associate <label> with each form control via htmlFor' },
  { id: 'v5', rule: 'aria-required-attr', impact: 'critical', description: 'Required ARIA attributes must be present', affectedNodes: 2, page: '/sidebar', wcag: '4.1.2 A', fix: 'Add missing aria-expanded and aria-controls attributes' },
  { id: 'v6', rule: 'link-name', impact: 'serious', description: 'Links must have discernible text', affectedNodes: 4, page: '/anchors', wcag: '2.4.4 A', fix: 'Add aria-label or wrap text inside anchor elements' },
  { id: 'v7', rule: 'focus-visible', impact: 'moderate', description: 'Focus must be visible on interactive elements', affectedNodes: 11, page: '/dex', wcag: '2.4.7 AA', fix: 'Do not suppress :focus-visible outline on buttons/links' },
];

const SCORE_HISTORY: ScoreSnapshot[] = [
  { date: 'Jun 1', score: 64, violations: 22 },
  { date: 'Jun 8', score: 68, violations: 19 },
  { date: 'Jun 15', score: 71, violations: 16 },
  { date: 'Jun 22', score: 74, violations: 13 },
  { date: 'Jul 1', score: 73, violations: 14 },
  { date: 'Jul 8', score: 77, violations: 11 },
  { date: 'Jul 15', score: 80, violations: 9 },
];

const KEYBOARD_TESTS: KeyboardTest[] = [
  { id: 'k1', name: 'Tab order is logical', category: 'navigation', status: 'pass', description: 'Focusable elements receive focus in a meaningful sequence', component: 'All pages' },
  { id: 'k2', name: 'Skip to main content link', category: 'skip', status: 'fail', description: 'First focusable element should skip repetitive navigation', component: 'Layout' },
  { id: 'k3', name: 'Modal focus trap', category: 'trap', status: 'pass', description: 'Focus is contained within modal dialogs until dismissed', component: 'Modals' },
  { id: 'k4', name: 'Dropdown keyboard control', category: 'navigation', status: 'warn', description: 'Arrow keys should navigate dropdown menus', component: 'NetworkSelect' },
  { id: 'k5', name: 'Dialog closes on Escape', category: 'navigation', status: 'pass', description: 'Pressing Escape closes overlays and returns focus', component: 'All dialogs' },
  { id: 'k6', name: 'Focus returned after action', category: 'focus', status: 'fail', description: 'Focus must return to trigger element after modal closes', component: 'PreferencesModal' },
  { id: 'k7', name: 'Sidebar focusable when open', category: 'focus', status: 'pass', description: 'Mobile sidebar receives focus when opened', component: 'MobileSidebar' },
  { id: 'k8', name: 'No keyboard trap outside modal', category: 'trap', status: 'pass', description: 'Users can navigate away from any component', component: 'All pages' },
];

const SR_TESTS: ScreenReaderTest[] = [
  { id: 'sr1', name: 'Page titles are descriptive', type: 'aria', status: 'pass', detail: 'All routes have unique, descriptive <title> elements' },
  { id: 'sr2', name: 'Landmark regions present', type: 'aria', status: 'pass', detail: '<main>, <nav>, <aside> landmarks are correctly used' },
  { id: 'sr3', name: 'Live region for notifications', type: 'live-region', status: 'fail', detail: 'Toast notifications lack aria-live="polite" region' },
  { id: 'sr4', name: 'Loading states announced', type: 'live-region', status: 'warn', detail: 'Some async loads are missing aria-busy / aria-label' },
  { id: 'sr5', name: 'Table headers associated', type: 'aria', status: 'pass', detail: 'All data tables use <th scope="col"> correctly' },
  { id: 'sr6', name: 'Error messages linked to inputs', type: 'aria', status: 'fail', detail: 'Validation errors missing aria-describedby on 4 inputs' },
  { id: 'sr7', name: 'Icon buttons labelled', type: 'reader', status: 'fail', detail: '7 icon-only buttons lack accessible names (aria-label)' },
  { id: 'sr8', name: 'Form autocomplete attributes', type: 'reader', status: 'warn', detail: 'Missing autocomplete on 3 common fields' },
];

const PAGES = [
  { name: '/overview', score: 88, violations: 2 },
  { name: '/transactions', score: 74, violations: 5 },
  { name: '/builder', score: 61, violations: 8 },
  { name: '/settings', score: 70, violations: 6 },
  { name: '/sidebar', score: 82, violations: 3 },
  { name: '/anchors', score: 66, violations: 7 },
  { name: '/dex', score: 59, violations: 9 },
];

// ─── Step 1 – Automated Testing ───────────────────────────────────────────────

function AutomatedTesting() {
  const [scanRunning, setScanRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedViolation, setSelectedViolation] = useState<AxeViolation | null>(null);
  const [impactFilter, setImpactFilter] = useState<ImpactLevel | 'all'>('all');

  const runScan = useCallback(() => {
    setScanRunning(true); setProgress(0);
    const iv = setInterval(() => {
      setProgress(p => { if (p >= 100) { clearInterval(iv); setScanRunning(false); return 100; } return p + 3; });
    }, 80);
  }, []);

  const filtered = AXE_VIOLATIONS.filter(v => impactFilter === 'all' || v.impact === impactFilter);
  const impactCounts = AXE_VIOLATIONS.reduce((a, v) => { a[v.impact] = (a[v.impact] ?? 0) + 1; return a; }, {} as Record<string, number>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Automated Accessibility Testing" subtitle="axe-core powered scans across all pages, integrated into your CI/CD pipeline." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Total Violations" value={AXE_VIOLATIONS.length} color="#ef4444" />
        <Stat label="Critical" value={impactCounts.critical ?? 0} color="#ef4444" />
        <Stat label="Pages Scanned" value={PAGES.length} color="var(--cyan,#06b6d4)" />
        <Stat label="Affected Nodes" value={AXE_VIOLATIONS.reduce((a, v) => a + v.affectedNodes, 0)} color="#f97316" />
      </div>

      {/* CI integration strip */}
      <Card style={{ background: 'rgba(6,182,212,.05)', borderColor: 'rgba(6,182,212,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>CI Pipeline Integration</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>axe-core runs on every PR · Blocks merge on critical violations</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(34,197,94,.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,.3)', fontSize: '11px', fontWeight: 700 }}>● CI Active</span>
            <span style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(6,182,212,.15)', color: 'var(--cyan,#06b6d4)', border: '1px solid rgba(6,182,212,.3)', fontSize: '11px', fontWeight: 700 }}>axe-core v4.9</span>
          </div>
        </div>
      </Card>

      {/* Impact filter */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'critical', 'serious', 'moderate', 'minor'] as const).map(imp => (
          <button key={imp} onClick={() => setImpactFilter(imp)} style={{
            padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
            background: impactFilter === imp ? (IMPACT_PALETTE[imp]?.bg ?? 'var(--bg-elevated)') : 'var(--bg-elevated)',
            border: `1px solid ${impactFilter === imp ? (IMPACT_PALETTE[imp]?.border ?? 'var(--border)') : 'var(--border)'}`,
            color: impactFilter === imp ? (IMPACT_PALETTE[imp]?.color ?? 'var(--text-muted)') : 'var(--text-muted)',
          }}>
            {imp === 'all' ? `All (${AXE_VIOLATIONS.length})` : `${imp} (${impactCounts[imp] ?? 0})`}
          </button>
        ))}
        <button onClick={runScan} disabled={scanRunning} style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, border: 'none', cursor: scanRunning ? 'wait' : 'pointer', background: scanRunning ? 'var(--bg-canvas)' : 'var(--cyan,#06b6d4)', color: scanRunning ? 'var(--text-muted)' : '#000' }}>
          {scanRunning ? `⏳ ${progress}%` : '▶ Run Scan'}
        </button>
      </div>

      {scanRunning && (
        <div style={{ height: '6px', background: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--cyan,#06b6d4)', transition: 'width 0.1s' }} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedViolation ? '1fr 320px' : '1fr', gap: '14px' }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map(v => (
            <div key={v.id} onClick={() => setSelectedViolation(v.id === selectedViolation?.id ? null : v)}
              style={{ display: 'grid', gridTemplateColumns: '90px 90px 1fr 50px', gap: '12px', padding: '11px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center', background: selectedViolation?.id === v.id ? 'rgba(6,182,212,.06)' : 'transparent', transition: 'background 0.15s' }}>
              <ImpactBadge impact={v.impact} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{v.wcag}</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{v.rule}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.page}</div>
              </div>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#f97316', textAlign: 'right' }}>{v.affectedNodes}</span>
            </div>
          ))}
        </Card>

        {selectedViolation && (
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Violation Detail</span>
              <button onClick={() => setSelectedViolation(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }}>✕</button>
            </div>
            <ImpactBadge impact={selectedViolation.impact} />
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Rule</div>
              <code style={{ fontSize: '12px', color: 'var(--cyan,#06b6d4)' }}>{selectedViolation.rule}</code>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>WCAG Criterion</div>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{selectedViolation.wcag}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Description</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedViolation.description}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Fix</div>
              <div style={{ fontSize: '12px', color: '#22c55e', background: 'rgba(34,197,94,.08)', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34,197,94,.2)', lineHeight: 1.5 }}>{selectedViolation.fix}</div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Step 2 – Score Tracking ──────────────────────────────────────────────────

function ScoreTracking() {
  const latest = SCORE_HISTORY[SCORE_HISTORY.length - 1];
  const prev = SCORE_HISTORY[SCORE_HISTORY.length - 2];
  const delta = latest.score - prev.score;
  const goalScore = 90;
  const maxBar = Math.max(...SCORE_HISTORY.map(s => s.score));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Accessibility Score Tracking" subtitle="Monitor your accessibility score over time, track trends, and stay on target." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Current Score" value={`${latest.score}/100`} color={latest.score >= 80 ? '#22c55e' : '#eab308'} sub={`${delta >= 0 ? '+' : ''}${delta} this week`} />
        <Stat label="Score Goal" value={`${goalScore}/100`} color="#a78bfa" />
        <Stat label="Gap to Goal" value={`${goalScore - latest.score}pts`} color="#f97316" />
        <Stat label="Violations Left" value={latest.violations} color="#ef4444" />
      </div>

      {/* Trend chart (visual bars) */}
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px' }}>Score Trend (7 Weeks)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '140px' }}>
          {SCORE_HISTORY.map((snap, i) => {
            const height = (snap.score / 100) * 130;
            const isGoal = snap.score >= goalScore;
            return (
              <div key={snap.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{snap.score}</div>
                <div style={{ width: '100%', height: `${height}px`, background: isGoal ? 'linear-gradient(to top, #22c55e, #06b6d4)' : i === SCORE_HISTORY.length - 1 ? 'var(--cyan,#06b6d4)' : 'var(--bg-canvas)', border: `1px solid ${isGoal ? 'rgba(34,197,94,.4)' : 'var(--border)'}`, borderRadius: '4px 4px 0 0', transition: 'height 0.8s ease', position: 'relative' }} />
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{snap.date}</div>
              </div>
            );
          })}
        </div>
        {/* Goal line annotation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '11px', color: '#a78bfa' }}>
          <div style={{ width: '24px', height: '2px', background: '#a78bfa', borderRadius: '2px' }} />
          Goal: {goalScore}/100
        </div>
      </Card>

      {/* Per-page scores */}
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Score by Page</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {PAGES.sort((a, b) => b.score - a.score).map(page => (
            <div key={page.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan,#06b6d4)' }}>{page.name}</span>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: '#ef4444', fontSize: '11px' }}>{page.violations} violations</span>
                  <span style={{ fontWeight: 700, color: page.score >= 80 ? '#22c55e' : page.score >= 65 ? '#eab308' : '#ef4444', fontFamily: 'var(--font-mono)' }}>{page.score}</span>
                </div>
              </div>
              <MiniBar value={page.score} max={100} color={page.score >= 80 ? '#22c55e' : page.score >= 65 ? '#eab308' : '#ef4444'} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Step 3 – Regression ─────────────────────────────────────────────────────

function Regression() {
  const [alertOn, setAlertOn] = useState(true);
  const [threshold, setThreshold] = useState(5);

  const BASELINE = { score: 80, violations: 7, date: 'Jul 15' };
  const REGRESSIONS = [
    { date: 'Jul 12', rule: 'focus-visible', page: '/dex', delta: -3, detail: '3 new focusable elements added without visible focus ring' },
    { date: 'Jul 10', rule: 'color-contrast', page: '/builder', delta: -2, detail: 'Recent theme update introduced low-contrast text in dark mode' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Regression Detection" subtitle="Establish accessibility baselines and automatically detect regressions in your CI pipeline." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Baseline Score" value={`${BASELINE.score}/100`} color="var(--cyan,#06b6d4)" />
        <Stat label="Baseline Violations" value={BASELINE.violations} color="#22c55e" />
        <Stat label="Regressions Found" value={REGRESSIONS.length} color="#ef4444" />
        <Stat label="Alert Threshold" value={`-${threshold}pts`} color="#eab308" />
      </div>

      {/* Baseline card */}
      <Card style={{ background: 'rgba(6,182,212,.05)', borderColor: 'rgba(6,182,212,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>Current Baseline — {BASELINE.date}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Score: <strong style={{ color: 'var(--cyan,#06b6d4)' }}>{BASELINE.score}</strong> · Violations: <strong style={{ color: '#22c55e' }}>{BASELINE.violations}</strong></div>
          </div>
          <button style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, background: 'var(--cyan,#06b6d4)', color: '#000', border: 'none', cursor: 'pointer' }}>
            Update Baseline
          </button>
        </div>
      </Card>

      {/* Alert config */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>Regression Alerts</div>
          <button onClick={() => setAlertOn(!alertOn)} style={{ width: '38px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer', background: alertOn ? '#22c55e' : 'var(--bg-canvas)', position: 'relative', transition: 'background 0.3s' }}>
            <div style={{ position: 'absolute', top: '3px', left: alertOn ? '18px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.3s' }} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Alert when score drops by</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[2, 5, 10].map(t => (
              <button key={t} onClick={() => setThreshold(t)} style={{ padding: '5px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: threshold === t ? 'rgba(234,179,8,.15)' : 'var(--bg-canvas)', border: `1px solid ${threshold === t ? '#eab308' : 'var(--border)'}`, color: threshold === t ? '#eab308' : 'var(--text-muted)' }}>{t}pts</button>
            ))}
          </div>
        </div>
      </Card>

      {/* Regression log */}
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Detected Regressions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {REGRESSIONS.map((r, i) => (
            <div key={i} style={{ padding: '12px 14px', background: 'rgba(239,68,68,.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--cyan,#06b6d4)' }}>{r.rule}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.page}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-mono)' }}>{r.delta}pts</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.date}</span>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.detail}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Step 4 – Keyboard ────────────────────────────────────────────────────────

function Keyboard() {
  const [catFilter, setCatFilter] = useState<'all' | 'navigation' | 'focus' | 'skip' | 'trap'>('all');
  const filtered = KEYBOARD_TESTS.filter(t => catFilter === 'all' || t.category === catFilter);
  const pass = KEYBOARD_TESTS.filter(t => t.status === 'pass').length;
  const fail = KEYBOARD_TESTS.filter(t => t.status === 'fail').length;
  const warn = KEYBOARD_TESTS.filter(t => t.status === 'warn').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Keyboard Navigation Testing" subtitle="Verify full keyboard operability, focus management, and skip-link functionality." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Pass" value={pass} color="#22c55e" />
        <Stat label="Fail" value={fail} color="#ef4444" />
        <Stat label="Warning" value={warn} color="#eab308" />
        <Stat label="Pass Rate" value={`${Math.round((pass / KEYBOARD_TESTS.length) * 100)}%`} color={pass / KEYBOARD_TESTS.length >= 0.8 ? '#22c55e' : '#f97316'} />
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(['all', 'navigation', 'focus', 'skip', 'trap'] as const).map(c => (
          <button key={c} onClick={() => setCatFilter(c)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', background: catFilter === c ? 'rgba(6,182,212,.15)' : 'var(--bg-elevated)', border: `1px solid ${catFilter === c ? 'var(--cyan,#06b6d4)' : 'var(--border)'}`, color: catFilter === c ? 'var(--cyan,#06b6d4)' : 'var(--text-muted)' }}>{c}</button>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.map(test => (
          <div key={test.id} style={{ display: 'grid', gridTemplateColumns: '28px 90px 80px 1fr', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <StatusBadge status={test.status} />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'capitalize' }}>{test.category}</span>
            <span style={{ fontSize: '10px', color: 'var(--cyan,#06b6d4)', fontFamily: 'var(--font-mono)' }}>{test.component}</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>{test.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{test.description}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Step 5 – Screen Reader ───────────────────────────────────────────────────

function ScreenReader() {
  const [typeFilter, setTypeFilter] = useState<'all' | 'aria' | 'live-region' | 'reader'>('all');
  const filtered = SR_TESTS.filter(t => typeFilter === 'all' || t.type === typeFilter);
  const pass = SR_TESTS.filter(t => t.status === 'pass').length;
  const fail = SR_TESTS.filter(t => t.status === 'fail').length;
  const warn = SR_TESTS.filter(t => t.status === 'warn').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Screen Reader Testing" subtitle="Validate ARIA roles, live regions, and end-to-end screen reader compatibility." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Pass" value={pass} color="#22c55e" />
        <Stat label="Fail" value={fail} color="#ef4444" />
        <Stat label="Warning" value={warn} color="#eab308" />
        <Stat label="Coverage" value={`${SR_TESTS.length} tests`} color="var(--cyan,#06b6d4)" />
      </div>

      {/* WCAG Compliance box */}
      <Card style={{ background: 'rgba(167,139,250,.05)', borderColor: 'rgba(167,139,250,.3)' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>WCAG 2.1 Compliance Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '12px' }}>
          {[
            { level: 'Level A', items: 12, passing: 10 },
            { level: 'Level AA', items: 8, passing: 5 },
            { level: 'Level AAA', items: 4, passing: 1 },
          ].map(l => (
            <div key={l.level} style={{ padding: '10px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: '4px' }}>{l.level}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 800, color: l.passing === l.items ? '#22c55e' : '#f97316' }}>{l.passing}/{l.items}</div>
              <MiniBar value={l.passing} max={l.items} color={l.passing === l.items ? '#22c55e' : '#f97316'} />
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(['all', 'aria', 'live-region', 'reader'] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', background: typeFilter === t ? 'rgba(6,182,212,.15)' : 'var(--bg-elevated)', border: `1px solid ${typeFilter === t ? 'var(--cyan,#06b6d4)' : 'var(--border)'}`, color: typeFilter === t ? 'var(--cyan,#06b6d4)' : 'var(--text-muted)' }}>{t}</button>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.map(test => (
          <div key={test.id} style={{ display: 'grid', gridTemplateColumns: '28px 90px 1fr', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
            <StatusBadge status={test.status} />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', paddingTop: '2px' }}>{test.type}</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '3px' }}>{test.name}</div>
              <div style={{ fontSize: '11px', color: test.status === 'fail' ? '#ef4444' : test.status === 'warn' ? '#eab308' : 'var(--text-muted)', lineHeight: 1.5 }}>{test.detail}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'automated', label: 'Automated', icon: '🤖', short: 'Automated' },
  { id: 'scores', label: 'Score Tracking', icon: '📊', short: 'Scores' },
  { id: 'regression', label: 'Regression', icon: '🔔', short: 'Regression' },
  { id: 'keyboard', label: 'Keyboard', icon: '⌨️', short: 'Keyboard' },
  { id: 'screenreader', label: 'Screen Reader', icon: '♿', short: 'Screen Reader' },
] as const;

type StepId = typeof STEPS[number]['id'];

export default function AccessibilityTesting() {
  const [activeStep, setActiveStep] = useState<StepId>('automated');
  const idx = STEPS.findIndex(s => s.id === activeStep);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <span style={{ fontSize: '22px' }}>♿</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, margin: 0 }}>Accessibility Testing</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Automated a11y scanning, score tracking, regression detection, keyboard & screen reader coverage.</p>
      </div>

      <div style={{ display: 'flex', gap: '0', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {STEPS.map((step, i) => {
          const isActive = activeStep === step.id;
          const isDone = i < idx;
          return (
            <button key={step.id} onClick={() => setActiveStep(step.id)} style={{ flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', background: isActive ? 'rgba(6,182,212,.12)' : 'transparent', borderRight: i < STEPS.length - 1 ? '1px solid var(--border)' : 'none', borderBottom: isActive ? '2px solid var(--cyan,#06b6d4)' : '2px solid transparent', color: isActive ? 'var(--cyan,#06b6d4)' : isDone ? '#22c55e' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'var(--transition)' }}>
              <span style={{ fontSize: '13px' }}>{isDone ? '✅' : step.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{i + 1}. {step.short}</span>
            </button>
          );
        })}
      </div>

      {activeStep === 'automated' && <AutomatedTesting />}
      {activeStep === 'scores' && <ScoreTracking />}
      {activeStep === 'regression' && <Regression />}
      {activeStep === 'keyboard' && <Keyboard />}
      {activeStep === 'screenreader' && <ScreenReader />}

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
        <button disabled={idx === 0} onClick={() => setActiveStep(STEPS[idx - 1].id)} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: idx === 0 ? 0.4 : 1 }}>← Previous</button>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center', fontFamily: 'var(--font-mono)' }}>Step {idx + 1} of {STEPS.length}</span>
        <button disabled={idx === STEPS.length - 1} onClick={() => setActiveStep(STEPS[idx + 1].id)} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, background: idx === STEPS.length - 1 ? 'var(--bg-elevated)' : 'var(--cyan,#06b6d4)', border: '1px solid var(--border)', cursor: idx === STEPS.length - 1 ? 'not-allowed' : 'pointer', color: idx === STEPS.length - 1 ? 'var(--text-muted)' : '#000', opacity: idx === STEPS.length - 1 ? 0.4 : 1 }}>Next →</button>
      </div>
    </div>
  );
}
