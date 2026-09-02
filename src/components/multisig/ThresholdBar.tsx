import React from 'react';

/**
 * Visual progress bar showing signature weight collected vs threshold
 */
export default function ThresholdBar({ currentWeight, threshold, totalWeight, label }) {
  const pct = threshold > 0 ? Math.min(100, (currentWeight / threshold) * 100) : 0;
  const met = currentWeight >= threshold;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {label}
          </span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: met ? 'var(--green)' : 'var(--amber)' }}>
            {currentWeight} / {threshold}
            {totalWeight > 0 && <span style={{ color: 'var(--text-muted)' }}> (max {totalWeight})</span>}
          </span>
        </div>
      )}
      <div style={{
        height: '6px',
        background: 'var(--bg-elevated)',
        borderRadius: '3px',
        overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: met ? 'var(--green)' : 'var(--amber)',
          borderRadius: '3px',
          transition: 'width 0.3s ease, background 0.3s ease',
          boxShadow: met ? '0 0 6px var(--green)' : 'none',
        }} />
      </div>
    </div>
  );
}
