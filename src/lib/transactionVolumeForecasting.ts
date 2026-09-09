/**
 * transactionVolumeForecasting.ts
 * Issue #541: Transaction Volume Forecasting for Capacity Planning
 *
 * Implements time-series forecasting (ARIMA-inspired, exponential smoothing,
 * LSTM-like sequential model) on historical transaction volume data.
 * Provides multi-horizon predictions (hourly, daily, weekly) with confidence
 * intervals, anomaly detection for volume spikes, and threshold alerting.
 *
 * Runs entirely client-side — no external API key required.
 * Follows the same patterns as capacityPrediction.ts and feePredictor.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single historical transaction volume data point */
export interface VolumeDataPoint {
  /** ISO-8601 timestamp */
  timestamp: string
  /** Number of transactions in this period */
  txCount: number
  /** Number of operations in this period */
  operationCount: number
  /** Total value transferred (in stroops, if known) */
  totalValue?: number
  /** Network: 'mainnet' | 'testnet' | 'futurenet' */
  network?: string
  /** Account ID if tracking a specific account; omit for network-wide */
  accountId?: string
}

/** Forecast horizon options */
export type ForecastHorizon = 'hourly' | 'daily' | 'weekly'

/** A single forecasted data point */
export interface ForecastPoint {
  /** ISO-8601 timestamp of the forecasted period */
  timestamp: string
  /** Predicted transaction count */
  predictedTxCount: number
  /** Lower bound of the confidence interval */
  lowerBound: number
  /** Upper bound of the confidence interval */
  upperBound: number
  /** Model confidence 0–1 */
  confidence: number
  /** Human-readable period label */
  label: string
}

/** A complete forecast result for one horizon */
export interface VolumeForecast {
  horizon: ForecastHorizon
  points: ForecastPoint[]
  /** Overall accuracy estimate 0–1 */
  accuracy: number
  /** Model type used */
  modelType: 'arima' | 'exponential_smoothing' | 'lstm_sequential' | 'ensemble'
  generatedAt: string
  /** Number of historical points used */
  dataPointsUsed: number
  /** Mean absolute percentage error estimate */
  mapeEstimate: number
  /** Whether seasonality was detected */
  seasonalityDetected: boolean
  /** Trend direction */
  trend: 'increasing' | 'decreasing' | 'stable'
}

/** A detected volume spike or anomaly */
export interface VolumeAnomaly {
  id: string
  timestamp: string
  actualTxCount: number
  expectedTxCount: number
  /** Deviation as a multiplier, e.g. 3.2 = 3.2× the expected */
  deviationFactor: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  /** Whether the anomaly is a predicted future spike */
  isPredicted: boolean
  description: string
}

/** Alert configuration for volume thresholds */
export interface VolumeAlert {
  id: string
  label: string
  /** Threshold transaction count */
  threshold: number
  /** Trigger when volume goes above or below threshold */
  direction: 'above' | 'below'
  horizon: ForecastHorizon
  enabled: boolean
  createdAt: string
  /** Last time this alert fired */
  lastTriggeredAt?: string
}

/** An alert that has triggered */
export interface TriggeredAlert {
  alert: VolumeAlert
  triggeredAt: string
  forecastedValue: number
  message: string
}

/** Retraining schedule configuration */
export interface RetrainingConfig {
  intervalDays: number
  lastTrainedAt?: string
  nextTrainedAt?: string
  minDataPointsRequired: number
}

