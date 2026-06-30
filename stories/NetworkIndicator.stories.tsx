import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

/**
 * NetworkIndicator depends on Zustand store (store.ts).
 * Standalone replica for Storybook isolation.
 */

const meta: Meta = {
  title: 'Layout/NetworkIndicator',
  parameters: {
    docs: { description: { component: 'Pill showing the active Stellar network with a color-coded status dot.' } },
  },
};
export default meta;

const COLOR_MAP: Record<string, string> = {
  mainnet:  '#22c55e',
  testnet:  '#f59e0b',
  futurenet:'#00e5ff',
  local:    '#8b5cf6',
  custom:   '#0ea5e9',
};

const NetworkIndicatorPreview = ({ network = 'testnet', compact = false }) => (
  <div
    style={{
      display: 'inline-flex', alignItems: 'center',
      gap: compact ? 6 : 8, padding: compact ? 6 : 8,
      borderRadius: '999px', background: 'var(--bg-elevated)',
      border: '1px solid var(--border)', color: 'var(--text-secondary)',
      fontSize: 12, fontFamily: 'var(--font-mono)',
    }}
  >
    <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_MAP[network] || '#718096', display: 'inline-block' }} />
    <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{network}</span>
  </div>
);

export const Testnet: StoryObj = { render: () => <NetworkIndicatorPreview network="testnet" /> };
export const Mainnet: StoryObj = { render: () => <NetworkIndicatorPreview network="mainnet" /> };
export const Futurenet: StoryObj = { render: () => <NetworkIndicatorPreview network="futurenet" /> };
export const Local: StoryObj = { render: () => <NetworkIndicatorPreview network="local" /> };
export const Compact: StoryObj = { render: () => <NetworkIndicatorPreview network="testnet" compact /> };

export const AllNetworks: StoryObj = {
  name: 'All Networks',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {['mainnet', 'testnet', 'futurenet', 'local', 'custom'].map((n) => (
        <NetworkIndicatorPreview key={n} network={n} />
      ))}
    </div>
  ),
};

export const DarkMode: StoryObj = {
  render: () => <NetworkIndicatorPreview network="testnet" />,
  parameters: { backgrounds: { default: 'dark' } },
};

export const LightMode: StoryObj = {
  render: () => <NetworkIndicatorPreview network="testnet" />,
  parameters: { backgrounds: { default: 'light' } },
};

export const MobileViewport: StoryObj = {
  render: () => <NetworkIndicatorPreview network="testnet" compact />,
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};
