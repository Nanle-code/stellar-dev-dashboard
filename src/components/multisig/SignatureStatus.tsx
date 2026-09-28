import React from 'react';
import { checkThresholdMet } from '../../lib/multisig';
import ThresholdBar from './ThresholdBar';

const STATUS_COLOR = {
  pending: 'var(--text-muted)',
  collecting: 'var(--amber)',
  ready: 'var(--green)',
  submitted: 'var(--cyan)',
  failed: 'var(--red)',
};

const STATUS_LABEL = {
  pending: 'Pending',
  collecting: 'Collecting Signatures',
  ready: 'Ready to Submit',
  submitted: 'Submitted',
  failed: 'Failed',
};

/**
 * Shows per-signer signature status and overall threshold progress
 */
export default function SignatureStatus({ session }) {
  const { requiredSigners, collectedSignatures, threshold, status } = session;
  const collectedKeys = new Set(collectedSignatures.map((s) => s.signerKey));
  const { currentWeight, needed } = checkThresholdMet(
    [...collectedKeys],
    requiredSigners,
    threshold
  );
  const totalWeight = requiredSigners.reduce((s, r) => s + r.weight, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: STATUS_COLOR[status] || 'var(--text-muted)',
          boxShadow: `0 0 6px ${STATUS_COLOR[status] || 'var(--text-muted)'}`,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '12px', color: STATUS_COLOR[status], fontFamily: 'var(--font-mono)' }}>
          {STATUS_LABEL[status] || status}
        </span>
        {needed > 0 && status !== 'submitted' && status !== 'failed' && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {needed} more weight needed
          </span>
        )}
      </div>

      {/* Threshold progress */}
      <ThresholdBar
        currentWeight={currentWeight}
        threshold={threshold}
        totalWeight={totalWeight}
        label="Signature Weight"
      />

      {/* Per-signer list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {requiredSigners.map((signer) => {
          const signed = collectedKeys.has(signer.key);
          return (
            <div key={signer.key} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${signed ? 'var(--green)' : 'var(--border)'}`,
            }}>
              <span style={{
                fontSize: '14px',
                color: signed ? 'var(--green)' : 'var(--text-muted)',
                flexShrink: 0,
              }}>
                {signed ? '✓' : '○'}
              </span>
              <span style={{
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {signer.label || `${signer.key.slice(0, 8)}…${signer.key.slice(-6)}`}
              </span>
              <span style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                flexShrink: 0,
              }}>
                w:{signer.weight}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
