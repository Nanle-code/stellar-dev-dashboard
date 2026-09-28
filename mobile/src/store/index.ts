import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NetworkName } from '../services/stellar'

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

export interface Notification {
  id: string
  type: string
  title: string
  body?: string
  read?: boolean
  timestamp?: number
  data?: Record<string, unknown>
}

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

export interface Balances {
  asset_type: string
  asset_code?: string
  asset_issuer?: string
  balance: string
  limit?: string
}

export interface AccountData {
  id: string
  account_id: string
  sequence: string
  subentry_count: number
  balances: Balances[]
  signers: Array<{ key: string; type: string; weight: number }>
  thresholds: { low_threshold: number; med_threshold: number; high_threshold: number }
  last_modified_ledger: number
}

export interface StoreState {
  network: NetworkName
  setNetwork: (network: NetworkName) => void

  connectedAddress: string | null
  accountData: AccountData | null
  accountLoading: boolean
  accountError: string | null
  setConnectedAddress: (address: string | null) => void
  setAccountData: (data: AccountData) => void
  setAccountLoading: (loading: boolean) => void
  setAccountError: (error: string | null) => void

  transactions: any[]
  txLoading: boolean
  txNextCursor: string | null
  txHasMore: boolean
  txPagingLoading: boolean
  setTransactions: (txs: any[]) => void
  appendTransactions: (txs: any[]) => void
  setTxLoading: (v: boolean) => void
  setTxNextCursor: (cursor: string | null) => void
  setTxHasMore: (hasMore: boolean) => void
  setTxPagingLoading: (v: boolean) => void

  operations: any[]
  opsLoading: boolean
  opsNextCursor: string | null
  opsHasMore: boolean
  opsPagingLoading: boolean
  setOperations: (ops: any[]) => void
  appendOperations: (ops: any[]) => void
  setOpsLoading: (v: boolean) => void
  setOpsNextCursor: (cursor: string | null) => void
  setOpsHasMore: (hasMore: boolean) => void
  setOpsPagingLoading: (v: boolean) => void

  networkStats: { latestLedger: any; feeStats: any } | null
  statsLoading: boolean
  setNetworkStats: (stats: any) => void
  setStatsLoading: (v: boolean) => void

  balances: Balances[]
  setBalances: (balances: Balances[]) => void

  searchFilters: SearchFilters
  setSearchFilters: (filters: Partial<SearchFilters>) => void

  prices: Record<string, { usd: number | null; usd_24h_change: number | null }>
  pricesLoading: boolean
  pricesError: string | null
  setPrices: (prices: Record<string, { usd: number | null; usd_24h_change: number | null }>) => void
  setPricesLoading: (loading: boolean) => void
  setPricesError: (error: string | null) => void

  notifications: Notification[]
  notificationHistory: Notification[]
  unreadNotificationCount: number
  addNotification: (notification: Notification) => void
  removeNotification: (id: string) => void
  addNotificationHistory: (notification: Notification) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotificationHistory: () => void

  biometricsEnabled: boolean
  setBiometricsEnabled: (enabled: boolean) => void
  biometricsPassed: boolean
  setBiometricsPassed: (passed: boolean) => void

  pushToken: string | null
  setPushToken: (token: string | null) => void

  isOnline: boolean
  setIsOnline: (online: boolean) => void
  lastSyncTimestamp: number | null
  setLastSyncTimestamp: (ts: number) => void

  addressesHistory: string[]
  addAddressToHistory: (address: string) => void
  clearAddressHistory: () => void
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      network: 'testnet' as NetworkName,
      setNetwork: (network) => set({ network }),

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
      appendTransactions: (txs) =>
        set((state) => {
          const existing = new Set(state.transactions.map((tx: any) => tx.id))
          return { transactions: [...state.transactions, ...txs.filter((tx: any) => !existing.has(tx.id))] }
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
      appendOperations: (ops) =>
        set((state) => {
          const existing = new Set(state.operations.map((op: any) => op.id))
          return { operations: [...state.operations, ...ops.filter((op: any) => !existing.has(op.id))] }
        }),
      setOpsLoading: (v) => set({ opsLoading: v }),
      setOpsNextCursor: (cursor) => set({ opsNextCursor: cursor }),
      setOpsHasMore: (hasMore) => set({ opsHasMore: hasMore }),
      setOpsPagingLoading: (v) => set({ opsPagingLoading: v }),

      networkStats: null,
      statsLoading: false,
      setNetworkStats: (stats) => set({ networkStats: stats, statsLoading: false }),
      setStatsLoading: (v) => set({ statsLoading: v }),

      balances: [],
      setBalances: (balances) => set({ balances }),

      searchFilters: DEFAULT_SEARCH_FILTERS,
      setSearchFilters: (filters) =>
        set((state) => ({ searchFilters: { ...state.searchFilters, ...filters } })),

      prices: {},
      pricesLoading: false,
      pricesError: null,
      setPrices: (prices) => set({ prices, pricesError: null }),
      setPricesLoading: (loading) => set({ pricesLoading: loading }),
      setPricesError: (error) => set({ pricesError: error }),

      notifications: [],
      notificationHistory: [],
      unreadNotificationCount: 0,
      addNotification: (notification) =>
        set((state) => ({ notifications: [...state.notifications, notification] })),
      removeNotification: (id) =>
        set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
      addNotificationHistory: (notification) =>
        set((state) => ({
          notificationHistory: [{ ...notification, read: false }, ...state.notificationHistory],
          unreadNotificationCount: state.unreadNotificationCount + 1,
        })),
      markNotificationRead: (id) =>
        set((state) => {
          const history = state.notificationHistory.map((n) =>
            n.id === id && !n.read ? { ...n, read: true } : n,
          )
          return { notificationHistory: history, unreadNotificationCount: history.filter((n) => !n.read).length }
        }),
      markAllNotificationsRead: () =>
        set((state) => ({
          notificationHistory: state.notificationHistory.map((n) => ({ ...n, read: true })),
          unreadNotificationCount: 0,
        })),
      clearNotificationHistory: () => set({ notificationHistory: [], unreadNotificationCount: 0 }),

      biometricsEnabled: false,
      setBiometricsEnabled: (enabled) => set({ biometricsEnabled: enabled }),
      biometricsPassed: false,
      setBiometricsPassed: (passed) => set({ biometricsPassed: passed }),

      pushToken: null,
      setPushToken: (token) => set({ pushToken: token }),

      isOnline: true,
      setIsOnline: (online) => set({ isOnline: online }),
      lastSyncTimestamp: null,
      setLastSyncTimestamp: (ts) => set({ lastSyncTimestamp: ts }),

      addressesHistory: [],
      addAddressToHistory: (address) =>
        set((state) => {
          const filtered = state.addressesHistory.filter((a) => a !== address)
          return { addressesHistory: [address, ...filtered].slice(0, 20) }
        }),
      clearAddressHistory: () => set({ addressesHistory: [] }),
    }),
    {
      name: 'stellar-dashboard-mobile-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        network: state.network,
        connectedAddress: state.connectedAddress,
        biometricsEnabled: state.biometricsEnabled,
        addressesHistory: state.addressesHistory,
      }),
    },
  ),
)
