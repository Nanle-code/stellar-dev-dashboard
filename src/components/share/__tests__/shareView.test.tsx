/**
 * Shared-view UI: the mismatch banner and the Share action.
 *
 * The banner is the recipient's only warning that they are not looking at what
 * the sender saw, so it gets explicit tests for the mismatch case, the
 * no-mismatch case, and the "pin recorded but not enforceable" case. The Share
 * panel is tested for the guarantee that matters most: the URL it hands the user
 * is free of wallet and session material.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../lib/storage', () => ({
  getStoredValue: vi.fn().mockResolvedValue(null),
  setStoredValue: vi.fn(),
}));
vi.mock('../../../utils/stateSync', () => ({
  broadcastStateChange: vi.fn(),
  onStateChange: vi.fn(),
  syncState: vi.fn().mockResolvedValue(0),
  loadSyncedState: vi.fn().mockReturnValue(null),
  resolveStateConflict: vi.fn((local: unknown) => local),
  getTabId: vi.fn().mockReturnValue('test-tab'),
}));
vi.mock('../../../lib/cacheInit', () => ({
  handleNetworkSwitch: vi.fn(),
  initCache: vi.fn().mockResolvedValue(undefined),
  handleTransactionSuccess: vi.fn().mockResolvedValue(undefined),
  _resetCacheInit: vi.fn(),
}));
vi.mock('../../../lib/requestCancellation', () => ({
  accountRequests: {
    abortAll: vi.fn(),
    begin: vi.fn(() => ({ active: true, commit: vi.fn(() => true), abort: vi.fn() })),
  },
  AccountLanes: { Connect: 'a', Offers: 'b', CreationDate: 'c' },
  isCancellation: vi.fn(() => false),
  isStaleRequestError: vi.fn(() => false),
  StaleRequestError: class StaleRequestError extends Error {},
}));

import { useStore, type LedgerStatsEntry } from '../../../lib/store';
import {
  findSecretLikeContent,
  SHARE_PARAMS,
  type ViewSnapshot,
} from '../../../lib/shareLinks';
import type { SharedView } from '../../../hooks/useSharedView';
import SharedViewBanner from '../SharedViewBanner';
import ShareViewButton from '../ShareViewButton';

const BASELINE = useStore.getState();
const ACCOUNT = 'GCZRBC5BJLNWXFZAKTWWY2UEIMMZVW64MHS5KOCEWIQ2EPIKY2QOXZYV';
const WALLET_KEY = 'GB6OWYST45X57HCJY5XWOHDEBULB6XUROWPIKW77L5DSNANBEQGUPADT2';

function resetStore(): void {
  useStore.setState(BASELINE, true);
}

function makeSnapshot(overrides: Partial<ViewSnapshot> = {}): ViewSnapshot {
  return {
    version: 1,
    network: 'testnet',
    tab: 'transactions',
    entity: null,
    filters: {},
    expressions: [],
    ledger: null,
    ...overrides,
  };
}

function makeView(overrides: Partial<SharedView> = {}): SharedView {
  const snapshot = overrides.snapshot ?? makeSnapshot();
  const activeNetwork = overrides.activeNetwork ?? 'testnet';
  return {
    snapshot,
    warnings: [],
    isSharedView: true,
    snapshotNetwork: snapshot?.network ?? null,
    networkMismatch: snapshot?.network !== activeNetwork,
    activeNetwork,
    ledgerSupport: { honoured: true, strategy: 'cursor', note: 'paging cursor' },
    ledgerPin: null,
    exitSharedView: vi.fn(),
    switchToSnapshotNetwork: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  resetStore();
  localStorage.clear();
});

// ─── Network mismatch banner ──────────────────────────────────────────────────

/** Minimal `LedgerStatsEntry`; the pin only ever reads `sequence`. */
const ledger = (sequence: number): LedgerStatsEntry => ({
  sequence,
  closedAt: '2026-01-01T00:00:00Z',
  baseFee: 100,
  operationCount: 1,
  txSuccessCount: 1,
  txFailedCount: 0,
});

