import { create } from 'zustand'
import { getStoredValue } from './storage'
import { syncState, onStateChange, resolveStateConflict, loadSyncedState, getTabId } from '../utils/stateSync'
import type { NetworkName, NetworkStats } from './stellar'
import type { Horizon, SorobanRpc } from '@stellar/stellar-sdk'
import { generateInsights, type AnalyticsSummary } from './analytics'
import { accountRequests } from './requestCancellation'
import { applyCustomThemeToDOM, removeCustomThemeFromDOM, saveThemeVarsToStorage, clearThemeVarsFromStorage, type ThemeDefinition } from '../styles/themeTypes'
import { handleNetworkSwitch } from './cacheInit'

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

export interface FilterExpression {
  key: string
  operator: string
  value: unknown
  not?: boolean
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

export interface NetworkScopedData {
  transactions: Horizon.ServerApi.TransactionRecord[]
  txNextCursor: string | null
  txHasMore: boolean
  txPagingLoading: boolean
  operations: Horizon.ServerApi.OperationRecord[]
  opsNextCursor: string | null
  opsHasMore: boolean
  opsPagingLoading: boolean
  accountData: Horizon.AccountResponse | null
}

export interface LedgerStatsEntry {
  sequence: number
  closedAt: string
  baseFee: number
  operationCount: number
  txSuccessCount: number
  txFailedCount: number
}

// ─── Domain Slices ─────────────────────────────────────────────────────────────

export interface NetworkSlice {
  networkId: NetworkName
  networkStats: NetworkStats | null
  statsLoading: boolean
  perNetworkData: Record<string, NetworkScopedData>
  streamStatus: string
  streamLedgers: StreamLedger[]
  streamError: string | null
  ledgerHistory: LedgerStatsEntry[]
  baseFeeHistory: number[]
  failedTxPercent: number
  prices: Record<string, { usd: number | null; usd_24h_change: number | null }>
  pricesLoading: boolean
  pricesError: string | null
  faucetLoading: boolean
  faucetResult: unknown
  contractId: string
  contractData: SorobanRpc.Api.LedgerEntryResult | null
  contractLoading: boolean
  contractError: string | null
  deploymentStatus: Record<string, unknown> | null
}

export interface SessionSlice {
  walletConnected: boolean
  walletType: string | null
  walletPublicKey: string | null
  walletSessionRevokedReason: string | null
  connectedAddress: string | null
  currentUserRole: string
  sessionRecordingActive: boolean
  sessionRecordingId: string | null
}

export interface AccountSlice {
  accountData: Horizon.AccountResponse | null
  accountLoading: boolean
  accountError: string | null
  transactions: Horizon.ServerApi.TransactionRecord[]
  txLoading: boolean
  txNextCursor: string | null
  txHasMore: boolean
  txPagingLoading: boolean
  operations: Horizon.ServerApi.OperationRecord[]
  opsLoading: boolean
  opsNextCursor: string | null
  opsHasMore: boolean
  opsPagingLoading: boolean
  analytics: AnalyticsSummary | null
  isGeneratingInsights: boolean
}

export interface UiSlice {
  theme: 'light' | 'dark'
  customTheme: ThemeDefinition | null
  themeBuilderDraft: ThemeDefinition | null
  isMobileMenuOpen: boolean
  activeTab: string
  preferencesOpen: boolean
  globalError: { message: string; category: string } | null
  showLedgerStatsWidget: boolean
  notifications: Notification[]
  notificationHistory: Notification[]
  unreadNotificationCount: number
}

export interface PreferencesSlice {
  searchFilters: SearchFilters
  filterExpressions: FilterExpression[]
  savedSearches: string[]
  multiSigMode: boolean
  selectedTemplateId: string | null
  capacityPredictionHorizon: number
  comparisonSlots: ComparisonSlot[]
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

const PERSIST_KEYS = ['preferences', 'ui'] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    const theme = (saved === 'light' || saved === 'dark')
      ? saved
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    return theme
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

export interface StoreState extends NetworkSlice, SessionSlice, AccountSlice, UiSlice, PreferencesSlice {
  network: NetworkSlice
  session: SessionSlice
  account: AccountSlice
  ui: UiSlice
  preferences: PreferencesSlice

