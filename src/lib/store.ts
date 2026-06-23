import { create } from 'zustand'
import { getStoredValue } from './storage'
import { syncState, onStateChange } from '../utils/stateSync'
import type { NetworkName, NetworkStats } from './stellar'
import type { Horizon, SorobanRpc } from '@stellar/stellar-sdk'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchFilters {
  status: 'all' | 'success' | 'failed'
  memoOnly: boolean
  minFee: string
  maxFee: string
  type: string
  minAmount: string
  maxAmount: string
  startDate: string
  endDate: string
}

export interface ComparisonSlot {
  key: string
  data: Horizon.AccountResponse | null
  loading: boolean
  error: string | null
}

export interface Notification {
  id: string
  type: string
  title: string
  [key: string]: unknown
  read?: boolean
  timestamp?: number
}

export interface StreamLedger {
  sequence: number
  [key: string]: unknown
}

export interface LedgerStatsEntry {
  sequence: number
  closedAt: string
  baseFee: number
  operationCount: number
  txSuccessCount: number
  txFailedCount: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = 'stellar-dashboard-theme'
const SELECTED_NETWORK_KEY = 'stellar:selected-network'
const STORE_PERSIST_KEY = 'store:preferences'

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  status: 'all',
  memoOnly: false,
  minFee: '',
  maxFee: '',
  type: 'all',
  minAmount: '',
  maxAmount: '',
  startDate: '',
  endDate: '',
}

const PERSIST_KEYS = [
  'network', 'theme', 'activeTab', 'savedSearches', 'multiSigMode', 'searchFilters',
  'notificationHistory', 'unreadNotificationCount',
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'dark'
}

function readInitialNetwork(): NetworkName {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SELECTED_NETWORK_KEY)
      if (raw === 'mainnet' || raw === 'testnet' || raw === 'futurenet' || raw === 'local' || raw === 'custom') {
        return raw
      }
    }
  } catch { /* ignore */ }
  return 'testnet'
}

// ─── Store interface ──────────────────────────────────────────────────────────

export interface StoreState {
  network: NetworkName
  setNetwork: (network: NetworkName) => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  isMobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void

  connectedAddress: string | null
  accountData: Horizon.AccountResponse | null
  accountLoading: boolean
  accountError: string | null
  setConnectedAddress: (address: string | null) => void
  setAccountData: (data: Horizon.AccountResponse) => void
  setAccountLoading: (loading: boolean) => void
  setAccountError: (error: string | null) => void

  transactions: Horizon.ServerApi.TransactionRecord[]
  txLoading: boolean
  txNextCursor: string | null
  txHasMore: boolean
  txPagingLoading: boolean
  setTransactions: (txs: Horizon.ServerApi.TransactionRecord[]) => void
  appendTransactions: (txs: Horizon.ServerApi.TransactionRecord[]) => void
  setTxLoading: (v: boolean) => void
  setTxNextCursor: (cursor: string | null) => void
  setTxHasMore: (hasMore: boolean) => void
  setTxPagingLoading: (v: boolean) => void

  operations: Horizon.ServerApi.OperationRecord[]
  opsLoading: boolean
  opsNextCursor: string | null
  opsHasMore: boolean
  opsPagingLoading: boolean
  setOperations: (ops: Horizon.ServerApi.OperationRecord[]) => void
  appendOperations: (ops: Horizon.ServerApi.OperationRecord[]) => void
  setOpsLoading: (v: boolean) => void
  setOpsNextCursor: (cursor: string | null) => void
  setOpsHasMore: (hasMore: boolean) => void
  setOpsPagingLoading: (v: boolean) => void

  networkStats: NetworkStats | null
  statsLoading: boolean
  setNetworkStats: (stats: NetworkStats | ((prev: NetworkStats | null) => NetworkStats)) => void
  setStatsLoading: (v: boolean) => void

  activeTab: string
  setActiveTab: (tab: string) => void

  faucetLoading: boolean
  faucetResult: unknown
  setFaucetLoading: (v: boolean) => void
  setFaucetResult: (r: unknown) => void

