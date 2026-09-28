/**
 * CostThresholdManager — Application tag & memo prefix cost attribution engine (#868).
 *
 * Attributes transaction fees and asset transfer volumes to developer-defined project tags
 * for project budgeting, cost tracking, and alert threshold monitoring.
 */

export interface CostTagRule {
  /** Unique identifier for the rule */
  id: string
  /** Human-readable application/project tag (e.g., 'billing', 'auth', 'nft-mint', 'defi-swap') */
  tag: string
  /** Optional literal memo prefix string to match (e.g., '[APP:billing]', 'BILL:', 'PAY:') */
  memoPrefix?: string
  /** Optional regex pattern string for flexible memo matching (e.g., '^PROJ-[0-9]+') */
  memoPattern?: string
  /** Maximum fee budget limit in Stroops for this tag (1 XLM = 10,000,000 Stroops) */
  budgetLimitStroops?: number
  /** Maximum volume transfer limit in Stroops for this tag */
  maxVolumeStroops?: number
  /** Percentage at which a warning alert is triggered (default: 80) */
  warningThresholdPercent?: number
  /** Whether this rule is currently active */
  enabled: boolean
}

export interface MatchedTransactionSummary {
  id: string
  feeChargedStroops: number
  volumeStroops: number
  memo?: string
  createdAt: string
  operationCount: number
}

export interface CostAttributionRecord {
  /** The application tag name */
  tag: string
  /** Rule ID that matched this tag, or 'auto-discovered' if extracted from memo */
  ruleId: string
  /** Number of transactions attributed to this tag */
  transactionCount: number
  /** Number of operations attributed to this tag */
  operationCount: number
  /** Total fees incurred in Stroops */
  totalFeeStroops: number
  /** Total fees incurred in XLM */
  totalFeeXlm: number
  /** Average fee per transaction in Stroops */
  averageFeeStroops: number
  /** Total payment / asset volume transferred in Stroops */
  totalVolumeStroops: number
  /** Total payment / asset volume transferred in XLM */
  totalVolumeXlm: number
  /** Configured fee budget limit in Stroops (if any) */
  budgetLimitStroops?: number
  /** Configured fee budget limit in XLM (if any) */
  budgetLimitXlm?: number
  /** Percentage of budget consumed */
  budgetUsedPercent: number
  /** Budget health status */
  status: 'ok' | 'warning' | 'exceeded' | 'unbudgeted'
  /** List of transactions matching this tag */
  matchedTransactions: MatchedTransactionSummary[]
}

export interface CostThresholdAlert {
  id: string
  tag: string
  severity: 'warning' | 'exceeded'
  message: string
  budgetPercent: number
  currentFeeStroops: number
  budgetLimitStroops: number
}

export interface CostAttributionSummary {
  /** Total fee in Stroops across all attributed transactions */
  totalAttributedFeeStroops: number
  /** Total fee in XLM across all attributed transactions */
  totalAttributedFeeXlm: number
  /** Total fee in Stroops for transactions that didn't match any tag */
  totalUnattributedFeeStroops: number
  /** Total fee in XLM for transactions that didn't match any tag */
  totalUnattributedFeeXlm: number
  /** Total transaction count evaluated */
  totalTransactions: number
  /** Total operation count evaluated */
  totalOperations: number
  /** Per-tag attribution breakdown */
  tagBreakdown: CostAttributionRecord[]
  /** Active budget threshold alerts */
  thresholdAlerts: CostThresholdAlert[]
  /** ISO timestamp of analysis */
  generatedAt: string
  /** Non-fatal warning messages for malformed input records */
  warnings?: string[]
}

export interface TransactionInput {
  id?: string
  hash?: string
  fee_charged?: string | number
  feeCharged?: string | number
  fee?: string | number
  memo?: string | null
  memo_type?: string
  created_at?: string
  createdAt?: string
  operation_count?: number
  operationCount?: number
  successful?: boolean
  operations?: Array<{
    amount?: string | number
    starting_balance?: string | number
    startingBalance?: string | number
    [key: string]: unknown
  }>
  [key: string]: unknown
}

const STORAGE_KEY = 'stellar_cost_threshold_rules_v1'
const STROOPS_PER_XLM = 10_000_000

/**
 * Normalizes input numeric values safely to finite non-negative numbers.
 */
function parseStroops(value: unknown): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) return 0
  return Math.round(parsed)
}

/**
 * Extracts volume in Stroops from transaction operations or attributes.
 */