  setNetwork: (networkId: NetworkName) => void
  toggleTheme: () => void
  setCustomTheme: (theme: ThemeDefinition | null) => void
  setThemeBuilderDraft: (draft: ThemeDefinition | null) => void
  setMobileMenuOpen: (open: boolean) => void

  setConnectedAddress: (address: string | null) => void
  setAccountData: (data: Horizon.AccountResponse) => void
  setAccountLoading: (loading: boolean) => void
  setAccountError: (error: string | null) => void

  setTransactions: (txs: Horizon.ServerApi.TransactionRecord[]) => void
  appendTransactions: (txs: Horizon.ServerApi.TransactionRecord[]) => void
  setTxLoading: (v: boolean) => void
  setTxNextCursor: (cursor: string | null) => void
  setTxHasMore: (hasMore: boolean) => void
  setTxPagingLoading: (v: boolean) => void

  setOperations: (ops: Horizon.ServerApi.OperationRecord[]) => void
  appendOperations: (ops: Horizon.ServerApi.OperationRecord[]) => void
  setOpsLoading: (v: boolean) => void
  setOpsNextCursor: (cursor: string | null) => void
  setOpsHasMore: (hasMore: boolean) => void
  setOpsPagingLoading: (v: boolean) => void

  setNetworkStats: (stats: NetworkStats | ((prev: NetworkStats | null) => NetworkStats)) => void
  setStatsLoading: (v: boolean) => void

  setActiveTab: (tab: string) => void

  setFaucetLoading: (v: boolean) => void
  setFaucetResult: (r: unknown) => void

  setContractId: (id: string) => void
  setContractData: (data: SorobanRpc.Api.LedgerEntryResult) => void
  setContractLoading: (v: boolean) => void
  setContractError: (e: string | null) => void

  // Analytics
  generateDataInsights: () => void

  setDeploymentStatus: (s: Record<string, unknown> | null) => void

  setSavedSearches: (s: string[]) => void

  setMultiSigMode: (v: boolean) => void

  setSelectedTemplateId: (id: string | null) => void

  setPreferencesOpen: (open: boolean) => void

  setGlobalError: (err: { message: string; category: string } | null) => void

  setPrices: (prices: Record<string, { usd: number | null; usd_24h_change: number | null }>) => void
  setPricesLoading: (loading: boolean) => void
  setPricesError: (error: string | null) => void

  setSearchFilters: (filters: Partial<SearchFilters>) => void

  setFilterExpressions: (exprs: FilterExpression[]) => void
  addFilterExpression: (expr: FilterExpression) => void
  removeFilterExpression: (index: number) => void
  updateFilterExpression: (index: number, expr: Partial<FilterExpression>) => void
  clearFilterExpressions: () => void

  addComparisonSlot: () => void
  removeComparisonSlot: (index: number) => void
  reorderComparisonSlots: (orderedSlots: ComparisonSlot[]) => void
  setComparisonKey: (index: number, key: string) => void
  setComparisonData: (index: number, data: Horizon.AccountResponse | null) => void
  setComparisonLoading: (index: number, loading: boolean) => void
  setComparisonError: (index: number, error: string | null) => void

  setWalletConnected: (connected: boolean, type?: string | null, publicKey?: string | null) => void
  disconnectWallet: () => void
  revokeWalletSession: (reason?: string) => void

  addNotification: (notification: Notification) => void
  removeNotification: (id: string) => void
  addNotificationHistory: (notification: Notification) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotificationHistory: () => void

  // Streaming
  setStreamStatus: (status: string) => void
  addStreamLedger: (ledger: StreamLedger) => void
  clearStreamLedgers: () => void
  setStreamError: (e: string | null) => void

  // Ledger stats widget (Issue #267)
  addLedgerStatsEntry: (entry: LedgerStatsEntry) => void
  toggleLedgerStatsWidget: () => void

  // Per-network data buckets for cross-network switching
  setPerNetworkData: (network: string, data: Partial<NetworkScopedData>) => void
  clearNetworkScopedData: () => void

  // RBAC (#410)
  setCurrentUserRole: (role: string) => void

  // Session Recording (#410)
  setSessionRecordingActive: (active: boolean, id?: string | null) => void

