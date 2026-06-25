import React, { useState } from 'react';
import { format } from 'date-fns';
import Card, { StatCard } from './Card';
import {
  useComplianceReport,
  useRetentionPolicies,
  useArchives,
  useLogSearch,
  useSavedSearches,
  useComplianceMetrics,
  useRiskAssessment,
  useActivityHeatmap,
  useAuditAnalytics,
  useRetentionImpact,
} from '../../hooks/useCompliance.js';
import {
  ReportType,
  ReportFormat,
} from '../../lib/complianceReports.js';
import { AuditSeverity as AS, AuditCategory as AC } from '../../utils/audit.js';

// ─── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'reports', label: 'Reports' },
  { id: 'search', label: 'Search' },
  { id: 'retention', label: 'Retention' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'risk', label: 'Risk Assessment' },
];

// ─── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ variant = 'info', children }) {
  const colors = {
    info: { bg: 'var(--cyan-glow-sm)', color: 'var(--cyan)', border: 'var(--cyan)' },
    success: { bg: 'var(--green-glow-sm)', color: 'var(--green)', border: 'var(--green)' },
    warning: { bg: 'var(--amber-glow-sm)', color: 'var(--amber)', border: 'var(--amber)' },
    danger: { bg: 'var(--red-glow-sm)', color: 'var(--red)', border: 'var(--red)' },
    neutral: { bg: 'var(--bg-elevated)', color: 'var(--text-muted)', border: 'var(--border)' },
  };
  const s = colors[variant] || colors.neutral;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: '10px',
      fontWeight: 600, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
      letterSpacing: '0.5px', background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {children}
    </span>
  );
}

// ─── Tab Button ────────────────────────────────────────────────────────────────

