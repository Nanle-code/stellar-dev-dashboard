import React, { useMemo, useState } from 'react';
import {
  Shield,
  AlertTriangle,
  AlertOctagon,
  CheckCircle,
  RefreshCw,
  Download,
  Filter,
  Activity,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  FileText,
} from 'lucide-react';
import Card from './Card.tsx';
import { useSecurityAnalysis } from '../../hooks/useSecurityAnalysis.js';
import { getAuditEntries, exportAuditJson, exportAuditCsv } from '../../utils/audit.js';

const SEVERITY_COLORS = {
  info: 'var(--cyan)',
  low: 'var(--text-secondary)',
  medium: 'var(--yellow)',
  high: 'var(--orange)',
  critical: 'var(--red)',
};

const GRADE_COLORS = {
  A: 'var(--green)',
  B: 'var(--cyan)',
  C: 'var(--yellow)',
  D: 'var(--orange)',
  F: 'var(--red)',
};

const SEVERITY_ICONS = {
  info: CheckCircle,
  low: Activity,
  medium: AlertTriangle,
  high: AlertOctagon,
  critical: AlertOctagon,
};

function RiskGauge({ score, grade }) {
  const color = GRADE_COLORS[grade] || 'var(--text-muted)';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="var(--border)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x="50"
          y="46"
          textAnchor="middle"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            fontWeight: 700,
            fill: color,
          }}
        >
          {grade}
        </text>
        <text
          x="50"
          y="64"
          textAnchor="middle"
          style={{
            fontSize: '11px',
            fill: 'var(--text-muted)',
          }}
        >
          {score}/100
        </text>
      </svg>
    </div>
  );
}

