import React, { useEffect } from 'react'
import Sidebar from './components/layout/Sidebar'
import ConnectPanel from './components/dashboard/ConnectPanel'
import Overview from './components/dashboard/Overview'
import Account from './components/dashboard/Account'
import Transactions from './components/dashboard/Transactions'
import Contracts from './components/dashboard/Contracts'
import NetworkStats from './components/dashboard/NetworkStats'
import Faucet from './components/dashboard/Faucet'
import Builder from './components/dashboard/Builder'
import Compare from './components/dashboard/Compare'
import WalletConnect from './components/dashboard/WalletConnect'
import TransactionSigner from './components/dashboard/TransactionSigner'
import PriceTicker from './components/dashboard/PriceTicker'
import PortfolioValue from './components/dashboard/PortfolioValue'
import NetworkMetricsChart from './components/charts/NetworkMetricsChart'
import AccountActivityChart from './components/charts/AccountActivityChart'
import BalanceHistoryChart from './components/charts/BalanceHistoryChart'
import { useStore } from './lib/store'

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
  charts: () => (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Charts & Analytics</div>
      <NetworkMetricsChart />
      <AccountActivityChart />
      <BalanceHistoryChart />
    </div>
  ),
}

export default function App() {
  const { connectedAddress, activeTab, theme } = useStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const ActiveComponent = TABS[activeTab] || Overview

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Sidebar />
      <main style={{
        marginLeft: '220px',
        flex: 1,
        padding: '32px 36px',
        maxWidth: '1100px',
        width: '100%',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <PriceTicker />
        </div>
        {!connectedAddress ? (
          <ConnectPanel />
        ) : (
          <ActiveComponent />
        )}
      </main>
    </div>
  )
}
