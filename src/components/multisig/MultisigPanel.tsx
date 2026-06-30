/**
 * MultisigPanel
 *
 * Embedded multi-signature workflow panel for the TransactionBuilder.
 * Guides the user through three sequential steps:
 *   0 — Configure Signers
 *   1 — Collect Signatures
 *   2 — Review & Submit
 *
 * Validates: Requirements 4.1
 */

import React, { useState, useRef } from 'react';
import type { MultisigAccountInfo } from '../../hooks/useMultisigDetection';
import { isValidPublicKey, createSession, SESSION_STATUS } from '../../lib/multisig';
import SignerRow from './SignerRow';
import ThresholdBar from './ThresholdBar';
import SignatureCollector from './SignatureCollector';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Mirrors the MultisigSession shape from src/lib/multisig.js
 */
export interface MultisigSession {
  id: string;
  txXdr: string;
  sourceAddress: string;
  description: string;
  requiredSigners: Array<{ key: string; weight: number; label?: string }>;
  threshold: number;
  network: string;
  collectedSignatures: Array<{ signerKey: string; xdr: string; addedAt: string }>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MultisigPanelProps {
  /** Built transaction XDR from TransactionBuilder */
  txXdr: string;
  /** G… public key of the connected wallet / source account */
  sourceAddress: string;
  /** Stellar network context ("testnet" | "mainnet" | "futurenet" | "local") */
  network: string;
  /** Account info resolved by useMultisigDetection */
  accountInfo: MultisigAccountInfo;
  /** Called with the Horizon submit result when the transaction is submitted */
  onSubmitted: (result: object) => void;
}

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS: { label: string }[] = [
  { label: 'Configure Signers' },
  { label: 'Collect Signatures' },
  { label: 'Review & Submit' },
];

// ─── Styles (inline, matching existing component conventions) ─────────────────

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  padding: '20px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
};

const stepListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  gap: '0',
  listStyle: 'none',
  margin: 0,
  padding: 0,
  alignItems: 'center',
};

const stepItemStyle = (isCurrent: boolean, isCompleted: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
  flex: 1,
  position: 'relative',
});

const stepCircleStyle = (isCurrent: boolean, isCompleted: boolean): React.CSSProperties => ({
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: 'var(--font-mono)',
  transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
  background: isCurrent
    ? 'var(--accent)'
    : isCompleted
      ? 'var(--green)'
      : 'var(--bg-base)',
  border: `2px solid ${
    isCurrent
      ? 'var(--accent)'
      : isCompleted
        ? 'var(--green)'
        : 'var(--border-bright)'
  }`,
  color: isCurrent || isCompleted ? '#fff' : 'var(--text-muted)',
  zIndex: 1,
});

const stepLabelStyle = (isCurrent: boolean): React.CSSProperties => ({
  fontSize: '11px',
  fontWeight: isCurrent ? 600 : 400,
  color: isCurrent ? 'var(--text-primary)' : 'var(--text-muted)',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  letterSpacing: isCurrent ? '0.2px' : undefined,
});

const stepConnectorStyle = (isCompleted: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: '14px',
  left: '50%',
  width: '100%',
  height: '2px',
  background: isCompleted ? 'var(--green)' : 'var(--border)',
  transition: 'background 0.2s ease',
  zIndex: 0,
});

const stepContentStyle: React.CSSProperties = {
  minHeight: '80px',
  padding: '16px',
  background: 'var(--bg-base)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-muted)',
  fontSize: '13px',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'center',
  gap: '12px',
};

const backButtonStyle = (disabled: boolean): React.CSSProperties => ({
  background: 'transparent',
  border: `1px solid ${disabled ? 'var(--border)' : 'var(--border-bright)'}`,
  borderRadius: 'var(--radius-sm)',
  color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  padding: '8px 16px',
  fontSize: '13px',
  opacity: disabled ? 0.5 : 1,
  transition: 'var(--transition)',
});

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * MultisigPanel renders a 3-step linear workflow for multi-signature
 * transaction coordination. This file contains only the skeleton and state —
 * step content will be filled in by subsequent tasks.
 */
