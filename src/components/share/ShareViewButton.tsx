/**
 * ShareViewButton — the "Share" action that produces a reproducible view link.
 *
 * A screenshot tells a teammate what you saw; a link lets them *rebuild* it.
 * This button opens a small panel with:
 *
 *  - the generated link, with a copy button
 *  - an optional "pin to ledger N" toggle, so the view can be frozen at a point
 *    in time
 *  - an explicit statement of what is and is not in the link, because "share
 *    this link" in a wallet-adjacent tool deserves a visible security note
 *
 * Pinning is only offered when the current route can actually honour it and a
 * ledger sequence is known. When it cannot, the panel says so instead of
 * offering a checkbox that would do nothing.
 *
 * See `src/lib/shareLinks.ts` for the format and the security model, and
 * `docs/SHARED_VIEW_LINKS.md` for the user-facing description.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Link2, Pin, ShieldCheck, X } from 'lucide-react';
import { useStore } from '../../lib/store';
import {
  buildShareUrl,
  selectShareableState,
  snapshotFromState,
  type ShareableViewState,
} from '../../lib/shareLinks';
import { currentLedgerSequence, describeLedgerPinSupport } from '../../lib/ledgerPin';
import type { NetworkName } from '../../lib/stellar';

export interface ShareViewButtonProps {
  /** Path the link points at. Defaults to the current location. */
  base?: string;
}

type CopyState = 'idle' | 'copied' | 'failed';

