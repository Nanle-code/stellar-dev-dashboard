import React from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { notificationManager } from '../../lib/notifications';

const NotificationDemo = () => {
  const { success, error, info, warning, clearAll } = useNotifications();

  return (
    <div
      className="animate-in"
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        Notification System Demo
      </div>

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Toast notifications
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <DemoButton
            label="Success"
            color="var(--green)"
            onClick={() =>
              success('Transaction confirmed', 'Hash: 7af3…c91b')
            }
          />
          <DemoButton
            label="Error"
            color="var(--red)"
            onClick={() =>
              error('Transaction failed', 'Insufficient balance for this operation')
            }
          />
          <DemoButton
            label="Warning"
            color="var(--amber)"
            onClick={() =>
              warning('Network congestion', 'Transactions may take longer than usual')
            }
          />
          <DemoButton
            label="Info"
            color="var(--cyan)"
            onClick={() =>
              info('Account synced', 'Balance updated to latest ledger')
            }
          />
        </div>

        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 600,
            marginTop: 8,
            marginBottom: 4,
          }}
        >
          Domain-specific events
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <DemoButton
            label="TX Confirmed"
            color="var(--green)"
            onClick={() =>
              notificationManager.txConfirmed(
                '7af3e2d1b0c9a8f7e6d5c4b3a2917af3e2d1b0c9',
              )
            }
          />
          <DemoButton
            label="TX Failed"
            color="var(--red)"
            onClick={() =>
              notificationManager.txFailed('Insufficient balance')
            }
          />
          <DemoButton
            label="Price Alert"
            color="var(--amber)"
            onClick={() =>
              notificationManager.priceAlert('XLM', 'up', 5.2)
            }
          />
          <DemoButton
            label="Network Event"
            color="var(--cyan)"
            onClick={() =>
              notificationManager.networkEvent(
                'Testnet validator set updated',
              )
            }
          />
        </div>

        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <DemoButton
            label="Clear all toasts"
            color="var(--text-muted)"
            onClick={clearAll}
          />
        </div>
      </div>
    </div>
  );
};

function DemoButton({ label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: `1px solid ${color}`,
        color,
        padding: '8px 16px',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        cursor: 'pointer',
        transition: 'all var(--transition)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = color;
        e.currentTarget.style.color = 'var(--bg-base)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = color;
      }}
    >
      {label}
    </button>
  );
}

export default NotificationDemo;
