import React, { useState, useCallback, useEffect } from 'react';

// ─────────────────────────── Types ───────────────────────────

type ScanStatus = 'idle' | 'running' | 'done' | 'error';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface ScannerResult {
  id: string;
  tool: string;
  icon: string;
  status: ScanStatus;
  findings: number;
  lastRun: string;
  description: string;
}

interface Dependency {
  name: string;
  version: string;
  latestVersion: string;
  vulnerabilities: number;
  license: string;
  licenseRisk: 'ok' | 'warn' | 'alert';
  outdated: boolean;
}

interface SASTFinding {
  id: string;
  rule: string;
  file: string;
  line: number;
  severity: Severity;
  message: string;
  category: 'injection' | 'xss' | 'auth' | 'crypto' | 'config' | 'exposure';
}

interface DASTResult {
  id: string;
  testName: string;
  type: 'pentest' | 'dynamic' | 'fuzzing';
  severity: Severity;
  endpoint: string;
  status: 'pass' | 'fail' | 'warn';
  description: string;
}

interface ScorecardItem {
  category: string;
  icon: string;
  score: number;
  maxScore: number;
  status: 'good' | 'warning' | 'critical';
  tips: string[];
}

// ─────────────────────────── Mock Data ───────────────────────

const MOCK_SCANNERS: ScannerResult[] = [
  { id: 'snyk', tool: 'Snyk', icon: '🔍', status: 'done', findings: 3, lastRun: '2 min ago', description: 'Container & code vulnerability analysis' },
  { id: 'dependabot', tool: 'Dependabot', icon: '🤖', status: 'done', findings: 7, lastRun: '1 hr ago', description: 'Automated dependency updates & alerts' },
  { id: 'semgrep', tool: 'Semgrep', icon: '🧬', status: 'done', findings: 2, lastRun: '30 min ago', description: 'Custom pattern-based security scanner' },
  { id: 'trivy', tool: 'Trivy', icon: '🛡️', status: 'idle', findings: 0, lastRun: 'Never', description: 'All-in-one vulnerability & secret scanner' },
];

const MOCK_DEPS: Dependency[] = [
  { name: '@stellar/stellar-sdk', version: '11.0.0', latestVersion: '12.3.1', vulnerabilities: 0, license: 'Apache-2.0', licenseRisk: 'ok', outdated: true },
  { name: 'react', version: '18.2.0', latestVersion: '18.3.0', vulnerabilities: 0, license: 'MIT', licenseRisk: 'ok', outdated: true },
  { name: 'lodash', version: '4.17.20', latestVersion: '4.17.21', vulnerabilities: 1, license: 'MIT', licenseRisk: 'ok', outdated: true },
  { name: 'axios', version: '1.4.0', latestVersion: '1.7.2', vulnerabilities: 2, license: 'MIT', licenseRisk: 'ok', outdated: true },
  { name: 'jsonwebtoken', version: '9.0.0', latestVersion: '9.0.2', vulnerabilities: 0, license: 'MIT', licenseRisk: 'ok', outdated: false },
  { name: 'ws', version: '8.11.0', latestVersion: '8.18.0', vulnerabilities: 1, license: 'MIT', licenseRisk: 'ok', outdated: true },
  { name: 'crypto-browserify', version: '3.12.0', latestVersion: '3.12.0', vulnerabilities: 0, license: 'MIT', licenseRisk: 'ok', outdated: false },
  { name: 'helmet', version: '7.0.0', latestVersion: '7.1.0', vulnerabilities: 0, license: 'MIT', licenseRisk: 'ok', outdated: true },
];

