/**
 * Notification deduplication engine.
 *
 * Groups similar notifications together so repeated events are collapsed
 * into a single entry with a count, rather than flooding the UI.
 */

import {
  getNotificationGroupKey,
  type NotificationCategory,
  type NotificationPriority,
  PRIORITY_RANK,
} from './notificationCategories'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmartNotification {
  id: string
  category: NotificationCategory
  priority: NotificationPriority
  title: string
  message: string
  timestamp: number
  source?: string
  read: boolean
  /** Number of individual events that this notification represents. */
  count: number
  /** ISO timestamp of the most recent event in this group. */
  lastOccurrence: number
  /** Original notification type for backward compatibility. */
  type?: string
  /** Arbitrary payload from the source. */
  payload?: unknown
}

export interface DeduplicationConfig {
  /** Time window (ms) within which identical notifications are grouped. Default 60000 (1 min). */
  windowMs: number
  /** Maximum count before grouping stops incrementing (prevents unbounded counts). Default 999. */
  maxCount: number
}

const DEFAULT_CONFIG: DeduplicationConfig = {
  windowMs: 60_000,
  maxCount: 999,
}

// ─── Deduplicator ─────────────────────────────────────────────────────────────

export class NotificationDeduplicator {
  private groups: Map<string, SmartNotification> = new Map()
  private config: DeduplicationConfig

  constructor(config?: Partial<DeduplicationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Reset all tracked groups (e.g., on user disconnect).
   */
  reset(): void {
    this.groups.clear()
  }

  /**
   * Update the deduplication window.
   */
  setWindowMs(ms: number): void {
    this.config.windowMs = ms
  }

  /**
   * Process an incoming notification through the deduplicator.
   *
   * Returns the updated or new SmartNotification. If the event falls within
   * the dedup window of an existing group, the existing entry's count is
   * incremented and its timestamp bumped. Otherwise a fresh entry is created.
   *
   * When `existingNotifications` is provided, pre-existing notifications are
   * merged into the dedup state so the deduplicator sees the full history.
   */
  process(input: {
    id: string
    category: NotificationCategory
    priority: NotificationPriority
    title: string
    message?: string
    timestamp: number
    source?: string
    read?: boolean
    type?: string
    payload?: unknown
  }, existingNotifications?: SmartNotification[]): SmartNotification {
    if (existingNotifications) {
      this.seed(existingNotifications)
    }

    const key = getNotificationGroupKey({
      title: input.title,
      message: input.message,
      category: input.category,
      source: input.source,
    })

    const now = input.timestamp
    const existing = this.groups.get(key)

    if (existing && (now - existing.lastOccurrence) < this.config.windowMs) {
      const updated: SmartNotification = {
        ...existing,
        id: input.id,
        lastOccurrence: now,
        count: Math.min(existing.count + 1, this.config.maxCount),
        read: input.read ?? existing.read,
        timestamp: existing.timestamp,
        payload: input.payload ?? existing.payload,
      }
      this.groups.set(key, updated)
      return updated
    }

    const created: SmartNotification = {
      id: input.id,
      category: input.category,
      priority: input.priority,
      title: input.title,
      message: input.message ?? '',
      timestamp: now,
      source: input.source,
      read: input.read ?? false,
      count: 1,
      lastOccurrence: now,
      type: input.type,
      payload: input.payload,
    }
    this.groups.set(key, created)
    return created
  }

  /**
   * Seed the deduplicator with pre-existing notifications so it can
   * correctly group new events against current state.
   */
  private seed(notifications: SmartNotification[]): void {
    for (const n of notifications) {
      const key = getNotificationGroupKey({
        title: n.title,
        message: n.message,
        category: n.category,
        source: n.source,
      })
      if (!this.groups.has(key)) {
        this.groups.set(key, n)
      }
    }
  }

  /**
   * Remove all groups that match a filter predicate.
   */
  removeWhere(predicate: (_n: SmartNotification) => boolean): void {
    for (const [key, _n] of this.groups.entries()) {
      if (predicate(_n)) {
        this.groups.delete(key)
      }
    }
  }

  /**
   * Mark all groups as read.
   */
  markAllRead(): void {
    for (const [key, n] of this.groups.entries()) {
      this.groups.set(key, { ...n, read: true })
    }
  }

  /**
   * Get a snapshot of all tracked groups, deduplication-applied,
   * sorted by priority then recency.
   */
  getSnapshot(): SmartNotification[] {
    const entries = Array.from(this.groups.values())
    entries.sort((a, b) => {
      const prio = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (prio !== 0) return prio
      return b.lastOccurrence - a.lastOccurrence
    })
    return entries
  }
}
