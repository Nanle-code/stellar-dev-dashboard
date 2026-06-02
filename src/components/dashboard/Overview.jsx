import React, { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { shortAddress } from '../../lib/stellar';
import CopyableValue from './CopyableValue';
import DashboardGrid from '../layout/DashboardGrid';
import WidgetSelector from '../layout/WidgetSelector';
import { useResponsive } from '../../hooks/useResponsive';
import { addBreadcrumb } from '../../lib/errorReporting';

// Import async layout management hooks from userPreferences
import { getDashboardLayout, saveDashboardLayout } from '../../lib/userPreferences';

// Import widget components
import BalanceWidget from '../layout/widgets/BalanceWidget';
import AssetsWidget from '../layout/widgets/AssetsWidget';
import TransactionsWidget from '../layout/widgets/TransactionsWidget';
import NetworkStatsWidget from '../layout/widgets/NetworkStatsWidget';
import AccountStatsWidget from '../layout/widgets/AccountStatsWidget';
import QuickActionsWidget from '../layout/widgets/QuickActionsWidget';
import PriceTickerWidget from '../layout/widgets/PriceTickerWidget';

// Get widget component class/function by string identifier
const getWidgetComponent = (type) => {
  const components = {
    balance: BalanceWidget,
    assets: AssetsWidget,
    transactions: TransactionsWidget,
    networkStats: NetworkStatsWidget,
    accountStats: AccountStatsWidget,
    quickActions: QuickActionsWidget,
    priceTicker: PriceTickerWidget
  };
  return components[type] || BalanceWidget;
};

// Default widget configuration layout fallbacks
const DEFAULT_WIDGETS = [
  {
    id: 'balance-default',
    type: 'balance',
    height: 260,
    span: 1
  },
  {
    id: 'assets-default',
    type: 'assets',
    height: 320,
    span: 1
  },
  {
    id: 'transactions-default',
    type: 'transactions',
    height: 360,
    span: 2
  },
  {
    id: 'networkStats-default',
    type: 'networkStats',
    height: 300,
    span: 1
  }
];

export default function Overview() {
  const { connectedAddress, network } = useStore();
  const { isMobile, isTablet, windowWidth } = useResponsive();
  
  const [widgets, setWidgets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);

  // 1. Load layout preferences asynchronously on component mount
  useEffect(() => {
    async function hydrateDashboardLayout() {
      try {
        const savedLayout = await getDashboardLayout();
        const activeLayoutRules = (savedLayout && savedLayout.length > 0) ? savedLayout : DEFAULT_WIDGETS;
        
        // Dynamically append non-serializable React elements using type descriptors
        const hydratedWidgets = activeLayoutRules.map(widget => ({
          ...widget,
          component: React.createElement(getWidgetComponent(widget.type), {
            key: `${widget.id}-${Date.now()}`,
            onRefresh: () => refreshWidgets()
          })
        }));
        
        setWidgets(hydratedWidgets);
      } catch (error) {
        console.error("Failed to restore overview widget layout:", error);
        // Fallback to default layout state if an error is thrown
        const fallbackWidgets = DEFAULT_WIDGETS.map(widget => ({
          ...widget,
          component: React.createElement(getWidgetComponent(widget.type), {
            key: `${widget.id}-fallback`,
            onRefresh: () => refreshWidgets()
          })
        }));
        setWidgets(fallbackWidgets);
      } finally {
        setIsLoading(false);
      }
    }
    hydrateDashboardLayout();
  }, []);

  // Helper utility to clean non-serializable component properties before writing to store
  const persistAndSyncLayout = async (updatedWidgets) => {
    setWidgets(updatedWidgets);
    
    const serializedLayout = updatedWidgets.map((w, index) => ({
      id: w.id,
      type: w.type,
      height: w.height,
      span: Math.max(1, Number(w.span) || 1),
      order: index
    }));
    
    await saveDashboardLayout(serializedLayout);
  };

  // Refresh active widget components in-place when layout or data states update
  const refreshWidgets = () => {
    setWidgets(prevWidgets => 
      prevWidgets.map(widget => ({
        ...widget,
        component: React.createElement(getWidgetComponent(widget.type), { 
          key: `${widget.id}-${Date.now()}`,
          onRefresh: () => refreshWidgets()
        })
      }))
    );
    addBreadcrumb('Dashboard widgets refreshed', 'user_action');
  };

  // Handle arrangement layout sequence shifts
  const handleLayoutChange = (newLayout) => {
    persistAndSyncLayout(newLayout);
    addBreadcrumb('Dashboard layout changed', 'user_action', { 
      widgetCount: newLayout.length 
    });
  };

  // Handle widget resizing dimensions modification
  const handleWidgetResize = (widget, newSize) => {
    const updatedWidgets = widgets.map(w => 
      w.id === widget.id ? { ...w, ...newSize } : w
    );
    persistAndSyncLayout(updatedWidgets);
    addBreadcrumb('Widget resized', 'user_action', { 
      widgetId: widget.id,
      newSize 
    });
  };

  // Handle structural widget node deletions
  const handleWidgetRemove = (widget) => {
    const updatedWidgets = widgets.filter(w => w.id !== widget.id);
    persistAndSyncLayout(updatedWidgets);
    addBreadcrumb('Widget removed', 'user_action', { 
      widgetId: widget.id,
      widgetType: widget.type 
    });
  };

  // Handle adding a new element container node
  const handleAddWidget = (newWidget) => {
    const freshWidgetWithElement = {
      ...newWidget,
      component: React.createElement(getWidgetComponent(newWidget.type), {
        key: `${newWidget.id}-${Date.now()}`,
        onRefresh: () => refreshWidgets()
      })
    };
    const updatedWidgets = [...widgets, freshWidgetWithElement];
    persistAndSyncLayout(updatedWidgets);
    addBreadcrumb('Widget added', 'user_action', { 
      widgetId: newWidget.id,
      widgetType: newWidget.type 
    });
  };

  // Reset to static fallback architecture layout
  const handleResetLayout = () => {
    const factoryResetWidgets = DEFAULT_WIDGETS.map(widget => ({
      ...widget,
      component: React.createElement(getWidgetComponent(widget.type), {
        key: `${widget.id}-${Date.now()}`,
        onRefresh: () => refreshWidgets()
      })
    }));
    persistAndSyncLayout(factoryResetWidgets);
    setIsEditing(false);
    addBreadcrumb('Dashboard layout reset to default', 'user_action');
  };

  // Toggle layout modification context views
  const toggleEditMode = () => {
    setIsEditing(!isEditing);
    addBreadcrumb(`Dashboard edit mode ${!isEditing ? 'enabled' : 'disabled'}`, 'user_action');
  };

  const getColumns = () => {
    if (isMobile) return { mobile: 1, tablet: 1, desktop: 1 };
    if (isTablet) return { mobile: 1, tablet: 2, desktop: 2 };
    return { mobile: 1, tablet: 2, desktop: windowWidth >= 1440 ? 4 : 3 };
  };

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        Loading layout choices from user profile...
      </div>
    );
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        justifyContent: 'space-between',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '16px' : '0'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontFamily: 'var(--font-display)', 
            fontSize: isMobile ? '20px' : '22px', 
            fontWeight: 700,
            marginBottom: '4px'
          }}>
            Dashboard Overview
          </div>
          <CopyableValue
            value={connectedAddress}
            title="Copy connected public key"
            containerStyle={{ 
              fontSize: '12px', 
              color: 'var(--text-muted)', 
              fontFamily: 'var(--font-mono)' 
            }}
            textStyle={{ 
              maxWidth: isMobile ? '200px' : '260px', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap' 
            }}
          >
            {shortAddress(connectedAddress, 8)}
          </CopyableValue>
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          {/* Network Badge */}
          <div style={{
            padding: '6px 12px',
            background: network === 'testnet' ? 'var(--amber-glow)' : 'var(--green-glow)',
            border: `1px solid ${network === 'testnet' ? 'var(--amber)' : 'var(--green)'}`,
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            color: network === 'testnet' ? 'var(--amber)' : 'var(--green)',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            {network}
          </div>

          {/* Dashboard Controls */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {isEditing && (
              <button
                onClick={() => setShowWidgetSelector(true)}
                style={{
                  padding: '8px 12px',
                  background: 'var(--cyan)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Add widget"
              >
                <span>+</span>
                {!isMobile && 'Add Widget'}
              </button>
            )}

            {isEditing && (
              <button
                onClick={handleResetLayout}
                style={{
                  padding: '8px 12px',
                  background: 'var(--amber)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
                title="Reset to default layout"
              >
                {isMobile ? '↺' : 'Reset'}
              </button>
            )}

            <button
              onClick={toggleEditMode}
              style={{
                padding: '8px 12px',
                background: isEditing ? 'var(--green)' : 'var(--bg-elevated)',
                color: isEditing ? 'white' : 'var(--text-primary)',
                border: `1px solid ${isEditing ? 'var(--green)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title={isEditing ? 'Save layout' : 'Edit dashboard'}
            >
              <span>{isEditing ? '✓' : '✏️'}</span>
              {!isMobile && (isEditing ? 'Done' : 'Edit')}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Mode Notice */}
      {isEditing && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--cyan-glow-sm)',
          border: '1px solid var(--cyan)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>✏️</span>
          <span>
            <strong>Edit Mode:</strong> Drag widgets to rearrange, resize using handles, or remove with the × button.
          </span>
        </div>
      )}

      {/* Dashboard Grid */}
      <DashboardGrid
        widgets={widgets}
        onLayoutChange={handleLayoutChange}
        onWidgetResize={handleWidgetResize}
        onWidgetRemove={handleWidgetRemove}
        editable={isEditing}
        columns={getColumns()}
        gap={isMobile ? 12 : 16}
        minWidgetHeight={200}
      />

      {/* Widget Selector Modal */}
      <WidgetSelector
        isOpen={showWidgetSelector}
        onClose={() => setShowWidgetSelector(false)}
        onAddWidget={handleAddWidget}
        existingWidgets={widgets}
      />
    </div>
  );
}
