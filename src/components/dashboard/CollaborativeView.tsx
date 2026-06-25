/**
 * CollaborativeView.jsx
 * Collaborative dashboard panel.
 * Exposes:
 *   - Shareable read-only URL (encodes network + tab + watch address)
 *   - Privacy disclosure before copying
 *   - Cross-tab sync status indicator
 *   - Optional WebSocket stub status
 *
 * Drop this in wherever you render dashboard tabs.
 * Requires the raw Zustand store (not the hook) as a prop.
 *
 * Example:
 *   import { store } from '../../lib/store';
 *   <CollaborativeView store={store} />
 */

import React, { useState, useEffect } from 'react';
import { useCollaboration } from '../../hooks/useCollaboration';

const ROADMAP_STEPS = [
  {
    step: 'Step 1',
    title: 'Real-time cursors',
    status: 'Planned',
    details: ['Cursor positions', 'Cursor sharing', 'Cursor rendering'],
  },
  {
    step: 'Step 2',
    title: 'Presence',
    status: 'Foundation',
    details: ['User presence', 'Online indicators', 'User info'],
  },
  {
    step: 'Step 3',
    title: 'Annotations',
    status: 'Planned',
    details: ['Collaborative annotations', 'Annotation types', 'Annotation sharing'],
  },
  {
    step: 'Step 4',
    title: 'Editing',
    status: 'Planned',
    details: ['Collaborative editing', 'Conflict resolution', 'CRDTs'],
  },
  {
    step: 'Step 5',
    title: 'Permissions',
    status: 'Partial',
    details: ['Edit permissions', 'Read-only mode', 'Permission UI'],
  },
];

// ── Inline style tokens — matches globals.css design tokens ──────────────────
const S = {
  root: {
    padding: '2rem',
    maxWidth: 680,
    margin: '0 auto',
    fontFamily: "'Space Mono', monospace",
  },
  sectionTitle: {
    fontSize: '0.65rem',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: 'var(--text-muted, #888)',
    marginBottom: '0.5rem',
    marginTop: '2rem',
  },
  card: {
    background: 'var(--bg-secondary, #1a1d23)',
    border: '1px solid var(--border-color, #2a2d35)',
    borderRadius: 8,
    padding: '1.25rem 1.5rem',
    marginBottom: '1rem',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  dot: (color) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
    boxShadow: `0 0 6px ${color}`,
  }),
  label: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary, #aaa)',
  },
  value: {
    fontSize: '0.8rem',
    color: 'var(--text-primary, #eee)',
    fontWeight: 600,
  },
  urlBox: {
    background: 'var(--bg-tertiary, #11131a)',
    border: '1px solid var(--border-color, #2a2d35)',
    borderRadius: 6,
    padding: '0.75rem 1rem',
    fontSize: '0.72rem',
    color: 'var(--text-secondary, #aaa)',
    wordBreak: 'break-all',
    marginTop: '0.75rem',
    marginBottom: '0.75rem',
    lineHeight: 1.6,
    fontFamily: "'Space Mono', monospace",
  },
  btn: (variant = 'primary') => ({
    padding: '0.5rem 1.1rem',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontFamily: "'Space Mono', monospace",
    letterSpacing: '0.05em',
    fontWeight: 600,
    transition: 'opacity 0.15s',
    ...(variant === 'primary'
      ? { background: 'var(--accent, #7c6af7)', color: '#fff' }
      : variant === 'danger'
      ? { background: '#c0392b22', color: '#e74c3c', border: '1px solid #c0392b55' }
      : { background: 'var(--bg-tertiary, #11131a)', color: 'var(--text-primary, #eee)', border: '1px solid var(--border-color, #2a2d35)' }),
  }),
  warning: {
    background: '#f39c1211',
    border: '1px solid #f39c1255',
    borderRadius: 8,
    padding: '1rem 1.25rem',
    marginTop: '0.75rem',
    fontSize: '0.78rem',
    color: '#f39c12',
    lineHeight: 1.7,
  },
  warningTitle: {
    fontWeight: 700,
    marginBottom: '0.35rem',
    fontSize: '0.8rem',
  },
  badge: (color) => ({
    display: 'inline-block',
    padding: '0.15rem 0.55rem',
    borderRadius: 20,
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    background: `${color}22`,
    color: color,
    border: `1px solid ${color}44`,
  }),
  stepCard: {
    background: 'var(--bg-tertiary, #11131a)',
    border: '1px solid var(--border-color, #2a2d35)',
    borderRadius: 10,
    padding: '1rem 1.1rem',
    display: 'grid',
    gap: '0.8rem',
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  stepMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    flexWrap: 'wrap',
  },
  stepNumber: {
    fontSize: '0.65rem',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: 'var(--text-muted, #888)',
  },
  stepTitle: {
    fontSize: '0.92rem',
    fontWeight: 700,
    color: 'var(--text-primary, #eee)',
  },
  stepList: {
    margin: 0,
    paddingLeft: '1.1rem',
    color: 'var(--text-secondary, #aaa)',
    lineHeight: 1.7,
    fontSize: '0.78rem',
  },
  timeline: {
    display: 'grid',
    gap: '0.75rem',
  },
  divider: {
    height: 1,
    background: 'var(--border-color, #2a2d35)',
    margin: '1.5rem 0',
  },
};

