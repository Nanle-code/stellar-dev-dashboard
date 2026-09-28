import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import NetworkError from '../src/components/errors/NetworkError';
import RetryButton from '../src/components/errors/RetryButton';
import NotificationItem from '../src/components/notifications/NotificationItem';
import ScreenReaderAnnouncer from '../src/components/accessibility/ScreenReaderAnnouncer';

// ─── NetworkError ────────────────────────────────────────────────────────────

export const NetworkErrorDefault: StoryObj = {
  render: () => (
    <NetworkError
      message="Unable to connect to the Stellar network. Check your internet connection."
      onRetry={() => {}}
    />
  ),
};

export const NetworkErrorRetrying: StoryObj = {
  render: () => (
    <NetworkError
      message="Attempting to reconnect to Horizon…"
      onRetry={() => {}}
      retrying
    />
  ),
};

export const NetworkErrorNoRetry: StoryObj = {
  render: () => <NetworkError message="Horizon is temporarily unavailable." />,
};

export const NetworkErrorMobile: StoryObj = {
  render: () => (
    <NetworkError message="Connection lost." onRetry={() => {}} />
  ),
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};

// ─── RetryButton ─────────────────────────────────────────────────────────────

export const RetryButtonDefault: StoryObj = {
  render: () => <RetryButton onRetry={() => Promise.resolve()} />,
};

export const RetryButtonCustomLabel: StoryObj = {
  render: () => <RetryButton onRetry={() => Promise.resolve()} label="Reconnect" maxRetries={5} />,
};

export const RetryButtonExhausted: StoryObj = {
  render: () => {
    const [count, setCount] = React.useState(3);
    return (
      <RetryButton
        onRetry={() => {
          setCount((c) => c - 1);
          return Promise.reject(new Error('fail'));
        }}
        maxRetries={0}
      />
    );
  },
};

// ─── NotificationItem ─────────────────────────────────────────────────────────

const mockNotification = (type: string, title: string, message?: string) => ({
  id: `notif-${type}`,
  type,
  title,
  message,
  timeout: 0,
});

export const NotificationSuccess: StoryObj = {
  render: () => (
    <NotificationItem
      notification={mockNotification('success', 'Transaction Confirmed', 'Your payment of 100 XLM was successful.')}
      onClose={() => {}}
    />
  ),
};

export const NotificationError: StoryObj = {
  render: () => (
    <NotificationItem
      notification={mockNotification('error', 'Transaction Failed', 'Insufficient XLM balance to cover fees.')}
      onClose={() => {}}
    />
  ),
};

export const NotificationWarning: StoryObj = {
  render: () => (
    <NotificationItem
      notification={mockNotification('warning', 'High Network Fees', 'Base fee is currently 200 stroops.')}
      onClose={() => {}}
    />
  ),
};

export const NotificationInfo: StoryObj = {
  render: () => (
    <NotificationItem
      notification={mockNotification('info', 'New Ledger', 'Ledger #50123456 closed.')}
      onClose={() => {}}
    />
  ),
};

export const NotificationAllTypes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px' }}>
      {[
        { type: 'success', title: 'Transaction Confirmed', message: '100 XLM sent.' },
        { type: 'error', title: 'Transaction Failed', message: 'Insufficient balance.' },
        { type: 'warning', title: 'High Fees', message: 'Base fee is 200 stroops.' },
        { type: 'info', title: 'Ledger Closed', message: 'Ledger #50123456 closed.' },
        { type: 'price_alert', title: 'Price Alert', message: 'XLM is up 5% in 24h.' },
        { type: 'account_change', title: 'Account Updated', message: 'Balance changed.' },
      ].map((n) => (
        <NotificationItem
          key={n.type}
          notification={{ ...n, id: n.type, timeout: 0 }}
          onClose={() => {}}
        />
      ))}
    </div>
  ),
};

export const NotificationMobile: StoryObj = {
  render: () => (
    <NotificationItem
      notification={mockNotification('success', 'Sent', '50 XLM transferred.')}
      onClose={() => {}}
    />
  ),
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};

// ─── ScreenReaderAnnouncer ────────────────────────────────────────────────────

export const ScreenReaderAnnouncerDemo: StoryObj = {
  render: () => {
    const { announceToScreenReader } = require('../src/utils/accessibility');
    return (
      <div>
        <ScreenReaderAnnouncer />
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          ScreenReaderAnnouncer renders an invisible <code>aria-live</code> region.
          Click the button to push a message to screen readers.
        </p>
        <button
          style={{
            padding: '8px 16px',
            background: 'var(--cyan)',
            color: 'var(--bg-base)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
          }}
          onClick={() => announceToScreenReader('Account loaded successfully.')}
        >
          Announce to screen readers
        </button>
      </div>
    );
  },
};

// Meta export (required by Storybook for the first export to be default)
const meta: Meta = {
  title: 'Notifications & Errors',
  parameters: {
    docs: {
      description: {
        component: 'Error display, retry, notification, and screen-reader announcement components.',
      },
    },
  },
};
export default meta;
