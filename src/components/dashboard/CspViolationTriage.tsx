/**
 * CspViolationTriage — Issue #831
 *
 * Triage view for sampled Content Security Policy violations captured by
 * `src/lib/cspReporting.ts`. Shows drop counters (sampling + invalid input),
 * groups by directive, and lists recent sanitised violations. No raw page
 * content is ever displayed or stored.
 */

import React, { useMemo, useState } from 'react';
import { useCspViolations } from '../../hooks/useCspViolations';
import type { CspViolation } from '../../lib/cspReporting';

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', ...style }}>
    {children}
  </div>
);

const Stat = ({ label, value, color }: { label: string; value: number | string; color: string }) => (
  <Card style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '24px', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
  </Card>
);

function DirectiveBadge({ directive }: { directive: string }) {
  const base = directive.split(' ')[0] ?? directive;
  const color = base.startsWith('script') ? '#ef4444'
    : base.startsWith('style') ? '#f97316'
      : base.startsWith('connect') ? '#06b6d4'
        : 'var(--text-muted)';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
      fontFamily: 'var(--font-mono)', background: 'var(--bg-canvas)', color,
      border: '1px solid var(--border)', whiteSpace: 'nowrap',
    }}>{directive || 'unknown'}</span>
  );
}

export default function CspViolationTriage() {
  const { violations, stats, clear } = useCspViolations();
  const [copied, setCopied] = useState(false);

  const byDirective = useMemo(() => {
    const counts = new Map<string, number>();
    violations.forEach((v) => counts.set(v.violatedDirective, (counts.get(v.violatedDirective) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [violations]);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(violations, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — non-fatal */
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>CSP Violation Triage</div>
          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'var(--bg-canvas)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            sampled
          </span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
          Sanitised Content Security Policy reports. Query strings, fragments, and secret-shaped values are
          stripped before capture, and the browser <code>sample</code> field is never collected.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Reports received" value={stats.received} color="var(--cyan, #06b6d4)" />
        <Stat label="Captured (sampled)" value={stats.recorded} color="#22c55e" />
        <Stat label="Dropped by sampling" value={stats.droppedSampled} color="var(--text-muted)" />
        <Stat label="Dropped (invalid)" value={stats.droppedInvalid} color={stats.droppedInvalid > 0 ? '#ef4444' : 'var(--text-muted)'} />
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={copyJson}
          disabled={violations.length === 0}
          style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, cursor: violations.length ? 'pointer' : 'not-allowed', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', opacity: violations.length ? 1 : 0.5 }}
        >
          {copied ? '✓ Copied' : '📋 Copy JSON'}
        </button>
        <button
          onClick={clear}
          disabled={violations.length === 0 && stats.received === 0}
          style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: '#ef4444' }}
        >
          Clear
        </button>
      </div>

      {byDirective.length > 0 && (
        <Card>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>By Directive</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {byDirective.map(([directive, count]) => (
              <div key={directive} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <DirectiveBadge directive={directive} />
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {violations.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '40px 16px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🛡️</div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>No CSP violations captured</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Violations appear here as the browser enforces the Content Security Policy.
          </div>
        </Card>
      ) : (
        <Card style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ background: 'var(--bg-canvas)', borderBottom: '1px solid var(--border)' }}>
                  {['Time', 'Directive', 'Blocked URI', 'Source', 'Line'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {violations.map((v: CspViolation, i: number) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.01)' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(v.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: '10px 14px' }}><DirectiveBadge directive={v.violatedDirective} /></td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.blockedUri}>
                      {v.blockedUri || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.sourceFile}>
                      {v.sourceFile || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{v.lineNumber ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
