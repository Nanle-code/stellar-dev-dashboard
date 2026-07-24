/**
 * Advanced Account Watch System
 * -----------------------------
 * Watches many Stellar accounts at once and produces aggregated insights,
 * risk alerts, anomaly detection and custom watch-rule evaluation.
 *
 * Designed to scale to 100+ accounts: refreshes run with bounded concurrency
 * so Horizon is never hit with hundreds of simultaneous requests, and the
 * watchlist / rules are persisted to localStorage so they survive reloads.
 *
 * The pure helpers (`normalizeBalances`, `aggregateBalances`,
 * `evaluateWatchRules`, `detectAnomalies`) are exported for direct unit
 * testing; the `AccountWatchSystem` class wires them to Horizon and a polling
 * loop for real-time updates.
 */

import type { NetworkName } from './stellar'
import { fetchAccount, isValidPublicKey } from './stellar'
import { AdaptiveThresholdController, type AlertFeedback } from './adaptiveAlertThresholds'
import type {
  AccountSnapshot,
  AggregatedBalance,
  AggregatedInsights,
  Anomaly,
  NormalizedBalance,
  RiskAlert,
  WatchRule,
  WatchedAccount,
} from '../types/accountWatch'

const STORAGE_KEY = 'stellar:account-watch:v1'
/** Max concurrent Horizon requests during a refresh — keeps 100+ accounts safe. */
const DEFAULT_CONCURRENCY = 8
/** Default poll interval for real-time updates (ms). */
const DEFAULT_POLL_INTERVAL = 30_000
/** A balance move larger than this fraction is treated as anomalous. */
const ANOMALY_THRESHOLD_PCT = 50

// ─── Pure helpers ───────────────────────────────────────────────────────────

/** Convert a Horizon balances array into our normalized shape. */
export function normalizeBalances(
  balances: ReadonlyArray<Record<string, unknown>>,
): NormalizedBalance[] {
  return balances.map((b) => {
    const isNative = b.asset_type === 'native'
    return {
      assetCode: isNative ? 'XLM' : String(b.asset_code ?? 'UNKNOWN'),
      assetIssuer: isNative ? undefined : (b.asset_issuer as string | undefined),
      balance: Number.parseFloat(String(b.balance ?? '0')) || 0,
    }
  })
}

/** Stable key identifying an asset across accounts. */
function assetKey(assetCode: string, assetIssuer?: string): string {
  return assetIssuer ? `${assetCode}:${assetIssuer}` : assetCode
}

/** Roll balances up across every (successful) snapshot. */
export function aggregateBalances(snapshots: AccountSnapshot[]): AggregatedInsights {
  const byAsset = new Map<string, AggregatedBalance>()
  let totalXlm = 0
  let healthy = 0
  let errored = 0

  for (const snap of snapshots) {
    if (snap.error) {
      errored++
      continue
    }
    healthy++
    for (const bal of snap.balances) {
      if (bal.assetCode === 'XLM') totalXlm += bal.balance
      const key = assetKey(bal.assetCode, bal.assetIssuer)
      const existing = byAsset.get(key)
      if (existing) {
        existing.total += bal.balance
        existing.accountCount += 1
      } else {
        byAsset.set(key, {
          assetCode: bal.assetCode,
          assetIssuer: bal.assetIssuer,
          total: bal.balance,
          accountCount: 1,
        })
      }
    }
  }

  const balancesByAsset = [...byAsset.values()].sort((a, b) => b.total - a.total)

  return {
    totalAccounts: snapshots.length,
    healthyAccounts: healthy,
    erroredAccounts: errored,
    totalXlm,
    balancesByAsset,
    generatedAt: now(),
  }
}

/** Look up an account's balance for a given asset code (0 when absent). */
function balanceOf(snapshot: AccountSnapshot, assetCode: string): number {
  const match = snapshot.balances.find((b) => b.assetCode === assetCode)
  return match ? match.balance : 0
}

