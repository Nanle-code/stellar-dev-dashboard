import { fetchLiquidityPools, fetchPoolById, fetchAccountLiquidityPoolPositions } from './dex';
import { fetchPrices } from './priceFeed';

// ─── Impermanent Loss ─────────────────────────────────────────────────────────

/**
 * Calculate impermanent loss given initial and current price ratio.
 * @param {number} initialPriceRatio  priceB/priceA at deposit time
 * @param {number} currentPriceRatio  priceB/priceA now
 * @returns {{ ilPercent: number, holdValue: number, poolValue: number }}
 */
export function calculateImpermanentLoss(initialPriceRatio, currentPriceRatio) {
  if (!initialPriceRatio || !currentPriceRatio || initialPriceRatio <= 0) {
    return { ilPercent: 0, holdValue: 1, poolValue: 1 };
  }
  const r = currentPriceRatio / initialPriceRatio;
  const poolValue = (2 * Math.sqrt(r)) / (1 + r);
  const holdValue = 1;
  const ilPercent = (poolValue - holdValue) * 100;
  return { ilPercent, holdValue, poolValue };
}

/**
 * Build a table of IL values across a range of price multipliers.
 */
export function buildILCurve(steps = 20) {
  const points = [];
  const multipliers = [];
  for (let i = 0; i <= steps; i++) {
    multipliers.push(0.1 + (i / steps) * 9.9); // 0.1x … 10x
  }
  for (const m of multipliers) {
    const { ilPercent } = calculateImpermanentLoss(1, m);
    points.push({ priceMultiplier: +m.toFixed(2), ilPercent: +ilPercent.toFixed(4) });
  }
  return points;
}

// ─── APY / Yield ──────────────────────────────────────────────────────────────

/**
 * Estimate APY from 24 h fee volume and total pool TVL.
 * @param {number} dailyFeeVolume  fees collected in last 24 h (same currency as tvl)
 * @param {number} tvl             total value locked
 * @param {number} feePct          pool fee percentage (default 0.3)
 */
export function estimatePoolAPY(dailyFeeVolume, tvl, feePct = 0.3) {
  if (!tvl || tvl <= 0) return 0;
  const dailyReturn = (dailyFeeVolume * (feePct / 100)) / tvl;
  return dailyReturn * 365 * 100; // annual %
}

/**
 * Estimate APY based on pool fee and 7-day average volume.
 */
export function estimateAPYFromPool(pool) {
  const tvl = parseFloat(pool.totalValueXLM) || 0;
  const vol7d = parseFloat(pool.volume7d) || parseFloat(pool.feeVolume) || 0;
  const dailyVol = vol7d / 7;
  return estimatePoolAPY(dailyVol, tvl, 0.3);
}

// ─── Risk Scoring ─────────────────────────────────────────────────────────────

const RISK_WEIGHTS = { tvl: 0.4, age: 0.2, volume: 0.2, assets: 0.2 };

/**
 * Produce a 0–100 risk score for a pool (lower = safer).
 */
export function scorePoolRisk(pool) {
  const tvl = parseFloat(pool.totalValueXLM) || 0;
  const tvlScore = tvl > 1_000_000 ? 10 : tvl > 100_000 ? 30 : tvl > 10_000 ? 55 : 80;

  const vol7d = parseFloat(pool.volume7d) || 0;
  const volScore = vol7d > 500_000 ? 10 : vol7d > 50_000 ? 30 : vol7d > 5_000 ? 60 : 85;

  // Penalise unknown/exotic assets
  const reserves = pool.reserves || [];
  const hasNative = reserves.some((r) => r.asset === 'native' || r.asset_type === 'native');
  const assetScore = hasNative ? 20 : 50;

  const score =
    tvlScore * RISK_WEIGHTS.tvl +
    20 * RISK_WEIGHTS.age + // age unknown → neutral
    volScore * RISK_WEIGHTS.volume +
    assetScore * RISK_WEIGHTS.assets;

  const label = score < 30 ? 'Low' : score < 60 ? 'Medium' : 'High';
  return { score: Math.round(score), label };
}