function extractTransactionVolume(tx: TransactionInput): number {
  let volume = 0
  if (Array.isArray(tx.operations)) {
    for (const op of tx.operations) {
      if (!op || typeof op !== 'object') continue
      if ('amount' in op) {
        volume += parseStroops(op.amount)
      } else if ('starting_balance' in op) {
        volume += parseStroops(op.starting_balance)
      } else if ('startingBalance' in op) {
        volume += parseStroops(op.startingBalance)
      }
    }
  }
  return volume
}

/**
 * Auto-detects application tag from memo text if structured like [APP:tag] or APP:tag:
 */
function extractAutoTag(memo: string | null | undefined): string | null {
  if (!memo || typeof memo !== 'string') return null
  const trimmed = memo.trim()

  // Match [APP:tag] or [TAG:tag] or [PROJ:tag]
  const bracketMatch = trimmed.match(/^\[(?:APP|TAG|PROJ):([a-zA-Z0-9_-]+)\]/i)
  if (bracketMatch) return bracketMatch[1].toLowerCase()

  // Match APP:tag or TAG:tag prefix
  const prefixMatch = trimmed.match(/^(?:APP|TAG|PROJ):([a-zA-Z0-9_-]+)(?::|\s|$)/i)
  if (prefixMatch) return prefixMatch[1].toLowerCase()

  return null
}

export class CostThresholdManager {
  private rules: Map<string, CostTagRule> = new Map()
  private storageKey: string

  constructor(initialRules?: CostTagRule[], storageKey = STORAGE_KEY) {
    this.storageKey = storageKey
    this.loadRules(initialRules)
  }