  // Capacity planning
  setCapacityPredictionHorizon: (days: number) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<StoreState>((set, get) => {
  const initialNetworkId = readInitialNetwork()
  
  const initialNetworkSlice: NetworkSlice = {
    networkId: initialNetworkId,
    networkStats: null,
    statsLoading: false,
    perNetworkData: {},
    streamStatus: 'disconnected',
    streamLedgers: [],
    streamError: null,
    ledgerHistory: [],
    baseFeeHistory: [],
    failedTxPercent: 0,
    prices: {},
    pricesLoading: false,
    pricesError: null,
    faucetLoading: false,
    faucetResult: null,
    contractId: '',
    contractData: null,
    contractLoading: false,
    contractError: null,
    deploymentStatus: null,
  }

  const initialSessionSlice: SessionSlice = {
    walletConnected: false,
    walletType: null,
    walletPublicKey: null,
    walletSessionRevokedReason: null,
    connectedAddress: null,
    currentUserRole: 'viewer',
    sessionRecordingActive: false,
    sessionRecordingId: null,
  }

  const initialAccountSlice: AccountSlice = {
    accountData: null,
    accountLoading: false,
    accountError: null,
    transactions: [],
    txLoading: false,
    txNextCursor: null,
    txHasMore: false,
    txPagingLoading: false,
    operations: [],
    opsLoading: false,
    opsNextCursor: null,
    opsHasMore: false,
    opsPagingLoading: false,
    analytics: null,
    isGeneratingInsights: false,
  }

  const initialUiSlice: UiSlice = {
    theme: getInitialTheme(),
    customTheme: null,
    themeBuilderDraft: null,
    isMobileMenuOpen: false,
    activeTab: 'overview',
    preferencesOpen: false,
    globalError: null,
    showLedgerStatsWidget: true,
    notifications: [],
    notificationHistory: [],
    unreadNotificationCount: 0,
  }

  const initialPreferencesSlice: PreferencesSlice = {
    searchFilters: DEFAULT_SEARCH_FILTERS,
    filterExpressions: [],
    savedSearches: [],
    multiSigMode: false,
    selectedTemplateId: null,
    capacityPredictionHorizon: 30,
    comparisonSlots: [],
  }

  return {
    ...initialNetworkSlice,
    ...initialSessionSlice,
    ...initialAccountSlice,
    ...initialUiSlice,
    ...initialPreferencesSlice,

    network: initialNetworkSlice,
    session: initialSessionSlice,
    account: initialAccountSlice,
    ui: initialUiSlice,
    preferences: initialPreferencesSlice,

    setNetwork: (networkId) => {
      const validNetworks: NetworkName[] = ['testnet', 'mainnet', 'futurenet', 'local', 'custom']
      if (!validNetworks.includes(networkId)) return

      try { if (typeof localStorage !== 'undefined') localStorage.setItem(SELECTED_NETWORK_KEY, networkId) } catch { /* ignore */ }

      // Capture previous network for cache invalidation before mutating state
      const prevNetworkId = get().networkId

      // Cancel Horizon reads issued against the network we are leaving. Without this
      // a slower response could repopulate the state this switch is about to clear,
      // showing the previous network's account data under the new network (#745).
      accountRequests.abortAll()

      // Stash current network data before switching
      const stash = (prev: StoreState) => {
        const current = prev.networkId
        const scoped: NetworkScopedData = {
          transactions: prev.transactions,
          txNextCursor: prev.txNextCursor,
          txHasMore: prev.txHasMore,
          txPagingLoading: false,
          operations: prev.operations,
          opsNextCursor: prev.opsNextCursor,
          opsHasMore: prev.opsHasMore,
          opsPagingLoading: false,
          accountData: prev.accountData,
        }
        return { ...prev.perNetworkData, [current]: scoped }
      }

      set((state) => {
        const updatedData = stash(state)
        const cached = updatedData[networkId]
        
        const networkUpdate: Partial<NetworkSlice> = {
          networkId,
          perNetworkData: updatedData,
          networkStats: null,
          statsLoading: false,
          streamLedgers: [],
          streamStatus: 'disconnected',
          streamError: null,
          contractData: null,
          contractLoading: false,
          contractError: null,
          prices: {},
          pricesLoading: false,
          pricesError: null,
          ledgerHistory: [],
          baseFeeHistory: [],
        }

        let accountUpdate: Partial<AccountSlice>
        if (cached) {
          accountUpdate = {
            accountData: cached.accountData,
            accountLoading: false,
            transactions: cached.transactions,
            txNextCursor: cached.txNextCursor,
            txHasMore: cached.txHasMore,
            txPagingLoading: false,
            txLoading: false,
            operations: cached.operations,
            opsNextCursor: cached.opsNextCursor,
            opsHasMore: cached.opsHasMore,
            opsPagingLoading: false,
            opsLoading: false,
          }
        } else {
          accountUpdate = {
            accountData: null,
            accountLoading: false,
            transactions: [],
            txNextCursor: null,
            txHasMore: false,
            txPagingLoading: false,
            txLoading: false,
            operations: [],
            opsNextCursor: null,
            opsHasMore: false,
            opsPagingLoading: false,
            opsLoading: false,
          }
        }
        
        return {
          ...networkUpdate,
          network: { ...state.network, ...networkUpdate },
          ...accountUpdate,
          account: { ...state.account, ...accountUpdate },
        } as Partial<StoreState>
      })

      // Invalidate the SWR/IDB cache for both networks after state is updated.
      // Only runs in environments where the cache is available (not SSR/tests).
      if (prevNetworkId !== networkId) {
        handleNetworkSwitch(prevNetworkId, networkId)
      }
    },
    setPerNetworkData: (network, data) => set((state) => {
      const update = {
        perNetworkData: {
          ...state.perNetworkData,
          [network]: { ...(state.perNetworkData[network] || {
            transactions: [], txNextCursor: null, txHasMore: false, txPagingLoading: false,
            operations: [], opsNextCursor: null, opsHasMore: false, opsPagingLoading: false,
            accountData: null,
          }), ...data },
        },
      }
      return {
        ...update,
        network: { ...state.network, ...update },
      }
    }),
    clearNetworkScopedData: () => set((state) => {
      const networkUpdate: Partial<NetworkSlice> = {
        perNetworkData: {},
        networkStats: null,
        statsLoading: false,
        streamLedgers: [],
        streamStatus: 'disconnected',
        contractData: null,
        prices: {},
      }
      const accountUpdate: Partial<AccountSlice> = {
        accountData: null,
        transactions: [],
        txNextCursor: null,
        txHasMore: false,
        txPagingLoading: false,
        operations: [],
        opsNextCursor: null,
        opsHasMore: false,
        opsPagingLoading: false,
      }
      return {
        ...networkUpdate,
        network: { ...state.network, ...networkUpdate },
        ...accountUpdate,
        account: { ...state.account, ...accountUpdate },
      }
    }),

    toggleTheme: () => set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light'
      if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, newTheme)
      if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', newTheme)
      return { theme: newTheme, ui: { ...state.ui, theme: newTheme } }
    }),

