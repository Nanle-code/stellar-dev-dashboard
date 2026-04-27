import React, { useMemo, useState } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Download,
  Trash2,
  Search,
  RefreshCw,
} from 'lucide-react';
import {
  AuditCategory,
  AuditSeverity,
  exportAuditCsv,
  exportAuditJson,
  clearAuditLog,
  verifyAuditChain,
} from '../../utils/audit.js';
import {
  useAuditLog,
  useAuditStats,
  useSecurityMonitor,
} from '../../hooks/useAudit.js';

const SEVERITY_COLORS = {
  [AuditSeverity.INFO]:     'var(--cyan)',
  [AuditSeverity.LOW]:      'var(--text-secondary)',
  [AuditSeverity.MEDIUM]:   'var(--yellow)',
  [AuditSeverity.HIGH]:     'var(--orange)',
  [AuditSeverity.CRITICAL]: 'var(--red)',
};

const OUTCOME_COLORS = {
  success: 'var(--green)',
  failure: 'var(--red)',
  denied:  'var(--orange)',
};

export default function AuditLog() {
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [integrity, setIntegrity] = useState(null);

  const filters = useMemo(
    () => ({
      category: category || undefined,
      severity: severity || undefined,
      search: search || undefined,
      limit: 500,
    }),
    [category, severity, search],
  );

  const { entries, refresh } = useAuditLog(filters);
  const stats = useAuditStats();
  const { alerts, clear: clearAlerts } = useSecurityMonitor();

  const downloadFile = (filename, mime, content) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (format) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (format === 'json') {
      downloadFile(`audit-${stamp}.json`, 'application/json', exportAuditJson(entries));
    } else {
      downloadFile(`audit-${stamp}.csv`, 'text/csv', exportAuditCsv(entries));
    }
  };

  const handleVerify = async () => {
    setIntegrity({ checking: true });
    const result = await verifyAuditChain();
    setIntegrity(result);
  };

  const handleClear = () => {
    if (confirm('Clear all audit entries? This action is not reversible.')) {
      clearAuditLog();
      refresh();
    }
  };

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={22} style={{ color: 'var(--cyan)' }} />
            Audit Trail
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Tamper-evident security &amp; compliance log
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <ToolbarButton onClick={refresh} icon={<RefreshCw size={14} />} label="Refresh" />
          <ToolbarButton onClick={handleVerify} icon={<CheckCircle size={14} />} label="Verify Chain" />
          <ToolbarButton onClick={() => handleExport('json')} icon={<Download size={14} />} label="Export JSON" />
          <ToolbarButton onClick={() => handleExport('csv')} icon={<Download size={14} />} label="Export CSV" />
          <ToolbarButton onClick={handleClear} icon={<Trash2 size={14} />} label="Clear" danger />
        </div>
      </div>

      {/* Integrity status */}
      {integrity && !integrity.checking && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: integrity.valid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${integrity.valid ? 'var(--green)' : 'var(--red)'}`,
            color: integrity.valid ? 'var(--green)' : 'var(--red)',
            fontSize: '13px',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {integrity.valid ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {integrity.valid
            ? `Chain valid (${stats.total} entries)`
            : `Chain broken at index ${integrity.brokenAt}: ${integrity.reason}`}
        </div>
      )}

      {/* Live alerts */}
      {alerts.length > 0 && (
        <div
          style={{
            background: 'rgba(239,68,68,0.05)',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontWeight: 700, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              Live Security Alerts ({alerts.length})
            </div>
            <button onClick={clearAlerts} style={smallButtonStyle}>Dismiss</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: 'var(--red)', fontWeight: 700 }}>[{a.kind}]</span>{' '}
                actor=<code>{a.actor ?? a.action}</code> count={a.count}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <StatCard label="Total" value={stats.total} color="var(--cyan)" />
        <StatCard label="Critical" value={stats.bySeverity[AuditSeverity.CRITICAL] ?? 0} color="var(--red)" />
        <StatCard label="High" value={stats.bySeverity[AuditSeverity.HIGH] ?? 0} color="var(--orange)" />
        <StatCard label="Medium" value={stats.bySeverity[AuditSeverity.MEDIUM] ?? 0} color="var(--yellow)" />
        <StatCard label="Failures" value={stats.byOutcome.failure ?? 0} color="var(--red)" />
        <StatCard label="Denied" value={stats.byOutcome.denied ?? 0} color="var(--orange)" />
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          padding: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search action / actor / metadata"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '32px' }}
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          <option value="">All categories</option>
          {Object.values(AuditCategory).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={inputStyle}>
          <option value="">All severities</option>
          {Object.values(AuditSeverity).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {entries.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No audit entries match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
                  <th style={cellStyle}>Time</th>
                  <th style={cellStyle}>Severity</th>
                  <th style={cellStyle}>Category</th>
                  <th style={cellStyle}>Action</th>
                  <th style={cellStyle}>Actor</th>
                  <th style={cellStyle}>Outcome</th>
                  <th style={cellStyle}>Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <AuditRow key={e.id} entry={e} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditRow({ entry }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: 'pointer', borderTop: '1px solid var(--border)' }}
      >
        <td style={cellStyle}>{new Date(entry.timestamp).toLocaleTimeString()}</td>
        <td style={cellStyle}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: SEVERITY_COLORS[entry.severity],
              border: `1px solid ${SEVERITY_COLORS[entry.severity]}`,
            }}
          >
            {entry.severity}
          </span>
        </td>
        <td style={cellStyle}>{entry.category}</td>
        <td style={{ ...cellStyle, color: 'var(--text-primary)' }}>{entry.action}</td>
        <td style={cellStyle}>{truncate(entry.actor) ?? '—'}</td>
        <td style={{ ...cellStyle, color: OUTCOME_COLORS[entry.outcome] ?? 'var(--text-muted)' }}>
          {entry.outcome}
        </td>
        <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</td>
      </tr>
      {open && (
        <tr style={{ background: 'var(--bg-elevated)' }}>
          <td colSpan={7} style={{ padding: '12px 16px' }}>
            <pre
              style={{
                margin: 0,
                fontSize: '11px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: 'var(--text-secondary)',
              }}
            >
              {JSON.stringify(
                {
                  id: entry.id,
                  target: entry.target,
                  metadata: entry.metadata,
                  sessionId: entry.sessionId,
                  hash: entry.hash,
                  prevHash: entry.prevHash,
                },
                null,
                2,
              )}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
      }}
    >
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color, marginTop: '4px' }}>{value}</div>
    </div>
  );
}

function ToolbarButton({ onClick, icon, label, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        background: danger ? 'rgba(239,68,68,0.08)' : 'var(--bg-card)',
        border: `1px solid ${danger ? 'var(--red)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        color: danger ? 'var(--red)' : 'var(--text-primary)',
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
        transition: 'var(--transition)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function truncate(s, n = 16) {
  if (!s || typeof s !== 'string') return s;
  return s.length > n ? `${s.slice(0, 6)}…${s.slice(-6)}` : s;
}

const cellStyle = { padding: '10px 12px', verticalAlign: 'top' };

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};

const smallButtonStyle = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
  fontSize: '11px',
  padding: '4px 10px',
  cursor: 'pointer',
};