const MOCK_SAST: SASTFinding[] = [
  { id: 's1', rule: 'no-hardcoded-credentials', file: 'src/lib/stellar.ts', line: 42, severity: 'critical', message: 'Potential hardcoded API secret in source file.', category: 'exposure' },
  { id: 's2', rule: 'insecure-randomness', file: 'src/utils/crypto.ts', line: 17, severity: 'high', message: 'Math.random() used for security-sensitive context.', category: 'crypto' },
  { id: 's3', rule: 'xss-dangerouslySetInnerHTML', file: 'src/components/dashboard/Builder.tsx', line: 209, severity: 'medium', message: 'dangerouslySetInnerHTML with user-controlled content.', category: 'xss' },
  { id: 's4', rule: 'eval-usage', file: 'src/plugins/index.ts', line: 88, severity: 'high', message: 'eval() call detected – potential code injection vector.', category: 'injection' },
  { id: 's5', rule: 'weak-cipher', file: 'src/lib/crypto.ts', line: 5, severity: 'medium', message: 'MD5 used for data integrity; consider SHA-256.', category: 'crypto' },
  { id: 's6', rule: 'debug-code-detected', file: 'src/main.jsx', line: 31, severity: 'low', message: 'console.log left in production build.', category: 'config' },
  { id: 's7', rule: 'cors-misconfiguration', file: 'src/lib/stellar.ts', line: 71, severity: 'medium', message: 'Wildcard CORS origin detected in fetch options.', category: 'config' },
];

const MOCK_DAST: DASTResult[] = [
  { id: 'd1', testName: 'XSS Injection Suite', type: 'pentest', severity: 'high', endpoint: '/api/transactions', status: 'fail', description: 'Reflected XSS payload returned unsanitised in error response.' },
  { id: 'd2', testName: 'SQL / NoSQL Injection', type: 'dynamic', severity: 'medium', endpoint: '/api/accounts', status: 'warn', description: 'Partial input sanitisation; parameterised queries missing in one branch.' },
  { id: 'd3', testName: 'CSRF Token Validation', type: 'pentest', severity: 'critical', endpoint: '/api/sign', status: 'pass', description: 'All state-changing endpoints enforce CSRF tokens.' },
  { id: 'd4', testName: 'Rate Limiting Check', type: 'dynamic', severity: 'medium', endpoint: '/api/*', status: 'fail', description: 'No rate limiting detected on authentication endpoints.' },
  { id: 'd5', testName: 'TLS/SSL Configuration', type: 'dynamic', severity: 'info', endpoint: 'wss://horizon.stellar.org', status: 'pass', description: 'TLS 1.3 enforced; HSTS header present.' },
  { id: 'd6', testName: 'Header Security Scan', type: 'dynamic', severity: 'low', endpoint: '/*', status: 'warn', description: 'Content-Security-Policy header is overly permissive.' },
  { id: 'd7', testName: 'Auth Bypass Fuzzing', type: 'fuzzing', severity: 'high', endpoint: '/api/wallet', status: 'pass', description: 'No authentication bypass vectors found across 4,200 test cases.' },
];

const MOCK_SCORECARD: ScorecardItem[] = [
  { category: 'Dependency Health', icon: '📦', score: 72, maxScore: 100, status: 'warning', tips: ['Update 5 outdated packages', 'Patch 4 known vulnerabilities'] },
  { category: 'Code Security (SAST)', icon: '🔎', score: 58, maxScore: 100, status: 'critical', tips: ['Resolve 2 critical findings', 'Fix hardcoded credential risk'] },
  { category: 'Runtime Security (DAST)', icon: '⚡', score: 65, maxScore: 100, status: 'warning', tips: ['Add rate limiting on /api/sign', 'Tighten CSP header policy'] },
  { category: 'Secret Management', icon: '🔐', score: 90, maxScore: 100, status: 'good', tips: ['Rotate tokens older than 90 days'] },
  { category: 'Supply Chain', icon: '🔗', score: 80, maxScore: 100, status: 'good', tips: ['Enable SBOM generation', 'Pin all transitive dependencies'] },
  { category: 'Compliance & Licensing', icon: '⚖️', score: 95, maxScore: 100, status: 'good', tips: ['All licenses are OSI-approved'] },
];

// ─────────────────────────── Helpers ─────────────────────────

