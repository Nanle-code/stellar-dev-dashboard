/**
 * accountActivityModeling.ts
 * Issue #569: Predictive Account Activity Modeling
 *
 * Builds AI models that predict future account activity based on historical
 * patterns, calendar events, and user behavior. Generates activity heatmaps,
 * forecasts, recurring pattern detection, and proactive notifications.
 *
 * Runs entirely client-side — no external API key required.
 * Follows the same patterns as capacityPrediction.ts and transactionVolumeForecasting.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single historical activity record for an account */
export interface AccountActivityRecord {
  /** ISO-8601 timestamp */
  timestamp: string
  /** Account public key (G...) */
  accountId: string
  /** Number of transactions in this period */
  txCount: number
  /** Number of operations */
  operationCount: number
  /** Types of operations seen */
  operationTypes?: string[]
  /** Whether this period had any activity */
  isActive: boolean
  /** Total value moved (in stroops) */
  totalValue?: number
}

/** Prediction horizon for account activity */
export type ActivityHorizon = 'day' | 'week' | 'month'

/** A predicted activity level for a future time slot */
export interface ActivityPrediction {
  timestamp: string
  /** Predicted number of transactions */
  predictedTxCount: number
  /** Probability that the account will be active 0–1 */
  activeProbability: number
  /** Lower bound */
  lowerBound: number
  /** Upper bound */
  upperBound: number
  /** Model confidence 0–1 */
  confidence: number
  label: string
}

/** A recurring behavioral pattern detected in the account's history */
export interface RecurringPattern {
  id: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  description: string
  /** Day of week (0=Sun) for weekly patterns, hour for daily patterns */
  periodValue: number
  /** Average activity level during this period */
  averageActivity: number
  /** How consistently this pattern occurs 0–1 */
  consistency: number
  /** How many occurrences were found */
  occurrences: number
}

/** 24×7 activity heatmap (hour × day-of-week) */
export type ActivityHeatmap = number[][]

/** A scheduled event that may affect account activity */
export interface CalendarEvent {
  id: string
  title: string
  date: string
  /** Expected activity multiplier during this event (e.g. 2.0 = 2× normal) */
  activityMultiplier: number
  type: 'payment_due' | 'protocol_upgrade' | 'custom' | 'market_event'
}

/** A proactive notification about predicted account behavior */
export interface ActivityNotification {
  id: string
  accountId: string
  type: 'high_activity_predicted' | 'inactivity_predicted' | 'pattern_change' | 'calendar_event'
  message: string
  severity: 'info' | 'warning' | 'alert'
  timestamp: string
  forecastTimestamp: string
  predictedValue?: number
}

/** Result of activity prediction for one account over a horizon */
export interface AccountActivityForecast {
  accountId: string
  horizon: ActivityHorizon
  predictions: ActivityPrediction[]
  patterns: RecurringPattern[]
  heatmap: ActivityHeatmap
  notifications: ActivityNotification[]
  accuracy: number
  trend: 'increasing' | 'decreasing' | 'stable'
  generatedAt: string
  dataPointsUsed: number
  /** Whether the model has adapted to recent behavior changes */
  adaptedToRecentChanges: boolean
}

/** Configuration for the activity model */
export interface ActivityModelConfig {
  /** How much to weight recent data vs historical (0–1, higher = more recent) */
  recencyBias: number
  /** Minimum days of data required for predictions */
  minDataDays: number
  /** Active probability threshold to flag a period as active */
  activeProbabilityThreshold: number
  /** High activity multiplier threshold for notifications */
  highActivityMultiplier: number
  /** Notification cooldown hours */
  notificationCooldownHours: number
}

export const DEFAULT_MODEL_CONFIG: ActivityModelConfig = {
  recencyBias: 0.7,
  minDataDays: 3,
  activeProbabilityThreshold: 0.5,
  highActivityMultiplier: 2.0,
  notificationCooldownHours: 4,
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function stdDev(values: number[], avg?: number): number {
  if (values.length < 2) return 0
  const m = avg ?? mean(values)
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Weighted exponential smoothing — recent points weighted more.
 */
function weightedSmoothing(values: number[], recencyBias: number): number[] {
  if (!values.length) return []
  const alpha = clamp(recencyBias, 0.1, 0.9)
  const out: number[] = [values[0]]
  for (let i = 1; i < values.length; i++) {
    out.push(alpha * values[i] + (1 - alpha) * out[i - 1])
  }
  return out
}

/**
 * Logistic function to convert a raw score to probability.
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

/**
 * Linear regression returning slope and intercept.
 */
function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 }
  const xm = mean(xs)
  const ym = mean(ys)
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xm) * (ys[i] - ym)
    den += (xs[i] - xm) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  return { slope, intercept: ym - slope * xm }
}

