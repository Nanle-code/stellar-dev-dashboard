/**
 * ThemeToggle tests (#266)
 *
 * The header dark-mode toggle must be keyboard-accessible, expose the
 * correct pressed state/label, and persist the choice (store writes the
 * `stellar-dashboard-theme` key and flips `data-theme`).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  accountRequests: { abortAll: vi.fn(), begin: vi.fn(() => ({ active: true, commit: vi.fn(() => true), abort: vi.fn() })) },
  AccountLanes: { Connect: 'account:connect', Offers: 'account:offers', CreationDate: 'account:creation-date' },
  isCancellation: vi.fn(() => false),
  isStaleRequestError: vi.fn(() => false),
  StaleRequestError: class StaleRequestError extends Error {},
}));

import { useStore } from '../../lib/store';
import ThemeToggle from './ThemeToggle';

const BASELINE = useStore.getState();

function resetStore() {
  useStore.setState(BASELINE, true);
}

describe('ThemeToggle (#266)', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('reflects the current theme in aria-pressed and aria-label', () => {
    useStore.setState({ theme: 'light' });
    const { rerender } = render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toHaveAttribute('aria-pressed', 'false');

    useStore.setState({ theme: 'dark' });
    rerender(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles the theme on click and persists it across sessions', async () => {
    const user = userEvent.setup();
    useStore.setState({ theme: 'light' });
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button'));

    expect(useStore.getState().theme).toBe('dark');
    // Persisted for the next session …
    expect(localStorage.getItem('stellar-dashboard-theme')).toBe('dark');
    // … and applied to the document immediately.
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles exactly once per keyboard activation (Enter / Space)', async () => {
    const user = userEvent.setup();
    useStore.setState({ theme: 'light' });
    render(<ThemeToggle />);
    const button = screen.getByRole('button');

    button.focus();
    await user.keyboard('{Enter}');
    expect(useStore.getState().theme).toBe('dark');

    await user.keyboard(' ');
    expect(useStore.getState().theme).toBe('light');
  });
});
