/**
 * Fill Probability Estimator
 *
 * Estimates the probability that a proposed limit order will be filled within a
 * reasonable time horizon, using two market signals:
 *
 *  1. Depth pressure — how much liquidity sits between the current best price
 *     and the proposed limit price (how far the market needs to move).
 *  2. Trade cadence — the rate at which trades are occurring at or better than
 *     the limit price, derived from recent trade history.
 *
 * Both signals are combined into a [0, 1] probability using an exponential
 * decay model: a limit price closer to the market and a higher trade rate both
 * push probability toward 1.
 */

export interface OrderBookLevel {
  price: string | number;
  amount: string | number;
}

export interface TradeRecord {
  /** Horizon raw price as { n, d } fraction or numeric string/number */
  price?: { n: number; d: number } | string | number;
  base_amount?: string | number;
  /** ISO-8601 or epoch ms */
  ledger_close_time?: string | number;
}

export interface FillProbabilityParams {
  /** 'buy' limit order competes against asks; 'sell' competes against bids */
  side: 'buy' | 'sell';
  /** Proposed limit price */
  limitPrice: number;
  /** Order quantity (base asset units) — used to check available depth */
  quantity: number;
  /** Current order book bids, sorted best (highest) first */
  bids: OrderBookLevel[];
  /** Current order book asks, sorted best (lowest) first */
  asks: OrderBookLevel[];
  /** Recent trades from Horizon, newest first */
  trades: TradeRecord[];
  /**
   * Time window (seconds) over which to measure trade cadence.
   * Defaults to 300 s (5 min).
   */
  cadenceWindowSeconds?: number;
}

