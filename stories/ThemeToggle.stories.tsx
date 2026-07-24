import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Sun, Moon } from 'lucide-react';

/**
 * ThemeToggle depends on Zustand store (store.ts).
 * These stories render a standalone replica so Storybook can compile without
 * the full app context. The real component lives at src/components/layout/ThemeToggle.jsx.
 */

const meta: Meta = {
  title: 'Layout/ThemeToggle',
  parameters: {
    docs: {
      description: {
        component: 'Button that switches between dark and light theme. Uses Zustand `toggleTheme` action.',
      },
    },
  },
};
export default meta;

const StandaloneThemeToggle = () => {
  const [dark, setDark] = useState(true);
  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-pressed={dark}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      style={{
        width: 36, height: 36,
        background: 'var(--bg-elevated, #1a1a1a)',
        border: '1px solid var(--border, #333)',
        borderRadius: 'var(--radius-md, 6px)',
        color: 'var(--text-primary, #fff)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};

export const Default: StoryObj = {
  render: () => <StandaloneThemeToggle />,
};

export const InToolbar: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, width: 'fit-content' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Theme:</span>
      <StandaloneThemeToggle />
    </div>
  ),
};

export const DarkMode: StoryObj = {
  name: 'Dark Mode',
  render: () => <StandaloneThemeToggle />,
  parameters: { backgrounds: { default: 'dark' } },
};

export const LightMode: StoryObj = {
  name: 'Light Mode',
  render: () => <StandaloneThemeToggle />,
  parameters: { backgrounds: { default: 'light' } },
};
