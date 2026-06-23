import React, { useState } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { addBreadcrumb } from '../../lib/errorReporting';

// Import all available widgets
import BalanceWidget from './widgets/BalanceWidget';
import AssetsWidget from './widgets/AssetsWidget';
import TransactionsWidget from './widgets/TransactionsWidget';
import NetworkStatsWidget from './widgets/NetworkStatsWidget';
import AccountStatsWidget from './widgets/AccountStatsWidget';
import QuickActionsWidget from './widgets/QuickActionsWidget';
import PriceTickerWidget from './widgets/PriceTickerWidget';
import LedgerStatsWidget from '../dashboard/LedgerStatsWidget';

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  component: React.ComponentType<any>;
  defaultSize: { width: number; height: number };
  category: string;
}

export interface WidgetInstance {
  id: string;
  type: string;
  component: React.ReactNode;
  width: number;
  height: number;
  span: number;
}

export interface WidgetSelectorProps {
  onAddWidget: (widget: WidgetInstance) => void;
  existingWidgets?: WidgetInstance[];
  isOpen: boolean;
  onClose: () => void;
}

// Widget definitions
export const AVAILABLE_WIDGETS: Record<string, WidgetDefinition> = {
  balance: {
    id: 'balance',
    name: 'XLM Balance',
    description: 'Display your XLM balance and USD estimate',
    icon: '💰',
    component: BalanceWidget,
    defaultSize: { width: 300, height: 250 },
    category: 'account'
  },
  assets: {
    id: 'assets',
    name: 'Asset Holdings',
    description: 'Show your non-native asset balances',
    icon: '💎',
    component: AssetsWidget,
    defaultSize: { width: 350, height: 300 },
    category: 'account'
  },
  transactions: {
    id: 'transactions',
    name: 'Recent Transactions',
    description: 'Display your latest transactions',
    icon: '⇄',
    component: TransactionsWidget,
    defaultSize: { width: 400, height: 350 },
    category: 'activity'
  },
  networkStats: {
    id: 'networkStats',
    name: 'Network Stats',
    description: 'Show current network statistics',
    icon: '🌐',
    component: NetworkStatsWidget,
    defaultSize: { width: 300, height: 280 },
    category: 'network'
  },
  accountStats: {
    id: 'accountStats',
    name: 'Account Stats',
    description: 'Display account details and security info',
    icon: '👤',
    component: AccountStatsWidget,
    defaultSize: { width: 320, height: 400 },
    category: 'account'
  },
  quickActions: {
    id: 'quickActions',
    name: 'Quick Actions',
    description: 'Common tasks and shortcuts',
    icon: '⚡',
    component: QuickActionsWidget,
    defaultSize: { width: 300, height: 280 },
    category: 'tools'
  },
  priceTicker: {
    id: 'priceTicker',
    name: 'Price Ticker',
    description: 'Live XLM price and market data',
    icon: '💹',
    component: PriceTickerWidget,
    defaultSize: { width: 280, height: 250 },
    category: 'market'
  },
  ledgerStats: {
    id: 'ledgerStats',
    name: 'Ledger Statistics',
    description: 'Real-time ledger stats: base fee trend, operations, failed tx %',
    icon: '📡',
    component: LedgerStatsWidget,
    defaultSize: { width: 360, height: 320 },
    category: 'network'
  }
};

export const WIDGET_CATEGORIES: Record<string, { name: string; icon: string; color: string }> = {
  account: { name: 'Account', icon: '👤', color: 'var(--cyan)' },
  activity: { name: 'Activity', icon: '⚡', color: 'var(--green)' },
  network: { name: 'Network', icon: '🌐', color: 'var(--amber)' },
  market: { name: 'Market', icon: '💹', color: 'var(--text-secondary)' },
  tools: { name: 'Tools', icon: '🔧', color: 'var(--text-secondary)' }
};

export default function WidgetSelector({ onAddWidget, existingWidgets = [], isOpen, onClose }: WidgetSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('account');
  const { isMobile } = useResponsive() as { isMobile: boolean };

  if (!isOpen) return null;

  const handleAddWidget = (widgetType: string) => {
    const widget = AVAILABLE_WIDGETS[widgetType];
    if (!widget) return;

    const newWidget: WidgetInstance = {
      id: `${widgetType}-${Date.now()}`,
      type: widgetType,
      component: React.createElement(widget.component, { 
        key: `${widgetType}-${Date.now()}`,
        onRefresh: () => {} 
      }),
      width: widget.defaultSize.width,
      height: widget.defaultSize.height,
      span: 1
    };

    onAddWidget(newWidget);
    onClose();
    
    addBreadcrumb('Widget added to dashboard', 'user_action', { 
      widgetType,
      widgetName: widget.name 
    });
  };

  const isWidgetAdded = (widgetType: string) => {
    return existingWidgets.some(w => w.type === widgetType);
  };

  const getWidgetsByCategory = (category: string) => {
    return Object.values(AVAILABLE_WIDGETS).filter(w => w.category === category);
  };

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? '20px' : '40px'
  };

  const modalStyles: React.CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: isMobile ? '100%' : '600px',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  };

  const headerStyles: React.CSSProperties = {
    padding: isMobile ? '16px 20px' : '20px 24px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  };

  const contentStyles: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: isMobile ? '16px 20px' : '20px 24px'
  };

  return (
    <div style={overlayStyles} onClick={onClose}>
      <div style={modalStyles} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyles}>
          <div>
            <h2 style={{
              fontSize: isMobile ? '18px' : '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '4px',
              fontFamily: 'var(--font-display)'
            }}>
              Add Widget
            </h2>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              margin: 0
            }}>
              Choose a widget to add to your dashboard
            </p>
          </div>
          
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              transition: 'var(--transition)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'none';
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={contentStyles}>
          {/* Category Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            overflowX: 'auto',
            paddingBottom: '8px'
          }}>
            {Object.entries(WIDGET_CATEGORIES).map(([key, category]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                style={{
                  padding: isMobile ? '8px 16px' : '6px 12px',
                  background: selectedCategory === key ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                  border: `1px solid ${selectedCategory === key ? 'var(--cyan)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  color: selectedCategory === key ? 'var(--cyan)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>

          {/* Widget Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px'
          }}>
            {getWidgetsByCategory(selectedCategory).map((widget) => {
              const isAdded = isWidgetAdded(widget.id);
              
              return (
                <div
                  key={widget.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    cursor: isAdded ? 'not-allowed' : 'pointer',
                    opacity: isAdded ? 0.6 : 1,
                    transition: 'var(--transition)'
                  }}
                  onClick={() => !isAdded && handleAddWidget(widget.id)}
                  onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                    if (!isAdded) {
                      e.currentTarget.style.borderColor = 'var(--cyan)';
                      e.currentTarget.style.boxShadow = '0 4px 12px var(--cyan-glow-sm)';
                    }
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                    if (!isAdded) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ fontSize: '24px' }}>
                      {widget.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: 0,
                        marginBottom: '2px'
                      }}>
                        {widget.name}
                      </h3>
                      <p style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        margin: 0,
                        lineHeight: 1.4
                      }}>
                        {widget.description}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {widget.defaultSize.width}×{widget.defaultSize.height}px
                    </div>
                    
                    {isAdded ? (
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--green)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        ✓ Added
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--cyan)',
                        fontWeight: 600
                      }}>
                        Click to add
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}