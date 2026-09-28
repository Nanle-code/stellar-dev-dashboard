/**
 * Prediction Engine — lightweight trend forecasting for time-series data.
 *
 * Implements:
 *  - Linear regression (OLS)
 *  - Exponential smoothing (Holt-Winters additive)
 *  - Confidence interval construction (empirical residual std-dev)
 *
 * All computation is synchronous and runs in the main thread – datasets are
 * expected to be in the hundreds of points, never millions.
 */

export interface DataPoint {
  timestamp: number
  value: number
}

export interface PredictionPoint {
  timestamp: number
  predicted: number
  lower: number
  upper: number
  isHistorical: false
}

export interface HistoricalPoint extends DataPoint {
  isHistorical: true
  trend?: number
}

export type ChartPoint = HistoricalPoint | PredictionPoint

export type ModelType = 'linear' | 'exponential' | 'holtwinters'

export interface PredictionConfig {
  model: ModelType
  horizon: number          // number of future steps to predict
  confidenceLevel: number  // e.g. 0.90 = 90 %
  smoothingAlpha?: number  // Holt-Winters α  (0 < α < 1)
  smoothingBeta?: number   // Holt-Winters β  (0 < β < 1)
}

export interface PredictionResult {
  historical: HistoricalPoint[]
  predictions: PredictionPoint[]
  combined: ChartPoint[]
  model: ModelType
  rSquared: number
  rmse: number
  trendSlope: number
  trendDirection: 'up' | 'down' | 'flat'
}

// ─── helpers ────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function std(arr: number[], m = mean(arr)): number {
  if (arr.length < 2) return 0
  const variance = arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

/** Critical z-value for a two-tailed confidence interval */
function zCritical(level: number): number {
  const zTable: Record<number, number> = {
    0.80: 1.282,
    0.85: 1.440,
    0.90: 1.645,
    0.95: 1.960,
    0.99: 2.576,
  }
  // Find closest key
  const keys = Object.keys(zTable).map(Number)
  const closest = keys.reduce((prev, cur) =>
    Math.abs(cur - level) < Math.abs(prev - level) ? cur : prev
  )
  return zTable[closest] ?? 1.96
}

// ─── OLS linear regression ──────────────────────────────────────────────────

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = xs.length
  const mx = mean(xs)
  const my = mean(ys)
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  const intercept = my - slope * mx
  const rSquared = syy === 0 ? 1 : (sxy ** 2) / (sxx * syy)
  return { slope, intercept, rSquared }
}

// ─── Holt-Winters double exponential smoothing (additive, no seasonality) ──

interface HWState {
  level: number
  trend: number
}