// ---------------------------------------------------------------------------
// Pattern detection
// ---------------------------------------------------------------------------

/**
 * Detect recurring daily patterns (hour-of-day activity profile).
 */
export function detectDailyPatterns(records: AccountActivityRecord[]): RecurringPattern[] {
  if (!records.length) return []

  const hourBuckets: number[][] = Array.from({ length: 24 }, () => [])
  for (const r of records) {
    const hour = new Date(r.timestamp).getHours()
    hourBuckets[hour].push(r.txCount)
  }

  const patterns: RecurringPattern[] = []
  const globalAvg = mean(records.map((r) => r.txCount))

  for (let hour = 0; hour < 24; hour++) {
    const bucket = hourBuckets[hour]
    if (!bucket.length) continue
    const avg = mean(bucket)
    const nonZero = bucket.filter((v) => v > 0).length
    const consistency = nonZero / bucket.length
    // Only flag hours with above-average consistent activity
    if (avg > globalAvg * 1.2 && consistency > 0.3) {
      patterns.push({
        id: `daily_hour_${hour}`,
        type: 'daily',
        description: `Elevated activity around ${String(hour).padStart(2, '0')}:00 (avg ${avg.toFixed(1)} txns, ${Math.round(consistency * 100)}% of days)`,
        periodValue: hour,
        averageActivity: parseFloat(avg.toFixed(2)),
        consistency: parseFloat(consistency.toFixed(3)),
        occurrences: nonZero,
      })
    }
  }

  return patterns.sort((a, b) => b.averageActivity - a.averageActivity).slice(0, 5)
}

/**
 * Detect recurring weekly patterns (day-of-week activity profile).
 */
export function detectWeeklyPatterns(records: AccountActivityRecord[]): RecurringPattern[] {
  if (!records.length) return []

  const dowBuckets: number[][] = Array.from({ length: 7 }, () => [])
  for (const r of records) {
    const dow = new Date(r.timestamp).getDay()
    dowBuckets[dow].push(r.txCount)
  }

  const patterns: RecurringPattern[] = []
  const globalAvg = mean(records.map((r) => r.txCount))
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  for (let dow = 0; dow < 7; dow++) {
    const bucket = dowBuckets[dow]
    if (!bucket.length) continue
    const avg = mean(bucket)
    const nonZero = bucket.filter((v) => v > 0).length
    const consistency = nonZero / bucket.length
    if (avg > globalAvg * 1.15 && consistency > 0.4) {
      patterns.push({
        id: `weekly_dow_${dow}`,
        type: 'weekly',
        description: `Higher activity on ${dayNames[dow]}s (avg ${avg.toFixed(1)} txns, ${Math.round(consistency * 100)}% of weeks)`,
        periodValue: dow,
        averageActivity: parseFloat(avg.toFixed(2)),
        consistency: parseFloat(consistency.toFixed(3)),
        occurrences: nonZero,
      })
    }
  }

  return patterns.sort((a, b) => b.averageActivity - a.averageActivity).slice(0, 3)
}

/**
 * Detect monthly patterns (day-of-month activity clusters).
 */
export function detectMonthlyPatterns(records: AccountActivityRecord[]): RecurringPattern[] {
  if (records.length < 60) return [] // Need at least 2 months

  const domBuckets: number[][] = Array.from({ length: 31 }, () => [])
  for (const r of records) {
    const dom = new Date(r.timestamp).getDate() - 1 // 0-indexed
    domBuckets[dom].push(r.txCount)
  }

  const globalAvg = mean(records.map((r) => r.txCount))
  const patterns: RecurringPattern[] = []

  for (let dom = 0; dom < 31; dom++) {
    const bucket = domBuckets[dom]
    if (bucket.length < 2) continue
    const avg = mean(bucket)
    const nonZero = bucket.filter((v) => v > 0).length
    const consistency = nonZero / bucket.length
    if (avg > globalAvg * 1.3 && consistency > 0.5) {
      patterns.push({
        id: `monthly_dom_${dom + 1}`,
        type: 'monthly',
        description: `Regular activity spike on day ${dom + 1} of the month (${Math.round(consistency * 100)}% consistency)`,
        periodValue: dom + 1,
        averageActivity: parseFloat(avg.toFixed(2)),
        consistency: parseFloat(consistency.toFixed(3)),
        occurrences: nonZero,
      })
    }
  }

  return patterns.sort((a, b) => b.consistency - a.consistency).slice(0, 3)
}

