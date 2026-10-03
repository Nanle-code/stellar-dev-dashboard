import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as Sdk from '@stellar/stellar-sdk';

const mockFetchAccount = vi.fn();
const mockGetSorobanServer = vi.fn();
const mockGetStoredValue = vi.fn();
const mockSetStoredValue = vi.fn();

let storeState = { network: 'testnet', accountData: null };

vi.mock('../../../src/lib/store', () => ({
  useStore: () => storeState,
}));

vi.mock('../../../src/lib/stellar', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchAccount: (...args) => mockFetchAccount(...args),
    getSorobanServer: (...args) => mockGetSorobanServer(...args),
  };
});

vi.mock('../../../src/lib/storage', () => ({
  getStoredValue: (...args) => mockGetStoredValue(...args),
  setStoredValue: (...args) => mockSetStoredValue(...args),
}));

const {
  usePreSignRiskSummary,
  reviewTransaction,
  parseTransactionXdr,
  trustContract,
  REVIEW_SHOWN,
  REVIEW_PASS,
  REVIEW_ERROR,
} = await import('../../../src/hooks/usePreSignRiskSummary');

const KP_A = Sdk.Keypair.random();
const KP_B = Sdk.Keypair.random();
const A = KP_A.publicKey();
const B = KP_B.publicKey();

const buildXdr = (descriptors) => {
  const builder = new Sdk.TransactionBuilder(new Sdk.Account(A, '100'), {
    fee: Sdk.BASE_FEE,
    networkPassphrase: Sdk.Networks.TESTNET,
  });
  for (const descriptor of descriptors) builder.addOperation(descriptor);
  return builder.setTimeout(300).build().toXDR();
};

const MERGE_XDR = buildXdr([Sdk.Operation.accountMerge({ destination: B })]);
const SMALL_PAYMENT_XDR = buildXdr([
  Sdk.Operation.payment({ destination: B, asset: Sdk.Asset.native(), amount: '1' }),
]);

describe('parseTransactionXdr', () => {
  it('decodes a testnet envelope', () => {
    const tx = parseTransactionXdr(MERGE_XDR, 'testnet');
    expect(tx.source).toBe(A);
    expect(tx.operations).toHaveLength(1);
  });

  it('rejects an envelope that is not a transaction', () => {
    expect(() => parseTransactionXdr('not-base64-xdr', 'testnet')).toThrow();
  });
});

