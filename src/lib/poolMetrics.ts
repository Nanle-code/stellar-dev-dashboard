/**
 * AMM pool fee APR and volume trend metrics (#862).
 *
 * Horizon does not expose 24h pool volume, so volume is reconstructed from
 * recent pool trades (`fetchPoolTrades` in `src/lib/dex.ts`) and annualized
 * into a fee APR against the pool's TVL.
 *
 * Every function is pure and DOM-free so it runs in jsdom tests, node tools,
 * and the browser. Malformed trade records are skipped (and counted) instead
 * of throwing, so one bad Horizon record can never break the whole panel.
 */

export interface PoolTradeInput {
  id?: string;
  base_amount?: string | number;
  counter_amount?: string | number;
  ledger_close_time?: string;
  type?: string;
}

export interface NormalizedPoolTrade {
  id: string;
  baseAmount: number;
  counterAmount: number;
  /** Epoch milliseconds of the trade, or null when the timestamp is unusable. */
  time: number | null;
}

export interface PoolTradeStats {
  /** Trades that parsed successfully and were included in the aggregates. */
  validTradeCount: number;
  /** Records dropped because amounts or timestamps could not be parsed. */
  skippedCount: number;
  /** Summed base-asset volume across valid trades. */
  volumeBase: number;
  /** Summed counter-asset volume across valid trades. */
  volumeCounter: number;
  /** Hours between the newest and oldest valid trade; 0 when fewer than 2. */
  windowHours: number;
  lastTradeAt: number | null;
  warnings: PoolMetricWarning[];
}

export type PoolMetricWarningCode =
  | 'low-sample'
  | 'stale-trades'
  | 'skipped-records'
  | 'extrapolated-volume';

export interface PoolMetricWarning {
  code: PoolMetricWarningCode;
  message: string;
}

export interface VolumeTrendBucket {
  label: string;
  start: number;
  end: number;
  volume: number;
  tradeCount: number;
}

export interface VolumeTrend {
  buckets: VolumeTrendBucket[];
  totalVolume: number;
  bucketCount: number;
}

export interface PoolFeeAprEstimate {
  /** Annualized fee APR in percent, or null when it cannot be computed. */
  feeApr: number | null;
  /** Daily fee income in the same units as the volume, or null. */
  dailyFees: number | null;
  /** Estimated daily volume used for the annualization. */
  volumePerDay: number | null;
  /** True when fewer than 24h of trades were scaled up to a daily rate. */
  extrapolated: boolean;
  warnings: PoolMetricWarning[];
  /** Human-readable reason when `feeApr` is null. */
  reason: string | null;
}

export interface PoolAprInput {
  feeBps?: number | string;
  totalReserveValue?: number | string;
  reserveA?: number | string;
  reserveB?: number | string;
}

const HOUR_MS = 3_600_000;
/** Never extrapolate from a window shorter than one hour of trades. */
const MIN_EXTRAPOLATION_WINDOW_HOURS = 1;
/** Below this many valid trades the APR is labelled low confidence. */
const LOW_SAMPLE_THRESHOLD = 5;
/** No new trades within this many hours marks the panel as stale. */
const STALE_TRADES_HOURS = 6;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseProvidedAmount(value: unknown): { ok: boolean; amount: number | null } {
  if (value === undefined || value === null) return { ok: true, amount: null };
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? { ok: true, amount: value } : { ok: false, amount: null };
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return { ok: true, amount: parsed };
    return { ok: false, amount: null };
  }
  return { ok: false, amount: null };
}

function normalizeTrade(trade: PoolTradeInput, index: number): NormalizedPoolTrade | null {
  if (typeof trade !== 'object' || trade === null) return null;
  const base = parseProvidedAmount(trade.base_amount);
  const counter = parseProvidedAmount(trade.counter_amount);
  // Records with no usable amount on either side, or with a present-but
  // unparsable/negative amount, are malformed and get skipped.
  if (!base.ok || !counter.ok || (base.amount === null && counter.amount === null)) return null;

  let time: number | null = null;
  if (typeof trade.ledger_close_time === 'string' && trade.ledger_close_time.trim() !== '') {
    const parsed = Date.parse(trade.ledger_close_time);
    time = Number.isNaN(parsed) ? null : parsed;
  }

  return {
    id: typeof trade.id === 'string' && trade.id ? trade.id : `trade-${index}`,
    baseAmount: base.amount ?? 0,
    counterAmount: counter.amount ?? 0,
    time,
  };
}

