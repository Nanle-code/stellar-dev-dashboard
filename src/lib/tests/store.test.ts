/**
 * Zustand store tests (#99)
 *
 * Each test resets the store to its baseline before running so they remain
 * independent. Resolve order now favours .ts before .js, matching Vite.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';

// Capture the baseline state once on first import so we can reset between tests.
const BASELINE = useStore.getState();

function resetStore() {
  useStore.setState(BASELINE, true);
}

describe('useStore — baseline shape', () => {
  beforeEach(resetStore);

  it('starts on testnet', () => {
    expect(useStore.getState().network).toBe('testnet');
  });

  it('has no connected address by default', () => {
    expect(useStore.getState().connectedAddress).toBeNull();
  });

  it('starts on the overview tab', () => {
    expect(useStore.getState().activeTab).toBe('overview');
  });

  it('starts with empty transactions and operations arrays', () => {
    const s = useStore.getState();
    expect(Array.isArray(s.transactions)).toBe(true);
    expect(s.transactions).toHaveLength(0);
    expect(Array.isArray(s.operations)).toBe(true);
    expect(s.operations).toHaveLength(0);
  });
});

describe('useStore — wallet / account', () => {
  beforeEach(resetStore);

  it('setConnectedAddress updates the address', () => {
    useStore.getState().setConnectedAddress('GABCDEF');
    expect(useStore.getState().connectedAddress).toBe('GABCDEF');
  });

  it('setAccountData clears any prior accountError', () => {
    useStore.setState({ accountError: 'oops' });
    useStore.getState().setAccountData({ id: 'GABC' } as never);
    const s = useStore.getState();
    expect(s.accountData).toEqual({ id: 'GABC' });
    expect(s.accountError).toBeNull();
  });

  it('setAccountLoading toggles the loading flag', () => {
    useStore.getState().setAccountLoading(true);
    expect(useStore.getState().accountLoading).toBe(true);
    useStore.getState().setAccountLoading(false);
    expect(useStore.getState().accountLoading).toBe(false);
  });
});

describe('useStore — network switching', () => {
  beforeEach(resetStore);

  it('setNetwork updates the network and clears account/tx caches', () => {
    useStore.setState({
      accountData: { id: 'X' } as never,
      transactions: [{ id: 't1' } as never],
      operations: [{ id: 'o1' } as never],
    });

    useStore.getState().setNetwork('mainnet');

    const s = useStore.getState();
    expect(s.network).toBe('mainnet');
    expect(s.accountData).toBeNull();
    expect(s.transactions).toHaveLength(0);
    expect(s.operations).toHaveLength(0);
  });
});

describe('useStore — transactions/operations append (deduped)', () => {
  beforeEach(resetStore);

  it('setTransactions replaces the list', () => {
    useStore.getState().setTransactions([{ id: 'a' } as never, { id: 'b' } as never]);
    expect(useStore.getState().transactions).toHaveLength(2);
  });

  it('appendTransactions deduplicates by id', () => {
    useStore.getState().setTransactions([{ id: 'a' } as never]);
    useStore.getState().appendTransactions([{ id: 'a' } as never, { id: 'b' } as never]);
    const ids = useStore.getState().transactions.map((t: { id: string }) => t.id);
    expect(ids).toEqual(['a', 'b']);
  });

  it('appendOperations deduplicates by id', () => {
    useStore.getState().setOperations([{ id: 'op1' } as never]);
    useStore.getState().appendOperations([{ id: 'op1' } as never, { id: 'op2' } as never]);
    const ids = useStore.getState().operations.map((o: { id: string }) => o.id);
    expect(ids).toEqual(['op1', 'op2']);
  });
});

describe('useStore — UI / tab', () => {
  beforeEach(resetStore);

  it('setActiveTab updates the active tab', () => {
    useStore.getState().setActiveTab('transactions');
    expect(useStore.getState().activeTab).toBe('transactions');
  });

  it('toggleTheme flips between light and dark', () => {
    const initial = useStore.getState().theme;
    useStore.getState().toggleTheme();
    const next = useStore.getState().theme;
    expect(next).not.toBe(initial);
    expect(['light', 'dark']).toContain(next);
    useStore.getState().toggleTheme();
    expect(useStore.getState().theme).toBe(initial);
  });
});

describe('useStore — contract explorer', () => {
  beforeEach(resetStore);

  it('setContractId updates the value', () => {
    useStore.getState().setContractId('CABCD');
    expect(useStore.getState().contractId).toBe('CABCD');
  });

  it('setContractData clears prior contractError', () => {
    useStore.setState({ contractError: 'bad' });
    useStore.getState().setContractData({ name: 'demo' } as never);
    const s = useStore.getState();
    expect(s.contractData).toEqual({ name: 'demo' });
    expect(s.contractError).toBeNull();
  });
});
