import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { useStore } from '../../../src/lib/store';
import WalletIdlePrompt from '../../../src/components/security/WalletIdlePrompt';
import { IDLE_TIMEOUT_REVOKE_REASON } from '../../../src/lib/wallet/idleTimeout';
import { disconnectWalletConnect } from '../../../src/lib/wallet/walletconnect';

// store.ts imports cacheInit and requestCancellation — mock both so the
// cache stack does not load in jsdom.
vi.mock('../../../src/lib/storage', () => ({
  getStoredValue: vi.fn().mockResolvedValue(null),
  setStoredValue: vi.fn(),
}));
vi.mock('../../../src/utils/stateSync', () => ({
  broadcastStateChange: vi.fn(),
  onStateChange: vi.fn(),
  syncState: vi.fn().mockResolvedValue(0),
  loadSyncedState: vi.fn().mockReturnValue(null),
  resolveStateConflict: vi.fn((local: unknown) => local),
  getTabId: vi.fn().mockReturnValue('test-tab'),
}));
vi.mock('../../../src/lib/cacheInit', () => ({
  handleNetworkSwitch: vi.fn(),
  initCache: vi.fn().mockResolvedValue(undefined),
  handleTransactionSuccess: vi.fn().mockResolvedValue(undefined),
  _resetCacheInit: vi.fn(),
}));
vi.mock('../../../src/lib/requestCancellation', () => ({
  accountRequests: { abortAll: vi.fn(), begin: vi.fn(() => ({ active: true, commit: vi.fn(() => true), abort: vi.fn() })) },
  AccountLanes: { Connect: 'account:connect', Offers: 'account:offers', CreationDate: 'account:creation-date' },
  isCancellation: vi.fn(() => false),
  isStaleRequestError: vi.fn(() => false),
  StaleRequestError: class StaleRequestError extends Error {},
}));
vi.mock('../../../src/lib/wallet/walletconnect', () => ({
  disconnectWalletConnect: vi.fn().mockResolvedValue(undefined),
}));

const MINUTE = 60_000;
const PUBLIC_KEY = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

function connect(minutes: number, walletType = 'freighter') {
  useStore.setState({
    walletConnected: true,
    walletType,
    walletPublicKey: PUBLIC_KEY,
    connectedAddress: PUBLIC_KEY,
    walletSessionRevokedReason: null,
    walletIdleTimeoutMinutes: minutes,
  });
}

describe('WalletIdlePrompt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useStore.setState({ walletConnected: false, walletType: null, walletPublicKey: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('prompts before disconnecting, then revokes the session on timeout (primary flow)', () => {
    connect(5);
    render(<WalletIdlePrompt />);
    expect(screen.queryByRole('alertdialog')).toBeNull();

    act(() => void vi.advanceTimersByTime(4 * MINUTE));
    const dialog = screen.getByRole('alertdialog', { name: 'Still there?' });
    expect(dialog).toHaveTextContent('1:00');
    expect(screen.getByRole('button', { name: 'Stay connected' })).toHaveFocus();

    act(() => void vi.advanceTimersByTime(30_000));
    expect(dialog).toHaveTextContent('30s');

    act(() => void vi.advanceTimersByTime(30_000));
    const state = useStore.getState();
    expect(state.walletConnected).toBe(false);
    expect(state.connectedAddress).toBeNull();
    expect(state.walletSessionRevokedReason).toBe(IDLE_TIMEOUT_REVOKE_REASON);
    expect(screen.getByTestId('wallet-idle-expired')).toHaveTextContent('5 minutes of inactivity');

    const audit = JSON.parse(localStorage.getItem('wallet-security-audit-log') ?? '[]');
    expect(audit[0]).toMatchObject({ action: 'wallet_idle_timeout', status: 'warning' });
  });

  it('"Stay connected" keeps the wallet connected and restarts the countdown', () => {
    connect(5);
    render(<WalletIdlePrompt />);
    act(() => void vi.advanceTimersByTime(4 * MINUTE));

    fireEvent.click(screen.getByRole('button', { name: 'Stay connected' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    act(() => void vi.advanceTimersByTime(4 * MINUTE - 1));
    expect(useStore.getState().walletConnected).toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('"Disconnect now" disconnects immediately and releases a WalletConnect relay', () => {
    connect(5, 'walletconnect');
    render(<WalletIdlePrompt />);
    act(() => void vi.advanceTimersByTime(4 * MINUTE));

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect now' }));
    expect(useStore.getState().walletConnected).toBe(false);
    expect(disconnectWalletConnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('uses a 30s warning for the minimum 1-minute timeout (boundary)', () => {
    connect(1);
    render(<WalletIdlePrompt />);

    act(() => void vi.advanceTimersByTime(29_999));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('30s');
  });

  it('does nothing when the timeout is off or no wallet is connected', () => {
    connect(0);
    const { unmount } = render(<WalletIdlePrompt />);
    act(() => void vi.advanceTimersByTime(300 * MINUTE));
    expect(useStore.getState().walletConnected).toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    unmount();

    useStore.setState({ walletConnected: false, walletIdleTimeoutMinutes: 1 });
    render(<WalletIdlePrompt />);
    act(() => void vi.advanceTimersByTime(10 * MINUTE));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByTestId('wallet-idle-expired')).toBeNull();
  });

  it('closes an open warning if the wallet is disconnected elsewhere (failure path)', () => {
    connect(5);
    render(<WalletIdlePrompt />);
    act(() => void vi.advanceTimersByTime(4 * MINUTE));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    act(() => useStore.getState().revokeWalletSession('wallet_locked'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(useStore.getState().walletSessionRevokedReason).toBe('wallet_locked');
  });

  it('store setter normalizes and persists invalid configuration', () => {
    act(() => useStore.getState().setWalletIdleTimeoutMinutes('not-a-number'));
    expect(useStore.getState().walletIdleTimeoutMinutes).toBe(15);
    act(() => useStore.getState().setWalletIdleTimeoutMinutes(10_000));
    expect(useStore.getState().walletIdleTimeoutMinutes).toBe(240);
    expect(localStorage.getItem('stellar-dash:wallet-idle-timeout-minutes')).toBe('240');
  });
});
