import React, { lazy, Suspense, useEffect, useState, useCallback, type CSSProperties } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { matchRoute, buildPath, getDocumentTitle, type TabComponent } from './routes';
import { getRouteComponent } from './routeComponents';
import NotFound from './NotFound';
import Sidebar from '../components/layout/Sidebar';
import MobileHeader from '../components/layout/MobileHeader';
import MobileSidebar from '../components/layout/MobileSidebar';
import ConnectPanel from '../components/dashboard/ConnectPanel';
import PriceTicker from '../components/dashboard/PriceTicker';
import RealTimeNotificationCenter from '../components/notifications/RealTimeNotificationCenter';
import { useRealTimeNotifications } from '../hooks/useRealTimeNotifications';
import { initCache } from '../lib/cacheInit';
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
import SkipLink from '../components/accessibility/SkipLink';
import FocusManager from '../components/accessibility/FocusManager';
import ThemeToggle from '../components/layout/ThemeToggle';
import OfflineBanner from '../components/layout/OfflineBanner';
import PWAInstallBanner from '../components/PWAInstallBanner';
import SWUpdatePrompt from '../components/SWUpdatePrompt';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import DevToolbar from '../components/dashboard/DevToolbar';
import DebugAssistantButton from '../components/debug/DebugAssistantButton';
import DebugAssistantPanel from '../components/debug/DebugAssistantPanel';
import ConversationPanel from '../components/conversation/ConversationPanel';
import { useRouteFocus } from '../hooks/useRouteFocus';
import { useStorageQuotaAlerts } from '../hooks/useStorageQuotaAlerts';
import { useExpertise } from '../context/ExpertiseContext';
import { useExpertiseTracking } from '../hooks/useExpertiseTracking';
import ExpertiseBadge from '../components/expertise/ExpertiseBadge';
import PredictiveFeatureSuggestions from '../components/dashboard/PredictiveFeatureSuggestions';
import TipButton from '../components/ai/TipButton';
import { useWalletSessionListeners } from '../hooks/useWalletSessionListeners';
import {
  DEMO_MODE_LABEL,
  DEMO_MODE_BADGE,
  getDemoFixtureSummarySafe,
} from '../lib/demoMode';

interface SearchResult {
  type?: string;
}