/** Full analysis result */
export interface VolumeAnalysisResult {
  forecasts: Record<ForecastHorizon, VolumeForecast>
  anomalies: VolumeAnomaly[]
  triggeredAlerts: TriggeredAlert[]
  retrainingConfig: RetrainingConfig
  analyzedAt: string
  dataPointsAnalyzed: number
  summary: {
    trend: 'increasing' | 'decreasing' | 'stable'
    averageDailyTxCount: number
    peakTxCount: number
    peakTimestamp: string
    forecastAccuracy24h: number
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_RETRAINING_INTERVAL_DAYS = 7
export const MIN_DATA_POINTS = 5
export const ANOMALY_ZSCORE_THRESHOLD = 2.5
export const CONFIDENCE_DECAY_FACTOR = 0.97

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

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 }
  const xMean = mean(xs)
  const yMean = mean(ys)
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean)
    den += (xs[i] - xMean) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  return { slope, intercept: yMean - slope * xMean }
}

/** Simple exponential smoothing */
function expSmoothing(values: number[], alpha = 0.3): number[] {
  if (!values.length) return []
  const out: number[] = [values[0]]
  for (let i = 1; i < values.length; i++) {
    out.push(alpha * values[i] + (1 - alpha) * out[i - 1])
  }
  return out
}

/** Double exponential smoothing (Holt's method) for trending data */
function holtSmoothing(
  values: number[],
  alpha = 0.3,
  beta = 0.1,
): { smoothed: number[]; level: number; trend: number } {
  if (!values.length) return { smoothed: [], level: 0, trend: 0 }
  if (values.length === 1) return { smoothed: [values[0]], level: values[0], trend: 0 }

  let level = values[0]
  let trend = values[1] - values[0]
  const smoothed: number[] = [level + trend]

  for (let i = 1; i < values.length; i++) {
    const prevLevel = level
    level = alpha * values[i] + (1 - alpha) * (level + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
    smoothed.push(level + trend)
  }
  return { smoothed, level, trend }
}

/** ARIMA-inspired AR(p) model — uses p lagged values for prediction */
function arModel(
  values: number[],
  p = 3,
): { coefficients: number[]; intercept: number } {
  if (values.length < p + 2) {
    return { coefficients: new Array(p).fill(0), intercept: mean(values) }
  }

  // Build lag matrix
  const X: number[][] = []
  const y: number[] = []
  for (let i = p; i < values.length; i++) {
    X.push(values.slice(i - p, i).reverse())
    y.push(values[i])
  }

  // OLS via normal equations (simplified for small p)
  const n = X.length
  // Augment with intercept column
  const Xa = X.map((row) => [1, ...row])
  const cols = Xa[0].length
  const XtX: number[][] = Array.from({ length: cols }, () => new Array(cols).fill(0))
  const Xty: number[] = new Array(cols).fill(0)

  for (let i = 0; i < n; i++) {
    for (let r = 0; r < cols; r++) {
      Xty[r] += Xa[i][r] * y[i]
      for (let c = 0; c < cols; c++) {
        XtX[r][c] += Xa[i][r] * Xa[i][c]
      }
    }
  }

  // Solve via Gaussian elimination
  const coeffs = gaussianElimination(XtX, Xty)
  return {
    intercept: coeffs[0] ?? 0,
    coefficients: coeffs.slice(1),
  }
}

function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = A.length
  const aug = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    }
    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]
    if (Math.abs(aug[col][col]) < 1e-12) continue

    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col] / aug[col][col]
      for (let c = col; c <= n; c++) {
        aug[row][c] -= factor * aug[col][c]
      }
    }
  }

  return aug.map((row) => (Math.abs(row[n - 1]) < 1e-12 ? 0 : row[n] / row[n - 1]))
}

/** LSTM-like sequential weighting: recent points weighted more heavily */
function lstmSequentialForecast(values: number[], steps: number): number[] {
  if (!values.length) return new Array(steps).fill(0)
  const n = values.length
  // Weight recent values more (exponentially decaying weights from end)
  const weights = values.map((_, i) => Math.exp((i - n + 1) * 0.15))
  const wSum = weights.reduce((s, w) => s + w, 0)
  const wMean = values.reduce((s, v, i) => s + v * weights[i], 0) / wSum

  // Compute weighted trend
  const xs = values.map((_, i) => i)
  const { slope } = linearRegression(xs, values)

  // Apply seasonal factors if enough data
  const seasonWeights = computeSeasonalWeights(values)

  return Array.from({ length: steps }, (_, s) => {
    const base = wMean + slope * (n + s)
    const dayOfWeek = (n + s) % 7
    const seasonal = seasonWeights[dayOfWeek] ?? 1
    return Math.max(0, base * seasonal)
  })
}

