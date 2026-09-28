import * as StellarSdk from '@stellar/stellar-sdk';

const DEFAULT_ACCOUNT_ID = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
const DEFAULT_TRANSACTION_ID = 'tx1';
const DEFAULT_OPERATION_ID = 'op1';

/**
 * A realistic Stellar account fixture with default native balance, no auth flags,
 * and a single signer.
 */
export const defaultAccountFixture = {
  id: DEFAULT_ACCOUNT_ID,
  account_id: DEFAULT_ACCOUNT_ID,
  sequence: '1234567890',
  subentry_count: 0,
  balances: [
    {
      balance: '100.0000000',
      asset_type: 'native',
      buying_liabilities: '0.0000000',
      selling_liabilities: '0.0000000',
    },
  ],
  thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
  flags: { auth_required: false, auth_revocable: false, auth_immutable: false },
  signers: [
    {
      public_key: DEFAULT_ACCOUNT_ID,
      weight: 1,
      type: 'ed25519_public_key',
    },
  ],
};

/**
 * Account fixture representing an account with an empty balance array.
 */
export const accountWithEmptyBalancesFixture = {
  ...defaultAccountFixture,
  id: 'GDU3NQ7YQ3UBJ4D7SUMYPQDZKCB3KPCK5VCKC7BOZ4QIJ4LA6LUEVFXH',
  account_id: 'GDU3NQ7YQ3UBJ4D7SUMYPQDZKCB3KPCK5VCKC7BOZ4QIJ4LA6LUEVFXH',
  balances: [],
};

/**
 * Account fixture representing invalid or unexpected auth flag configuration.
 */
export const accountWithInvalidFlagsFixture = {
  ...defaultAccountFixture,
  id: 'GB4A4Y6RWYC2ZVIRW4BAS4XK5CI7CQLM2C5EFQWXGB2QHWQ6CMF6GU5N',
  account_id: 'GB4A4Y6RWYC2ZVIRW4BAS4XK5CI7CQLM2C5EFQWXGB2QHWQ6CMF6GU5N',
  flags: { auth_required: true, auth_revocable: true, auth_immutable: true },
};

/**
 * Build a Stellar account fixture.
 * @param {object} [overrides={}] - Values to override on the default account.
 * @returns {object}
 */
export const buildAccountFixture = (overrides = {}) => ({
  ...defaultAccountFixture,
  ...overrides,
  balances: overrides.balances ?? defaultAccountFixture.balances,
  thresholds: { ...defaultAccountFixture.thresholds, ...(overrides.thresholds ?? {}) },
  flags: { ...defaultAccountFixture.flags, ...(overrides.flags ?? {}) },
  signers: overrides.signers ?? defaultAccountFixture.signers,
});

/**
 * A realistic transaction record fixture returned by Horizon.
 */
export const defaultTransactionRecord = {
  id: DEFAULT_TRANSACTION_ID,
  hash: 'abc123',
  ledger: 1000,
  created_at: '2024-01-01T00:00:00Z',
  source_account: DEFAULT_ACCOUNT_ID,
  fee_charged: '100',
  operation_count: 1,
  successful: true,
};

/**
 * Build a transaction record fixture.
 * @param {object} [overrides={}] - Values to override on the default transaction.
 * @returns {object}
 */
export const buildTransactionRecord = (overrides = {}) => ({
  ...defaultTransactionRecord,
  ...overrides,
});

/**
 * Wraps transaction records in a Horizon-style response object.
 * @param {object[]} [records=[defaultTransactionRecord]] - Transaction records.
 * @returns {object}
 */
export const buildTransactionsResponse = (records = [defaultTransactionRecord]) => ({
  _embedded: { records },
});

/**
 * A realistic ledger fixture returned by Horizon.
 */
export const defaultLedgerFixture = {
  id: 'ledger1',
  sequence: 50000000,
  closed_at: '2024-01-01T00:00:00Z',
  transaction_count: 42,
  operation_count: 100,
  base_fee_in_stroops: 100,
};

/**
 * Build a ledger fixture.
 * @param {object} [overrides={}] - Values to override on the default ledger.
 * @returns {object}
 */
export const buildLedgerFixture = (overrides = {}) => ({
  ...defaultLedgerFixture,
  ...overrides,
});

/**
 * A realistic payment operation response object.
 */
export const defaultPaymentOperation = {
  id: DEFAULT_OPERATION_ID,
  type: 'payment',
  source_account: DEFAULT_ACCOUNT_ID,
  created_at: '2024-01-01T00:00:00Z',
  transaction_hash: 'abc123',
  asset_type: 'native',
  amount: '10.0000000',
  from: DEFAULT_ACCOUNT_ID,
  to: DEFAULT_ACCOUNT_ID,
};

/**
 * Build a Horizon operation fixture.
 * @param {object} [overrides={}] - Values to override on the default operation.
 * @returns {object}
 */
export const buildOperation = (overrides = {}) => ({
  ...defaultPaymentOperation,
  ...overrides,
});

/**
 * Native asset fixture used in transaction and operation tests.
 */
export const nativeAssetFixture = {
  asset_type: 'native',
};

/**
 * Build a credit asset fixture.
 * @param {object} [overrides={}] - Custom asset fields.
 * @returns {object}
 */
export const buildCreditAsset = (overrides = {}) => ({
  asset_type: 'credit_alphanum4',
  asset_code: 'USDC',
  asset_issuer: DEFAULT_ACCOUNT_ID,
  ...overrides,
});

/**
 * Build a native or credit asset object for use in operation tests.
 * @param {object} [options={}] - Asset options.
 * @param {boolean} [options.native=true] - Whether to build a native asset.
 * @returns {object}
 */
export const buildAsset = ({ native = true, ...overrides } = {}) =>
  native ? { ...nativeAssetFixture, ...overrides } : buildCreditAsset(overrides);

/**
 * Build a simple Stellar payment transaction for tests.
 * @param {object} [options={}] - Transaction options.
 * @param {import('@stellar/stellar-sdk').Keypair} [options.sourceKeypair] - Source keypair.
 * @param {string} [options.destination] - Destination public key.
 * @param {string} [options.amount='1'] - Payment amount.
 * @param {import('@stellar/stellar-sdk').Asset} [options.asset=StellarSdk.Asset.native()] - Payment asset.
 * @param {string} [options.network=StellarSdk.Networks.TESTNET] - Network passphrase.
 * @param {number} [options.timeout=300] - Transaction timeout.
 * @returns {import('@stellar/stellar-sdk').Transaction}
 */
export const buildPaymentTransaction = ({
  sourceKeypair = StellarSdk.Keypair.random(),
  destination = StellarSdk.Keypair.random().publicKey(),
  amount = '1',
  asset = StellarSdk.Asset.native(),
  network = StellarSdk.Networks.TESTNET,
  timeout = 300,
} = {}) => {
  const account = new StellarSdk.Account(sourceKeypair.publicKey(), '100');
  return new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: network,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination,
        asset,
        amount,
      })
    )
    .setTimeout(timeout)
    .build();
};

/**
 * Build a transaction XDR string from a payment transaction.
 * @param {object} [options={}] - Transaction options.
 * @returns {string}
 */
export const buildPaymentTransactionXdr = (options = {}) =>
  buildPaymentTransaction(options).toXDR();