/** Validate an enriched pool record before using it for APR math. */
export function explainInvalidPool(pool: unknown): string | null {
  if (typeof pool !== 'object' || pool === null) {
    return 'Pool data is missing: search for a pool first.';
  }
  const candidate = pool as PoolAprInput;
  const feeBps = toFiniteNumber(candidate.feeBps);
  if (feeBps === null || feeBps < 0) {
    return 'Pool fee tier is missing or invalid; the fee APR cannot be estimated.';
  }
  const tvl =
    toFiniteNumber(candidate.totalReserveValue) ??
    (toFiniteNumber(candidate.reserveA) ?? 0) + (toFiniteNumber(candidate.reserveB) ?? 0);
  if (!Number.isFinite(tvl) || tvl <= 0) {
    return 'Pool reserves are empty; the fee APR cannot be estimated without liquidity.';
  }
  return null;
}

function poolTvl(pool: PoolAprInput): number {
  const direct = toFiniteNumber(pool.totalReserveValue);
  if (direct !== null) return direct;
  return (toFiniteNumber(pool.reserveA) ?? 0) + (toFiniteNumber(pool.reserveB) ?? 0);
}

/**
 * Observed volume used for annualization: base-asset totals when available,
 * falling back to counter-asset totals for records missing a base amount.
 */
function observedVolume(stats: PoolTradeStats): number {
  return stats.volumeBase > 0 ? stats.volumeBase : stats.volumeCounter;
}

/**
 * Aggregate recent pool trades into volume totals and an observation window.
 *
 * Malformed records (unparsable amounts, negative values, non-object entries)
 * are skipped and reported via `skippedCount` instead of failing the panel.
 */
export function computePoolTradeStats(
  trades: PoolTradeInput[] | null | undefined,
  options: { now?: number } = {},
): PoolTradeStats {
  const now = options.now ?? Date.now();
  const records = Array.isArray(trades) ? trades : [];
  const valid: NormalizedPoolTrade[] = [];
  let skippedCount = 0;

  records.forEach((trade, index) => {
    const normalized = normalizeTrade(trade, index);
    if (normalized) valid.push(normalized);
    else skippedCount += 1;
  });

  const warnings: PoolMetricWarning[] = [];
  const times = valid.map((t) => t.time).filter((t): t is number => t !== null);
  const newest = times.length > 0 ? Math.max(...times) : null;
  const oldest = times.length > 0 ? Math.min(...times) : null;
  const windowHours =
    newest !== null && oldest !== null ? Math.max((newest - oldest) / HOUR_MS, 0) : 0;

  const volumeBase = valid.reduce((sum, t) => sum + t.baseAmount, 0);
  const volumeCounter = valid.reduce((sum, t) => sum + t.counterAmount, 0);

  if (valid.length > 0 && valid.length < LOW_SAMPLE_THRESHOLD) {
    warnings.push({
      code: 'low-sample',
      message: `Only ${valid.length} recent trade${valid.length === 1 ? '' : 's'} available; treat the APR as a rough estimate.`,
    });
  }
  if (newest !== null && now - newest > STALE_TRADES_HOURS * HOUR_MS) {
    warnings.push({
      code: 'stale-trades',
      message: 'No trades in the last 6 hours; volume trends may not reflect current activity.',
    });
  }
  if (skippedCount > 0) {
    warnings.push({
      code: 'skipped-records',
      message: `${skippedCount} trade record${skippedCount === 1 ? '' : 's'} could not be parsed and ${skippedCount === 1 ? 'was' : 'were'} excluded.`,
    });
  }

  return {
    validTradeCount: valid.length,
    skippedCount,
    volumeBase,
    volumeCounter,
    windowHours,
    lastTradeAt: newest,
    warnings,
  };
}

/**
 * Bucket trades into equal time slices (oldest → newest) for the trend chart.
 * Trades without a parsable timestamp are ignored by the trend but still
 * counted by `computePoolTradeStats`.
 */
