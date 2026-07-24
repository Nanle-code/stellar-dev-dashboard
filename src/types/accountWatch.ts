/**
 * Type definitions for the Advanced Account Watch System.
 *
 * Lets users watch many accounts at once and receive aggregated insights,
 * risk alerts, anomaly detection and custom watch-rule evaluation.
 */

import type { NetworkName } from '../lib/stellar'

/** An account the user has chosen to watch. */
export interface WatchedAccount {
  address: string
  label?: string
  addedAt: number
}

/** A single normalized asset balance for one account. */
export interface NormalizedBalance {
  /** `XLM` for the native asset, otherwise the asset code. */
  assetCode: string
  assetIssuer?: string
  balance: number
}

/** Point-in-time view of one account fetched from Horizon. */
export interface AccountSnapshot {
  address: string
  fetchedAt: number
  balances: NormalizedBalance[]
  /** Native XLM balance, surfaced for convenience. */
  xlmBalance: number
  /** Set when the account could not be loaded (e.g. not found / network error). */
  error?: string
}

/** A balance total rolled up across every watched account. */
export interface AggregatedBalance {
  assetCode: string
  assetIssuer?: string
  total: number
  /** Number of watched accounts holding this asset. */
  accountCount: number
}

/** Aggregated portfolio insights across all watched accounts. */
export interface AggregatedInsights {
  totalAccounts: number
  healthyAccounts: number
  erroredAccounts: number
  totalXlm: number
  balancesByAsset: AggregatedBalance[]
  generatedAt: number
}

/** Kinds of custom watch rule the user can configure. */
export type WatchRuleKind = 'balance_below' | 'balance_above' | 'balance_change_pct'

/** A user-defined rule evaluated against snapshots on every refresh. */
export interface WatchRule {
  id: string
  kind: WatchRuleKind
  /** Asset the rule applies to (`XLM` for native). */
  assetCode: string
  /** Threshold value — an amount for balance_* rules, a percentage for change rules. */
  threshold: number
  /** Limit to a single account; when omitted the rule applies to every watched account. */
  accountAddress?: string
  enabled: boolean
}

export type RiskLevel = 'info' | 'warning' | 'critical'

/** A risk alert emitted when a watch rule or anomaly fires. */
export interface RiskAlert {
  id: string
  accountAddress: string
  level: RiskLevel
  kind: WatchRuleKind | 'anomaly'
  title: string
  message: string
  createdAt: number
}

/** A detected anomalous balance change between two consecutive snapshots. */
export interface Anomaly {
  accountAddress: string
  assetCode: string
  /** Signed percentage change relative to the previous snapshot. */
  changePct: number
  previous: number
  current: number
  detectedAt: number
}

export interface AccountWatchState {
  accounts: WatchedAccount[]
  rules: WatchRule[]
  network: NetworkName
}
