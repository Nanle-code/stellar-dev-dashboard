import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as StellarSdk from '@stellar/stellar-sdk';

// Use a fixed test public key to avoid hoisting issues
const TEST_PUBLIC_KEY = 'GASUV7H3C246L2U7LEKOAZ3XDRFKMTRJMJFFIXGBA2S4YO675GKTBX6Y';

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

const mockSuccess = vi.fn();
const mockError = vi.fn();
vi.mock('../../src/hooks/useNotifications', () => ({
  useNotifications: () => ({ success: mockSuccess, error: mockError, warning: vi.fn() }),
}));
vi.mock('../../src/lib/stellar', async () => {
  const { Account } = await import('@stellar/stellar-sdk');
  return {
    fetchAccount: vi.fn().mockResolvedValue(
      new Account('GASUV7H3C246L2U7LEKOAZ3XDRFKMTRJMJFFIXGBA2S4YO675GKTBX6Y', '100')
    ),
    isValidPublicKey: (key) => {
      try { require('@stellar/stellar-sdk').Keypair.fromPublicKey(key); return true; } catch { return false; }
    },
    NETWORKS: {
      testnet: { passphrase: 'Test SDF Network ; September 2015' },
      mainnet: { passphrase: 'Public Global Stellar Network ; September 2015' },
    },
  };
});

import { useStore } from '../../src/lib/store';
import MultisigSetup from '../../src/components/multisig/MultisigSetup';

describe('MultisigSetup (integration)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockSuccess.mockClear();
    mockError.mockClear();
    useStore.setState({
      connectedAddress: TEST_PUBLIC_KEY,
      accountData: {
        id: TEST_PUBLIC_KEY,
        signers: [{ key: TEST_PUBLIC_KEY, weight: 1, type: 'ed25519_public_key' }],
        thresholds: { low_threshold: 1, med_threshold: 1, high_threshold: 1 },
      },
      network: 'testnet',
    }, false);
  });

  it('renders threshold inputs', () => {
    render(<MultisigSetup />);
    expect(screen.getByLabelText(/low threshold/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/medium threshold/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/high threshold/i)).toBeInTheDocument();
  });

  it('loads signers from accountData on mount', () => {
    render(<MultisigSetup />);
    expect(screen.getByDisplayValue(TEST_PUBLIC_KEY)).toBeInTheDocument();
  });

  it('adds a new signer row when "+ Add Signer" clicked', async () => {
    render(<MultisigSetup />);
    const before = screen.getAllByPlaceholderText(/G\.\.\. public key/i).length;
    fireEvent.click(screen.getByText('+ Add Signer'));
    const after = screen.getAllByPlaceholderText(/G\.\.\. public key/i).length;
    expect(after).toBe(before + 1);
  });

  it('shows validation error when high threshold exceeds total weight', async () => {
    render(<MultisigSetup />);
    const highInput = screen.getByLabelText(/high threshold/i);
    await userEvent.clear(highInput);
    await userEvent.type(highInput, '999');
    fireEvent.click(screen.getByText(/build setoptions/i));
    await waitFor(() => {
      expect(screen.getByText(/total signer weight/i)).toBeInTheDocument();
    });
  });

  it('calls fetchAccount and notifies success on valid build', async () => {
    render(<MultisigSetup />);
    fireEvent.click(screen.getByText(/build setoptions/i));
    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith('XDR Built', expect.any(String));
    });
  });

  it('shows generated XDR textarea after successful build', async () => {
    render(<MultisigSetup />);
    fireEvent.click(screen.getByText(/build setoptions/i));
    await waitFor(() => {
      expect(screen.getByLabelText(/generated transaction xdr/i)).toBeInTheDocument();
    });
  });

  it('shows connect prompt when no wallet connected', () => {
    useStore.setState({ connectedAddress: null }, false);
    render(<MultisigSetup />);
    expect(screen.getByText(/connect a wallet/i)).toBeInTheDocument();
  });
});
