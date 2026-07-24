/**
 * useDataExport — happy-path tests
 *
 * Covers:
 *   - exportDashboard downloads a JSON file
 *   - exportTransactions downloads a CSV file
 *   - exportBalances downloads a CSV file
 *   - importBackup: valid file restores state
 *   - importBackup: invalid JSON surfaces an error
 *   - importBackup: unsupported version surfaces an error
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDataExport } from './useDataExport';

// ── Stub browser download ────────────────────────────────────────────────────

const revokeObjectURL = vi.fn();
const createObjectURL = vi.fn(() => 'blob:mock');
const click = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();

  globalThis.URL = {
    createObjectURL,
    revokeObjectURL,
  };

  // Intercept document.createElement so we capture the anchor click
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'a') {
      const anchor = { href: '', download: '', click, style: {} };
      return anchor;
    }
    return document.createElement.wrappedJSObject?.(tag) ?? {};
  });
  vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
  vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
});

// ── Stub Zustand store ───────────────────────────────────────────────────────

vi.mock('../lib/store', () => ({
  useStore: () => ({
    connectedAddress: 'GABC1234',
    network: 'testnet',
    theme: 'dark',
    activeTab: 'overview',
    watchedAddresses: [],
    transactions: [],
    account: {
      balances: [
        {
          asset_type: 'native',
          asset_code: 'XLM',
          balance: '100.0000000',
          buying_liabilities: '0',
          selling_liabilities: '0',
        },
      ],
    },
    setNetwork: vi.fn(),
    setTheme: vi.fn(),
    setWatchedAddresses: vi.fn(),
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMockFile(content, name = 'backup.json', type = 'application/json') {
  return new File([content], name, { type });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useDataExport', () => {
  it('exportDashboard triggers a JSON download', () => {
    const { result } = renderHook(() => useDataExport());

    act(() => {
      result.current.exportDashboard();
    });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    // The blob passed to createObjectURL should be a Blob
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
    expect(result.current.exportError).toBeNull();
    expect(result.current.isExporting).toBe(false);
  });

  it('exportTransactions triggers a CSV download', () => {
    const { result } = renderHook(() => useDataExport());
    const txs = [
      {
        id: '1',
        hash: 'abc',
        ledger: 100,
        created_at: '2024-01-01T00:00:00Z',
        source_account: 'GABC',
        fee_charged: '100',
        operation_count: 1,
        successful: true,
      },
    ];

    act(() => {
      result.current.exportTransactions(txs);
    });

    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('text/csv');
    expect(click).toHaveBeenCalledTimes(1);
    expect(result.current.exportError).toBeNull();
  });

  it('exportBalances triggers a CSV download', () => {
    const { result } = renderHook(() => useDataExport());

    act(() => {
      result.current.exportBalances([
        { asset_type: 'native', balance: '100.0000000' },
      ]);
    });

    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('text/csv');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('importBackup: valid backup restores state and sets importSuccess', async () => {
    const { result } = renderHook(() => useDataExport());
    const backup = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      account: { connectedAddress: 'GABC', network: 'testnet' },
      theme: 'dark',
    });
    const file = makeMockFile(backup);

    await act(async () => {
      await result.current.importBackup(file);
    });

    expect(result.current.importError).toBeNull();
    expect(result.current.importSuccess).toBe(true);
    expect(result.current.isImporting).toBe(false);
  });

  it('importBackup: invalid JSON sets importError', async () => {
    const { result } = renderHook(() => useDataExport());
    const file = makeMockFile('not json at all');

    await act(async () => {
      await result.current.importBackup(file);
    });

    expect(result.current.importError).toMatch(/not valid JSON/i);
    expect(result.current.importSuccess).toBe(false);
  });

  it('importBackup: unsupported version sets importError', async () => {
    const { result } = renderHook(() => useDataExport());
    const backup = JSON.stringify({
      version: 99,
      exportedAt: new Date().toISOString(),
      account: { network: 'testnet' },
    });
    const file = makeMockFile(backup);

    await act(async () => {
      await result.current.importBackup(file);
    });

    expect(result.current.importError).toMatch(/unsupported backup version/i);
    expect(result.current.importSuccess).toBe(false);
  });

  it('importBackup: missing exportedAt sets importError', async () => {
    const { result } = renderHook(() => useDataExport());
    const backup = JSON.stringify({
      version: 1,
      account: { network: 'testnet' },
      // exportedAt intentionally missing
    });
    const file = makeMockFile(backup);

    await act(async () => {
      await result.current.importBackup(file);
    });

    expect(result.current.importError).toMatch(/exportedAt/i);
    expect(result.current.importSuccess).toBe(false);
  });
});
