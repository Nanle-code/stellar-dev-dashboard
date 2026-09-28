import React from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';
import '../../styles/accessibility.css';

export default function AccessibilitySettings({ onClose }: { onClose: () => void }) {
  const { settings, recommendations, confidence, setReducedMotion, setHighContrast, setFontSize, setDyslexiaFont, setAdaptiveMode, applyRecommendations } = useAccessibility();

  const toggleReduced = () => setReducedMotion(!settings.reducedMotion);
  const toggleContrast = () => setHighContrast(!settings.highContrast);
  const changeFontSize = (size: 'small' | 'default' | 'large') => setFontSize(size);
  const toggleDyslexiaFont = () => setDyslexiaFont(!settings.dyslexiaFont);
  const toggleAdaptiveMode = () => setAdaptiveMode(!settings.adaptiveMode);

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
          maxWidth: '560px',
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
        <div style={{ padding: '16px 24px', display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)' }}>Adaptive accessibility</label>
            <input type="checkbox" checked={settings.adaptiveMode} onChange={toggleAdaptiveMode} aria-checked={settings.adaptiveMode} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)' }}>Reduced Motion</label>
            <input type="checkbox" checked={settings.reducedMotion} onChange={toggleReduced} aria-checked={settings.reducedMotion} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)' }}>High Contrast</label>
            <input type="checkbox" checked={settings.highContrast} onChange={toggleContrast} aria-checked={settings.highContrast} />
          </div>
          <div>
            <div style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)' }}>Font Size</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {['small', 'default', 'large'].map((size) => (
                <label key={size} style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="radio" name="fontSize" value={size} checked={settings.fontSize === size} onChange={() => changeFontSize(size as 'small' | 'default' | 'large')} />
                  <span style={{ marginLeft: '4px' }}>{size.charAt(0).toUpperCase() + size.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)' }}>Dyslexia-Friendly Font</label>
            <input type="checkbox" checked={settings.dyslexiaFont} onChange={toggleDyslexiaFont} aria-checked={settings.dyslexiaFont} />
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', background: 'var(--bg-elevated)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>Adaptive recommendations</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Confidence: {(confidence * 100).toFixed(0)}%
            </div>
            {recommendations.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '16px', display: 'grid', gap: '6px' }}>
                {recommendations.map((recommendation) => (
                  <li key={`${recommendation.key}-${recommendation.value}`} style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                    {recommendation.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No recommendations yet. Continue using the dashboard to let the system learn your preferences.</div>
            )}
            <button type="button" onClick={applyRecommendations} style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--cyan)', color: 'var(--bg-primary)', cursor: 'pointer' }}>
              Apply recommended settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
