import React, { useState, useEffect, useCallback, useRef, type MouseEvent, type ReactNode } from 'react';
import { useStore } from '../../lib/store';
import { formatDistanceToNow } from 'date-fns';
import Card from './Card';
import type { AuditEntry } from '../../types/audit';

interface LogRowProps {
  entry: AuditEntry
  isSelected: boolean
  onSelect: (id: string) => void
}

interface FilterBarProps {
  onFilterChange: (filters: FilterState) => void
}

interface FilterState {
  severity: string[]
  category: string[]
  search: string
}

interface SeverityBadgeProps {
  severity: string
}

const SEVERITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: 'var(--red-glow-sm)', color: 'var(--red)', border: 'var(--red)' },
  error: { bg: 'var(--red-glow-sm)', color: 'var(--red)', border: 'var(--red)' },
  warning: { bg: 'var(--amber-glow-sm)', color: 'var(--amber)', border: 'var(--amber)' },
  info: { bg: 'var(--cyan-glow-sm)', color: 'var(--cyan)', border: 'var(--cyan)' },
  debug: { bg: 'var(--bg-elevated)', color: 'var(--text-muted)', border: 'var(--border)' },
};

const CATEGORIES = ['security', 'transaction', 'auth', 'system', 'network', 'user'];
const SEVERITIES = ['critical', 'error', 'warning', 'info', 'debug'];

const SeverityBadge = ({ severity }: SeverityBadgeProps) => {
  const style = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 'var(--radius-sm)',
      fontSize: '10px',
      fontWeight: 600,
      fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: style.bg,
      color: style.color,
      border: `1px solid ${style.border}`,
    }}>
      {severity}
    </span>
  );
};

const LogRow = ({ entry, isSelected, onSelect }: LogRowProps) => (
  <div
    onClick={() => onSelect(entry.id)}
    style={{
      display: 'grid',
      gridTemplateColumns: 'auto 80px 100px 1fr 140px',
      gap: '12px',
      padding: '10px 14px',
      borderBottom: '1px solid var(--border)',
      cursor: 'pointer',
      background: isSelected ? 'var(--cyan-glow-sm)' : 'transparent',
      transition: 'var(--transition)',
      alignItems: 'center',
      fontSize: '12px',
    }}
  >
    <div style={{
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: (SEVERITY_COLORS[entry.severity] || SEVERITY_COLORS.info).color,
      flexShrink: 0,
    }} />
    <SeverityBadge severity={entry.severity} />
    <div style={{
      color: 'var(--text-muted)',
      fontSize: '11px',
      fontFamily: 'var(--font-mono)',
      textTransform: 'capitalize',
    }}>
      {entry.category}
    </div>
    <div style={{
      color: 'var(--text-primary)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontFamily: 'var(--font-mono)',
    }}>
      {entry.message}
    </div>
    <div style={{
      color: 'var(--text-muted)',
      fontSize: '11px',
      fontFamily: 'var(--font-mono)',
      textAlign: 'right',
    }}>
      {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
    </div>
  </div>
);

const FilterBar = ({ onFilterChange }: FilterBarProps) => {
  const [search, setSearch] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const toggleSeverity = (sev: string) => {
    const next = selectedSeverities.includes(sev)
      ? selectedSeverities.filter(s => s !== sev)
      : [...selectedSeverities, sev];
    setSelectedSeverities(next);
    onFilterChange({ severity: next, category: selectedCategories, search });
  };

  const toggleCategory = (cat: string) => {
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter(c => c !== cat)
      : [...selectedCategories, cat];
    setSelectedCategories(next);
    onFilterChange({ severity: selectedSeverities, category: next, search });
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    onFilterChange({ severity: selectedSeverities, category: selectedCategories, search: val });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search audit log..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              transition: 'var(--transition)',
              boxSizing: 'border-box',
            }}
          />
          <span style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            fontSize: '14px',
          }}>
            🔍
          </span>
        </div>

        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          style={{
            padding: '9px 14px',
            background: isFilterOpen ? 'var(--cyan)' : 'var(--bg-elevated)',
            color: isFilterOpen ? 'white' : 'var(--text-primary)',
            border: `1px solid ${isFilterOpen ? 'var(--cyan)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>⚙</span>
          Filters
          {(selectedSeverities.length > 0 || selectedCategories.length > 0) && (
            <span style={{
              background: 'var(--cyan)',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 700,
            }}>
              {selectedSeverities.length + selectedCategories.length}
            </span>
          )}
        </button>
      </div>

      {isFilterOpen && (
        <div style={{
          padding: '14px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Severity
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {SEVERITIES.map(sev => (
                <button
                  key={sev}
                  onClick={() => toggleSeverity(sev)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: `1px solid ${selectedSeverities.includes(sev) ? SEVERITY_COLORS[sev].border : 'var(--border)'}`,
                    background: selectedSeverities.includes(sev) ? SEVERITY_COLORS[sev].bg : 'var(--bg-canvas)',
                    color: selectedSeverities.includes(sev) ? SEVERITY_COLORS[sev].color : 'var(--text-muted)',
                    transition: 'var(--transition)',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                  }}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Category
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: `1px solid ${selectedCategories.includes(cat) ? 'var(--cyan)' : 'var(--border)'}`,
                    background: selectedCategories.includes(cat) ? 'var(--cyan-glow-sm)' : 'var(--bg-canvas)',
                    color: selectedCategories.includes(cat) ? 'var(--cyan)' : 'var(--text-muted)',
                    transition: 'var(--transition)',
                    textTransform: 'capitalize',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function AuditLog() {
  const { network } = useStore();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({ severity: [], category: [], search: '' });
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchLogs() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/audit/logs');
        const data: AuditEntry[] = await response.json();
        setLogs(data);
      } catch {
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLogs();
  }, [network]);

  const filteredLogs = logs.filter((entry: AuditEntry) => {
    if (filters.severity.length > 0 && !filters.severity.includes(entry.severity)) return false;
    if (filters.category.length > 0 && !filters.category.includes(entry.category)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      return (
        entry.message.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        entry.severity.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedEntry = logs.find((e: AuditEntry) => e.id === selectedId) || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
          Audit Log
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          Track and review actions across the dashboard with full search and filtering.
        </p>
      </div>

      <FilterBar onFilterChange={(f: FilterState) => setFilters(f)} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '14px' }}>
        <div className="card" style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          maxHeight: '600px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>{filteredLogs.length} entries</span>
            <span>{logs.length} total</span>
          </div>
          <div ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
            {isLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading audit log...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                {logs.length === 0 ? 'No audit entries yet.' : 'No entries match the current filters.'}
              </div>
            ) : (
              filteredLogs.map((entry: AuditEntry) => (
                <LogRow
                  key={entry.id}
                  entry={entry}
                  isSelected={selectedId === entry.id}
                  onSelect={setSelectedId}
                />
              ))
            )}
          </div>
        </div>

        <div className="card" style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
        }}>
          {selectedEntry ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Entry Details
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '4px',
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Severity</div>
                  <SeverityBadge severity={selectedEntry.severity} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Category</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{selectedEntry.category}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Timestamp</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(selectedEntry.timestamp).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Message</div>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    background: 'var(--bg-canvas)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}>
                    {selectedEntry.message}
                  </div>
                </div>
                {selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Metadata</div>
                    <pre style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--bg-canvas)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      maxHeight: '200px',
                      overflow: 'auto',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {JSON.stringify(selectedEntry.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.4 }}>📋</div>
              <div style={{ fontSize: '13px' }}>Select an entry to view details</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
