import React from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';
import '../../styles/accessibility.css';

export default function AccessibilitySettings({ onClose }: { onClose: () => void }) {
  const { settings, setReducedMotion, setHighContrast, setFontSize } = useAccessibility();

  const toggleReduced = () => setReducedMotion(!settings.reducedMotion);
  const toggleContrast = () => setHighContrast(!settings.highContrast);
  const changeFontSize = (size: 'small' | 'default' | 'large') => setFontSize(size);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          width: '90%',
          maxWidth: '500px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-elevated)',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Accessibility Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '24px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '16px 24px' }}>
          {/* Reduced Motion */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <label style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)' }}>Reduced Motion</label>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={toggleReduced}
              aria-checked={settings.reducedMotion}
            />
          </div>
          {/* High Contrast */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <label style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)' }}>High Contrast</label>
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={toggleContrast}
              aria-checked={settings.highContrast}
            />
          </div>
          {/* Font Size */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)' }}>Font Size</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['small', 'default', 'large'].map((size) => (
                <label key={size} style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="fontSize"
                    value={size}
                    checked={settings.fontSize === size}
                    onChange={() => changeFontSize(size as any)}
                  />
                  <span style={{ marginLeft: '4px' }}>{size.charAt(0).toUpperCase() + size.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
