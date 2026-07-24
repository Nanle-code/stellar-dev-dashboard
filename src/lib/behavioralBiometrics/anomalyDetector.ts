/**
 * Behavioral Anomaly Detector
 *
 * Browser-compatible Isolation Forest implementation (pure ES module, no fs/require).
 * Ported from src/ml/isolation_forest.js with TypeScript and behavioral feature extraction.
 */

import type { BehavioralSample } from './collector'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IsolationForestConfig {
  nTrees?: number
  sampleSize?: number
}

export interface AnomalyResult {
  score: number          // 0 = normal, 1 = anomalous
  isAnomaly: boolean
  confidence: number     // 0-100: certainty of the assessment
  explanation: string
}

interface IsoTree {
  leaf: boolean
  size: number
  dim?: number
  split?: number
  left?: IsoTree
  right?: IsoTree
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const ANOMALY_THRESHOLD = 0.62
const DEFAULT_N_TREES = 50
const DEFAULT_SAMPLE_SIZE = 256

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeNum(v: number): number {
  return isFinite(v) && !isNaN(v) ? v : 0
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return safeNum(arr.reduce((s, v) => s + v, 0) / arr.length)
}

function std(arr: number[], m?: number): number {
  if (arr.length < 2) return 0
  const mu = m ?? mean(arr)
  const variance = arr.reduce((s, v) => s + (v - mu) ** 2, 0) / arr.length
  return safeNum(Math.sqrt(variance))
}

/** Expected path length correction factor for n samples (same as original c(n)) */
function correctionFactor(n: number): number {
  if (n <= 1) return 0
  const H = Math.log(n - 1) + 0.5772156649 + 1 / (2 * (n - 1))
  return 2 * H - 2 * (n - 1) / n
}

function rangeMinMax(data: number[][], dim: number): [number, number] {
  let mn = Infinity
  let mx = -Infinity
  for (const d of data) {
    if (d[dim] < mn) mn = d[dim]
    if (d[dim] > mx) mx = d[dim]
  }
  return [mn, mx]
}

function buildTree(data: number[][], heightLimit: number): IsoTree {
  if (data.length <= 1 || heightLimit <= 0) {
    return { leaf: true, size: data.length }
  }
  const dim = Math.floor(Math.random() * data[0].length)
  const [mn, mx] = rangeMinMax(data, dim)
  if (mn === mx) return { leaf: true, size: data.length }

  const split = Math.random() * (mx - mn) + mn
  const left: number[][] = []
  const right: number[][] = []
  for (const d of data) {
    if (d[dim] < split) left.push(d)
    else right.push(d)
  }

  return {
    leaf: false,
    size: data.length,
    dim,
    split,
    left: buildTree(left, heightLimit - 1),
    right: buildTree(right, heightLimit - 1),
  }
}

function pathLength(x: number[], tree: IsoTree, depth = 0): number {
  if (tree.leaf) return depth + correctionFactor(tree.size)
  if (x[tree.dim!] < tree.split!) return pathLength(x, tree.left!, depth + 1)
  return pathLength(x, tree.right!, depth + 1)
}

// ─── Isolation Forest ────────────────────────────────────────────────────────

export class BehavioralAnomalyDetector {
  private nTrees: number
  private sampleSize: number
  private trees: IsoTree[] = []

  constructor(config: IsolationForestConfig = {}) {
    this.nTrees = config.nTrees ?? DEFAULT_N_TREES
    this.sampleSize = config.sampleSize ?? DEFAULT_SAMPLE_SIZE
  }

  isTrained(): boolean {
    return this.trees.length > 0
  }

  fit(data: number[][]): void {
    if (data.length === 0) return
    this.trees = []
    const effectiveSample = Math.min(this.sampleSize, data.length)
    const heightLimit = Math.ceil(Math.log2(effectiveSample))

    for (let i = 0; i < this.nTrees; i++) {
      // Sample without replacement
      const sample: number[][] = []
      const used = new Set<number>()
      while (sample.length < effectiveSample) {
        const r = Math.floor(Math.random() * data.length)
        if (!used.has(r)) {
          used.add(r)
          sample.push(data[r])
        }
      }
      this.trees.push(buildTree(sample, heightLimit))
    }
  }

