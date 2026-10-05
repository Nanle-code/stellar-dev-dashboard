import * as StellarSdk from '@stellar/stellar-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type NetworkName,
  type NetworkConfig,
  NETWORKS,
  getServer as coreGetServer,
  getSorobanServer as coreGetSorobanServer,
  isValidPublicKey,
  shortAddress,
  formatXLM,
  fetchAccount as coreFetchAccount,
  fetchTransactions as coreFetchTransactions,
  fetchNetworkStats as coreFetchNetworkStats,
  fundTestnetAccount as coreFundTestnetAccount,
  fetchXLMPrice as coreFetchXLMPrice,
  calculateAccountReserves,
  OPERATION_LABELS,
  getOperationLabel,
  type AccountData,
  type NetworkStats,
} from '@stellar-dev-dashboard/core';

export { type NetworkName, type NetworkConfig, NETWORKS };
export { isValidPublicKey, shortAddress, formatXLM };
export { calculateAccountReserves };
export { OPERATION_LABELS, getOperationLabel };
export { StellarSdk };

export function getServer(network: NetworkName = 'testnet'): StellarSdk.Horizon.Server {
  return coreGetServer(network);
}

export function getSorobanServer(network: NetworkName = 'testnet'): StellarSdk.SorobanRpc.Server {
  return coreGetSorobanServer(network);
}

const CACHE_PREFIX = 'stellar_cache_';
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

async function setCache(key: string, data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch {}
}

export async function fetchAccount(
  publicKey: string,
  network: NetworkName = 'testnet',
): Promise<AccountData> {
  const cacheKey = `account:${publicKey}:${network}`;
  const cached = await getCached<AccountData>(cacheKey);
  if (cached) return cached;

  const result = await coreFetchAccount(publicKey, network);
  await setCache(cacheKey, result);
  return result;
}

export async function fetchTransactions(
  publicKey: string,
  network: NetworkName = 'testnet',
  limit = 20,
  cursor: string | null = null,
): Promise<{
  records: any[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const cacheKey = `tx:${publicKey}:${network}:${limit}:${cursor || ''}`;
  const cached = await getCached<{
    records: any[];
    nextCursor: string | null;
    hasMore: boolean;
  }>(cacheKey);
  if (cached) return cached;

  const result = await coreFetchTransactions(publicKey, network, limit, cursor);
  await setCache(cacheKey, result);
  return result;
}

export async function fetchOperations(
  publicKey: string,
  network: NetworkName = 'testnet',
  limit = 20,
  cursor: string | null = null,
): Promise<{
  records: any[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const server = getServer(network);
  const request = server.operations().forAccount(publicKey).order('desc').limit(limit);
  if (cursor) request.cursor(cursor);

  const ops = await request.call();
  const records = ops.records || [];
  const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null;

  return {
    records,
    nextCursor,
    hasMore: records.length === limit && !!nextCursor,
  };
}

export async function fetchNetworkStats(network: NetworkName = 'testnet'): Promise<NetworkStats> {
  const cacheKey = `network-stats:${network}`;
  const cached = await getCached<NetworkStats>(cacheKey);
  if (cached) return cached;

  const result = await coreFetchNetworkStats(network);
  await setCache(cacheKey, result);
  return result;
}

export async function fundTestnetAccount(publicKey: string): Promise<any> {
  return coreFundTestnetAccount(publicKey);
}

export async function fetchXLMPrice(): Promise<{ usd: number }> {
  const cacheKey = 'xlm-price';
  const cached = await getCached<{ usd: number }>(cacheKey);
  if (cached) return cached;

  const result = await coreFetchXLMPrice();
  await setCache(cacheKey, result);
  return result;
}