export default function MultisigPanel({
  txXdr,
  sourceAddress,
  network,
  accountInfo,
  onSubmitted,
}: MultisigPanelProps) {
  // ── Refs ─────────────────────────────────────────────────────────────────────

  /** Ref for the co-signer public key input, used to refocus after a successful add */
  const signerInputRef = useRef<HTMLInputElement>(null);

  // ── Owned state ──────────────────────────────────────────────────────────────

  /** Current step index: 0 = Configure Signers, 1 = Collect Signatures, 2 = Review & Submit */
  const [step, setStep] = useState<0 | 1 | 2>(0);

  /**
   * Monotonic lock: once the user has reached "Review & Submit", this flag
   * remains true for the lifetime of the panel (Req 4.4).
   */
  const [hasEverReachedReview, setHasEverReachedReview] = useState<boolean>(false);

  /** User-assembled list of required co-signers for this transaction */
  const [requiredSigners, setRequiredSigners] = useState<
    Array<{ key: string; weight: number }>
  >([]);

  /** Active signing session created by createSession from multisig.js */
  const [session, setSession] = useState<MultisigSession | null>(null);

  /** Controlled input value for the co-signer public key field */
  const [signerInput, setSignerInput] = useState<string>('');

  /** Inline validation error for the signer public key input; null when valid */
  const [signerInputError, setSignerInputError] = useState<string | null>(null);

  /** Whether the clipboard-copy success toast is visible */
  const [exportConfirmVisible, setExportConfirmVisible] = useState<boolean>(false);

  /**
   * Whether the back-navigation confirmation dialog is visible.
   * The dialog warns that navigating back will invalidate collected signatures.
   */
  const [backDialogVisible, setBackDialogVisible] = useState<boolean>(false);

  /** Inline error message shown when createSession rejects; null when no error */
  const [sessionError, setSessionError] = useState<string | null>(null);

  /** True while createSession is in flight; disables the "Confirm Signers" button */
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  /**
   * Decrement the step counter.
   * Dialog logic (task 9) will be wired here once implemented.
   * On step 0 the button is disabled so this guard is a safety net only.
   */
  function handleBack() {
    if (step === 0) return;
    setStep((prev) => (prev - 1) as 0 | 1 | 2);
  }

  /**
   * Attempt to add the current `signerInput` value to `requiredSigners`.
   * Validates with `isValidPublicKey`, checks for duplicates, enforces 20-signer cap.
   */
  function handleAddSigner() {
    const key = signerInput.trim();

    if (!isValidPublicKey(key)) {
      setSignerInputError('Invalid public key. Please enter a valid Stellar G… address.');
      return;
    }

    if (requiredSigners.some((s) => s.key === key)) {
      setSignerInputError('This public key is already in the co-signer list.');
      return;
    }

    setRequiredSigners((prev) => [...prev, { key, weight: 1 }]);
    setSignerInput('');
    setSignerInputError(null);

    // Refocus input after adding so the user can immediately add another
    requestAnimationFrame(() => signerInputRef.current?.focus());
  }

  /**
   * Handle Enter key press in the signer input field.
   */
  function handleSignerInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSigner();
    }
  }

  /**
   * Handle weight changes for a signer in the list (forwarded to SignerRow onChange).
   */
  function handleSignerChange(index: number, field: string, value: string | number) {
    setRequiredSigners((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  /**
   * Remove the signer at the given index from `requiredSigners`.
   */
  function handleSignerRemove(index: number) {
    setRequiredSigners((prev) => prev.filter((_, i) => i !== index));
  }

  /**
   * Callback invoked by SignatureCollector when the session is updated
   * (e.g. a new signature was added or an XDR import was merged).
   *
   * - Always syncs local session state with the updated session.
   * - If collected weight has just reached or exceeded the threshold for the
   *   first time, sets the monotonic lock and advances to step 2.
   * - Once hasEverReachedReview is true, step never regresses below 2 (Req 4.4).
   */
  function handleSessionUpdate(updatedSession: MultisigSession) {
    setSession(updatedSession);

    if (!hasEverReachedReview) {
      const collectedKeys = new Set(
        updatedSession.collectedSignatures.map((sig) => sig.signerKey)
      );
      const collectedWeight = updatedSession.requiredSigners.reduce(
        (sum, signer) => sum + (collectedKeys.has(signer.key) ? signer.weight : 0),
        0
      );

      if (collectedWeight >= updatedSession.threshold) {
        setHasEverReachedReview(true);
        setStep(2);
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={containerStyle} data-testid="multisig-panel">
      {/* ── Step indicator ─────────────────────────────────────────────────── */}
      <ol role="list" style={stepListStyle} aria-label="Multisig workflow steps">
        {STEPS.map((s, idx) => {
          const isCurrent = idx === step;
          const isCompleted = idx < step;

          return (
            <React.Fragment key={s.label}>
              <li
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
                style={stepItemStyle(isCurrent, isCompleted)}
              >
                {/* Connector line (drawn to the right of each step except last) */}
                {idx < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    style={stepConnectorStyle(isCompleted)}
                  />
                )}

                {/* Circle badge */}
                <span
                  aria-hidden="true"
                  style={stepCircleStyle(isCurrent, isCompleted)}
                >
                  {isCompleted ? '✓' : idx + 1}
                </span>

                {/* Step label */}
                <span style={stepLabelStyle(isCurrent)}>{s.label}</span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>

      {/* ── Signature progress section (steps 1 and 2 only) ──────────────── */}
      {step >= 1 && session && (() => {
        const collectedKeys = new Set(session.collectedSignatures.map((s) => s.signerKey));

        // currentWeight: sum of weights of required signers who have signed
        const currentWeight = session.requiredSigners.reduce(
          (sum, s) => sum + (collectedKeys.has(s.key) ? s.weight : 0),
          0
        );

        // totalWeight: sum of all required signer weights
        const totalWeight = session.requiredSigners.reduce((sum, s) => sum + s.weight, 0);

        const threshold = session.threshold;
        const signedCount = session.collectedSignatures.length;
        const totalCount = session.requiredSigners.length;

        return (
          <div
            data-testid="multisig-progress-section"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '16px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {/* ThresholdBar */}
            <ThresholdBar
              currentWeight={currentWeight}
              threshold={threshold}
              totalWeight={totalWeight}
              label="Signature Weight"
            />

            {/* Weight label + signed count + Ready to Submit badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                }}
                aria-label={`${currentWeight} of ${threshold} weight collected`}
              >
                {currentWeight} / {threshold} weight
              </span>

              <span
                style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                }}
                aria-label={`${signedCount} of ${totalCount} signers have signed`}
              >
                {signedCount} of {totalCount} signed
              </span>

              {session.status === SESSION_STATUS.READY && (
                <span
                  role="status"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--green)',
                    border: '1px solid var(--green)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 8px',
                    letterSpacing: '0.3px',
                  }}
                >
                  Ready to Submit
                </span>
              )}
            </div>

            {/* Per-signer state rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {session.requiredSigners.map((signer) => {
                const isSigned = collectedKeys.has(signer.key);
                const truncatedKey = `${signer.key.slice(0, 6)}…${signer.key.slice(-6)}`;

                return (
                  <div
                    key={signer.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '7px 12px',
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${isSigned ? 'var(--green)' : 'var(--border)'}`,
                    }}
                  >
                    {/* State indicator icon */}
                    {isSigned ? (
                      <>
                        <span aria-hidden="true" style={{ fontSize: '14px', color: 'var(--green)', flexShrink: 0 }}>✓</span>
                        <span className="sr-only">Signed</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true" style={{ fontSize: '14px', color: 'var(--amber, #f59e0b)', flexShrink: 0 }}>⏱</span>
                        <span className="sr-only">Pending</span>
                      </>
                    )}

                    {/* Truncated public key */}
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={signer.key}
                    >
                      {truncatedKey}
                    </span>

                    {/* Weight */}
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        flexShrink: 0,
                      }}
                    >
                      w:{signer.weight}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Step content area ─────────────────────────────────────────────── */}
      <div data-testid={`multisig-step-content-${step}`}>
        {step === 0 && (
          <div style={{ ...stepContentStyle, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: '16px' }} aria-label="Configure Signers step content">

            {/* ── Public key input + Add button ─────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="signer-input"
                style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}
              >
                Add Co-Signer Public Key
              </label>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <input
                    id="signer-input"
                    ref={signerInputRef}
                    type="text"
                    value={signerInput}
                    onChange={(e) => {
                      setSignerInput(e.target.value);
                      if (signerInputError) setSignerInputError(null);
                    }}
                    onKeyDown={handleSignerInputKeyDown}
                    disabled={requiredSigners.length >= 20}
                    placeholder="G… public key"
                    aria-label="Co-signer public key"
                    aria-describedby={signerInputError ? 'signer-input-error' : undefined}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: `1px solid ${signerInputError ? 'var(--red)' : 'var(--border-bright)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                      width: '100%',
                      opacity: requiredSigners.length >= 20 ? 0.5 : 1,
                    }}
                  />

                  {signerInputError && (
                    <span
                      id="signer-input-error"
                      role="alert"
                      style={{ fontSize: '11px', color: 'var(--red)', marginTop: '2px' }}
                    >
                      {signerInputError}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddSigner}
                  disabled={requiredSigners.length >= 20}
                  aria-label="Add Co-Signer"
                  style={{
                    background: requiredSigners.length >= 20 ? 'var(--bg-elevated)' : 'var(--accent)',
                    border: `1px solid ${requiredSigners.length >= 20 ? 'var(--border)' : 'var(--accent)'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: requiredSigners.length >= 20 ? 'var(--text-muted)' : '#fff',
                    cursor: requiredSigners.length >= 20 ? 'not-allowed' : 'pointer',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    opacity: requiredSigners.length >= 20 ? 0.5 : 1,
                    transition: 'var(--transition)',
                    flexShrink: 0,
                  }}
                >
                  Add Co-Signer
                </button>
              </div>

              {/* Max signer cap message */}
              {requiredSigners.length >= 20 && (
                <span
                  role="status"
                  style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}
                >
                  Maximum of 20 co-signers reached
                </span>
              )}
            </div>

            {/* ── Signer list ───────────────────────────────────────────── */}
            {requiredSigners.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px auto',
                    gap: '8px',
                    paddingBottom: '4px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Public Key</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Weight</span>
                  <span />
                </div>

                {requiredSigners.map((signer, idx) => (
                  <SignerRow
                    key={signer.key}
                    signer={signer}
                    index={idx}
                    onChange={handleSignerChange}
                    onRemove={handleSignerRemove}
                    readOnly={false}
                  />
                ))}
              </div>
            )}

            {/* ── Weight / threshold summary ────────────────────────────── */}
            {(() => {
              const totalWeight = requiredSigners.reduce((sum, s) => sum + (s.weight || 0), 0);
              const threshold = accountInfo.thresholds?.low ?? 0;
              const isUnachievable = totalWeight < threshold;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                    aria-label={`Total weight: ${totalWeight} / Threshold: ${threshold}`}
                  >
                    Total weight: {totalWeight} / Threshold: {threshold}
                  </span>

                  {isUnachievable && requiredSigners.length > 0 && (
                    <span
                      role="alert"
                      style={{
                        fontSize: '12px',
                        color: 'var(--amber, #f59e0b)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span aria-hidden="true">⚠</span>
                      Warning: current signer configuration cannot meet the threshold
                    </span>
                  )}
                </div>
              );
            })()}

            {/* ── Confirm Signers button ────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', paddingTop: '4px' }}>
              <button
                type="button"
                aria-label="Confirm Signers"
                disabled={isCreatingSession}
                style={{
                  background: isCreatingSession ? 'var(--bg-elevated)' : 'var(--accent)',
                  border: `1px solid ${isCreatingSession ? 'var(--border)' : 'var(--accent)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: isCreatingSession ? 'var(--text-muted)' : '#fff',
                  cursor: isCreatingSession ? 'not-allowed' : 'pointer',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'var(--transition)',
                  opacity: isCreatingSession ? 0.6 : 1,
                }}
                onClick={async () => {
                  setIsCreatingSession(true);
                  setSessionError(null);
                  try {
                    const newSession = await createSession({
                      txXdr,
                      sourceAddress,
                      requiredSigners,
                      threshold: accountInfo.thresholds.low,
                      network,
                      description: 'Multisig Transaction',
                    });
                    setSession(newSession);
                    setSessionError(null);
                    setStep(1);
                  } catch (err: unknown) {
                    const message =
                      err instanceof Error
                        ? err.message
                        : typeof err === 'string'
                          ? err
                          : 'Failed to create session. Please try again.';
                    setSessionError(message);
                  } finally {
                    setIsCreatingSession(false);
                  }
                }}
              >
                {isCreatingSession ? 'Creating Session…' : 'Confirm Signers'}
              </button>

              {sessionError && (
                <div
                  role="alert"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--red, #ef4444)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--red, #ef4444)',
                    fontSize: '12px',
                    lineHeight: 1.5,
                  }}
                >
                  {sessionError}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={stepContentStyle} aria-label="Collect Signatures step content">
            {session ? (
              <SignatureCollector session={session} onSessionUpdate={handleSessionUpdate} />
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                No active session — please go back to Configure Signers.
              </span>
            )}
          </div>
        )}

        {step === 2 && (
          <div style={stepContentStyle} aria-label="Review & Submit step content">
            {/* Review and submit — implemented in task 10 */}
            <span>Review &amp; Submit — content coming in task 10</span>
          </div>
        )}
      </div>

      {/* ── Footer navigation ─────────────────────────────────────────────── */}
      <div style={footerStyle}>
        <button
          type="button"
          disabled={step === 0}
          onClick={handleBack}
          style={backButtonStyle(step === 0)}
          aria-label="Go to previous step"
          aria-disabled={step === 0}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
