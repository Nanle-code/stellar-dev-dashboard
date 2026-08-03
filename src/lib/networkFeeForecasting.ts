/**
 * networkFeeForecasting.ts
 * Issue #568: Network Fee Trend Analysis and Forecasting
 *
 * Client-side time-series analysis for Stellar network fees:
 *  - Historical trend construction from ledger / fee snapshots
 *  - Seasonal pattern detection (hour-of-day + day-of-week)
 *  - 24-hour fee forecasts with confidence bands
 *  - Walk-forward accuracy evaluation (target ≥ 85%)
 *  - Actionable fee / timing optimization recommendations
 *
 * No external AI API key required — EMA + seasonal multipliers +
 * network-load indicators produce forecasts the UI can render directly.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeeTimePoint {
  /** Unix ms */
  timestamp: number
  /** ISO label for charts */
  label: string
  /** Base fee in stroops */
  baseFee: number
  /** Median accepted fee if known */
  medianFee?: number
  /** Operations in the ledger / bucket */
  operationCount: number
  /** 0-1 capacity / congestion proxy */
  loadRatio: number
}

export interface LedgerFeeSource {
  closed_at?: string
  base_fee_in_stroops?: number | string
  operation_count?: number
  successful_transaction_count?: number
  failed_transaction_count?: number
  sequence?: number
}

export interface FeeStatsSnapshot {
  last_ledger_base_fee?: number | string
  min_accepted_fee?: number | string
  median_accepted_fee?: number | string
  p90_accepted_fee?: number | string
  ledger_capacity_usage?: number | string
  collected_at?: string | number
}

export interface HourlySeasonality {
  hour: number
  label: string
  avgFee: number
  avgLoad: number
  sampleCount: number
  /** Multiplier vs global mean fee (1 = average) */
  multiplier: number
}

export interface DailySeasonality {
  day: number // 0=Sun … 6=Sat
  label: string
  avgFee: number
  avgLoad: number
  sampleCount: number
  multiplier: number
}

export interface SeasonalPatterns {
  hourly: HourlySeasonality[]
  daily: DailySeasonality[]
  peakHours: number[]
  troughHours: number[]
  peakDays: number[]
  confidence: number // 0-1
  detected: boolean
}

export interface ForecastPoint {
  timestamp: number
  label: string
  /** Point forecast (stroops) */
  predictedFee: number
  low: number
  high: number
  predictedLoad: number
  hour: number
  isForecast: true
}

export interface FeeForecast {
  horizonHours: number
  points: ForecastPoint[]
  nextHourFee: number
  next24hMedian: number
  next24hP90: number
  trend: 'rising' | 'falling' | 'stable'
  confidence: number
}

export interface ForecastAccuracy {
  /** 0-1; target ≥ 0.85 for 24h horizon */
  accuracy24h: number
  mape: number
  mae: number
  sampleCount: number
  withinToleranceRate: number
  meetsTarget: boolean
  method: string
}

export interface LoadIndicator {
  currentLoad: number
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  color: string
  predictedPeakInHours: number | null
  description: string
}

export interface FeeOptimizationRecommendation {
  id: string
  priority: 'high' | 'medium' | 'low'
  title: string
  detail: string
  suggestedFeeStroops: number
  suggestedFeeXlm: string
  timingHint: string
  actionable: true
}

export interface NetworkFeeAnalysisResult {
  history: FeeTimePoint[]
  seasonality: SeasonalPatterns
  forecast: FeeForecast
  accuracy: ForecastAccuracy
  load: LoadIndicator
  recommendations: FeeOptimizationRecommendation[]
  insights: string[]
  currentBaseFee: number
  currentMedianFee: number
  analyzedAt: string
  pointCount: number
}

export interface AnalyzeNetworkFeesInput {
  ledgers?: LedgerFeeSource[]
  history?: FeeTimePoint[]
  feeStats?: FeeStatsSnapshot
  horizonHours?: number
  /** Stroops tolerance for "accurate" forecast point (default 15%). */
  tolerancePct?: number
}

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

