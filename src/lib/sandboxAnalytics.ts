/**
 * Sandbox Analytics Service and Utilities (#908)
 *
 * Provides safe, validated retrieval and analytics aggregation for sandbox
 * account and trade datasets without requiring Mainnet credentials.
 */

import {
  SAMPLE_SANDBOX_ACCOUNTS,
  SAMPLE_SANDBOX_TRADES,
  type SandboxAccount,
  type SandboxTrade,
  type AccountArchetype,
  type TradeType,
} from '../fixtures/sandboxDatasets';

export type SandboxDatasetErrorCode =
  'INVALID_INPUT' | 'UNSUPPORTED_ENVIRONMENT' | 'DATASET_NOT_FOUND' | 'VALIDATION_FAILED';

export class SandboxDatasetError extends Error {
  code: SandboxDatasetErrorCode;
  details?: Record<string, unknown>;

  constructor(code: SandboxDatasetErrorCode, message: string, details?: Record<string, unknown>) {
    super(`[SandboxAnalytics:${code}] ${message}`);
    this.name = 'SandboxDatasetError';
    this.code = code;
    this.details = details;
  }
}

export interface SandboxEnvOptions {
  environment?: string;
  allowMainnetDemo?: boolean;
}

export interface SandboxAccountFilter {
  archetype?: AccountArchetype;
  assetCode?: string;
  minNativeBalance?: number;
  tag?: string;
}

export interface SandboxTradeQuery {
  baseAsset?: string;
  counterAsset?: string;
  tradeType?: TradeType;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export interface TradeAnalyticsMetrics {
  tradeCount: number;
  totalVolumeBase: number;
  totalVolumeCounter: number;
  vwap: number;
  openPrice: number | null;
  closePrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  priceChange: number;
  priceChangePercent: number;
  buyVolume: number;
  sellVolume: number;
  orderbookCount: number;
  liquidityPoolCount: number;
}

export interface AssetAllocationItem {
  code: string;
  amount: number;
  valueUsd: number;
  percentage: number;
}

export interface PortfolioAnalyticsMetrics {
  totalValueUsd: number;
  allocations: AssetAllocationItem[];
  diversificationScore: number;
  concentrationRisks: Array<{ asset: string; percentage: number; riskLevel: 'medium' | 'high' }>;
}

// ── Environment Guard ────────────────────────────────────────────────────────

const SUPPORTED_ENVIRONMENTS = new Set([
  'testnet',
  'futurenet',
  'local',
  'standalone',
  'sandbox',
  'development',
  'test',
]);

const RESTRICTED_MAINNET_ENVIRONMENTS = new Set(['mainnet', 'public', 'production']);

/**
 * Check if the specified environment supports sandbox demo datasets.
 */
export function isEnvironmentSupported(
  environment?: string,
  options?: { allowMainnetDemo?: boolean }
): boolean {
  if (options?.allowMainnetDemo) return true;
  if (!environment) return true; // defaults to safe development/sandbox

  const normalized = environment.trim().toLowerCase();
  if (RESTRICTED_MAINNET_ENVIRONMENTS.has(normalized)) {
    return false;
  }
  return SUPPORTED_ENVIRONMENTS.has(normalized) || !RESTRICTED_MAINNET_ENVIRONMENTS.has(normalized);
}

/**
 * Assert environment safety. Throws UNSUPPORTED_ENVIRONMENT if called on Mainnet without an explicit override.
 */
export function assertEnvironmentSupported(options?: SandboxEnvOptions): void {
  const env = options?.environment || 'sandbox';
  const normalized = env.trim().toLowerCase();

  if (RESTRICTED_MAINNET_ENVIRONMENTS.has(normalized) && !options?.allowMainnetDemo) {
    throw new SandboxDatasetError(
      'UNSUPPORTED_ENVIRONMENT',
      `Sandbox demo datasets are not permitted on '${env}' to prevent confusing simulated accounts with live mainnet credentials. Set 'allowMainnetDemo: true' to force demo simulation.`,
      { environment: env }
    );
  }
}

// ── Account Retrieval ────────────────────────────────────────────────────────

/**
 * Retrieve sandbox accounts with optional filtering.
 */
export function getSandboxAccounts(
  filter?: SandboxAccountFilter,
  options?: SandboxEnvOptions
): SandboxAccount[] {
  assertEnvironmentSupported(options);

  if (filter?.minNativeBalance !== undefined) {
    if (
      typeof filter.minNativeBalance !== 'number' ||
      isNaN(filter.minNativeBalance) ||
      filter.minNativeBalance < 0
    ) {
      throw new SandboxDatasetError(
        'INVALID_INPUT',
        'minNativeBalance must be a non-negative number.',
        {
          minNativeBalance: filter.minNativeBalance,
        }
      );
    }
  }

  if (filter?.archetype !== undefined) {
    const validArchetypes: AccountArchetype[] = [
      'retail_active',
      'institutional_market_maker',
      'soroban_dapp_treasury',
      'new_onboarded_sandbox',
    ];
    if (!validArchetypes.includes(filter.archetype)) {
      throw new SandboxDatasetError(
        'INVALID_INPUT',
        `Unknown account archetype: '${filter.archetype}'.`,
        {
          archetype: filter.archetype,
          validArchetypes,
        }
      );
    }
  }

  return SAMPLE_SANDBOX_ACCOUNTS.filter((acc) => {
    if (filter?.archetype && acc.archetype !== filter.archetype) {
      return false;
    }
    if (filter?.tag && !acc.tags.includes(filter.tag.toLowerCase())) {
      return false;
    }
    if (filter?.assetCode) {
      const target = filter.assetCode.toUpperCase();
      const hasAsset = acc.balances.some((b) =>
        b.asset_type === 'native' ? target === 'XLM' : b.asset_code === target
      );
      if (!hasAsset) return false;
    }
    if (filter?.minNativeBalance !== undefined) {
      const nativeBalance = acc.balances.find((b) => b.asset_type === 'native');
      const amount = nativeBalance ? parseFloat(nativeBalance.balance) : 0;
      if (amount < filter.minNativeBalance) return false;
    }
    return true;
  });
}

/**
 * Retrieve a single sandbox account by its public key ID.
 */
export function getSandboxAccountById(
  accountId: string,
  options?: SandboxEnvOptions
): SandboxAccount {
  assertEnvironmentSupported(options);

  if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
    throw new SandboxDatasetError('INVALID_INPUT', 'accountId must be a non-empty string.');
  }