  /**
   * Safe storage reader handling unsupported environments (SSR, privacy mode, restricted iframe).
   */
  private loadRules(fallbackRules?: CostTagRule[]): void {
    let loaded = false
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(this.storageKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            parsed.forEach((rule) => {
              if (rule && typeof rule === 'object' && rule.id && rule.tag) {
                this.rules.set(rule.id, this.normalizeRule(rule))
              }
            })
            loaded = true
          }
        }
      }
    } catch {
      // Storage unavailable or blocked
    }

    if (!loaded && fallbackRules && Array.isArray(fallbackRules)) {
      fallbackRules.forEach((rule) => {
        if (rule && typeof rule === 'object' && rule.tag) {
          const normalized = this.normalizeRule(rule)
          this.rules.set(normalized.id, normalized)
        }
      })
    }
  }

  /**
   * Safe storage writer handling storage failure or quota errors.
   */
  private persistRules(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const rulesArray = Array.from(this.rules.values())
        window.localStorage.setItem(this.storageKey, JSON.stringify(rulesArray))
      }
    } catch {
      // Gracefully ignore storage write failures in restricted environments
    }
  }

  private normalizeRule(input: Partial<CostTagRule> & { tag: string }): CostTagRule {
    const id = input.id && typeof input.id === 'string' ? input.id : `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const tag = String(input.tag).trim().toLowerCase() || 'default'
    const warningThresholdPercent = typeof input.warningThresholdPercent === 'number' && !isNaN(input.warningThresholdPercent)
      ? Math.max(1, Math.min(100, input.warningThresholdPercent))
      : 80

    return {
      id,
      tag,
      memoPrefix: input.memoPrefix ? String(input.memoPrefix) : undefined,
      memoPattern: input.memoPattern ? String(input.memoPattern) : undefined,
      budgetLimitStroops: typeof input.budgetLimitStroops === 'number' && input.budgetLimitStroops >= 0 ? input.budgetLimitStroops : undefined,
      maxVolumeStroops: typeof input.maxVolumeStroops === 'number' && input.maxVolumeStroops >= 0 ? input.maxVolumeStroops : undefined,
      warningThresholdPercent,
      enabled: input.enabled !== false,
    }
  }

  /**
   * Adds a new cost threshold rule.
   */
  public addRule(rule: Partial<CostTagRule> & { tag: string }): CostTagRule {
    if (!rule || typeof rule !== 'object' || !rule.tag) {
      throw new Error('Invalid rule input: tag is required')
    }
    const normalized = this.normalizeRule(rule)
    this.rules.set(normalized.id, normalized)
    this.persistRules()
    return normalized
  }

  /**
   * Updates an existing rule.
   */
  public updateRule(id: string, updates: Partial<CostTagRule>): CostTagRule | null {
    if (!id || !this.rules.has(id)) return null
    const existing = this.rules.get(id)!
    const updated = this.normalizeRule({ ...existing, ...updates, id })
    this.rules.set(id, updated)
    this.persistRules()
    return updated
  }

  /**
   * Removes a rule by ID.
   */
  public removeRule(id: string): boolean {
    const deleted = this.rules.delete(id)
    if (deleted) this.persistRules()
    return deleted
  }

  /**
   * Returns all active rules.
   */
  public getRules(): CostTagRule[] {
    return Array.from(this.rules.values())
  }

  /**
   * Replaces all rules.
   */
  public setRules(rules: CostTagRule[]): void {
    this.rules.clear()
    if (Array.isArray(rules)) {
      rules.forEach((r) => {
        if (r && r.tag) {
          const norm = this.normalizeRule(r)
          this.rules.set(norm.id, norm)
        }
      })
    }
    this.persistRules()
  }

  /**
   * Clears all rules.
   */
  public clearRules(): void {
    this.rules.clear()
    this.persistRules()
  }

  /**
   * Evaluates if a memo matches a rule (prefix or pattern).
   */
  private matchRule(memo: string, rule: CostTagRule): boolean {
    if (!rule.enabled) return false
    const trimmedMemo = memo.trim()

    if (rule.memoPrefix && trimmedMemo.startsWith(rule.memoPrefix)) {
      return true
    }

    if (rule.memoPattern) {
      try {
        const regex = new RegExp(rule.memoPattern, 'i')
        if (regex.test(trimmedMemo)) return true
      } catch {
        // Safe regex failure path handling malformed regex
      }
    }

    // Exact tag match if tag is embedded in memo
    if (trimmedMemo.toLowerCase().includes(rule.tag.toLowerCase())) {
      return true
    }

    return false
  }

  /**
   * Attributes transactions and payment volumes to application tags / memo prefixes.
   */
  public attributeTransactions(
    transactions: TransactionInput[] | null | undefined
  ): CostAttributionSummary {
    const warnings: string[] = []

    if (!transactions || !Array.isArray(transactions)) {
      return {
        totalAttributedFeeStroops: 0,
        totalAttributedFeeXlm: 0,
        totalUnattributedFeeStroops: 0,
        totalUnattributedFeeXlm: 0,
        totalTransactions: 0,
        totalOperations: 0,
        tagBreakdown: [],
        thresholdAlerts: [],
        generatedAt: new Date().toISOString(),
        warnings: ['Input transactions was empty or not an array.'],
      }
    }

    const activeRules = Array.from(this.rules.values()).filter((r) => r.enabled)
    const breakdownMap = new Map<string, CostAttributionRecord>()
    const alerts: CostThresholdAlert[] = []

    let totalAttributedFee = 0
    let totalUnattributedFee = 0
    let totalOperationsEvaluated = 0

    transactions.forEach((tx, idx) => {
      if (!tx || typeof tx !== 'object') {
        warnings.push(`Skipped invalid transaction object at index ${idx}`)
        return
      }

      const txId = tx.id || tx.hash || `tx_${idx}`
      const feeStroops = parseStroops(tx.fee_charged ?? tx.feeCharged ?? tx.fee)
      const opCount = typeof tx.operation_count === 'number'
        ? tx.operation_count
        : typeof tx.operationCount === 'number'
        ? tx.operationCount
        : Array.isArray(tx.operations) ? tx.operations.length : 1

      totalOperationsEvaluated += opCount
      const volumeStroops = extractTransactionVolume(tx)
      const memo = typeof tx.memo === 'string' ? tx.memo : undefined
      const createdAt = tx.created_at || tx.createdAt || new Date().toISOString()

      let matchedRule: CostTagRule | null = null

      // First check defined rules
      if (memo) {
        for (const rule of activeRules) {
          if (this.matchRule(memo, rule)) {
            matchedRule = rule
            break
          }
        }
      }

      // If no explicit rule matched, attempt auto-tag extraction from memo
      let tagKey: string | null = matchedRule ? matchedRule.tag : null
      let ruleId: string = matchedRule ? matchedRule.id : 'auto-discovered'

      if (!tagKey && memo) {
        const autoTag = extractAutoTag(memo)
        if (autoTag) {
          tagKey = autoTag
          ruleId = 'auto-discovered'
        }
      }

      const txSummary: MatchedTransactionSummary = {
        id: txId,
        feeChargedStroops: feeStroops,
        volumeStroops,
        memo,
        createdAt,
        operationCount: opCount,
      }

      if (tagKey) {
        totalAttributedFee += feeStroops
        let record = breakdownMap.get(tagKey)

        if (!record) {
          record = {
            tag: tagKey,
            ruleId,
            transactionCount: 0,
            operationCount: 0,
            totalFeeStroops: 0,
            totalFeeXlm: 0,
            averageFeeStroops: 0,
            totalVolumeStroops: 0,
            totalVolumeXlm: 0,
            budgetLimitStroops: matchedRule?.budgetLimitStroops,
            budgetLimitXlm: matchedRule?.budgetLimitStroops ? matchedRule.budgetLimitStroops / STROOPS_PER_XLM : undefined,
            budgetUsedPercent: 0,
            status: matchedRule?.budgetLimitStroops ? 'ok' : 'unbudgeted',
            matchedTransactions: [],
          }
          breakdownMap.set(tagKey, record)
        }

        record.transactionCount += 1
        record.operationCount += opCount
        record.totalFeeStroops += feeStroops
        record.totalFeeXlm = record.totalFeeStroops / STROOPS_PER_XLM
        record.averageFeeStroops = Math.round(record.totalFeeStroops / record.transactionCount)
        record.totalVolumeStroops += volumeStroops
        record.totalVolumeXlm = record.totalVolumeStroops / STROOPS_PER_XLM
        record.matchedTransactions.push(txSummary)

        // Calculate budget percentage and threshold status
        if (record.budgetLimitStroops && record.budgetLimitStroops > 0) {
          const percent = (record.totalFeeStroops / record.budgetLimitStroops) * 100
          record.budgetUsedPercent = Math.round(percent * 10) / 10

          const warningThreshold = matchedRule?.warningThresholdPercent ?? 80

          if (percent >= 100) {
            record.status = 'exceeded'
            alerts.push({
              id: `alert_exceeded_${tagKey}`,
              tag: tagKey,
              severity: 'exceeded',
              message: `Tag '${tagKey}' has exceeded its budget limit of ${(record.budgetLimitStroops / STROOPS_PER_XLM).toFixed(2)} XLM (${record.budgetUsedPercent}% used).`,
              budgetPercent: record.budgetUsedPercent,
              currentFeeStroops: record.totalFeeStroops,
              budgetLimitStroops: record.budgetLimitStroops,
            })
          } else if (percent >= warningThreshold) {
            record.status = 'warning'
            alerts.push({
              id: `alert_warning_${tagKey}`,
              tag: tagKey,
              severity: 'warning',
              message: `Tag '${tagKey}' has reached ${record.budgetUsedPercent}% of its budget limit.`,
              budgetPercent: record.budgetUsedPercent,
              currentFeeStroops: record.totalFeeStroops,
              budgetLimitStroops: record.budgetLimitStroops,
            })
          } else {
            record.status = 'ok'
          }
        }
      } else {
        totalUnattributedFee += feeStroops
      }
    })

    const tagBreakdown = Array.from(breakdownMap.values()).sort(
      (a, b) => b.totalFeeStroops - a.totalFeeStroops
    )

    return {
      totalAttributedFeeStroops: totalAttributedFee,
      totalAttributedFeeXlm: totalAttributedFee / STROOPS_PER_XLM,
      totalUnattributedFeeStroops: totalUnattributedFee,
      totalUnattributedFeeXlm: totalUnattributedFee / STROOPS_PER_XLM,
      totalTransactions: transactions.length,
      totalOperations: totalOperationsEvaluated,
      tagBreakdown,
      thresholdAlerts: alerts,
      generatedAt: new Date().toISOString(),
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  /**
   * Formats a cost attribution summary as JSON or CSV export text.
   */
  public exportAttributionReport(
    summary: CostAttributionSummary,
    format: 'csv' | 'json' = 'json'
  ): string {
    if (!summary || typeof summary !== 'object') {
      return format === 'json' ? '{}' : ''
    }

    if (format === 'json') {
      return JSON.stringify(summary, null, 2)
    }

    const headers = [
      'Tag',
      'Rule ID',
      'Transactions',
      'Operations',
      'Total Fee (Stroops)',
      'Total Fee (XLM)',
      'Avg Fee (Stroops)',
      'Volume (XLM)',
      'Budget Limit (XLM)',
      'Budget Used (%)',
      'Status',
    ]

    const rows = (summary.tagBreakdown || []).map((b) => [
      `"${b.tag}"`,
      `"${b.ruleId}"`,
      b.transactionCount,
      b.operationCount,
      b.totalFeeStroops,
      b.totalFeeXlm.toFixed(7),
      b.averageFeeStroops,
      b.totalVolumeXlm.toFixed(7),
      b.budgetLimitXlm !== undefined ? b.budgetLimitXlm.toFixed(2) : 'N/A',
      `${b.budgetUsedPercent}%`,
      b.status,
    ])

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  }
}

let defaultManager: CostThresholdManager | null = null

export function getCostThresholdManager(): CostThresholdManager {
  if (!defaultManager) {
    defaultManager = new CostThresholdManager()
  }
  return defaultManager
}