/**
 * Detect if the model should adapt: check if recent behavior deviates
 * significantly from historical baseline.
 */
export function detectBehaviorChange(records: AccountActivityRecord[]): boolean {
  if (records.length < 14) return false
  const mid = Math.floor(records.length / 2)
  const historical = records.slice(0, mid).map((r) => r.txCount)
  const recent = records.slice(mid).map((r) => r.txCount)
  const histMean = mean(historical)
  const recentMean = mean(recent)
  if (histMean === 0) return recentMean > 0
  return Math.abs(recentMean - histMean) / histMean > 0.3
}

// ---------------------------------------------------------------------------
// Heatmap generation
// ---------------------------------------------------------------------------

/**
 * Generate a 24-hour × 7-day activity heatmap.
 * Returns a 2D array [hour][dayOfWeek] with average activity values.
 */
export function generateActivityHeatmap(records: AccountActivityRecord[]): ActivityHeatmap {
  // 24 rows (hours) × 7 columns (days)
  const grid: number[][] = Array.from({ length: 24 }, () => new Array(7).fill(0))
  const counts: number[][] = Array.from({ length: 24 }, () => new Array(7).fill(0))

  for (const r of records) {
    const d = new Date(r.timestamp)
    const hour = d.getHours()
    const dow = d.getDay()
    grid[hour][dow] += r.txCount
    counts[hour][dow] += 1
  }

  return grid.map((row, hour) => row.map((sum, dow) => (counts[hour][dow] > 0 ? parseFloat((sum / counts[hour][dow]).toFixed(2)) : 0)))
}

// ---------------------------------------------------------------------------
// Activity prediction engine
// ---------------------------------------------------------------------------

/**
 * Build per-period predictions using behavioural modeling:
 * - Weighted smoothing for trend
 * - Day-of-week seasonality
 * - Hour-of-day profile (for day horizon)
 * - Calendar event adjustments
 * - Logistic active-probability estimation
 */
export function predictAccountActivity(
  records: AccountActivityRecord[],
  horizon: ActivityHorizon,
  calendarEvents: CalendarEvent[] = [],
  config: ActivityModelConfig = DEFAULT_MODEL_CONFIG,
): ActivityPrediction[] {
  if (records.length < config.minDataDays) return []

  const values = records.map((r) => r.txCount)
  const n = values.length

  const stepMs = horizon === 'day' ? 3_600_000 : horizon === 'week' ? 86_400_000 : 7 * 86_400_000
  const steps = horizon === 'day' ? 24 : horizon === 'week' ? 7 : 4

  // Compute day-of-week seasonality weights
  const dowBuckets: number[][] = Array.from({ length: 7 }, () => [])
  records.forEach((r) => {
    const dow = new Date(r.timestamp).getDay()
    dowBuckets[dow].push(r.txCount)
  })
  const dowMeans = dowBuckets.map((b) => (b.length ? mean(b) : 0))
  const overallMean = mean(dowMeans.filter((v) => v > 0)) || 1
  const dowWeights = dowMeans.map((m) => (m > 0 ? m / overallMean : 1))

  // Compute hour-of-day weights (only for day horizon)
  const hourBuckets: number[][] = Array.from({ length: 24 }, () => [])
  records.forEach((r) => {
    const h = new Date(r.timestamp).getHours()
    hourBuckets[h].push(r.txCount)
  })
  const hourMeans = hourBuckets.map((b) => (b.length ? mean(b) : 0))
  const overallHourMean = mean(hourMeans.filter((v) => v > 0)) || 1
  const hourWeights = hourMeans.map((m) => (m > 0 ? m / overallHourMean : 1))

  // Trend from recent data
  const recentWindow = values.slice(-Math.min(30, n))
  const xs = recentWindow.map((_, i) => i)
  const { slope, intercept } = linearRegression(xs, recentWindow)

  // Activity rate (fraction of periods with activity)
  const activityRate = values.filter((v) => v > 0).length / n

  // Smoothed baseline
  const smoothed = weightedSmoothing(recentWindow, config.recencyBias)
  const baseline = smoothed[smoothed.length - 1] ?? mean(recentWindow)

  const residualStd = stdDev(
    recentWindow.map((v, i) => v - (smoothed[i] ?? baseline)),
  )

  const lastTs = new Date(records[n - 1].timestamp).getTime()

  return Array.from({ length: steps }, (_, s) => {
    const ts = new Date(lastTs + (s + 1) * stepMs)
    const iso = ts.toISOString()

    // Base prediction from trend
    let pred = Math.max(0, baseline + slope * (s + 1))

    // Apply day-of-week weight
    const dow = ts.getDay()
    pred *= dowWeights[dow] ?? 1

    // Apply hour-of-day weight for day-level predictions
    if (horizon === 'day') {
      const hour = ts.getHours()
      pred *= hourWeights[hour] ?? 1
    }

    // Apply calendar event adjustments
    const dayStr = ts.toISOString().slice(0, 10)
    for (const event of calendarEvents) {
      if (event.date.slice(0, 10) === dayStr) {
        pred *= event.activityMultiplier
      }
    }

    pred = Math.max(0, Math.round(pred))

    // Confidence decays with horizon
    const baseConf = Math.min(0.95, activityRate + 0.1)
    const confidence = parseFloat((baseConf * Math.pow(0.96, s)).toFixed(3))

    // Active probability via logistic model
    const logitScore = (pred - baseline) / Math.max(1, residualStd)
    const activeProbability = parseFloat(clamp(sigmoid(logitScore) * activityRate + activityRate * 0.3, 0, 1).toFixed(3))

    // CI width
    const ciWidth = residualStd * (1.96 + s * 0.03)

    return {
      timestamp: iso,
      predictedTxCount: pred,
      activeProbability,
      lowerBound: Math.max(0, Math.round(pred - ciWidth)),
      upperBound: Math.round(pred + ciWidth),
      confidence,
      label: formatActivityLabel(ts, horizon),
    }
  })
}