function TabButton({ tab, active, onClick }) {
  return (
    <button onClick={() => onClick(tab.id)} style={{
      padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: '12px',
      fontWeight: active ? 600 : 400, cursor: 'pointer', border: `1px solid ${active ? 'var(--cyan)' : 'var(--border)'}`,
      background: active ? 'var(--cyan-glow-sm)' : 'var(--bg-elevated)',
      color: active ? 'var(--cyan)' : 'var(--text-muted)',
      transition: 'var(--transition)', fontFamily: 'var(--font-mono)',
    }}>
      {tab.label}
    </button>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const metrics = useComplianceMetrics();
  const { assessment } = useRiskAssessment();

  if (!metrics) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Loading...</div>;

  const scoreColor = metrics.complianceScore >= 80 ? 'var(--green)' : metrics.complianceScore >= 50 ? 'var(--amber)' : 'var(--red)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
        Compliance Overview
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <StatCard label="Compliance Score" value={`${metrics.complianceScore}%`} sub="Overall compliance rating" accent={scoreColor} />
        <StatCard label="Total Entries" value={metrics.overview.totalEntries.toLocaleString()} sub="All time audit entries" />
        <StatCard label="24h Activity" value={metrics.overview.entries24h} sub="Entries in last 24 hours" />
        <StatCard label="30 Day Trend" value={`${metrics.trend.dailyAverage30d}/day`} sub="Daily average over 30 days" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="Security Metrics">
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Critical Events (30d)</span>
              <span style={{ color: metrics.securityMetrics.criticalEvents30d > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                {metrics.securityMetrics.criticalEvents30d}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Security Events (30d)</span>
              <span style={{ color: metrics.securityMetrics.securityEvents30d > 5 ? 'var(--amber)' : 'var(--text-primary)', fontWeight: 600 }}>
                {metrics.securityMetrics.securityEvents30d}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Auth Events (30d)</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{metrics.securityMetrics.authEvents30d}</span>
            </div>
          </div>
        </Card>

        <Card title="Operational Health">
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Success Rate (30d)</span>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>{metrics.operationalMetrics.successRate30d}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Failed Operations</span>
              <span style={{ color: metrics.operationalMetrics.failedOperations30d > 0 ? 'var(--amber)' : 'var(--text-primary)', fontWeight: 600 }}>
                {metrics.operationalMetrics.failedOperations30d}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Denied Operations</span>
              <span style={{ color: metrics.operationalMetrics.deniedOperations30d > 0 ? 'var(--amber)' : 'var(--text-primary)', fontWeight: 600 }}>
                {metrics.operationalMetrics.deniedOperations30d}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {assessment && (
        <Card title={`Risk Assessment: ${assessment.riskLevel.toUpperCase()}`} glow={assessment.riskLevel === 'high'}>
          <div style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: assessment.overallRiskScore >= 70 ? 'var(--red)' : assessment.overallRiskScore >= 40 ? 'var(--amber)' : 'var(--green)' }}>
                {assessment.overallRiskScore}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Overall Risk Score<br />Assessed: {format(new Date(assessment.assessedAt), 'MMM d, HH:mm')}
              </div>
            </div>
            {assessment.risks.slice(0, 5).map((risk, i) => (
              <div key={i} style={{
                padding: '8px 0', borderBottom: i < Math.min(assessment.risks.length, 5) - 1 ? '1px solid var(--border)' : 'none',
                fontSize: 12, display: 'flex', gap: 8,
              }}>
                <Badge variant={risk.level === 'critical' || risk.level === 'high' ? 'danger' : risk.level === 'medium' ? 'warning' : 'info'}>
                  {risk.level}
                </Badge>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{risk.factor}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{risk.description}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Reports Tab ───────────────────────────────────────────────────────────────

function ReportsTab() {
  const [activeReport, setActiveReport] = useState(ReportType.SOC2);
  const [datePreset, setDatePreset] = useState('all');
  const soc2 = useComplianceReport(ReportType.SOC2, {});
  const gdpr = useComplianceReport(ReportType.GDPR, {});
  const custom = useComplianceReport(ReportType.CUSTOM, { title: 'Custom Compliance Report' });

  const current = activeReport === ReportType.SOC2 ? soc2 : activeReport === ReportType.GDPR ? gdpr : custom;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
        Compliance Reports
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { id: ReportType.SOC2, label: 'SOC 2' },
          { id: ReportType.GDPR, label: 'GDPR' },
          { id: ReportType.CUSTOM, label: 'Custom' },
        ].map((r) => (
          <button key={r.id} onClick={() => setActiveReport(r.id)} style={{
            padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: activeReport === r.id ? 600 : 400,
            cursor: 'pointer', border: `1px solid ${activeReport === r.id ? 'var(--cyan)' : 'var(--border)'}`,
            background: activeReport === r.id ? 'var(--cyan-glow-sm)' : 'var(--bg-elevated)',
            color: activeReport === r.id ? 'var(--cyan)' : 'var(--text-muted)',
            transition: 'var(--transition)',
          }}>
            {r.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)} style={{
          padding: '6px 10px', background: 'var(--bg-canvas)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12,
          fontFamily: 'var(--font-mono)',
        }}>
          <option value="all">All Time</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>

        <button onClick={() => current.generate()} disabled={current.loading} style={{
          padding: '6px 14px', background: 'var(--cyan)', color: 'white', border: 'none',
          borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          opacity: current.loading ? 0.6 : 1,
        }}>
          {current.loading ? 'Generating...' : 'Generate Report'}
        </button>

        {current.report && (
          <>
            <button onClick={() => current.exportAs(ReportFormat.JSON)} style={{
              padding: '6px 14px', background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer',
            }}>
              Export JSON
            </button>
            <button onClick={() => current.exportAs(ReportFormat.CSV)} style={{
              padding: '6px 14px', background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer',
            }}>
              Export CSV
            </button>
            <button onClick={() => current.exportAs(ReportFormat.PDF)} style={{
              padding: '6px 14px', background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer',
            }}>
              Export PDF
            </button>
          </>
        )}
      </div>

      {current.error && (
        <div style={{ padding: 12, background: 'var(--red-glow-sm)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', color: 'var(--red)', fontSize: 12 }}>
          {current.error}
        </div>
      )}

      {current.report && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Card title="Report Summary">
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Type</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{current.report.reportType}</span>
              </div>
              <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Generated</span>
                <span style={{ color: 'var(--text-primary)' }}>{format(new Date(current.report.generatedAt), 'MMM d, yyyy HH:mm')}</span>
              </div>
              <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Entries</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{current.report.summary?.totalEntries?.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Integrity Check</span>
                <span style={{ color: current.report.chainOfTrust?.valid ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {current.report.chainOfTrust?.valid ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            </div>
          </Card>

          <Card title="Findings">
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(current.report.findings || []).length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No findings in this period.</div>
              ) : (
                current.report.findings.map((f, i) => (
                  <div key={i} style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <Badge variant={
                      f.severity === 'high' ? 'danger' : f.severity === 'medium' ? 'warning' : 'info'
                    }>{f.severity}</Badge>
                    <div>
                      <div style={{ color: 'var(--text-primary)' }}>{f.control || f.article}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{f.detail}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Search Tab ────────────────────────────────────────────────────────────────

function SearchTab() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const { results, totalCount, loading, search, exportResults } = useLogSearch({ limit: 100 });
  const { searches, save, remove } = useSavedSearches();
  const [selectedEntry, setSelectedEntry] = useState(null);

  const handleSearch = () => {
    search({ search: query || undefined, category: category || undefined, severity: severity || undefined });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
        Log Search
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search audit logs..." style={{
            flex: 1, minWidth: 200, padding: '8px 12px', background: 'var(--bg-canvas)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
            fontSize: 13, outline: 'none', fontFamily: 'var(--font-mono)',
          }} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{
          padding: '8px 10px', background: 'var(--bg-canvas)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12,
        }}>
          <option value="">All Categories</option>
          {Object.values(AC).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={{
          padding: '8px 10px', background: 'var(--bg-canvas)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12,
        }}>
          <option value="">All Severities</option>
          {Object.values(AS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={handleSearch} disabled={loading} style={{
          padding: '8px 16px', background: 'var(--cyan)', color: 'white', border: 'none',
          borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? 'Searching...' : 'Search'}
        </button>
        {results.length > 0 && (
          <button onClick={() => exportResults('json')} style={{
            padding: '8px 14px', background: 'var(--bg-elevated)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer',
          }}>
            Export Results
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>
              Showing {results.length} of {totalCount} results
            </div>
          )}

          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: 500, overflowY: 'auto',
          }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Searching...</div>
            ) : results.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {query || category || severity ? 'No results match your search.' : 'Use the search bar above to find audit entries.'}
              </div>
            ) : (
              results.map((entry) => (
                <div key={entry.id} onClick={() => setSelectedEntry(entry)} style={{
                  display: 'grid', gridTemplateColumns: 'auto 70px 80px 1fr', gap: 8,
                  padding: '8px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  background: selectedEntry?.id === entry.id ? 'var(--cyan-glow-sm)' : 'transparent',
                  fontSize: 11, alignItems: 'center', transition: 'var(--transition)',
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: entry.severity === 'critical' ? 'var(--red)' : entry.severity === 'high' ? 'var(--amber)' : 'var(--cyan)' }} />
                  <Badge variant={entry.severity === 'critical' ? 'danger' : entry.severity === 'high' ? 'warning' : 'info'}>{entry.severity}</Badge>
                  <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{entry.category}</span>
                  <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.action}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedEntry && (
          <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Card title="Entry Details">
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div><span style={{ color: 'var(--text-muted)' }}>ID: </span><span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{selectedEntry.id}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Timestamp: </span><span style={{ color: 'var(--text-primary)' }}>{format(new Date(selectedEntry.timestamp), 'MMM d, yyyy HH:mm:ss')}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Action: </span><span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{selectedEntry.action}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Actor: </span><span style={{ color: 'var(--text-primary)' }}>{selectedEntry.actor || 'N/A'}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Target: </span><span style={{ color: 'var(--text-primary)' }}>{selectedEntry.target || 'N/A'}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Outcome: </span><span style={{ color: selectedEntry.outcome === 'success' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{selectedEntry.outcome}</span></div>
                {selectedEntry.complianceTags?.length > 0 && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Compliance: </span>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {selectedEntry.complianceTags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => save(query || 'current search', { query, category, severity })} style={{
                padding: '6px 12px', background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11, cursor: 'pointer', flex: 1,
              }}>
                Save Search
              </button>
            </div>

            {searches.length > 0 && (
              <Card title="Saved Searches">
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {searches.slice(-5).reverse().map((s) => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                      <button onClick={() => remove(s.id)} style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11,
                      }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Retention Tab ────────────────────────────────────────────────────────────

function RetentionTab() {
  const { policies, loading: polLoading, updatePolicy, applyNow, reset } = useRetentionPolicies();
  const { archives, summary, loading: archLoading, refresh, restore, remove } = useArchives();
  const { impact, loading: impactLoading } = useRetentionImpact();
  const [selectedCategory, setSelectedCategory] = useState(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
        Retention Policies
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={applyNow} style={{
          padding: '8px 16px', background: 'var(--cyan)', color: 'white', border: 'none',
          borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          Apply Policies Now
        </button>
        <button onClick={reset} style={{
          padding: '8px 16px', background: 'var(--bg-elevated)', color: 'var(--text-primary)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer',
        }}>
          Reset to Defaults
        </button>
        <button onClick={refresh} style={{
          padding: '8px 16px', background: 'var(--bg-elevated)', color: 'var(--text-primary)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer',
        }}>
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="Current Policies">
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {polLoading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
            ) : (
              Object.entries(policies).map(([category, policy]) => (
                <div key={category} onClick={() => setSelectedCategory(category)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  fontSize: 12,
                }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>
                    {category}
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {policy.retentionDays}d
                    </span>
                    <Badge variant={policy.action === 'archive' ? 'info' : 'warning'}>
                      {policy.action}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title="Estimated Impact">
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {impactLoading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
            ) : (
              impact.map((i) => (
                <div key={i.category} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12,
                }}>
                  <span style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{i.category}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {i.affectedEntries} entries ({(i.estimatedSize / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card title="Archives" subtitle={summary ? `${summary.totalArchives} archives, ${summary.totalEntries.toLocaleString()} entries` : ''}>
        <div style={{ padding: '14px 18px' }}>
          {archLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
          ) : Object.keys(archives).length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No archives yet. Apply retention policies to create archives.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {Object.entries(archives).map(([category, items]) =>
                items.map((arch) => (
                  <div key={arch.archiveId} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-canvas)',
                    fontSize: 11,
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>{category}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                        {arch.entryCount} entries | {format(new Date(arch.archivedAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => restore(arch.archiveId)} style={{
                        padding: '3px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 10, cursor: 'pointer',
                      }}>
                        Restore
                      </button>
                      <button onClick={() => remove(arch.archiveId)} style={{
                        padding: '3px 8px', background: 'var(--red-glow-sm)', border: '1px solid var(--red)',
                        borderRadius: 'var(--radius-sm)', color: 'var(--red)', fontSize: 10, cursor: 'pointer',
                      }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Card>

      {selectedCategory && (
        <Card title={`Edit Policy: ${selectedCategory}`}>
          <div style={{ padding: '14px 18px' }}>
            <PolicyEditor
              category={selectedCategory}
              policy={policies[selectedCategory]}
              onSave={async (p) => { await updatePolicy(selectedCategory, p); setSelectedCategory(null); }}
              onClose={() => setSelectedCategory(null)}
            />
          </div>
        </Card>
      )}
    </div>
  );
}

function PolicyEditor({ category, policy, onSave, onClose }) {
  const [days, setDays] = useState(policy?.retentionDays || 90);
  const [action, setAction] = useState(policy?.action || 'archive');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-muted)' }}>Retention Period:</span>
        <input type="number" value={days} onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))} min={1} style={{
          width: 80, padding: '6px 8px', background: 'var(--bg-canvas)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
        }} />
        <span style={{ color: 'var(--text-muted)' }}>days</span>
      </div>
      <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-muted)' }}>Action:</span>
        <select value={action} onChange={(e) => setAction(e.target.value)} style={{
          padding: '6px 8px', background: 'var(--bg-canvas)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12,
        }}>
          <option value="archive">Archive</option>
          <option value="delete">Delete</option>
          <option value="keep">Keep</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave({ retentionDays: days, action })} style={{
          padding: '6px 14px', background: 'var(--cyan)', color: 'white', border: 'none',
          borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          Save
        </button>
        <button onClick={onClose} style={{
          padding: '6px 14px', background: 'var(--bg-elevated)', color: 'var(--text-primary)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Analytics Tab ─────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const { analytics, refresh } = useAuditAnalytics();
  const { heatmap } = useActivityHeatmap();

  if (!analytics) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Loading analytics...</div>;

  const severityColors = { critical: 'var(--red)', high: 'var(--amber)', medium: 'var(--cyan)', low: 'var(--green)', info: 'var(--text-muted)' };

  const days = Object.keys(heatmap).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
        Audit Analytics
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatCard label="Total Events" value={analytics.overview.total.toLocaleString()} sub="All time" />
        <StatCard label="Daily Average" value={analytics.averageDaily} sub="Events per day" />
        <StatCard label="Peak Activity" value={analytics.peakActivity?.count || 0} sub={analytics.peakActivity?.date || 'N/A'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="Category Distribution">
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(analytics.categoryDistribution).map(([cat, data]) => (
              <div key={cat} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{cat}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 100, height: 6, background: 'var(--bg-canvas)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${data.percentage}%`, height: '100%', background: 'var(--cyan)',
                      borderRadius: 3, transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{data.count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Top Actors">
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {analytics.actorActivity.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No actor data available.</div>
            ) : (
              analytics.actorActivity.slice(0, 10).map((a) => (
                <div key={a.actor} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{a.actor}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{a.count} events</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card title="Time Distribution (Last 30 Days)">
        <div style={{ padding: '14px 18px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 2, minWidth: 600 }}>
            {analytics.timeDistribution.slice(-30).map((d) => {
              const max = Math.max(...analytics.timeDistribution.map((t) => t.count), 1);
              const height = Math.max(4, (d.count / max) * 60);
              return (
                <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: '100%', height, background: 'var(--cyan)', borderRadius: '2px 2px 0 0',
                    opacity: 0.7 + (d.count / max) * 0.3, transition: 'height 0.3s',
                  }} title={`${d.date}: ${d.count} events`} />
                  {days.length <= 31 && (
                    <div style={{ fontSize: 8, color: 'var(--text-muted)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                      {d.date.slice(5)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ComplianceDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab />;
      case 'reports': return <ReportsTab />;
      case 'search': return <SearchTab />;
      case 'retention': return <RetentionTab />;
      case 'analytics': return <AnalyticsTab />;
      case 'risk': return <RiskTab />;
      default: return <OverviewTab />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 4px' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
          Compliance & Audit
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Comprehensive audit logging, compliance reporting, retention management, and risk assessment.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {TABS.map((tab) => (
          <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={setActiveTab} />
        ))}
      </div>

      {renderTab()}
    </div>
  );
}

function RiskTab() {
  const { assessment, loading, assess } = useRiskAssessment();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
          Risk Assessment
        </div>
        <button onClick={assess} style={{
          padding: '8px 16px', background: 'var(--cyan)', color: 'white', border: 'none',
          borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          Reassess
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Analyzing audit data...</div>
      ) : !assessment ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No data to assess.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <StatCard
              label="Overall Risk Score"
              value={`${assessment.overallRiskScore}/100`}
              sub={`Level: ${assessment.riskLevel.toUpperCase()}`}
              accent={assessment.overallRiskScore >= 70 ? 'var(--red)' : assessment.overallRiskScore >= 40 ? 'var(--amber)' : 'var(--green)'}
            />
            <StatCard label="Total Entries Assessed" value={assessment.totalEntries.toLocaleString()} sub="In audit log" />
            <StatCard label="Recent Activity (30d)" value={assessment.recentEntries.toLocaleString()} sub="Entries in assessment period" />
            <StatCard label="Risk Factors" value={assessment.risks.length} sub="Identified risks" />
          </div>

          <Card title="Risk Factors">
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {assessment.risks.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No risk factors identified. Your audit log appears healthy.</div>
              ) : (
                assessment.risks.map((risk, i) => (
                  <div key={i} style={{
                    padding: '10px', borderRadius: 'var(--radius-sm)',
                    background: risk.level === 'critical' ? 'var(--red-glow-sm)' : risk.level === 'high' ? 'var(--amber-glow-sm)' : 'var(--bg-canvas)',
                    border: `1px solid ${
                      risk.level === 'critical' ? 'var(--red)' : risk.level === 'high' ? 'var(--amber)' : 'var(--border)'
                    }`,
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <Badge variant={risk.level === 'critical' ? 'danger' : risk.level === 'high' ? 'warning' : risk.level === 'medium' ? 'warning' : 'info'}>
                        {risk.level}
                      </Badge>
                      <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{risk.factor}</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                        Score: {risk.score}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{risk.description}</div>
                    <div style={{ color: 'var(--cyan)', fontSize: 11 }}>
                      Rec: {risk.recommendation}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {assessment.recommendations.length > 0 && (
            <Card title="Recommendations">
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {assessment.recommendations.map((rec, i) => (
                  <div key={i} style={{
                    fontSize: 12, color: 'var(--text-primary)', padding: '6px 0',
                    borderBottom: i < assessment.recommendations.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    {i + 1}. {rec}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