    setCustomTheme: (theme) => {
      if (theme && typeof localStorage !== 'undefined') saveThemeVarsToStorage(theme)
      set(s => ({ customTheme: theme, ui: { ...s.ui, customTheme: theme } }))
    },

    setThemeBuilderDraft: (draft) => {
      if (draft) {
        applyCustomThemeToDOM(draft)
        if (typeof localStorage !== 'undefined') saveThemeVarsToStorage(draft)
      } else {
        removeCustomThemeFromDOM()
        if (typeof localStorage !== 'undefined') clearThemeVarsFromStorage()
      }
      set(s => ({ themeBuilderDraft: draft, ui: { ...s.ui, themeBuilderDraft: draft } }))
    },

    setMobileMenuOpen: (open) => set(s => ({ isMobileMenuOpen: open, ui: { ...s.ui, isMobileMenuOpen: open } })),

    setConnectedAddress: (address) => set(s => ({ connectedAddress: address, session: { ...s.session, connectedAddress: address } })),
    setAccountData: (data) => set(s => ({ accountData: data, accountError: null, account: { ...s.account, accountData: data, accountError: null } })),
    setAccountLoading: (loading) => set(s => ({ accountLoading: loading, account: { ...s.account, accountLoading: loading } })),
    setAccountError: (error) => set(s => ({ accountError: error, account: { ...s.account, accountError: error } })),