const SEV_PALETTE: Record<Severity | string, { bg: string; color: string; border: string }> = {
  critical: { bg: 'rgba(239,68,68,.12)', color: 'var(--red, #ef4444)', border: 'rgba(239,68,68,.35)' },
  high:     { bg: 'rgba(249,115,22,.12)', color: '#f97316', border: 'rgba(249,115,22,.35)' },
  medium:   { bg: 'rgba(234,179,8,.12)', color: 'var(--amber, #eab308)', border: 'rgba(234,179,8,.35)' },
  low:      { bg: 'rgba(6,182,212,.1)', color: 'var(--cyan, #06b6d4)', border: 'rgba(6,182,212,.3)' },
  info:     { bg: 'var(--bg-elevated)', color: 'var(--text-muted)', border: 'var(--border)' },
  pass:     { bg: 'rgba(34,197,94,.1)', color: '#22c55e', border: 'rgba(34,197,94,.3)' },
  fail:     { bg: 'rgba(239,68,68,.12)', color: 'var(--red, #ef4444)', border: 'rgba(239,68,68,.35)' },
  warn:     { bg: 'rgba(234,179,8,.12)', color: 'var(--amber, #eab308)', border: 'rgba(234,179,8,.35)' },
};

const Badge = ({ label, variant }: { label: string; variant: string }) => {
  const p = SEV_PALETTE[variant] ?? SEV_PALETTE.info;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
      fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px',
      background: p.bg, color: p.color, border: `1px solid ${p.border}`,
    }}>{label}</span>
  );
};

const ScoreRing = ({ score, max, status }: { score: number; max: number; status: string }) => {
  const pct = (score / max) * 100;
  const r = 28; const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const color = status === 'good' ? '#22c55e' : status === 'warning' ? '#eab308' : '#ef4444';
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x="36" y="40" textAnchor="middle" fill={color} fontSize="14" fontWeight="700"
        style={{ transform: 'rotate(90deg)', transformOrigin: '36px 36px', fontFamily: 'var(--font-mono)' }}>
        {score}
      </text>
    </svg>
  );
};

const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div style={{ height: '6px', background: 'var(--bg-canvas)', borderRadius: '4px', overflow: 'hidden', width: '100%' }}>
    <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.8s ease' }} />
  </div>
);