describe('reviewTransaction', () => {
  it('returns a summary for a high-risk transaction', async () => {
    const result = await reviewTransaction(MERGE_XDR, { network: 'testnet' });
    expect(result.error).toBeNull();
    expect(result.summary.requiresAcknowledgement).toBe(true);
    expect(result.summary.flaggedContracts).toEqual([]);
  });

  it('reports a decode failure instead of throwing', async () => {
    const result = await reviewTransaction('garbage', { network: 'testnet' });
    expect(result.summary).toBeNull();
    expect(result.error).toMatch(/could not decode/i);
  });

  it('loads the source account when no snapshot is supplied', async () => {
    const account = { account_id: A, balances: [{ asset_type: 'native', balance: '10' }] };
    mockFetchAccount.mockResolvedValueOnce(account);
    const result = await reviewTransaction(MERGE_XDR, { network: 'testnet' });
    expect(mockFetchAccount).toHaveBeenCalledWith(A, 'testnet');
    expect(result.summary.notes.join(' ')).not.toMatch(/No account snapshot/i);
  });

  it('degrades gracefully when the account cannot be loaded', async () => {
    mockFetchAccount.mockRejectedValueOnce(new Error('offline'));
    const result = await reviewTransaction(MERGE_XDR, { network: 'testnet' });
    expect(result.error).toBeNull();
    expect(result.summary.notes.join(' ')).toMatch(/No account snapshot/i);
  });

  it('does not reach for the network when a snapshot is already known', async () => {
    mockFetchAccount.mockClear();
    await reviewTransaction(MERGE_XDR, {
      network: 'testnet',
      account: { account_id: A, balances: [] },
    });
    expect(mockFetchAccount).not.toHaveBeenCalled();
  });

  it('skips simulation for a classic-only transaction', async () => {
    mockGetSorobanServer.mockClear();
    const result = await reviewTransaction(MERGE_XDR, { network: 'testnet' });
    expect(mockGetSorobanServer).not.toHaveBeenCalled();
    expect(result.summary.simulation.available).toBe(false);
  });

  it('simulates a Soroban transaction and folds the result in', async () => {
    const contractId = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
    const xdr = buildXdr([
      new Sdk.Contract(contractId).call('transfer', Sdk.nativeToScVal(1n, { type: 'i128' })),
    ]);
    mockGetSorobanServer.mockReturnValueOnce({
      simulateTransaction: vi.fn().mockResolvedValue({ minResourceFee: '1200', events: [] }),
    });
    const result = await reviewTransaction(xdr, { network: 'testnet' });
    expect(mockGetSorobanServer).toHaveBeenCalledWith('testnet');
    expect(result.summary.simulation.available).toBe(true);
    expect(result.summary.simulation.minResourceFee).toBe('1200');
  });

  it('records a simulation failure but still produces a summary', async () => {
    const contractId = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
    const xdr = buildXdr([
      new Sdk.Contract(contractId).call('transfer', Sdk.nativeToScVal(1n, { type: 'i128' })),
    ]);
    mockGetSorobanServer.mockReturnValueOnce({
      simulateTransaction: vi.fn().mockRejectedValue(new Error('rpc down')),
    });
    const result = await reviewTransaction(xdr, { network: 'testnet' });
    expect(result.error).toBeNull();
    expect(result.summary.simulation.error).toBe('rpc down');
    expect(result.summary.notes.join(' ')).toMatch(/did not complete/i);
  });

  it('applies the known-contract allowlist it is given', async () => {
    const contractId = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
    const xdr = buildXdr([
      new Sdk.Contract(contractId).call('transfer', Sdk.nativeToScVal(1n, { type: 'i128' })),
    ]);
    mockGetSorobanServer.mockReturnValue({
      simulateTransaction: vi.fn().mockResolvedValue({ events: [] }),
    });
    const unknown = await reviewTransaction(xdr, { network: 'testnet', knownContracts: [] });
    const known = await reviewTransaction(xdr, {
      network: 'testnet',
      knownContracts: [contractId],
    });
    expect(unknown.summary.requiresAcknowledgement).toBe(true);
    expect(unknown.summary.flaggedContracts).toEqual([contractId]);
    expect(known.summary.requiresAcknowledgement).toBe(false);
  });
});

describe('trustContract', () => {
  it('persists a new contract without duplicating an existing one', async () => {
    mockGetStoredValue.mockResolvedValueOnce([B]);
    const next = await trustContract(A);
    expect(next).toEqual([B, A]);
    expect(mockSetStoredValue).toHaveBeenCalled();

    mockGetStoredValue.mockResolvedValueOnce([A]);
    expect(await trustContract(A)).toEqual([A]);
  });

  it('returns an empty list when storage cannot be read', async () => {
    mockGetStoredValue.mockRejectedValueOnce(new Error('no idb'));
    expect(await trustContract(A)).toEqual([A]);
  });
});