function formatActivityLabel(d: Date, horizon: ActivityHorizon): string {
  if (horizon === 'day') {
    return `${String(d.getHours()).padStart(2, '0')}:00`
  }
  if (horizon === 'week') {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  }
  return `Week of ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

// ---------------------------------------------------------------------------
// Notification generation
// ---------------------------------------------------------------------------

/**
 * Generate proactive notifications based on predictions and patterns.
 */
export function generateActivityNotifications(
  accountId: string,
  predictions: ActivityPrediction[],
  historicalRecords: AccountActivityRecord[],
  calendarEvents: CalendarEvent[] = [],
  config: ActivityModelConfig = DEFAULT_MODEL_CONFIG,
): ActivityNotification[] {
  const notifications: ActivityNotification[] = []
  if (!predictions.length) return notifications

  const values = historicalRecords.map((r) => r.txCount)
  const histMean = mean(values)
  const histStd = stdDev(values, histMean)

  for (const pred of predictions) {
    // High activity prediction
    if (
      pred.predictedTxCount > histMean * config.highActivityMultiplier &&
      pred.confidence > 0.5
    ) {
      notifications.push({
        id: `notif_high_${accountId}_${pred.timestamp}`,
        accountId,
        type: 'high_activity_predicted',
        message: `High activity predicted: ~${pred.predictedTxCount} transactions expected at ${pred.label}. Consider preparing resources.`,
        severity: pred.predictedTxCount > histMean * 3 ? 'alert' : 'warning',
        timestamp: new Date().toISOString(),
        forecastTimestamp: pred.timestamp,
        predictedValue: pred.predictedTxCount,
      })
    }

    // Inactivity prediction (long-active account going quiet)
    if (
      histMean > 5 &&
      pred.activeProbability < 0.1 &&
      pred.confidence > 0.6
    ) {
      notifications.push({
        id: `notif_inactive_${accountId}_${pred.timestamp}`,
        accountId,
        type: 'inactivity_predicted',
        message: `Account inactivity predicted at ${pred.label}. This is unusual for this account.`,
        severity: 'info',
        timestamp: new Date().toISOString(),
        forecastTimestamp: pred.timestamp,
      })
    }
  }

  // Calendar event notifications
  for (const event of calendarEvents) {
    if (event.activityMultiplier > 1.5) {
      notifications.push({
        id: `notif_event_${accountId}_${event.id}`,
        accountId,
        type: 'calendar_event',
        message: `Upcoming event "${event.title}" on ${event.date} may increase activity by ${Math.round((event.activityMultiplier - 1) * 100)}%.`,
        severity: 'info',
        timestamp: new Date().toISOString(),
        forecastTimestamp: event.date,
      })
    }
  }

  // Behavior change notification
  if (detectBehaviorChange(historicalRecords)) {
    notifications.push({
      id: `notif_change_${accountId}_${Date.now()}`,
      accountId,
      type: 'pattern_change',
      message: `Significant behavior change detected for this account. Predictions have been adapted to recent activity patterns.`,
      severity: 'info',
      timestamp: new Date().toISOString(),
      forecastTimestamp: new Date().toISOString(),
    })
  }

  // Deduplicate and return (max 10 per call)
  return notifications.slice(0, 10)
}

// ---------------------------------------------------------------------------
// Accuracy estimation
// ---------------------------------------------------------------------------

/**
 * Estimate model accuracy using leave-one-out holdout on recent data.
 * Returns 0–1 accuracy score.
 */
export function estimateModelAccuracy(records: AccountActivityRecord[]): number {
  if (records.length < 10) return 0
  const holdoutSize = Math.ceil(records.length * 0.2)
  const trainRecords = records.slice(0, -holdoutSize)
  const testRecords = records.slice(-holdoutSize)

  const trainValues = trainRecords.map((r) => r.txCount)
  const smoothed = weightedSmoothing(trainValues, 0.7)
  const baseline = smoothed[smoothed.length - 1] ?? 0

  const testValues = testRecords.map((r) => r.txCount)
  const mapeVals = testValues
    .map((actual, i) => {
      if (actual === 0) return 0
      return Math.abs(actual - baseline) / actual
    })
    .filter((v) => v < 5) // exclude extreme outliers

  const mape = mapeVals.length ? mean(mapeVals) : 0.25
  return parseFloat(clamp(1 - mape, 0, 1).toFixed(4))
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Full account activity analysis: predictions, patterns, heatmap, and notifications.
 */
export function analyzeAccountActivity(
  records: AccountActivityRecord[],
  horizon: ActivityHorizon = 'week',
  calendarEvents: CalendarEvent[] = [],
  config: ActivityModelConfig = DEFAULT_MODEL_CONFIG,
): AccountActivityForecast {
  const accountId = records[0]?.accountId ?? 'unknown'
  const n = records.length
  const values = records.map((r) => r.txCount)

  // Detect patterns
  const dailyPatterns = detectDailyPatterns(records)
  const weeklyPatterns = detectWeeklyPatterns(records)
  const monthlyPatterns = detectMonthlyPatterns(records)
  const allPatterns = [...weeklyPatterns, ...dailyPatterns, ...monthlyPatterns]

  // Heatmap
  const heatmap = generateActivityHeatmap(records)

  // Predictions
  const predictions = predictAccountActivity(records, horizon, calendarEvents, config)

  // Notifications
  const notifications = generateActivityNotifications(
    accountId,
    predictions,
    records,
    calendarEvents,
    config,
  )

  // Accuracy
  const accuracy = estimateModelAccuracy(records)

  // Trend
  const trend = detectActivityTrend(values)

  // Behavior adaptation flag
  const adaptedToRecentChanges = detectBehaviorChange(records)

  return {
    accountId,
    horizon,
    predictions,
    patterns: allPatterns,
    heatmap,
    notifications,
    accuracy,
    trend,
    generatedAt: new Date().toISOString(),
    dataPointsUsed: n,
    adaptedToRecentChanges,
  }
}

function detectActivityTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (values.length < 3) return 'stable'
  const xs = values.map((_, i) => i)
  const avg = mean(values)
  if (avg === 0) return 'stable'
  const { slope } = linearRegression(xs, values)
  const rel = slope / avg
  if (rel > 0.01) return 'increasing'
  if (rel < -0.01) return 'decreasing'
  return 'stable'
}

// ---------------------------------------------------------------------------
// Utility: convert Stellar operation records to AccountActivityRecords
// ---------------------------------------------------------------------------

export interface StellarOperationRecord {
  created_at: string
  source_account?: string
  type: string
  amount?: string
  transaction_successful?: boolean
}

/**
 * Convert Stellar operation records into hourly AccountActivityRecords
 * suitable for activity modeling.
 */
export function operationsToActivityRecords(
  ops: StellarOperationRecord[],
  accountId: string,
  bucket: 'hourly' | 'daily' = 'daily',
): AccountActivityRecord[] {
  if (!ops.length) return []

  const bucketMs = bucket === 'hourly' ? 3_600_000 : 86_400_000
  const grouped = new Map<
    number,
    { txCount: number; operationCount: number; types: Set<string> }
  >()

  for (const op of ops) {
    const ts = new Date(op.created_at).getTime()
    const key = Math.floor(ts / bucketMs) * bucketMs
    const existing = grouped.get(key) ?? { txCount: 0, operationCount: 0, types: new Set() }
    if (op.transaction_successful !== false) {
      existing.txCount += 1
    }
    existing.operationCount += 1
    existing.types.add(op.type)
    grouped.set(key, existing)
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, data]) => ({
      timestamp: new Date(ts).toISOString(),
      accountId,
      txCount: data.txCount,
      operationCount: data.operationCount,
      operationTypes: Array.from(data.types),
      isActive: data.txCount > 0,
    }))
}
