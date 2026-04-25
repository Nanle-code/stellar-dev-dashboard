import { create } from 'zustand'
import { getStoredValue, setStoredValue } from './storage'
import { broadcastStateChange, onStateChange } from '../utils/stateSync'
import { notificationManager } from './notifications'

import { THEMES, THEME_STORAGE_KEY } from '../styles/themes'

// Keys that will be persisted to IndexedDB
const PERSISTED_KEYS = ['connectedAddress', 'network', 'theme', 'activeTab']

// Persistence middleware – saves selected keys to IndexedDB and syncs across tabs
const persistMiddleware = (config) => (set, get, api) => {
  const persistedSet = (...args) => {
    set(...args)
    const state = get()
    PERSISTED_KEYS.forEach((key) => {
      if (state[key] !== undefined) {
        setStoredValue(`store:${key}`, state[key])
        broadcastStateChange(`store:${key}`, state[key])
      }
    })
  }

  // Hydrate from IndexedDB on init
  Promise.all(
    PERSISTED_KEYS.map((key) =>
      getStoredValue(`store:${key}`).then((val) => (val !== null ? { [key]: val } : {}))
    )
  ).then((results) => {
    const hydrated = Object.assign({}, ...results)
    if (Object.keys(hydrated).length > 0) {
      set(hydrated)
      if (hydrated.theme) {
        document.documentElement.setAttribute('data-theme', hydrated.theme)
      }
    }
  })

  // Listen for changes from other tabs
  onStateChange((key, value) => {
    const storeKey = key.replace('store:', '')
    if (PERSISTED_KEYS.includes(storeKey) && value !== undefined) {
      set({ [storeKey]: value })
      if (storeKey === 'theme') {
        document.documentElement.setAttribute('data-theme', value)
      }
    }
  })

  return config(persistedSet, get, api)
}

export const useStore = create(persistMiddleware((set, get) => ({
  // Theme
  theme: typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) || THEMES.DARK : THEMES.DARK,
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    }
    document.documentElement.setAttribute('data-theme', newTheme)
    return { theme: newTheme }
  }),

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

  // Comparison
  comparisonSlots: [
    { key: '', data: null, loading: false, error: null },
    { key: '', data: null, loading: false, error: null },
    { key: '', data: null, loading: false, error: null }
  ],
  addComparisonSlot: () => set((state) => {
    if (state.comparisonSlots.length >= 5) return state; // max 5 slots
    return {
      comparisonSlots: [...state.comparisonSlots, { key: '', data: null, loading: false, error: null }]
    }
  }),
  removeComparisonSlot: (index) => set((state) => {
    if (state.comparisonSlots.length <= 2) return state; // min 2 slots
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

  // Price feed state
  prices: {},
  pricesLoading: false,
  pricesError: null,
  setPrices: (prices) => set({ prices, pricesError: null }),
  setPricesLoading: (v) => set({ pricesLoading: v }),
  setPricesError: (e) => set({ pricesError: e }),

  // Wallet state
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

  // Notifications
  notifications: [],
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications].slice(0, 10)
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  clearNotifications: () => set({ notifications: [] }),

  // Streaming
  streamStatus: 'disconnected',
  streamLedgers: [],
  streamError: null,
  setStreamStatus: (status) => set({ streamStatus: status }),
  addStreamLedger: (ledger) => set((state) => {
    if (state.streamLedgers.some(l => l.sequence === ledger.sequence)) return state
    return { streamLedgers: [ledger, ...state.streamLedgers.slice(0, 49)] }
  }),
  clearStreamLedgers: () => set({ streamLedgers: [] }),
  setStreamError: (e) => set({ streamError: e }),
})))

// let the notification manager push directly into the store
notificationManager._bindStore(useStore)
