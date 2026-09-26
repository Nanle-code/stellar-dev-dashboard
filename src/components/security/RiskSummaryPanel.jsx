import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { FocusManager } from '../accessibility/FocusManager';
import { SEVERITIES, SEVERITY_LABELS } from '../../lib/riskRules';

/**
 * Pre-sign risk summary panel (#982)
 * =============================================================================
 * Renders the plain-language risk summary produced by
 * `computeRiskSummary()` (see `src/lib/riskSummary.js`) immediately before a
 * transaction is handed to a wallet.
 *
 * When the summary contains at least one rule with
 * `requiresAcknowledgement: true`, the proceed button stays disabled until the
 * user ticks the acknowledgement checkbox. The panel never blocks the flow on
 * its own: a failed simulation still renders, and the user can always
 * acknowledge and continue or cancel.
 *
 * Styling uses only the CSS custom properties defined in
 * `src/styles/globals.css` — `--red` for high risk, `--amber` for medium,
 * `--green` for no risk flagged, plus the shared `--border` / `--radius-*`
 * tokens. Colours are never hardcoded.
 *
 * Accessibility follows the existing dialog pattern in
 * `src/components/layout/MobileSidebar.jsx`: `role="alertdialog"`,
 * `aria-modal`, `aria-labelledby` / `aria-describedby`, Escape to cancel,
 * focus moved into the panel on open, and focus restored to the invoking
 * element on close via `FocusManager`.
 */

/** Severity -> design token. `--red` / `--amber` / `--green` from globals.css. */
const SEVERITY_COLORS = {
  [SEVERITIES.HIGH]: { color: 'var(--red)', bg: 'var(--red-glow)' },
  [SEVERITIES.MEDIUM]: { color: 'var(--amber)', bg: 'var(--amber-glow)' },
  [SEVERITIES.INFO]: { color: 'var(--green)', bg: 'var(--green-glow)' },
};

const severityStyle = (severity) => {
  const tokens = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS[SEVERITIES.INFO];
  return {
    color: tokens.color,
    background: tokens.bg,
    border: `1px solid ${tokens.color}`,
  };
};

const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '14px',
};

const monoStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  wordBreak: 'break-all',
};

const buttonStyle = (variant, disabled) => ({
  padding: '11px 18px',
  borderRadius: 'var(--radius-md)',
  border: `1px solid ${variant === 'primary' ? 'var(--cyan)' : 'var(--border)'}`,
  background: variant === 'primary' && !disabled ? 'var(--cyan-glow)' : 'transparent',
  color: variant === 'primary' ? 'var(--cyan)' : 'var(--text-secondary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  transition: 'var(--transition)',
});

/**
 * The overall-severity header badge.
 *
 * @param {{ overallSeverity: string }} props
 */
function OverallRiskBadge({ overallSeverity }) {
  return (
    <span
      data-testid="risk-overall-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        ...severityStyle(overallSeverity),
      }}
    >
      {SEVERITY_LABELS[overallSeverity] ?? SEVERITY_LABELS[SEVERITIES.INFO]}
    </span>
  );
}

/**
 * The expected balance changes for a single operation.
 *
 * @param {{ balanceChanges: object[] }} props
 */
