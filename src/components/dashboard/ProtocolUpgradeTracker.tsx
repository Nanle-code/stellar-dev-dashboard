import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Globe, Info, RefreshCw, Zap } from 'lucide-react';
import {
  getActiveResetNotices,
  getProtocolUpgrades,
  getUpgradesByVersion,
  resolveProtocolVersionRows,
  toProtocolUpgradesErrorReport,
  type ActiveResetNotice,
  type DateConfidence,
  type ProtocolUpgradeEntry,
  type ProtocolUpgradesData,
  type ProtocolVersionRow,
} from '../../lib/protocolUpgrades';

/**
 * ProtocolUpgradeTracker (#985)
 *
 * Embeds a "current protocol version + upcoming upgrades + testnet reset
 * warning" section in the Network view. Current versions come from the live
 * ledger header when available; the rest come from the curated, versioned
 * `src/data/protocol-upgrades.json`.
 *
 * `data` and `now` are injectable so tests can drive validation, boundary, and
 * failure cases without touching the bundled file or the system clock.
 */
export interface ProtocolUpgradeTrackerProps {
  /** Active network id (e.g. `testnet`). */
  network?: string;
  /** Latest ledger record, used for the live `protocol_version`. */
  ledger?: unknown;
  /** Raw tracker data override. Defaults to the bundled JSON. */
  data?: unknown;
  /** Clock override, used for the reset countdown. */
  now?: Date;
}

const CONFIDENCE_LABEL: Record<DateConfidence, string> = {
  confirmed: 'confirmed',
  estimated: 'estimated',
  unknown: 'date TBD',
};

const STATUS_STYLE: Record<ProtocolUpgradeEntry['status'], { label: string; color: string }> = {
  'in-development': { label: 'In development', color: 'var(--cyan)' },
  scheduled: { label: 'Scheduled', color: 'var(--amber)' },
  activated: { label: 'Active', color: 'var(--green)' },
};

function confidenceText(entry: ProtocolUpgradeEntry): string {
  if (entry.activationDate) return entry.activationDate;
  if (entry.activationWindow) return `${entry.activationWindow.start} → ${entry.activationWindow.end}`;
  return CONFIDENCE_LABEL[entry.dateConfidence];
}

function countdownLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'today';
  if (daysUntil === 1) return 'tomorrow';
  return `in ${daysUntil} days`;
}

function ResetBanner({ notice }: { notice: ActiveResetNotice }) {
  return (
    <div
      style={{
        background: 'rgba(255, 179, 0, 0.08)',
        border: '1px solid var(--amber)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
      role="status"
      data-testid="testnet-reset-banner"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <AlertTriangle size={18} color="var(--amber)" />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
          {notice.network} reset {notice.scheduledFor ? `scheduled ${countdownLabel(notice.daysUntil)}` : 'scheduled'}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--amber)',
            border: '1px solid var(--amber)',
            borderRadius: '10px',
            padding: '2px 8px',
          }}
        >
          {CONFIDENCE_LABEL[notice.dateConfidence]}
        </span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{notice.summary}</div>
      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {notice.impacts.map((impact) => (
          <li key={impact}>{impact}</li>
        ))}
      </ul>
      {notice.dateNote ? (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{notice.dateNote}</div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <a
          href={notice.reSeedGuideUrl}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--cyan)' }}
        >
          <RefreshCw size={13} />
          Re-seed fixtures guide
          <ExternalLink size={12} />
        </a>
        {notice.reSeedCommand ? (
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-primary)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 8px',
            }}
          >
            {notice.reSeedCommand}
          </code>
        ) : null}
      </div>
    </div>
  );
}

function VersionCard({ row }: { row: ProtocolVersionRow }) {
  return (
    <div
      data-testid={`protocol-version-${row.network}`}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${row.live ? 'var(--cyan-dim)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
          <Globe size={12} /> {row.network}
        </span>
        {row.live ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--green)', fontWeight: 700 }}>
            <CheckCircle2 size={11} /> LIVE
          </span>
        ) : null}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
        {row.version}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
        {row.live ? 'ledger header' : `last verified${row.lastVerified ? ` ${row.lastVerified}` : ''}`}
      </div>
    </div>
  );
}

