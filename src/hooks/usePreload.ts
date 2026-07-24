/**
 * usePreload — prefetch a lazy-loaded tab chunk when the user hovers over its nav link.
 *
 * Usage:
 *   const { preload } = usePreload()
 *   <button onMouseEnter={() => preload('overview')} />
 */

const TAB_LOADERS: Record<string, () => Promise<unknown>> = {
  overview: () => import('../components/dashboard/Overview'),
  account: () => import('../components/dashboard/Account'),
  transactions: () => import('../components/dashboard/Transactions'),
  contracts: () => import('../components/dashboard/Contracts'),
  network: () => import('../components/dashboard/NetworkStats'),
  builder: () => import('../components/dashboard/Builder'),
  faucet: () => import('../components/dashboard/Faucet'),
  compare: () => import('../components/dashboard/AccountComparison'),
  wallet: () => import('../components/dashboard/WalletConnect'),
  signer: () => import('../components/dashboard/TransactionSigner'),
  portfolio: () => import('../components/dashboard/PortfolioValue'),
  txBuilder: () => import('../components/dashboard/TransactionBuilder'),
  contractInteraction: () => import('../components/dashboard/ContractInteraction'),
  contractABI: () => import('../components/dashboard/ContractABI'),
  dex: () => import('../components/dashboard/DEXExplorer'),
  pathExplorer: () => import('../components/dashboard/PathExplorer'),
  explorers: () => import('../components/dashboard/ExplorerEmbed'),
  realtime: () => import('../components/dashboard/RealTimeLedger'),
  charts: () => import('../components/dashboard/ChartsTab'),
  assets: () => import('../components/assets'),
  multisig: () => import('../components/multisig'),
  analytics: () => import('../components/dashboard/Analytics'),
  systemHealth: () => import('../components/dashboard/SystemHealth'),
  performance: () => import('../components/dashboard/PerformanceMonitor'),
  settings: () => import('../components/dashboard/Settings'),
  audit: () => import('../components/dashboard/AuditLog'),
  anchors: () => import('../components/anchors'),
  search: () => import('../components/dashboard/AdvancedSearch'),
  cacheStats: () => import('../components/dashboard/CacheStats'),
  liveActivity: () => import('../components/dashboard/LiveActivityFeed'),
  claimableBalances: () => import('../components/dashboard/ClaimableBalances'),
  dataExport: () => import('../components/dashboard/DataExport'),
}

const preloaded = new Set<string>()

/** Trigger the dynamic import for a tab so the browser fetches the chunk early. */
export function preloadTab(tab: string): void {
  if (preloaded.has(tab)) return
  const loader = TAB_LOADERS[tab]
  if (!loader) return
  preloaded.add(tab)
  loader().catch(() => {
    // Non-fatal — chunk will still load when the user navigates
    preloaded.delete(tab)
  })
}

/** Hook that returns a stable `preload` callback for use in event handlers. */
export function usePreload() {
  return { preload: preloadTab }
}