const TransactionDetail = lazy(() => import('../components/dashboard/TransactionDetail'));

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
    setConnectedAddress,
    setContractId,
    setSelectedTxHash,
    preferencesOpen,
    setPreferencesOpen,
    debugAssistantOpen,
    debugAssistantIssueCount,
    toggleDebugAssistant,
    isDemoMode,
    exitDemoMode,
  } = useStore() as any;
  const { isMobile, isTablet } = useResponsive();
  const { level, isNovice, setLevel, updateSignals } = useExpertise();
  const { trackFeatureInteraction } = useExpertiseTracking({ enabled: true });
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [conversationOpen, setConversationOpen] = useState<boolean>(false);
  const preferencesTriggerRef = React.useRef<HTMLButtonElement>(null);

  // ── URL ↔ view synchronisation (driven by the route registry, #959) ────────
  const location = useLocation();
  const routeMatch = React.useMemo(() => matchRoute(location.pathname), [location.pathname]);
  const activeRoute = routeMatch?.route ?? null;
  const isConnectRoute = location.pathname === '/connect';
  const lastSyncedPath = React.useRef<string | null>(null);

  // URL → store: sync the active tab and any entity path param when the URL changes.
  useEffect(() => {
    if (!routeMatch) {
      lastSyncedPath.current = location.pathname;
      return;
    }
    if (lastSyncedPath.current === location.pathname) return;
    lastSyncedPath.current = location.pathname;

    if (routeMatch.route.id !== useStore.getState().activeTab) {
      setActiveTab(routeMatch.route.id);
    }

    const param = routeMatch.route.param;
    const raw = param ? routeMatch.params[param.name] : undefined;
    if (param?.store && raw) {
      const state = useStore.getState() as any;
      if (param.store === 'connectedAddress' && raw !== state.connectedAddress) {
        setConnectedAddress(raw);
      } else if (param.store === 'contractId' && raw !== state.contractId) {
        setContractId(raw);
      } else if (param.store === 'selectedTxHash' && raw !== state.selectedTxHash) {
        setSelectedTxHash(raw);
      }
    }
  }, [routeMatch, location.pathname, setActiveTab, setConnectedAddress, setContractId, setSelectedTxHash]);

  // Store → URL: direct `setActiveTab` calls elsewhere still update the address bar.
  useEffect(() => {
    if (!routeMatch) return;
    const current = useStore.getState().activeTab;
    if (routeMatch.route.id !== current) {
      navigate(buildPath(current), { replace: true });
    }
  }, [activeTab, routeMatch, navigate]);

  // Connection gating based on the resolved route rather than the raw pathname.
  useEffect(() => {
    const address = useStore.getState().connectedAddress;
    const addressParam =
      routeMatch?.route.param?.store === 'connectedAddress'
        ? routeMatch.params[routeMatch.route.param.name]
        : undefined;

    if (!address && !isConnectRoute && !addressParam) {
      navigate('/connect', { replace: true });
    } else if (address && isConnectRoute) {
      const target = routeMatch?.route.id ?? useStore.getState().activeTab;
      navigate(buildPath(target), { replace: true });
    }
  }, [routeMatch, isConnectRoute, navigate, connectedAddress]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = getDocumentTitle(activeRoute);
  }, [activeRoute]);

  useRouteFocus(activeTab);
  useStorageQuotaAlerts();
  useWalletSessionListeners();

  useEffect(() => {
    // v2: full multi-layer cache initialization (warm, prune, SW bridge)
    initCache(useStore.getState().network, useStore.getState().connectedAddress ?? undefined).catch(
      () => {}
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-expertise', level);
  }, [level]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      updateSignals((current: any) => ({
        sessionDurationMinutes: current.sessionDurationMinutes + 1,
      }));
    }, 60000);

    return () => window.clearInterval(timer);
  }, [updateSignals]);

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
      if (e.key === 'Escape') {
        if (isMobileMenuOpen) {
          setMobileMenuOpen(false);
          addBreadcrumb('Mobile menu closed via escape key', 'user_action');
        }
        if (preferencesOpen) {
          setPreferencesOpen(false);
          preferencesTriggerRef.current?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, setMobileMenuOpen, preferencesOpen, setPreferencesOpen]);

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

  const ActiveComponent: TabComponent | null = activeRoute
    ? getRouteComponent(activeRoute.id)
    : null;
  const txHash = activeRoute?.id === 'transactions' ? routeMatch?.params.hash : undefined;
  const isNotFound = Boolean(connectedAddress) && !routeMatch && !isConnectRoute;

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
      <SkipLink />
      <OfflineBanner routeId={routeMatch?.route.id ?? activeTab} />
      <PWAInstallBanner />
      <SWUpdatePrompt />
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
        <main
          id="main-content"
          tabIndex={-1}
          aria-label="Dashboard content"
          style={getMainStyles()}
          ref={isMobile ? swipeAreaRef : null}
        >
          <KeyboardNavigation />
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <GlobalSearch onSelectResult={handleSearchResult} />
            </div>
            <ThemeToggle />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <NetworkIndicator />
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <ExpertiseBadge
                onLevelChange={() => {
                  trackFeatureInteraction('expertise-badge');
                }}
              />
            </div>
            <button
              ref={preferencesTriggerRef}
              type="button"
              onClick={() => {
                setPreferencesOpen(true);
                trackFeatureInteraction('preferences');
              }}
              aria-label="Open user preferences"
              aria-haspopup="dialog"
              aria-expanded={preferencesOpen}
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
          {isDemoMode && (
            <div
              data-testid="demo-mode-banner"
              role="status"
              aria-label={`${DEMO_MODE_LABEL}: read-only testnet portfolio`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                marginBottom: '16px',
                padding: '10px 14px',
                background: 'var(--amber-glow)',
                border: '1px solid var(--amber)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--text-primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    border: '1px solid var(--amber)',
                    color: 'var(--amber)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '1px',
                    fontWeight: 700,
                  }}
                >
                  {DEMO_MODE_BADGE}
                </span>
                <strong>{DEMO_MODE_LABEL}</strong>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {demoSummary
                    ? `${demoSummary.accountCount} testnet accounts, ${demoSummary.contractCount} contracts. No wallet connected.`
                    : 'Read-only testnet portfolio. No wallet connected.'}
                </span>
              </div>
              <button
                type="button"
                data-testid="exit-demo-button"
                onClick={() => {
                  exitDemoMode();
                  addBreadcrumb('Exited demo mode', 'user_action');
                  navigate('/connect', { replace: true });
                }}
                style={{
                  padding: '7px 14px',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-bright)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Exit demo
              </button>
            </div>
          )}
          <ErrorBoundary onRetry={handleRetry} maxRetries={2}>
            {!connectedAddress ? (
              <ConnectPanel />
            ) : isConnectRoute ? null : isNotFound ? (
              <NotFound />
            ) : txHash ? (
              <Suspense fallback={<TabLoadingFallback />}>
                <TransactionDetail txHash={txHash} onClose={() => navigate('/transactions')} />
              </Suspense>
            ) : ActiveComponent ? (
              <Suspense fallback={<TabLoadingFallback />}>
                <ActiveComponent />
              </Suspense>
            ) : (
              <NotFound />
            )}
          </ErrorBoundary>
        </main>
        <TourLauncher />
        <DevToolbar />
        <PredictiveFeatureSuggestions onNavigate={(tab: string) => navigate(`/${tab}`)} />
        <NotificationBell
          onClick={() => setNotificationsOpen(true)}
          bottomOffset={isMobile ? 'calc(60px + 16px)' : '20px'}
        />
        <RealTimeNotificationCenter
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
        />
        <DebugAssistantButton
          onClick={() => toggleDebugAssistant()}
          isOpen={debugAssistantOpen}
          issueCount={debugAssistantIssueCount}
        />
        {debugAssistantOpen && <DebugAssistantPanel onClose={() => toggleDebugAssistant()} />}

        {/* Conversational Navigation Button */}
        <button
          type="button"
          onClick={() => setConversationOpen(!conversationOpen)}
          aria-label={conversationOpen ? 'Close navigation assistant' : 'Open navigation assistant'}
          style={{
            position: 'fixed',
            right: '20px',
            bottom: isMobile ? 'calc(60px + 78px)' : '78px',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: `2px solid ${conversationOpen ? 'var(--cyan)' : 'var(--border)'}`,
            background: conversationOpen ? 'var(--cyan-glow)' : 'var(--bg-card)',
            color: conversationOpen ? 'var(--cyan)' : 'var(--text-primary)',
            cursor: 'pointer',
            boxShadow: conversationOpen
              ? '0 0 20px var(--cyan-glow)'
              : '0 6px 18px rgba(0, 0, 0, 0.25)',
            zIndex: 1061,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            transition: 'all 180ms ease',
          }}
          onMouseEnter={(e) => {
            if (!conversationOpen) {
              e.currentTarget.style.borderColor = 'var(--cyan-dim)';
              e.currentTarget.style.boxShadow = '0 0 12px var(--cyan-glow)';
            }
          }}
          onMouseLeave={(e) => {
            if (!conversationOpen) {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.25)';
            }
          }}
        >
          <span aria-hidden="true">{conversationOpen ? '✕' : '💬'}</span>
        </button>

        <ConversationPanel isOpen={conversationOpen} onClose={() => setConversationOpen(false)} />

        {isMobile && <MobileNavigation />}
        <TipButton />
        {preferencesOpen && (
          <div
            role="presentation"
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
              if (e.target === e.currentTarget) {
                setPreferencesOpen(false);
                preferencesTriggerRef.current?.focus();
              }
            }}
          >
            <FocusManager
              trapFocus
              restoreFocusOnUnmount
              returnFocusElement={preferencesTriggerRef.current}
            >
              <div role="dialog" aria-modal="true" aria-label="User preferences">
                <UserPreferences
                  onClose={() => {
                    setPreferencesOpen(false);
                    preferencesTriggerRef.current?.focus();
                  }}
                />
              </div>
            </FocusManager>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
