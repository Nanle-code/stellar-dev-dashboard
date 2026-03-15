import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // Network
  network: 'testnet',
  setNetwork: (network) => {
    set({ network, accountData: null, transactions: [], operations: [] })
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
  setTxLoading: (v) => set({ txLoading: v }),

  // Operations
  operations: [],
  opsLoading: false,
  setOperations: (ops) => set({ operations: ops }),
  setOpsLoading: (v) => set({ opsLoading: v }),

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
}))
