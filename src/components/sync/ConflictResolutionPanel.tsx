/**
 * ConflictResolutionPanel (#412)
 *
 * User-facing UI for the offline sync conflict queue: shows the diverging
 * fields side by side and lets the user pick a merge strategy per record.
 */

import React from 'react';
import { GitMerge, Monitor, Smartphone, X } from 'lucide-react';
import type { Conflict, MergeStrategy } from '../../lib/offline/conflictResolution';

export interface ConflictResolutionPanelProps {
  conflicts: Conflict[];
  onResolve: (id: string, strategy: MergeStrategy) => void;
  onDismiss?: (id: string) => void;
  style?: React.CSSProperties;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const STRATEGIES: { strategy: MergeStrategy; label: string }[] = [
  { strategy: 'local-wins', label: 'Keep mine' },
  { strategy: 'remote-wins', label: 'Keep remote' },
  { strategy: 'field-merge', label: 'Merge fields' },
  { strategy: 'manual', label: 'Decide later' },
];

export default function ConflictResolutionPanel({
  conflicts,
  onResolve,
  onDismiss,
  style,
}: ConflictResolutionPanelProps) {
  if (!Array.isArray(conflicts) || conflicts.length === 0) return null;

  return (
    <section
      aria-label="Offline sync conflicts"
      data-testid="conflict-resolution-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
        borderRadius: 12,
        background: 'var(--bg-elevated, #1e2327)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        ...style,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <GitMerge size={16} aria-hidden="true" />
        <strong style={{ fontSize: 13 }}>
          {conflicts.length} sync conflict{conflicts.length === 1 ? '' : 's'} need review
        </strong>
      </header>

      {conflicts.map((conflict) => (
        <article
          key={conflict.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 10,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <code style={{ fontSize: 11 }}>{conflict.id}</code>
            {onDismiss && (
              <button
                type="button"
                aria-label={`Dismiss conflict ${conflict.id}`}
                onClick={() => onDismiss(conflict.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted, #6b7280)', cursor: 'pointer' }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted, #6b7280)' }}>
                <th scope="col">Field</th>
                <th scope="col">
                  <Smartphone size={11} aria-hidden="true" /> Local
                </th>
                <th scope="col">
                  <Monitor size={11} aria-hidden="true" /> Remote
                </th>
              </tr>
            </thead>
            <tbody>
              {conflict.overlappingFields.map((field) => (
                <tr key={field}>
                  <td style={{ padding: '2px 6px 2px 0', fontWeight: 600 }}>{field}</td>
                  <td style={{ padding: '2px 6px', wordBreak: 'break-all' }}>
                    {formatValue((conflict.local.data as Record<string, unknown>)[field])}
                  </td>
                  <td style={{ padding: '2px 6px', wordBreak: 'break-all' }}>
                    {formatValue((conflict.remote.data as Record<string, unknown>)[field])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STRATEGIES.map(({ strategy, label }) => (
              <button
                key={strategy}
                type="button"
                onClick={() => onResolve(conflict.id, strategy)}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border, rgba(255,255,255,0.15))',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
