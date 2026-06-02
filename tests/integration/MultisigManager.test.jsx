import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as StellarSdk from '@stellar/stellar-sdk';

vi.mock('../../src/lib/storage', () => ({
  getStoredValue: vi.fn().mockResolvedValue(null),
  setStoredValue: vi.fn(),
}));
vi.mock('../../src/utils/stateSync', () => ({
  broadcastStateChange: vi.fn(),
  onStateChange: vi.fn(),
  syncState: vi.fn().mockResolvedValue(undefined),
  loadSyncedState: vi.fn().mockResolvedValue(null),
  resolveStateConflict: vi.fn((local) => local),
  getTabId: vi.fn().mockReturnValue('test-tab'),
}));
vi.mock('../../src/hooks/useNotifications', () => ({
  useNotifications: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));
vi.mock('../../src/lib/stellar', async () => {
  const actual = await vi.importActual('../../src/lib/stellar');
  return {
    ...actual,
    fetchAccount: vi.fn().mockResolvedValue(
      new StellarSdk.Account(StellarSdk.Keypair.random().publicKey(), '0')
    ),
  };
});

import { useStore } from '../../src/lib/store';
import MultisigManager from '../../src/components/multisig/MultisigManager';

describe('MultisigManager (integration)', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({
      connectedAddress: 'GABC123TESTADDRESS',
      accountData: null,
      network: 'testnet',
    }, false);
  });

  it('renders the page header', () => {
    render(<MultisigManager />);
    expect(screen.getByText('Multi-Signature')).toBeInTheDocument();
  });

  it('renders Setup and Sessions tabs', () => {
    render(<MultisigManager />);
    expect(screen.getByRole('button', { name: /setup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sessions/i })).toBeInTheDocument();
  });

  it('shows Setup panel by default', () => {
    render(<MultisigManager />);
    expect(screen.getByText('Thresholds')).toBeInTheDocument();
  });

  it('switches to Sessions panel when Sessions tab clicked', () => {
    render(<MultisigManager />);
    fireEvent.click(screen.getByRole('button', { name: /sessions/i }));
    expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument();
  });

  it('switches back to Setup when Setup tab clicked', () => {
    render(<MultisigManager />);
    fireEvent.click(screen.getByRole('button', { name: /sessions/i }));
    fireEvent.click(screen.getByRole('button', { name: /setup/i }));
    expect(screen.getByText('Thresholds')).toBeInTheDocument();
  });
});
