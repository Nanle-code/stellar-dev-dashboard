import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { createSession, SESSION_STATUS } from '../../src/lib/multisig';

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

import { useStore } from '../../src/lib/store';
import SessionManager from '../../src/components/multisig/SessionManager';

const KP_A = StellarSdk.Keypair.random();

describe('SessionManager (integration)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockSuccess.mockClear();
    mockError.mockClear();
    useStore.setState({ network: 'testnet' }, false);
  });

  it('shows empty state when no sessions', () => {
    render(<SessionManager />);
    expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument();
  });

  it('renders existing sessions from localStorage', () => {
    createSession({
      txXdr: 'AAAA',
      sourceAddress: KP_A.publicKey(),
      description: 'Treasury Payment',
      requiredSigners: [{ key: KP_A.publicKey(), weight: 1 }],
      threshold: 1,
      network: 'testnet',
    });
    render(<SessionManager />);
    expect(screen.getByText('Treasury Payment')).toBeInTheDocument();
  });

  it('deletes a session when Delete clicked', async () => {
    createSession({
      txXdr: 'AAAA',
      sourceAddress: KP_A.publicKey(),
      description: 'To Delete',
      requiredSigners: [{ key: KP_A.publicKey(), weight: 1 }],
      threshold: 1,
      network: 'testnet',
    });
    render(<SessionManager />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => {
      expect(screen.queryByText('To Delete')).toBeNull();
    });
  });

  it('opens session detail when Open clicked', async () => {
    createSession({
      txXdr: 'AAAA',
      sourceAddress: KP_A.publicKey(),
      description: 'Detail Session',
      requiredSigners: [{ key: KP_A.publicKey(), weight: 1 }],
      threshold: 1,
      network: 'testnet',
    });
    render(<SessionManager />);
    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    await waitFor(() => {
      expect(screen.getByText('Detail Session')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /← back/i })).toBeInTheDocument();
    });
  });

  it('navigates back from session detail', async () => {
    createSession({
      txXdr: 'AAAA',
      sourceAddress: KP_A.publicKey(),
      description: 'Back Test',
      requiredSigners: [{ key: KP_A.publicKey(), weight: 1 }],
      threshold: 1,
      network: 'testnet',
    });
    render(<SessionManager />);
    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    await waitFor(() => screen.getByRole('button', { name: /← back/i }));
    fireEvent.click(screen.getByRole('button', { name: /← back/i }));
    await waitFor(() => {
      expect(screen.getByText('Back Test')).toBeInTheDocument();
    });
  });

  it('shows new session form when "+ New Session" clicked', () => {
    render(<SessionManager />);
    fireEvent.click(screen.getByText('+ New Session'));
    expect(screen.getByText(/new signature session/i)).toBeInTheDocument();
  });

  it('creates a new session from the form', async () => {
    render(<SessionManager />);
    fireEvent.click(screen.getByText('+ New Session'));

    fireEvent.change(screen.getByPlaceholderText(/treasury payment/i), {
      target: { value: 'My New Session' },
    });
    fireEvent.change(screen.getByLabelText(/transaction xdr/i), {
      target: { value: 'BBBB' },
    });
    fireEvent.change(screen.getByLabelText(/required signers/i), {
      target: { value: `${KP_A.publicKey()}:2` },
    });

    fireEvent.click(screen.getByRole('button', { name: /create session/i }));

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith('Session Created', expect.any(String));
    });
  });
});
