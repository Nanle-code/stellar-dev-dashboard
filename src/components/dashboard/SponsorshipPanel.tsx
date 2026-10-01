/**
 * SponsorshipPanel (#844)
 *
 * Surfaces an account's sponsorship relationships and the reserve impact of
 * those relationships. Presentational: pass it the output of
 * `analyzeSponsorship()`.
 */

import React from 'react';
import { HandCoins, Link2, ShieldCheck, TriangleAlert } from 'lucide-react';
import {
  formatStroopsAsXlm,
  type SponsorshipAnalysis,
} from '../../lib/sponsorship';

export interface SponsorshipPanelProps {
  analysis: SponsorshipAnalysis;
  style?: React.CSSProperties;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{value}</span>
      {hint && <span style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)' }}>{hint}</span>}
    </div>
  );
}

export default function SponsorshipPanel({ analysis, style }: SponsorshipPanelProps) {
  const { reserve } = analysis;

  return (
    <section
      aria-label="Sponsorship and reserves"
      data-testid="sponsorship-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        background: 'var(--bg-elevated, #1e2327)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        ...style,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={16} aria-hidden="true" />
        <strong style={{ fontSize: 13 }}>Sponsorship &amp; reserves</strong>
      </header>

      {analysis.degraded && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: '#f59e0b',
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: 8,
            padding: '6px 8px',
          }}
        >
          <TriangleAlert size={13} aria-hidden="true" />
          {analysis.warnings.join(' ')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Stat
          label="Sponsored entries"
          value={String(analysis.sponsoredEntryCount)}
          hint="Your entries paid for by others"
        />
        <Stat
          label="Sponsoring entries"
          value={String(analysis.sponsoringEntryCount)}
          hint="Entries you fund for others"
        />
        <Stat
          label="Residual reserve"
          value={`${formatStroopsAsXlm(reserve.residualReserveStroops)} XLM`}
          hint={`${formatStroopsAsXlm(reserve.reliefStroops)} XLM relieved`}
        />
        <Stat
          label="Provided reserve"
          value={`${formatStroopsAsXlm(reserve.providedReserveStroops)} XLM`}
          hint="Locked for sponsored entries"
        />
      </div>

      <div>
        <h4 style={{ margin: '0 0 4px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link2 size={13} aria-hidden="true" /> Sponsoring accounts
        </h4>
        {analysis.sponsoringAccounts.length === 0 ? (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>
            No external accounts sponsor this account's entries.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, wordBreak: 'break-all' }}>
            {analysis.sponsoringAccounts.map((sponsor) => (
              <li key={sponsor}>{sponsor}</li>
            ))}
          </ul>
        )}
      </div>

      {analysis.sponsoredEntries.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <HandCoins size={13} aria-hidden="true" /> Sponsored entries
          </h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11 }}>
            {analysis.sponsoredEntries.map((entry, index) => (
              <li key={`${entry.type}-${entry.id}-${index}`}>
                {entry.type}: <code>{entry.id}</code>
                {entry.sponsor ? ` — sponsored by ${entry.sponsor}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