export function buildVolumeTrend(
  trades: PoolTradeInput[] | null | undefined,
  options: { buckets?: number } = {},
): VolumeTrend {
  const bucketCount = options.buckets ?? 6;
  if (!Number.isInteger(bucketCount) || bucketCount < 1 || bucketCount > 48) {
    throw new Error('Volume trend buckets must be an integer between 1 and 48.');
  }

  const normalized = (Array.isArray(trades) ? trades : [])
    .map((trade, index) => normalizeTrade(trade, index))
    .filter((t): t is NormalizedPoolTrade => t !== null && t.time !== null)
    .sort((a, b) => (a.time as number) - (b.time as number));

  if (normalized.length === 0) {
    return { buckets: [], totalVolume: 0, bucketCount };
  }

  const newest = normalized[normalized.length - 1].time as number;
  const oldest = normalized[0].time as number;
  // Keep at least a one-hour window so a single burst of trades still yields
  // readable buckets, and anchor the window so it ends at the newest observed
  // trade (never in the future).
  const span = Math.max(newest - oldest, HOUR_MS);
  const windowEnd = newest;
  const bucketSize = span / bucketCount;

  const buckets: VolumeTrendBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    label: new Date(windowEnd - (bucketCount - 1 - i) * bucketSize).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    start: windowEnd - (bucketCount - i) * bucketSize,
    end: windowEnd - (bucketCount - 1 - i) * bucketSize,
    volume: 0,
    tradeCount: 0,
  }));

  for (const trade of normalized) {
    const time = trade.time as number;
    const index = Math.min(Math.floor((time - (windowEnd - span)) / bucketSize), bucketCount - 1);
    const bucket = buckets[index];
    bucket.volume += trade.baseAmount;
    bucket.tradeCount += 1;
  }

  return {
    buckets,
    totalVolume: buckets.reduce((sum, b) => sum + b.volume, 0),
    bucketCount,
  };
}

/**
 * Annualize observed trade volume into a fee APR for the pool.
 *
 * `APR = (dailyFees / TVL) * 365 * 100` where `dailyFees` is the observed
 * volume scaled to a daily rate and multiplied by the pool fee tier. When the
 * trade window is shorter than 24h the volume is scaled up (marked
 * `extrapolated`); windows shorter than one hour are clamped to one hour so a
 * burst of trades cannot produce absurd APRs.
 */
export function estimatePoolFeeApr(
  pool: PoolAprInput,
  stats: PoolTradeStats,
): PoolFeeAprEstimate {
  const poolError = explainInvalidPool(pool);
  const warnings = [...stats.warnings];

  if (poolError) {
    return {
      feeApr: null,
      dailyFees: null,
      volumePerDay: null,
      extrapolated: false,
      warnings,
      reason: poolError,
    };
  }

  if (stats.validTradeCount === 0 || observedVolume(stats) <= 0) {
    return {
      feeApr: null,
      dailyFees: null,
      volumePerDay: null,
      extrapolated: false,
      warnings,
      reason: 'No recent trades available for this pool; fee APR cannot be estimated yet.',
    };
  }

  const windowHours = stats.windowHours;
  const extrapolated = windowHours < 24;
  const scale = 24 / Math.max(windowHours, MIN_EXTRAPOLATION_WINDOW_HOURS);
  if (extrapolated) {
    warnings.push({
      code: 'extrapolated-volume',
      message: `Only ${windowHours < 1 ? 'under an hour' : `${windowHours.toFixed(1)}h`} of trades observed; volume was scaled up to a daily rate.`,
    });
  }

  const volumePerDay = observedVolume(stats) * scale;
  const feePercent = (toFiniteNumber(pool.feeBps) ?? 0) / 100;
  const dailyFees = volumePerDay * (feePercent / 100);
  const tvl = poolTvl(pool);
  const feeApr = tvl > 0 ? (dailyFees / tvl) * 365 * 100 : null;

  return {
    feeApr: feeApr !== null && Number.isFinite(feeApr) ? feeApr : null,
    dailyFees,
    volumePerDay,
    extrapolated,
    warnings,
    reason: feeApr === null ? 'Pool reserves are empty; the fee APR cannot be estimated.' : null,
  };
}