    setTransactions: (txs) => set(s => ({ transactions: txs, account: { ...s.account, transactions: txs } })),
    appendTransactions: (txs) => set((state) => {
      const existing = new Set(state.transactions.map(tx => tx.id))
      const newTxs = [...state.transactions, ...txs.filter(tx => !existing.has(tx.id))]
      return { transactions: newTxs, account: { ...state.account, transactions: newTxs } }
    }),
    setTxLoading: (v) => set(s => ({ txLoading: v, account: { ...s.account, txLoading: v } })),
    setTxNextCursor: (cursor) => set(s => ({ txNextCursor: cursor, account: { ...s.account, txNextCursor: cursor } })),
    setTxHasMore: (hasMore) => set(s => ({ txHasMore: hasMore, account: { ...s.account, txHasMore: hasMore } })),
    setTxPagingLoading: (v) => set(s => ({ txPagingLoading: v, account: { ...s.account, txPagingLoading: v } })),

    setOperations: (ops) => set(s => ({ operations: ops, account: { ...s.account, operations: ops } })),
    appendOperations: (ops) => set((state) => {
      const existing = new Set(state.operations.map(op => op.id))
      const newOps = [...state.operations, ...ops.filter(op => !existing.has(op.id))]
      return { operations: newOps, account: { ...state.account, operations: newOps } }
    }),
    setOpsLoading: (v) => set(s => ({ opsLoading: v, account: { ...s.account, opsLoading: v } })),
    setOpsNextCursor: (cursor) => set(s => ({ opsNextCursor: cursor, account: { ...s.account, opsNextCursor: cursor } })),
    setOpsHasMore: (hasMore) => set(s => ({ opsHasMore: hasMore, account: { ...s.account, opsHasMore: hasMore } })),
    setOpsPagingLoading: (v) => set(s => ({ opsPagingLoading: v, account: { ...s.account, opsPagingLoading: v } })),

    setNetworkStats: (stats) => set((state) => {
      const val = typeof stats === 'function' ? stats(state.networkStats) : stats
      return {
        networkStats: val,
        statsLoading: false,
        network: { ...state.network, networkStats: val, statsLoading: false }
      }
    }),
    setStatsLoading: (v) => set(s => ({ statsLoading: v, network: { ...s.network, statsLoading: v } })),

    setActiveTab: (tab) => set(s => ({ activeTab: tab, ui: { ...s.ui, activeTab: tab } })),

    setFaucetLoading: (v) => set(s => ({ faucetLoading: v, network: { ...s.network, faucetLoading: v } })),
    setFaucetResult: (r) => set(s => ({ faucetResult: r, network: { ...s.network, faucetResult: r } })),

    setContractId: (id) => set(s => ({ contractId: id, network: { ...s.network, contractId: id } })),
    setContractData: (data) => set(s => ({ contractData: data, contractError: null, network: { ...s.network, contractData: data, contractError: null } })),
    setContractLoading: (v) => set(s => ({ contractLoading: v, network: { ...s.network, contractLoading: v } })),
    setContractError: (e) => set(s => ({ contractError: e, network: { ...s.network, contractError: e } })),

    // Analytics
    generateDataInsights: () => set((state) => {
      const summary = generateInsights(state.transactions, state.operations)
      return { analytics: summary, isGeneratingInsights: false, account: { ...state.account, analytics: summary, isGeneratingInsights: false } }
    }),

    setDeploymentStatus: (v) => set(s => ({ deploymentStatus: v, network: { ...s.network, deploymentStatus: v } })),

    setSavedSearches: (v) => set(s => ({ savedSearches: v, preferences: { ...s.preferences, savedSearches: v } })),

    setMultiSigMode: (v) => set(s => ({ multiSigMode: v, preferences: { ...s.preferences, multiSigMode: v } })),

    setSelectedTemplateId: (id) => set(s => ({ selectedTemplateId: id, preferences: { ...s.preferences, selectedTemplateId: id } })),

    setPreferencesOpen: (open) => set(s => ({ preferencesOpen: open, ui: { ...s.ui, preferencesOpen: open } })),

    setGlobalError: (err) => set(s => ({ globalError: err, ui: { ...s.ui, globalError: err } })),

