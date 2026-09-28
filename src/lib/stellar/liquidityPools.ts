import * as StellarSdk from '@stellar/stellar-sdk';
import { NETWORKS, getServer, type NetworkName } from './networks.js';
import { fetchAccount } from './horizon.js';
import type { PathAsset } from './paths.js';

// ─── Liquidity pools ─────────────────────────────────────────────────────────

export interface LiquidityPoolReserve {
  asset: string;
  amount: string;
}

export interface LiquidityPoolRecord {
  id: string;
  paging_token?: string;
  fee_bp?: number;
  type?: string;
  total_trustlines?: string | number;
  total_shares?: string;
  reserves?: LiquidityPoolReserve[];
}

export interface LiquidityPoolPosition {
  poolId: string;
  balance: string;
  limit?: string;
  sharePercent: number;
  pool: LiquidityPoolRecord | null;
}

interface AccountLiquidityPoolBalance {
  asset_type: 'liquidity_pool_shares';
  liquidity_pool_id: string;
  balance: string;
  limit?: string;
}

function horizonUrl(network: NetworkName, path: string): string {
  return `${NETWORKS[network]?.horizonUrl || NETWORKS.testnet.horizonUrl}${path}`;
}

async function horizonJson<T>(network: NetworkName, path: string): Promise<T> {
  const response = await fetch(horizonUrl(network, path));
  if (!response.ok) throw new Error(`Horizon request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function poolAssetString(asset: PathAsset | string): string {
  if (typeof asset === 'string') return asset === 'XLM' ? 'native' : asset;
  if (asset.type === 'native') return 'native';
  return `${asset.code}:${asset.issuer}`;
}

function poolRecords(payload: {
  _embedded?: { records?: LiquidityPoolRecord[] };
  records?: LiquidityPoolRecord[];
}): LiquidityPoolRecord[] {
  return payload._embedded?.records ?? payload.records ?? [];
}

export async function fetchLiquidityPools(
  network: NetworkName = 'testnet',
  limit = 50,
  reserves?: Array<PathAsset | string>
): Promise<LiquidityPoolRecord[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (reserves?.length) {
    params.set('reserves', reserves.map(poolAssetString).join(','));
  }

  const data = await horizonJson<{ _embedded?: { records?: LiquidityPoolRecord[] } }>(
    network,
    `/liquidity_pools?${params.toString()}`
  );
  return poolRecords(data);
}

export function fetchLiquidityPoolsByAssetPair(
  assetA: PathAsset | string,
  assetB: PathAsset | string,
  network: NetworkName = 'testnet',
  limit = 50
): Promise<LiquidityPoolRecord[]> {
  return fetchLiquidityPools(network, limit, [assetA, assetB]);
}

export function fetchLiquidityPoolById(
  poolId: string,
  network: NetworkName = 'testnet'
): Promise<LiquidityPoolRecord> {
  return horizonJson<LiquidityPoolRecord>(
    network,
    `/liquidity_pools/${encodeURIComponent(poolId)}`
  );
}

export async function fetchLiquidityPoolOperations(
  poolId: string,
  network: NetworkName = 'testnet',
  limit = 50
): Promise<StellarSdk.Horizon.ServerApi.OperationRecord[]> {
  const params = new URLSearchParams({ order: 'desc', limit: String(limit) });
  const data = await horizonJson<{
    _embedded?: { records?: StellarSdk.Horizon.ServerApi.OperationRecord[] };
  }>(network, `/liquidity_pools/${encodeURIComponent(poolId)}/operations?${params.toString()}`);
  return data._embedded?.records ?? [];
}

export async function fetchAccountLiquidityPoolPositions(
  publicKey: string,
  network: NetworkName = 'testnet'
): Promise<LiquidityPoolPosition[]> {
  const account = await fetchAccount(publicKey, network);
  const balances = account.balances.filter(
    (balance) => balance.asset_type === 'liquidity_pool_shares'
  ) as AccountLiquidityPoolBalance[];

  return Promise.all(
    balances.map(async (balance) => {
      let pool: LiquidityPoolRecord | null = null;
      try {
        pool = await fetchLiquidityPoolById(balance.liquidity_pool_id, network);
      } catch {
        pool = null;
      }

      const shares = parseFloat(balance.balance);
      const totalShares = parseFloat(pool?.total_shares ?? '0');

      return {
        poolId: balance.liquidity_pool_id,
        balance: balance.balance,
        limit: balance.limit,
        sharePercent: totalShares > 0 ? (shares / totalShares) * 100 : 0,
        pool,
      };
    })
  );
}

export async function fetchAccountLiquidityPoolHistory(
  publicKey: string,
  network: NetworkName = 'testnet',
  limit = 50,
  poolId: string | null = null
): Promise<StellarSdk.Horizon.ServerApi.OperationRecord[]> {
  const server = getServer(network);
  const ops = await server.operations().forAccount(publicKey).order('desc').limit(limit).call();
  return (ops.records || []).filter((op) => {
    const isPoolOperation =
      op.type === 'liquidity_pool_deposit' || op.type === 'liquidity_pool_withdraw';
    if (!isPoolOperation) return false;
    return !poolId || (op as { liquidity_pool_id?: string }).liquidity_pool_id === poolId;
  });
}
