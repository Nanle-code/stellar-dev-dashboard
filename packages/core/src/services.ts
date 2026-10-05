import { getServer, type NetworkName } from './networks.js';
import type { AccountData, TransactionRecord, NetworkStats, XLMPrice } from './types/index.js';

const CACHE_PREFIX = 'stellar_cache_';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cacheStore: Map<string, { data: unknown; timestamp: number }> = new Map();

function getCached<T>(key: string): T | null {
  const fullKey = CACHE_PREFIX + key;
  const entry = cacheStore.get(fullKey);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cacheStore.delete(fullKey);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  const fullKey = CACHE_PREFIX + key;
  cacheStore.set(fullKey, { data, timestamp: Date.now() });
}

export async function fetchAccount(
  publicKey: string,
  network: NetworkName = 'testnet'
): Promise<AccountData> {
  const cacheKey = `account:${publicKey}:${network}`;
  const cached = getCached<AccountData>(cacheKey);
  if (cached) return cached;

  const server = getServer(network);
  const account = await server.loadAccount(publicKey);

  const result: AccountData = {
    id: account.id,
    account_id: account.account_id,
    sequence: account.sequence,
    subentry_count: account.subentry_count,
    balances: account.balances.map((b: any) => ({
      asset_type: b.asset_type,
      asset_code: b.asset_code,
      asset_issuer: b.asset_issuer,
      balance: b.balance,
      limit: b.limit,
    })),
    signers: account.signers.map((s: any) => ({
      key: s.key,
      type: s.type,
      weight: s.weight,
    })),
    thresholds: {
      low_threshold: account.thresholds.low_threshold,
      med_threshold: account.thresholds.med_threshold,
      high_threshold: account.thresholds.high_threshold,
    },
    last_modified_ledger: account.last_modified_ledger,
  };

  setCache(cacheKey, result);
  return result;
}

export interface TransactionFetchResult {
  records: TransactionRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function fetchTransactions(
  publicKey: string,
  network: NetworkName = 'testnet',
  limit = 20,
  cursor: string | null = null
): Promise<TransactionFetchResult> {
  const server = getServer(network);
  const request = server.transactions().forAccount(publicKey).order('desc').limit(limit);
  if (cursor) request.cursor(cursor);

  const txs = await request.call();
  const records: TransactionRecord[] = (txs.records || []).map((tx: any) => ({
    id: tx.id,
    hash: tx.hash,
    source_account: tx.source_account,
    created_at: tx.created_at,
    fee_charged: tx.fee_charged,
    fee: tx.fee,
    memo: tx.memo,
    memo_type: tx.memo_type,
    operation_count: tx.operation_count,
    successful: tx.successful,
    paging_token: tx.paging_token,
  }));

  const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null;

  return {
    records,
    nextCursor,
    hasMore: records.length === limit && !!nextCursor,
  };
}

export async function fetchNetworkStats(network: NetworkName = 'testnet'): Promise<NetworkStats> {
  const cacheKey = `network-stats:${network}`;
  const cached = getCached<NetworkStats>(cacheKey);
  if (cached) return cached;

  const server = getServer(network);
  const [ledger, feeStats] = await Promise.all([
    server.ledgers().order('desc').limit(1).call(),
    server.feeStats(),
  ]);

  const result: NetworkStats = {
    latestLedger: ledger.records[0],
    feeStats,
  };

  setCache(cacheKey, result);
  return result;
}

export async function fundTestnetAccount(publicKey: string): Promise<any> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (!res.ok) throw new Error('Faucet request failed');
  return res.json();
}

export async function fetchXLMPrice(): Promise<XLMPrice> {
  const cacheKey = 'xlm-price';
  const cached = getCached<XLMPrice>(cacheKey);
  if (cached) return cached;

  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd'
  );
  if (!res.ok) throw new Error('Price fetch failed');
  const data = await res.json();

  const result: XLMPrice = { usd: data?.stellar?.usd ?? 0 };
  setCache(cacheKey, result);
  return result;
}

export function clearCache(pattern?: string): void {
  if (pattern) {
    for (const key of cacheStore.keys()) {
      if (key.includes(pattern)) {
        cacheStore.delete(key);
      }
    }
  } else {
    cacheStore.clear();
  }
}