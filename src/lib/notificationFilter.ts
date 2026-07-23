/**
 * Smart notification filter.
 *
 * Applies user-defined preferences to reduce noise:
 *  - Suppress entire categories
 *  - Filter by minimum priority
 *  - Respect quiet hours (optional future)
 *  - Collapse repetitive events
 */

import type { SmartNotification } from './notificationDeduplicator'
import type { NotificationCategory, NotificationPriority } from './notificationCategories'
import { PRIORITY_RANK, comparePriority } from './notificationCategories'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationFilterConfig {
  /** Per-category suppression. Category not present = enabled. */
  enabledCategories: Partial<Record<NotificationCategory, boolean>>
  /** Minimum priority to show. Notifications below this rank are hidden. */
  minimumPriority: NotificationPriority
  /** Whether to collapse grouped notifications. Default true. */
  collapseGroups: boolean
  /** Maximum age (ms) of notifications to keep. 0 = no limit. */
  maxAgeMs: number
}

export type NotificationSortMode = 'priority' | 'recent' | 'category'

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_FILTER_CONFIG: NotificationFilterConfig = {
  enabledCategories: {
    transaction: true,
    balance: true,
    security: true,
    network: true,
    system: true,
    price: true,
    contract: true,
  },
  minimumPriority: 'low',
  collapseGroups: true,
  maxAgeMs: 0,
}

// ─── Filter function ──────────────────────────────────────────────────────────

export function filterNotifications(
  notifications: SmartNotification[],
  config: NotificationFilterConfig,
  sortMode: NotificationSortMode = 'priority',
): SmartNotification[] {
  const now = Date.now()

  return notifications
    .filter((n) => {
      if (!config.enabledCategories[n.category]) return false
      if (comparePriority(n.priority, config.minimumPriority) > 0) return false
      if (config.maxAgeMs > 0 && (now - n.lastOccurrence) > config.maxAgeMs) return false
      return true
    })
    .sort((a, b) => {
      switch (sortMode) {
        case 'priority':
          return (
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            b.lastOccurrence - a.lastOccurrence
          )
        case 'recent':
          return b.lastOccurrence - a.lastOccurrence
        case 'category': {
          const cat = (a.category < b.category ? -1 : a.category > b.category ? 1 : 0)
          return cat || b.lastOccurrence - a.lastOccurrence
        }
        default:
          return b.lastOccurrence - a.lastOccurrence
      }
    })
}

/**
 * Build a filter config that only shows critical + high priority notifications
 * (useful for "priority mode" toggles).
 */
export function priorityOnlyConfig(
  base?: Partial<NotificationFilterConfig>,
): NotificationFilterConfig {
  return {
    ...DEFAULT_FILTER_CONFIG,
    ...base,
    minimumPriority: 'high',
  }
}

/**
 * Check whether a notification should be considered "high-signal" and
 * force-displayed regardless of user filter settings.
 */
export function isCriticalNotification(notification: SmartNotification): boolean {
  return notification.priority === 'critical'
}