/** Evaluate every enabled rule against the current snapshots. */
export function evaluateWatchRules(
  rules: WatchRule[],
  snapshots: AccountSnapshot[],
  previous?: Map<string, AccountSnapshot>,
  adaptiveControllers?: Map<string, AdaptiveThresholdController>,
): RiskAlert[] {
  const alerts: RiskAlert[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue

    const targets = rule.accountAddress
      ? snapshots.filter((s) => s.address === rule.accountAddress)
      : snapshots

    for (const snap of targets) {
      if (snap.error) continue
      const current = balanceOf(snap, rule.assetCode)

      const controller = adaptiveControllers?.get(rule.id) ?? new AdaptiveThresholdController({
        baselineThreshold: rule.threshold,
        minThreshold: Math.max(1, rule.threshold * 0.25),
        maxThreshold: Math.max(rule.threshold * 3, 1000),
      })

      if (!adaptiveControllers?.has(rule.id)) {
        adaptiveControllers?.set(rule.id, controller)
      }

      const optimization = controller.optimize({
        currentValue: current,
        baselineThreshold: rule.threshold,
        severity: current > rule.threshold ? 'warning' : 'info',
      })
      const effectiveThreshold = optimization.recommendedThreshold

      if (rule.kind === 'balance_below' && current < effectiveThreshold) {
        alerts.push(
          makeAlert(snap.address, 'warning', rule.kind, 'Balance below threshold', `${rule.assetCode} balance ${current} is below ${effectiveThreshold}`),
        )
      } else if (rule.kind === 'balance_above' && current > effectiveThreshold) {
        alerts.push(
          makeAlert(snap.address, 'info', rule.kind, 'Balance above threshold', `${rule.assetCode} balance ${current} is above ${effectiveThreshold}`),
        )
      } else if (rule.kind === 'balance_change_pct' && previous) {
        const prev = previous.get(snap.address)
        if (prev && !prev.error) {
          const before = balanceOf(prev, rule.assetCode)
          const pct = percentChange(before, current)
          if (Math.abs(pct) >= effectiveThreshold) {
            alerts.push(
              makeAlert(snap.address, 'critical', rule.kind, 'Large balance change', `${rule.assetCode} moved ${pct.toFixed(1)}% (${before} → ${current})`),
            )
          }
        }
      }
    }
  }

  return alerts
}

/** Detect anomalous balance swings between the previous and current snapshots. */
export function detectAnomalies(
  current: AccountSnapshot[],
  previous: Map<string, AccountSnapshot>,
  thresholdPct: number = ANOMALY_THRESHOLD_PCT,
): Anomaly[] {
  const anomalies: Anomaly[] = []

  for (const snap of current) {
    if (snap.error) continue
    const prev = previous.get(snap.address)
    if (!prev || prev.error) continue

    for (const bal of snap.balances) {
      const before = balanceOf(prev, bal.assetCode)
      const pct = percentChange(before, bal.balance)
      if (Math.abs(pct) >= thresholdPct) {
        anomalies.push({
          accountAddress: snap.address,
          assetCode: bal.assetCode,
          changePct: pct,
          previous: before,
          current: bal.balance,
          detectedAt: now(),
        })
      }
    }
  }

  return anomalies
}

// ─── Small utilities ──────────────────────────────────────────────────────────

function now(): number {
  return Date.now()
}

function percentChange(before: number, after: number): number {
  if (before === 0) return after === 0 ? 0 : 100
  return ((after - before) / Math.abs(before)) * 100
}

let alertSeq = 0
function makeAlert(
  accountAddress: string,
  level: RiskAlert['level'],
  kind: RiskAlert['kind'],
  title: string,
  message: string,
): RiskAlert {
  alertSeq += 1
  return {
    id: `alert-${now()}-${alertSeq}`,
    accountAddress,
    level,
    kind,
    title,
    message,
    createdAt: now(),
  }
}