    setPrices: (prices) => set(s => ({ prices, pricesError: null, network: { ...s.network, prices, pricesError: null } })),
    setPricesLoading: (loading) => set(s => ({ pricesLoading: loading, network: { ...s.network, pricesLoading: loading } })),
    setPricesError: (error) => set(s => ({ pricesError: error, network: { ...s.network, pricesError: error } })),

    setSearchFilters: (filters) => set((state) => {
      const newFilters = { ...state.searchFilters, ...filters }
      return { searchFilters: newFilters, preferences: { ...state.preferences, searchFilters: newFilters } }
    }),

    setFilterExpressions: (exprs) => set(s => ({ filterExpressions: exprs, preferences: { ...s.preferences, filterExpressions: exprs } })),
    addFilterExpression: (expr) => set((state) => {
      const newExprs = [...state.filterExpressions, expr]
      return { filterExpressions: newExprs, preferences: { ...state.preferences, filterExpressions: newExprs } }
    }),
    removeFilterExpression: (index) => set((state) => {
      const newExprs = state.filterExpressions.filter((_, i) => i !== index)
      return { filterExpressions: newExprs, preferences: { ...state.preferences, filterExpressions: newExprs } }
    }),
    updateFilterExpression: (index, partial) => set((state) => {
      const newExprs = state.filterExpressions.map((e, i) => i === index ? { ...e, ...partial } : e)
      return { filterExpressions: newExprs, preferences: { ...state.preferences, filterExpressions: newExprs } }
    }),
    clearFilterExpressions: () => set(s => ({ filterExpressions: [], preferences: { ...s.preferences, filterExpressions: [] } })),

    addComparisonSlot: () => set((state) => {
      const slots = state.comparisonSlots.length >= 5 ? state.comparisonSlots : [...state.comparisonSlots, { key: '', data: null, loading: false, error: null }]
      return { comparisonSlots: slots, preferences: { ...state.preferences, comparisonSlots: slots } }
    }),
    removeComparisonSlot: (index) => set((state) => {
      const slots = state.comparisonSlots.length <= 2 ? state.comparisonSlots : state.comparisonSlots.filter((_, i) => i !== index)
      return { comparisonSlots: slots, preferences: { ...state.preferences, comparisonSlots: slots } }
    }),
    reorderComparisonSlots: (orderedSlots) => set(s => ({ comparisonSlots: orderedSlots, preferences: { ...s.preferences, comparisonSlots: orderedSlots } })),
    setComparisonKey: (index, key) => set((state) => {
      const next = [...state.comparisonSlots]
      if (next[index]) next[index].key = key
      return { comparisonSlots: next, preferences: { ...state.preferences, comparisonSlots: next } }
    }),
    setComparisonData: (index, data) => set((state) => {
      const next = [...state.comparisonSlots]
      if (next[index]) { next[index].data = data; next[index].error = null }
      return { comparisonSlots: next, preferences: { ...state.preferences, comparisonSlots: next } }
    }),
    setComparisonLoading: (index, loading) => set((state) => {
      const next = [...state.comparisonSlots]
      if (next[index]) next[index].loading = loading
      return { comparisonSlots: next, preferences: { ...state.preferences, comparisonSlots: next } }
    }),
    setComparisonError: (index, error) => set((state) => {
      const next = [...state.comparisonSlots]
      if (next[index]) { next[index].error = error; next[index].data = null }
      return { comparisonSlots: next, preferences: { ...state.preferences, comparisonSlots: next } }
    }),

    setWalletConnected: (connected, type = null, publicKey = null) =>
      set(s => {
        const update = {
          walletConnected: connected,
          walletType: type,
          walletPublicKey: publicKey,
          walletSessionRevokedReason: connected ? null : s.walletSessionRevokedReason,
        }
        return { ...update, session: { ...s.session, ...update } }
      }),
    disconnectWallet: () =>
      set(s => {
        const update = {
          walletConnected: false,
          walletType: null,
          walletPublicKey: null,
          walletSessionRevokedReason: null,
        }
        return { ...update, session: { ...s.session, ...update } }
      }),
    revokeWalletSession: (reason = 'session_revoked') =>
      set(s => {
        const sessionUpdate = {
          walletConnected: false,
          walletType: null,
          walletPublicKey: null,
          walletSessionRevokedReason: reason,
          connectedAddress: null,
        }
        const accountUpdate = {
          accountData: null,
          accountLoading: false,
          accountError: null,
        }
        return {
          ...sessionUpdate,
          ...accountUpdate,
          session: { ...s.session, ...sessionUpdate },
          account: { ...s.account, ...accountUpdate },
        }
      }),

