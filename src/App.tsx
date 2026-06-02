import React, { useEffect, useState, type ComponentType, type CSSProperties } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { I18nProvider } from './components/I18nProvider'
import './i18n/index.js'
import './styles/responsive.css';
import { AccessibilityProvider } from './context/AccessibilityContext';

import Sidebar from './components/layout/Sidebar'
import MobileHeader from './components/layout/MobileHeader'
import MobileSidebar from './components/layout/MobileSidebar'
import ConnectPanel from './components/dashboard/ConnectPanel'
import Overview from './components/dashboard/Overview'
import Account from './components/dashboard/Account'
import Transactions from './components/dashboard/Transactions'
import Contracts from './components/dashboard/Contracts'
import NetworkStats from './components/dashboard/NetworkStats'
import Faucet from './components/dashboard/Faucet'
import Builder from './components/dashboard/Builder'
import Compare from './components/dashboard/AccountComparison'
import WalletConnect from './components/dashboard/WalletConnect'
import TransactionSigner from './components/dashboard/TransactionSigner'
import PriceTicker from './components/dashboard/PriceTicker'
import PortfolioValue from './components/dashboard/PortfolioValue'
import NetworkMetricsChart from './components/charts/NetworkMetricsChart'
import AccountActivityChart from './components/charts/AccountActivityChart'
import BalanceHistoryChart from './components/charts/BalanceHistoryChart'
import AdvancedChartSuite from './components/charts/AdvancedChartSuite'
import TransactionBuilder from './components/dashboard/TransactionBuilder'
import ContractInteraction from './components/dashboard/ContractInteraction'
import ContractABI from './components/dashboard/ContractABI'
import AdvancedTransactionSimulation from './components/dashboard/AdvancedTransactionSimulation'
import TransactionSimulator from './components/dashboard/TransactionSimulator'
import DEXExplorer from './components/dashboard/DEXExplorer'
import PathExplorer from './components/dashboard/PathExplorer'
import ExplorerEmbed from './components/dashboard/ExplorerEmbed'
import RealTimeLedger from './components/dashboard/RealTimeLedger'
import Analytics from './components/dashboard/Analytics'
import SystemHealth from './components/dashboard/SystemHealth'
import PerformanceMonitor from './components/dashboard/PerformanceMonitor'
import Settings from './components/dashboard/Settings'
import { AssetDiscovery } from './components/assets'
import { MultisigManager } from './components/multisig'
import AuditLog from './components/dashboard/AuditLog'
import { AnchorIntegration } from './components/anchors'
import AdvancedSearch from './components/dashboard/AdvancedSearch'
import CacheStats from './components/dashboard/CacheStats'
import LiveActivityFeed from './components/dashboard/LiveActivityFeed'
import ClaimableBalances from './components/dashboard/ClaimableBalances'
import DataExport from './components/dashboard/DataExport'
import RealTimeNotificationCenter from './components/notifications/RealTimeNotificationCenter'
import { useRealTimeNotifications } from './hooks/useRealTimeNotifications'
import { Webhooks } from './components/dashboard/Webhooks'
import { LearningHub } from './components/dashboard/LearningHub'
import { HardwareWalletSecurity } from './components/dashboard/HardwareWalletSecurity'
import { TemplateLibrary } from './components/dashboard/TemplateLibrary'
import { pruneCaches } from './lib/cacheManager'
import ErrorBoundary from './components/ErrorBoundary'
import { useStore } from './lib/store'
import { useTranslation } from './hooks/useTranslation'
import { useResponsive } from './hooks/useResponsive'
import { initializeErrorReporting, addBreadcrumb } from './lib/errorReporting'
import {
  installSecurityEventListeners,
  trackSecurityEvent,
  SecurityEventType,
} from './lib/securityEvents'
import { TourLauncher } from './components/tutorial'
import SearchBar from './components/layout/SearchBar'
import GlobalSearch from './components/search/GlobalSearch'
import UserPreferences from './components/preferences/UserPreferences'
import NetworkIndicator from './components/layout/NetworkIndicator'
import MobileNavigation from './components/layout/MobileNavigation'
import KeyboardNavigation from './components/accessibility/KeyboardNavigation'
import OfflineBanner from './components/layout/OfflineBanner'
import PWAInstallBanner from './components/PWAInstallBanner'

interface SearchResult {
  type?: string
}

const ChartsTab: ComponentType = () => {
  const { t } = useTranslation() as { t: (key: string) => string }
  return (
    <div
      className="animate-in"
      style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          fontWeight: 700,
        }}
      >
        {t('charts.title')}
      </div>
      <NetworkMetricsChart />
      <AccountActivityChart />
      <BalanceHistoryChart />
      <AdvancedChartSuite />
    </div>
  )
}

type TabComponent = ComponentType<Record<string, unknown>>

const TABS: Record<string, TabComponent> = {
  overview: Overview,
  account: Account,
  transactions: Transactions,
  contracts: Contracts,
  network: NetworkStats,
  builder: Builder,
  faucet: Faucet,
  compare: Compare,
  wallet: WalletConnect,
  signer: TransactionSigner,
  portfolio: PortfolioValue,
  txBuilder: TransactionBuilder,
  contractInteraction: ContractInteraction,
  contractABI: ContractABI,
  dex: DEXExplorer,
  pathExplorer: PathExplorer,
  explorers: ExplorerEmbed,
  realtime: RealTimeLedger,
  charts: ChartsTab,
  assets: AssetDiscovery,
  multisig: MultisigManager,
  analytics: Analytics,
  systemHealth: SystemHealth,
  performance: PerformanceMonitor,
  settings: Settings,
  audit: AuditLog,
  anchors: AnchorIntegration,
  search: AdvancedSearch,
  cacheStats: CacheStats,
  liveActivity: LiveActivityFeed,
  claimableBalances: ClaimableBalances,
  dataExport: DataExport,
}

