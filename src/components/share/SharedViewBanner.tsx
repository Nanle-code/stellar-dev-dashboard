/**
 * SharedViewBanner — tells the recipient how a shared view differs from what
 * they are currently looking at.
 *
 * A shared link can carry a network, a route, filters and a pinned ledger. If
 * any of those disagree with the recipient's current session, silently
 * overriding their setup would be hostile and silently *not* overriding it
 * would be misleading. This banner states the difference and offers the
 * one-click fix.
 *
 * Three states:
 *  - **Network mismatch** (the important one): the link was captured on a
 *    different network than the recipient is on. Offers "Switch to <network>".
 *  - **Same network, no mismatch**: a quiet confirmation strip with the pinned
 *    ledger (if any) and an "Exit shared view" action.
 *  - **Pin not honoured**: the link pinned a ledger for a route that has no
 *    historical read. Said plainly, rather than implying the data is frozen.
 *
 * Renders nothing when there is no active shared view.
 */

import React from 'react';
import { AlertTriangle, Check, Info, LogOut } from 'lucide-react';
import { NETWORKS } from '../../lib/stellar';
import type { SharedView } from '../../hooks/useSharedView';

export interface SharedViewBannerProps {
  view: SharedView;
  onExit: () => void;
  onSwitchNetwork: () => void;
}

function networkLabel(network: string): string {
  return NETWORKS[network as keyof typeof NETWORKS]?.name ?? network;
}

export default function SharedViewBanner({
  view,
  onExit,
  onSwitchNetwork,
}: SharedViewBannerProps): JSX.Element | null {
  if (!view.isSharedView || !view.snapshot) return null;

  const { networkMismatch, snapshotNetwork, activeNetwork, ledgerPin, ledgerSupport } = view;
  const pinNotHonoured = ledgerPin !== null && !ledgerSupport.honoured;

  if (!networkMismatch && !pinNotHonoured && ledgerPin === null) {
    // Same network, nothing pinned — a minimal confirmation strip.
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="shared-view-banner"
        style={stripStyle}
      >
        <Info size={16} aria-hidden="true" style={{ color: 'var(--cyan, #00e5ff)', flexShrink: 0 }} />
        <span style={messageStyle}>
          Viewing a shared <strong>{view.snapshot.tab}</strong> snapshot on{' '}
          <strong>{networkLabel(activeNetwork)}</strong>.
        </span>
        <ExitButton onExit={onExit} />
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="shared-view-banner"
      style={{
        ...stripStyle,
        borderColor: networkMismatch ? 'rgba(245, 158, 11, 0.45)' : 'var(--border, #333)',
        background: networkMismatch
          ? 'rgba(245, 158, 11, 0.10)'
          : 'var(--bg-card, #141414)',
      }}
    >
      <AlertTriangle
        size={16}
        aria-hidden="true"
        style={{ color: '#f59e0b', flexShrink: 0 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        {networkMismatch && (
          <div style={messageStyle} data-testid="shared-view-network-mismatch">
            This link was captured on{' '}
            <strong>{networkLabel(snapshotNetwork as string)}</strong>, but your dashboard is
            on <strong>{networkLabel(activeNetwork)}</strong>. Results below are from{' '}
            {networkLabel(activeNetwork)}.
          </div>
        )}

        {ledgerPin !== null && (
          <div style={{ ...messageStyle, marginTop: networkMismatch ? '4px' : 0 }}>
            {ledgerSupport.honoured ? (
              <>
                <Check size={12} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Pinned
                to ledger <strong>{ledgerPin}</strong>. {ledgerSupport.note}
              </>
            ) : (
              <>
                Ledger <strong>{ledgerPin}</strong> recorded for reference only. {ledgerSupport.note}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {networkMismatch && snapshotNetwork && (
          <button
            type="button"
            onClick={onSwitchNetwork}
            style={actionStyle}
            data-testid="shared-view-switch-network"
          >
            Switch to {networkLabel(snapshotNetwork)}
          </button>
        )}
        <ExitButton onExit={onExit} />
      </div>
    </div>
  );
}

function ExitButton({ onExit }: { onExit: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onExit}
      style={{ ...actionStyle, flexShrink: 0 }}
      data-testid="shared-view-exit"
    >
      <LogOut size={12} aria-hidden="true" />
      Exit shared view
    </button>
  );
}

const stripStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  marginBottom: '16px',
  border: '1px solid var(--border, #333)',
  borderRadius: 'var(--radius-md, 6px)',
  background: 'var(--bg-card, #141414)',
  color: 'var(--text-secondary, #aaa)',
  fontSize: '13px',
  flexWrap: 'wrap',
};

const messageStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  lineHeight: 1.5,
};

const actionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm, 4px)',
  border: '1px solid var(--border, #333)',
  background: 'var(--bg-elevated, #1a1a1a)',
  color: 'var(--text-primary, #fff)',
  fontSize: '12px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
