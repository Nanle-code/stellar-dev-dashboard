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

import { useStore } from '../../../src/lib/store';

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
