import React from 'react';
import { useStore } from '../../../lib/store';
import WidgetBase from './WidgetBase';
import { useResponsive } from '../../../hooks/useResponsive';

export interface BaseWidgetProps {
  onRefresh?: () => void;
}

export default function QuickActionsWidget({ onRefresh }: BaseWidgetProps) {
  const { setActiveTab } = useStore();
  const { isMobile } = useResponsive() as { isMobile: boolean };

  const actions = [
    {
      label: 'Send Payment',
      icon: '💸',
      color: 'var(--cyan)',
      action: () => setActiveTab('builder'),
      description: 'Create a payment transaction'
    },
    {
      label: 'Create Trustline',
      icon: '🔗',
      color: 'var(--green)',
      action: () => setActiveTab('builder'),
      description: 'Trust a new asset'
    },
    {
      label: 'View Assets',
      icon: '💎',
      color: 'var(--amber)',
      action: () => setActiveTab('assets'),
      description: 'Discover and manage assets'
    },
    {
      label: 'DEX Trading',
      icon: '📈',
      color: 'var(--text-secondary)',
      action: () => setActiveTab('dex'),
      description: 'Trade on the DEX'
    }
  ];

  return (
    <WidgetBase
      title="Quick Actions"
      subtitle="Common tasks"
      icon="⚡"
      onRefresh={onRefresh}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: '12px',
        height: '100%'
      }}>
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.action}
            style={{
              padding: '16px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'var(--transition)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.borderColor = action.color;
              e.currentTarget.style.background = `${action.color}10`;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ fontSize: '24px' }}>
              {action.icon}
            </div>

            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '2px'
            }}>
              {action.label}
            </div>

            <div style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              lineHeight: 1.3
            }}>
              {action.description}
            </div>
          </button>
        ))}
      </div>
    </WidgetBase>
  );
}