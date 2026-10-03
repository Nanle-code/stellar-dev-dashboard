import * as StellarSdk from '@stellar/stellar-sdk';
import { TTL } from '../cache.js';
import { getCircuitBreaker } from '../errorHandling/CircuitBreaker';
import { getServer, stellarCache, type NetworkName } from './networks.js';

// ─── Cancellation ─────────────────────────────────────────────────────────────

/**
 * Per-request options accepted by the account-scoped Horizon readers.
 *
 * `signal` lets a caller abandon a read when the user switches account or network
 * (Issue #745). Every reader below is backwards compatible: omit the argument and
 * behaviour is unchanged.
 */
export interface HorizonRequestOptions {
  signal?: AbortSignal;
}

/** DOM-compatible abort error, usable where `DOMException` is unavailable. */
function createAbortError(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('The operation was aborted.', 'AbortError');
  }
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

/** Rejects immediately when `signal` is already aborted. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

/**
 * Rejects as soon as `signal` aborts, even when `promise` cannot itself be
 * cancelled. The Stellar SDK's `CallBuilder`/`loadAccount` do not accept an
 * `AbortSignal`, so the underlying HTTP request may still complete — but its result
 * is detached from the caller and can no longer overwrite current state.
 */
function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

// ─── Account ──────────────────────────────────────────────────────────────────

export async function fetchAccount(
  publicKey: string,
  network: NetworkName = 'testnet',
  options: HorizonRequestOptions = {}
): Promise<StellarSdk.Horizon.AccountResponse> {
  throwIfAborted(options.signal);

  const cacheKey = `account:${publicKey}:${network}`;
  const cached = stellarCache.get(cacheKey);
  if (cached) return cached;

  const breaker = getCircuitBreaker(`horizon:${network}`, { failureThreshold: 5, timeout: 30_000 });
  const server = getServer(network);
  const account = await withAbort(
    breaker.execute(() => server.loadAccount(publicKey)),
    options.signal
  );
  stellarCache.set(cacheKey, account, TTL.ACCOUNT, ['account', publicKey]);
  return account;
}

// ─── Transactions & Operations ────────────────────────────────────────────────

export async function fetchTransactions(
  publicKey: string,
  network: NetworkName = 'testnet',
  limit = 20,
  cursor: string | null = null,
  options: HorizonRequestOptions = {}
): Promise<{
  records: StellarSdk.Horizon.ServerApi.TransactionRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  throwIfAborted(options.signal);

  const cacheKey = `transactions:${publicKey}:${network}:${limit}:${cursor || 'null'}`;
  const cached = stellarCache.get(cacheKey);
  if (cached) return cached;

  const server = getServer(network);
  const request = server.transactions().forAccount(publicKey).order('desc').limit(limit);

  if (cursor) request.cursor(cursor);

  const txs = await withAbort(request.call(), options.signal);
  const records = txs.records || [];
  const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null;

  const result = {
    records,
    nextCursor,
    hasMore: records.length === limit && !!nextCursor,
  };
  stellarCache.set(cacheKey, result, TTL.TRANSACTIONS, ['transactions', publicKey]);
  return result;
}

export async function fetchOperations(
  publicKey: string,
  network: NetworkName = 'testnet',
  limit = 20,
  cursor: string | null = null,
  options: HorizonRequestOptions = {}
): Promise<{
  records: StellarSdk.Horizon.ServerApi.OperationRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  throwIfAborted(options.signal);

  const cacheKey = `operations:${publicKey}:${network}:${limit}:${cursor || 'null'}`;
  const cached = stellarCache.get(cacheKey);
  if (cached) return cached;

  const server = getServer(network);
  const request = server.operations().forAccount(publicKey).order('desc').limit(limit);

  if (cursor) request.cursor(cursor);

  const ops = await withAbort(request.call(), options.signal);
  const records = ops.records || [];
  const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null;

  const result = {
    records,
    nextCursor,
    hasMore: records.length === limit && !!nextCursor,
  };
  stellarCache.set(cacheKey, result, TTL.OPERATIONS, ['operations', publicKey]);
  return result;
}

export async function fetchAccountOffers(
  publicKey: string,
  network: NetworkName = 'testnet',
  options: HorizonRequestOptions = {}
): Promise<StellarSdk.Horizon.ServerApi.OfferRecord[]> {
  throwIfAborted(options.signal);

  const cacheKey = `offers:${publicKey}:${network}`;
  const cached = stellarCache.get(cacheKey);
  if (cached) return cached;

  const server = getServer(network);
  const offers = await withAbort(server.offers().forAccount(publicKey).call(), options.signal);
  const records = offers.records || [];
  stellarCache.set(cacheKey, records, TTL.ACCOUNT, ['offers', publicKey]);
  return records;
}

