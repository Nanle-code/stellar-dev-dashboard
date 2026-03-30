import React, { useEffect } from "react";
import { I18nProvider } from "./components/I18nProvider";
import "./i18n/index.js";

import Sidebar from "./components/layout/Sidebar";
import ConnectPanel from "./components/dashboard/ConnectPanel";
import Overview from "./components/dashboard/Overview";
import Account from "./components/dashboard/Account";
import Transactions from "./components/dashboard/Transactions";
import Contracts from "./components/dashboard/Contracts";
import NetworkStats from "./components/dashboard/NetworkStats";
import Faucet from "./components/dashboard/Faucet";
import Builder from "./components/dashboard/Builder";
import Compare from "./components/dashboard/Compare";
import WalletConnect from "./components/dashboard/WalletConnect";
import TransactionSigner from "./components/dashboard/TransactionSigner";
import PriceTicker from "./components/dashboard/PriceTicker";
import PortfolioValue from "./components/dashboard/PortfolioValue";
import NetworkMetricsChart from "./components/charts/NetworkMetricsChart";
import AccountActivityChart from "./components/charts/AccountActivityChart";
import BalanceHistoryChart from "./components/charts/BalanceHistoryChart";
import TransactionBuilder from "./components/dashboard/TransactionBuilder";
import ContractInteraction from "./components/dashboard/ContractInteraction";
import ContractABI from "./components/dashboard/ContractABI";
import DEXExplorer from "./components/dashboard/DEXExplorer";
import ExplorerEmbed from "./components/dashboard/ExplorerEmbed";
import RealTimeLedger from "./components/dashboard/RealTimeLedger";
import { useStore } from "./lib/store";
import { useTranslation } from "./hooks/useTranslation";

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
};

function DashboardLayout() {
  const { connectedAddress, activeTab, theme } = useStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const ActiveComponent = TABS[activeTab] || Overview;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        position: "relative",
        zIndex: 1,
      }}
    >
      <Sidebar />
      <main
        style={{
          marginLeft: "220px",
          flex: 1,
          padding: "32px 36px",
          maxWidth: "1100px",
          width: "100%",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <PriceTicker />
        </div>
        {!connectedAddress ? <ConnectPanel /> : <ActiveComponent />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <DashboardLayout />
    </I18nProvider>
  );
}