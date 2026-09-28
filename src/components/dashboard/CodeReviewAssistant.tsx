/**
 * CodeReviewAssistant.tsx
 *
 * Full dashboard component for the AI-Powered Code Review Assistant.
 * Provides a rich UI for analyzing code, viewing issues, tracking
 * checklist progress, and exporting reports.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { runCodeReview, generateTopRecommendations, toJSON, toMarkdown, toHTML } from '../../lib/codeReview';
import type { CodeReviewResult, CodeReviewIssue, SourceFile } from '../../lib/codeReview';

const PALETTE = ['#06b6d4', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb7185', '#60a5fa', '#facc15'];

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#f87171',
  high: '#fbbf24',
  medium: '#60a5fa',
  low: '#9ca3af',
  info: '#34d399',
};

const CATEGORY_ICONS: Record<string, string> = {
  security: '🔒',
  performance: '⚡',
  maintainability: '🔧',
  reliability: '🛡️',
  'stellar-best-practice': '★',
  'type-safety': '📝',
  'code-style': '🎨',
  testing: '🧪',
  documentation: '📄',
  complexity: '🧩',
  'potential-bug': '🐛',
};

const DEMO_FILES: SourceFile[] = [
  {
    path: 'src/lib/stellar/operations.ts',
    language: 'ts',
    source: `
import { Server } from '@stellar/stellar-sdk';

export async function submitPayment(server: Server, account: any, destination: string, amount: string) {
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(StellarSdk.Operation.payment({
      destination,
      asset: StellarSdk.Asset.native(),
      amount,
    }))
    .setTimeout(30)
    .build();

  const result = await server.submitTransaction(tx);
  return result.hash;
}

export async function fetchAccountDetails(server: Server, publicKey: string) {
  // TODO: add validation
  const account = await server.loadAccount(publicKey);
  return {
    id: account.id,
    sequence: account.sequenceNumber,
    balances: account.balances,
  };
}

export function calculateReserve(entries: any[]) {
  var baseReserve = 0.5;
  var total = baseReserve * (2 + entries.length);
  console.log('Reserve:', total);
  return total;
}

export function processAssetList(assets: any[], filters: any) {
  var results = [];
  for (var i = 0; i < assets.length; i++) {
    if (filters.minLiquidity && assets[i].liquidity < filters.minLiquidity) continue;
    if (filters.maxVolatility && assets[i].volatility > filters.maxVolatility) continue;
    if (filters.onlyTrusted && !assets[i].isTrusted) continue;
    if (filters.excludeCodes && filters.excludeCodes.includes(assets[i].code)) continue;
    results.push(assets[i]);
  }
  return results;
}
`.trim(),
  },
  {
    path: 'src/components/AccountView.tsx',
    language: 'tsx',
    source: `
import React, { useState, useEffect } from 'react';

interface AccountData {
  id: string;
  balances: Array<{ asset_type: string; balance: string }>;
}

export default function AccountView({ publicKey }: { publicKey: string }) {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const response = await fetch(\`/api/accounts/\${publicKey}\`);
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load account');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [publicKey]);

  function renderBalances() {
    return data?.balances?.map((b, i) => (
      <div key={i}>
        <span>{b.asset_type}: {b.balance}</span>
      </div>
    ));
  }

  function renderStatus(value: any) {
    if (value === null) return <span className="badge">N/A</span>;
    if (value === undefined) return <span className="badge">Unknown</span>;
    return String(value);
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!data) return null;

  return (
    <div className="account-view">
      <h2>Account {publicKey.slice(0, 8)}...</h2>
      <div className="balances">
        {renderBalances()}
      </div>
      <div className="status">
        {renderStatus(data.id)}
      </div>
    </div>
  );
}
`.trim(),
  },
  {
    path: 'src/lib/soroban/contractClient.ts',
    language: 'ts',
    source: `
import { SorobanRpc } from '@stellar/stellar-sdk';
import { nativeToScVal, scValToNative } from '@stellar/stellar-sdk/contract';

const API_KEY = 'sk-1234-test-key';

export class ContractClient {
  private server: SorobanRpc.Server;
  private contractId: string;

  constructor(rpcUrl: string, contractId: string) {
    this.server = new SorobanRpc.Server(rpcUrl);
    this.contractId = contractId;
  }

  async callFunction(funcName: string, ...args: any[]) {
    // No simulateTransaction called
    const tx = this.buildTransaction(funcName, args);
    const result = await this.server.sendTransaction(tx);
    if (result.status === 'SUCCESS') {
      return scValToNative(result.result!.retval);
    }
    throw new Error('Contract call failed');
  }

  private buildTransaction(funcName: string, args: any[]) {
    const scArgs = args.map(a => nativeToScVal(a));
    // Missing: fetch account, set proper fee, timeout
    return {
      func: funcName,
      args: scArgs,
    };
  }
}

const secretKey = 'SAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
`.trim(),
  },
];

type Tab = 'overview' | 'issues' | 'checklist' | 'best-practices' | 'metrics' | 'report';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CodeReviewAssistant() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const result = useMemo(() => runCodeReview(DEMO_FILES, {
    stellarBestPractices: true,
    generateChecklist: true,
    passThreshold: 70,
  }), []);

  const filteredIssues = useMemo(() => {
    let list = result.issues;
    if (filterSeverity !== 'all') {
      list = list.filter((i) => i.severity === filterSeverity);
    }
    if (filterCategory !== 'all') {
      list = list.filter((i) => i.category === filterCategory);
    }
    return list;
  }, [result, filterSeverity, filterCategory]);

  const topRecs = useMemo(
    () => generateTopRecommendations(result.issues, 5),
    [result]
  );

  const downloadReport = useCallback(
    (format: 'json' | 'markdown' | 'html') => {
      let content: string;
      let mime: string;
      let ext: string;
      switch (format) {
        case 'json':
          content = toJSON(result);
          mime = 'application/json';
          ext = 'json';
          break;
        case 'markdown':
          content = toMarkdown(result);
          mime = 'text/markdown';
          ext = 'md';
          break;
        case 'html':
          content = toHTML(result);
          mime = 'text/html';
          ext = 'html';
          break;
      }
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `code-review-${result.analyzedAt.slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportMenu(false);
    },
    [result]
  );

  // Close export menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🔍</span> AI Code Review Assistant
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            ML-powered static analysis, review checklists, and Stellar best practices
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }} ref={exportRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            style={btnStyle('secondary')}
          >
            📥 Export Report
          </button>
          {showExportMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              zIndex: 100,
              minWidth: 160,
              overflow: 'hidden',
            }}>
              {(['json', 'markdown', 'html'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => downloadReport(fmt)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 16px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {fmt === 'json' ? '📋 JSON' : fmt === 'markdown' ? '📝 Markdown' : '🌐 HTML'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Score Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <ScoreCard
          label="Code Health"
          value={`${result.codeHealthScore}/100`}
          accent={result.codeHealthScore >= 70 ? '#34d399' : result.codeHealthScore >= 45 ? '#fbbf24' : '#f87171'}
        />
        <ScoreCard
          label="Issues Found"
          value={result.issues.length}
          accent="#a78bfa"
        />
        <ScoreCard
          label="Pass Rate"
          value={`${result.passRate}%`}
          accent={result.passRate >= 70 ? '#34d399' : result.passRate >= 45 ? '#fbbf24' : '#f87171'}
        />
        <ScoreCard
          label="Files Analyzed"
          value={result.analyzedFiles.length}
          accent="#06b6d4"
        />
        <ScoreCard
          label="Review Gate"
          value={result.passesGate ? '✅ PASS' : '❌ FAIL'}
          accent={result.passesGate ? '#34d399' : '#f87171'}
          small
        />
      </div>

      {/* Top Recommendations Banner */}
      {topRecs.length > 0 && (
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 14,
          background: 'var(--bg-elevated)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
            🎯 Top Recommendations
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topRecs.map((rec, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <nav style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        alignSelf: 'flex-start',
        flexWrap: 'wrap',
      }}>
        {(['overview', 'issues', 'checklist', 'best-practices', 'metrics', 'report'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={activeTab === t ? tabActiveStyle() : tabStyle()}
          >
            {tabLabelIcon(t)} {tabLabelText(t)}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab result={result} />
      )}

      {activeTab === 'issues' && (
        <IssuesTab
          issues={filteredIssues}
          allIssues={result.issues}
          filterSeverity={filterSeverity}
          onFilterSeverity={setFilterSeverity}
          filterCategory={filterCategory}
          onFilterCategory={setFilterCategory}
        />
      )}

      {activeTab === 'checklist' && (
        <ChecklistTab result={result} />
      )}

      {activeTab === 'best-practices' && (
        <BestPracticesTab result={result} />
      )}

      {activeTab === 'metrics' && (
        <MetricsTab result={result} />
      )}

      {activeTab === 'report' && (
        <ReportTab result={result} />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreCard({ label, value, accent, small }: {
  label: string;
  value: string | number;
  accent: string;
  small?: boolean;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: small ? '12px 14px' : 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{
        fontSize: small ? 18 : 26,
        fontWeight: 700,
        color: accent,
        lineHeight: 1.1,
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ result }: { result: CodeReviewResult }) {
  const severityData = Object.entries(result.severityBreakdown)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name: capitalize(name), value, fill: SEVERITY_COLORS[name] }));

  const categoryData = Object.entries(result.categoryBreakdown)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
      {/* Severity Pie Chart */}
      <section style={cardStyle()}>
        <h3 style={sectionTitle()}>🚦 Issues by Severity</h3>
        {severityData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={severityData}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                innerRadius={50}
                paddingAngle={2}
              >
                {severityData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill || PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                }}
              />
              <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
            ✅ No issues detected!
          </p>
        )}
      </section>

      {/* Category Bar Chart */}
      <section style={cardStyle()}>
        <h3 style={sectionTitle()}>📂 Issues by Category</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={categoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} angle={-20} textAnchor="end" height={60} />
            <YAxis stroke="var(--text-secondary)" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
              }}
            />
            <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Checklist Summary */}
      <section style={cardStyle()}>
        <h3 style={sectionTitle()}>✅ Checklist Progress</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {(['pass', 'fail', 'warning', 'unknown'] as const).map((status) => {
            const count = result.checklist.filter((i) => i.autoStatus === status).length;
            if (count === 0) return null;
            return (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>
                  {status === 'pass' ? '✅' : status === 'fail' ? '❌' : status === 'warning' ? '⚠️' : '❓'}
                </span>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {capitalize(status)}
                </span>
                <span style={{ fontWeight: 700, fontSize: 14, color: SEVERITY_COLORS[status === 'pass' ? 'info' : status === 'fail' ? 'critical' : 'medium'] }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Summary */}
      <section style={cardStyle()}>
        <h3 style={sectionTitle()}>📋 Summary</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {result.summary}
        </p>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          <div>Total effort: ~{result.totalEstimatedEffortMinutes} minutes</div>
          <div>Files: {result.analyzedFiles.length} · Issues: {result.issues.length} · Checklist: {result.checklist.length} items</div>
        </div>
      </section>
    </div>
  );
}

// ─── Issues Tab ──────────────────────────────────────────────────────────────

function IssuesTab({
  issues,
  allIssues,
  filterSeverity,
  onFilterSeverity,
  filterCategory,
  onFilterCategory,
}: {
  issues: CodeReviewIssue[];
  allIssues: CodeReviewIssue[];
  filterSeverity: string;
  onFilterSeverity: (v: string) => void;
  filterCategory: string;
  onFilterCategory: (v: string) => void;
}) {
  const categories = [...new Set(allIssues.map((i) => i.category))];

  return (
    <section style={cardStyle()}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Severity:
          <select
            value={filterSeverity}
            onChange={(e) => onFilterSeverity(e.target.value)}
            style={selectStyle()}
          >
            <option value="all">All</option>
            {['critical', 'high', 'medium', 'low', 'info'].map((s) => (
              <option key={s} value={s}>{capitalize(s)}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Category:
          <select
            value={filterCategory}
            onChange={(e) => onFilterCategory(e.target.value)}
            style={selectStyle()}
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {issues.length} of {allIssues.length} issue{allIssues.length !== 1 ? 's' : ''}
        </span>
      </div>

      {issues.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          ✅ No issues match the current filters
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {issues.map((issue) => (
            <div
              key={issue.id}
              style={{
                padding: 14,
                border: `1px solid ${SEVERITY_COLORS[issue.severity]}44`,
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                transition: 'transform 120ms ease, border-color 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.borderColor = SEVERITY_COLORS[issue.severity];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.borderColor = `${SEVERITY_COLORS[issue.severity]}44`;
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                  {CATEGORY_ICONS[issue.category] || '•'} {issue.title}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={badgeStyle(SEVERITY_COLORS[issue.severity])}>{issue.severity}</span>
                  <span style={badgeStyle('#a78bfa')}>{Math.round(issue.confidence * 100)}%</span>
                </div>
              </div>
              <p style={{ margin: '4px 0', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                {issue.description}
              </p>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                <code style={{ color: 'var(--cyan)' }}>{issue.file}:{issue.startLine}</code>
                {' · '} effort {issue.effortMinutes}m
                {' · '} category: {issue.category}
                {issue.stellarTags?.length ? ` · tags: ${issue.stellarTags.join(', ')}` : ''}
              </div>
              <div style={{
                marginTop: 8,
                padding: '8px 10px',
                fontSize: 12,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(6,182,212,0.08)',
                borderLeft: '3px solid #06b6d4',
                color: 'var(--text-secondary)',
              }}>
                <strong style={{ color: 'var(--cyan)' }}>💡 {issue.suggestion}</strong>
              </div>
              <div style={{
                marginTop: 6,
                fontSize: 11,
                color: 'var(--text-muted)',
                fontStyle: 'italic',
              }}>
                {issue.rationale}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Checklist Tab ────────────────────────────────────────────────────────────

function ChecklistTab({ result }: { result: CodeReviewResult }) {
  const passed = result.checklist.filter((i) => i.autoStatus === 'pass').length;
  const failed = result.checklist.filter((i) => i.autoStatus === 'fail').length;
  const warnings = result.checklist.filter((i) => i.autoStatus === 'warning').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ ...cardStyle(), flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#34d399' }}>{passed}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Passed</div>
        </div>
        <div style={{ ...cardStyle(), flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f87171' }}>{failed}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Failed</div>
        </div>
        <div style={{ ...cardStyle(), flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fbbf24' }}>{warnings}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Warnings</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={thStyle()}>Status</th>
            <th style={thStyle()}>Category</th>
            <th style={thStyle()}>Check</th>
            <th style={thStyle()}>Evidence</th>
          </tr>
        </thead>
        <tbody>
          {result.checklist.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={tdStyle()}>
                {item.autoStatus === 'pass' ? '✅' :
                 item.autoStatus === 'fail' ? '❌' :
                 item.autoStatus === 'warning' ? '⚠️' : '❓'}
              </td>
              <td style={tdStyle()}>
                <span style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                }}>
                  {item.category}
                </span>
              </td>
              <td style={tdStyle()}>{item.prompt}</td>
              <td style={{ ...tdStyle(), color: 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.evidence || item.details}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Best Practices Tab ──────────────────────────────────────────────────────

function BestPracticesTab({ result }: { result: CodeReviewResult }) {
  const allPractices = result.bestPractices;

  if (allPractices.length === 0) {
    return (
      <div style={{ ...cardStyle(), textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🌟</div>
        <p style={{ color: 'var(--text-secondary)' }}>No Stellar best practice violations detected. Great job!</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {allPractices.map((bp) => (
        <div key={bp.id} style={{
          padding: 14,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: bp.priority === 'essential' ? '#f87171' : bp.priority === 'recommended' ? '#fbbf24' : '#34d399',
            }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
              {bp.title}
            </span>
            <span style={badgeStyle(bp.priority === 'essential' ? '#f87171' : bp.priority === 'recommended' ? '#fbbf24' : '#34d399')}>
              {bp.priority}
            </span>
            <span style={badgeStyle('#a78bfa')}>{bp.domain}</span>
          </div>
          <p style={{ margin: '4px 0', color: 'var(--text-secondary)', fontSize: 12 }}>
            {bp.description}
          </p>
          {bp.goodExample && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, color: '#34d399', marginBottom: 2 }}>✅ Good:</div>
              <pre style={{ ...codeStyle(), borderLeft: '3px solid #34d399' }}>{bp.goodExample}</pre>
            </div>
          )}
          {bp.badExample && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, color: '#f87171', marginBottom: 2 }}>❌ Avoid:</div>
              <pre style={{ ...codeStyle(), borderLeft: '3px solid #f87171' }}>{bp.badExample}</pre>
            </div>
          )}
          {bp.docReference && (
            <div style={{ marginTop: 6, fontSize: 11 }}>
              <a href={bp.docReference} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)' }}>
                📖 View Documentation →
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Metrics Tab ─────────────────────────────────────────────────────────────

function MetricsTab({ result }: { result: CodeReviewResult }) {
  const fileData = result.analyzedFiles.map((f) => {
    const fileIssues = result.issues.filter((i) => i.file === f);
    return {
      name: f.split('/').pop() || f,
      path: f,
      issues: fileIssues.length,
      critical: fileIssues.filter((i) => i.severity === 'critical').length,
      high: fileIssues.filter((i) => i.severity === 'high').length,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section style={cardStyle()}>
        <h3 style={sectionTitle()}>📊 Issues per File</h3>
        <ResponsiveContainer width="100%" height={Math.max(200, fileData.length * 40)}>
          <BarChart data={fileData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} />
            <YAxis type="category" dataKey="name" width={160} stroke="var(--text-secondary)" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
              }}
            />
            <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 11 }} />
            <Bar dataKey="critical" fill="#f87171" name="Critical" stackId="a" />
            <Bar dataKey="high" fill="#fbbf24" name="High" stackId="a" />
            <Bar dataKey="issues" fill="#60a5fa" name="Total" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section style={cardStyle()}>
        <h3 style={sectionTitle()}>📁 File Detail</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={thStyle()}>File</th>
              <th style={thStyle()}>Critical</th>
              <th style={thStyle()}>High</th>
              <th style={thStyle()}>Total</th>
            </tr>
          </thead>
          <tbody>
            {fileData.map((f) => (
              <tr key={f.path} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={tdStyle()}><code>{f.path}</code></td>
                <td style={tdStyle()}>
                  <span style={{ color: f.critical > 0 ? '#f87171' : 'var(--text-muted)' }}>
                    {f.critical || '—'}
                  </span>
                </td>
                <td style={tdStyle()}>
                  <span style={{ color: f.high > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                    {f.high || '—'}
                  </span>
                </td>
                <td style={tdStyle()}>{f.issues}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ─── Report Tab ──────────────────────────────────────────────────────────────

function ReportTab({ result }: { result: CodeReviewResult }) {
  const [copied, setCopied] = useState(false);

  const copyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unsupported
    }
  }, [result]);

  return (
    <section style={cardStyle()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ ...sectionTitle(), margin: 0 }}>📝 Report Preview</h3>
        <button onClick={copyMarkdown} style={btnStyle('secondary')}>
          {copied ? '✅ Copied!' : '📋 Copy Markdown'}
        </button>
      </div>
      <div style={{
        background: 'var(--bg-base)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
        maxHeight: 500,
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }}>
        {toMarkdown(result)}
      </div>
    </section>
  );
}

// ─── Style helpers ───────────────────────────────────────────────────────────

function btnStyle(variant: 'primary' | 'secondary'): React.CSSProperties {
  return {
    padding: '8px 14px',
    border: `1px solid ${variant === 'primary' ? '#06b6d4' : 'var(--border)'}`,
    background: variant === 'primary' ? 'rgba(6,182,212,0.12)' : 'var(--bg-elevated)',
    color: variant === 'primary' ? '#06b6d4' : 'var(--text-primary)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontSize: 13,
    transition: 'transform 100ms ease, background 120ms ease',
  };
}

function cardStyle(): React.CSSProperties {
  return {
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-md)',
    padding: 18,
  };
}

function tabStyle(): React.CSSProperties {
  return {
    padding: '8px 14px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 12,
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  };
}

function tabActiveStyle(): React.CSSProperties {
  return {
    ...tabStyle(),
    background: 'rgba(6,182,212,0.18)',
    color: '#06b6d4',
    fontWeight: 600,
  };
}

function selectStyle(): React.CSSProperties {
  return {
    marginLeft: 6,
    padding: '4px 8px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
  };
}

function badgeStyle(color: string): React.CSSProperties {
  return {
    padding: '2px 8px',
    borderRadius: 999,
    background: `${color}22`,
    color,
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  };
}

function sectionTitle(): React.CSSProperties {
  return {
    margin: '0 0 12px',
    fontSize: 14,
    color: 'var(--text-primary)',
    fontWeight: 600,
  };
}

function thStyle(): React.CSSProperties {
  return {
    textAlign: 'left',
    padding: '8px 10px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    fontSize: 11,
  };
}

function tdStyle(): React.CSSProperties {
  return {
    padding: '8px 10px',
    color: 'var(--text-primary)',
    fontSize: 12,
  };
}

function codeStyle(): React.CSSProperties {
  return {
    margin: '4px 0 0',
    padding: '8px 10px',
    background: 'var(--bg-base)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
    overflowX: 'auto',
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tabLabelIcon(t: Tab): string {
  switch (t) {
    case 'overview': return '📊';
    case 'issues': return '🐛';
    case 'checklist': return '✅';
    case 'best-practices': return '📚';
    case 'metrics': return '📈';
    case 'report': return '📝';
  }
}

function tabLabelText(t: Tab): string {
  switch (t) {
    case 'overview': return 'Overview';
    case 'issues': return 'Issues';
    case 'checklist': return 'Checklist';
    case 'best-practices': return 'Best Practices';
    case 'metrics': return 'Metrics';
    case 'report': return 'Report';
  }
}