/** Run async `worker` over `items` with at most `limit` running at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let index = 0

  async function runner(): Promise<void> {
    while (index < items.length) {
      const current = index++
      results[current] = await worker(items[current])
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, runner)
  await Promise.all(runners)
  return results
}

// ─── System ─────────────────────────────────────────────────────────────────

export interface AccountWatchUpdate {
  snapshots: AccountSnapshot[]
  insights: AggregatedInsights
  alerts: RiskAlert[]
  anomalies: Anomaly[]
}

export interface AccountWatchOptions {
  network?: NetworkName
  concurrency?: number
  pollIntervalMs?: number
  anomalyThresholdPct?: number
}

type Listener = (update: AccountWatchUpdate) => void

export class AccountWatchSystem {
  private accounts: WatchedAccount[] = []
  private rules: WatchRule[] = []
  private network: NetworkName
  private readonly concurrency: number
  private readonly pollIntervalMs: number
  private readonly anomalyThresholdPct: number

  private lastSnapshots = new Map<string, AccountSnapshot>()
  private listeners = new Set<Listener>()
  private timer: ReturnType<typeof setInterval> | null = null
  private refreshing = false
  private adaptiveControllers = new Map<string, AdaptiveThresholdController>()

  constructor(options: AccountWatchOptions = {}) {
    this.network = options.network ?? 'testnet'
    this.concurrency = options.concurrency ?? DEFAULT_CONCURRENCY
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL
    this.anomalyThresholdPct = options.anomalyThresholdPct ?? ANOMALY_THRESHOLD_PCT
    this.load()
  }

  // — Watchlist management —

  getAccounts(): WatchedAccount[] {
    return [...this.accounts]
  }

  /** Add an account to the watchlist. Returns false for an invalid/duplicate key. */
  addAccount(address: string, label?: string): boolean {
    if (!isValidPublicKey(address)) return false
    if (this.accounts.some((a) => a.address === address)) return false
    this.accounts.push({ address, label, addedAt: now() })
    this.persist()
    return true
  }

  removeAccount(address: string): void {
    this.accounts = this.accounts.filter((a) => a.address !== address)
    this.lastSnapshots.delete(address)
    this.persist()
  }

  setNetwork(network: NetworkName): void {
    if (network === this.network) return
    this.network = network
    this.lastSnapshots.clear()
    this.persist()
  }

  // — Rule management —

  getRules(): WatchRule[] {
    return [...this.rules]
  }

  addRule(rule: Omit<WatchRule, 'id'>): WatchRule {
    const created: WatchRule = { ...rule, id: `rule-${now()}-${this.rules.length}` }
    this.rules.push(created)
    this.persist()
    return created
  }

  removeRule(id: string): void {
    this.rules = this.rules.filter((r) => r.id !== id)
    this.persist()
  }

  toggleRule(id: string, enabled: boolean): void {
    const rule = this.rules.find((r) => r.id === id)
    if (rule) {
      rule.enabled = enabled
      this.persist()
    }
  }

  // — Real-time loop —

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Begin polling Horizon at the configured interval. */
  start(): void {
    if (this.timer) return
    void this.refresh()
    this.timer = setInterval(() => {
      void this.refresh()
    }, this.pollIntervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** Fetch every watched account once, aggregate, evaluate rules and emit. */
  async refresh(): Promise<AccountWatchUpdate> {
    if (this.refreshing) {
      return this.buildUpdate([...this.lastSnapshots.values()], [], [])
    }
    this.refreshing = true
    try {
      const snapshots = await mapWithConcurrency(
        this.accounts,
        this.concurrency,
        (acc) => this.fetchSnapshot(acc.address),
      )

      const previous = this.lastSnapshots
      const alerts = evaluateWatchRules(this.rules, snapshots, previous, this.adaptiveControllers)
      const anomalies = detectAnomalies(snapshots, previous, this.anomalyThresholdPct)
      for (const anomaly of anomalies) {
        alerts.push(
          makeAlert(
            anomaly.accountAddress,
            'critical',
            'anomaly',
            'Anomalous balance change',
            `${anomaly.assetCode} changed ${anomaly.changePct.toFixed(1)}% (${anomaly.previous} → ${anomaly.current})`,
          ),
        )
      }

      this.lastSnapshots = new Map(snapshots.map((s) => [s.address, s]))

      const update = this.buildUpdate(snapshots, alerts, anomalies)
      for (const listener of this.listeners) listener(update)
      return update
    } finally {
      this.refreshing = false
    }
  }

  private buildUpdate(
    snapshots: AccountSnapshot[],
    alerts: RiskAlert[],
    anomalies: Anomaly[],
  ): AccountWatchUpdate {
    return { snapshots, insights: aggregateBalances(snapshots), alerts, anomalies }
  }

  recordFeedback(ruleId: string, feedback: AlertFeedback, currentValue?: number, baselineThreshold?: number): void {
    const rule = this.rules.find((candidate) => candidate.id === ruleId)
    const controller = this.adaptiveControllers.get(ruleId) ?? new AdaptiveThresholdController({
      baselineThreshold: baselineThreshold ?? rule?.threshold ?? 0,
      minThreshold: 1,
      maxThreshold: 1000,
    })

    if (!this.adaptiveControllers.has(ruleId)) {
      this.adaptiveControllers.set(ruleId, controller)
    }

    const context = {
      currentValue: currentValue ?? rule?.threshold ?? controller.getCurrentThreshold(),
      baselineThreshold: baselineThreshold ?? rule?.threshold ?? controller.getCurrentThreshold(),
      feedback,
    }

    controller.optimize(context)

    if (feedback === 'true_positive' || feedback === 'false_positive' || feedback === 'false_negative') {
      controller.observeOutcome(
        feedback === 'true_positive' ? 'true_positive' : feedback === 'false_positive' ? 'false_positive' : 'false_negative',
      )
    }
  }

  private async fetchSnapshot(address: string): Promise<AccountSnapshot> {
    try {
      const account = await fetchAccount(address, this.network)
      const balances = normalizeBalances(account.balances as unknown as Record<string, unknown>[])
      return {
        address,
        fetchedAt: now(),
        balances,
        xlmBalance: balances.find((b) => b.assetCode === 'XLM')?.balance ?? 0,
      }
    } catch (error) {
      return {
        address,
        fetchedAt: now(),
        balances: [],
        xlmBalance: 0,
        error: error instanceof Error ? error.message : 'Failed to load account',
      }
    }
  }

  // — Persistence —

  private persist(): void {
    try {
      if (typeof localStorage === 'undefined') return
      const adaptiveThresholds = Object.fromEntries(
        Array.from(this.adaptiveControllers.entries()).map(([ruleId, controller]) => [ruleId, controller.toSnapshot()]),
      )

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accounts: this.accounts,
          rules: this.rules,
          network: this.network,
          adaptiveThresholds,
        }),
      )
    } catch {
      // Persistence is best-effort; ignore quota / serialization failures.
    }
  }

  private load(): void {
    try {
      if (typeof localStorage === 'undefined') return
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{
        accounts: WatchedAccount[]
        rules: WatchRule[]
        network: NetworkName
        adaptiveThresholds: Record<string, unknown>
      }>
      if (Array.isArray(parsed.accounts)) this.accounts = parsed.accounts
      if (Array.isArray(parsed.rules)) this.rules = parsed.rules
      if (parsed.network) this.network = parsed.network
      if (parsed.adaptiveThresholds && typeof parsed.adaptiveThresholds === 'object') {
        this.adaptiveControllers = new Map(
          Object.entries(parsed.adaptiveThresholds).map(([ruleId, snapshot]) => [
            ruleId,
            AdaptiveThresholdController.fromSnapshot(snapshot as any),
          ]),
        )
      }
    } catch {
      // Corrupt state — start fresh rather than crash.
    }
  }
}

/** Shared singleton used by the React hook. */
export const accountWatchSystem = new AccountWatchSystem()
