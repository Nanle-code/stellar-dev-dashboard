import React, {
  lazy,
  Suspense,
  useEffect,
  useState,
  useCallback,
  type ComponentType,
  type CSSProperties,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import MobileHeader from '../components/layout/MobileHeader';
import MobileSidebar from '../components/layout/MobileSidebar';
import ConnectPanel from '../components/dashboard/ConnectPanel';
import PriceTicker from '../components/dashboard/PriceTicker';
import RealTimeNotificationCenter from '../components/notifications/RealTimeNotificationCenter';
import { useRealTimeNotifications } from '../hooks/useRealTimeNotifications';
import { initCache, handleNetworkSwitch } from '../lib/cacheInit';
import ErrorBoundary from '../components/ErrorBoundary';
import { useStore } from '../lib/store';
import { useResponsive } from '../hooks/useResponsive';
import { initializeErrorReporting, addBreadcrumb } from '../lib/errorReporting';
import {
  installSecurityEventListeners,
  trackSecurityEvent,
  SecurityEventType,
} from '../lib/securityEvents';
import { TourLauncher } from '../components/tutorial';
import GlobalSearch from '../components/search/GlobalSearch';
import UserPreferences from '../components/preferences/UserPreferences';
import NetworkIndicator from '../components/layout/NetworkIndicator';
import MobileNavigation from '../components/layout/MobileNavigation';
import KeyboardNavigation from '../components/accessibility/KeyboardNavigation';
import ThemeToggle from '../components/layout/ThemeToggle';
import OfflineBanner from '../components/layout/OfflineBanner';
import PWAInstallBanner from '../components/PWAInstallBanner';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import DevToolbar from '../components/dashboard/DevToolbar';

interface SearchResult {
  type?: string;
}

type TabComponent = ComponentType<Record<string, unknown>>;

const lazyTab = (loader: () => Promise<{ default: TabComponent }>) =>
  lazy(loader) as unknown as TabComponent;

const lazyNamedTab = (loader: () => Promise<Record<string, unknown>>, exportName: string) =>
  lazy(() =>
    loader().then((module) => ({
      default: module[exportName] as TabComponent,
    }))
  ) as unknown as TabComponent;

const Overview = lazyTab(() => import('../components/dashboard/Overview'));

const TABS: Record<string, TabComponent> = {
  overview: Overview,
  account: lazyTab(() => import('../components/dashboard/Account')),
  transactions: lazyTab(() => import('../components/dashboard/Transactions')),
  contracts: lazyTab(() => import('../components/dashboard/Contracts')),
  network: lazyTab(() => import('../components/dashboard/NetworkStats')),
  builder: lazyTab(() => import('../components/dashboard/Builder')),
  faucet: lazyTab(() => import('../components/dashboard/Faucet')),
  compare: lazyTab(() => import('../components/dashboard/AccountComparison')),
  wallet: lazyTab(() => import('../components/dashboard/WalletConnect')),
  signer: lazyTab(() => import('../components/dashboard/TransactionSigner')),
  portfolio: lazyTab(() => import('../components/dashboard/PortfolioValue')),
  txBuilder: lazyTab(() => import('../components/dashboard/TransactionBuilder')),
  contractInteraction: lazyTab(() => import('../components/dashboard/ContractInteraction')),
  contractABI: lazyTab(() => import('../components/dashboard/ContractABI')),
  dex: lazyTab(() => import('../components/dashboard/DEXExplorer')),
  pathExplorer: lazyTab(() => import('../components/dashboard/PathExplorer')),
  explorers: lazyTab(() => import('../components/dashboard/ExplorerEmbed')),
  realtime: lazyTab(() => import('../components/dashboard/RealTimeLedger')),
  charts: lazyTab(() => import('../components/dashboard/ChartsTab')),
  assets: lazyNamedTab(() => import('../components/assets'), 'AssetDiscovery'),
  multisig: lazyNamedTab(() => import('../components/multisig'), 'MultisigManager'),
  analytics: lazyTab(() => import('../components/dashboard/Analytics')),
  designSystem: lazyTab(() => import('../components/dashboard/DesignSystem')),
  featureFlags: lazyTab(() => import('../components/dashboard/FeatureFlags')),
  systemHealth: lazyTab(() => import('../components/dashboard/SystemHealth')),
  performance: lazyTab(() => import('../components/dashboard/PerformanceMonitor')),
  settings: lazyTab(() => import('../components/dashboard/Settings')),
  collaboration: lazyTab(() => import('../components/dashboard/CollaborationTab')),
  audit: lazyTab(() => import('../components/dashboard/AuditLog')),
  anchors: lazyNamedTab(() => import('../components/anchors'), 'AnchorIntegration'),
  search: lazyTab(() => import('../components/dashboard/AdvancedSearch')),
  cacheStats: lazyTab(() => import('../components/dashboard/CacheStats')),
  liveActivity: lazyTab(() => import('../components/dashboard/LiveActivityFeed')),
  claimableBalances: lazyTab(() => import('../components/dashboard/ClaimableBalances')),
  dataExport: lazyTab(() => import('../components/dashboard/DataExport')),
  governance: lazyTab(() => import('../components/dashboard/Governance')),
  monitoringDashboards: lazyTab(() => import('../components/dashboard/MonitoringDashboards')),
  devToolbar: lazyTab(() => import('../components/dashboard/DevToolbar')),
  compliance: lazyTab(() => import('../components/dashboard/ComplianceDashboard')),
  security: lazyTab(() => import('../components/dashboard/SecurityDashboard')),
};

function TabLoadingFallback() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      style={{
        minHeight: '420px',
        display: 'grid',
        gap: '16px',
        gridTemplateRows: '32px 120px 1fr',
      }}
    >
      <div
        style={{
          width: '180px',
          height: '24px',
          borderRadius: '6px',
          background: 'var(--bg-elevated)',
        }}
      />
      <div style={{ borderRadius: 'var(--radius-lg)', background: 'var(--bg-elevated)' }} />
      <div
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
        }}
      />
    </div>
  );
}