  const trimmed = accountId.trim();
  if (!trimmed.startsWith('G') || trimmed.length !== 56) {
    throw new SandboxDatasetError(
      'INVALID_INPUT',
      `Invalid Stellar public key format: '${trimmed}'. Expected 56 characters starting with 'G'.`
    );
  }

  const found = SAMPLE_SANDBOX_ACCOUNTS.find(
    (acc) => acc.id === trimmed || acc.account_id === trimmed
  );

  if (!found) {
    throw new SandboxDatasetError(
      'DATASET_NOT_FOUND',
      `No sandbox account found matching ID '${trimmed}'.`,
      { accountId: trimmed }
    );
  }

  return found;
}

// ── Trade Retrieval ──────────────────────────────────────────────────────────

function normalizeAssetCode(code?: string, type?: string): string {
  if (!code || type === 'native' || code === 'native') return 'XLM';
  return code.toUpperCase();
}

/**
 * Retrieve sandbox DEX & Liquidity Pool trades with filtering & pagination.
 */
export function getSandboxTrades(
  query?: SandboxTradeQuery,
  options?: SandboxEnvOptions
): SandboxTrade[] {
  assertEnvironmentSupported(options);

  const limit = query?.limit ?? 50;
  const offset = query?.offset ?? 0;

  if (typeof limit !== 'number' || limit < 0 || isNaN(limit)) {
    throw new SandboxDatasetError('INVALID_INPUT', 'limit must be a non-negative number.', {
      limit,
    });
  }

  if (typeof offset !== 'number' || offset < 0 || isNaN(offset)) {
    throw new SandboxDatasetError('INVALID_INPUT', 'offset must be a non-negative number.', {
      offset,
    });
  }

  if (limit === 0) {
    return [];
  }

  let startTs: number | null = null;
  let endTs: number | null = null;

  if (query?.startTime) {
    startTs = Date.parse(query.startTime);
    if (isNaN(startTs)) {
      throw new SandboxDatasetError(
        'INVALID_INPUT',
        `Invalid startTime format: '${query.startTime}'. Expected ISO-8601.`
      );
    }
  }

  if (query?.endTime) {
    endTs = Date.parse(query.endTime);
    if (isNaN(endTs)) {
      throw new SandboxDatasetError(
        'INVALID_INPUT',
        `Invalid endTime format: '${query.endTime}'. Expected ISO-8601.`
      );
    }
  }

  if (startTs !== null && endTs !== null && startTs > endTs) {
    throw new SandboxDatasetError('INVALID_INPUT', 'startTime cannot be later than endTime.', {
      startTime: query?.startTime,
      endTime: query?.endTime,
    });
  }

  const filtered = SAMPLE_SANDBOX_TRADES.filter((trade) => {
    if (query?.tradeType && trade.trade_type !== query.tradeType) {
      return false;
    }

    if (query?.baseAsset) {
      const baseNormalized = normalizeAssetCode(query.baseAsset);
      const tradeBase = normalizeAssetCode(trade.base_asset_code, trade.base_asset_type);
      if (tradeBase !== baseNormalized) return false;
    }

    if (query?.counterAsset) {
      const counterNormalized = normalizeAssetCode(query.counterAsset);
      const tradeCounter = normalizeAssetCode(trade.counter_asset_code, trade.counter_asset_type);
      if (tradeCounter !== counterNormalized) return false;
    }

    if (startTs !== null || endTs !== null) {
      const tradeTime = Date.parse(trade.ledger_close_time);
      if (startTs !== null && tradeTime < startTs) return false;
      if (endTs !== null && tradeTime > endTs) return false;
    }

    return true;
  });

  return filtered.slice(offset, offset + limit);
}

