import React, { useRef, useState } from 'react';
import {
  exportSessionJson,
  addSignatureToSession,
  addSignatureToXdr,
  SESSION_STATUS,
} from '../../lib/multisig';
import { SigningCoordinator } from '../../lib/multisig/SigningCoordinator';
import { useNotifications } from '../../hooks/useNotifications';
import RiskSummaryPanel from '../security/RiskSummaryPanel';
import {
  usePreSignRiskSummary,
  REVIEW_SHOWN,
  REVIEW_ERROR,
} from '../../hooks/usePreSignRiskSummary';

export default function SignatureCollector({ session, onSessionUpdate }) {
  const [publicKey, setPublicKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [importText, setImportText] = useState('');

  const { success, error } = useNotifications();

  // #982 — pre-sign risk review for the session being co-signed.
  const {
    summary: riskSummary,
    onTrustContract: trustRiskContract,
    beginReview: beginRiskReview,
    cancelReview: cancelRiskReview,
    onAcknowledged: acknowledgeRiskReview,
  } = usePreSignRiskSummary();

  // The envelope that was actually summarised, so a co-signer always signs
  // exactly what the review panel showed them.
  const reviewedXdrRef = useRef(null);

  if (session.status === SESSION_STATUS.SUBMITTED) {
    return <div>Transaction has already been submitted.</div>;
  }

  const isRequired = session.requiredSigners.some((s) => s.key === publicKey);

  const performSign = async () => {
    try {
      const newXdr = addSignatureToXdr(reviewedXdrRef.current, secretKey, session.network);
      const updated = await addSignatureToSession(session.id, publicKey, newXdr);
      if (updated) {
        success('Signature Added', 'Your signature has been added to the session.');
        onSessionUpdate(updated);
        setSecretKey('');
      }
    } catch (e) {
      error('Signing Failed', e.message);
    }
  };

  const handleSign = async () => {
    // #982 — review first; only sign once the user has acknowledged. A session
    // XDR that cannot be decoded is refused rather than signed unreviewed.
    reviewedXdrRef.current = session.txXdr;
    const review = await beginRiskReview(reviewedXdrRef.current, session.network);
    if (review === REVIEW_SHOWN) return;
    if (review === REVIEW_ERROR) {
      reviewedXdrRef.current = null;
      return;
    }

    await performSign();
  };

  if (riskSummary) {
    return (
      <RiskSummaryPanel
        summary={riskSummary}
        proceedLabel="Add Signature"
        sourceLabel={
          publicKey ? `co-signer ${publicKey.slice(0, 6)}…${publicKey.slice(-6)}` : undefined
        }
        onAcknowledged={() => acknowledgeRiskReview(() => performSign())}
        onCancel={cancelRiskReview}
        onTrustContract={trustRiskContract}
      />
    );
  }

  const handleExport = () => {
    const json = exportSessionJson(session);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multisig-session-${session.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    try {
      const updatedSession = await SigningCoordinator.importAndMergeSession(importText);
      onSessionUpdate(updatedSession);
      setImportText('');
      success('Import Successful', 'Session imported and signatures merged successfully!');
    } catch (e) {
      error('Import Failed', e.message);
    }
  };

  return (
    <div
      className="signature-collector"
      style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
    >
      <div style={{ padding: '15px', border: '1px solid var(--border)', borderRadius: '6px' }}>
        <h3>Add Your Signature</h3>

        <label style={{ display: 'block', marginBottom: '10px' }}>
          Your Public Key
          <input
            style={{ display: 'block', width: '100%', marginTop: '5px' }}
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
          />
        </label>
        {publicKey && !isRequired && (
          <div style={{ color: 'var(--amber)', fontSize: '12px', marginBottom: '10px' }}>
            Warning: Not in the required signers
          </div>
        )}

        <label style={{ display: 'block', marginBottom: '10px' }}>
          Your Secret Key
          <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
            <input
              style={{ flex: 1 }}
              type={showSecret ? 'text' : 'password'}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
            />
            <button
              className="btn-secondary"
              aria-label={showSecret ? 'Hide Secret Key' : 'Show Secret Key'}
              onClick={() => setShowSecret(!showSecret)}
            >
              {showSecret ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <label style={{ display: 'block', marginBottom: '10px' }}>
          Current Transaction XDR
          <textarea
            style={{ display: 'block', width: '100%', marginTop: '5px' }}
            readOnly
            aria-label="Current Transaction XDR"
            value={session.txXdr}
          />
        </label>

        <button
          className="btn-primary"
          onClick={handleSign}
          disabled={!secretKey.trim()}
          aria-label="Sign Transaction"
        >
          Sign Transaction
        </button>
      </div>

      <div style={{ padding: '15px', border: '1px solid var(--border)', borderRadius: '6px' }}>
        <h3>Offline Co-Signers</h3>
        <div style={{ marginBottom: '10px' }}>
          <button onClick={handleExport} className="btn-secondary">
            Export Session (JSON)
          </button>
          <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-muted)' }}>
            Send this to offline co-signers to collect signatures.
          </small>
        </div>

        <div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste co-signer's session JSON here..."
            style={{ width: '100%', minHeight: '80px', marginBottom: '8px' }}
          />
          <button onClick={handleImport} className="btn-primary" disabled={!importText.trim()}>
            Import & Merge Partial XDR
          </button>
        </div>
      </div>
    </div>
  );
}
