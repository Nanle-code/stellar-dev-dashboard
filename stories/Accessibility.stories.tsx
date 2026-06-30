import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { AccessibilityProvider } from '../src/context/AccessibilityContext';
import AccessibilitySettings from '../src/components/accessibility/AccessibilitySettings';
import ScreenReaderAnnouncer from '../src/components/accessibility/ScreenReaderAnnouncer';

const meta: Meta = {
  title: 'Accessibility',
  parameters: {
    docs: {
      description: {
        component: 'Components that provide accessibility features: settings panel, keyboard navigation, and screen reader announcements.',
      },
    },
  },
};
export default meta;

// ─── AccessibilitySettings ────────────────────────────────────────────────────

/**
 * AccessibilitySettings requires AccessibilityProvider in context.
 * It renders as a modal overlay — the button below simulates opening it.
 */
const AccessibilitySettingsWrapper = () => {
  const [open, setOpen] = useState(false);
  return (
    <AccessibilityProvider>
      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          AccessibilitySettings renders as a modal overlay. Click the button to open it.
        </p>
        <button
          style={{
            padding: '10px 20px',
            background: 'var(--cyan)',
            color: 'var(--bg-base)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 700,
          }}
          onClick={() => setOpen(true)}
        >
          Open Accessibility Settings
        </button>
        {open && <AccessibilitySettings onClose={() => setOpen(false)} />}
      </div>
    </AccessibilityProvider>
  );
};

export const AccessibilitySettingsOpen: StoryObj = {
  name: 'AccessibilitySettings — Open',
  render: () => <AccessibilitySettingsWrapper />,
  parameters: {
    docs: { description: { story: 'Full settings panel with reduced motion, high contrast, and font size controls.' } },
    a11y: {
      config: {
        rules: [{ id: 'dialog-name', enabled: true }],
      },
    },
  },
};

export const AccessibilitySettingsMobile: StoryObj = {
  name: 'AccessibilitySettings — Mobile',
  render: () => <AccessibilitySettingsWrapper />,
  parameters: {
    viewport: { defaultViewport: 'mobile375' },
    docs: { description: { story: 'Accessibility settings panel at mobile viewport.' } },
  },
};

// ─── ScreenReaderAnnouncer ────────────────────────────────────────────────────

const AnnouncerDemo = () => {
  const { announceToScreenReader } = require('../src/utils/accessibility');
  const [lastMsg, setLastMsg] = React.useState('');
  const announce = (msg: string) => {
    announceToScreenReader(msg);
    setLastMsg(msg);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <ScreenReaderAnnouncer />
      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
        The announcer renders an invisible <code>aria-live="polite"</code> region.
        Screen readers will read messages pushed to it.
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          'Account loaded.',
          'Transaction confirmed.',
          'Error: insufficient balance.',
          'Network switched to Testnet.',
        ].map((msg) => (
          <button
            key={msg}
            style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)' }}
            onClick={() => announce(msg)}
          >
            Announce: "{msg.slice(0, 20)}…"
          </button>
        ))}
      </div>
      {lastMsg && (
        <p style={{ fontSize: '12px', color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
          Last announced: "{lastMsg}"
        </p>
      )}
    </div>
  );
};

export const ScreenReaderAnnouncerStory: StoryObj = {
  name: 'ScreenReaderAnnouncer',
  render: () => <AnnouncerDemo />,
  parameters: {
    docs: { description: { story: 'Pushes messages to an ARIA live region for screen reader users.' } },
  },
};

// ─── KeyboardNavigation (Command Palette) ─────────────────────────────────────
// KeyboardNavigation requires the full Zustand store. We document it and
// show a lightweight static preview to avoid runtime errors in isolation.

export const KeyboardNavigationInfo: StoryObj = {
  name: 'KeyboardNavigation — Command Palette',
  render: () => (
    <div style={{ fontFamily: 'var(--font-sans)', maxWidth: '520px' }}>
      <h3 style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--text-primary)' }}>
        Command Palette
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>
        <strong>KeyboardNavigation</strong> provides a command palette triggered by{' '}
        <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', fontSize: '11px' }}>Ctrl+K</kbd>{' '}
        or{' '}
        <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', fontSize: '11px' }}>⌘K</kbd>.
        It includes navigation commands, quick actions, recent accounts, and transaction templates.
        It requires the full app context (Zustand store) to function.
      </p>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <input
            placeholder="Type a command or search…"
            style={{ width: '100%', background: 'none', border: 'none', outline: 'none', fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
          />
        </div>
        {[
          { category: 'Navigation', items: ['Go to Dashboard', 'Go to Transactions', 'Go to Contracts'] },
          { category: 'Actions', items: ['Open Transaction Builder', 'Request Testnet Funds'] },
        ].map((group) => (
          <div key={group.category}>
            <div style={{ padding: '6px 14px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--bg-elevated)' }}>
              {group.category}
            </div>
            {group.items.map((item, i) => (
              <div
                key={item}
                style={{
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: i === 0 ? 'var(--cyan)' : 'var(--text-primary)',
                  background: i === 0 ? 'var(--cyan-glow)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Static preview of the command palette UI. Full functionality requires the app context (Ctrl+K in the running app).' } },
  },
};
