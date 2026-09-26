import React, { useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import {
  addSignatureToSession,
  addSignatureToXdr,
  SESSION_STATUS,
  isValidPublicKey,
} from '../../lib/multisig';
import { useNotifications } from '../../hooks/useNotifications';
import {
  usePreSignRiskSummary,
  REVIEW_SHOWN,
  REVIEW_ERROR,
} from '../../hooks/usePreSignRiskSummary';
import RiskSummaryPanel from '../security/RiskSummaryPanel';
import SignatureStatus from './SignatureStatus';

const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-bright)',
  borderRadius: 'var(--radius-md)',
  padding: '9px 12px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
  width: '100%',
};

const btnStyle = (variant = 'primary', disabled = false) => ({
  padding: '10px 18px',
  borderRadius: 'var(--radius-md)',
  border: `1px solid ${variant === 'primary' ? 'var(--cyan)' : 'var(--border)'}`,
  background: variant === 'primary' ? 'var(--cyan-glow)' : 'transparent',
  color: variant === 'primary' ? 'var(--cyan)' : 'var(--text-secondary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  transition: 'var(--transition)',
});

/**
 * Allows a co-signer to add their signature to a session using their secret key.
 * The secret key is never stored — it's used only in-memory to sign.
 */
export default function SignatureCollector({ session, onSessionUpdate }) {
  const { network } = useStore();
  const { success, error: notifyError, warning } = useNotifications();

  const [signerKey, setSignerKey] = useState('');
  const [signerSecret, setSignerSecret] = useState('');
  const [signing, setSigning] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // The session envelope that was actually summarised, so a co-signer always
  // signs exactly what the review panel showed them.
  const reviewedXdrRef = useRef(null);

  // #982 — a multisig signature is still a signature. The session's XDR is
  // reviewed against the same ruleset before the secret key is used, so a
  // co-signer cannot be talked into signing an account merge or a master-key
  // disable they never read.
  const {
    summary: riskSummary,
    reviewing: riskReviewing,
    reviewError: riskReviewError,
    beginReview,
    cancelReview,
    onAcknowledged,
    onTrustContract,
  } = usePreSignRiskSummary();

  const alreadySigned = session.collectedSignatures.some((s) => s.signerKey === signerKey);
  const isAuthorized = !signerKey || session.requiredSigners.some((s) => s.key === signerKey);
  const keyValid = !signerKey || isValidPublicKey(signerKey);

  const handleSign = async () => {
    if (!signerSecret) {
      warning('Missing Secret', 'Enter your secret key to sign');
      return;
    }
    if (!signerKey || !isValidPublicKey(signerKey)) {
      warning('Invalid Key', 'Enter a valid public key');
      return;
    }
    if (!isAuthorized) {
      warning('Not Authorized', 'This key is not a required signer for this session');
      return;
    }
    if (alreadySigned) {
      warning('Already Signed', 'This key has already signed this transaction');
      return;
    }

    // #982 — review first; only sign once the user has acknowledged. A session
    // XDR that cannot be decoded is refused rather than signed unreviewed.
    reviewedXdrRef.current = session.txXdr;
    const review = await beginReview(reviewedXdrRef.current);
    if (review === REVIEW_SHOWN) return;
    if (review === REVIEW_ERROR) {
      reviewedXdrRef.current = null;
      return;
    }

    await performSign(reviewedXdrRef.current);
  };

  const performSign = async (reviewedXdr = reviewedXdrRef.current) => {
    setSigning(true);
    try {
      const signedXdr = addSignatureToXdr(reviewedXdr, signerSecret, network);
      const updated = addSignatureToSession(session.id, signerKey, signedXdr);
      if (updated) {
        success('Signature Added', `${signerKey.slice(0, 8)}… signed successfully`);
        setSignerSecret('');
        if (onSessionUpdate) onSessionUpdate(updated);
      }
    } catch (err) {
      notifyError('Signing Failed', err.message);
    } finally {
      setSigning(false);
    }
  };

  const isSubmittable = session.status === SESSION_STATUS.READY || session.status === SESSION_STATUS.COLLECTING;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Signature status overview */}
      <SignatureStatus session={session} />

      {/* Sign form */}
      {session.status !== SESSION_STATUS.SUBMITTED && session.status !== SESSION_STATUS.FAILED && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Add Your Signature</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Your secret key is used only in-memory and never stored
            </div>
          </div>
          <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Your Public Key
              </span>
              <input
                style={{ ...inputStyle, borderColor: !keyValid ? 'var(--red)' : 'var(--border-bright)' }}
                placeholder="G... your public key"
                value={signerKey}
                onChange={(e) => setSignerKey(e.target.value.trim())}
                aria-label="Your public key"
              />
              {!keyValid && <span style={{ fontSize: '10px', color: 'var(--red)' }}>Invalid public key</span>}
              {signerKey && !isAuthorized && (
                <span style={{ fontSize: '10px', color: 'var(--amber)' }}>⚠ This key is not in the required signers list</span>
              )}
              {alreadySigned && (
                <span style={{ fontSize: '10px', color: 'var(--green)' }}>✓ Already signed</span>
              )}
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Secret Key
              </span>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSecret ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  placeholder="S... secret key"
                  value={signerSecret}
                  onChange={(e) => setSignerSecret(e.target.value.trim())}
                  aria-label="Your secret key"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px',
                  }}
                  aria-label={showSecret ? 'Hide secret key' : 'Show secret key'}
                >
                  {showSecret ? '🙈' : '👁'}
                </button>
              </div>
            </label>

            <button
              style={btnStyle('primary', signing || riskReviewing || alreadySigned || !signerKey || !signerSecret)}
              onClick={handleSign}
              disabled={signing || riskReviewing || alreadySigned || !signerKey || !signerSecret}
            >
              {riskReviewing ? 'Checking risks…' : signing ? 'Signing…' : 'Sign Transaction'}
            </button>

            {riskReviewError && (
              <div style={{
                padding: '12px',
                background: 'var(--red-glow)',
                border: '1px solid var(--red)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--red)',
                lineHeight: 1.5,
              }}>
                {riskReviewError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* #982 — pre-sign risk summary for the session's XDR. */}
      {riskSummary && (
        <RiskSummaryPanel
          summary={riskSummary}
          proceedLabel="Add My Signature"
          sourceLabel={`co-signer ${signerKey.slice(0, 6)}…${signerKey.slice(-6)}`}
          onAcknowledged={() => onAcknowledged(() => performSign(reviewedXdrRef.current))}
          onCancel={cancelReview}
          onTrustContract={onTrustContract}
        />
      )}

      {/* XDR export */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Current XDR</div>
          <button
            style={btnStyle('secondary')}
            onClick={() => { navigator.clipboard.writeText(session.txXdr); success('Copied', 'XDR copied'); }}
          >
            Copy
          </button>
        </div>
        <div style={{ padding: '14px 18px' }}>
          <textarea
            readOnly
            value={session.txXdr}
            rows={3}
            style={{
              width: '100%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              resize: 'vertical',
              outline: 'none',
            }}
            aria-label="Current transaction XDR"
          />
        </div>
      </div>
    </div>
  );
}
