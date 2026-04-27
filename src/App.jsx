import React, { useEffect, useState } from "react";
import { I18nProvider } from "./components/I18nProvider";
import "./i18n/index.js";

import Sidebar from "./components/layout/Sidebar";
import MobileHeader from "./components/layout/MobileHeader";
import ConnectPanel from "./components/dashboard/ConnectPanel";
import Overview from "./components/dashboard/Overview";
import Account from "./components/dashboard/Account";
import Transactions from "./components/dashboard/Transactions";
import Contracts from "./components/dashboard/Contracts";
import NetworkStats from "./components/dashboard/NetworkStats";
import Faucet from "./components/dashboard/Faucet";
import Builder from "./components/dashboard/Builder";
import Compare from "./components/dashboard/AccountComparison";
import WalletConnect from "./components/dashboard/WalletConnect";
import TransactionSigner from "./components/dashboard/TransactionSigner";
import PriceTicker from "./components/dashboard/PriceTicker";
import PortfolioValue from "./components/dashboard/PortfolioValue";
import NetworkMetricsChart from "./components/charts/NetworkMetricsChart";
import AccountActivityChart from "./components/charts/AccountActivityChart";
import BalanceHistoryChart from "./components/charts/BalanceHistoryChart";
import AdvancedChartSuite from "./components/charts/AdvancedChartSuite";
import TransactionBuilder from "./components/dashboard/TransactionBuilder";
import ContractInteraction from "./components/dashboard/ContractInteraction";
import ContractABI from "./components/dashboard/ContractABI";
import DEXExplorer from "./components/dashboard/DEXExplorer";
import ExplorerEmbed from "./components/dashboard/ExplorerEmbed";
import RealTimeLedger from "./components/dashboard/RealTimeLedger";
import { AssetDiscovery } from "./components/assets";
import { MultisigManager } from "./components/multisig";
import AuditLog from "./components/dashboard/AuditLog";
import ErrorBoundary from "./components/ErrorBoundary";
import { useStore } from "./lib/store";
import { useTranslation } from "./hooks/useTranslation";
import { useResponsive } from "./hooks/useResponsive";
import { initializeErrorReporting, addBreadcrumb } from "./lib/errorReporting";
import { installSecurityEventListeners, trackSecurityEvent, SecurityEventType } from "./lib/securityEvents";
import { TourLauncher } from "./components/tutorial";

const ChartsTab = () => {
  const { t } = useTranslation();
  return (
    <div
      className="animate-in"
      style={{ display: "flex", flexDirection: "column", gap: "24px" }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 700,
        }}
      >
        {t("charts.title")}
      </div>
      <NetworkMetricsChart />
      <AccountActivityChart />
      <BalanceHistoryChart />
      <AdvancedChartSuite />
    </div>
  );
};

const TABS = {
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
  explorers: ExplorerEmbed,
  realtime: RealTimeLedger,
  charts: ChartsTab,
  assets: AssetDiscovery,
  multisig: MultisigManager,
  audit: AuditLog,
};

function DashboardLayout() {
  const { connectedAddress, activeTab, theme, isMobileMenuOpen, setMobileMenuOpen } = useStore();
  const { windowWidth, isMobile, isTablet } = useResponsive();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Initialize error reporting system
  useEffect(() => {
    initializeErrorReporting({
      enabled: true,
      maxErrorsPerSession: 100,
      batchSize: 5,
      flushInterval: 30000,
      // endpoint: 'https://your-error-reporting-endpoint.com/api/errors' // Set this in production
    });

    addBreadcrumb('Application initialized', 'info', { theme, isMobile });
    installSecurityEventListeners();
  }, [theme, isMobile]);

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    if (!isMobile && isMobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isMobile, isMobileMenuOpen, setMobileMenuOpen]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setMobileMenuOpen(false);
        addBreadcrumb('Mobile menu closed via escape key', 'user_action');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, setMobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
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

  // Track tab changes
  useEffect(() => {
    addBreadcrumb(`Navigated to ${activeTab} tab`, 'navigation', { activeTab });
    trackSecurityEvent(SecurityEventType.CONFIG_CHANGED, {
      target: 'activeTab',
      metadata: { activeTab },
    });
  }, [activeTab]);

  const ActiveComponent = TABS[activeTab] || Overview;

  // Responsive main styles based on screen size
  const getMainStyles = () => {
    const baseStyles = {
      flex: 1,
      width: "100%",
      transition: "margin-left var(--transition), padding var(--transition)",
    };

    if (isMobile) {
      return {
        ...baseStyles,
        marginLeft: 0,
        padding: "var(--content-padding-mobile)",
        paddingTop: "calc(var(--header-height) + var(--content-padding-mobile) + 16px)",
        maxWidth: "100%",
      };
    }

    if (isTablet) {
      return {
        ...baseStyles,
        marginLeft: "var(--sidebar-width)",
        padding: "var(--content-padding-tablet)",
        paddingTop: "calc(var(--content-padding-tablet) + 16px)",
        maxWidth: "1100px",
      };
    }

    return {
      ...baseStyles,
      marginLeft: "var(--sidebar-width)",
      padding: "var(--content-padding)",
      paddingTop: "calc(var(--content-padding) + 16px)",
      maxWidth: "1100px",
    };
  };

  const handleRetry = async () => {
    // Retry logic for the entire app - could reload or reset state
    addBreadcrumb('App-level retry attempted', 'user_action');
    window.location.reload();
  };

  return (
    <ErrorBoundary onRetry={handleRetry} maxRetries={3}>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
        }}
      >
        {isMobile && <MobileHeader />}
        <Sidebar isMobile={isMobile} />
        <main style={getMainStyles()}>
          <div style={{ marginBottom: "16px" }}>
            <PriceTicker />
          </div>
          <ErrorBoundary onRetry={handleRetry} maxRetries={2}>
            {!connectedAddress ? <ConnectPanel /> : <ActiveComponent />}
          </ErrorBoundary>
        </main>
        <TourLauncher />
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <DashboardLayout />
    </I18nProvider>
  );
}
