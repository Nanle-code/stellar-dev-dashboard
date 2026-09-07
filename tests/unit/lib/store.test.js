import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/lib/storage', () => ({
  getStoredValue: vi.fn().mockResolvedValue(null),
  setStoredValue: vi.fn(),
}));
vi.mock('../../../src/utils/stateSync', () => ({
  broadcastStateChange: vi.fn(),
  onStateChange: vi.fn(),
  syncState: vi.fn().mockResolvedValue(undefined),
  loadSyncedState: vi.fn().mockResolvedValue(null),
  resolveStateConflict: vi.fn((local) => local),
  getTabId: vi.fn().mockReturnValue('test-tab'),
}));
vi.mock('../../../src/lib/cacheInit', () => ({
  handleNetworkSwitch: vi.fn(),
  initCache: vi.fn().mockResolvedValue(undefined),
  handleTransactionSuccess: vi.fn().mockResolvedValue(undefined),
  _resetCacheInit: vi.fn(),
}));
// requestCancellation is safe to use real — no side effects at import time.
// But mock it so tests run fast and don't depend on AbortController polyfills.
vi.mock('../../../src/lib/requestCancellation', () => ({
  accountRequests: { abortAll: vi.fn(), begin: vi.fn(() => ({ active: true, commit: vi.fn(() => true), abort: vi.fn() })) },
  AccountLanes: { Connect: 'account:connect', Offers: 'account:offers', CreationDate: 'account:creation-date' },
  isCancellation: vi.fn(() => false),
  isStaleRequestError: vi.fn(() => false),
  StaleRequestError: class StaleRequestError extends Error {},
}));

// Track handleNetworkSwitch calls so we can assert cache invalidation behaviour.
const mockHandleNetworkSwitch = vi.fn();
vi.mock('../../../src/lib/cacheInit', () => ({
  handleNetworkSwitch: (...args) => mockHandleNetworkSwitch(...args),
  initCache: vi.fn().mockResolvedValue(undefined),
  handleTransactionSuccess: vi.fn().mockResolvedValue(undefined),
  _resetCacheInit: vi.fn(),
}));

import { useStore } from '../../../src/lib/store';