const SectionHeader = ({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: string }) => (
  <div style={{ marginBottom: '20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>{title}</div>
      {badge && <Badge label={badge} variant="info" />}
    </div>
    {subtitle && <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{subtitle}</p>}
  </div>
);

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', ...style }}>
    {children}
  </div>
);

// ─────────────────────────── Step 1 – Security Scanning ──────

function SecurityScanning() {
  const [scanners, setScanners] = useState<ScannerResult[]>(MOCK_SCANNERS);
  const [running, setRunning] = useState<string | null>(null);

  const runScan = useCallback((id: string) => {
    setRunning(id);
    setScanners(prev => prev.map(s => s.id === id ? { ...s, status: 'running' } : s));
    setTimeout(() => {
      setScanners(prev => prev.map(s => s.id === id ? {
        ...s, status: 'done',
        findings: Math.floor(Math.random() * 8),
        lastRun: 'just now',
      } : s));
      setRunning(null);
    }, 2200);
  }, []);

  const totalFindings = scanners.reduce((a, b) => a + b.findings, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader
        title="Security Scanning"
        subtitle="Continuous scanning across your codebase using industry-leading tools."
      />

      {/* Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Total Findings', value: totalFindings, color: totalFindings > 5 ? '#ef4444' : '#eab308' },
          { label: 'Active Scanners', value: scanners.filter(s => s.status === 'done').length, color: '#22c55e' },
          { label: 'Critical', value: 3, color: '#ef4444' },
          { label: 'Last Scan', value: '2m ago', color: 'var(--cyan, #06b6d4)' },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Scanner Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
        {scanners.map(scanner => (
          <Card key={scanner.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>{scanner.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{scanner.tool}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{scanner.description}</div>
                </div>
              </div>
              <StatusDot status={scanner.status} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Findings</div>
                <div style={{ fontWeight: 700, color: scanner.findings > 0 ? '#f97316' : '#22c55e', fontFamily: 'var(--font-mono)' }}>
                  {scanner.findings > 0 ? scanner.findings : '✓ Clean'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Last Run</div>
                <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{scanner.lastRun}</div>
              </div>
            </div>

            <button
              onClick={() => scanner.status !== 'running' && runScan(scanner.id)}
              disabled={scanner.status === 'running'}
              style={{
                padding: '8px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600,
                border: '1px solid var(--border)', cursor: scanner.status === 'running' ? 'wait' : 'pointer',
                background: scanner.status === 'running' ? 'var(--bg-canvas)' : 'var(--bg-hover)',
                color: scanner.status === 'running' ? 'var(--text-muted)' : 'var(--text-primary)',
                transition: 'var(--transition)',
              }}
            >
              {scanner.status === 'running' ? '⏳ Scanning…' : '▶ Run Scan'}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: ScanStatus }) {
  const map: Record<ScanStatus, { color: string; label: string }> = {
    idle: { color: 'var(--text-muted)', label: 'Idle' },
    running: { color: '#06b6d4', label: 'Running' },
    done: { color: '#22c55e', label: 'Done' },
    error: { color: '#ef4444', label: 'Error' },
  };
  const { color, label } = map[status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%', background: color,
        boxShadow: status === 'running' ? `0 0 8px ${color}` : 'none',
        animation: status === 'running' ? 'pulse 1.5s infinite' : 'none',
      }} />
      <span style={{ fontSize: '10px', color, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

// ─────────────────────────── Step 2 – Dependency Scanning ────

function DependencyScanning() {
  const [filter, setFilter] = useState<'all' | 'vulnerable' | 'outdated'>('all');
  const [search, setSearch] = useState('');

  const filtered = MOCK_DEPS.filter(d => {
    if (filter === 'vulnerable' && d.vulnerabilities === 0) return false;
    if (filter === 'outdated' && !d.outdated) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const vulnTotal = MOCK_DEPS.reduce((a, b) => a + b.vulnerabilities, 0);
  const outdatedTotal = MOCK_DEPS.filter(d => d.outdated).length;
  const licenseWarnings = MOCK_DEPS.filter(d => d.licenseRisk !== 'ok').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader
        title="Dependency Scanning"
        subtitle="Vulnerability, license, and freshness analysis for all project dependencies."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Total Deps', value: MOCK_DEPS.length, color: 'var(--cyan, #06b6d4)' },
          { label: 'Vulnerabilities', value: vulnTotal, color: vulnTotal > 0 ? '#ef4444' : '#22c55e' },
          { label: 'Outdated', value: outdatedTotal, color: outdatedTotal > 0 ? '#eab308' : '#22c55e' },
          { label: 'License Warnings', value: licenseWarnings, color: licenseWarnings > 0 ? '#f97316' : '#22c55e' },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '12px' }}>🔍</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter dependencies..."
            style={{ width: '100%', padding: '8px 12px 8px 30px', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {(['all', 'vulnerable', 'outdated'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600,
            cursor: 'pointer', transition: 'var(--transition)', textTransform: 'capitalize',
            background: filter === f ? 'var(--cyan-glow-sm, rgba(6,182,212,.15))' : 'var(--bg-elevated)',
            border: `1px solid ${filter === f ? 'var(--cyan, #06b6d4)' : 'var(--border)'}`,
            color: filter === f ? 'var(--cyan, #06b6d4)' : 'var(--text-secondary)',
          }}>{f}</button>
        ))}
      </div>

      {/* Table */}
      <Card style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr style={{ background: 'var(--bg-canvas)', borderBottom: '1px solid var(--border)' }}>
                {['Package', 'Current', 'Latest', 'Vulns', 'License', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((dep, i) => (
                <tr key={dep.name} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.01)', transition: 'background 0.15s' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>{dep.name}</td>
                  <td style={{ padding: '10px 14px', color: dep.outdated ? '#eab308' : 'var(--text-secondary)' }}>{dep.version}</td>
                  <td style={{ padding: '10px 14px', color: '#22c55e' }}>{dep.latestVersion}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {dep.vulnerabilities > 0
                      ? <Badge label={`${dep.vulnerabilities} vuln`} variant="high" />
                      : <span style={{ color: '#22c55e' }}>✓</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{dep.license}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {dep.vulnerabilities > 0
                      ? <Badge label="Vulnerable" variant="critical" />
                      : dep.outdated
                        ? <Badge label="Outdated" variant="medium" />
                        : <Badge label="OK" variant="pass" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────── Step 3 – SAST ───────────────────

const CAT_ICONS: Record<string, string> = {
  injection: '💉', xss: '🕸️', auth: '🔑', crypto: '🔒', config: '⚙️', exposure: '📤',
};

function SAST() {
  const [selected, setSelected] = useState<SASTFinding | null>(null);
  const [sevFilter, setSevFilter] = useState<Severity | 'all'>('all');

  const filtered = SAST_findings().filter(f => sevFilter === 'all' || f.severity === sevFilter);

  function SAST_findings() { return MOCK_SAST; }

  const counts = MOCK_SAST.reduce((acc, f) => { acc[f.severity] = (acc[f.severity] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader
        title="Static Application Security Testing"
        subtitle="Source code analysis for security vulnerabilities, insecure patterns, and linting failures."
      />

      {/* Breakdown pills */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map(sev => (
          <button key={sev} onClick={() => setSevFilter(sev)} style={{
            padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
            cursor: 'pointer', transition: 'var(--transition)', textTransform: 'uppercase', letterSpacing: '0.4px',
            background: sevFilter === sev ? (SEV_PALETTE[sev]?.bg ?? 'var(--bg-elevated)') : 'var(--bg-elevated)',
            border: `1px solid ${sevFilter === sev ? (SEV_PALETTE[sev]?.border ?? 'var(--border)') : 'var(--border)'}`,
            color: sevFilter === sev ? (SEV_PALETTE[sev]?.color ?? 'var(--text-muted)') : 'var(--text-muted)',
          }}>
            {sev === 'all' ? `All (${MOCK_SAST.length})` : `${sev} (${counts[sev] ?? 0})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: '14px' }}>
        {/* Findings list */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map(finding => (
            <div key={finding.id} onClick={() => setSelected(selected?.id === finding.id ? null : finding)}
              style={{
                display: 'grid', gridTemplateColumns: '32px 90px 80px 1fr 100px', gap: '12px',
                padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center',
                background: selected?.id === finding.id ? 'var(--cyan-glow-sm, rgba(6,182,212,.08))' : 'transparent',
                transition: 'background 0.15s',
              }}>
              <span style={{ fontSize: '16px' }}>{CAT_ICONS[finding.category]}</span>
              <Badge label={finding.severity} variant={finding.severity} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{finding.category}</span>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{finding.message}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{finding.rule}</div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--cyan, #06b6d4)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                :{finding.line}
              </div>
            </div>
          ))}
        </Card>

        {/* Detail panel */}
        {selected && (
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Finding Detail</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }}>✕</button>
            </div>
            <Badge label={selected.severity} variant={selected.severity} />
            <InfoRow label="Rule" value={selected.rule} />
            <InfoRow label="Category" value={selected.category} />
            <InfoRow label="File" value={`${selected.file}:${selected.line}`} mono />
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Description</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-canvas)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', lineHeight: 1.6 }}>
                {selected.message}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}

// ─────────────────────────── Step 4 – DAST ───────────────────

function DAST() {
  const [selected, setSelected] = useState<DASTResult | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'pentest' | 'dynamic' | 'fuzzing'>('all');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const filtered = MOCK_DAST.filter(d => typeFilter === 'all' || d.type === typeFilter);
  const passPct = Math.round((MOCK_DAST.filter(d => d.status === 'pass').length / MOCK_DAST.length) * 100);

  const runTests = () => {
    setRunning(true); setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => { if (prev >= 100) { clearInterval(interval); setRunning(false); return 100; } return prev + 5; });
    }, 80);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader
        title="Dynamic Application Security Testing"
        subtitle="Runtime analysis, automated penetration testing, and security test suites."
      />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Pass Rate', value: `${passPct}%`, color: passPct >= 80 ? '#22c55e' : '#eab308' },
          { label: 'Tests Run', value: MOCK_DAST.length, color: 'var(--cyan, #06b6d4)' },
          { label: 'Failures', value: MOCK_DAST.filter(d => d.status === 'fail').length, color: '#ef4444' },
          { label: 'Warnings', value: MOCK_DAST.filter(d => d.status === 'warn').length, color: '#eab308' },
        ].map(s => (
          <Card key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'pentest', 'dynamic', 'fuzzing'] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            transition: 'var(--transition)', textTransform: 'capitalize',
            background: typeFilter === t ? 'var(--cyan-glow-sm, rgba(6,182,212,.15))' : 'var(--bg-elevated)',
            border: `1px solid ${typeFilter === t ? 'var(--cyan, #06b6d4)' : 'var(--border)'}`,
            color: typeFilter === t ? 'var(--cyan, #06b6d4)' : 'var(--text-muted)',
          }}>{t}</button>
        ))}
        <button onClick={runTests} disabled={running} style={{
          marginLeft: 'auto', padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700,
          background: running ? 'var(--bg-canvas)' : 'var(--cyan, #06b6d4)', color: running ? 'var(--text-muted)' : '#000',
          border: 'none', cursor: running ? 'wait' : 'pointer', transition: 'var(--transition)',
        }}>
          {running ? `⏳ Running… ${progress}%` : '▶ Run All Tests'}
        </button>
      </div>

      {running && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: '6px' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--cyan, #06b6d4)', transition: 'width 0.1s' }} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap: '14px' }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map(test => (
            <div key={test.id} onClick={() => setSelected(selected?.id === test.id ? null : test)}
              style={{
                display: 'grid', gridTemplateColumns: '80px 90px 80px 1fr', gap: '12px',
                padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center',
                background: selected?.id === test.id ? 'var(--cyan-glow-sm, rgba(6,182,212,.08))' : 'transparent',
                transition: 'background 0.15s',
              }}>
              <Badge label={test.status} variant={test.status} />
              <Badge label={test.severity} variant={test.severity} />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'capitalize' }}>{test.type}</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{test.testName}</div>
                <div style={{ fontSize: '11px', color: 'var(--cyan, #06b6d4)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{test.endpoint}</div>
              </div>
            </div>
          ))}
        </Card>

        {selected && (
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Test Detail</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }}>✕</button>
            </div>
            <Badge label={selected.status.toUpperCase()} variant={selected.status} />
            <InfoRow label="Test Name" value={selected.testName} />
            <InfoRow label="Type" value={selected.type} />
            <InfoRow label="Severity" value={selected.severity} />
            <InfoRow label="Endpoint" value={selected.endpoint} mono />
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Finding</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-canvas)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', lineHeight: 1.6 }}>
                {selected.description}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Step 5 – Scorecard ──────────────

function Scorecard() {
  const overall = Math.round(MOCK_SCORECARD.reduce((a, b) => a + b.score, 0) / MOCK_SCORECARD.length);
  const overallStatus = overall >= 85 ? 'good' : overall >= 65 ? 'warning' : 'critical';
  const overallColor = overallStatus === 'good' ? '#22c55e' : overallStatus === 'warning' ? '#eab308' : '#ef4444';

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionHeader
        title="Security Scorecard"
        subtitle="A holistic view of your project's security posture with actionable improvement recommendations."
      />

      {/* Overall score */}
      <Card style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '24px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <ScoreRing score={overall} max={100} status={overallStatus} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Overall Security Score</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: overallColor, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{overall}<span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-muted)' }}>/100</span></div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {MOCK_SCORECARD.map(c => (
              <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.status === 'good' ? '#22c55e' : c.status === 'warning' ? '#eab308' : '#ef4444' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{c.category}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', flexShrink: 0 }}>
          {(['good', 'warning', 'critical'] as const).map(s => ({
            s, count: MOCK_SCORECARD.filter(c => c.status === s).length,
            color: s === 'good' ? '#22c55e' : s === 'warning' ? '#eab308' : '#ef4444',
            label: s === 'good' ? '✓ Good' : s === 'warning' ? '⚠ Warning' : '✕ Critical',
          })).map(({ s, count, color, label }) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{label}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Category breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {MOCK_SCORECARD.map(item => {
          const isOpen = expanded === item.category;
          const color = item.status === 'good' ? '#22c55e' : item.status === 'warning' ? '#eab308' : '#ef4444';
          return (
            <Card key={item.category} style={{ cursor: 'pointer', padding: '14px 18px', transition: 'border-color 0.2s', borderColor: isOpen ? 'var(--cyan, #06b6d4)' : 'var(--border)' }}
              onClick={() => setExpanded(isOpen ? null : item.category)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.category}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{item.score}/{item.maxScore}</span>
                  </div>
                  <ProgressBar value={item.score} max={item.maxScore} color={color} />
                </div>
                <Badge label={item.status} variant={item.status === 'good' ? 'pass' : item.status === 'warning' ? 'medium' : 'critical'} />
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '4px' }}>{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && (
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Improvement Tips</div>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {item.tips.map((tip, i) => (
                      <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────── Main Component ──────────────────

const STEPS = [
  { id: 'scanning', label: 'Security Scanning', icon: '🔍', shortLabel: 'Scanning' },
  { id: 'deps', label: 'Dependency Scanning', icon: '📦', shortLabel: 'Dependencies' },
  { id: 'sast', label: 'SAST', icon: '🔎', shortLabel: 'SAST' },
  { id: 'dast', label: 'DAST', icon: '⚡', shortLabel: 'DAST' },
  { id: 'scorecard', label: 'Scorecard', icon: '📊', shortLabel: 'Scorecard' },
] as const;

type StepId = typeof STEPS[number]['id'];

export default function SecurityDashboard() {
  const [activeStep, setActiveStep] = useState<StepId>('scanning');

  const activeStepIdx = STEPS.findIndex(s => s.id === activeStep);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <span style={{ fontSize: '24px' }}>🛡️</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, margin: 0 }}>Security Dashboard</h1>
          <Badge label="5 Checks" variant="info" />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
          End-to-end security pipeline — scanning, analysis, testing, and scoring in one place.
        </p>
      </div>

      {/* Step navigation */}
      <div style={{ display: 'flex', gap: '0', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {STEPS.map((step, idx) => {
          const isActive = activeStep === step.id;
          const isDone = idx < activeStepIdx;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              style={{
                flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer',
                background: isActive ? 'var(--cyan-glow-sm, rgba(6,182,212,.15))' : 'transparent',
                borderRight: idx < STEPS.length - 1 ? '1px solid var(--border)' : 'none',
                borderBottom: isActive ? '2px solid var(--cyan, #06b6d4)' : '2px solid transparent',
                transition: 'var(--transition)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                color: isActive ? 'var(--cyan, #06b6d4)' : isDone ? '#22c55e' : 'var(--text-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px' }}>{isDone ? '✅' : step.icon}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {idx + 1}. {step.shortLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div>
        {activeStep === 'scanning' && <SecurityScanning />}
        {activeStep === 'deps' && <DependencyScanning />}
        {activeStep === 'sast' && <SAST />}
        {activeStep === 'dast' && <DAST />}
        {activeStep === 'scorecard' && <Scorecard />}
      </div>

      {/* Step navigation arrows */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
        <button
          disabled={activeStepIdx === 0}
          onClick={() => setActiveStep(STEPS[activeStepIdx - 1].id)}
          style={{
            padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: activeStepIdx === 0 ? 'not-allowed' : 'pointer',
            color: activeStepIdx === 0 ? 'var(--text-muted)' : 'var(--text-primary)', transition: 'var(--transition)', opacity: activeStepIdx === 0 ? 0.4 : 1,
          }}
        >← Previous</button>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center', fontFamily: 'var(--font-mono)' }}>
          Step {activeStepIdx + 1} of {STEPS.length}
        </span>
        <button
          disabled={activeStepIdx === STEPS.length - 1}
          onClick={() => setActiveStep(STEPS[activeStepIdx + 1].id)}
          style={{
            padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600,
            background: activeStepIdx === STEPS.length - 1 ? 'var(--bg-elevated)' : 'var(--cyan, #06b6d4)',
            border: '1px solid var(--border)', cursor: activeStepIdx === STEPS.length - 1 ? 'not-allowed' : 'pointer',
            color: activeStepIdx === STEPS.length - 1 ? 'var(--text-muted)' : '#000',
            transition: 'var(--transition)', opacity: activeStepIdx === STEPS.length - 1 ? 0.4 : 1,
          }}
        >Next →</button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