function NotificationBell({ onClick }: { onClick: () => void }) {
  const { unreadCount } = useRealTimeNotifications()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        width: '44px',
        height: '44px',
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
  )
}

function DashboardLayout() {
  const navigate = useNavigate()
  const {
    connectedAddress,
    activeTab,
    theme,
    isMobileMenuOpen,
    setMobileMenuOpen,
    setActiveTab,
    preferencesOpen,
    setPreferencesOpen,
  } = useStore()
  const { isMobile, isTablet } = useResponsive()
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false)

  useEffect(() => {
    pruneCaches().catch(() => {})
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    initializeErrorReporting({
      enabled: true,
      maxErrorsPerSession: 100,
      batchSize: 5,
      flushInterval: 30000,
    })

    addBreadcrumb('Application initialized', 'info', { theme, isMobile })
    installSecurityEventListeners()
  }, [theme, isMobile])

  useEffect(() => {
    if (!isMobile && isMobileMenuOpen) {
      setMobileMenuOpen(false)
    }
  }, [isMobile, isMobileMenuOpen, setMobileMenuOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setMobileMenuOpen(false)
        addBreadcrumb('Mobile menu closed via escape key', 'user_action')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMobileMenuOpen, setMobileMenuOpen])

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  useEffect(() => {
    addBreadcrumb(`Navigated to ${activeTab} tab`, 'navigation', { activeTab })
    trackSecurityEvent(SecurityEventType.CONFIG_CHANGED, {
      target: 'activeTab',
      metadata: { activeTab },
    })
  }, [activeTab])

  const ActiveComponent: TabComponent = TABS[activeTab] || Overview

  const getMainStyles = (): CSSProperties => {
    const baseStyles: CSSProperties = {
      flex: 1,
      width: '100%',
      transition: 'margin-left var(--transition), padding var(--transition)',
    }

    if (isMobile) {
      return {
        ...baseStyles,
        marginLeft: 0,
        padding: 'var(--content-padding-mobile)',
        paddingTop: 'calc(var(--header-height) + var(--content-padding-mobile) + 16px)',
        maxWidth: '100%',
      }
    }

    if (isTablet) {
      return {
        ...baseStyles,
        marginLeft: 'var(--sidebar-width)',
        padding: 'var(--content-padding-tablet)',
        paddingTop: 'calc(var(--content-padding-tablet) + 16px)',
        maxWidth: '1100px',
      }
    }

    return {
      ...baseStyles,
      marginLeft: 'var(--sidebar-width)',
      padding: 'var(--content-padding)',
      paddingTop: 'calc(var(--content-padding) + 16px)',
      maxWidth: '1100px',
    }
  }

  const handleRetry = async (): Promise<void> => {
    addBreadcrumb('App-level retry attempted', 'user_action')
    window.location.reload()
  }

  const handleSearchResult = (result: SearchResult | null | undefined): void => {
    if (!result) return
    if (result.type === 'transaction' || result.type === 'operation') {
      navigate('/transactions')
      return
    }
    if (result.type === 'account') {
      navigate('/account')
      return
    }
    navigate('/overview')
  }

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
        <Sidebar isMobile={isMobile} />
        <main id="main-content" style={getMainStyles()} tabIndex={-1}>
          <KeyboardNavigation />
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <GlobalSearch onSelectResult={handleSearchResult} />
            </div>
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
            {!connectedAddress ? <ConnectPanel /> : <ActiveComponent />}
          </ErrorBoundary>
        </main>
        <TourLauncher />
        <NotificationBell onClick={() => setNotificationsOpen(true)} />
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
            onClick={(e) => { if (e.target === e.currentTarget) setPreferencesOpen(false) }}
          >
            <UserPreferences onClose={() => setPreferencesOpen(false)} />
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

function RouterSync() {
  const navigate = useNavigate()
  const location = useLocation()
  const { connectedAddress, activeTab, setActiveTab } = useStore()

  const pathTab = location.pathname === '/' ? 'overview' : location.pathname.slice(1)

  useEffect(() => {
    if (pathTab === 'connect') return
    if (TABS[pathTab] && pathTab !== activeTab) {
      setActiveTab(pathTab)
    }
  }, [location.pathname])

  useEffect(() => {
    if (!connectedAddress && pathTab !== 'connect') {
      navigate('/connect', { replace: true })
    } else if (connectedAddress && pathTab === 'connect') {
      navigate(`/${activeTab}`, { replace: true })
    }
  }, [connectedAddress, location.pathname])

  return null
}

export default function App() {
  return (
    <I18nProvider>
      <AccessibilityProvider>
      <RouterSync />
      <Routes>
        <Route path="/connect" element={<DashboardLayout />} />
        <Route path="/*" element={<DashboardLayout />} />
      </Routes>
    </AccessibilityProvider>
    </I18nProvider>
  )
}