function holtWinters(
  ys: number[],
  alpha = 0.3,
  beta = 0.1,
): { fitted: number[]; state: HWState } {
  if (ys.length < 2) return { fitted: [...ys], state: { level: ys[0] ?? 0, trend: 0 } }

  let level = ys[0]
  let trend = ys[1] - ys[0]
  const fitted: number[] = [level]

  for (let i = 1; i < ys.length; i++) {
    const prevLevel = level
    level = alpha * ys[i] + (1 - alpha) * (level + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
    fitted.push(level + trend)
  }

  return { fitted, state: { level, trend } }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function generatePredictions(
  data: DataPoint[],
  config: PredictionConfig,
): PredictionResult {
  const { model, horizon, confidenceLevel, smoothingAlpha = 0.3, smoothingBeta = 0.1 } = config

  // Sort ascending by timestamp
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp)
  if (sorted.length < 3) {
    // Not enough data – return as-is with empty predictions
    const historical: HistoricalPoint[] = sorted.map(d => ({ ...d, isHistorical: true }))
    return {
      historical,
      predictions: [],
      combined: historical,
      model,
      rSquared: 0,
      rmse: 0,
      trendSlope: 0,
      trendDirection: 'flat',
    }
  }

  const xs = sorted.map((_, i) => i)          // integer indices
  const ys = sorted.map(d => d.value)
  const stepMs = mean(
    sorted.slice(1).map((d, i) => d.timestamp - sorted[i].timestamp)
  )

  // ── fit model ──────────────────────────────────────────────────────────────
  let fittedValues: number[]
  let trendSlope: number
  let intercept: number
  let rSquared: number

  if (model === 'linear') {
    const reg = linearRegression(xs, ys)
    trendSlope = reg.slope
    intercept = reg.intercept
    rSquared = reg.rSquared
    fittedValues = xs.map(x => reg.slope * x + reg.intercept)
  } else if (model === 'holtwinters') {
    const hw = holtWinters(ys, smoothingAlpha, smoothingBeta)
    fittedValues = hw.fitted
    // Derive effective slope from the state
    trendSlope = hw.state.trend
    intercept = hw.state.level
    rSquared = (() => {
      const my = mean(ys)
      const ssRes = ys.reduce((a, y, i) => a + (y - fittedValues[i]) ** 2, 0)
      const ssTot = ys.reduce((a, y) => a + (y - my) ** 2, 0)
      return ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)
    })()
  } else {
    // exponential: fit ln(y) ~ a + b*x
    const logYs = ys.map(y => (y > 0 ? Math.log(y) : 0))
    const reg = linearRegression(xs, logYs)
    trendSlope = reg.slope
    intercept = reg.intercept
    rSquared = reg.rSquared
    fittedValues = xs.map(x => Math.exp(reg.slope * x + reg.intercept))
  }

  // ── residuals & RMSE ───────────────────────────────────────────────────────
  const residuals = ys.map((y, i) => y - fittedValues[i])
  const rmse = Math.sqrt(mean(residuals.map(r => r ** 2)))
  const residualStd = std(residuals)
  const z = zCritical(confidenceLevel)

  // ── historical points with trend overlay ──────────────────────────────────
  const historical: HistoricalPoint[] = sorted.map((d, i) => ({
    ...d,
    isHistorical: true,
    trend: fittedValues[i],
  }))

  // ── future predictions ────────────────────────────────────────────────────
  const lastTs = sorted[sorted.length - 1].timestamp
  const lastX = sorted.length - 1

  const predictions: PredictionPoint[] = Array.from({ length: horizon }, (_, h) => {
    const futureX = lastX + h + 1
    const futureTs = lastTs + (h + 1) * stepMs

    let predicted: number
    if (model === 'linear') {
      predicted = trendSlope * futureX + intercept
    } else if (model === 'holtwinters') {
      predicted = intercept + trendSlope * (h + 1)
    } else {
      predicted = Math.exp(trendSlope * futureX + intercept)
    }

    // Interval widens with horizon distance
    const widthFactor = Math.sqrt(1 + (h + 1) / sorted.length)
    const halfWidth = z * residualStd * widthFactor

    return {
      timestamp: futureTs,
      predicted: Math.max(0, predicted),
      lower: Math.max(0, predicted - halfWidth),
      upper: Math.max(0, predicted + halfWidth),
      isHistorical: false,
    }
  })

  const trendDirection: 'up' | 'down' | 'flat' =
    trendSlope > rmse * 0.05 ? 'up' : trendSlope < -rmse * 0.05 ? 'down' : 'flat'

  return {
    historical,
    predictions,
    combined: [...historical, ...predictions],
    model,
    rSquared,
    rmse,
    trendSlope,
    trendDirection,
  }
}

/**
 * Generate synthetic demo data (random walk) for showcasing when no real
 * account data is available.
 */
export function generateDemoData(
  points = 60,
  startValue = 1000,
  volatility = 30,
  trend = 2,
): DataPoint[] {
  const now = Date.now()
  const step = 24 * 60 * 60 * 1000 // 1 day
  let value = startValue
  return Array.from({ length: points }, (_, i) => {
    value += trend + (Math.random() - 0.48) * volatility
    value = Math.max(value, 1)
    return { timestamp: now - (points - i) * step, value }
  })
}