// ── Analytics Aggregation ───────────────────────────────────────────────────

/**
 * Calculate comprehensive market analytics for a set of trades (VWAP, OHLC, volume).
 */
export function calculateTradeMetrics(trades: SandboxTrade[]): TradeAnalyticsMetrics {
  if (!trades || trades.length === 0) {
    return {
      tradeCount: 0,
      totalVolumeBase: 0,
      totalVolumeCounter: 0,
      vwap: 0,
      openPrice: null,
      closePrice: null,
      highPrice: null,
      lowPrice: null,
      priceChange: 0,
      priceChangePercent: 0,
      buyVolume: 0,
      sellVolume: 0,
      orderbookCount: 0,
      liquidityPoolCount: 0,
    };
  }

  let totalVolumeBase = 0;
  let totalVolumeCounter = 0;
  let totalVolumeWeightedPrice = 0;
  let buyVolume = 0;
  let sellVolume = 0;
  let orderbookCount = 0;
  let liquidityPoolCount = 0;

  const prices: number[] = [];

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    const baseAmt = parseFloat(trade.base_amount) || 0;
    const counterAmt = parseFloat(trade.counter_amount) || 0;
    const price = parseFloat(trade.price_r) || trade.price.n / trade.price.d || 0;

    totalVolumeBase += baseAmt;
    totalVolumeCounter += counterAmt;
    totalVolumeWeightedPrice += price * baseAmt;

    if (trade.base_is_seller) {
      sellVolume += baseAmt;
    } else {
      buyVolume += baseAmt;
    }

    if (trade.trade_type === 'liquidity_pool') {
      liquidityPoolCount++;
    } else {
      orderbookCount++;
    }

    prices.push(price);
  }

  const openPrice = prices[0];
  const closePrice = prices[prices.length - 1];
  const highPrice = Math.max(...prices);
  const lowPrice = Math.min(...prices);

  const priceChange = closePrice - openPrice;
  const priceChangePercent = openPrice > 0 ? (priceChange / openPrice) * 100 : 0;
  const vwap = totalVolumeBase > 0 ? totalVolumeWeightedPrice / totalVolumeBase : closePrice;

  return {
    tradeCount: trades.length,
    totalVolumeBase: Number(totalVolumeBase.toFixed(7)),
    totalVolumeCounter: Number(totalVolumeCounter.toFixed(7)),
    vwap: Number(vwap.toFixed(7)),
    openPrice,
    closePrice,
    highPrice,
    lowPrice,
    priceChange: Number(priceChange.toFixed(7)),
    priceChangePercent: Number(priceChangePercent.toFixed(2)),
    buyVolume: Number(buyVolume.toFixed(7)),
    sellVolume: Number(sellVolume.toFixed(7)),
    orderbookCount,
    liquidityPoolCount,
  };
}

/**
 * Calculate portfolio analytics and asset distribution for a sandbox account.
 */
