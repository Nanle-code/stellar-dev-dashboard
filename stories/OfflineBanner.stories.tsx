import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import OfflineBanner from '../src/components/layout/OfflineBanner';

const meta: Meta<typeof OfflineBanner> = {
  title: 'Layout/OfflineBanner',
  component: OfflineBanner,
  parameters: {
    docs: {
      description: {
        component:
          'Fixed banner shown when the browser goes offline. Displays queued operation count and dismisses when back online.',
      },
    },
    layout: 'fullscreen',
  },
};
export default meta;
type Story = StoryObj<typeof OfflineBanner>;

// The banner only renders when navigator.onLine is false, so we render it inside a mock container
const OfflineBannerDemo = () => {
  // Simulate offline state by overriding the subscription hooks via wrapping
  return (
    <div style={{ position: 'relative', minHeight: '200px', background: 'var(--bg-base)' }}>
      <p style={{ color: 'var(--text-muted)', padding: '16px', fontSize: '13px' }}>
        OfflineBanner is a <strong>fixed-position</strong> component that auto-shows when{' '}
        <code>navigator.onLine === false</code>. Toggle your browser's offline mode in DevTools
        to see it live.
      </p>
      {/* Render a static preview matching the banner's visual */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'static',
          background: 'rgba(30,35,39,0.95)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
          maxWidth: '420px',
          margin: '16px',
        }}
      >
        <div style={{ background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '12px', color: '#ef4444' }}>📵</div>
        <div style={{ flex: 1 }}>
          <h4 style={{ color: '#fff', fontWeight: 700, fontSize: '14px', margin: 0 }}>Offline Mode Active</h4>
          <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px', lineHeight: 1.5 }}>
            Showing cached data. Modifications will be queued and replayed automatically.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: '8px', padding: '6px 10px', width: 'fit-content' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              3 Operations Pending
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Preview: Story = {
  render: () => <OfflineBannerDemo />,
  parameters: {
    docs: { description: { story: 'Static preview of the OfflineBanner layout. Toggle browser offline mode to see it live.' } },
  },
};

export const MobilePreview: Story = {
  render: () => <OfflineBannerDemo />,
  parameters: {
    viewport: { defaultViewport: 'mobile375' },
    docs: { description: { story: 'Banner at mobile viewport — spans full width.' } },
  },
};