/** Compute day-of-week seasonal multipliers from a values array */
function computeSeasonalWeights(values: number[]): number[] {
  const buckets: number[][] = Array.from({ length: 7 }, () => [])
  values.forEach((v, i) => buckets[i % 7].push(v))
  const dayMeans = buckets.map((b) => (b.length ? mean(b) : 0))
  const overall = mean(dayMeans.filter((v) => v > 0))
  if (overall === 0) return new Array(7).fill(1)
  return dayMeans.map((m) => (m > 0 ? m / overall : 1))
}

/** Detect weekly seasonality */
function detectSeasonality(values: number[]): boolean {
  if (values.length < 14) return false
  const weights = computeSeasonalWeights(values)
  const maxDev = Math.max(...weights.map((w) => Math.abs(w - 1)))
  return maxDev > 0.15
}

/** Determine trend direction */
function detectTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
  if (values.length < 3) return 'stable'
  const xs = values.map((_, i) => i)
  const { slope } = linearRegression(xs, values)
  const avg = mean(values)
  if (avg === 0) return 'stable'
  const relSlope = slope / avg
  if (relSlope > 0.01) return 'increasing'
  if (relSlope < -0.01) return 'decreasing'
  return 'stable'
}

// ---------------------------------------------------------------------------
// Forecasting engine
// ---------------------------------------------------------------------------

/**
 * Generate a forecast for a given horizon using an ensemble of models.
 */
export function forecastVolume(
  points: VolumeDataPoint[],
  horizon: ForecastHorizon,
  steps?: number,
): VolumeForecast {
  const values = points.map((p) => p.txCount)
  const n = values.length

  if (n < MIN_DATA_POINTS) {
    return buildEmptyForecast(horizon, points[n - 1]?.timestamp, n)
  }

  const defaultSteps = horizon === 'hourly' ? 24 : horizon === 'daily' ? 14 : 8
  const forecastSteps = steps ?? defaultSteps
  const seasonalDetected = detectSeasonality(values)
  const trend = detectTrend(values)

  // --- Model 1: Holt exponential smoothing ---
  const { level, trend: holtTrend } = holtSmoothing(values, 0.3, 0.1)
  const holtPredictions = Array.from(
    { length: forecastSteps },
    (_, s) => Math.max(0, level + holtTrend * (s + 1)),
  )

  // --- Model 2: AR(3) model ---
  const { coefficients, intercept } = arModel(values, Math.min(3, n - 2))
  const arHistory = [...values]
  const arPredictions: number[] = []
  for (let s = 0; s < forecastSteps; s++) {
    const lags = arHistory.slice(-coefficients.length).reverse()
    const pred = intercept + lags.reduce((sum, lag, i) => sum + (coefficients[i] ?? 0) * lag, 0)
    const clamped = Math.max(0, pred)
    arPredictions.push(clamped)
    arHistory.push(clamped)
  }

  // --- Model 3: LSTM-sequential ---
  const lstmPredictions = lstmSequentialForecast(values, forecastSteps)

  // --- Ensemble: weighted average ---
  const ensemble = holtPredictions.map((h, i) =>
    Math.round((h * 0.4 + arPredictions[i] * 0.35 + lstmPredictions[i] * 0.25)),
  )

  // Compute prediction interval width from historical residuals
  const smoothed = expSmoothing(values, 0.3)
  const residuals = values.map((v, i) => v - smoothed[i])
  const residualStd = stdDev(residuals)

  // MAPE estimate
  const lastQuarter = values.slice(-Math.ceil(n / 4))
  const smoothedLQ = expSmoothing(lastQuarter, 0.3)
  const mapeVals = lastQuarter
    .map((v, i) => (v > 0 ? Math.abs(v - smoothedLQ[i]) / v : 0))
    .filter((v) => v < 10)
  const mapeEstimate = mapeVals.length ? mean(mapeVals) : 0.15
  const accuracy = Math.max(0, Math.min(1, 1 - mapeEstimate))

  // Build timestamp sequence
  const lastTs = new Date(points[n - 1].timestamp).getTime()
  const stepMs =
    horizon === 'hourly' ? 3_600_000 : horizon === 'daily' ? 86_400_000 : 7 * 86_400_000

  const forecastPoints: ForecastPoint[] = ensemble.map((pred, s) => {
    const ts = new Date(lastTs + (s + 1) * stepMs).toISOString()
    const confidenceDecay = Math.pow(CONFIDENCE_DECAY_FACTOR, s)
    const baseConfidence = accuracy * confidenceDecay
    const intervalWidth = residualStd * (1.645 + s * 0.05) // ~90% CI, grows with horizon
    const label = formatLabel(ts, horizon)
    return {
      timestamp: ts,
      predictedTxCount: pred,
      lowerBound: Math.max(0, Math.round(pred - intervalWidth)),
      upperBound: Math.round(pred + intervalWidth),
      confidence: parseFloat(baseConfidence.toFixed(3)),
      label,
    }
  })

  return {
    horizon,
    points: forecastPoints,
    accuracy: parseFloat(accuracy.toFixed(4)),
    modelType: 'ensemble',
    generatedAt: new Date().toISOString(),
    dataPointsUsed: n,
    mapeEstimate: parseFloat(mapeEstimate.toFixed(4)),
    seasonalityDetected: seasonalDetected,
    trend,
  }
}

