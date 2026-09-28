type Num = number;

export interface DataPoint {
  ts: number; // epoch ms
  txCount: number;
  activeUsers: number;
  eventFlag?: number; // 0 or 1
}

export interface Model {
  weights: number[];
  residualStd: number;
  threshold: number;
}

function hourOfDay(ts: number) {
  return new Date(ts).getUTCHours();
}

function dayOfWeek(ts: number) {
  return new Date(ts).getUTCDay();
}

function buildFeatures(dp: DataPoint, rollingUsers: number): number[] {
  const h = hourOfDay(dp.ts);
  const d = dayOfWeek(dp.ts);
  const hourSin = Math.sin((2 * Math.PI * h) / 24);
  const hourCos = Math.cos((2 * Math.PI * h) / 24);
  const daySin = Math.sin((2 * Math.PI * d) / 7);
  const dayCos = Math.cos((2 * Math.PI * d) / 7);
  const evt = dp.eventFlag ? 1 : 0;
  return [1, hourSin, hourCos, daySin, dayCos, rollingUsers, dp.activeUsers, evt];
}

function transpose(m: number[][]): number[][] {
  return m[0].map((_, i) => m.map(r => r[i]));
}

function matMul(A: number[][], B: number[][]): number[][] {
  const aRows = A.length, aCols = A[0].length, bCols = B[0].length;
  const out: number[][] = Array.from({ length: aRows }, () => Array(bCols).fill(0));
  for (let i = 0; i < aRows; i++) for (let k = 0; k < aCols; k++) for (let j = 0; j < bCols; j++) out[i][j] += A[i][k] * B[k][j];
  return out;
}

function solveNormalEq(X: number[][], y: number[]): number[] {
  // w = (X^T X)^-1 X^T y via pseudo-inverse using normal equations and Gaussian elimination for small dims
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const Xty = matMul(Xt, y.map(v => [v]));
  // Augment XtX with Xty and solve linear system
  const n = XtX.length;
  const A: number[][] = XtX.map((row, i) => row.concat([Xty[i][0]]));
  // Gaussian elimination
  for (let i = 0; i < n; i++) {
    // pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    const tmp = A[i]; A[i] = A[maxRow]; A[maxRow] = tmp;
    const piv = A[i][i] || 1e-12;
    for (let k = i; k <= n; k++) A[i][k] /= piv;
    for (let r = 0; r < n; r++) if (r !== i) {
      const factor = A[r][i];
      for (let c = i; c <= n; c++) A[r][c] -= factor * A[i][c];
    }
  }
  return A.map(row => row[n]);
}

export function trainModel(history: DataPoint[], thresholdPercentile = 0.9): Model {
  if (history.length < 10) throw new Error('not enough data');
  // compute rolling users (simple previous hour value / moving average)
  const rolling: number[] = [];
  for (let i = 0; i < history.length; i++) {
    const window = history.slice(Math.max(0, i - 23), i + 1);
    const avg = window.reduce((s, p) => s + p.activeUsers, 0) / window.length;
    rolling.push(avg || history[i].activeUsers);
  }
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < history.length; i++) {
    X.push(buildFeatures(history[i], rolling[i]));
    y.push(history[i].txCount);
  }
  const weights = solveNormalEq(X, y);
  // residuals
  const preds = X.map(row => row.reduce((s, v, i) => s + v * weights[i], 0));
  const residuals = preds.map((p, i) => history[i].txCount - p);
  const std = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length) || 1;
  // threshold: percentile of txCount
  const sorted = [...y].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * thresholdPercentile)));
  const threshold = sorted[idx];
  return { weights, residualStd: std, threshold };
}

function sigmoid(x: number) { return 1 / (1 + Math.exp(-x)); }

export function forecast(model: Model, recentPoint: DataPoint, hours = 6, futureEvents: number[] = []): {ts:number, predicted:number, probability:number, confidence:number}[] {
  const out = [];
  let baseTs = recentPoint.ts;
  let rollingUsers = recentPoint.activeUsers;
  for (let h = 1; h <= hours; h++) {
    const ts = baseTs + h * 3600_000;
    const dp: DataPoint = { ts, txCount: 0, activeUsers: recentPoint.activeUsers, eventFlag: futureEvents[h - 1] || 0 };
    const feat = buildFeatures(dp, rollingUsers);
    const pred = feat.reduce((s, v, i) => s + v * model.weights[i], 0);
    const prob = sigmoid((pred - model.threshold) / Math.max(1, model.residualStd));
    const confidence = Math.min(0.99, Math.abs(pred - model.threshold) / (3 * model.residualStd) + 0.5);
    out.push({ ts, predicted: pred, probability: prob, confidence });
    // update rollingUsers with a simple inertia model
    rollingUsers = rollingUsers * 0.8 + dp.activeUsers * 0.2;
  }
  return out;
}

export function recommendTiming(forecasts: {ts:number, probability:number}[], maxAcceptableProb = 0.2) {
  const windows = forecasts.filter(f => f.probability <= maxAcceptableProb);
  if (windows.length === 0) return null;
  return windows[0];
}
