import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SessionManager from '../../src/components/multisig/SessionManager';
import * as multisig from '../../src/lib/multisig';

vi.mock('../../src/lib/multisig', () => ({
  loadSessions: vi.fn(),
  exportSessionJson: vi.fn(),
}));

describe('MultisigManager Integration', () => {
  it('loads and displays persistent sessions from IndexedDB on mount', async () => {
    // Mock that we successfully fetched a pending state from IndexedDB
    multisig.loadSessions.mockResolvedValue([
      { id: 'msig-12345', description: 'Test Offline Co-signer MSIG', status: 'pending', collectedSignatures: [], requiredSigners: [{ key: 'G...' }] }
    ]);

    render(<SessionManager />);
    
    expect(await screen.findByText(/Test Offline Co-signer MSIG/)).toBeInTheDocument();
    expect(multisig.loadSessions).toHaveBeenCalled();
  });
});