function buildEmptyForecast(
  horizon: ForecastHorizon,
  lastTs?: string,
  dataPoints = 0,
): VolumeForecast {
  return {
    horizon,
    points: [],
    accuracy: 0,
    modelType: 'ensemble',
    generatedAt: new Date().toISOString(),
    dataPointsUsed: dataPoints,
    mapeEstimate: 1,
    seasonalityDetected: false,
    trend: 'stable',
  }
}

function formatLabel(iso: string, horizon: ForecastHorizon): string {
  const d = new Date(iso)
  if (horizon === 'hourly') {
    return `${d.toLocaleDateString()} ${String(d.getHours()).padStart(2, '0')}:00`
  }
  if (horizon === 'daily') {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  }
  return `Week of ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

/**
 * Detect volume spikes and anomalies in historical data.
 * Uses Z-score based detection with a sliding window for local context.
 */
export function detectVolumeAnomalies(points: VolumeDataPoint[]): VolumeAnomaly[] {
  if (points.length < MIN_DATA_POINTS) return []

  const values = points.map((p) => p.txCount)
  const windowSize = Math.min(30, Math.floor(values.length / 2))
  const anomalies: VolumeAnomaly[] = []

  for (let i = windowSize; i < values.length; i++) {
    const window = values.slice(i - windowSize, i)
    const mu = mean(window)
    const sigma = stdDev(window, mu)
    // If stdDev is zero (all identical), use 1 as fallback to allow absolute deviations to score
    const effectiveSigma = sigma === 0 ? 1 : sigma

    const z = (values[i] - mu) / effectiveSigma
    if (Math.abs(z) >= ANOMALY_ZSCORE_THRESHOLD) {
      const deviationFactor = parseFloat((values[i] / Math.max(1, mu)).toFixed(2))
      const absZ = Math.abs(z)
      const severity: VolumeAnomaly['severity'] =
        absZ >= 4.5 ? 'critical' : absZ >= 3.5 ? 'high' : absZ >= 3.0 ? 'medium' : 'low'

      anomalies.push({
        id: `anomaly_${i}_${points[i].timestamp}`,
        timestamp: points[i].timestamp,
        actualTxCount: values[i],
        expectedTxCount: Math.round(mu),
        deviationFactor,
        severity,
        isPredicted: false,
        description:
          z > 0
            ? `Volume spike: ${values[i]} txns vs expected ~${Math.round(mu)} (${deviationFactor}× normal)`
            : `Volume drop: ${values[i]} txns vs expected ~${Math.round(mu)} (${(1 / deviationFactor).toFixed(2)}× below normal)`,
      })
    }
  }

  return anomalies
}

/**
 * Detect predicted future spikes from forecast points.
 */
export function detectForecastedAnomalies(
  historicalPoints: VolumeDataPoint[],
  forecast: VolumeForecast,
): VolumeAnomaly[] {
  if (!historicalPoints.length || !forecast.points.length) return []

  const historicalValues = historicalPoints.map((p) => p.txCount)
  const mu = mean(historicalValues)
  const sigma = stdDev(historicalValues, mu)
  if (sigma === 0) return []

  return forecast.points
    .filter((fp) => {
      const z = (fp.predictedTxCount - mu) / sigma
      return Math.abs(z) >= ANOMALY_ZSCORE_THRESHOLD
    })
    .map((fp, i) => {
      const deviationFactor = parseFloat((fp.predictedTxCount / Math.max(1, mu)).toFixed(2))
      const z = Math.abs((fp.predictedTxCount - mu) / sigma)
      const severity: VolumeAnomaly['severity'] =
        z >= 4.5 ? 'critical' : z >= 3.5 ? 'high' : z >= 3.0 ? 'medium' : 'low'
      return {
        id: `predicted_${i}_${fp.timestamp}`,
        timestamp: fp.timestamp,
        actualTxCount: 0,
        expectedTxCount: Math.round(mu),
        deviationFactor,
        severity,
        isPredicted: true,
        description: `Predicted volume spike: ~${fp.predictedTxCount} txns forecasted vs baseline ~${Math.round(mu)}`,
      }
    })
}

// ---------------------------------------------------------------------------
// Alert evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a set of volume alerts against a forecast.
 * Returns any alerts that have triggered.
 */
export function evaluateVolumeAlerts(
  alerts: VolumeAlert[],
  forecasts: Record<ForecastHorizon, VolumeForecast>,
): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = []

  for (const alert of alerts) {
    if (!alert.enabled) continue
    const forecast = forecasts[alert.horizon]
    if (!forecast || !forecast.points.length) continue

    for (const fp of forecast.points) {
      const exceeded =
        alert.direction === 'above'
          ? fp.predictedTxCount > alert.threshold
          : fp.predictedTxCount < alert.threshold

      if (exceeded) {
        triggered.push({
          alert,
          triggeredAt: new Date().toISOString(),
          forecastedValue: fp.predictedTxCount,
          message:
            alert.direction === 'above'
              ? `Forecasted ${alert.horizon} volume of ${fp.predictedTxCount} txns exceeds threshold of ${alert.threshold} at ${fp.label}`
              : `Forecasted ${alert.horizon} volume of ${fp.predictedTxCount} txns drops below threshold of ${alert.threshold} at ${fp.label}`,
        })
        break // Only trigger once per alert
      }
    }
  }

  return triggered
}

// ---------------------------------------------------------------------------
// Retraining schedule
// ---------------------------------------------------------------------------

/**
 * Compute the retraining schedule for models.
 */
export function computeRetrainingConfig(lastTrainedAt?: string): RetrainingConfig {
  const intervalDays = DEFAULT_RETRAINING_INTERVAL_DAYS
  const lastTrained = lastTrainedAt ? new Date(lastTrainedAt) : undefined
  const nextTrained = lastTrained
    ? new Date(lastTrained.getTime() + intervalDays * 86_400_000)
    : undefined

  return {
    intervalDays,
    lastTrainedAt: lastTrained?.toISOString(),
    nextTrainedAt: nextTrained?.toISOString(),
    minDataPointsRequired: MIN_DATA_POINTS,
  }
}

/**
 * Check whether the model should be retrained.
 */
export function shouldRetrain(config: RetrainingConfig): boolean {
  if (!config.lastTrainedAt) return true
  const now = Date.now()
  const last = new Date(config.lastTrainedAt).getTime()
  return now - last >= config.intervalDays * 86_400_000
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Full transaction volume analysis: forecasts for all horizons,
 * anomaly detection, and alert evaluation.
 */
export function analyzeTransactionVolume(
  points: VolumeDataPoint[],
  alerts: VolumeAlert[] = [],
  lastTrainedAt?: string,
): VolumeAnalysisResult {
  const n = points.length
  const values = points.map((p) => p.txCount)

  // Forecasts
  const forecasts: Record<ForecastHorizon, VolumeForecast> = {
    hourly: forecastVolume(points, 'hourly'),
    daily: forecastVolume(points, 'daily'),
    weekly: forecastVolume(points, 'weekly'),
  }

  // Anomaly detection
  const historicalAnomalies = detectVolumeAnomalies(points)
  const predictedAnomalies = detectForecastedAnomalies(points, forecasts.daily)
  const anomalies = [...historicalAnomalies, ...predictedAnomalies]

  // Alert evaluation
  const triggeredAlerts = evaluateVolumeAlerts(alerts, forecasts)

  // Retraining config
  const retrainingConfig = computeRetrainingConfig(lastTrainedAt)

  // Summary stats
  const avgDaily = n > 0 ? mean(values) : 0
  const peakIdx = values.indexOf(Math.max(...values))
  const peakTxCount = values[peakIdx] ?? 0
  const peakTimestamp = points[peakIdx]?.timestamp ?? new Date().toISOString()
  const trend = detectTrend(values)

  return {
    forecasts,
    anomalies,
    triggeredAlerts,
    retrainingConfig,
    analyzedAt: new Date().toISOString(),
    dataPointsAnalyzed: n,
    summary: {
      trend,
      averageDailyTxCount: parseFloat(avgDaily.toFixed(2)),
      peakTxCount,
      peakTimestamp,
      forecastAccuracy24h: parseFloat((forecasts.daily.accuracy * 100).toFixed(1)),
    },
  }
}

// ---------------------------------------------------------------------------
// Utility: convert raw Stellar ledger history to VolumeDataPoints
// ---------------------------------------------------------------------------

export interface LedgerRecord {
  sequence: number
  closedAt: string
  txSuccessCount?: number
  txFailedCount?: number
  operationCount?: number
}

/**
 * Convert an array of ledger records into hourly/daily VolumeDataPoints
 * suitable for forecasting.
 */
export function ledgerRecordsToVolumePoints(
  records: LedgerRecord[],
  bucket: 'hourly' | 'daily' = 'daily',
): VolumeDataPoint[] {
  if (!records.length) return []

  const bucketMs = bucket === 'hourly' ? 3_600_000 : 86_400_000
  const grouped = new Map<number, { txCount: number; operationCount: number }>()

  for (const r of records) {
    const ts = new Date(r.closedAt).getTime()
    const key = Math.floor(ts / bucketMs) * bucketMs
    const existing = grouped.get(key) ?? { txCount: 0, operationCount: 0 }
    existing.txCount += (r.txSuccessCount ?? 0) + (r.txFailedCount ?? 0)
    existing.operationCount += r.operationCount ?? 0
    grouped.set(key, existing)
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, data]) => ({
      timestamp: new Date(ts).toISOString(),
      txCount: data.txCount,
      operationCount: data.operationCount,
    }))
}