export async function fetchTransactionDetails(
  hash: string,
  network: NetworkName = 'testnet'
): Promise<{
  transaction: StellarSdk.Horizon.ServerApi.TransactionRecord;
  operations: StellarSdk.Horizon.ServerApi.OperationRecord[];
}> {
  const cacheKey = `transaction-details:${hash}:${network}`;
  const cached = stellarCache.get(cacheKey);
  if (cached) return cached;

  const server = getServer(network);
  const [transaction, opsResponse] = await Promise.all([
    server.transactions().transaction(hash).call(),
    server.operations().forTransaction(hash).call(),
  ]);

  const result = {
    transaction,
    operations: opsResponse.records || [],
  };

  stellarCache.set(cacheKey, result, TTL.TRANSACTIONS, ['transactions', hash]);
  return result;
}

// ─── Operation labels ───────────────────────────────────────────────────────────

export const OPERATION_LABELS: Record<string, string> = {
  create_account: 'Create Account',
  payment: 'Payment',
  path_payment_strict_send: 'Path Payment (Send)',
  path_payment_strict_receive: 'Path Payment (Receive)',
  manage_buy_offer: 'Buy Offer',
  manage_sell_offer: 'Sell Offer',
  create_passive_sell_offer: 'Create Passive Sell Offer',
  set_options: 'Set Options',
  change_trust: 'Change Trust',
  allow_trust: 'Allow Trust',
  account_merge: 'Account Merge',
  manage_data: 'Manage Data',
  bump_sequence: 'Bump Sequence',
  create_claimable_balance: 'Create Claimable Balance',
  claim_claimable_balance: 'Claim Claimable Balance',
  begin_sponsoring_future_reserves: 'Begin Sponsoring Future Reserves',
  end_sponsoring_future_reserves: 'End Sponsoring Future Reserves',
  revoke_sponsorship: 'Revoke Sponsorship',
  clawback: 'Clawback',
  clawback_claimable_balance: 'Clawback Claimable Balance',
  set_trust_line_flags: 'Set Trustline Flags',
  liquidity_pool_deposit: 'Liquidity Pool Deposit',
  liquidity_pool_withdraw: 'Liquidity Pool Withdraw',
  invoke_host_function: 'Contract Call',
  extend_footprint_ttl: 'Extend Footprint TTL',
  restore_footprint: 'Restore Footprint',
};

function titleCaseLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getOperationLabel(type: string): string {
  return OPERATION_LABELS[type] || titleCaseLabel(type);
}

export async function fetchAccountCreationDate(
  publicKey: string,
  network: NetworkName = 'testnet',
  options: HorizonRequestOptions = {}
): Promise<string | null> {
  throwIfAborted(options.signal);

  const cacheKey = `creation-date:${publicKey}:${network}`;
  const cached = stellarCache.get(cacheKey);
  if (cached) return cached;

  const server = getServer(network);

  try {
    const ops = await withAbort(
      server.operations().forAccount(publicKey).order('asc').limit(1).call(),
      options.signal
    );

    const operation = ops.records[0];
    const date = operation?.type === 'create_account' ? operation.created_at || null : null;

    if (date) {
      stellarCache.set(cacheKey, date, TTL.ACCOUNT, ['account', publicKey]);
    }
    return date;
  } catch (error) {
    // A creation date is best-effort, but an abort is not a "no date found" —
    // swallowing it would let a cancelled read resolve and clear current state.
    if ((error as Error | undefined)?.name === 'AbortError') throw error;
    return null;
  }
}

export function streamLedgers(
  callback: (_ledger: StellarSdk.Horizon.ServerApi.LedgerRecord) => void,
  network: NetworkName = 'testnet'
): () => void {
  const server = getServer(network);
  return server
    .ledgers()
    .cursor('now')
    .stream({
      onmessage: (page) => {
        if (page?.records?.length) {
          page.records.forEach((ledger) => callback(ledger));
        }
      },
      onerror: (error) => console.error('Ledger stream error:', error),
    });
  }

// ─── Network stats ────────────────────────────────────────────────────────────

export interface NetworkStats {
  latestLedger: StellarSdk.Horizon.ServerApi.LedgerRecord;
  feeStats: StellarSdk.Horizon.HorizonApi.FeeStatsResponse;
}

export async function fetchNetworkStats(network: NetworkName = 'testnet'): Promise<NetworkStats> {
  const cacheKey = `network-stats:${network}`;
  const cached = stellarCache.get(cacheKey);
  if (cached) return cached;

  const breaker = getCircuitBreaker(`horizon:${network}`, { failureThreshold: 5, timeout: 30_000 });
  const server = getServer(network);
  const [ledger, feeStats] = await breaker.execute(() =>
    Promise.all([server.ledgers().order('desc').limit(1).call(), server.feeStats()])
  );
  const result = {
    latestLedger: ledger.records[0],
    feeStats,
  };
  stellarCache.set(cacheKey, result, TTL.LEDGER, ['network-stats', network]);
  return result;
}
