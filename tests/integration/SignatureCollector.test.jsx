import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as StellarSdk from '@stellar/stellar-sdk';
import { createSession } from '../../src/lib/multisig';
import { buildPaymentTransactionXdr } from '../__factories__';

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
const mockWarning = vi.fn();
const mockError = vi.fn();
vi.mock('../../src/hooks/useNotifications', () => ({
  useNotifications: () => ({ success: mockSuccess, error: mockError, warning: mockWarning }),
}));

import { useStore } from '../../src/lib/store';
import SignatureCollector from '../../src/components/multisig/SignatureCollector';

const KP_A = StellarSdk.Keypair.random();
const KP_B = StellarSdk.Keypair.random();

const buildTxXdr = () =>
  buildPaymentTransactionXdr({
    sourceKeypair: KP_A,
    destination: KP_B.publicKey(),
    amount: '1',
    asset: StellarSdk.Asset.native(),
    network: StellarSdk.Networks.TESTNET,
    timeout: 300,
  });

describe('SignatureCollector (integration)', () => {
  let session;

  beforeEach(() => {
    localStorage.clear();
    mockSuccess.mockClear();
    mockWarning.mockClear();
    mockError.mockClear();
    useStore.setState({ network: 'testnet' }, false);

    session = createSession({
      txXdr: buildTxXdr(),
      sourceAddress: KP_A.publicKey(),
      description: 'Test Signing',
      requiredSigners: [
        { key: KP_A.publicKey(), weight: 1, label: 'Alice' },
        { key: KP_B.publicKey(), weight: 1, label: 'Bob' },
      ],
      threshold: 2,
      network: 'testnet',
    });
  });

  it('renders signature status and sign form', () => {
    render(<SignatureCollector session={session} onSessionUpdate={vi.fn()} />);
    expect(screen.getByText(/add your signature/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your public key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your secret key/i)).toBeInTheDocument();
  });

  it('shows current XDR textarea', () => {
    render(<SignatureCollector session={session} onSessionUpdate={vi.fn()} />);
    expect(screen.getByLabelText(/current transaction xdr/i)).toBeInTheDocument();
  });

  it('sign button is disabled when no secret key provided', async () => {
    render(<SignatureCollector session={session} onSessionUpdate={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/your public key/i), KP_A.publicKey());
    // Button should be disabled when secret is empty
    const signBtn = screen.getByRole('button', { name: /sign transaction/i });
    expect(signBtn).toBeDisabled();
  });

  it('warns when public key is not in required signers', async () => {
    const stranger = StellarSdk.Keypair.random();
    render(<SignatureCollector session={session} onSessionUpdate={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/your public key/i), stranger.publicKey());
    expect(screen.getByText(/not in the required signers/i)).toBeInTheDocument();
  });

  it('successfully signs and calls onSessionUpdate', async () => {
    const onUpdate = vi.fn();
    render(<SignatureCollector session={session} onSessionUpdate={onUpdate} />);

    await userEvent.type(screen.getByLabelText(/your public key/i), KP_A.publicKey());
    await userEvent.type(screen.getByLabelText(/your secret key/i), KP_A.secret());
    fireEvent.click(screen.getByRole('button', { name: /sign transaction/i }));

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith('Signature Added', expect.any(String));
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  it('toggles secret key visibility', async () => {
    render(<SignatureCollector session={session} onSessionUpdate={vi.fn()} />);
    const secretInput = screen.getByLabelText(/your secret key/i);
    expect(secretInput.type).toBe('password');
    fireEvent.click(screen.getByLabelText(/show secret key/i));
    expect(secretInput.type).toBe('text');
    fireEvent.click(screen.getByLabelText(/hide secret key/i));
    expect(secretInput.type).toBe('password');
  });

  it('hides sign form for submitted sessions', () => {
    const submitted = { ...session, status: 'submitted' };
    render(<SignatureCollector session={submitted} onSessionUpdate={vi.fn()} />);
    expect(screen.queryByText(/add your signature/i)).toBeNull();
  });
});