  private _rawScore(x: number[]): number {
    if (!this.isTrained()) return 0
    let sum = 0
    for (const t of this.trees) sum += pathLength(x, t, 0)
    const avg = sum / this.trees.length
    return Math.pow(2, -avg / correctionFactor(this.sampleSize))
  }

  score(x: number[]): AnomalyResult {
    if (!this.isTrained()) {
      return {
        score: 0,
        isAnomaly: false,
        confidence: 0,
        explanation: 'Model not yet trained — in learning mode',
      }
    }

    const raw = safeNum(this._rawScore(x))
    const isAnomaly = raw > ANOMALY_THRESHOLD

    // Confidence: how far from the threshold (scaled 0-100)
    const distance = Math.abs(raw - ANOMALY_THRESHOLD)
    const confidence = Math.min(100, Math.round(distance / ANOMALY_THRESHOLD * 100))

    let explanation: string
    if (raw < 0.4) {
      explanation = 'Behavior closely matches established profile'
    } else if (raw < ANOMALY_THRESHOLD) {
      explanation = 'Behavior slightly unusual but within acceptable range'
    } else if (raw < 0.75) {
      explanation = 'Behavior deviates noticeably from established profile'
    } else {
      explanation = 'Significant behavioral deviation detected — possible unauthorized access'
    }

    return { score: raw, isAnomaly, confidence, explanation }
  }

  toJSON(): object {
    return { nTrees: this.nTrees, sampleSize: this.sampleSize, trees: this.trees }
  }

  fromJSON(data: { nTrees: number; sampleSize: number; trees: IsoTree[] }): void {
    this.nTrees = data.nTrees
    this.sampleSize = data.sampleSize
    this.trees = data.trees
  }
}

// ─── Feature Extraction ───────────────────────────────────────────────────────

/**
 * Extracts a 13-element numeric feature vector from a BehavioralSample.
 * All values are normalized/log-scaled for stable ML input.
 */
export function extractBehavioralFeatures(sample: BehavioralSample): number[] {
  const kd = sample.keystrokeDurations
  const ki = sample.keystrokeIntervals
  const mv = sample.mouseVelocities
  const ma = sample.mouseAccelerations

  const meanKd = mean(kd)
  const stdKd = std(kd, meanKd)
  const meanKi = mean(ki)
  const stdKi = std(ki, meanKi)
  const meanMv = mean(mv)
  const stdMv = std(mv, meanMv)
  const meanMa = mean(ma)
  const stdMa = std(ma, meanMa)

  const dur = sample.sessionDuration
  const focusRate = dur > 0 ? sample.focusChanges / (dur / 1000) : 0
  const pasteFlag = sample.pasteEvents > 0 ? 1 : 0
  const bsRatio = sample.totalKeystrokes > 0
    ? sample.backspaceCount / sample.totalKeystrokes
    : 0
  const ttfk = Math.log1p(sample.timeToFirstKeystroke)

  return [
    safeNum(Math.log1p(meanKd)),          // 0: mean keystroke dwell (log-scaled)
    safeNum(Math.log1p(stdKd)),           // 1: std keystroke dwell
    safeNum(Math.log1p(meanKi)),          // 2: mean inter-key interval
    safeNum(Math.log1p(stdKi)),           // 3: std inter-key interval
    safeNum(Math.log1p(meanMv * 1000)),   // 4: mean mouse velocity (scaled)
    safeNum(Math.log1p(stdMv * 1000)),    // 5: std mouse velocity
    safeNum(Math.log1p(meanMa * 1000)),   // 6: mean mouse accel
    safeNum(Math.log1p(stdMa * 1000)),    // 7: std mouse accel
    safeNum(Math.log1p(dur)),             // 8: session duration
    safeNum(Math.min(focusRate, 10)),     // 9: focus change rate
    safeNum(pasteFlag),                   // 10: paste event flag
    safeNum(Math.min(bsRatio, 1)),        // 11: backspace ratio
    safeNum(ttfk),                        // 12: time to first keystroke
  ]
}
