import React, { useMemo, useState, useEffect } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import {
  Shield,
  AlertTriangle,
  Download,
  Trash2,
  Search,
  RefreshCw,
  BarChart3,
  Activity,
} from 'lucide-react';
import auditTrail from '../../lib/auditTrail.js';
import { exportCsv, exportJson, exportPdf } from '../../utils/export.js';

const SEVERITY_COLORS = {
  info:     'var(--cyan)',
  low:      'var(--text-secondary)',
  medium:   'var(--yellow)',
  high:     'var(--orange)',
  critical: 'var(--red)',
  warning:  'var(--orange)',
  error:    'var(--red)',
};

const TYPE_COLORS = {
  USER_ACTION: 'var(--blue)',
  API_CALL: 'var(--green)',
  DATA_CHANGE: 'var(--purple)',
  SECURITY_EVENT: 'var(--red)',
  SECURITY_ALERT: 'var(--red)',
  ERROR: 'var(--red)',
  SYSTEM: 'var(--cyan)',
};

export default function AuditLog() {
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rangePreset, setRangePreset] = useState('');
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const filters = useMemo(
    () => ({
      type: type || undefined,
      severity: severity || undefined,
      search: search || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [type, severity, search, startDate, endDate],
  );

  const formatDateInput = (date) => new Date(date).toISOString().slice(0, 10);

  const applyRangePreset = (days) => {
    setRangePreset(days);
    if (!days) {
      setStartDate('');
      setEndDate('');
      return;
    }

    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - Number(days) + 1);

    setStartDate(formatDateInput(start));
    setEndDate(formatDateInput(end));
  };

  const buildAuditText = (eventsToExport) => {
    return eventsToExport.map((event) => {
      return [`[${event.timestamp}] ${event.severity.toUpperCase()} ${event.type}: ${event.message}`, `User ID: ${event.userId || '—'}`, `Metadata: ${JSON.stringify(event.metadata, null, 2)}`, '---'].join('\n');
    }).join('\n');
  };

  const buildCsvRows = (eventsToExport) => {
    return eventsToExport.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      userId: event.userId || '',
      type: event.type,
      message: event.message,
      severity: event.severity,
      metadata: JSON.stringify(event.metadata),
    }));
  };

  useEffect(() => {
    // Load events and stats
    const filteredEvents = auditTrail.getEvents(filters);
    setEvents(filteredEvents.slice(0, 500)); // Limit to 500 for display
    setStats(auditTrail.getStatistics());
  }, [filters, refreshKey]);

  const { isMobile } = useResponsive()

  const refresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleExport = (format) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try {
      const eventsToExport = auditTrail.getEvents(filters);
      const filename = `audit-${stamp}`;

      if (format === 'json') {
        exportJson(
          {
            exportDate: new Date().toISOString(),
            filters: {
              ...filters,
              startDate: filters.startDate || null,
              endDate: filters.endDate || null,
            },
            totalEvents: eventsToExport.length,
            events: eventsToExport,
          },
          filename,
        );
        return;
      }

      if (format === 'csv') {
        exportCsv(buildCsvRows(eventsToExport), filename, [
          'id',
          'timestamp',
          'userId',
          'type',
          'message',
          'severity',
          'metadata',
        ]);
        return;
      }

      if (format === 'pdf') {
        exportPdf(buildAuditText(eventsToExport), filename);
        return;
      }

      throw new Error(`Unsupported export format: ${format}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + error.message);
    }
  };

  const handleClear = () => {
    if (confirm('Clear all audit entries? This action is not reversible.')) {
      auditTrail.clearEvents();
      refresh();
    }
  };

  const securityAlerts = auditTrail.getSecurityAlerts();

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
          <ToolbarButton onClick={() => handleExport('json')} icon={<Download size={14} />} label="Export JSON" />
          <ToolbarButton onClick={() => handleExport('csv')} icon={<Download size={14} />} label="Export CSV" />
          <ToolbarButton onClick={() => handleExport('pdf')} icon={<Download size={14} />} label="Export PDF" />
          <ToolbarButton onClick={handleClear} icon={<Trash2 size={14} />} label="Clear" danger />
        </div>
      </div>

      {/* Live alerts */}
      {securityAlerts.length > 0 && (
        <div
          style={{
            background: 'rgba(239,68,68,0.05)',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <AlertTriangle size={16} />
            Security Alerts ({securityAlerts.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            {securityAlerts.slice(0, 5).map((alert, i) => (
              <div key={i} style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: 'var(--red)', fontWeight: 700 }}>[{alert.type}]</span>{' '}
                {alert.message}
              </div>
            ))}
            {securityAlerts.length > 5 && (
              <div style={{ color: 'var(--text-muted)' }}>... and {securityAlerts.length - 5} more</div>
            )}
          </div>
        </div>
      )}

      {/* Stat cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <StatCard label="Total Events" value={stats.totalEvents} color="var(--cyan)" icon={<Activity size={16} />} />
          <StatCard label="Last 24h" value={stats.last24hEvents} color="var(--blue)" icon={<BarChart3 size={16} />} />
          <StatCard label="Security Alerts" value={stats.securityAlerts} color="var(--red)" icon={<AlertTriangle size={16} />} />
          <StatCard label="Errors" value={stats.errors} color="var(--orange)" icon={<AlertTriangle size={16} />} />
          <StatCard label="API Calls" value={stats.apiCalls} color="var(--green)" icon={<Activity size={16} />} />
          <StatCard label="Last 7d" value={stats.last7dEvents} color="var(--purple)" icon={<BarChart3 size={16} />} />
        </div>
      )}

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
        <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
          <option value="">All types</option>
          <option value="USER_ACTION">User Actions</option>
          <option value="API_CALL">API Calls</option>
          <option value="DATA_CHANGE">Data Changes</option>
          <option value="SECURITY_EVENT">Security Events</option>
          <option value="SECURITY_ALERT">Security Alerts</option>
          <option value="ERROR">Errors</option>
          <option value="SYSTEM">System</option>
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={inputStyle}>
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
        <div style={{ display: 'grid', gap: '10px' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            From date
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setRangePreset(''); }}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            To date
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setRangePreset(''); }}
              style={inputStyle}
            />
          </label>
          <div style={{ display: 'grid', gap: '8px' }}>
            <select
              value={rangePreset}
              onChange={(e) => applyRangePreset(e.target.value)}
              style={inputStyle}
            >
              <option value="">All dates</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <button
              type="button"
              onClick={() => applyRangePreset('')}
              style={smallButtonStyle}
            >
              Clear date range
            </button>
          </div>
        </div>
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
        {events.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No audit events match the current filters.
          </div>
        ) : isMobile ? (
          <div style={{ display: 'grid', gap: '12px', padding: '12px' }}>
            {events.map((event) => (
              <AuditMobileCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', textAlign: 'left' }}>
                  <th style={cellStyle}>Time</th>
                  <th style={cellStyle}>Type</th>
                  <th style={cellStyle}>Severity</th>
                  <th style={cellStyle}>Message</th>
                  <th style={cellStyle}>User ID</th>
                  <th style={cellStyle}>Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <AuditRow key={event.id} event={event} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditRow({ event }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: 'pointer', borderTop: '1px solid var(--border)' }}
      >
        <td style={cellStyle}>{new Date(event.timestamp).toLocaleTimeString()}</td>
        <td style={cellStyle}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: TYPE_COLORS[event.type] || 'var(--text-secondary)',
              border: `1px solid ${TYPE_COLORS[event.type] || 'var(--border)'}`,
            }}
          >
            {event.type}
          </span>
        </td>
        <td style={cellStyle}>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: SEVERITY_COLORS[event.severity] || 'var(--text-secondary)',
              border: `1px solid ${SEVERITY_COLORS[event.severity] || 'var(--border)'}`,
            }}
          >
            {event.severity}
          </span>
        </td>
        <td style={{ ...cellStyle, color: 'var(--text-primary)' }}>{event.message}</td>
        <td style={cellStyle}>{truncate(event.userId) ?? '—'}</td>
        <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</td>
      </tr>
      {open && (
        <tr style={{ background: 'var(--bg-elevated)' }}>
          <td colSpan={6} style={{ padding: '12px 16px' }}>
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
                  id: event.id,
                  sessionId: event.sessionId,
                  metadata: event.metadata,
                  userAgent: event.userAgent,
                  location: event.location,
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

function AuditMobileCard({ event }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={() => setOpen((previous) => !previous)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setOpen((previous) => !previous);
        }
      }}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        cursor: 'pointer',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        transition: 'var(--transition)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
            {new Date(event.timestamp).toLocaleTimeString()}
          </div>
          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: TYPE_COLORS[event.type] || 'var(--text-secondary)' }}>{event.type}</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                border: `1px solid ${SEVERITY_COLORS[event.severity] || 'var(--border)'}`,
                color: SEVERITY_COLORS[event.severity] || 'var(--text-secondary)',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {event.severity}
            </span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>{event.userId || '—'}</div>
      </div>
      <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>{event.message}</div>
      {open && (
        <div style={{ marginTop: '14px', padding: '14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '10px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Details
          </div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            {JSON.stringify(
              {
                id: event.id,
                sessionId: event.sessionId,
                metadata: event.metadata,
                userAgent: event.userAgent,
                location: event.location,
              },
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        {icon && <div style={{ color }}>{icon}</div>}
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
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
