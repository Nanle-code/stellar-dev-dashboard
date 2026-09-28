/**
 * useSharedView — the URL ⇄ store bridge for shared links.
 *
 * This is the code that makes a shared link actually *rebuild* a view, and the
 * code that decides whether the recipient needs warning. It is therefore tested
 * against the store directly rather than through the rendered UI.
 *
 * `react-router-dom` is mocked so a test can declare a URL and assert on the
 * navigation the hook performs, without standing up a router.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockNavigate = vi.fn();
let mockLocation = { pathname: '/transactions', search: '' };

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

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
  accountRequests: {
    abortAll: vi.fn(),
    begin: vi.fn(() => ({ active: true, commit: vi.fn(() => true), abort: vi.fn() })),
  },
  AccountLanes: { Connect: 'a', Offers: 'b', CreationDate: 'c' },
  isCancellation: vi.fn(() => false),
  isStaleRequestError: vi.fn(() => false),
  StaleRequestError: class StaleRequestError extends Error {},
}));

import { useStore } from '../../../src/lib/store';
import { DEFAULT_SEARCH_FILTERS } from '../../../src/lib/store';
import { useSharedView } from '../../../src/hooks/useSharedView';
import { SHARE_PARAMS } from '../../../src/lib/shareLinks';

const BASELINE = useStore.getState();
const KNOWN_TABS = ['overview', 'transactions', 'contracts', 'network', 'account'];
const CONTRACT = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

function openAt(pathname: string, search: string): void {
  mockLocation = { pathname, search };
}

beforeEach(() => {
  useStore.setState(BASELINE, true);
  mockNavigate.mockClear();
  localStorage.clear();
  openAt('/transactions', '');
});

describe('useSharedView — primary flow', () => {
  it('applies tab, entity and ledger pin, and reports the network mismatch', () => {
    // `transactions` is a Horizon-backed route, so a pin here is enforceable
    // and the link decodes without warnings.
    const query =
      `?${SHARE_PARAMS.network}=mainnet&${SHARE_PARAMS.tab}=transactions` +
      `&${SHARE_PARAMS.entity}=contract:${CONTRACT}&${SHARE_PARAMS.ledger}=7788`;

    useStore.setState({ network: 'testnet', activeTab: 'overview' });
    openAt('/transactions', query);

    const { result } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    // The view is rebuilt…
    expect(useStore.getState().activeTab).toBe('transactions');
    expect(useStore.getState().contractId).toBe(CONTRACT);
    expect(useStore.getState().ledgerPin).toBe(7788);

    // …but the recipient's network is left alone so the mismatch is reported
    // rather than silently erased.
    expect(useStore.getState().network).toBe('testnet');
    expect(result.current.networkMismatch).toBe(true);
    expect(result.current.snapshotNetwork).toBe('mainnet');

    expect(result.current.isSharedView).toBe(true);
    expect(result.current.ledgerSupport.honoured).toBe(true);
    expect(result.current.warnings).toEqual([]);
  });

  it('does not auto-switch the recipient network when the link came from elsewhere', () => {
    useStore.setState({ network: 'futurenet' });
    openAt('/transactions', `?${SHARE_PARAMS.network}=testnet&${SHARE_PARAMS.tab}=transactions`);

    renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    // A silent switch here would refetch everything under a network the
    // recipient never chose, and would leave nothing for the banner to report.
    expect(useStore.getState().network).toBe('futurenet');
  });

  it('applies the viewed account but never the signing wallet', () => {
    const ACCOUNT = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
    useStore.setState({
      network: 'testnet',
      connectedAddress: null,
      walletPublicKey: 'GWALLETKEYSHOULDNEVERBEAPPLIED',
    });
    openAt(
      '/account',
      `?${SHARE_PARAMS.network}=testnet&${SHARE_PARAMS.tab}=account&${SHARE_PARAMS.entity}=account:${ACCOUNT}`
    );

    const { result } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    expect(useStore.getState().connectedAddress).toBe(ACCOUNT);
    expect(useStore.getState().walletPublicKey).toBe('GWALLETKEYSHOULDNEVERBEAPPLIED');
    expect(result.current.warnings).toEqual([]);
  });

  it('warns rather than silently dropping an entity it cannot restore', () => {
    const TX = 'a'.repeat(64);
    useStore.setState({ network: 'testnet' });
    openAt(
      '/transactions',
      `?${SHARE_PARAMS.network}=testnet&${SHARE_PARAMS.tab}=transactions&${SHARE_PARAMS.entity}=tx:${TX}`
    );

    const { result } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    // The link is valid, but the store has no selected-transaction field, so
    // the recipient must be told the view was not fully reproduced.
    expect(result.current.warnings).toContain('entity-not-applied:tx');
  });

  it('navigates to the link route, carrying the share params across', () => {
    // `RouterSync` is not mounted, so nothing else corrects a view whose tab no
    // longer matches the path. A link must not render `transactions` while the
    // address bar still reads `/`.
    const query = `?${SHARE_PARAMS.network}=testnet&${SHARE_PARAMS.tab}=transactions`;
    openAt('/', query);

    renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/transactions', search: query },
      { replace: true }
    );
  });

  it('does not navigate when the link route already matches the path', () => {
    const query = `?${SHARE_PARAMS.network}=testnet&${SHARE_PARAMS.tab}=transactions`;
    openAt('/transactions', query);

    renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('adopts the link network on request from the banner', () => {
    useStore.setState({ network: 'futurenet' });
    openAt('/transactions', `?${SHARE_PARAMS.network}=testnet&${SHARE_PARAMS.tab}=transactions`);

    const { result } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    expect(result.current.networkMismatch).toBe(true);
    act(() => result.current.switchToSnapshotNetwork());

    expect(useStore.getState().network).toBe('testnet');
    expect(result.current.networkMismatch).toBe(false);
  });

  it('applies non-default filters but leaves defaults alone when the link has none', () => {
    openAt(
      '/transactions',
      `?${SHARE_PARAMS.tab}=transactions&${SHARE_PARAMS.filters}=${encodeURIComponent(
        JSON.stringify({ f: { status: 'failed', minFee: '250' } })
      )}`
    );

    const { rerender } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));
    expect(useStore.getState().searchFilters).toMatchObject({ status: 'failed', minFee: '250' });

    // A link with no `f=` must not wipe filters the recipient already had.
    useStore.getState().setSearchFilters({ status: 'failed', minFee: '999' });
    openAt('/transactions', `?${SHARE_PARAMS.tab}=transactions`);
    rerender();

    expect(useStore.getState().searchFilters).toMatchObject({ status: 'failed', minFee: '999' });
  });

  it('exits the shared view by stripping the share params from the URL', () => {
    openAt(
      '/transactions',
      `?ref=incident-42&${SHARE_PARAMS.tab}=transactions&${SHARE_PARAMS.network}=testnet`
    );

    const { result } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));
    act(() => result.current.exitSharedView());

    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/transactions', search: '?ref=incident-42' },
      { replace: true }
    );
    expect(useStore.getState().ledgerPin).toBeNull();
  });

  it('does nothing for a URL that is not a shared view', () => {
    useStore.setState({ network: 'mainnet', activeTab: 'overview', contractId: CONTRACT });
    openAt('/overview', '?ref=incident-42');

    const { result } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    expect(result.current.isSharedView).toBe(false);
    expect(result.current.snapshot).toBeNull();
    expect(result.current.networkMismatch).toBe(false);
    expect(useStore.getState().network).toBe('mainnet');
    expect(useStore.getState().contractId).toBe(CONTRACT);
    expect(useStore.getState().searchFilters).toEqual(DEFAULT_SEARCH_FILTERS);
  });
});

describe('useSharedView — boundaries', () => {
  it('never touches wallet or session state, whatever the link says', () => {
    useStore.setState({
      walletConnected: true,
      walletType: 'freighter',
      walletPublicKey: 'GCZRBC5BJLNWXFZAKTWWY2UEIMMZVW64MHS5KOCEWIQ2EPIKY2QOXZYV',
      sessionRecordingId: 'sess_9f2c1a',
      multiSigMode: true,
      connectedAddress: 'GB6OWYST45X57HCJY5XWOHDEBULB6XUROWPIKW77L5DSNANBEQGUPADT2',
    });

    openAt(
      '/transactions',
      `?${SHARE_PARAMS.tab}=transactions&${SHARE_PARAMS.network}=testnet` +
        `&walletPublicKey=GCZRBC5BJLNWXFZAKTWWY2UEIMMZVW64MHS5KOCEWIQ2EPIKY2QOXZYV` +
        `&sessionId=sess_9f2c1a&secretSeed=SCEU7SUXZDXHRUJP6BKQTL6JSTBZULHRMWKOMZX3ZOFYAWGE6VM55FN2`
    );

    const { result } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    // A link describes what to look at, never who you are.
    const state = useStore.getState();
    expect(state.walletConnected).toBe(true);
    expect(state.walletType).toBe('freighter');
    expect(state.walletPublicKey).toBe('GCZRBC5BJLNWXFZAKTWWY2UEIMMZVW64MHS5KOCEWIQ2EPIKY2QOXZYV');
    expect(state.sessionRecordingId).toBe('sess_9f2c1a');
    expect(state.connectedAddress).toBe('GB6OWYST45X57HCJY5XWOHDEBULB6XUROWPIKW77L5DSNANBEQGUPADT2');
    // Unknown params are ignored, not reflected back.
    expect(result.current.warnings).not.toContain('wallet');
  });

  it('keeps a pin it cannot enforce, and says so', () => {
    openAt('/contracts', `?${SHARE_PARAMS.tab}=contracts&${SHARE_PARAMS.ledger}=4242`);

    const { result } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    expect(result.current.ledgerPin).toBe(4242);
    expect(result.current.ledgerSupport.honoured).toBe(false);
    expect(result.current.warnings).toContain('ledger-pin-not-honoured');
  });

  it('applies the snapshot once per URL rather than on every render', () => {
    // The link pins a minimum fee. Once applied, the recipient's own edits to
    // that field must survive subsequent re-renders.
    openAt(
      '/network',
      `?${SHARE_PARAMS.tab}=network&${SHARE_PARAMS.network}=testnet&${SHARE_PARAMS.filters}=${encodeURIComponent(
        JSON.stringify({ f: { minFee: '100' } })
      )}`
    );

    const { rerender } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));
    expect(useStore.getState().searchFilters.minFee).toBe('100');

    act(() => useStore.getState().setSearchFilters({ minFee: '42' }));
    rerender();
    rerender();

    // A re-apply would have stomped this back to the link's value.
    expect(useStore.getState().searchFilters.minFee).toBe('42');
  });

  it('falls back to the overview for a tab this build does not know', () => {
    openAt('/transactions', `?${SHARE_PARAMS.tab}=quantumLedger`);

    const { result } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    expect(result.current.warnings).toContain('unknown-tab');
    expect(result.current.snapshot?.tab).toBe('overview');
  });
});

describe('useSharedView — failure handling', () => {
  it('opens a usable view when the filter payload is corrupt', () => {
    openAt(
      '/transactions',
      `?${SHARE_PARAMS.tab}=transactions&${SHARE_PARAMS.network}=testnet&${SHARE_PARAMS.filters}=%7Bbroken`
    );

    const { result } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    expect(result.current.isSharedView).toBe(true);
    expect(result.current.snapshot?.tab).toBe('transactions');
    expect(result.current.warnings).toContain('unparseable-filters');
  });

  it('discards an out-of-range ledger instead of pinning to nonsense', () => {
    openAt('/transactions', `?${SHARE_PARAMS.tab}=transactions&${SHARE_PARAMS.ledger}=99999999999999999999`);

    const { result } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    expect(useStore.getState().ledgerPin).toBeNull();
    expect(result.current.ledgerPin).toBeNull();
    expect(result.current.warnings).toContain('invalid-ledger-sequence');
  });

  it('treats an unparseable search string as no shared view', () => {
    openAt('/transactions', '?%E0%A4%A');

    const { result } = renderHook(() => useSharedView({ knownTabs: KNOWN_TABS }));

    // Either the params decode to nothing meaningful, or the URL is rejected
    // outright. Both must leave the recipient on a working view.
    expect(result.current.isSharedView).toBe(false);
    expect(useStore.getState().activeTab).toBe('overview');
  });
});