function RouterSync() {
  const navigate = useNavigate();
  const location = useLocation();
  const { connectedAddress, activeTab, setActiveTab } = useStore();

  const pathTab = location.pathname === '/' ? 'overview' : location.pathname.slice(1);

  useEffect(() => {
    if (pathTab === 'connect') return;
    if (TABS[pathTab] && pathTab !== activeTab) {
      setActiveTab(pathTab);
    }
  }, [pathTab, activeTab, setActiveTab]);

  useEffect(() => {
    if (!connectedAddress && pathTab !== 'connect') {
      navigate('/connect', { replace: true });
    } else if (connectedAddress && pathTab === 'connect') {
      navigate(`/${activeTab}`, { replace: true });
    }
  }, [connectedAddress, pathTab, activeTab, navigate]);

  return null;
}

function NotificationBell({
  onClick,
  bottomOffset = '20px',
}: {
  onClick: () => void;
  bottomOffset?: string;
}) {
  const { unreadCount } = useRealTimeNotifications();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      style={{
        position: 'fixed',
        right: '20px',
        bottom: bottomOffset,
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
      }}
    >
      <span aria-hidden="true">🔔</span>
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: 'var(--cyan, #06b6d4)',
            color: '#0a0a0a',
            borderRadius: '999px',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            minWidth: '18px',
            textAlign: 'center',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const {
    connectedAddress,
    activeTab,
    theme,
    isMobileMenuOpen,
    setMobileMenuOpen,
    setActiveTab,
    preferencesOpen,
    setPreferencesOpen,
  } = useStore();
  const { isMobile, isTablet } = useResponsive();
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);

  useEffect(() => {
    // v2: full multi-layer cache initialization (warm, prune, SW bridge)
    initCache(
      useStore.getState().network,
      useStore.getState().connectedAddress ?? undefined,
    ).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    initializeErrorReporting({
      enabled: true,
      maxErrorsPerSession: 100,
      batchSize: 5,
      flushInterval: 30000,
    });

    addBreadcrumb('Application initialized', 'info', { theme, isMobile });
    installSecurityEventListeners();
  }, [theme, isMobile]);

  useEffect(() => {
    if (!isMobile && isMobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isMobile, isMobileMenuOpen, setMobileMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setMobileMenuOpen(false);
        addBreadcrumb('Mobile menu closed via escape key', 'user_action');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, setMobileMenuOpen]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    addBreadcrumb(`Mapsd to ${activeTab} tab`, 'navigation', { activeTab });
    trackSecurityEvent(SecurityEventType.CONFIG_CHANGED, {
      target: 'activeTab',
      metadata: { activeTab },
    });
  }, [activeTab]);

  const ActiveComponent: TabComponent = TABS[activeTab] || Overview;

  const getMainStyles = (): CSSProperties => {
    const baseStyles: CSSProperties = {
      flex: 1,
      width: '100%',
      transition: 'margin-left var(--transition), padding var(--transition)',
    };

    if (isMobile) {
      return {
        ...baseStyles,
        marginLeft: 0,
        padding: 'var(--content-padding-mobile)',
        paddingTop: 'calc(var(--header-height) + var(--content-padding-mobile) + 16px)',
        maxWidth: '100%',
      };
    }

    if (isTablet) {
      return {
        ...baseStyles,
        marginLeft: 'var(--sidebar-width)',
        padding: 'var(--content-padding-tablet)',
        paddingTop: 'calc(var(--content-padding-tablet) + 16px)',
        maxWidth: '1100px',
      };
    }

    return {
      ...baseStyles,
      marginLeft: 'var(--sidebar-width)',
      padding: 'var(--content-padding)',
      paddingTop: 'calc(var(--content-padding) + 16px)',
      maxWidth: '1100px',
    };
  };

  const handleRetry = async (): Promise<void> => {
    addBreadcrumb('App-level retry attempted', 'user_action');
    window.location.reload();
  };

  const handleSearchResult = (result: SearchResult | null | undefined): void => {
    if (!result) return;
    if (result.type === 'transaction' || result.type === 'operation') {
      navigate('/transactions');
      return;
    }
    if (result.type === 'account') {
      navigate('/account');
      return;
    }
    navigate('/overview');
  };

  const swipeAreaRef = useSwipeGesture<HTMLElement>({
    onSwipeRight: useCallback(() => {
      if (isMobile && !isMobileMenuOpen) setMobileMenuOpen(true);
    }, [isMobile, isMobileMenuOpen, setMobileMenuOpen]),
    threshold: 40,
    restraint: 120,
  });

  return (
    <ErrorBoundary onRetry={handleRetry} maxRetries={3}>
      <OfflineBanner />
      <PWAInstallBanner />
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {isMobile && <MobileHeader />}
        {isMobile ? <MobileSidebar /> : <Sidebar />}
        <main style={getMainStyles()} ref={isMobile ? swipeAreaRef : null}>
          <KeyboardNavigation />
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <GlobalSearch onSelectResult={handleSearchResult} />
            </div>
            <ThemeToggle />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <NetworkIndicator />
            </div>
            <button
              onClick={() => setPreferencesOpen(true)}
              title="User Preferences"
              style={{
                width: '36px',
                height: '36px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0,
                transition: 'var(--transition)',
              }}
            >
              ⚙
            </button>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <PriceTicker />
          </div>
          <ErrorBoundary onRetry={handleRetry} maxRetries={2}>
            {!connectedAddress ? (
              <ConnectPanel />
            ) : (
              <Suspense fallback={<TabLoadingFallback />}>
                <ActiveComponent />
              </Suspense>
            )}
          </ErrorBoundary>
        </main>
        <TourLauncher />
        <DevToolbar />
        <NotificationBell
          onClick={() => setNotificationsOpen(true)}
          bottomOffset={isMobile ? 'calc(60px + 16px)' : '20px'}
        />
        <RealTimeNotificationCenter
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
        />
        {isMobile && <MobileNavigation />}
        {preferencesOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreferencesOpen(false);
            }}
          >
            <UserPreferences onClose={() => setPreferencesOpen(false)} />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