    addNotification: (notification) => set((state) => {
      const newNotifications = [...state.notifications, notification]
      return { notifications: newNotifications, ui: { ...state.ui, notifications: newNotifications } }
    }),
    removeNotification: (id) => set((state) => {
      const newNotifications = state.notifications.filter(n => n.id !== id)
      return { notifications: newNotifications, ui: { ...state.ui, notifications: newNotifications } }
    }),
    addNotificationHistory: (notification) => set((state) => {
      const history = [{ ...notification, read: false }, ...state.notificationHistory]
      const count = state.unreadNotificationCount + 1
      return { notificationHistory: history, unreadNotificationCount: count, ui: { ...state.ui, notificationHistory: history, unreadNotificationCount: count } }
    }),
    markNotificationRead: (id) => set((state) => {
      const history = state.notificationHistory.map(n => n.id === id && !n.read ? { ...n, read: true } : n)
      const count = history.filter(n => !n.read).length
      return { notificationHistory: history, unreadNotificationCount: count, ui: { ...state.ui, notificationHistory: history, unreadNotificationCount: count } }
    }),
    markAllNotificationsRead: () => set((state) => {
      const history = state.notificationHistory.map(n => ({ ...n, read: true }))
      return { notificationHistory: history, unreadNotificationCount: 0, ui: { ...state.ui, notificationHistory: history, unreadNotificationCount: 0 } }
    }),
    clearNotificationHistory: () => set(s => ({ notificationHistory: [], unreadNotificationCount: 0, ui: { ...s.ui, notificationHistory: [], unreadNotificationCount: 0 } })),

    setStreamStatus: (status) => set(s => ({ streamStatus: status, network: { ...s.network, streamStatus: status } })),
    addStreamLedger: (l) => set((state) => {
      const exists = state.streamLedgers.some((s) => s.sequence === l.sequence)
      if (exists) return {}
      const ledgers = [l, ...state.streamLedgers].slice(0, 50)
      return { streamLedgers: ledgers, network: { ...state.network, streamLedgers: ledgers } }
    }),
    clearStreamLedgers: () => set(s => ({ streamLedgers: [], network: { ...s.network, streamLedgers: [] } })),
    setStreamError: (e) => set(s => ({ streamError: e, network: { ...s.network, streamError: e } })),

    // Ledger stats widget (Issue #267)
    addLedgerStatsEntry: (entry) => set((state) => {
      const history = [entry, ...state.ledgerHistory].slice(0, 50)
      const totalTx = history.reduce((s, e) => s + e.txSuccessCount + e.txFailedCount, 0)
      const failedTx = history.reduce((s, e) => s + e.txFailedCount, 0)
      const percent = totalTx > 0 ? Math.round((failedTx / totalTx) * 1000) / 10 : 0
      const baseFee = history.map(e => e.baseFee)
      
      return {
        ledgerHistory: history,
        baseFeeHistory: baseFee,
        failedTxPercent: percent,
        network: {
          ...state.network,
          ledgerHistory: history,
          baseFeeHistory: baseFee,
          failedTxPercent: percent,
        }
      }
    }),
    toggleLedgerStatsWidget: () => set((state) => {
      const show = !state.showLedgerStatsWidget
      return { showLedgerStatsWidget: show, ui: { ...state.ui, showLedgerStatsWidget: show } }
    }),

    // RBAC (#410)
    setCurrentUserRole: (role) => set(s => ({ currentUserRole: role, session: { ...s.session, currentUserRole: role } })),

    // Session Recording (#410)
    setSessionRecordingActive: (active, id = null) => set(s => ({ sessionRecordingActive: active, sessionRecordingId: id ?? null, session: { ...s.session, sessionRecordingActive: active, sessionRecordingId: id ?? null } })),

    // Capacity planning
    setCapacityPredictionHorizon: (days) => set(s => ({ capacityPredictionHorizon: days, preferences: { ...s.preferences, capacityPredictionHorizon: days } })),
  }
})

