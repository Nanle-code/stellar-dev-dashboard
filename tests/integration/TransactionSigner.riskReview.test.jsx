import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as Sdk from '@stellar/stellar-sdk';

const mockSignFreighter = vi.fn();
const mockFetchAccount = vi.fn();
const mockGetSorobanServer = vi.fn();

let storeState = {
  walletConnected: true,
  walletType: 'freighter',
  walletPublicKey: '',
  network: 'testnet',
  accountData: null,
};

vi.mock('../../src/lib/store', () => ({
  useStore: () => storeState,
}));

vi.mock('../../src/lib/wallet/freighter', () => ({
  signTransactionWithFreighter: (...args) => mockSignFreighter(...args),
}));

vi.mock('../../src/lib/wallet/ledger', () => ({
  signXdrWithLedger: vi.fn(),
  isLedgerSupported: vi.fn().mockResolvedValue(true),
  getActiveLedgerSession: vi.fn().mockReturnValue({ stellarApp: null, publicKey: null }),
}));

vi.mock('../../src/lib/storage', () => ({
  getStoredValue: vi.fn().mockResolvedValue([]),
  setStoredValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/lib/stellar', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchAccount: (...args) => mockFetchAccount(...args),
    getSorobanServer: (...args) => mockGetSorobanServer(...args),
  };
});

const TransactionSigner = (await import('../../src/components/dashboard/TransactionSigner'))
  .default;

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

/** An envelope produced entirely outside the dashboard. */
const PASTED_MERGE_XDR = buildXdr([Sdk.Operation.accountMerge({ destination: B })]);
const PASTED_SMALL_PAYMENT_XDR = buildXdr([
  Sdk.Operation.payment({ destination: B, asset: Sdk.Asset.native(), amount: '1' }),
]);

const xdrField = () => screen.getByPlaceholderText(/paste the unsigned transaction xdr/i);

/** Users paste XDR, they do not type 300 characters one keystroke at a time. */
const paste = async (user, xdr) => {
  await user.click(xdrField());
  await user.paste(xdr);
};

describe('TransactionSigner — pre-sign risk review (#982)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState = {
      walletConnected: true,
      walletType: 'freighter',
      walletPublicKey: A,
      network: 'testnet',
      accountData: null,
    };
    mockFetchAccount.mockResolvedValue({ account_id: A, balances: [] });
    mockSignFreighter.mockResolvedValue('SIGNED_XDR');
  });

  it('prompts for a connection when no wallet is connected', () => {
    storeState = { ...storeState, walletConnected: false };
    render(<TransactionSigner />);
    expect(screen.getByText(/connect a wallet/i)).toBeInTheDocument();
  });

  it('does not reach the wallet for a pasted high-risk envelope until acknowledged', async () => {
    const user = userEvent.setup();
    render(<TransactionSigner />);

    await paste(user, PASTED_MERGE_XDR);
    await user.click(screen.getByRole('button', { name: /sign transaction/i }));

    const panel = await screen.findByRole('alertdialog');
    expect(panel).toHaveTextContent(/permanently deleted/i);
    expect(mockSignFreighter).not.toHaveBeenCalled();

    // The panel's proceed button is gated by the acknowledgement checkbox.
    const proceed = within(panel).getByRole('button', { name: /sign transaction/i });
    expect(proceed).toBeDisabled();

    await user.click(within(panel).getByRole('checkbox'));
    await user.click(within(panel).getByRole('button', { name: /sign transaction/i }));

    await waitFor(() => expect(mockSignFreighter).toHaveBeenCalledTimes(1));
    expect(mockSignFreighter.mock.calls[0][0]).toBe(PASTED_MERGE_XDR);
  });

  it('lets a pasted low-risk envelope through after one review step', async () => {
    const user = userEvent.setup();
    render(<TransactionSigner />);

    await paste(user, PASTED_SMALL_PAYMENT_XDR);
    await user.click(screen.getByRole('button', { name: /sign transaction/i }));

    // Shown for the user to read, but nothing to acknowledge, so the panel's
    // proceed button is enabled immediately.
    const panel = await screen.findByRole('alertdialog');
    expect(within(panel).queryByRole('checkbox')).not.toBeInTheDocument();
    const proceed = within(panel).getByRole('button', { name: /sign transaction/i });
    expect(proceed).toBeEnabled();

    await user.click(proceed);
    await waitFor(() => expect(mockSignFreighter).toHaveBeenCalledTimes(1));
  });

  it('cancelling the review leaves the wallet untouched', async () => {
    const user = userEvent.setup();
    render(<TransactionSigner />);

    await paste(user, PASTED_MERGE_XDR);
    await user.click(screen.getByRole('button', { name: /sign transaction/i }));
    const panel = await screen.findByRole('alertdialog');
    await user.click(within(panel).getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mockSignFreighter).not.toHaveBeenCalled();
  });

  it('signs the envelope that was reviewed, not one edited after the review', async () => {
    const user = userEvent.setup();
    render(<TransactionSigner />);

    const textarea = xdrField();
    await user.click(textarea);
    await user.paste(PASTED_MERGE_XDR);
    await user.click(screen.getByRole('button', { name: /sign transaction/i }));
    const panel = await screen.findByRole('alertdialog');

    // Swap the field contents while the panel is open.
    await user.clear(textarea);
    await user.click(textarea);
    await user.paste(PASTED_SMALL_PAYMENT_XDR);

    await user.click(within(panel).getByRole('checkbox'));
    await user.click(within(panel).getByRole('button', { name: /sign transaction/i }));

    await waitFor(() => expect(mockSignFreighter).toHaveBeenCalledTimes(1));
    expect(mockSignFreighter.mock.calls[0][0]).toBe(PASTED_MERGE_XDR);
  });

  it('refuses an envelope it cannot decode rather than passing it on', async () => {
    const user = userEvent.setup();
    render(<TransactionSigner />);

    await paste(user, 'this-is-not-an-xdr');
    await user.click(screen.getByRole('button', { name: /sign transaction/i }));

    expect(await screen.findByText(/could not decode/i)).toBeInTheDocument();
    expect(mockSignFreighter).not.toHaveBeenCalled();
  });

  it('explains each operation in a multi-operation paste', async () => {
    const user = userEvent.setup();
    render(<TransactionSigner />);

    const xdr = buildXdr([
      Sdk.Operation.accountMerge({ destination: B }),
      Sdk.Operation.payment({ destination: B, asset: Sdk.Asset.native(), amount: '1' }),
    ]);
    await paste(user, xdr);
    await user.click(screen.getByRole('button', { name: /sign transaction/i }));

    const panel = await screen.findByRole('alertdialog');
    expect(panel).toHaveTextContent(/2 operations in this transaction/i);
    expect(within(panel).getByTestId('risk-severity-0')).toHaveTextContent(/high/i);
    expect(within(panel).getByTestId('risk-severity-1')).toHaveTextContent(/no risk/i);
  });
});