describe('useStore', () => {
  beforeEach(() => {
    mockHandleNetworkSwitch.mockClear();
    useStore.setState({
      network: 'testnet',
      connectedAddress: null,
      accountData: null,
      accountLoading: false,
      accountError: null,
      transactions: [],
      operations: [],
      txNextCursor: null,
      txHasMore: false,
      opsNextCursor: null,
      opsHasMore: false,
      networkStats: null,
      statsLoading: false,
      streamStatus: 'disconnected',
      streamLedgers: [],
      streamError: null,
      contractData: null,
      contractLoading: false,
      contractError: null,
      prices: {},
      pricesLoading: false,
      pricesError: null,
      ledgerHistory: [],
      baseFeeHistory: [],
      perNetworkData: {},
      activeTab: 'overview',
      notifications: [],
      walletConnected: false,
      walletType: null,
      walletPublicKey: null,
      comparisonSlots: [
        { key: '', data: null, loading: false, error: null },
        { key: '', data: null, loading: false, error: null },
        { key: '', data: null, loading: false, error: null },
      ],
    }, false); // false = merge, preserves action functions
  });

  // ─── Network ───────────────────────────────────────────────────────────────

  it('setNetwork clears account and transaction state', () => {
    useStore.setState({ transactions: [{ id: '1' }], accountData: { id: 'G...' } }, false);
    useStore.getState().setNetwork('mainnet');
    const state = useStore.getState();
    expect(state.network).toBe('mainnet');
    expect(state.transactions).toHaveLength(0);
    expect(state.accountData).toBeNull();
  });

  it('setNetwork clears all non-scoped fields on switch', () => {
    useStore.setState({
      networkStats: { fee_stats: {} },
      streamLedgers: [{ sequence: 1 }],
      streamStatus: 'connected',
      contractData: { val: 'x' },
      prices: { XLM: { usd: 0.1, usd_24h_change: 0 } },
      ledgerHistory: [{ sequence: 1, closedAt: '', baseFee: 100, operationCount: 0, txSuccessCount: 0, txFailedCount: 0 }],
      baseFeeHistory: [100],
    }, false);

    useStore.getState().setNetwork('mainnet');

    const state = useStore.getState();
    expect(state.networkStats).toBeNull();
    expect(state.streamLedgers).toHaveLength(0);
    expect(state.streamStatus).toBe('disconnected');
    expect(state.contractData).toBeNull();
    expect(state.prices).toEqual({});
    expect(state.ledgerHistory).toHaveLength(0);
    expect(state.baseFeeHistory).toHaveLength(0);
  });

  it('setNetwork invokes handleNetworkSwitch to invalidate the SWR/IDB cache', () => {
    useStore.getState().setNetwork('mainnet');
    expect(mockHandleNetworkSwitch).toHaveBeenCalledOnce();
    expect(mockHandleNetworkSwitch).toHaveBeenCalledWith('testnet', 'mainnet');
  });

  it('setNetwork does NOT invoke handleNetworkSwitch when the network is unchanged', () => {
    useStore.getState().setNetwork('testnet'); // same network
    expect(mockHandleNetworkSwitch).not.toHaveBeenCalled();
  });

  it('setNetwork stashes previous network data into perNetworkData', () => {
    useStore.setState({
      transactions: [{ id: 'tx-testnet' }],
      accountData: { id: 'G_TESTNET' },
    }, false);

    useStore.getState().setNetwork('mainnet');

    const stashed = useStore.getState().perNetworkData['testnet'];
    expect(stashed).toBeDefined();
    expect(stashed.transactions).toEqual([{ id: 'tx-testnet' }]);
    expect(stashed.accountData).toEqual({ id: 'G_TESTNET' });
  });

  it('setNetwork restores cached data when switching back to a previously visited network', () => {
    // Visit mainnet first so data gets stashed
    useStore.setState({
      transactions: [{ id: 'tx-testnet' }],
      accountData: { id: 'G_TESTNET' },
    }, false);
    useStore.getState().setNetwork('mainnet');

    // Simulate some mainnet data
    useStore.setState({
      transactions: [{ id: 'tx-mainnet' }],
      accountData: { id: 'G_MAINNET' },
    }, false);

    // Switch back to testnet
    useStore.getState().setNetwork('testnet');

    const state = useStore.getState();
    expect(state.transactions).toEqual([{ id: 'tx-testnet' }]);
    expect(state.accountData).toEqual({ id: 'G_TESTNET' });
  });

  it('setNetwork ignores unknown network values', () => {
    useStore.getState().setNetwork('unknown-net');
    expect(useStore.getState().network).toBe('testnet'); // unchanged
    expect(mockHandleNetworkSwitch).not.toHaveBeenCalled();
  });

  // ─── Account ───────────────────────────────────────────────────────────────

  it('setConnectedAddress updates connectedAddress', () => {
    useStore.getState().setConnectedAddress('GABC');
    expect(useStore.getState().connectedAddress).toBe('GABC');
  });

  it('setAccountData clears accountError', () => {
    useStore.setState({ accountError: 'old error' }, false);
    useStore.getState().setAccountData({ id: 'G...' });
    expect(useStore.getState().accountError).toBeNull();
  });

  // ─── Transactions ──────────────────────────────────────────────────────────

  it('appendTransactions deduplicates by id', () => {
    useStore.getState().setTransactions([{ id: 'tx1' }, { id: 'tx2' }]);
    useStore.getState().appendTransactions([{ id: 'tx2' }, { id: 'tx3' }]);
    expect(useStore.getState().transactions).toHaveLength(3);
  });

  // ─── Active tab ────────────────────────────────────────────────────────────

  it('setActiveTab updates activeTab', () => {
    useStore.getState().setActiveTab('multisig');
    expect(useStore.getState().activeTab).toBe('multisig');
  });

  // ─── Wallet ────────────────────────────────────────────────────────────────

  it('setWalletConnected stores wallet info', () => {
    useStore.getState().setWalletConnected(true, 'freighter', 'GPUB');
    const { walletConnected, walletType, walletPublicKey } = useStore.getState();
    expect(walletConnected).toBe(true);
    expect(walletType).toBe('freighter');
    expect(walletPublicKey).toBe('GPUB');
  });

  it('disconnectWallet clears wallet state', () => {
    useStore.getState().setWalletConnected(true, 'freighter', 'GPUB');
    useStore.getState().disconnectWallet();
    const { walletConnected, walletType, walletPublicKey } = useStore.getState();
    expect(walletConnected).toBe(false);
    expect(walletType).toBeNull();
    expect(walletPublicKey).toBeNull();
  });

  // ─── Notifications ─────────────────────────────────────────────────────────

  it('addNotification appends to list', () => {
    useStore.getState().addNotification({ id: 'n1', type: 'success', title: 'Done' });
    expect(useStore.getState().notifications).toHaveLength(1);
  });

  it('removeNotification removes by id', () => {
    useStore.getState().addNotification({ id: 'n1', type: 'success', title: 'Done' });
    useStore.getState().addNotification({ id: 'n2', type: 'error', title: 'Fail' });
    useStore.getState().removeNotification('n1');
    const notifs = useStore.getState().notifications;
    expect(notifs).toHaveLength(1);
    expect(notifs[0].id).toBe('n2');
  });

  // ─── Comparison slots ──────────────────────────────────────────────────────

  it('addComparisonSlot adds a slot up to max 5', () => {
    useStore.getState().addComparisonSlot();
    expect(useStore.getState().comparisonSlots).toHaveLength(4);
    useStore.getState().addComparisonSlot();
    useStore.getState().addComparisonSlot();
    useStore.getState().addComparisonSlot(); // should cap at 5
    expect(useStore.getState().comparisonSlots).toHaveLength(5);
  });

  it('removeComparisonSlot enforces min 2 slots', () => {
    useStore.setState({ comparisonSlots: [
      { key: '', data: null, loading: false, error: null },
      { key: '', data: null, loading: false, error: null },
    ]}, false);
    useStore.getState().removeComparisonSlot(0);
    expect(useStore.getState().comparisonSlots).toHaveLength(2);
  });

  it('setComparisonKey updates a slot and clears error/data', () => {
    useStore.getState().setComparisonKey(0, 'GABC');
    const slot = useStore.getState().comparisonSlots[0];
    expect(slot.key).toBe('GABC');
    expect(slot.error).toBeNull();
    expect(slot.data).toBeNull();
  });

  it('setComparisonData updates slot data', () => {
    useStore.getState().setComparisonData(0, { id: 'GABC' });
    expect(useStore.getState().comparisonSlots[0].data).toEqual({ id: 'GABC' });
  });

  it('setComparisonLoading toggles slot loading', () => {
    useStore.getState().setComparisonLoading(0, true);
    expect(useStore.getState().comparisonSlots[0].loading).toBe(true);
  });

  it('setComparisonError sets error and clears data', () => {
    useStore.getState().setComparisonData(0, { id: 'GABC' });
    useStore.getState().setComparisonError(0, 'not found');
    const slot = useStore.getState().comparisonSlots[0];
    expect(slot.error).toBe('not found');
    expect(slot.data).toBeNull();
  });

  it('reorderComparisonSlots replaces all slots', () => {
    const reordered = [
      { key: 'A', data: null, loading: false, error: null },
      { key: 'B', data: null, loading: false, error: null },
    ];
    useStore.getState().reorderComparisonSlots(reordered);
    expect(useStore.getState().comparisonSlots).toEqual(reordered);
  });

  // ─── Streaming ──────────────────────────────────────────────────────────────

  it('setStreamStatus updates stream status', () => {
    useStore.getState().setStreamStatus('connected');
    expect(useStore.getState().streamStatus).toBe('connected');
  });

  it('addStreamLedger prepends ledger and caps at 50', () => {
    for (let i = 0; i < 55; i++) {
      useStore.getState().addStreamLedger({ sequence: i });
    }
    const ledgers = useStore.getState().streamLedgers;
    expect(ledgers).toHaveLength(50);
    expect(ledgers[0].sequence).toBe(54);
  });

  it('addStreamLedger deduplicates by sequence', () => {
    useStore.getState().addStreamLedger({ sequence: 1 });
    useStore.getState().addStreamLedger({ sequence: 1 });
    expect(useStore.getState().streamLedgers).toHaveLength(1);
  });

  it('clearStreamLedgers empties the list', () => {
    useStore.getState().addStreamLedger({ sequence: 1 });
    useStore.getState().clearStreamLedgers();
    expect(useStore.getState().streamLedgers).toHaveLength(0);
  });

  it('setStreamError stores the error', () => {
    useStore.getState().setStreamError('connection lost');
    expect(useStore.getState().streamError).toBe('connection lost');
  });
});