function UpgradeCard({ upgrade }: { upgrade: ProtocolUpgradeEntry }) {
  const status = STATUS_STYLE[upgrade.status];
  return (
    <div
      data-testid={`upgrade-${upgrade.protocolVersion}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
          {upgrade.title}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: status.color,
            border: `1px solid ${status.color}`,
            borderRadius: '10px',
            padding: '2px 8px',
          }}
        >
          {status.label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <Clock size={12} />
        {confidenceText(upgrade)}
        {upgrade.dateConfidence !== 'confirmed' ? <span>({CONFIDENCE_LABEL[upgrade.dateConfidence]})</span> : null}
        {upgrade.networks.length ? <span>· live on {upgrade.networks.join(', ')}</span> : null}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{upgrade.summary}</div>

      {upgrade.impacts.length ? (
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {upgrade.impacts.map((impact) => (
            <li key={impact}>{impact}</li>
          ))}
        </ul>
      ) : null}

      {upgrade.caps.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {upgrade.caps.map((cap) => (
            <a
              key={cap.number}
              href={cap.url}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--cyan)' }}
            >
              <Zap size={12} />
              {cap.number} — {cap.title}
              {cap.assignment && cap.assignment !== 'confirmed' ? (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({cap.assignment})</span>
              ) : null}
              <ExternalLink size={11} />
            </a>
          ))}
        </div>
      ) : null}

      {upgrade.capsNote ? (
        <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <Info size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{upgrade.capsNote}</span>
        </div>
      ) : null}

      {upgrade.dateNote ? (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{upgrade.dateNote}</div>
      ) : null}
    </div>
  );
}

export default function ProtocolUpgradeTracker({
  network,
  ledger,
  data,
  now = new Date(),
}: ProtocolUpgradeTrackerProps) {
  const { parsed, loadError } = useMemo(() => {
    try {
      return { parsed: getProtocolUpgrades(data), loadError: null };
    } catch (error) {
      return { parsed: null, loadError: toProtocolUpgradesErrorReport(error) };
    }
  }, [data]);

  const resetNotices = useMemo(
    () => (parsed ? getActiveResetNotices(parsed, { now }) : []),
    [parsed, now],
  );

  if (loadError) {
    return (
      <div
        data-testid="protocol-upgrades-error"
        style={{
          background: 'rgba(255, 23, 68, 0.08)',
          border: '1px solid var(--red)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
        role="alert"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)', fontWeight: 700, fontSize: '13px' }}>
          <AlertTriangle size={16} />
          Protocol upgrade data unavailable
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          `src/data/protocol-upgrades.json` failed validation. Fix the issues below; the rest of the Network view still works.
        </div>
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {loadError.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </div>
    );
  }

  const versionRows = resolveProtocolVersionRows(parsed as ProtocolUpgradesData, { network, ledger });
  const upgrades = getUpgradesByVersion(parsed as ProtocolUpgradesData);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} data-testid="protocol-upgrade-tracker">
      {resetNotices.map((notice) => (
        <ResetBanner key={`${notice.network}-${notice.scheduledFor}`} notice={notice} />
      ))}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} color="var(--cyan)" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>Protocol Upgrade Tracker</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            data v{parsed?.dataVersion} · updated {parsed?.lastUpdated}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {versionRows.map((row) => (
            <VersionCard key={row.network} row={row} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {upgrades.map((upgrade) => (
            <UpgradeCard key={upgrade.protocolVersion} upgrade={upgrade} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <Info size={12} />
          Curated from the
          <a href={parsed?.capIndexUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>
            Stellar CAP index
          </a>
          . Maintainers: see the update guide before editing dates.
        </div>
      </div>
    </div>
  );
}
