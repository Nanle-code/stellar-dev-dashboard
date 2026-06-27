import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Introduction',
  parameters: {
    docs: { description: { component: 'Stellar Dev Dashboard — Component Catalog' } },
  },
};
export default meta;

export const Overview: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 740, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', lineHeight: 1.6 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        ✦ Stellar Dev Dashboard — Component Catalog
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
        A real-time, open-source developer dashboard for the Stellar network.
        Stack: <strong style={{ color: 'var(--text-secondary)' }}>React 18 · Vite 5 · TypeScript · Zustand · Recharts · Storybook 8.5</strong>
      </p>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 13 }}>
        Components use CSS custom properties for theming — switch Dark/Light with the toolbar above.
        axe-core accessibility checks run automatically on every story.
      </p>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Component Groups</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 28 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Story Group</th>
            <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Components</th>
            <th style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Source</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['Dashboard/Cards', 'Card, StatCard', 'src/components/dashboard/Card.tsx'],
            ['Dashboard/CopyableValue', 'CopyableValue', 'src/components/dashboard/CopyableValue.tsx'],
            ['Dashboard/Utilities', 'PriceTicker, Faucet, RealTimeLedger, ExplorerEmbed', 'src/components/dashboard/'],
            ['Layout/Navigation', 'Sidebar, MobileHeader, SearchBar', 'src/components/layout/'],
            ['Layout/ThemeToggle', 'ThemeToggle', 'src/components/layout/ThemeToggle.tsx'],
            ['Layout/NetworkIndicator', 'NetworkIndicator', 'src/components/layout/NetworkIndicator.jsx'],
            ['Layout/OfflineBanner', 'OfflineBanner', 'src/components/layout/OfflineBanner.tsx'],
            ['Layout/ResponsiveContainer', 'ResponsiveContainer, ResponsiveGrid, ResponsiveFlex', 'src/components/layout/ResponsiveContainer.tsx'],
            ['Mobile/BottomSheet', 'BottomSheet', 'src/components/mobile/BottomSheet.tsx'],
            ['Forms/ValidatedInput', 'ValidatedInput', 'src/components/validation/ValidatedInput.tsx'],
            ['Assets', 'AssetCard, AssetDiscovery', 'src/components/assets/'],
            ['Charts', 'NetworkMetricsChart, BalanceHistoryChart, AccountActivityChart', 'src/components/charts/'],
            ['Notifications & Errors', 'NetworkError, RetryButton, NotificationItem', 'src/components/errors/ · notifications/'],
            ['Accessibility', 'AccessibilitySettings, ScreenReaderAnnouncer, KeyboardNavigation', 'src/components/accessibility/'],
            ['Design System/Tokens', 'Colors, Spacing, Typography, Radii, Motion, Variants', 'src/design-system/'],
            ['Design System/Performance', 'Bundle budgets, render targets, patterns', '—'],
            ['Design System/Migration', 'Breaking changes, migration guides, version history', 'docs/api/CHANGELOG.md'],
          ].map(([group, components, source]) => (
            <tr key={group} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--cyan)', whiteSpace: 'nowrap' }}>{group}</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{components}</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{source}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Storybook Features</h2>
      <ul style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
        <li>🌗 <strong>Theme toolbar</strong> — switch Dark / Light on every story</li>
        <li>📱 <strong>Viewport toolbar</strong> — Mobile (375px / 390px), Tablet (768px), Desktop (1280px)</li>
        <li>♿ <strong>Accessibility panel</strong> — axe-core checks run automatically on every story</li>
        <li>📖 <strong>Design System stories</strong> — token catalog, variant system, accessibility guidelines, performance budgets, and migration guide all live in Storybook</li>
      </ul>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Quick Reference</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
        {[
          { label: 'Run Storybook', code: 'npm run storybook' },
          { label: 'Build Storybook', code: 'npm run build-storybook' },
          { label: 'Type check', code: 'npm run type-check' },
          { label: 'Lint', code: 'npm run lint' },
        ].map(({ label, code }) => (
          <div key={label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
            <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)', fontSize: 11 }}>{code}</code>
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: { layout: 'padded' },
};
