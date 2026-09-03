import React, { useEffect, useState } from 'react';
import { useStore } from '../../lib/store';
import { fetchAccount } from '../../lib/stellar';
import {
  parseAccountSigners,
  validateThresholds,
  buildSetSignersTransaction,
  isValidPublicKey,
} from '../../lib/multisig';
import { useNotifications } from '../../hooks/useNotifications';
import SignerRow from './SignerRow';
import ThresholdBar from './ThresholdBar';

const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-bright)',
  borderRadius: 'var(--radius-md)',
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
  width: '80px',
};

const btnStyle = (variant = 'primary') => ({
  padding: '10px 18px',
  borderRadius: 'var(--radius-md)',
  border: `1px solid ${variant === 'primary' ? 'var(--cyan)' : 'var(--border)'}`,
  background: variant === 'primary' ? 'var(--cyan-glow)' : 'transparent',
  color: variant === 'primary' ? 'var(--cyan)' : 'var(--text-secondary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  cursor: 'pointer',
  transition: 'var(--transition)',
});

/**
 * Panel for configuring multisig thresholds and co-signers on an account.
 * Produces a SetOptions XDR that can be passed to the Signer or a session.
 */
export default function MultisigSetup({ onXdrReady }) {
  const { connectedAddress, accountData, network } = useStore();
  const { success, error: notifyError } = useNotifications();

  const [signers, setSigners] = useState([]);
  const [thresholds, setThresholds] = useState({ low: 1, medium: 2, high: 2 });
  const [masterWeight, setMasterWeight] = useState(1);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [generatedXdr, setGeneratedXdr] = useState('');

  // Load current signers from account data
  useEffect(() => {
    if (!accountData) return;
    const { signers: parsed, thresholds: t, masterWeight: mw } = parseAccountSigners(accountData);
    setSigners(parsed.map((s) => ({ ...s, label: s.isMaster ? 'Master Key' : '' })));
    setThresholds(t);
    setMasterWeight(mw);
  }, [accountData]);

  const totalWeight = signers.reduce((s, r) => s + (r.weight || 0), 0);

  const handleSignerChange = (index, field, value) => {
    setSigners((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddSigner = () => {
    setSigners((prev) => [...prev, { key: '', weight: 1, isMaster: false, label: '' }]);
  };

  const handleRemoveSigner = (index) => {
    setSigners((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBuild = async () => {
    const { valid, errors } = validateThresholds(thresholds, signers);
    if (!valid) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    const invalidKeys = signers.filter((s) => !s.isMaster && s.key && !isValidPublicKey(s.key));
    if (invalidKeys.length > 0) {
      setValidationErrors(['One or more signer keys are invalid']);
      return;
    }

    setLoading(true);
    try {
      const account = await fetchAccount(connectedAddress, network);
      const tx = buildSetSignersTransaction(account, { signers, thresholds, masterWeight }, network);
      const xdr = tx.toXDR();
      setGeneratedXdr(xdr);
      success('XDR Built', 'SetOptions transaction ready for signing');
      if (onXdrReady) onXdrReady(xdr, signers, thresholds);
    } catch (err) {
      notifyError('Build Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!connectedAddress) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        Connect a wallet to configure multisig
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Thresholds */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Thresholds</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Minimum signature weight required per operation category
          </div>
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            {['low', 'medium', 'high'].map((level) => (
              <label key={level} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {level}
                </span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  style={{ ...inputStyle, width: '100%' }}
                  value={thresholds[level]}
                  onChange={(e) => setThresholds((t) => ({ ...t, [level]: parseInt(e.target.value, 10) || 0 }))}
                  aria-label={`${level} threshold`}
                />
              </label>
            ))}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Master Key Weight
            </span>
            <input
              type="number"
              min={0}
              max={255}
              style={{ ...inputStyle, width: '100%' }}
              value={masterWeight}
              onChange={(e) => setMasterWeight(parseInt(e.target.value, 10) || 0)}
              aria-label="Master key weight"
            />
          </label>

          <ThresholdBar currentWeight={totalWeight} threshold={thresholds.high} totalWeight={totalWeight} label="Total Weight vs High Threshold" />
        </div>
      </div>

      {/* Signers */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Co-Signers</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Total weight: {totalWeight}
            </div>
          </div>
          <button style={btnStyle('secondary')} onClick={handleAddSigner}>+ Add Signer</button>
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px auto', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Public Key</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Weight</span>
            <span />
          </div>

          {signers.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
              No signers loaded. Connect an account or add signers manually.
            </div>
          )}

          {signers.map((signer, i) => (
            <SignerRow
              key={i}
              signer={signer}
              index={i}
              onChange={handleSignerChange}
              onRemove={handleRemoveSigner}
              readOnly={signer.isMaster}
            />
          ))}
        </div>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div style={{
          background: 'var(--red-glow)',
          border: '1px solid var(--red)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {validationErrors.map((e, i) => (
            <div key={i} style={{ fontSize: '12px', color: 'var(--red)' }}>⚠ {e}</div>
          ))}
        </div>
      )}

      {/* Build button */}
      <button
        style={{ ...btnStyle('primary'), opacity: loading ? 0.6 : 1 }}
        onClick={handleBuild}
        disabled={loading}
      >
        {loading ? 'Building…' : 'Build SetOptions Transaction'}
      </button>

      {/* Generated XDR */}
      {generatedXdr && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Generated XDR</div>
            <button
              style={btnStyle('secondary')}
              onClick={() => { navigator.clipboard.writeText(generatedXdr); success('Copied', 'XDR copied to clipboard'); }}
            >
              Copy
            </button>
          </div>
          <div style={{ padding: '14px 18px' }}>
            <textarea
              readOnly
              value={generatedXdr}
              rows={4}
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
              aria-label="Generated transaction XDR"
            />
          </div>
        </div>
      )}
    </div>
  );
}