export interface FillProbabilityResult {
  /** Estimated fill probability in [0, 1] */
  probability: number;
  /** Human-readable probability percentage, e.g. "72%" */
  probabilityLabel: string;
  /** Qualitative tier */
  tier: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
  /** Depth-based sub-score in [0, 1]: how accessible the price level is */
  depthScore: number;
  /** Cadence-based sub-score in [0, 1]: how active trading is near the limit */
  cadenceScore: number;
  /** Trades per minute at or better than the limit price in the cadence window */
  tradesPerMinute: number;
  /** Volume of orders sitting between the best market price and the limit */
  depthToAbsorb: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parsePrice(raw: TradeRecord['price']): number {
  if (raw == null) return NaN;
  if (typeof raw === 'object' && 'n' in raw && 'd' in raw) {
    return raw.d !== 0 ? raw.n / raw.d : NaN;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function parseAmount(raw: string | number | undefined): number {
  if (raw == null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseTimestamp(raw: string | number | undefined): number {
  if (raw == null) return 0;
  if (typeof raw === 'number') return raw;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Depth score: fraction of the order book traversal needed to reach the limit
 * price, inverted so that a price close to the market scores near 1.
 *
 * For a buy order we walk through asks from best ask upward until we either
 * reach the limit price or exhaust the book. For a sell order we walk through
 * bids from best bid downward.
 *
 * Score = exp(-λ · depthFraction) where depthFraction = depthToAbsorb / totalDepth
 */
function computeDepthScore(
  side: 'buy' | 'sell',
  limitPrice: number,
  bids: OrderBookLevel[],
  asks: OrderBookLevel[]
): { depthScore: number; depthToAbsorb: number } {
  const levels = side === 'buy' ? asks : bids;
  if (!levels.length) return { depthScore: 0.5, depthToAbsorb: 0 };

  const bestPrice = parseAmount(levels[0].price as string);
  if (!Number.isFinite(bestPrice) || bestPrice <= 0) {
    return { depthScore: 0.5, depthToAbsorb: 0 };
  }

  // For a buy order the limit must be >= best ask to have any fill chance
  // (aggressive); for passive orders the limit is below best ask.
  // We measure how much depth is between the best price and the limit.
  let depthToAbsorb = 0;
  let totalDepth = 0;

  for (const level of levels) {
    const p = parseAmount(level.price as string);
    const a = parseAmount(level.amount as string);
    totalDepth += a;

    const isWithinRange =
      side === 'buy'
        ? p <= limitPrice   // asks at or below our limit are reachable
        : p >= limitPrice;  // bids at or above our limit are reachable

    if (!isWithinRange) {
      depthToAbsorb += a;
    }
  }

  if (totalDepth === 0) return { depthScore: 0.5, depthToAbsorb: 0 };

  const depthFraction = depthToAbsorb / totalDepth;
  // λ = 3 gives ~5% score when all depth must be absorbed, ~95% when none
  const depthScore = Math.exp(-3 * depthFraction);

  return { depthScore, depthToAbsorb };
}

/**
 * Cadence score: derived from the observed rate of trades at-or-better-than
 * the limit price in the cadence window.
 *
 * Score = 1 - exp(-μ · tradesPerMinute) where μ = 0.5
 * This saturates smoothly toward 1 as activity increases.
 */
function computeCadenceScore(
  side: 'buy' | 'sell',
  limitPrice: number,
  trades: TradeRecord[],
  windowSeconds: number
): { cadenceScore: number; tradesPerMinute: number } {
  if (!trades.length) return { cadenceScore: 0, tradesPerMinute: 0 };

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const cutoff = now - windowMs;

  let relevantCount = 0;

  for (const t of trades) {
    const ts = parseTimestamp(t.ledger_close_time);
    // If no timestamp, include it (Horizon always orders desc, so recent first)
    if (ts > 0 && ts < cutoff) continue;

    const p = parsePrice(t.price);
    if (!Number.isFinite(p) || p <= 0) continue;

    const atOrBetter =
      side === 'buy'
        ? p <= limitPrice   // a trade at ask ≤ our limit favours a buy fill
        : p >= limitPrice;  // a trade at bid ≥ our limit favours a sell fill

    if (atOrBetter) relevantCount++;
  }

  const windowMinutes = windowSeconds / 60;
  const tradesPerMinute = windowMinutes > 0 ? relevantCount / windowMinutes : 0;

  // μ = 0.5: 1 trade/min → ~39%, 2/min → ~63%, 5/min → ~92%
  const cadenceScore = 1 - Math.exp(-0.5 * tradesPerMinute);

  return { cadenceScore, tradesPerMinute };
}

function scoreToProbability(depthScore: number, cadenceScore: number): number {
  // Weighted geometric mean: depth (60%) + cadence (40%)
  // Geometric mean ensures both signals matter — neither alone can dominate.
  const weighted = Math.pow(depthScore, 0.6) * Math.pow(cadenceScore === 0 ? 0.01 : cadenceScore, 0.4);
  return Math.min(1, Math.max(0, weighted));
}

function probabilityTier(p: number): FillProbabilityResult['tier'] {
  if (p >= 0.75) return 'very_high';
  if (p >= 0.55) return 'high';
  if (p >= 0.35) return 'medium';
  if (p >= 0.15) return 'low';
  return 'very_low';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Estimates the fill probability of a proposed limit order.
 *
 * Returns a structured result; never throws. Invalid inputs produce a
 * result with `probability: 0` and a `very_low` tier.
 */
export function estimateFillProbability(params: FillProbabilityParams): FillProbabilityResult {
  const {
    side,
    limitPrice,
    quantity,
    bids = [],
    asks = [],
    trades = [],
    cadenceWindowSeconds = 300,
  } = params;

  // --- Input validation ---
  if (
    !Number.isFinite(limitPrice) ||
    limitPrice <= 0 ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    (side !== 'buy' && side !== 'sell')
  ) {
    return {
      probability: 0,
      probabilityLabel: '0%',
      tier: 'very_low',
      depthScore: 0,
      cadenceScore: 0,
      tradesPerMinute: 0,
      depthToAbsorb: 0,
    };
  }

  const windowSecs = Math.max(1, cadenceWindowSeconds);

  const { depthScore, depthToAbsorb } = computeDepthScore(side, limitPrice, bids, asks);
  const { cadenceScore, tradesPerMinute } = computeCadenceScore(side, limitPrice, trades, windowSecs);

  const probability = scoreToProbability(depthScore, cadenceScore);
  const tier = probabilityTier(probability);
  const probabilityLabel = `${Math.round(probability * 100)}%`;

  return {
    probability,
    probabilityLabel,
    tier,
    depthScore,
    cadenceScore,
    tradesPerMinute,
    depthToAbsorb,
  };
}