// ─── Protocol Comparison ──────────────────────────────────────────────────────

/** Known Stellar DeFi protocols keyed by anchor/issuer prefix */
const PROTOCOLS = {
  AQUA: { name: 'Aquarius', type: 'AMM', url: 'https://aqua.network' },
  USDC: { name: 'Circle USDC', type: 'Stablecoin', url: 'https://circle.com' },
  yXLM: { name: 'Ultra Stellar', type: 'Yield', url: 'https://ultrastellar.com' },
  SHX: { name: 'Stronghold', type: 'DEX', url: 'https://stronghold.co' },
  native: { name: 'Stellar AMM', type: 'Native AMM', url: 'https://stellar.org' },
};

export function identifyProtocol(asset) {
  const code = typeof asset === 'string' ? asset.split(':')[0] : 'native';
  return PROTOCOLS[code] || { name: code, type: 'Unknown', url: '' };
}

// ─── Portfolio Rebalancing ────────────────────────────────────────────────────

/**
 * Suggest rebalancing trades to reach a target allocation.
 * @param {Array<{asset: string, value: number}>} currentHoldings
 * @param {Object<string, number>} targetWeights  e.g. { XLM: 0.5, USDC: 0.5 }
 * @returns {Array<{asset: string, action: 'buy'|'sell', amount: number, currentPct: number, targetPct: number}>}
 */
export function suggestRebalancing(currentHoldings, targetWeights) {
  const total = currentHoldings.reduce((s, h) => s + h.value, 0);
  if (total <= 0) return [];

  const suggestions = [];
  for (const [asset, targetPct] of Object.entries(targetWeights)) {
    const holding = currentHoldings.find((h) => h.asset === asset);
    const currentValue = holding ? holding.value : 0;
    const targetValue = total * targetPct;
    const diff = targetValue - currentValue;
    const currentPct = (currentValue / total) * 100;

    if (Math.abs(diff / total) > 0.01) {
      suggestions.push({
        asset,
        action: diff > 0 ? 'buy' : 'sell',
        amount: Math.abs(diff),
        currentPct: +currentPct.toFixed(2),
        targetPct: +(targetPct * 100).toFixed(2),
      });
    }
  }
  return suggestions.sort((a, b) => b.amount - a.amount);
}

// ─── Yield Strategy Builder ───────────────────────────────────────────────────

/**
 * Given a list of enriched pools, return top yield farming strategies.
 */
export function buildYieldStrategies(pools, maxRisk = 'Medium') {
  const riskOrder = { Low: 0, Medium: 1, High: 2 };
  const maxRiskNum = riskOrder[maxRisk] ?? 1;

  return pools
    .map((pool) => {
      const apy = estimateAPYFromPool(pool);
      const risk = scorePoolRisk(pool);
      const assets = (pool.reserves || []).map((r) => assetCode(r.asset || r.asset_type));
      return { pool, apy, risk, assets, label: `${assets.join('/')} Pool` };
    })
    .filter((s) => riskOrder[s.risk.label] <= maxRiskNum && s.apy > 0)
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 10);
}

function assetCode(asset) {
  if (!asset || asset === 'native') return 'XLM';
  return asset.split(':')[0];
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

export async function fetchDefiOverview(network = 'mainnet', limit = 50) {
  const pools = await fetchLiquidityPools(network, limit);
  return pools.map((pool) => ({
    ...pool,
    apy: estimateAPYFromPool(pool),
    risk: scorePoolRisk(pool),
  }));
}

export async function fetchUserDefiPositions(publicKey, network = 'mainnet') {
  if (!publicKey) return [];
  const positions = await fetchAccountLiquidityPoolPositions(publicKey, network);
  return positions.map((pos) => ({
    ...pos,
    apy: pos.pool ? estimateAPYFromPool(pos.pool) : 0,
    risk: pos.pool ? scorePoolRisk(pos.pool) : { score: 50, label: 'Unknown' },
  }));
}