function FindingRow({ finding, expanded, onToggle }) {
  const Icon = SEVERITY_ICONS[finding.severity] || AlertTriangle;
  const color = SEVERITY_COLORS[finding.severity] || 'var(--text-muted)';

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        marginBottom: '6px',
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          cursor: 'pointer',
          background: 'var(--bg-surface)',
          transition: 'background 0.15s',
        }}
      >
        <Icon size={14} style={{ color, flexShrink: 0 }} />
        <span
          style={{
            flex: 1,
            fontSize: '12px',
            color: 'var(--text-primary)',
            lineHeight: 1.4,
          }}
        >
          {finding.message}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            color,
            letterSpacing: '0.5px',
            flexShrink: 0,
          }}
        >
          {finding.severity}
        </span>
        {expanded ? (
          <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        ) : (
          <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        )}
      </div>
      {expanded && (
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-card)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          <div style={{ marginBottom: '6px' }}>
            <strong>Type:</strong> {finding.type.replace(/_/g, ' ')}
          </div>
          {finding.actor && (
            <div style={{ marginBottom: '6px' }}>
              <strong>Actor:</strong> {finding.actor}
            </div>
          )}
          {finding.timestamp && (
            <div style={{ marginBottom: '6px' }}>
              <Clock size={10} style={{ display: 'inline', marginRight: '4px' }} />
              {new Date(finding.timestamp).toLocaleString()}
            </div>
          )}
          {finding.count != null && (
            <div style={{ marginBottom: '6px' }}>
              <strong>Count:</strong> {finding.count}
            </div>
          )}
          {finding.expectedMax != null && (
            <div>
              <strong>Expected max:</strong> {finding.expectedMax}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginLeft: 'auto',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function SecurityAuditPanel() {
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [expandedFindings, setExpandedFindings] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const filters = useMemo(() => ({
    ...(severityFilter && { severity: severityFilter }),
    ...(categoryFilter && { category: categoryFilter }),
  }), [severityFilter, categoryFilter]);

  const { report, findings, riskScore, isAnalyzing, refresh } = useSecurityAnalysis({
    filters,
    analysisIntervalMs: 5000,
  });

  const toggleFinding = (index) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleExport = (format) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const entries = getAuditEntries({ ...filters, limit: 1000 });
    const content = format === 'json' ? exportAuditJson(entries) : exportAuditCsv(entries);
    const mime = format === 'json' ? 'application/json' : 'text/csv';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${stamp}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bySeveritySummary = report.summary?.bySeverity || {};
  const totalFindings = report.summary?.totalFindings || 0;

  return (
    <div
      className="animate-in"
      style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={20} style={{ color: 'var(--cyan)' }} />
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '15px',
                color: 'var(--text-primary)',
              }}
            >
              Security Analysis
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              AI-powered audit trail anomaly detection
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              background: showFilters ? 'var(--cyan-dim)' : 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            <Filter size={12} /> Filters
          </button>
          <button
            onClick={refresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            <RefreshCw size={12} className={isAnalyzing ? 'spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => handleExport('json')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Severity:</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                padding: '4px 8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '11px',
              }}
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '4px 8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '11px',
              }}
            >
              <option value="">All</option>
              <option value="auth">Auth</option>
              <option value="wallet">Wallet</option>
              <option value="transaction">Transaction</option>
              <option value="security">Security</option>
              <option value="config">Config</option>
              <option value="network">Network</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>
      )}

      {/* Risk Score + Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '16px' }}>
        <Card title="Risk Score" glow={riskScore.score > 50}>
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
            <RiskGauge score={riskScore.score} grade={riskScore.grade} />
          </div>
        </Card>

        <Card title="Analysis Summary">
          <div style={{ padding: '16px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <StatBadge label="Total Events" value={report.entryCount} color="var(--cyan)" />
              <StatBadge label="Findings" value={totalFindings} color={totalFindings > 0 ? 'var(--orange)' : 'var(--green)'} />
              <StatBadge label="Critical" value={bySeveritySummary.critical || 0} color="var(--red)" />
              <StatBadge label="High" value={bySeveritySummary.high || 0} color="var(--orange)" />
              <StatBadge label="Medium" value={bySeveritySummary.medium || 0} color="var(--yellow)" />
              <StatBadge label="Low" value={bySeveritySummary.low || 0} color="var(--text-muted)" />
            </div>

            {report.timeRange && (
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <Clock size={10} />
                Analyzing events from {new Date(report.timeRange.from).toLocaleString()} to{' '}
                {new Date(report.timeRange.to).toLocaleString()}
              </div>
            )}

            {/* Breakdown bar */}
            {totalFindings > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    height: '6px',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    gap: '2px',
                  }}
                >
                  {['critical', 'high', 'medium', 'low', 'info'].map((sev) => {
                    const count = bySeveritySummary[sev] || 0;
                    if (!count) return null;
                    const pct = (count / totalFindings) * 100;
                    return (
                      <div
                        key={sev}
                        style={{
                          width: `${pct}%`,
                          background: SEVERITY_COLORS[sev],
                          borderRadius: '3px',
                          minWidth: '4px',
                        }}
                        title={`${sev}: ${count}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Findings List */}
      <Card
        title={`Security Findings (${totalFindings})`}
        subtitle="Detected anomalies and patterns"
        action={
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => handleExport('json')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              <FileText size={10} /> JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              <FileText size={10} /> CSV
            </button>
          </div>
        }
      >
        <div style={{ padding: '12px 14px' }}>
          {findings.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '24px',
                color: 'var(--text-muted)',
                fontSize: '12px',
              }}
            >
              <CheckCircle
                size={24}
                style={{ color: 'var(--green)', marginBottom: '8px', display: 'block', margin: '0 auto 8px' }}
              />
              No security findings detected. All audit events appear normal.
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {findings.map((finding, i) => (
                <FindingRow
                  key={`${finding.type}-${i}`}
                  finding={finding}
                  expanded={expandedFindings.has(i)}
                  onToggle={() => toggleFinding(i)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <Card
          title="Recommendations"
          subtitle="Actionable steps to improve security posture"
        >
          <div style={{ padding: '12px 14px' }}>
            {report.recommendations.map((rec, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '8px 0',
                  borderBottom: i < report.recommendations.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <TrendingUp
                  size={12}
                  style={{ color: 'var(--cyan)', marginTop: '2px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {rec}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
