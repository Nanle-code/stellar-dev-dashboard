/**
 * Comparative Network Health Scorecards (#867)
 * =============================================
 * Builds side-by-side health scorecards for Mainnet and Testnet so operators
 * can compare network indicators at a glance — with explicit caveats, because
 * the two networks have fundamentally different semantics (real value vs.
 * disposable test funds, different validator sets, different load profiles).
 *
 * Design rules:
 *  - Pure functions only: the UI owns fetching; this module owns scoring.
 *  - Never throws on bad per-network input: invalid inputs are surfaced in the
 *    result as `error` / `warnings` entries so one broken network cannot hide
 *    the other network's data in the panel.
 *  - Supported networks are mainnet and testnet only. Anything else (futurenet,
 *    local, custom) is rejected as an unsupported environment rather than
 *    silently scored with misleading defaults.
 *
 * @see src/components/dashboard/CrossNetworkPanel.tsx — UI consumer
 */

export type ScorecardNetwork = 'mainnet' | 'testnet'

/** Health input snapshot for a single network (as produced by fetchNetworkStats). */
export interface NetworkHealthInput {
  network: ScorecardNetwork
  /** Latest closed ledger sequence. */
  latestLedgerSequence?: number | string | null
  /** Unix seconds when the latest ledger closed. */
  latestLedgerClosedAt?: string | number | null
  /** Base fee of the latest ledger, in stroops. */
  baseFeeStroops?: number | string | null
  /** Ops in the latest ledger. */
  operationCount?: number | string | null
  /** Successful tx count in the latest ledger. */
  successfulTransactionCount?: number | string | null
  /** Failed tx count in the latest ledger. */
  failedTransactionCount?: number | string | null
}

export type ScorecardGrade = 'healthy' | 'degraded' | 'critical' | 'unavailable'

export interface NetworkHealthScore {
  /** 0–100 composite score. 0 when the network is unavailable. */
  score: number
  grade: ScorecardGrade
  /** Per-indicator detail; 0-scored indicators include a warning reason. */
  indicators: Array<{
    key: string
    label: string
    value: string
    /** 0–100 sub-score for the indicator. */
    subScore: number
  }>
  /** Non-fatal data problems discovered while scoring (bad fields, stale ledgers...). */
  warnings: string[]
}

export interface NetworkHealthScorecardEntry {
  network: ScorecardNetwork
  ok: boolean
  /** Present when `ok === false` (unsupported network, non-object input, fetch failure...). */
  error?: string
  score?: NetworkHealthScore
}

export interface ComparativeHealthReport {
  mainnet: NetworkHealthScorecardEntry
  testnet: NetworkHealthScorecardEntry
  /** Deterministic delta = mainnet.score − testnet.score (undefined when either side is unavailable). */
  delta?: number
  /** The higher-scored network, or null when tied/unknown. */
  leader: ScorecardNetwork | null
  /** Generated comparison narrative and caveats shown under the scorecard. */
  insights: string[]
  /** Data-quality caveats (see `buildHealthCaveats`). Always non-empty. */
  caveats: string[]
}

/** Ledger close cadence in seconds; Stellar targets ~5s closes. */
const TARGET_CLOSE_SECONDS = 5
/** A ledger older than this (seconds) is flagged stale. */
const STALE_LEDGER_SECONDS = 60
/** Minimum healthy base fee, in stroops (network minimum). */
const MIN_BASE_FEE_STROOPS = 100
/** Base fee above this (stroops) suggests sustained congestion. */
const CONGESTED_BASE_FEE_STROOPS = 1_000
/** Supported networks for the comparative scorecard. */
export const SCORECARD_NETWORKS: readonly ScorecardNetwork[] = ['mainnet', 'testnet'] as const

