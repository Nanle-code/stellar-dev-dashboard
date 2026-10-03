/**
 * Deterministic Horizon data factories for E2E tests (#405).
 *
 * Keys and hashes are derived from a seed string, so every run renders the
 * same addresses and amounts. That keeps screenshots and text assertions
 * stable. No Playwright import: the factories are unit-tested under Vitest.
 */

import { Keypair, hash } from '@stellar/stellar-sdk';

export interface BalanceSpec {
  asset: 'native' | { code: string; issuer: string };
  balance: string;
}

export interface AccountOptions {
  seed?: string;
  balances?: BalanceSpec[];
  sequence?: string;
  signers?: Array<{ key: string; weight: number }>;
  thresholds?: { low: number; med: number; high: number };
  subentryCount?: number;
}

// A plain Uint8Array (not a Buffer) passes noble-hashes' type check in every realm, including jsdom.
const seedBytes = (seed: string) => Buffer.from(hash(Uint8Array.from(Buffer.from(seed, 'utf8')) as Buffer));

/** Deterministic keypair for a label, e.g. `testKeypair('alice')`. */
export function testKeypair(label: string): Keypair {
  if (!label) throw new Error('testKeypair requires a non-empty label');
  return Keypair.fromRawEd25519Seed(seedBytes(`e2e-keypair:${label}`));
}

/** Deterministic 64-char transaction hash. */
export function testTxHash(label: string): string {
  return seedBytes(`e2e-tx:${label}`).toString('hex');
}

/** Horizon `GET /accounts/:id` response body. */
export function buildHorizonAccount(options: AccountOptions = {}) {
  const account = testKeypair(options.seed ?? 'primary').publicKey();
  const balances = (options.balances ?? [{ asset: 'native', balance: '10000.0000000' }]).map((b) =>
    b.asset === 'native'
      ? { asset_type: 'native', balance: b.balance, buying_liabilities: '0.0000000', selling_liabilities: '0.0000000' }
      : {
          asset_type: b.asset.code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12',
          asset_code: b.asset.code,
          asset_issuer: b.asset.issuer,
          balance: b.balance,
          limit: '922337203685.4775807',
          buying_liabilities: '0.0000000',
          selling_liabilities: '0.0000000',
          is_authorized: true,
        }
  );
  const t = options.thresholds ?? { low: 0, med: 0, high: 0 };
  return {
    id: account,
    account_id: account,
    sequence: options.sequence ?? '4294967296',
    subentry_count: options.subentryCount ?? balances.length - 1,
    last_modified_ledger: 1000,
    thresholds: { low_threshold: t.low, med_threshold: t.med, high_threshold: t.high },
    flags: { auth_required: false, auth_revocable: false, auth_immutable: false, auth_clawback_enabled: false },
    balances,
    signers: options.signers ?? [{ key: account, weight: 1, type: 'ed25519_public_key' }],
    data: {},
    num_sponsoring: 0,
    num_sponsored: 0,
    paging_token: account,
    _links: {},
  };
}

/** Horizon collection envelope. */
export function horizonPage<T>(records: T[]) {
  return { _links: { self: { href: '' }, next: { href: '' }, prev: { href: '' } }, _embedded: { records } };
}

/** Horizon transaction record. */
export function buildTransactionRecord(label: string, source: string, overrides: Record<string, unknown> = {}) {
  const txHash = testTxHash(label);
  return {
    id: txHash,
    hash: txHash,
    paging_token: txHash,
    successful: true,
    ledger: 1000,
    created_at: '2026-09-01T12:00:00Z',
    source_account: source,
    fee_charged: '100',
    max_fee: '100',
    operation_count: 1,
    memo_type: 'none',
    ...overrides,
  };
}

/** Horizon payment operation record. */
export function buildPaymentRecord(label: string, from: string, to: string, amount = '25.0000000') {
  return {
    id: testTxHash(`op:${label}`).slice(0, 19).replace(/[a-f]/g, '1'),
    type: 'payment',
    type_i: 1,
    transaction_hash: testTxHash(label),
    created_at: '2026-09-01T12:00:00Z',
    source_account: from,
    from,
    to,
    amount,
    asset_type: 'native',
    transaction_successful: true,
  };
}

/** Horizon ledger record; `sequence` also seeds the hash so records stay stable. */
export function buildLedgerRecord(sequence: number) {
  const ledgerHash = testTxHash(`ledger:${sequence}`);
  return {
    id: ledgerHash,
    hash: ledgerHash,
    paging_token: String(BigInt(sequence) << 32n),
    sequence,
    successful_transaction_count: 120,
    failed_transaction_count: 4,
    operation_count: 310,
    tx_set_operation_count: 318,
    closed_at: new Date(Date.UTC(2026, 8, 1, 12, 0, 0) + (sequence - 1000) * 5000).toISOString(),
    total_coins: '105443902087.3472865',
    fee_pool: '3902087.3472865',
    base_fee_in_stroops: 100,
    base_reserve_in_stroops: 5000000,
    max_tx_set_size: 1000,
    protocol_version: 22,
  };
}

/** Horizon `POST /transactions` success body. */
export function buildSubmitSuccess(label = 'submitted') {
  const txHash = testTxHash(label);
  return { hash: txHash, ledger: 1001, successful: true, envelope_xdr: '', result_xdr: 'AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAA=' };
}

/** Horizon `POST /transactions` failure body (HTTP 400). */
export function buildSubmitFailure(opCode = 'op_underfunded', txCode = 'tx_failed') {
  return {
    type: 'https://stellar.org/horizon-errors/transaction_failed',
    title: 'Transaction Failed',
    status: 400,
    detail: 'The transaction failed when submitted to the stellar network.',
    extras: { result_codes: { transaction: txCode, operations: [opCode] } },
  };
}

/** Horizon 404 problem document for an unfunded account. */
export function buildNotFound() {
  return {
    type: 'https://stellar.org/horizon-errors/not_found',
    title: 'Resource Missing',
    status: 404,
    detail: 'The resource at the url requested was not found.',
  };
}
