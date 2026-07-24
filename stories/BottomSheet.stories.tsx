import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import BottomSheet from '../src/components/mobile/BottomSheet';

const meta: Meta<typeof BottomSheet> = {
  title: 'Mobile/BottomSheet',
  component: BottomSheet,
  parameters: {
    docs: {
      description: {
        component:
          'Mobile-first sheet that slides up from the bottom. On desktop it renders as a centered modal. Supports swipe-down-to-close on touch devices and Escape key.',
      },
    },
    layout: 'fullscreen',
  },
};
export default meta;
type Story = StoryObj<typeof BottomSheet>;

const SheetDemo = ({ title, children }: { title?: string; children?: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <button
        style={{
          padding: '10px 20px',
          background: 'var(--cyan)',
          color: 'var(--bg-base)',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 700,
        }}
        onClick={() => setOpen(true)}
      >
        Open BottomSheet
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        {children || (
          <div style={{ padding: '8px 0' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '16px' }}>
              This is the BottomSheet content area. On mobile it slides up from the bottom; on
              desktop it appears as a centered modal.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Swipe down to dismiss (mobile), press Escape, or click the backdrop.
            </p>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};

export const Default: Story = {
  render: () => <SheetDemo title="Account Details" />,
};

export const NoTitle: Story = {
  render: () => <SheetDemo />,
  parameters: {
    docs: { description: { story: 'BottomSheet without a header title.' } },
  },
};

export const WithForm: Story = {
  render: () => (
    <SheetDemo title="Send Payment">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Destination Address
          <input
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
            placeholder="G..."
          />
        </label>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Amount (XLM)
          <input
            type="number"
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px' }}
            placeholder="0.00"
          />
        </label>
        <button style={{ padding: '10px', background: 'var(--cyan)', color: 'var(--bg-base)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
          Send
        </button>
      </div>
    </SheetDemo>
  ),
};

export const MobileViewport: Story = {
  render: () => <SheetDemo title="Transaction Details" />,
  parameters: {
    viewport: { defaultViewport: 'mobile390' },
    docs: { description: { story: 'BottomSheet at iPhone 14 viewport — slides from bottom.' } },
  },
};

export const TabletViewport: Story = {
  render: () => <SheetDemo title="Transaction Details" />,
  parameters: {
    viewport: { defaultViewport: 'tablet768' },
    docs: { description: { story: 'At tablet width, BottomSheet renders as a centered modal overlay.' } },
  },
};