// ── Sync dot color map ───────────────────────────────────────────────────────
const syncColor = { active: '#2ecc71', idle: '#888', error: '#e74c3c' };
const wsColor = { connected: '#2ecc71', connecting: '#f39c12', disconnected: '#888', error: '#e74c3c' };

export default function CollaborativeView({ store, enableWebSocket = false, wsUrl }) {
  const {
    syncStatus,
    connectedTabs,
    shareURL,
    generateShareLink,
    copyShareLink,
    copySuccess,
    showPrivacyWarning,
    dismissPrivacyWarning,
    wsStatus,
  } = useCollaboration(store, { enableWebSocket, wsUrl });

  const [showUrl, setShowUrl] = useState(false);

  // Regenerate URL whenever store state changes (reflect current state)
  useEffect(() => {
    if (showUrl) generateShareLink();
  }, [showUrl, generateShareLink]);

  const handleGenerateClick = () => {
    generateShareLink();
    setShowUrl(true);
  };

  const handleCopyClick = async () => {
    await copyShareLink();
  };

  return (
    <div style={S.root}>
      {/* Header */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #eee)', marginBottom: 4 }}>
        Collaborative View
      </h2>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)', marginTop: 0, lineHeight: 1.6 }}>
        Share a read-only snapshot of your current session, or keep two tabs in sync automatically.
      </p>

      <p style={S.sectionTitle}>Current State</p>
      <div style={S.card}>
        <div style={S.row}>
          <span style={S.badge('#2ecc71')}>Available today</span>
          <span style={S.badge('#7c6af7')}>Read-only share links</span>
          <span style={S.badge('#7c6af7')}>Cross-tab sync</span>
        </div>
        <p style={{ ...S.label, marginTop: '0.75rem', lineHeight: 1.65 }}>
          The dashboard already supports safe shared views. The roadmap below tracks the next collaborative
          capabilities to build on top of that foundation.
        </p>
      </div>

      {/* ── Cross-tab sync status ── */}
      <p style={S.sectionTitle}>Cross-Tab Sync</p>
      <div style={S.card}>
        <div style={S.row}>
          <span style={S.dot(syncColor[syncStatus] || '#888')} />
          <span style={S.value}>
            {syncStatus === 'active' ? 'Active' : syncStatus === 'error' ? 'Unavailable' : 'Idle'}
          </span>
          <span style={S.badge('#7c6af7')}>{connectedTabs} tab{connectedTabs !== 1 ? 's' : ''}</span>
        </div>
        <p style={{ ...S.label, marginTop: '0.6rem', lineHeight: 1.6 }}>
          {syncStatus === 'active'
            ? 'Network, active tab, and watch address stay in sync across all tabs in this browser. Private keys are never shared.'
            : syncStatus === 'error'
            ? 'BroadcastChannel is not supported in this browser. Cross-tab sync is unavailable.'
          : 'Waiting for a state change to broadcast.'}
        </p>
      </div>

      <p style={S.sectionTitle}>Collaboration Roadmap</p>
      <div style={S.timeline}>
        {ROADMAP_STEPS.map((item) => (
          <div key={item.step} style={S.stepCard}>
            <div style={S.stepHeader}>
              <div style={S.stepMeta}>
                <span style={S.stepNumber}>{item.step}</span>
                <span style={S.stepTitle}>{item.title}</span>
              </div>
              <span
                style={S.badge(
                  item.status === 'Partial'
                    ? '#f39c12'
                    : item.status === 'Foundation'
                    ? '#2ecc71'
                    : '#7c6af7',
                )}
              >
                {item.status}
              </span>
            </div>
            <ul style={S.stepList}>
              {item.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
            {item.step === 'Step 5' && (
              <p style={{ ...S.label, margin: 0, lineHeight: 1.6 }}>
                Read-only session sharing is already in place. Permission management and a dedicated UI still need to
                be layered on top.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Shareable URL ── */}
      <p style={S.sectionTitle}>Share Link</p>
      <div style={S.card}>
        <p style={{ ...S.label, lineHeight: 1.65, marginTop: 0, marginBottom: '0.85rem' }}>
          Generate a URL encoding your current <strong style={{ color: 'var(--text-primary,#eee)' }}>network</strong>,{' '}
          <strong style={{ color: 'var(--text-primary,#eee)' }}>active tab</strong>, and{' '}
          <strong style={{ color: 'var(--text-primary,#eee)' }}>watch address</strong>. Anyone with the link can open
          the same view in read-only mode. <em>Private keys are never included.</em>
        </p>

        <div style={S.row}>
          <button style={S.btn('primary')} onClick={handleGenerateClick}>
            Generate Link
          </button>
          {showUrl && shareURL && (
            <button style={S.btn('secondary')} onClick={handleCopyClick}>
              {copySuccess ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
          )}
          {showUrl && (
            <button style={S.btn('secondary')} onClick={() => setShowUrl(false)}>
              Hide
            </button>
          )}
        </div>

        {/* Privacy warning */}
        {showPrivacyWarning && showUrl && (
          <div style={S.warning}>
            <div style={S.warningTitle}>⚠ Privacy Notice</div>
            <p style={{ margin: 0 }}>
              This link includes your <strong>watch address (public key)</strong>. Public keys are not secret — anyone
              can look up transactions for any address — but sharing this URL reveals <em>which address you are
              monitoring</em>. Only share with people you trust. No private keys or signing secrets are ever encoded
              in this URL.
            </p>
            <button
              style={{ ...S.btn('secondary'), marginTop: '0.75rem', fontSize: '0.72rem' }}
              onClick={dismissPrivacyWarning}
            >
              Understood, dismiss
            </button>
          </div>
        )}

        {/* URL display */}
        {showUrl && shareURL && (
          <div style={S.urlBox} aria-label="Shareable session URL">
            {shareURL}
          </div>
        )}

        {/* What the link restores */}
        <div style={{ ...S.row, marginTop: '0.85rem', gap: '0.5rem' }}>
          {['Network', 'Active Tab', 'Watch Address'].map((item) => (
            <span key={item} style={S.badge('#2ecc71')}>
              {item}
            </span>
          ))}
          <span style={S.badge('#e74c3c')}>No Private Keys</span>
        </div>
      </div>

      {/* ── WebSocket stub (only rendered if enabled) ── */}
      {enableWebSocket && (
        <>
          <p style={S.sectionTitle}>Real-Time Sync (WebSocket)</p>
          <div style={S.card}>
            <div style={S.row}>
              <span style={S.dot(wsColor[wsStatus] || '#888')} />
              <span style={S.value}>
                {wsStatus.charAt(0).toUpperCase() + wsStatus.slice(1)}
              </span>
              {wsUrl && (
                <span style={{ ...S.label, fontFamily: "'Space Mono', monospace", fontSize: '0.7rem' }}>
                  {wsUrl}
                </span>
              )}
            </div>
            <p style={{ ...S.label, marginTop: '0.6rem', lineHeight: 1.6 }}>
              {wsStatus === 'connected'
                ? 'Connected to WebSocket relay. State changes are broadcast to all connected sessions.'
                : wsStatus === 'connecting'
                ? 'Connecting to WebSocket relay…'
                : wsStatus === 'error'
                ? 'WebSocket connection failed. Cross-session sync is unavailable.'
                : 'Disconnected from WebSocket relay.'}
            </p>
          </div>
        </>
      )}

      <div style={S.divider} />

      {/* ── How it works ── */}
      <p style={S.sectionTitle}>How It Works</p>
      <div style={{ ...S.card, fontSize: '0.76rem', color: 'var(--text-muted, #888)', lineHeight: 1.75 }}>
        <p style={{ margin: '0 0 0.5rem 0' }}>
          <strong style={{ color: 'var(--text-secondary,#aaa)' }}>Cross-tab sync</strong> uses the browser's{' '}
          <code>BroadcastChannel</code> API. Changes to network, active tab, or watch address automatically propagate
          to every other tab open on the same origin.
        </p>
        <p style={{ margin: '0 0 0.5rem 0' }}>
          <strong style={{ color: 'var(--text-secondary,#aaa)' }}>Share links</strong> encode session state as a
          Base64 URL fragment (hash). The hash never leaves the browser — it is not sent to any server. The recipient
          restores network + tab + watch address when they open the link.
        </p>
        <p style={{ margin: 0 }}>
          <strong style={{ color: 'var(--text-secondary,#aaa)' }}>Private keys</strong> are never included in the
          broadcast channel or in URLs. The sync layer operates on a strict allow-list:{' '}
          <code>network</code>, <code>activeTab</code>, <code>connectedAddress</code>, <code>theme</code>.
        </p>
      </div>
    </div>
  );
}
