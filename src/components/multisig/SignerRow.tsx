import React from 'react';
import { isValidPublicKey } from '../../lib/multisig';

const inputStyle = (hasError = false) => ({
  background: 'var(--bg-elevated)',
  border: `1px solid ${hasError ? 'var(--red)' : 'var(--border-bright)'}`,
  borderRadius: 'var(--radius-md)',
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
  width: '100%',
});

/**
 * A single editable signer row: public key + weight + remove button
 */
export default function SignerRow({ signer, index, onChange, onRemove, readOnly = false }) {
  const keyValid = !signer.key || isValidPublicKey(signer.key);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 80px auto',
      gap: '8px',
      alignItems: 'center',
    }}>
      <div>
        <input
          style={inputStyle(!keyValid)}
          placeholder="G... public key"
          value={signer.key}
          readOnly={readOnly}
          onChange={(e) => onChange(index, 'key', e.target.value)}
          aria-label={`Signer ${index + 1} public key`}
        />
        {!keyValid && (
          <div style={{ fontSize: '10px', color: 'var(--red)', marginTop: '3px' }}>Invalid public key</div>
        )}
        {signer.label && (
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{signer.label}</div>
        )}
      </div>

      <input
        type="number"
        min={0}
        max={255}
        style={inputStyle()}
        value={signer.weight}
        readOnly={readOnly}
        onChange={(e) => onChange(index, 'weight', parseInt(e.target.value, 10) || 0)}
        aria-label={`Signer ${index + 1} weight`}
      />

      {!readOnly && (
        <button
          onClick={() => onRemove(index)}
          title="Remove signer"
          style={{
            background: 'var(--red-glow)',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--red)',
            cursor: 'pointer',
            padding: '8px 10px',
            fontSize: '13px',
            lineHeight: 1,
            transition: 'var(--transition)',
          }}
          aria-label={`Remove signer ${index + 1}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}