// ─── Expose store for e2e testing ────────────────────────────────────────────
if (typeof window !== 'undefined') {
  (window as any).__store = useStore
}

// ─── System preference listener ───────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (localStorage.getItem(THEME_STORAGE_KEY)) return
    const newTheme = e.matches ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', newTheme)
    useStore.setState(s => ({ theme: newTheme, ui: { ...s.ui, theme: newTheme } }))
  })
}

// ─── Persistence middleware ───────────────────────────────────────────────────

let lastAppliedVersion = 0
let lastAppliedTs = 0
let lastAppliedWriter = ''

const MIGRATION_VERSION = 1
const STORE_VERSION_KEY = 'store:version'

function migrateState(saved: any) {
  // Currently version 1: return as is.
  return saved
}

if (typeof window !== 'undefined') {
  getStoredValue(STORE_PERSIST_KEY).then((saved: Record<string, unknown> | null) => {
    if (!saved || typeof saved !== 'object') return
    
    // Check version
    let version = 0
    try {
      const v = localStorage.getItem(STORE_VERSION_KEY)
      if (v) version = parseInt(v, 10)
    } catch {}
    
    let migrated = saved
    if (version < MIGRATION_VERSION) {
      migrated = migrateState(saved)
      try { localStorage.setItem(STORE_VERSION_KEY, MIGRATION_VERSION.toString()) } catch {}
    }
    
    const patch: Partial<StoreState> = {}
    
    if (migrated.preferences) {
      const pref = migrated.preferences as Partial<PreferencesSlice>
      if (pref.searchFilters) pref.searchFilters = { ...DEFAULT_SEARCH_FILTERS, ...pref.searchFilters }
      patch.preferences = { ...useStore.getState().preferences, ...pref }
      // Apply flat too
      Object.assign(patch, pref)
    }
    
    if (migrated.ui) {
      const ui = migrated.ui as Partial<UiSlice>
      patch.ui = { ...useStore.getState().ui, ...ui }
      // Apply flat too
      Object.assign(patch, ui)
      if (ui.themeBuilderDraft) applyCustomThemeToDOM(ui.themeBuilderDraft as ThemeDefinition)
    }

    if (Object.keys(patch).length > 0) {
      useStore.setState(patch)
    }
    
    const synced = loadSyncedState(STORE_PERSIST_KEY)
    if (synced) {
      lastAppliedVersion = synced.version
      lastAppliedTs = synced.timestamp
      lastAppliedWriter = synced.writerId
    }
  }).catch(() => {})

  useStore.subscribe((state) => {
    const slice: Record<string, unknown> = {}
    for (const key of PERSIST_KEYS) slice[key] = state[key]
    syncState(STORE_PERSIST_KEY, slice)
      .then((version) => {
        lastAppliedVersion = version
        lastAppliedTs = Date.now()
        lastAppliedWriter = getTabId()
      })
      .catch(() => {})
  })

  onStateChange((key: string, value: unknown, meta?: { version: number; writerId: string; timestamp: number } | null) => {
    if (key !== STORE_PERSIST_KEY || !value || typeof value !== 'object') return
    const current = useStore.getState()
    const incoming = value as Record<string, unknown>
    const localMeta = { version: lastAppliedVersion, timestamp: lastAppliedTs, writerId: lastAppliedWriter }
    
    const patch: Partial<StoreState> = {}
    
    for (const k of PERSIST_KEYS) {
      if (incoming[k] === undefined) continue
      const winner = resolveStateConflict(current[k], localMeta, incoming[k], meta ?? undefined)
      if (winner === incoming[k]) {
        (patch as Record<string, unknown>)[k] = incoming[k];
        // Apply flat properties too
        Object.assign(patch, incoming[k])
      }
    }
    if (Object.keys(patch).length > 0) {
      useStore.setState(patch)
      if (patch.ui?.themeBuilderDraft) applyCustomThemeToDOM(patch.ui.themeBuilderDraft)
      if (meta) {
        lastAppliedVersion = meta.version
        lastAppliedTs = meta.timestamp
        lastAppliedWriter = meta.writerId || lastAppliedWriter
      }
    }
  })
}
