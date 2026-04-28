import { create } from 'zustand'
import { getStoredValue, setStoredValue } from './storage'
import { syncState, onStateChange } from '../utils/stateSync'
import type {
  NetworkName,
  NetworkStats,
  PaymentPathRecord,
} from './stellar'
import type { Horizon, SorobanRpc } from '@stellar/stellar-sdk'

// ─── State shape ──────────────────────────────────────────────────────────────

export interface StoreState {
  // Network
  network: NetworkName
  setNetwork: (network: NetworkName) => void

  // UI State
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
  setNetworkStats: (stats: NetworkStats) => void
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
}

// ─── Persisted keys ───────────────────────────────────────────────────────────
// Only lightweight UI preferences are persisted — large data (txs, ops) is
// re-fetched on load and never written to IndexedDB.

const PERSIST_KEYS: Array<keyof StoreState> = ['network', 'theme', 'activeTab', 'savedSearches', 'multiSigMode']
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

  // UI State
  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
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

  // Network stats
  networkStats: null,
  statsLoading: false,
  setNetworkStats: (stats) => set({ networkStats: stats }),
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
}))

// ─── Persistence middleware ───────────────────────────────────────────────────
// Hydrate persisted preferences once on startup, then sync writes to IDB.

if (typeof window !== 'undefined') {
  // Hydrate from IndexedDB on startup (#105)
  getStoredValue(STORE_PERSIST_KEY).then((saved: Record<string, unknown> | null) => {
    if (saved && typeof saved === 'object') {
      const slice: Partial<StoreState> = {}
      for (const key of PERSIST_KEYS) {
        if (key in saved) (slice as Record<string, unknown>)[key] = saved[key as string]
      }
      if (Object.keys(slice).length > 0) useStore.setState(slice)
    }
  }).catch(() => {})

  // Write persisted keys to IDB on every state change
  useStore.subscribe((state) => {
    const slice: Record<string, unknown> = {}
    for (const key of PERSIST_KEYS) slice[key] = state[key]
    syncState(STORE_PERSIST_KEY, slice).catch(() => {})
  })

  // Listen for cross-tab state changes and apply them (#105)
  onStateChange((key: string, value: unknown) => {
    if (key === STORE_PERSIST_KEY && value && typeof value === 'object') {
      const current = useStore.getState()
      const incoming = value as Record<string, unknown>
      const patch: Partial<StoreState> = {}
      for (const k of PERSIST_KEYS) {
        // Last-writer-wins: apply incoming only if it differs from current
        if (incoming[k] !== undefined && incoming[k] !== current[k]) {
          (patch as Record<string, unknown>)[k] = incoming[k]
        }
      }
      if (Object.keys(patch).length > 0) useStore.setState(patch)
    }
  })
}
