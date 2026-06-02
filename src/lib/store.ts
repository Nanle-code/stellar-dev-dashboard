import { create } from 'zustand'
import { getStoredValue, setStoredValue } from './storage'
import { syncState, onStateChange } from '../utils/stateSync'
import type {
  NetworkName,
  NetworkStats,
} from './stellar'
import type { Horizon, SorobanRpc } from '@stellar/stellar-sdk'

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

export interface ComparisonSlot { // ported
  key: string
  data: Horizon.AccountResponse | null
  loading: boolean
  error: string | null
}

export interface Notification { // ported
  id: string
  type: string
  title: string
  [key: string]: unknown
}

export interface StreamLedger { // ported
  sequence: number
  [key: string]: unknown
}

const THEME_STORAGE_KEY = 'stellar-dashboard-theme'
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

export interface StoreState {
  // Network
  network: NetworkName
  setNetwork: (network: NetworkName) => void

  // UI State (updated)
  theme: 'light' | 'dark'
  toggleTheme: () => void
  isMobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void

  // Wallet / Account
  connectedAddress: string | null
  accountData: Horizon.AccountResponse | null
  accountLoading: boolean
  accountError: string | null
  setConnectedAddress: (address: string | null) => void
  setAccountData: (data: Horizon.AccountResponse) => void
  setAccountLoading: (loading: boolean) => void
  setAccountError: (error: string | null) => void

  // Transactions
  transactions: Horizon.ServerApi.TransactionRecord[]
  txLoading: boolean
  setTransactions: (txs: Horizon.ServerApi.TransactionRecord[]) => void
  appendTransactions: (txs: Horizon.ServerApi.TransactionRecord[]) => void
  setTxLoading: (v: boolean) => void
  txNextCursor: string | null
  txHasMore: boolean
  txPagingLoading: boolean
  setTxNextCursor: (cursor: string | null) => void
  setTxHasMore: (hasMore: boolean) => void
  setTxPagingLoading: (v: boolean) => void

  // Operations
  operations: Horizon.ServerApi.OperationRecord[]
  opsLoading: boolean
  setOperations: (ops: Horizon.ServerApi.OperationRecord[]) => void
  appendOperations: (ops: Horizon.ServerApi.OperationRecord[]) => void
  setOpsLoading: (v: boolean) => void
  opsNextCursor: string | null
  opsHasMore: boolean
  opsPagingLoading: boolean
  setOpsNextCursor: (cursor: string | null) => void
  setOpsHasMore: (hasMore: boolean) => void
  setOpsPagingLoading: (v: boolean) => void

  // Network stats
  networkStats: NetworkStats | null
  statsLoading: boolean
  setNetworkStats: (stats: NetworkStats | ((prev: NetworkStats | null) => NetworkStats)) => void
  setStatsLoading: (v: boolean) => void

  // Active tab
  activeTab: string
  setActiveTab: (tab: string) => void

  // Faucet
  faucetLoading: boolean
  faucetResult: unknown
  setFaucetLoading: (v: boolean) => void
  setFaucetResult: (r: unknown) => void

  // Contract explorer
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

  // Template state
  selectedTemplateId: string | null
  setSelectedTemplateId: (id: string | null) => void

  // Preferences panel
  preferencesOpen: boolean
  setPreferencesOpen: (open: boolean) => void

  // Error state
  globalError: { message: string; category: string } | null
  setGlobalError: (err: { message: string; category: string } | null) => void

  // Price feed state
  prices: Record<string, { usd: number | null; usd_24h_change: number | null }>
  pricesLoading: boolean
  pricesError: string | null
  setPrices: (prices: Record<string, { usd: number | null; usd_24h_change: number | null }>) => void
  setPricesLoading: (loading: boolean) => void
  setPricesError: (error: string | null) => void

  // Search Filters
  searchFilters: SearchFilters
  setSearchFilters: (filters: Partial<SearchFilters>) => void