  contractId: string
  contractData: SorobanRpc.Api.LedgerEntryResult | null
  contractLoading: boolean
  contractError: string | null
  setContractId: (id: string) => void
  setContractData: (data: SorobanRpc.Api.LedgerEntryResult) => void
  setContractLoading: (v: boolean) => void
  setContractError: (e: string | null) => void

  deploymentStatus: Record<string, unknown> | null
  setDeploymentStatus: (s: Record<string, unknown> | null) => void

  savedSearches: string[]
  setSavedSearches: (s: string[]) => void

  multiSigMode: boolean
  setMultiSigMode: (v: boolean) => void

  selectedTemplateId: string | null
  setSelectedTemplateId: (id: string | null) => void

  preferencesOpen: boolean
  setPreferencesOpen: (open: boolean) => void

  globalError: { message: string; category: string } | null
  setGlobalError: (err: { message: string; category: string } | null) => void

  prices: Record<string, { usd: number | null; usd_24h_change: number | null }>
  pricesLoading: boolean
  pricesError: string | null
  setPrices: (prices: Record<string, { usd: number | null; usd_24h_change: number | null }>) => void
  setPricesLoading: (loading: boolean) => void
  setPricesError: (error: string | null) => void

  searchFilters: SearchFilters
  setSearchFilters: (filters: Partial<SearchFilters>) => void

  comparisonSlots: ComparisonSlot[]
  addComparisonSlot: () => void
  removeComparisonSlot: (index: number) => void
  reorderComparisonSlots: (orderedSlots: ComparisonSlot[]) => void
  setComparisonKey: (index: number, key: string) => void
  setComparisonData: (index: number, data: Horizon.AccountResponse | null) => void
  setComparisonLoading: (index: number, loading: boolean) => void
  setComparisonError: (index: number, error: string | null) => void

  walletConnected: boolean
  walletType: string | null
  walletPublicKey: string | null
  setWalletConnected: (connected: boolean, type?: string | null, publicKey?: string | null) => void
  disconnectWallet: () => void

  notifications: Notification[]
  notificationHistory: Notification[]
  unreadNotificationCount: number
  addNotification: (notification: Notification) => void
  removeNotification: (id: string) => void
  addNotificationHistory: (notification: Notification) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotificationHistory: () => void

  // Streaming
  streamStatus: string
  streamLedgers: StreamLedger[]
  streamError: string | null
  setStreamStatus: (status: string) => void
  addStreamLedger: (ledger: StreamLedger) => void
  clearStreamLedgers: () => void
  setStreamError: (e: string | null) => void

  // Ledger stats widget (Issue #267)
  ledgerHistory: LedgerStatsEntry[]
  baseFeeHistory: number[]
  failedTxPercent: number
  showLedgerStatsWidget: boolean
  addLedgerStatsEntry: (entry: LedgerStatsEntry) => void
  toggleLedgerStatsWidget: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<StoreState>((set) => ({
  network: readInitialNetwork(),
  setNetwork: (network) => {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(SELECTED_NETWORK_KEY, network) } catch { /* ignore */ }
    set({
      network,
      accountData: null,
      transactions: [],
      operations: [],
      txNextCursor: null,
      txHasMore: false,
      txPagingLoading: false,
      opsNextCursor: null,
      opsHasMore: false,
      opsPagingLoading: false,
    })
  },

  theme: getInitialTheme(),
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light'
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', newTheme)
    return { theme: newTheme }
  }),

  isMobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),

  connectedAddress: null,
  accountData: null,
  accountLoading: false,
  accountError: null,
  setConnectedAddress: (address) => set({ connectedAddress: address }),
  setAccountData: (data) => set({ accountData: data, accountError: null }),
  setAccountLoading: (loading) => set({ accountLoading: loading }),
  setAccountError: (error) => set({ accountError: error }),

  transactions: [],
  txLoading: false,
  txNextCursor: null,
  txHasMore: false,
  txPagingLoading: false,
  setTransactions: (txs) => set({ transactions: txs }),
  appendTransactions: (txs) => set((state) => {
    const existing = new Set(state.transactions.map(tx => tx.id))
    return { transactions: [...state.transactions, ...txs.filter(tx => !existing.has(tx.id))] }
  }),
  setTxLoading: (v) => set({ txLoading: v }),
  setTxNextCursor: (cursor) => set({ txNextCursor: cursor }),
  setTxHasMore: (hasMore) => set({ txHasMore: hasMore }),
  setTxPagingLoading: (v) => set({ txPagingLoading: v }),

  operations: [],
  opsLoading: false,
  opsNextCursor: null,
  opsHasMore: false,
  opsPagingLoading: false,
  setOperations: (ops) => set({ operations: ops }),
  appendOperations: (ops) => set((state) => {
    const existing = new Set(state.operations.map(op => op.id))
    return { operations: [...state.operations, ...ops.filter(op => !existing.has(op.id))] }
  }),
  setOpsLoading: (v) => set({ opsLoading: v }),
  setOpsNextCursor: (cursor) => set({ opsNextCursor: cursor }),
  setOpsHasMore: (hasMore) => set({ opsHasMore: hasMore }),
  setOpsPagingLoading: (v) => set({ opsPagingLoading: v }),

  networkStats: null,
  statsLoading: false,
  setNetworkStats: (stats) => set((state) => ({
    networkStats: typeof stats === 'function' ? stats(state.networkStats) : stats,
    statsLoading: false,
  })),
  setStatsLoading: (v) => set({ statsLoading: v }),

  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),

  faucetLoading: false,
  faucetResult: null,
  setFaucetLoading: (v) => set({ faucetLoading: v }),
  setFaucetResult: (r) => set({ faucetResult: r }),

  contractId: '',
  contractData: null,
  contractLoading: false,
  contractError: null,
  setContractId: (id) => set({ contractId: id }),
  setContractData: (data) => set({ contractData: data, contractError: null }),
  setContractLoading: (v) => set({ contractLoading: v }),
  setContractError: (e) => set({ contractError: e }),

  deploymentStatus: null,
  setDeploymentStatus: (s) => set({ deploymentStatus: s }),

  savedSearches: [],
  setSavedSearches: (s) => set({ savedSearches: s }),

  multiSigMode: false,
  setMultiSigMode: (v) => set({ multiSigMode: v }),

  selectedTemplateId: null,
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),

  preferencesOpen: false,
  setPreferencesOpen: (open) => set({ preferencesOpen: open }),

  globalError: null,
  setGlobalError: (err) => set({ globalError: err }),

  prices: {},
  pricesLoading: false,
  pricesError: null,
  setPrices: (prices) => set({ prices, pricesError: null }),
  setPricesLoading: (loading) => set({ pricesLoading: loading }),
  setPricesError: (error) => set({ pricesError: error }),

  searchFilters: DEFAULT_SEARCH_FILTERS,
  setSearchFilters: (filters) => set((state) => ({ searchFilters: { ...state.searchFilters, ...filters } })),

  comparisonSlots: [],
  addComparisonSlot: () => set((state) => ({
    comparisonSlots: [...state.comparisonSlots, { key: '', data: null, loading: false, error: null }],
  })),
  removeComparisonSlot: (index) => set((state) => ({
    comparisonSlots: state.comparisonSlots.filter((_, i) => i !== index),
  })),
  reorderComparisonSlots: (orderedSlots) => set({ comparisonSlots: orderedSlots }),
  setComparisonKey: (index, key) => set((state) => {
    const next = [...state.comparisonSlots]
    if (next[index]) next[index].key = key
    return { comparisonSlots: next }
  }),
  setComparisonData: (index, data) => set((state) => {
    const next = [...state.comparisonSlots]
    if (next[index]) { next[index].data = data; next[index].error = null }
    return { comparisonSlots: next }
  }),
  setComparisonLoading: (index, loading) => set((state) => {
    const next = [...state.comparisonSlots]
    if (next[index]) next[index].loading = loading
    return { comparisonSlots: next }
  }),
  setComparisonError: (index, error) => set((state) => {
    const next = [...state.comparisonSlots]
    if (next[index]) next[index].error = error
    return { comparisonSlots: next }
  }),

  walletConnected: false,
  walletType: null,
  walletPublicKey: null,
  setWalletConnected: (connected, type = null, publicKey = null) =>
    set({ walletConnected: connected, walletType: type, walletPublicKey: publicKey }),
  disconnectWallet: () => set({ walletConnected: false, walletType: null, walletPublicKey: null }),

  notifications: [],
  notificationHistory: [],
  unreadNotificationCount: 0,
  addNotification: (notification) => set((state) => ({ notifications: [...state.notifications, notification] })),
  removeNotification: (id) => set((state) => ({ notifications: state.notifications.filter(n => n.id !== id) })),
  addNotificationHistory: (notification) => set((state) => ({
    notificationHistory: [{ ...notification, read: false }, ...state.notificationHistory],
    unreadNotificationCount: state.unreadNotificationCount + 1,
  })),
  markNotificationRead: (id) => set((state) => {
    const history = state.notificationHistory.map(n => n.id === id && !n.read ? { ...n, read: true } : n)
    return { notificationHistory: history, unreadNotificationCount: history.filter(n => !n.read).length }
  }),
  markAllNotificationsRead: () => set((state) => ({
    notificationHistory: state.notificationHistory.map(n => ({ ...n, read: true })),
    unreadNotificationCount: 0,
  })),
  clearNotificationHistory: () => set({ notificationHistory: [], unreadNotificationCount: 0 }),

  streamStatus: 'disconnected',
  streamLedgers: [],
  streamError: null,
  setStreamStatus: (status) => set({ streamStatus: status }),
  addStreamLedger: (l) => set((state) => ({ streamLedgers: [l, ...state.streamLedgers].slice(0, 50) })),
  clearStreamLedgers: () => set({ streamLedgers: [] }),
  setStreamError: (e) => set({ streamError: e }),

  // Ledger stats widget (Issue #267)
  ledgerHistory: [],
  baseFeeHistory: [],
  failedTxPercent: 0,
  showLedgerStatsWidget: true,
  addLedgerStatsEntry: (entry) => set((state) => {
    const history = [entry, ...state.ledgerHistory].slice(0, 50)
    const totalTx = history.reduce((s, e) => s + e.txSuccessCount + e.txFailedCount, 0)
    const failedTx = history.reduce((s, e) => s + e.txFailedCount, 0)
    return {
      ledgerHistory: history,
      baseFeeHistory: history.map(e => e.baseFee),
      failedTxPercent: totalTx > 0 ? Math.round((failedTx / totalTx) * 1000) / 10 : 0,
    }
  }),
  toggleLedgerStatsWidget: () => set((state) => ({ showLedgerStatsWidget: !state.showLedgerStatsWidget })),
}))