const NETWORK_LABELS: Record<ScorecardNetwork, string> = {
  mainnet: 'Mainnet',
  testnet: 'Testnet',
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

/** Coerce a numeric-ish field to a finite number, or `null` when unusable. */
function toNum(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

function validateInput(input: NetworkHealthInput): string | null {
  if (input == null || typeof input !== 'object') {
    return 'Health input must be an object with a network field'
  }
  if (!SCORECARD_NETWORKS.includes(input.network)) {
    return `Unsupported network "${String((input as { network?: unknown }).network ?? '')}" — only mainnet and testnet scorecards are supported`
  }
  return null
}

/** Age of the latest ledger in seconds; null when unknown. */
function ledgerAgeSeconds(input: NetworkHealthInput, nowMs: number): number | null {
  const closedAt = input.latestLedgerClosedAt
  if (closedAt == null || closedAt === '') return null
  const closedMs =
    typeof closedAt === 'number'
      ? closedAt
      : Date.parse(closedAt)
  if (!Number.isFinite(closedMs)) return null
  return Math.max(0, (nowMs - closedMs) / 1000)
}

/** Compute one composite health score (0–100) with per-indicator breakdown. */
export function computeHealthScore(
  input: NetworkHealthInput,
  options: { now?: number } = {},
): NetworkHealthScore {
  const invalid = validateInput(input)
  if (invalid) {
    throw new Error(invalid)
  }

  const nowMs = options.now ?? Date.now()
  const warnings: string[] = []
  const indicators: NetworkHealthScore['indicators'] = []

  // ── Ledger freshness ────────────────────────────────────────────────────
  const ageSeconds = ledgerAgeSeconds(input, nowMs)
  let freshnessSubScore: number
  let freshnessValue: string
  if (ageSeconds == null) {
    freshnessSubScore = 50
    freshnessValue = 'unknown'
    warnings.push('Latest ledger close time is missing — freshness indicator scored neutral')
  } else {
    freshnessValue = ageSeconds < 10 ? `${ageSeconds.toFixed(0)}s ago` : `${Math.round(ageSeconds)}s ago`
    if (ageSeconds <= TARGET_CLOSE_SECONDS * 3) {
      freshnessSubScore = 100
    } else if (ageSeconds <= STALE_LEDGER_SECONDS) {
      freshnessSubScore = clampScore(100 - ((ageSeconds - 15) / (STALE_LEDGER_SECONDS - 15)) * 60)
    } else {
      freshnessSubScore = 0
      warnings.push(`Latest ledger is stale (${Math.round(ageSeconds)}s old) — health data may be outdated`)
    }
  }
  indicators.push({ key: 'freshness', label: 'Ledger Freshness', value: freshnessValue, subScore: clampScore(freshnessSubScore) })

  // ── Transaction success rate ────────────────────────────────────────────
  const successTx = toNum(input.successfulTransactionCount)
  const failedTx = toNum(input.failedTransactionCount)
  let successSubScore: number
  let successValue: string
  if (successTx == null && failedTx == null) {
    successSubScore = 50
    successValue = 'unknown'
    warnings.push('Transaction counts are missing — success-rate indicator scored neutral')
  } else {
    const okCount = successTx ?? 0
    const failedCount = failedTx ?? 0
    const total = okCount + failedCount
    const rate = total > 0 ? (okCount / total) * 100 : 100
    successValue = `${rate.toFixed(1)}%`
    successSubScore = clampScore(rate)
    if (rate < 95) {
      warnings.push(`Transaction success rate is low (${rate.toFixed(1)}%) — possible fee or sequence pressure`)
    }
  }
  indicators.push({ key: 'successRate', label: 'Tx Success Rate', value: successValue, subScore: successSubScore })

  // ── Fee pressure ────────────────────────────────────────────────────────
  const baseFee = toNum(input.baseFeeStroops)
  let feeSubScore: number
  let feeValue: string
  if (baseFee == null) {
    feeSubScore = 50
    feeValue = 'unknown'
    warnings.push('Base fee is missing — fee-pressure indicator scored neutral')
  } else if (baseFee < MIN_BASE_FEE_STROOPS) {
    feeSubScore = 50
    feeValue = `${baseFee} stroops`
    warnings.push(`Base fee ${baseFee} stroops is below the protocol minimum (${MIN_BASE_FEE_STROOPS}) — data looks invalid`)
  } else if (baseFee <= CONGESTED_BASE_FEE_STROOPS) {
    feeSubScore = 100
    feeValue = `${baseFee} stroops`
  } else {
    // 100 → 100 pts, 10 000+ → 0 pts, linear in between.
    feeSubScore = clampScore(100 - ((baseFee - CONGESTED_BASE_FEE_STROOPS) / (10_000 - CONGESTED_BASE_FEE_STROOPS)) * 100)
    feeValue = `${baseFee} stroops`
    warnings.push(`Elevated base fee (${baseFee} stroops) suggests network congestion`)
  }
  indicators.push({ key: 'feePressure', label: 'Fee Pressure', value: feeValue, subScore: feeSubScore })

  // ── Throughput (ops per ledger relative to the 1 000 op capacity) ───────
  const ops = toNum(input.operationCount)
  let throughputSubScore: number
  let throughputValue: string
  if (ops == null || ops < 0) {
    throughputSubScore = 50
    throughputValue = 'unknown'
    warnings.push('Operation count is missing or invalid — throughput indicator scored neutral')
  } else {
    const utilization = Math.min(ops / 1000, 1)
    // Moderate utilization is healthy: peak at ~40% load, degrade to 60 at saturation.
    throughputSubScore = clampScore(100 - utilization * 40)
    throughputValue = `${Math.round(ops)} ops`
  }
  indicators.push({ key: 'throughput', label: 'Ledger Throughput', value: throughputValue, subScore: throughputSubScore })

  // Composite: freshness and success dominate; fee and throughput are secondary.
  const weights: Record<string, number> = {
    freshness: 0.3,
    successRate: 0.3,
    feePressure: 0.25,
    throughput: 0.15,
  }
  const composite = indicators.reduce((acc, ind) => acc + ind.subScore * (weights[ind.key] ?? 0), 0)
  const score = clampScore(composite)
  const grade: ScorecardGrade = score >= 80 ? 'healthy' : score >= 55 ? 'degraded' : 'critical'

  return { score, grade, indicators, warnings }
}

/**
 * Build the standing caveats shown under every comparative scorecard.
 * Always includes the cross-network semantics warning plus any data-quality
 * issues discovered during scoring.
 */
export function buildHealthCaveats(report: ComparativeHealthReport): string[] {
  const caveats = [
    'Mainnet and Testnet have different validator sets, load profiles, and stakes — scores are not directly comparable SLAs.',
    'Testnet XLM has no monetary value and can be reset; testnet health does not predict mainnet health.',
  ]

  for (const entry of [report.mainnet, report.testnet]) {
    if (!entry.ok) {
      caveats.push(`${NETWORK_LABELS[entry.network]} scorecard unavailable: ${entry.error}`)
    } else if (entry.score) {
      for (const warning of entry.score.warnings) {
        caveats.push(`${NETWORK_LABELS[entry.network]}: ${warning}`)
      }
    }
  }

  return caveats
}

function entryFromResult(network: ScorecardNetwork, result: PromiseSettledResult<NetworkHealthScore>): NetworkHealthScorecardEntry {
  if (result.status === 'fulfilled') {
    return { network, ok: true, score: result.value }
  }
  return { network, ok: false, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }
}

/**
 * Build a side-by-side comparative report for mainnet and testnet.
 *
 * Accepts a fetcher so callers control how snapshots are obtained (and tests
 * can inject fixtures). One network failing to load must never erase the
 * other network's scorecard — failures are captured per network instead.
 *
 * @param fetchHealth Snapshot provider: returns health input for one network.
 * @param networks Networks to compare; defaults to mainnet + testnet.
 * @returns Comparative report with scores, delta, leader, insights and caveats.
 */
export async function buildComparativeHealthReport(
  fetchHealth: (_network: ScorecardNetwork) => Promise<NetworkHealthInput>,
  networks: readonly ScorecardNetwork[] = SCORECARD_NETWORKS,
  options: { now?: number } = {},
): Promise<ComparativeHealthReport> {
  const requested = networks.length > 0 ? networks : SCORECARD_NETWORKS
  for (const network of requested) {
    if (!SCORECARD_NETWORKS.includes(network)) {
      throw new Error(`Unsupported network "${String(network)}" — only mainnet and testnet scorecards are supported`)
    }
  }

  const settled = await Promise.allSettled(requested.map((network) => fetchHealth(network)))

  const entries: NetworkHealthScorecardEntry[] = requested.map((network, index) => {
    const result = settled[index]
    if (result.status === 'rejected') {
      // The provider itself failed (network down, bad URL...).
      return { network, ok: false, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }
    }
    try {
      const score = computeHealthScore(result.value, options)
      return entryFromResult(network, { status: 'fulfilled', value: score })
    } catch (err) {
      // Invalid input shape or unsupported network in the snapshot.
      return {
        network,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  const mainnet = entries.find((e) => e.network === 'mainnet') ?? { network: 'mainnet' as const, ok: false, error: 'Mainnet not requested' }
  const testnet = entries.find((e) => e.network === 'testnet') ?? { network: 'testnet' as const, ok: false, error: 'Testnet not requested' }

  const bothOk = mainnet.ok && testnet.ok && mainnet.score && testnet.score
  const delta = bothOk ? mainnet.score!.score - testnet.score!.score : undefined
  const leader = bothOk && delta !== 0
    ? delta! > 0
      ? 'mainnet'
      : 'testnet'
    : null

  const insights: string[] = []
  if (bothOk) {
    insights.push(
      `Mainnet scores ${mainnet.score!.score}/100 (${mainnet.score!.grade}) vs Testnet ${testnet.score!.score}/100 (${testnet.score!.grade}).`,
    )
    if (leader) {
      insights.push(`${NETWORK_LABELS[leader]} is currently healthier by ${Math.abs(delta!)} points.`)
    } else {
      insights.push('Both networks are tied on composite health right now.')
    }
  } else {
    const failed = [mainnet, testnet].filter((e) => !e.ok)
    insights.push(
      `Comparative scorecard is partial — ${failed.map((e) => NETWORK_LABELS[e.network]).join(' and ')} could not be scored.`,
    )
  }

  const report: ComparativeHealthReport = { mainnet, testnet, delta, leader, insights, caveats: [] }
  report.caveats = buildHealthCaveats(report)
  return report
}
