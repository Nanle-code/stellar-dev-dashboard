/**
 * Notification categories, priorities, and type mappings.
 * Provides a unified classification system across all notification sources.
 */

// ─── Categories ───────────────────────────────────────────────────────────────

export type NotificationCategory =
  | 'transaction'
  | 'balance'
  | 'security'
  | 'network'
  | 'system'
  | 'price'
  | 'contract'

export const NOTIFICATION_CATEGORIES: Record<NotificationCategory, {
  label: string
  icon: string
  defaultPriority: NotificationPriority
  description: string
}> = {
  transaction: {
    label: 'Transactions',
    icon: 'ArrowLeftRight',
    defaultPriority: 'medium',
    description: 'Incoming/outgoing payments, trades, and operations',
  },
  balance: {
    label: 'Balance',
    icon: 'Wallet',
    defaultPriority: 'high',
    description: 'Balance threshold alerts and asset changes',
  },
  security: {
    label: 'Security',
    icon: 'Shield',
    defaultPriority: 'critical',
    description: 'Signer changes, auth changes, and high-risk events',
  },
  network: {
    label: 'Network',
    icon: 'Activity',
    defaultPriority: 'low',
    description: 'Network status, ledger close, and fee updates',
  },
  system: {
    label: 'System',
    icon: 'Settings',
    defaultPriority: 'low',
    description: 'App-level messages, updates, and confirmations',
  },
  price: {
    label: 'Price',
    icon: 'TrendingUp',
    defaultPriority: 'medium',
    description: 'Price alerts and market movements',
  },
  contract: {
    label: 'Contract',
    icon: 'FileCode',
    defaultPriority: 'medium',
    description: 'Soroban contract events and state changes',
  },
}

// ─── Priorities ───────────────────────────────────────────────────────────────

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low'

export const PRIORITY_ORDER: NotificationPriority[] = [
  'critical',
  'high',
  'medium',
  'low',
]

export const PRIORITY_RANK: Record<NotificationPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function comparePriority(a: NotificationPriority, b: NotificationPriority): number {
  return PRIORITY_RANK[a] - PRIORITY_RANK[b]
}

// ─── Type → Category mapping ─────────────────────────────────────────────────

const TYPE_TO_CATEGORY: Record<string, NotificationCategory> = {
  success: 'system',
  error: 'system',
  info: 'system',
  warning: 'system',
  tx_confirm: 'transaction',
  account_change: 'balance',
  network_event: 'network',
  price_alert: 'price',
  payment: 'transaction',
  trade: 'transaction',
  contract: 'contract',
}

/**
 * Map any existing notification type string to its canonical category.
 */
export function getCategoryForType(type: string): NotificationCategory {
  return TYPE_TO_CATEGORY[type] ?? 'system'
}

/**
 * Determine the effective priority for a notification based on its type,
 * source category, and any explicit level provided.
 */
export function getEffectivePriority(
  type: string,
  level?: string,
  category?: NotificationCategory,
): NotificationPriority {
  if (level === 'error') return 'critical'
  if (level === 'warning') return 'high'

  const cat = category || getCategoryForType(type)
  return NOTIFICATION_CATEGORIES[cat]?.defaultPriority ?? 'medium'
}

// ─── Group key generation ─────────────────────────────────────────────────────

/**
 * Build a deterministic grouping key for deduplication.
 * Notifications sharing the same key can be collapsed.
 */
export function getNotificationGroupKey(input: {
  title: string
  message?: string
  category: NotificationCategory
  source?: string
}): string {
  const msg = (input.message || '').slice(0, 80)
  return `${input.category}::${input.title}::${msg}::${input.source || ''}`
}