function BalanceChangeList({ balanceChanges }) {
  if (!balanceChanges?.length) return null;

  return (
    <ul
      style={{
        listStyle: 'none',
        margin: '8px 0 0',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      {balanceChanges.map((change, idx) => (
        <li
          key={`${change.kind}-${change.account}-${idx}`}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            fontSize: '11px',
            lineHeight: 1.5,
            color: change.direction === 'credit' ? 'var(--green)' : 'var(--amber)',
          }}
        >
          <span aria-hidden="true" style={{ fontFamily: 'var(--font-mono)' }}>
            {change.direction === 'credit' ? '+' : '-'}
          </span>
          <span style={{ color: 'var(--text-primary)' }}>{change.note}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One operation in the transaction, with every rule that matched it.
 *
 * @param {{ entry: object }} props
 */
function OperationRow({ entry }) {
  return (
    <li style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          marginBottom: entry.appliedRules.length ? '8px' : '0',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {entry.index + 1}. {entry.label}
        </span>
        <span
          data-testid={`risk-severity-${entry.index}`}
          style={{
            padding: '3px 9px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            ...severityStyle(entry.severity),
          }}
        >
          {SEVERITY_LABELS[entry.severity] ?? SEVERITY_LABELS[SEVERITIES.INFO]}
        </span>
      </div>

      {entry.appliedRules.length === 0 ? (
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
          No risk pattern matched this operation.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {entry.appliedRules.map((rule) => (
            <li
              key={rule.id}
              data-testid={`risk-rule-${rule.id}`}
              style={{
                padding: '9px 11px',
                borderRadius: 'var(--radius-sm)',
                borderLeft: `3px solid ${(SEVERITY_COLORS[rule.severity] ?? SEVERITY_COLORS[SEVERITIES.INFO]).color}`,
                background: 'var(--bg-elevated)',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  lineHeight: 1.55,
                  color: 'var(--text-primary)',
                }}
              >
                {rule.summary}
              </p>
              <p
                style={{
                  margin: '5px 0 0',
                  ...monoStyle,
                  color: 'var(--text-muted)',
                }}
              >
                {rule.id}
                {rule.requiresAcknowledgement ? ' · acknowledgement required' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      <BalanceChangeList balanceChanges={entry.balanceChanges} />
    </li>
  );
}

/**
 * The pre-sign risk summary dialog.
 *
 * @param {object} props
 * @param {object} props.summary          — a `RiskSummary` from `computeRiskSummary`
 * @param {Function} props.onAcknowledged — called when the user proceeds
 * @param {Function} props.onCancel       — called when the user backs out
 * @param {Function} [props.onTrustContract] — called with a contract id to add to the allowlist
 * @param {string}  [props.proceedLabel]  — label for the proceed button
 * @param {string}  [props.sourceLabel]   — context line describing the signer
 * @returns {JSX.Element}
 */
export default function RiskSummaryPanel({
  summary,
  onAcknowledged,
  onCancel,
  onTrustContract,
  proceedLabel = 'Proceed to wallet',
  sourceLabel,
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const dialogRef = useRef(null);
  const headingId = useId();
  const descriptionId = useId();
  const cancelRef = useRef(null);

  const requiresAcknowledgement = summary?.requiresAcknowledgement === true;
  const canProceed = !requiresAcknowledgement || acknowledged;

  // Reset the acknowledgement whenever a new transaction is summarised.
  useEffect(() => {
    setAcknowledged(false);
  }, [summary]);

  // Move focus into the panel on open and restore it on close. Matches the
  // dialog pattern in `src/components/layout/MobileSidebar.jsx`.
  useEffect(() => {
    const focusTarget = dialogRef.current?.querySelector(
      'input, button, [href], [tabindex]:not([tabindex="-1"])'
    );
    focusTarget?.focus();
  }, []);

  // Escape cancels, as elsewhere in the dashboard's dialogs.
  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  // Prevent background scroll while the dialog is open.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleProceed = useCallback(() => {
    if (!canProceed) return;
    onAcknowledged?.();
  }, [canProceed, onAcknowledged]);

  if (!summary) return null;

  const hasUnknownContractFlag = summary.operations.some((entry) =>
    entry.appliedRules.some((rule) => rule.id === 'invoke-unknown-contract')
  );

  return (
    <>
      {/* Backdrop — click to cancel, matching the MobileSidebar pattern. */}
      <div
        aria-hidden="true"
        data-testid="risk-summary-backdrop"
        onClick={() => onCancel?.()}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
        }}
      />

      <FocusManager trapFocus restoreFocusOnUnmount>
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={headingId}
          aria-describedby={descriptionId}
          data-testid="risk-summary-panel"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              pointerEvents: 'auto',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '86vh',
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-bright)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <h2
                  id={headingId}
                  style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  Review before signing
                </h2>
                <p
                  id={descriptionId}
                  style={{
                    margin: '4px 0 0',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  {summary.operations.length} operation
                  {summary.operations.length === 1 ? '' : 's'} in this transaction
                  {sourceLabel ? ` · ${sourceLabel}` : ''}. Nothing has been signed yet.
                </p>
              </div>
              <OverallRiskBadge overallSeverity={summary.overallSeverity} />
            </div>

            {/* Body */}
            <div
              style={{
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {summary.sourceAccount && (
                <div style={monoStyle}>
                  <span style={{ color: 'var(--text-muted)' }}>Source: </span>
                  <span style={{ color: 'var(--text-primary)' }}>{summary.sourceAccount}</span>
                  {summary.feeBumpSource && (
                    <>
                      <br />
                      <span style={{ color: 'var(--text-muted)' }}>Fee paid by: </span>
                      <span style={{ color: 'var(--text-primary)' }}>{summary.feeBumpSource}</span>
                    </>
                  )}
                </div>
              )}

              {summary.notes.map((note) => (
                <p
                  key={note}
                  style={{
                    margin: 0,
                    padding: '8px 11px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)',
                    borderLeft: '3px solid var(--amber)',
                    fontSize: '11px',
                    lineHeight: 1.55,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {note}
                </p>
              ))}

              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {summary.operations.map((entry) => (
                  <OperationRow key={entry.index} entry={entry} />
                ))}
              </ul>

              {summary.simulation?.available && (
                <p
                  style={{
                    margin: 0,
                    ...monoStyle,
                    color: 'var(--text-muted)',
                  }}
                >
                  Simulation complete
                  {summary.simulation.minResourceFee
                    ? ` · resource fee ${summary.simulation.minResourceFee} stroops`
                    : ''}
                  {summary.simulation.touchedEntryCount !== null
                    ? ` · ${summary.simulation.touchedEntryCount} ledger entries touched`
                    : ''}
                </p>
              )}

              {hasUnknownContractFlag && onTrustContract && (
                <button
                  type="button"
                  onClick={() => onTrustContract(summary)}
                  style={{
                    ...buttonStyle('secondary', false),
                    alignSelf: 'flex-start',
                  }}
                >
                  Add this contract to my known list
                </button>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px 20px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
              }}
            >
              {requiresAcknowledgement && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    marginBottom: '14px',
                    fontSize: '12px',
                    lineHeight: 1.55,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                    aria-label="I have reviewed the flagged risks and want to continue"
                    style={{
                      marginTop: '2px',
                      width: '16px',
                      height: '16px',
                      accentColor: 'var(--red)',
                      flexShrink: 0,
                    }}
                  />
                  <span>
                    I have read the flagged operations above and understand they may permanently
                    change or remove access to this account.
                  </span>
                </label>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  ref={cancelRef}
                  onClick={() => onCancel?.()}
                  style={buttonStyle('secondary', false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProceed}
                  disabled={!canProceed}
                  aria-disabled={!canProceed}
                  style={buttonStyle('primary', !canProceed)}
                >
                  {proceedLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </FocusManager>
    </>
  );
}
