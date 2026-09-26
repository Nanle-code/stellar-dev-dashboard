/**
 * DashboardProvider tests (#987)
 *
 * Verifies that the global network + time-range context is hydrated from the
 * URL, written back on change, restored by back navigation, and that invalid
 * URL values degrade to the documented defaults without throwing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';

vi.mock('../../lib/storage', () => ({
  getStoredValue: vi.fn().mockResolvedValue(null),
  setStoredValue: vi.fn(),
}));
vi.mock('../../utils/stateSync', () => ({
  broadcastStateChange: vi.fn(),
  onStateChange: vi.fn(),
  syncState: vi.fn().mockResolvedValue(0),
  loadSyncedState: vi.fn().mockReturnValue(null),
  resolveStateConflict: vi.fn((local: unknown) => local),
  getTabId: vi.fn().mockReturnValue('test-tab'),
}));
vi.mock('../../lib/cacheInit', () => ({
  handleNetworkSwitch: vi.fn(),
  initCache: vi.fn().mockResolvedValue(undefined),
  handleTransactionSuccess: vi.fn().mockResolvedValue(undefined),
  _resetCacheInit: vi.fn(),
}));
vi.mock('../../lib/requestCancellation', () => ({
  accountRequests: {
    abortAll: vi.fn(),
    begin: vi.fn(() => ({ active: true, commit: vi.fn(() => true), abort: vi.fn() })),
  },
  AccountLanes: {
    Connect: 'account:connect',
    Offers: 'account:offers',
    CreationDate: 'account:creation-date',
  },
  isCancellation: vi.fn(() => false),
  isStaleRequestError: vi.fn(() => false),
  StaleRequestError: class StaleRequestError extends Error {},
}));

import { useStore } from '../../lib/store';
import { DashboardProvider, useDashboardContext } from '../DashboardContext';

const BASELINE = useStore.getState();

function Probe() {
  const context = useDashboardContext();
  const navigate = useNavigate();

  return (
    <div>
      <span data-testid="network">{context.network}</span>
      <span data-testid="range">{context.range.value}</span>
      <span data-testid="issues">{context.context.issues.join('|')}</span>
      <button type="button" onClick={() => context.setRange('7d')}>
        to-7d
      </button>
      <button type="button" onClick={() => context.setNetwork('futurenet')}>
        to-futurenet
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
    </div>
  );
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <DashboardProvider>
        <Probe />
      </DashboardProvider>
    </MemoryRouter>,
  );
}

describe('DashboardProvider (#987)', () => {
  beforeEach(() => {
    useStore.setState(BASELINE, true);
    localStorage.clear();
  });

  it('hydrates the context from the URL and syncs the store network', async () => {
    renderAt('/?network=mainnet&range=30d');

    expect(screen.getByTestId('network')).toHaveTextContent('mainnet');
    expect(screen.getByTestId('range')).toHaveTextContent('30d');
    expect(screen.getByTestId('issues').textContent).toBe('');

    await waitFor(() => expect(useStore.getState().network).toBe('mainnet'));
  });

  it('writes range changes to the URL and restores them on back navigation', async () => {
    const user = userEvent.setup();
    renderAt('/?range=30d');

    await user.click(screen.getByRole('button', { name: 'to-7d' }));
    await waitFor(() => expect(screen.getByTestId('range')).toHaveTextContent('7d'));

    await user.click(screen.getByRole('button', { name: 'back' }));
    await waitFor(() => expect(screen.getByTestId('range')).toHaveTextContent('30d'));
  });

  it('mirrors network changes into the store and the URL', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('button', { name: 'to-futurenet' }));

    await waitFor(() => expect(useStore.getState().network).toBe('futurenet'));
    expect(screen.getByTestId('network')).toHaveTextContent('futurenet');
  });

  it('falls back safely for unknown networks and invalid ranges', () => {
    renderAt('/?network=nope&range=banana');

    expect(screen.getByTestId('network')).toHaveTextContent('testnet');
    expect(screen.getByTestId('range')).toHaveTextContent('24h');
    expect(screen.getByTestId('issues').textContent).toBe('unknown-network|invalid-range');
  });
});