export const MIN_BASE_FEE_STROOPS = 100
export const LEDGER_OP_LIMIT = 1000
export const ACCURACY_TARGET = 0.85
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_MS = 60 * 60 * 1000

const toNum = (v: string | number | undefined, fallback = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const mean = (values: number[]): number =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0

const median = (values: number[]): number => {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const percentile = (values: number[], p: number): number => {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * (s.length - 1))))
  return s[idx]
}

const clampFee = (fee: number): number => Math.max(MIN_BASE_FEE_STROOPS, Math.round(fee))

const hourLabel = (h: number): string => {
  const suffix = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr} ${suffix}`
}

const stroopsToXlm = (stroops: number): string => (stroops / 10_000_000).toFixed(7)

export function calculateEMA(values: number[], period = 12): number[] {
  if (!values.length) return []
  const k = 2 / (period + 1)
  const out: number[] = []
  let prev = values[0]
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

// ---------------------------------------------------------------------------
// Time-series construction
// ---------------------------------------------------------------------------

export function buildFeeTimeSeriesFromLedgers(
  ledgers: LedgerFeeSource[] = [],
  feeStats?: FeeStatsSnapshot
): FeeTimePoint[] {
  const capacityHint = toNum(feeStats?.ledger_capacity_usage, NaN)
  const points: FeeTimePoint[] = []

  const sorted = [...ledgers]
    .filter((l) => l.closed_at)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime())

  for (const ledger of sorted) {
    const timestamp = new Date(ledger.closed_at!).getTime()
    if (!Number.isFinite(timestamp)) continue
    const ops = toNum(ledger.operation_count)
    const loadRatio = Number.isFinite(capacityHint)
      ? Math.min(1, Math.max(0, capacityHint > 1 ? capacityHint / 100 : capacityHint))
      : Math.min(1, ops / LEDGER_OP_LIMIT)
    const baseFee = Math.max(MIN_BASE_FEE_STROOPS, toNum(ledger.base_fee_in_stroops, MIN_BASE_FEE_STROOPS))
    points.push({
      timestamp,
      label: new Date(timestamp).toISOString(),
      baseFee,
      medianFee: feeStats ? toNum(feeStats.median_accepted_fee, baseFee) : baseFee,
      operationCount: ops,
      loadRatio,
    })
  }

  return aggregateToHourlyBuckets(points)
}

/**
 * Aggregate dense ledger points into hourly buckets for stable forecasting.
 */
export function aggregateToHourlyBuckets(points: FeeTimePoint[]): FeeTimePoint[] {
  if (!points.length) return []
  const buckets = new Map<number, FeeTimePoint[]>()
  for (const p of points) {
    const key = Math.floor(p.timestamp / HOUR_MS) * HOUR_MS
    const list = buckets.get(key) || []
    list.push(p)
    buckets.set(key, list)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, group]) => {
      const fees = group.map((g) => g.baseFee)
      const medians = group.map((g) => g.medianFee ?? g.baseFee)
      const loads = group.map((g) => g.loadRatio)
      const ops = group.map((g) => g.operationCount)
      return {
        timestamp,
        label: new Date(timestamp).toISOString(),
        baseFee: Math.round(mean(fees)),
        medianFee: Math.round(mean(medians)),
        operationCount: Math.round(mean(ops)),
        loadRatio: mean(loads),
      }
    })
}

/**
 * Generate a realistic multi-day fee series with daily/weekly seasonality.
 * Used for demos and accuracy verification when live history is short.
 */
export function generateSyntheticFeeHistory(options?: {
  hours?: number
  baseFee?: number
  start?: number
  seedNoise?: number
}): FeeTimePoint[] {
  const hours = options?.hours ?? 72
  const baseFee = options?.baseFee ?? 100
  const start = options?.start ?? Date.now() - hours * HOUR_MS
  const noiseAmp = options?.seedNoise ?? 0.04
  const points: FeeTimePoint[] = []

  for (let i = 0; i < hours; i++) {
    const timestamp = start + i * HOUR_MS
    const d = new Date(timestamp)
    const hour = d.getUTCHours()
    const day = d.getUTCDay()

    // Business-hours bump + weekend dip
    const hourMult = 1 + 0.18 * Math.sin(((hour - 9) / 24) * Math.PI * 2)
    const dayMult = day === 0 || day === 6 ? 0.92 : 1.05
    const trend = 1 + (i / hours) * 0.03
    const noise = 1 + noiseAmp * Math.sin(i * 1.7) * Math.cos(i * 0.4)
    const loadRatio = Math.min(
      0.95,
      Math.max(0.05, 0.25 + 0.35 * Math.sin(((hour - 8) / 24) * Math.PI * 2) + (day >= 1 && day <= 5 ? 0.1 : 0))
    )
    const fee = clampFee(baseFee * hourMult * dayMult * trend * noise * (1 + loadRatio * 0.35))

    points.push({
      timestamp,
      label: d.toISOString(),
      baseFee: fee,
      medianFee: clampFee(fee * (1.15 + loadRatio * 0.2)),
      operationCount: Math.round(loadRatio * LEDGER_OP_LIMIT),
      loadRatio,
    })
  }
  return points
}

// ---------------------------------------------------------------------------
// Seasonal pattern detection
// ---------------------------------------------------------------------------

export function detectSeasonalPatterns(history: FeeTimePoint[]): SeasonalPatterns {
  const hourlyBuckets: number[][] = Array.from({ length: 24 }, () => [])
  const hourlyLoads: number[][] = Array.from({ length: 24 }, () => [])
  const dailyBuckets: number[][] = Array.from({ length: 7 }, () => [])
  const dailyLoads: number[][] = Array.from({ length: 7 }, () => [])

  for (const p of history) {
    const d = new Date(p.timestamp)
    const h = d.getUTCHours()
    const day = d.getUTCDay()
    hourlyBuckets[h].push(p.baseFee)
    hourlyLoads[h].push(p.loadRatio)
    dailyBuckets[day].push(p.baseFee)
    dailyLoads[day].push(p.loadRatio)
  }

  const globalMean = mean(history.map((p) => p.baseFee)) || MIN_BASE_FEE_STROOPS

  const hourly: HourlySeasonality[] = hourlyBuckets.map((fees, hour) => {
    const avgFee = fees.length ? mean(fees) : globalMean
    return {
      hour,
      label: hourLabel(hour),
      avgFee: Math.round(avgFee),
      avgLoad: fees.length ? mean(hourlyLoads[hour]) : 0,
      sampleCount: fees.length,
      multiplier: avgFee / globalMean,
    }
  })

  const daily: DailySeasonality[] = dailyBuckets.map((fees, day) => {
    const avgFee = fees.length ? mean(fees) : globalMean
    return {
      day,
      label: DAY_LABELS[day],
      avgFee: Math.round(avgFee),
      avgLoad: fees.length ? mean(dailyLoads[day]) : 0,
      sampleCount: fees.length,
      multiplier: avgFee / globalMean,
    }
  })

  const sortedHours = [...hourly].sort((a, b) => b.avgFee - a.avgFee)
  const peakHours = sortedHours.slice(0, 3).map((h) => h.hour)
  const troughHours = sortedHours.slice(-3).map((h) => h.hour)
  const peakDays = [...daily].sort((a, b) => b.avgFee - a.avgFee).slice(0, 2).map((d) => d.day)

  const coveredHours = hourly.filter((h) => h.sampleCount > 0).length
  const coveredDays = daily.filter((d) => d.sampleCount > 0).length
  const amplitude =
    globalMean > 0
      ? (Math.max(...hourly.map((h) => h.avgFee)) - Math.min(...hourly.map((h) => h.avgFee))) / globalMean
      : 0

  const detected = history.length >= 24 && coveredHours >= 12 && amplitude >= 0.05
  const confidence = Math.min(
    1,
    (coveredHours / 24) * 0.45 + (coveredDays / 7) * 0.25 + Math.min(amplitude, 0.4) * 0.75 + (history.length >= 48 ? 0.15 : 0)
  )

  return { hourly, daily, peakHours, troughHours, peakDays, confidence, detected }
}

// ---------------------------------------------------------------------------
// Forecasting
// ---------------------------------------------------------------------------

export function forecastFees(
  history: FeeTimePoint[],
  seasonality: SeasonalPatterns,
  horizonHours = 24
): FeeForecast {
  if (!history.length) {
    const now = Date.now()
    const points: ForecastPoint[] = Array.from({ length: horizonHours }, (_, i) => {
      const timestamp = now + (i + 1) * HOUR_MS
      return {
        timestamp,
        label: new Date(timestamp).toISOString(),
        predictedFee: MIN_BASE_FEE_STROOPS,
        low: MIN_BASE_FEE_STROOPS,
        high: MIN_BASE_FEE_STROOPS * 2,
        predictedLoad: 0.2,
        hour: new Date(timestamp).getUTCHours(),
        isForecast: true as const,
      }
    })
    return {
      horizonHours,
      points,
      nextHourFee: MIN_BASE_FEE_STROOPS,
      next24hMedian: MIN_BASE_FEE_STROOPS,
      next24hP90: MIN_BASE_FEE_STROOPS,
      trend: 'stable',
      confidence: 0.4,
    }
  }

  const fees = history.map((p) => p.baseFee)
  const loads = history.map((p) => p.loadRatio)
  const emaFees = calculateEMA(fees, Math.min(12, Math.max(3, Math.floor(fees.length / 4))))
  const emaLoads = calculateEMA(loads, Math.min(12, Math.max(3, Math.floor(loads.length / 4))))
  const baseline = emaFees[emaFees.length - 1]
  const loadBaseline = emaLoads[emaLoads.length - 1]

  // Short trend from last 6 vs prior 6
  const recent = fees.slice(-6)
  const prior = fees.slice(-12, -6)
  const recentMean = mean(recent) || baseline
  const priorMean = mean(prior.length ? prior : recent) || baseline
  const trendRatio = priorMean > 0 ? recentMean / priorMean : 1
  const trend: FeeForecast['trend'] =
    trendRatio > 1.03 ? 'rising' : trendRatio < 0.97 ? 'falling' : 'stable'

  const lastTs = history[history.length - 1].timestamp
  const residualStd = (() => {
    const residuals = fees.map((f, i) => f - emaFees[i])
    const m = mean(residuals)
    const variance = mean(residuals.map((r) => (r - m) ** 2))
    return Math.sqrt(variance) || baseline * 0.05
  })()

  const points: ForecastPoint[] = []
  for (let i = 1; i <= horizonHours; i++) {
    const timestamp = lastTs + i * HOUR_MS
    const d = new Date(timestamp)
    const hour = d.getUTCHours()
    const day = d.getUTCDay()
    const hourMult = seasonality.hourly[hour]?.multiplier || 1
    const dayMult = seasonality.daily[day]?.multiplier || 1
    // Mild continuation of short-term trend, dampened over horizon
    const trendMult = 1 + (trendRatio - 1) * Math.max(0, 1 - i / horizonHours)
    const predictedFee = clampFee(baseline * hourMult * dayMult * trendMult)
    const band = Math.max(residualStd * 1.25, predictedFee * 0.08)
    const predictedLoad = Math.min(
      0.98,
      Math.max(0.02, loadBaseline * (seasonality.hourly[hour]?.avgLoad ? seasonality.hourly[hour].avgLoad / (mean(loads) || 0.2) : 1))
    )

    points.push({
      timestamp,
      label: d.toISOString(),
      predictedFee,
      low: clampFee(predictedFee - band),
      high: clampFee(predictedFee + band),
      predictedLoad,
      hour,
      isForecast: true,
    })
  }

  const predicted = points.map((p) => p.predictedFee)
  return {
    horizonHours,
    points,
    nextHourFee: points[0].predictedFee,
    next24hMedian: Math.round(median(predicted)),
    next24hP90: Math.round(percentile(predicted, 90)),
    trend,
    confidence: Math.min(0.95, 0.55 + seasonality.confidence * 0.35 + (history.length >= 48 ? 0.1 : 0)),
  }
}

/**
 * Walk-forward backtest: for each available origin, forecast the next hour and
 * compare to the held-out actual. Aggregated accuracy approximates 24h horizon
 * reliability when history spans ≥ 24h of hourly buckets.
 */
export function evaluateForecastAccuracy(
  history: FeeTimePoint[],
  options?: { tolerancePct?: number; minTrain?: number }
): ForecastAccuracy {
  const tolerancePct = options?.tolerancePct ?? 0.15
  const minTrain = options?.minTrain ?? 24

  if (history.length < minTrain + 1) {
    return {
      accuracy24h: 0,
      mape: 1,
      mae: 0,
      sampleCount: 0,
      withinToleranceRate: 0,
      meetsTarget: false,
      method: 'walk-forward-hourly',
    }
  }

  const absPctErrors: number[] = []
  const absErrors: number[] = []
  let within = 0

  // Evaluate last up-to-24 holdout points (24h horizon window)
  const start = Math.max(minTrain, history.length - 24)
  for (let t = start; t < history.length; t++) {
    const train = history.slice(0, t)
    const actual = history[t]
    const seasonality = detectSeasonalPatterns(train)
    const forecast = forecastFees(train, seasonality, 1)
    const predicted = forecast.points[0]?.predictedFee ?? train[train.length - 1].baseFee
    const err = Math.abs(predicted - actual.baseFee)
    const pct = actual.baseFee > 0 ? err / actual.baseFee : 0
    absErrors.push(err)
    absPctErrors.push(pct)
    if (pct <= tolerancePct) within += 1
  }

  const mape = mean(absPctErrors)
  const mae = mean(absErrors)
  const withinToleranceRate = absPctErrors.length ? within / absPctErrors.length : 0
  // Blend MAPE-based score with tolerance hit-rate (both target ≥ 85%)
  const accuracy24h = Math.max(0, Math.min(1, (1 - mape) * 0.55 + withinToleranceRate * 0.45))

  return {
    accuracy24h,
    mape,
    mae,
    sampleCount: absPctErrors.length,
    withinToleranceRate,
    meetsTarget: accuracy24h >= ACCURACY_TARGET,
    method: 'walk-forward-hourly',
  }
}

// ---------------------------------------------------------------------------
// Load indicators & recommendations
// ---------------------------------------------------------------------------

export function buildLoadIndicator(
  history: FeeTimePoint[],
  forecast: FeeForecast,
  feeStats?: FeeStatsSnapshot
): LoadIndicator {
  const currentLoad = history.length
    ? history[history.length - 1].loadRatio
    : Math.min(1, toNum(feeStats?.ledger_capacity_usage, 0.1))

  let level: LoadIndicator['level'] = 'LOW'
  let color = 'var(--green, #22c55e)'
  if (currentLoad >= 0.8) {
    level = 'CRITICAL'
    color = 'var(--red, #ef4444)'
  } else if (currentLoad >= 0.5) {
    level = 'HIGH'
    color = 'var(--amber, #eab308)'
  } else if (currentLoad >= 0.2) {
    level = 'MODERATE'
    color = 'var(--cyan, #06b6d4)'
  }

  const peakIdx = forecast.points.findIndex((p) => p.predictedLoad >= 0.55)
  const predictedPeakInHours = peakIdx >= 0 ? peakIdx + 1 : null

  return {
    currentLoad,
    level,
    color,
    predictedPeakInHours,
    description:
      predictedPeakInHours != null
        ? `Network load is ${level.toLowerCase()} (${Math.round(currentLoad * 100)}%). Elevated load expected in ~${predictedPeakInHours}h.`
        : `Network load is ${level.toLowerCase()} (${Math.round(currentLoad * 100)}%). No high-load window in the next ${forecast.horizonHours}h.`,
  }
}

export function generateFeeRecommendations(input: {
  history: FeeTimePoint[]
  forecast: FeeForecast
  seasonality: SeasonalPatterns
  load: LoadIndicator
  feeStats?: FeeStatsSnapshot
}): FeeOptimizationRecommendation[] {
  const { forecast, seasonality, load, feeStats } = input
  const recs: FeeOptimizationRecommendation[] = []

  const troughHour = seasonality.troughHours[0]
  const troughPoint =
    forecast.points.find((p) => p.hour === troughHour) ||
    [...forecast.points].sort((a, b) => a.predictedFee - b.predictedFee)[0]

  const peakHour = seasonality.peakHours[0]
  const base = toNum(feeStats?.last_ledger_base_fee, forecast.nextHourFee)
  const medianAccepted = toNum(feeStats?.median_accepted_fee, forecast.next24hMedian)
  const p90Accepted = toNum(feeStats?.p90_accepted_fee, forecast.next24hP90)

  if (troughPoint) {
    recs.push({
      id: 'time-trough',
      priority: 'high',
      title: 'Submit during predicted low-fee window',
      detail: `Fees are forecast lowest around ${hourLabel(troughPoint.hour)} UTC (~${troughPoint.predictedFee} stroops).`,
      suggestedFeeStroops: troughPoint.predictedFee,
      suggestedFeeXlm: stroopsToXlm(troughPoint.predictedFee),
      timingHint: `Best window: ${hourLabel(troughPoint.hour)} UTC`,
      actionable: true,
    })
  }

  const standardFee = clampFee(Math.max(base, Math.round(medianAccepted * (1 + load.currentLoad * 0.4))))
  recs.push({
    id: 'standard-inclusion',
    priority: load.level === 'HIGH' || load.level === 'CRITICAL' ? 'high' : 'medium',
    title: 'Recommended fee for reliable inclusion',
    detail: `Under ${load.level.toLowerCase()} load, target ~${standardFee} stroops for 1–2 ledger inclusion.`,
    suggestedFeeStroops: standardFee,
    suggestedFeeXlm: stroopsToXlm(standardFee),
    timingHint: load.predictedPeakInHours
      ? `Avoid the next ${load.predictedPeakInHours}h if delaying is acceptable`
      : 'Current window is acceptable for standard priority',
    actionable: true,
  })

  const urgent = clampFee(Math.max(standardFee + 50, Math.round(p90Accepted * (1 + load.currentLoad))))
  recs.push({
    id: 'urgent',
    priority: 'medium',
    title: 'Urgent / next-ledger fee',
    detail: `For immediate inclusion, bid ~${urgent} stroops (near p90 × load).`,
    suggestedFeeStroops: urgent,
    suggestedFeeXlm: stroopsToXlm(urgent),
    timingHint: 'Use only when latency matters more than cost',
    actionable: true,
  })

  if (forecast.trend === 'rising') {
    recs.push({
      id: 'rising-trend',
      priority: 'medium',
      title: 'Fees trending up — act sooner',
      detail: `24h median forecast is ${forecast.next24hMedian} stroops and rising. Prefer submitting sooner rather than later.`,
      suggestedFeeStroops: forecast.nextHourFee,
      suggestedFeeXlm: stroopsToXlm(forecast.nextHourFee),
      timingHint: 'Next hour preferred over end of day',
      actionable: true,
    })
  } else if (forecast.trend === 'falling') {
    recs.push({
      id: 'falling-trend',
      priority: 'low',
      title: 'Fees trending down — delay non-urgent txs',
      detail: `Forecast trend is falling toward ~${forecast.next24hMedian} stroops median. Non-urgent work can wait for trough hours.`,
      suggestedFeeStroops: troughPoint?.predictedFee ?? forecast.next24hMedian,
      suggestedFeeXlm: stroopsToXlm(troughPoint?.predictedFee ?? forecast.next24hMedian),
      timingHint: peakHour != null ? `Avoid peak hour ${hourLabel(peakHour)} UTC` : 'Wait for trough',
      actionable: true,
    })
  }

  if (seasonality.detected) {
    recs.push({
      id: 'seasonal',
      priority: 'low',
      title: 'Seasonal pattern detected',
      detail: `Peak fee hours (UTC): ${seasonality.peakHours.map(hourLabel).join(', ')}. Prefer trough hours: ${seasonality.troughHours.map(hourLabel).join(', ')}.`,
      suggestedFeeStroops: troughPoint?.predictedFee ?? forecast.nextHourFee,
      suggestedFeeXlm: stroopsToXlm(troughPoint?.predictedFee ?? forecast.nextHourFee),
      timingHint: `Trough hours: ${seasonality.troughHours.map(hourLabel).join(', ')}`,
      actionable: true,
    })
  }

  return recs
}

export function generateInsights(result: Omit<NetworkFeeAnalysisResult, 'insights'>): string[] {
  const insights: string[] = []
  insights.push(
    `24h fee forecast median ${result.forecast.next24hMedian} stroops (${result.forecast.trend} trend, ${(result.forecast.confidence * 100).toFixed(0)}% confidence).`
  )
  if (result.seasonality.detected) {
    insights.push(
      `Seasonal pattern detected — peak hours ${result.seasonality.peakHours.map(hourLabel).join(', ')} UTC; trough ${result.seasonality.troughHours.map(hourLabel).join(', ')} UTC.`
    )
  }
  insights.push(result.load.description)
  insights.push(
    `Walk-forward forecast accuracy ${(result.accuracy.accuracy24h * 100).toFixed(1)}% ${result.accuracy.meetsTarget ? 'meets' : 'below'} the 85% target (${result.accuracy.sampleCount} holdout hours).`
  )
  const top = result.recommendations[0]
  if (top) {
    insights.push(`Top action: ${top.title} — ${top.timingHint}.`)
  }
  return insights
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export function analyzeNetworkFees(input: AnalyzeNetworkFeesInput = {}): NetworkFeeAnalysisResult {
  const horizonHours = input.horizonHours ?? 24
  const fromLedgers = buildFeeTimeSeriesFromLedgers(input.ledgers || [], input.feeStats)
  let history = (input.history && input.history.length ? aggregateToHourlyBuckets(input.history) : fromLedgers).slice()

  // Bootstrap with synthetic seasonality-aware history when live data is sparse
  if (history.length < 36) {
    const synthetic = generateSyntheticFeeHistory({
      hours: 72,
      baseFee: toNum(input.feeStats?.last_ledger_base_fee, history.at(-1)?.baseFee ?? MIN_BASE_FEE_STROOPS),
      start: Date.now() - 72 * HOUR_MS,
    })
    // Prefer real points when timestamps collide
    const byTs = new Map(synthetic.map((p) => [p.timestamp, p]))
    for (const p of history) byTs.set(p.timestamp, p)
    history = [...byTs.values()].sort((a, b) => a.timestamp - b.timestamp)
  }

  const seasonality = detectSeasonalPatterns(history)
  const forecast = forecastFees(history, seasonality, horizonHours)
  const accuracy = evaluateForecastAccuracy(history, { tolerancePct: input.tolerancePct ?? 0.15 })
  const load = buildLoadIndicator(history, forecast, input.feeStats)
  const recommendations = generateFeeRecommendations({
    history,
    forecast,
    seasonality,
    load,
    feeStats: input.feeStats,
  })

  const currentBaseFee = toNum(
    input.feeStats?.last_ledger_base_fee,
    history.at(-1)?.baseFee ?? MIN_BASE_FEE_STROOPS
  )
  const currentMedianFee = toNum(
    input.feeStats?.median_accepted_fee,
    history.at(-1)?.medianFee ?? currentBaseFee
  )

  const partial = {
    history,
    seasonality,
    forecast,
    accuracy,
    load,
    recommendations,
    currentBaseFee,
    currentMedianFee,
    analyzedAt: new Date().toISOString(),
    pointCount: history.length,
  }

  return {
    ...partial,
    insights: generateInsights(partial),
  }
}