  // Comparison slots (ported)
  comparisonSlots: ComparisonSlot[]
  addComparisonSlot: () => void
  removeComparisonSlot: (index: number) => void
  reorderComparisonSlots: (orderedSlots: ComparisonSlot[]) => void
  setComparisonKey: (index: number, key: string) => void
  setComparisonData: (index: number, data: Horizon.AccountResponse | null) => void
  setComparisonLoading: (index: number, loading: boolean) => void
  setComparisonError: (index: number, error: string | null) => void

  // Wallet state (ported)
  walletConnected: boolean
  walletType: string | null
  walletPublicKey: string | null
  setWalletConnected: (connected: boolean, type?: string | null, publicKey?: string | null) => void
  disconnectWallet: () => void

  // Notifications (ported)
  notifications: Notification[]
  addNotification: (notification: Notification) => void
  removeNotification: (id: string) => void

  // Streaming (ported)
  streamStatus: string
  streamLedgers: StreamLedger[]
  streamError: string | null
  setStreamStatus: (status: string) => void
  addStreamLedger: (ledger: StreamLedger) => void
  clearStreamLedgers: () => void
  setStreamError: (e: string | null) => void
}

// ─── Persisted keys ───────────────────────────────────────────────────────────
const PERSIST_KEYS: Array<keyof StoreState> = [
  'network', 'theme', 'activeTab', 'savedSearches', 'multiSigMode', 'searchFilters',
]
const STORE_PERSIST_KEY = 'store:preferences'

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<StoreState>((set, get) => ({
  // Network
  network: 'testnet',
  setNetwork: (network) => {
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

  // UI State (updated)
  theme: 'dark',
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light'
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme)
    }
    return { theme: newTheme }
  }),
  isMobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),

  // Wallet / Account
  connectedAddress: null,
  accountData: null,
  accountLoading: false,
  accountError: null,
  setConnectedAddress: (address) => set({ connectedAddress: address }),
  setAccountData: (data) => set({ accountData: data, accountError: null }),
  setAccountLoading: (loading) => set({ accountLoading: loading }),
  setAccountError: (error) => set({ accountError: error }),

  // Transactions
  transactions: [],
  txLoading: false,
  setTransactions: (txs) => set({ transactions: txs }),
  appendTransactions: (txs) => set((state) => {
    const existing = new Set(state.transactions.map(tx => tx.id))
    const merged = [...state.transactions, ...txs.filter(tx => !existing.has(tx.id))]
    return { transactions: merged }
  }),
  setTxLoading: (v) => set({ txLoading: v }),
  txNextCursor: null,
  txHasMore: false,
  txPagingLoading: false,
  setTxNextCursor: (cursor) => set({ txNextCursor: cursor }),
  setTxHasMore: (hasMore) => set({ txHasMore: hasMore }),
  setTxPagingLoading: (v) => set({ txPagingLoading: v }),

  // Operations
  operations: [],
  opsLoading: false,
  setOperations: (ops) => set({ operations: ops }),
  appendOperations: (ops) => set((state) => {
    const existing = new Set(state.operations.map(op => op.id))
    const merged = [...state.operations, ...ops.filter(op => !existing.has(op.id))]
    return { operations: merged }
  }),
  setOpsLoading: (v) => set({ opsLoading: v }),
  opsNextCursor: null,
  opsHasMore: false,
  opsPagingLoading: false,
  setOpsNextCursor: (cursor) => set({ opsNextCursor: cursor }),
  setOpsHasMore: (hasMore) => set({ opsHasMore: hasMore }),
  setOpsPagingLoading: (v) => set({ opsPagingLoading: v }),

  // Network stats (updated)
  networkStats: null,
  statsLoading: false,
  setNetworkStats: (stats) => set((state) => ({
    networkStats: typeof stats === 'function' ? stats(state.networkStats) : stats
  })),
  setStatsLoading: (v) => set({ statsLoading: v }),

  // Active tab
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Faucet
  faucetLoading: false,
  faucetResult: null,
  setFaucetLoading: (v) => set({ faucetLoading: v }),
  setFaucetResult: (r) => set({ faucetResult: r }),

  // Contract explorer
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

  // Template state
  selectedTemplateId: null,
  setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),

  // Preferences panel
  preferencesOpen: false,
  setPreferencesOpen: (open) => set({ preferencesOpen: open }),

  // Error state
  globalError: null,
  setGlobalError: (err) => set({ globalError: err }),

  // Price feed state
  prices: {},
  pricesLoading: false,
  pricesError: null,
  setPrices: (prices) => set({ prices, pricesError: null }),
  setPricesLoading: (loading) => set({ pricesLoading: loading }),
  setPricesError: (error) => set({ pricesError: error }),

  // Search Filters
  searchFilters: DEFAULT_SEARCH_FILTERS,
  setSearchFilters: (filters) => set((state) => ({
    searchFilters: { ...state.searchFilters, ...filters }
  })),

  // Comparison slots (ported)
  comparisonSlots: [
    { key: '', data: null, loading: false, error: null },
    { key: '', data: null, loading: false, error: null },
    { key: '', data: null, loading: false, error: null },
  ],
  addComparisonSlot: () => set((state) => {
    if (state.comparisonSlots.length >= 5) return {}
    return {
      comparisonSlots: [...state.comparisonSlots, { key: '', data: null, loading: false, error: null }]
    }
  }),
  removeComparisonSlot: (index) => set((state) => {
    if (state.comparisonSlots.length <= 2) return {}
    const slots = [...state.comparisonSlots]
    slots.splice(index, 1)
    return { comparisonSlots: slots }
  }),
  reorderComparisonSlots: (orderedSlots) => set({ comparisonSlots: orderedSlots }),
  setComparisonKey: (index, key) => set((state) => {
    const slots = [...state.comparisonSlots]
    slots[index] = { ...slots[index], key, error: null, data: null }
    return { comparisonSlots: slots }
  }),
  setComparisonData: (index, data) => set((state) => {
    const slots = [...state.comparisonSlots]
    slots[index] = { ...slots[index], data }
    return { comparisonSlots: slots }
  }),
  setComparisonLoading: (index, loading) => set((state) => {
    const slots = [...state.comparisonSlots]
    slots[index] = { ...slots[index], loading }
    return { comparisonSlots: slots }
  }),
  setComparisonError: (index, error) => set((state) => {
    const slots = [...state.comparisonSlots]
    slots[index] = { ...slots[index], error, data: null }
    return { comparisonSlots: slots }
  }),

  // Wallet state (ported)
  walletConnected: false,
  walletType: null,
  walletPublicKey: null,
  setWalletConnected: (connected, type, publicKey) => set({
    walletConnected: connected,
    walletType: type || null,
    walletPublicKey: publicKey || null,
  }),
  disconnectWallet: () => set({
    walletConnected: false,
    walletType: null,
    walletPublicKey: null,
  }),

  // Notifications (ported)
  notifications: [],
  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, notification]
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  // Streaming (ported)
  streamStatus: 'disconnected',
  streamLedgers: [],
  streamError: null,
  setStreamStatus: (status) => set({ streamStatus: status }),
  addStreamLedger: (ledger) => set((state) => {
    if (state.streamLedgers.some(l => l.sequence === ledger.sequence)) return {}
    return { streamLedgers: [ledger, ...state.streamLedgers.slice(0, 49)] }
  }),
  clearStreamLedgers: () => set({ streamLedgers: [] }),
  setStreamError: (e) => set({ streamError: e }),
}))

// ─── Expose store for e2e testing ────────────────────────────────────────────
if (typeof window !== 'undefined') {
  (window as any).__store = useStore
}

// ─── Persistence middleware ───────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  getStoredValue(STORE_PERSIST_KEY).then((saved: Record<string, unknown> | null) => {
    if (saved && typeof saved === 'object') {
      const slice: Partial<StoreState> = {}
      for (const key of PERSIST_KEYS) {
        if (key in saved) (slice as Record<string, unknown>)[key] = saved[key as string]
      }
      if (slice.searchFilters) {
        slice.searchFilters = { ...DEFAULT_SEARCH_FILTERS, ...slice.searchFilters }
      }
      if (Object.keys(slice).length > 0) useStore.setState(slice)
    }
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