// ─── Expose store for e2e testing ────────────────────────────────────────────
if (typeof window !== 'undefined') {
  (window as any).__store = useStore
}

// ─── Persistence middleware ───────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  getStoredValue(STORE_PERSIST_KEY).then((saved: Record<string, unknown> | null) => {
    if (!saved || typeof saved !== 'object') return
    const slice: Partial<StoreState> = {}
    for (const key of PERSIST_KEYS) {
      if (key in saved) (slice as Record<string, unknown>)[key] = saved[key]
    }
    if (slice.searchFilters) {
      slice.searchFilters = { ...DEFAULT_SEARCH_FILTERS, ...slice.searchFilters }
    }
    if (Object.keys(slice).length > 0) useStore.setState(slice)
  }).catch(() => {})

  useStore.subscribe((state) => {
    const slice: Record<string, unknown> = {}
    for (const key of PERSIST_KEYS) slice[key] = state[key]
    syncState(STORE_PERSIST_KEY, slice).catch(() => {})
  })

  onStateChange((key: string, value: unknown) => {
    if (key === STORE_PERSIST_KEY && value && typeof value === 'object') {
      const current = useStore.getState()
      const incoming = value as Record<string, unknown>
      const patch: Partial<StoreState> = {}
      for (const k of PERSIST_KEYS) {
        if (incoming[k] !== undefined && incoming[k] !== current[k]) {
          (patch as Record<string, unknown>)[k] = incoming[k]
        }
      }
      if (Object.keys(patch).length > 0) useStore.setState(patch)
    }
  })
}
