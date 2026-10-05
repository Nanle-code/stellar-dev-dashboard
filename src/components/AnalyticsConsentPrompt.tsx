import React, { useEffect, useRef, useState } from 'react';
import { saveAnalyticsConsentDecision } from '../utils/analyticsConsent';

interface AnalyticsConsentPromptProps {
  onDecision: () => void;
}

export default function AnalyticsConsentPrompt({ onDecision }: AnalyticsConsentPromptProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const declineButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    declineButtonRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  function decide(allowed: boolean) {
    setSaving(true);
    setError(null);
    try {
      saveAnalyticsConsentDecision(allowed);
      onDecision();
    } catch {
      setError(allowed
        ? 'Your choice could not be saved. Analytics and diagnostics remain off; try again after checking your browser storage settings.'
        : 'Your choice could not be saved. Analytics and diagnostics are off for this session. You can continue, but review this choice again before closing the app.');
    } finally {
      setSaving(false);
    }
  }

  function keepFocusInsideDialog(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;

    const buttons = Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 11000,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'rgba(0, 0, 0, 0.78)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-consent-title"
        aria-describedby="analytics-consent-description"
        ref={dialogRef}
        onKeyDown={keepFocusInsideDialog}
        tabIndex={-1}
        style={{
          width: 'min(100%, 560px)',
          padding: 24,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-bright)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--text-primary)',
          boxShadow: '0 18px 60px rgba(0, 0, 0, 0.45)',
        }}
      >
        <p style={{ margin: '0 0 8px', color: 'var(--cyan)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
          Privacy choice
        </p>
        <h2 id="analytics-consent-title" style={{ margin: '0 0 12px', fontFamily: 'var(--font-display)', fontSize: 22 }}>
          Review analytics and diagnostics
        </h2>
        <div id="analytics-consent-description" style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65 }}>
          <p>
            We can share page activity, browser and device details, performance measurements, redacted crash reports, and masked session replay data for errors to improve reliability. If enabled, this data is sent to the configured analytics and monitoring providers and retained for up to 30 days.
          </p>
          <p>
            This choice is optional. You can decline or withdraw it at any time in Settings. A material change to this policy will ask you to review it again.
          </p>
        </div>
        {error && (
          <p role="alert" style={{ color: 'var(--red)', fontSize: 12, lineHeight: 1.5 }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
          {error && (
            <button
              type="button"
              onClick={onDecision}
              disabled={saving}
              style={buttonStyle}
            >
              Continue without analytics
            </button>
          )}
          <button ref={declineButtonRef} type="button" onClick={() => decide(false)} disabled={saving} style={buttonStyle}>
            Decline
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            disabled={saving}
            style={{ ...buttonStyle, background: 'var(--cyan)', color: '#000', borderColor: 'var(--cyan)' }}
          >
            Allow analytics
          </button>
        </div>
      </section>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  minHeight: 40,
  padding: '9px 14px',
  border: '1px solid var(--border-bright)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