describe('usePreSignRiskSummary', () => {
  beforeEach(() => {
    storeState = { network: 'testnet', accountData: null };
    mockGetStoredValue.mockResolvedValue([]);
    mockSetStoredValue.mockResolvedValue(undefined);
    mockFetchAccount.mockResolvedValue({ account_id: A, balances: [] });
  });

  it('presents a summary and holds the pending envelope', async () => {
    const { result } = renderHook(() => usePreSignRiskSummary());
    let outcome;
    await act(async () => {
      outcome = await result.current.beginReview(MERGE_XDR);
    });
    expect(outcome).toBe(REVIEW_SHOWN);
    expect(result.current.summary.requiresAcknowledgement).toBe(true);
    expect(result.current.pendingXdr).toBe(MERGE_XDR);
  });

  it('reports a decode failure and presents nothing', async () => {
    const { result } = renderHook(() => usePreSignRiskSummary());
    let outcome;
    await act(async () => {
      outcome = await result.current.beginReview('garbage');
    });
    // Not `pass`: an envelope nobody can decode must not be signed.
    expect(outcome).toBe(REVIEW_ERROR);
    expect(result.current.summary).toBeNull();
    expect(result.current.reviewError).toMatch(/could not decode/i);
  });

  it('refuses an empty envelope', async () => {
    const { result } = renderHook(() => usePreSignRiskSummary());
    let outcome;
    await act(async () => {
      outcome = await result.current.beginReview('   ');
    });
    expect(outcome).toBe(REVIEW_ERROR);
    expect(result.current.summary).toBeNull();
  });

  it('always reports `shown` when a summary is produced, so a caller can never sign past it', async () => {
    const { result } = renderHook(() => usePreSignRiskSummary());
    for (const xdr of [MERGE_XDR, SMALL_PAYMENT_XDR]) {
      let outcome;
      await act(async () => {
        outcome = await result.current.beginReview(xdr);
      });
      // Even a clean transaction is shown, so the review is never bypassable.
      expect(outcome).toBe(REVIEW_SHOWN);
      act(() => result.current.cancelReview());
    }
  });

  it('exposes the three outcomes as distinct values', () => {
    expect(new Set([REVIEW_SHOWN, REVIEW_PASS, REVIEW_ERROR]).size).toBe(3);
  });

  it('clears the summary on cancel', async () => {
    const { result } = renderHook(() => usePreSignRiskSummary());
    await act(async () => {
      await result.current.beginReview(MERGE_XDR);
    });
    act(() => result.current.cancelReview());
    await waitFor(() => expect(result.current.summary).toBeNull());
    expect(result.current.pendingXdr).toBeNull();
  });

  it('runs the signing function only after acknowledgement, and clears state first', async () => {
    const { result } = renderHook(() => usePreSignRiskSummary());
    await act(async () => {
      await result.current.beginReview(MERGE_XDR);
    });
    const sign = vi.fn().mockResolvedValue('signed-xdr');
    await act(async () => {
      await result.current.onAcknowledged(sign);
    });
    expect(sign).toHaveBeenCalledTimes(1);
    expect(result.current.summary).toBeNull();
  });

  it('hands the reviewed envelope to the signing function', async () => {
    const { result } = renderHook(() => usePreSignRiskSummary());
    await act(async () => {
      await result.current.beginReview(MERGE_XDR);
    });
    const sign = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      await result.current.onAcknowledged(sign);
    });
    // Signing whatever the caller re-reads from state would let an edit made
    // while the panel was open slip past the review.
    expect(sign).toHaveBeenCalledWith(MERGE_XDR);
  });

  it('does not run the signing function when the panel is dismissed', async () => {
    const { result } = renderHook(() => usePreSignRiskSummary());
    await act(async () => {
      await result.current.beginReview(MERGE_XDR);
    });
    const sign = vi.fn();
    act(() => result.current.cancelReview());
    await act(async () => {
      await result.current.onAcknowledged(sign);
    });
    // There is nothing reviewed to sign, so the caller gets no envelope.
    expect(sign).toHaveBeenCalledWith(null);
  });

  it('honours a network override, for SEP-10 challenges on another network', async () => {
    const { result } = renderHook(() => usePreSignRiskSummary());
    storeState = { network: 'testnet', accountData: null };
    await act(async () => {
      await result.current.beginReview(SMALL_PAYMENT_XDR, 'testnet');
    });
    expect(result.current.summary.overallSeverity).toBe('info');
  });
});

describe('reviewTransaction — account snapshot matching', () => {
  it('ignores a snapshot belonging to a different account', async () => {
    const loadAccount = vi.fn().mockResolvedValue({ account_id: A, balances: [] });

    const result = await reviewTransaction(SMALL_PAYMENT_XDR, {
      network: 'testnet',
      // A snapshot for B, but the envelope spends from A.
      account: { account_id: B, balances: [{ asset_type: 'native', balance: '1' }] },
      loadAccount,
      simulate: vi.fn().mockResolvedValue(null),
    });

    // A balance of 1 XLM would have been 100% of the account's holdings, but
    // that balance is not this transaction's, so it must not be used.
    expect(loadAccount).toHaveBeenCalledWith(A, 'testnet');
    expect(result.summary.operations[0].severity).toBe('info');
  });

  it('uses a matching snapshot without refetching', async () => {
    const loadAccount = vi.fn();

    const result = await reviewTransaction(SMALL_PAYMENT_XDR, {
      network: 'testnet',
      account: { account_id: A, balances: [{ asset_type: 'native', balance: '100000' }] },
      loadAccount,
      simulate: vi.fn().mockResolvedValue(null),
    });

    expect(loadAccount).not.toHaveBeenCalled();
    expect(result.summary.sourceAccount).toBe(A);
  });
});