export function calculatePortfolioMetrics(
  account: SandboxAccount,
  customPrices?: Record<string, number>
): PortfolioAnalyticsMetrics {
  const defaultPrices: Record<string, number> = {
    XLM: 0.125,
    USDC: 1.0,
    EURT: 1.08,
    AQUA: 0.0055,
    BTC: 65000,
    ...(customPrices || {}),
  };

  if (!account || !account.balances || account.balances.length === 0) {
    return {
      totalValueUsd: 0,
      allocations: [],
      diversificationScore: 0,
      concentrationRisks: [],
    };
  }

  const items = account.balances.map((b) => {
    const code = b.asset_type === 'native' ? 'XLM' : b.asset_code || 'UNKNOWN';
    const amount = parseFloat(b.balance) || 0;
    const unitPrice = defaultPrices[code] ?? 0;
    const valueUsd = amount * unitPrice;
    return { code, amount, valueUsd };
  });

  const totalValueUsd = items.reduce((sum, item) => sum + item.valueUsd, 0);

  const allocations: AssetAllocationItem[] = items.map((item) => ({
    code: item.code,
    amount: item.amount,
    valueUsd: Number(item.valueUsd.toFixed(2)),
    percentage: totalValueUsd > 0 ? Number(((item.valueUsd / totalValueUsd) * 100).toFixed(2)) : 0,
  }));

  // Diversification score using Herfindahl-Hirschman Index (HHI)
  let diversificationScore = 0;
  if (allocations.length > 1 && totalValueUsd > 0) {
    const hhi = allocations.reduce((sum, a) => sum + Math.pow(a.percentage, 2), 0);
    const maxHHI = 10000;
    const minHHI = 10000 / allocations.length;
    diversificationScore = Math.max(
      0,
      Math.min(100, Math.round(((maxHHI - hhi) / (maxHHI - minHHI)) * 100))
    );
  }

  const concentrationRisks = allocations
    .filter((a) => a.percentage > 25)
    .map((a) => ({
      asset: a.code,
      percentage: a.percentage,
      riskLevel: (a.percentage > 50 ? 'high' : 'medium') as 'high' | 'medium',
    }));

  return {
    totalValueUsd: Number(totalValueUsd.toFixed(2)),
    allocations,
    diversificationScore,
    concentrationRisks,
  };
}

// ── Schema Validation ────────────────────────────────────────────────────────

/**
 * Validate that an unknown object conforms to the SandboxAccount[] schema.
 */
export function validateAccountDataset(data: unknown): asserts data is SandboxAccount[] {
  if (!Array.isArray(data)) {
    throw new SandboxDatasetError('VALIDATION_FAILED', 'Account dataset must be an array.');
  }

  data.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new SandboxDatasetError(
        'VALIDATION_FAILED',
        `Record at index ${index} is not an object.`
      );
    }
    const acc = item as Partial<SandboxAccount>;
    if (!acc.id || typeof acc.id !== 'string') {
      throw new SandboxDatasetError(
        'VALIDATION_FAILED',
        `Record at index ${index} is missing string 'id'.`
      );
    }
    if (!acc.sequence || typeof acc.sequence !== 'string') {
      throw new SandboxDatasetError(
        'VALIDATION_FAILED',
        `Record at index ${index} is missing string 'sequence'.`
      );
    }
    if (!Array.isArray(acc.balances)) {
      throw new SandboxDatasetError(
        'VALIDATION_FAILED',
        `Record at index ${index} is missing array 'balances'.`
      );
    }
    acc.balances.forEach((bal, bIdx) => {
      if (!bal.asset_type || typeof bal.balance !== 'string' || isNaN(parseFloat(bal.balance))) {
        throw new SandboxDatasetError(
          'VALIDATION_FAILED',
          `Invalid balance in account ${acc.id} at index ${bIdx}.`
        );
      }
    });
    if (!Array.isArray(acc.signers)) {
      throw new SandboxDatasetError(
        'VALIDATION_FAILED',
        `Record at index ${index} is missing array 'signers'.`
      );
    }
  });
}

/**
 * Validate that an unknown object conforms to the SandboxTrade[] schema.
 */
export function validateTradeDataset(data: unknown): asserts data is SandboxTrade[] {
  if (!Array.isArray(data)) {
    throw new SandboxDatasetError('VALIDATION_FAILED', 'Trade dataset must be an array.');
  }

  data.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new SandboxDatasetError(
        'VALIDATION_FAILED',
        `Trade record at index ${index} is not an object.`
      );
    }
    const trade = item as Partial<SandboxTrade>;
    if (!trade.id || typeof trade.id !== 'string') {
      throw new SandboxDatasetError(
        'VALIDATION_FAILED',
        `Trade at index ${index} is missing string 'id'.`
      );
    }
    if (!trade.ledger_close_time || isNaN(Date.parse(trade.ledger_close_time))) {
      throw new SandboxDatasetError(
        'VALIDATION_FAILED',
        `Trade at index ${index} has invalid 'ledger_close_time'.`
      );
    }
    if (!trade.base_amount || isNaN(parseFloat(trade.base_amount))) {
      throw new SandboxDatasetError(
        'VALIDATION_FAILED',
        `Trade at index ${index} has invalid 'base_amount'.`
      );
    }
    if (!trade.counter_amount || isNaN(parseFloat(trade.counter_amount))) {
      throw new SandboxDatasetError(
        'VALIDATION_FAILED',
        `Trade at index ${index} has invalid 'counter_amount'.`
      );
    }
    if (!trade.price || typeof trade.price.n !== 'number' || typeof trade.price.d !== 'number') {
      throw new SandboxDatasetError(
        'VALIDATION_FAILED',
        `Trade at index ${index} is missing valid price ratio {n, d}.`
      );
    }
  });
}