describe('SharedViewBanner', () => {
  it('warns when the link was captured on a different network, and offers the fix', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    const view = makeView({ snapshot: makeSnapshot({ network: 'testnet' }), activeNetwork: 'mainnet' });

    render(<SharedViewBanner view={view} onExit={vi.fn()} onSwitchNetwork={onSwitch} />);

    const banner = screen.getByTestId('shared-view-banner');
    // An interrupted view is an alert, not a passing status.
    expect(banner).toHaveAttribute('role', 'alert');

    const mismatch = screen.getByTestId('shared-view-network-mismatch');
    expect(mismatch).toHaveTextContent('Testnet');
    expect(mismatch).toHaveTextContent('Mainnet');
    // Make clear the data on screen is NOT from the link's network.
    expect(mismatch).toHaveTextContent(/results below are from/i);

    await user.click(screen.getByTestId('shared-view-switch-network'));
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('does not render at all when there is no active shared view', () => {
    const view = makeView({ isSharedView: false, snapshot: null, networkMismatch: false });
    const { container } = render(
      <SharedViewBanner view={view} onExit={vi.fn()} onSwitchNetwork={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a quiet confirmation when the network already matches', () => {
    const view = makeView({ snapshot: makeSnapshot({ network: 'mainnet' }), activeNetwork: 'mainnet' });
    render(<SharedViewBanner view={view} onExit={vi.fn()} onSwitchNetwork={vi.fn()} />);

    expect(screen.getByTestId('shared-view-banner')).toHaveAttribute('role', 'status');
    expect(screen.queryByTestId('shared-view-network-mismatch')).toBeNull();
    // No pointless "switch to mainnet" button when already on mainnet.
    expect(screen.queryByTestId('shared-view-switch-network')).toBeNull();
  });

  it('states plainly that a pin is not enforced where no historical read exists', () => {
    const view = makeView({
      snapshot: makeSnapshot({ tab: 'contracts', ledger: 4242 }),
      activeNetwork: 'testnet',
      ledgerPin: 4242,
      ledgerSupport: {
        honoured: false,
        strategy: 'none',
        note: 'This data source has no historical read, so live data is shown.',
      },
    });
    render(<SharedViewBanner view={view} onExit={vi.fn()} onSwitchNetwork={vi.fn()} />);

    const banner = screen.getByTestId('shared-view-banner');
    expect(banner).toHaveTextContent('4242');
    expect(banner).toHaveTextContent(/recorded for reference only/i);
    expect(banner).toHaveTextContent(/no historical read/i);
  });

  it('exits the shared view on request', async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(<SharedViewBanner view={makeView()} onExit={onExit} onSwitchNetwork={vi.fn()} />);

    await user.click(screen.getByTestId('shared-view-exit'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

// ─── Share action ─────────────────────────────────────────────────────────────

describe('ShareViewButton', () => {
  it('produces a link that rebuilds the current view', async () => {
    const user = userEvent.setup();
    useStore.setState({
      network: 'mainnet',
      activeTab: 'transactions',
      connectedAddress: ACCOUNT,
      contractId: '',
    });

    render(<ShareViewButton base="https://dash.example/transactions" />);
    await user.click(screen.getByTestId('share-view-button'));

    const input = screen.getByTestId('share-view-url') as HTMLInputElement;
    const url = new URL(input.value);
    expect(url.searchParams.get(SHARE_PARAMS.network)).toBe('mainnet');
    expect(url.searchParams.get(SHARE_PARAMS.tab)).toBe('transactions');
    expect(url.searchParams.get(SHARE_PARAMS.entity)).toBe(`account:${ACCOUNT}`);
  });

  it('puts no wallet or session data in the link it hands the user', async () => {
    const user = userEvent.setup();
    useStore.setState({
      network: 'testnet',
      activeTab: 'transactions',
      connectedAddress: ACCOUNT,
      contractId: '',
      // Every field that must stay in the browser.
      walletConnected: true,
      walletType: 'freighter',
      walletPublicKey: WALLET_KEY,
      sessionRecordingActive: true,
      sessionRecordingId: 'sess_9f2c1a',
      multiSigMode: true,
    });

    render(<ShareViewButton base="https://dash.example/transactions" />);
    await user.click(screen.getByTestId('share-view-button'));

    const url = (screen.getByTestId('share-view-url') as HTMLInputElement).value;

    expect(findSecretLikeContent(url)).toEqual([]);
    expect(url).not.toContain(WALLET_KEY);
    expect(url).not.toContain('sess_9f2c1a');
    expect(url).not.toContain('freighter');
    for (const forbidden of ['wallet', 'session', 'token', 'signer', 'multisig']) {
      expect(url.toLowerCase()).not.toContain(`${forbidden}=`);
    }
  });

  it('adds the ledger sequence only when the pin is ticked and the route can enforce it', async () => {
    const user = userEvent.setup();
    useStore.setState({
      network: 'testnet',
      activeTab: 'transactions',
      contractId: '',
      connectedAddress: null,
      ledgerHistory: [ledger(12_345)],
    });

    render(<ShareViewButton base="https://dash.example/transactions" />);
    await user.click(screen.getByTestId('share-view-button'));

    const read = () => (screen.getByTestId('share-view-url') as HTMLInputElement).value;
    const pin = screen.getByTestId('share-view-pin-ledger') as HTMLInputElement;

    expect(pin).toBeEnabled();
    expect(new URL(read()).searchParams.has(SHARE_PARAMS.ledger)).toBe(false);

    await user.click(pin);
    expect(new URL(read()).searchParams.get(SHARE_PARAMS.ledger)).toBe('12345');
  });

  it('disables the pin when no ledger sequence is known, rather than faking one', async () => {
    const user = userEvent.setup();
    useStore.setState({
      network: 'testnet',
      activeTab: 'transactions',
      contractId: '',
      connectedAddress: null,
      ledgerHistory: [],
      streamLedgers: [],
    });

    render(<ShareViewButton base="https://dash.example/transactions" />);
    await user.click(screen.getByTestId('share-view-button'));

    const pin = screen.getByTestId('share-view-pin-ledger') as HTMLInputElement;
    expect(pin).toBeDisabled();
    expect(screen.getByText(/pinned via a horizon paging cursor/i)).toBeInTheDocument();
  });

  it('disables the pin on a Soroban route that cannot honour one', async () => {
    const user = userEvent.setup();
    useStore.setState({
      network: 'testnet',
      activeTab: 'contracts',
      contractId: '',
      connectedAddress: null,
      ledgerHistory: [ledger(99)],
    });

    render(<ShareViewButton base="https://dash.example/contracts" />);
    await user.click(screen.getByTestId('share-view-button'));

    expect(screen.getByTestId('share-view-pin-ledger')).toBeDisabled();
    expect(screen.getByText(/no historical read/i)).toBeInTheDocument();
    // And the emitted link carries no pin that would imply otherwise.
    const url = (screen.getByTestId('share-view-url') as HTMLInputElement).value;
    expect(new URL(url).searchParams.has(SHARE_PARAMS.ledger)).toBe(false);
  });

  it('copies the link and confirms it', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    useStore.setState({ network: 'testnet', activeTab: 'overview', contractId: '', connectedAddress: null });
    render(<ShareViewButton base="https://dash.example/overview" />);
    await user.click(screen.getByTestId('share-view-button'));
    await user.click(screen.getByTestId('share-view-copy'));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain(SHARE_PARAMS.tab);
    await waitFor(() => expect(screen.getByTestId('share-view-copy')).toHaveTextContent('Copied'));
  });

  it('reports a clipboard failure instead of silently claiming success', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });

    useStore.setState({ network: 'testnet', activeTab: 'overview', contractId: '', connectedAddress: null });
    render(<ShareViewButton base="https://dash.example/overview" />);
    await user.click(screen.getByTestId('share-view-button'));
    await user.click(screen.getByTestId('share-view-copy'));

    await waitFor(() => expect(screen.getByTestId('share-view-copy')).toHaveTextContent('Failed'));
  });

  it('shows a security note in the panel, and closes on Escape', async () => {
    const user = userEvent.setup();
    useStore.setState({ network: 'testnet', activeTab: 'overview', contractId: '', connectedAddress: null });
    render(<ShareViewButton base="https://dash.example/overview" />);

    await user.click(screen.getByTestId('share-view-button'));
    expect(screen.getByTestId('share-view-security-note')).toHaveTextContent(
      /no wallet keys, session tokens/i
    );

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('share-view-panel')).toBeNull());
  });
});