describe('useStore', () => {
  beforeEach(() => {
    useStore.setState({
      network: 'testnet',
      connectedAddress: null,
      accountData: null,
      accountLoading: false,
      accountError: null,
      transactions: [],
      operations: [],
      activeTab: 'overview',
      notifications: [],
      walletConnected: false,
      walletType: null,
      walletPublicKey: null,
      comparisonSlots: [
        { key: '', data: null, loading: false, error: null },
        { key: '', data: null, loading: false, error: null },
        { key: '', data: null, loading: false, error: null },
      ],
      streamStatus: 'disconnected',
      streamLedgers: [],
      streamError: null,
    }, false); // false = merge, preserves action functions
  });

  // ─── Network ───────────────────────────────────────────────────────────────

  it('setNetwork clears account and transaction state', () => {
    useStore.setState({ transactions: [{ id: '1' }], accountData: { id: 'G...' } }, false);
    useStore.getState().setNetwork('mainnet');
    const state = useStore.getState();
    expect(state.network).toBe('mainnet');
    expect(state.transactions).toHaveLength(0);
    expect(state.accountData).toBeNull();
  });

  // ─── Account ───────────────────────────────────────────────────────────────

  it('setConnectedAddress updates connectedAddress', () => {
    useStore.getState().setConnectedAddress('GABC');
    expect(useStore.getState().connectedAddress).toBe('GABC');
  });

  it('setAccountData clears accountError', () => {
    useStore.setState({ accountError: 'old error' }, false);
    useStore.getState().setAccountData({ id: 'G...' });
    expect(useStore.getState().accountError).toBeNull();
  });

  // ─── Transactions ──────────────────────────────────────────────────────────

  it('appendTransactions deduplicates by id', () => {
    useStore.getState().setTransactions([{ id: 'tx1' }, { id: 'tx2' }]);
    useStore.getState().appendTransactions([{ id: 'tx2' }, { id: 'tx3' }]);
    expect(useStore.getState().transactions).toHaveLength(3);
  });

  // ─── Active tab ────────────────────────────────────────────────────────────

  it('setActiveTab updates activeTab', () => {
    useStore.getState().setActiveTab('multisig');
    expect(useStore.getState().activeTab).toBe('multisig');
  });

  // ─── Wallet ────────────────────────────────────────────────────────────────

  it('setWalletConnected stores wallet info', () => {
    useStore.getState().setWalletConnected(true, 'freighter', 'GPUB');
    const { walletConnected, walletType, walletPublicKey } = useStore.getState();
    expect(walletConnected).toBe(true);
    expect(walletType).toBe('freighter');
    expect(walletPublicKey).toBe('GPUB');
  });

  it('disconnectWallet clears wallet state', () => {
    useStore.getState().setWalletConnected(true, 'freighter', 'GPUB');
    useStore.getState().disconnectWallet();
    const { walletConnected, walletType, walletPublicKey } = useStore.getState();
    expect(walletConnected).toBe(false);
    expect(walletType).toBeNull();
    expect(walletPublicKey).toBeNull();
  });

  it('revokeWalletSession clears wallet and account state with reason', () => {
    useStore.setState({
      walletConnected: true,
      walletType: 'freighter',
      walletPublicKey: 'GPUB',
      connectedAddress: 'GPUB',
      accountData: { id: 'GPUB' },
      accountError: 'stale',
    }, false);

    useStore.getState().revokeWalletSession('wallet_locked');
    const state = useStore.getState();
    expect(state.walletConnected).toBe(false);
    expect(state.connectedAddress).toBeNull();
    expect(state.accountData).toBeNull();
    expect(state.accountError).toBeNull();
    expect(state.walletSessionRevokedReason).toBe('wallet_locked');
  });

  // ─── Notifications ─────────────────────────────────────────────────────────

  it('addNotification appends to list', () => {
    useStore.getState().addNotification({ id: 'n1', type: 'success', title: 'Done' });
    expect(useStore.getState().notifications).toHaveLength(1);
  });

  it('removeNotification removes by id', () => {
    useStore.getState().addNotification({ id: 'n1', type: 'success', title: 'Done' });
    useStore.getState().addNotification({ id: 'n2', type: 'error', title: 'Fail' });
    useStore.getState().removeNotification('n1');
    const notifs = useStore.getState().notifications;
    expect(notifs).toHaveLength(1);
    expect(notifs[0].id).toBe('n2');
  });

  // ─── Comparison slots ──────────────────────────────────────────────────────

  it('addComparisonSlot adds a slot up to max 5', () => {
    useStore.getState().addComparisonSlot();
    expect(useStore.getState().comparisonSlots).toHaveLength(4);
    useStore.getState().addComparisonSlot();
    useStore.getState().addComparisonSlot();
    useStore.getState().addComparisonSlot(); // should cap at 5
    expect(useStore.getState().comparisonSlots).toHaveLength(5);
  });

  it('removeComparisonSlot enforces min 2 slots', () => {
    useStore.setState({ comparisonSlots: [
      { key: '', data: null, loading: false, error: null },
      { key: '', data: null, loading: false, error: null },
    ]}, false);
    useStore.getState().removeComparisonSlot(0);
    expect(useStore.getState().comparisonSlots).toHaveLength(2);
  });

  it('setComparisonKey updates a slot and clears error/data', () => {
    useStore.getState().setComparisonKey(0, 'GABC');
    const slot = useStore.getState().comparisonSlots[0];
    expect(slot.key).toBe('GABC');
    expect(slot.error).toBeNull();
    expect(slot.data).toBeNull();
  });

  it('setComparisonData updates slot data', () => {
    useStore.getState().setComparisonData(0, { id: 'GABC' });
    expect(useStore.getState().comparisonSlots[0].data).toEqual({ id: 'GABC' });
  });

  it('setComparisonLoading toggles slot loading', () => {
    useStore.getState().setComparisonLoading(0, true);
    expect(useStore.getState().comparisonSlots[0].loading).toBe(true);
  });

  it('setComparisonError sets error and clears data', () => {
    useStore.getState().setComparisonData(0, { id: 'GABC' });
    useStore.getState().setComparisonError(0, 'not found');
    const slot = useStore.getState().comparisonSlots[0];
    expect(slot.error).toBe('not found');
    expect(slot.data).toBeNull();
  });

  it('reorderComparisonSlots replaces all slots', () => {
    const reordered = [
      { key: 'A', data: null, loading: false, error: null },
      { key: 'B', data: null, loading: false, error: null },
    ];
    useStore.getState().reorderComparisonSlots(reordered);
    expect(useStore.getState().comparisonSlots).toEqual(reordered);
  });

  // ─── Streaming ──────────────────────────────────────────────────────────────

  it('setStreamStatus updates stream status', () => {
    useStore.getState().setStreamStatus('connected');
    expect(useStore.getState().streamStatus).toBe('connected');
  });

  it('addStreamLedger prepends ledger and caps at 50', () => {
    for (let i = 0; i < 55; i++) {
      useStore.getState().addStreamLedger({ sequence: i });
    }
    const ledgers = useStore.getState().streamLedgers;
    expect(ledgers).toHaveLength(50);
    expect(ledgers[0].sequence).toBe(54);
  });

  it('addStreamLedger deduplicates by sequence', () => {
    useStore.getState().addStreamLedger({ sequence: 1 });
    useStore.getState().addStreamLedger({ sequence: 1 });
    expect(useStore.getState().streamLedgers).toHaveLength(1);
  });

  it('clearStreamLedgers empties the list', () => {
    useStore.getState().addStreamLedger({ sequence: 1 });
    useStore.getState().clearStreamLedgers();
    expect(useStore.getState().streamLedgers).toHaveLength(0);
  });

  it('setStreamError stores the error', () => {
    useStore.getState().setStreamError('connection lost');
    expect(useStore.getState().streamError).toBe('connection lost');
  });
});