export default function ShareViewButton({ base }: ShareViewButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const copyResetTimer = useRef<number | null>(null);

  // Read the allow-listed slice of the store. `selectShareableState` is the
  // single gate: fields outside it cannot reach the URL even indirectly.
  const viewState = useStore(
    (state) => selectShareableState(state as unknown as StoreWithShareable),
    (a, b) => shareableEqual(a, b)
  ) as ShareableViewState;

  const activeTab = useStore((state) => state.activeTab);
  const network = useStore((state) => state.network);
  const ledgerHistory = useStore((state) => state.ledgerHistory);
  const streamLedgers = useStore((state) => state.streamLedgers);

  const support = describeLedgerPinSupport(activeTab);
  const knownSequence = useMemo(
    () => currentLedgerSequence({ ledgerHistory, streamLedgers }),
    [ledgerHistory, streamLedgers]
  );

  const url = useMemo(() => {
    const snapshot = snapshotFromState(viewState, {
      tab: activeTab,
      ledger: pinEnabled ? knownSequence : null,
    });
    return buildShareUrl(snapshot, { base });
  }, [viewState, activeTab, pinEnabled, knownSequence, base]);

  // A pin that cannot be honoured must not linger in the UI: if the recipient
  // switches to a route without historical reads, drop the pin rather than
  // shipping a link that implies otherwise.
  useEffect(() => {
    if (pinEnabled && (!support.honoured || knownSequence === null)) {
      setPinEnabled(false);
    }
  }, [pinEnabled, support.honoured, knownSequence]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(
    () => () => {
      if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
    },
    []
  );

  const handleCopy = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopyState('copied');
      } else {
        throw new Error('clipboard unavailable');
      }
    } catch {
      setCopyState('failed');
    }
    if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
    copyResetTimer.current = window.setTimeout(() => setCopyState('idle'), 2000);
  }, [url]);

  const pinDisabled = !support.honoured || knownSequence === null;

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Share this view as a link"
        title="Share this view as a link"
        data-testid="share-view-button"
        style={triggerStyle}
      >
        <Link2 size={16} aria-hidden="true" />
        <span>Share</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Share this view"
          data-testid="share-view-panel"
          style={panelStyle}
        >
          <div style={panelHeaderStyle}>
            <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Share this view</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close share panel"
              style={iconButtonStyle}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          <p style={hintStyle}>
            Captures <strong>{activeTab}</strong> on <strong>{network}</strong> so the
            recipient sees the same view.
          </p>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
            <input
              ref={inputRef}
              readOnly
              value={url}
              aria-label="Shareable link"
              data-testid="share-view-url"
              onFocus={(event) => event.currentTarget.select()}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={handleCopy}
              style={{
                ...secondaryButtonStyle,
                color:
                  copyState === 'copied'
                    ? 'var(--cyan, #00e5ff)'
                    : copyState === 'failed'
                      ? '#f87171'
                      : undefined,
              }}
              data-testid="share-view-copy"
            >
              {copyState === 'copied' ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
              <span>{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Failed' : 'Copy'}</span>
            </button>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginTop: '10px',
              cursor: pinDisabled ? 'not-allowed' : 'pointer',
              opacity: pinDisabled ? 0.6 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={pinEnabled}
              disabled={pinDisabled}
              onChange={(event) => setPinEnabled(event.currentTarget.checked)}
              data-testid="share-view-pin-ledger"
              style={{ marginTop: 2 }}
            />
            <span style={{ fontSize: '12px', lineHeight: 1.45 }}>
              <Pin size={11} aria-hidden="true" style={{ verticalAlign: '-1px' }} />{' '}
              <strong>Pin to ledger {knownSequence ?? '—'}</strong>
              <span style={{ display: 'block', color: 'var(--text-secondary, #aaa)' }}>
                {pinDisabled ? support.note : 'Data reflects this ledger sequence.'}
              </span>
            </span>
          </label>

          <p
            style={{
              ...hintStyle,
              marginTop: '10px',
              display: 'flex',
              gap: '6px',
              alignItems: 'flex-start',
            }}
            data-testid="share-view-security-note"
          >
            <ShieldCheck size={13} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Contains only the view: network, tab, entity, filters and the optional ledger pin.
              No wallet keys, session tokens or connected-wallet data are included.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

/** Minimal structural type for the store fields a share link may observe. */
interface StoreWithShareable {
  network: NetworkName;
  activeTab: string;
  contractId: string;
  connectedAddress: string | null;
  searchFilters: ShareableViewState['searchFilters'];
  filterExpressions: ShareableViewState['filterExpressions'];
  selectedTemplateId: string | null;
}

/**
 * Shallow-equality comparator for the shareable slice. Without it, a
 * `useStore` selector returning a fresh object on every state change would
 * re-render (and re-generate the URL) on unrelated store writes such as
 * notifications.
 */
function shareableEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const left = a as StoreWithShareable;
  const right = b as StoreWithShareable;
  if (
    left.network !== right.network ||
    left.activeTab !== right.activeTab ||
    left.contractId !== right.contractId ||
    left.connectedAddress !== right.connectedAddress ||
    left.selectedTemplateId !== right.selectedTemplateId
  ) {
    return false;
  }
  if (left.filterExpressions !== right.filterExpressions) return false;
  if (left.searchFilters === right.searchFilters) return true;
  const lf = left.searchFilters ?? {};
  const rf = right.searchFilters ?? {};
  const keys = Object.keys(lf) as (keyof typeof lf)[];
  if (keys.length !== Object.keys(rf).length) return false;
  return keys.every((key) => lf[key] === rf[key]);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const triggerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  height: '36px',
  padding: '0 10px',
  background: 'var(--bg-elevated, #1a1a1a)',
  border: '1px solid var(--border, #333)',
  borderRadius: 'var(--radius-md, 6px)',
  color: 'var(--text-primary, #fff)',
  fontSize: '13px',
  cursor: 'pointer',
  transition: 'background var(--transition), border-color var(--transition)',
};

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  zIndex: 1200,
  width: 'min(360px, calc(100vw - 32px))',
  padding: '12px',
  border: '1px solid var(--border, #333)',
  borderRadius: 'var(--radius-lg, 10px)',
  background: 'var(--bg-card, #141414)',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
  color: 'var(--text-primary, #fff)',
  textAlign: 'left',
};

const panelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  marginBottom: '6px',
};

const hintStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '12px',
  lineHeight: 1.5,
  color: 'var(--text-secondary, #aaa)',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: '32px',
  padding: '0 8px',
  border: '1px solid var(--border, #333)',
  borderRadius: 'var(--radius-sm, 4px)',
  background: 'var(--bg-elevated, #1a1a1a)',
  color: 'var(--text-primary, #fff)',
  fontSize: '12px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

const secondaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '0 10px',
  border: '1px solid var(--border, #333)',
  borderRadius: 'var(--radius-sm, 4px)',
  background: 'var(--bg-elevated, #1a1a1a)',
  color: 'var(--text-primary, #fff)',
  fontSize: '12px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const iconButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  padding: 0,
  border: '1px solid transparent',
  borderRadius: 'var(--radius-sm, 4px)',
  background: 'transparent',
  color: 'var(--text-secondary, #aaa)',
  cursor: 'pointer',
};
