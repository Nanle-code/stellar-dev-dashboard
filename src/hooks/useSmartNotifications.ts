/**
 * useSmartNotifications — Smart notification hook with deduplication & filtering.
 *
 * Wraps the existing Zustand notificationHistory and converts entries into
 * SmartNotification objects, applying category mapping, deduplication, and
 * user preference filtering.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { NotificationDeduplicator, type SmartNotification } from '../lib/notificationDeduplicator'
import { getCategoryForType, getEffectivePriority } from '../lib/notificationCategories'
import { filterNotifications, type NotificationFilterConfig } from '../lib/notificationFilter'
import { loadNotificationPreferences, preferencesToFilterConfig } from '../lib/notificationPreferences'
import type { Notification } from '../lib/store'

export interface UseSmartNotificationsResult {
  notifications: SmartNotification[]
  unreadCount: number
  filterConfig: NotificationFilterConfig | null
  markRead: (_id: string) => void
  markAllRead: () => void
  remove: (_id: string) => void
  clear: () => void
  deduplicator: NotificationDeduplicator
}

export function useSmartNotifications(): UseSmartNotificationsResult {
  const { notificationHistory, markNotificationRead, markAllNotificationsRead, clearNotificationHistory } =
    useStore()

  const [filterConfig, setFilterConfig] = useState<NotificationFilterConfig | null>(null)
  const deduplicatorRef = useRef(new NotificationDeduplicator())

  // Load user notification preferences once
  useEffect(() => {
    loadNotificationPreferences().then((prefs) => {
      setFilterConfig(preferencesToFilterConfig(prefs))
      deduplicatorRef.current.setWindowMs(prefs.dedupWindowMs)
    })
  }, [])

  // Convert Notification[] → SmartNotification[] with dedup
  const deduped = useMemo(() => {
    const dedup = deduplicatorRef.current
    dedup.reset()

    for (const n of notificationHistory) {
      const category = getCategoryForType(n.type || 'info')
      const priority = getEffectivePriority(n.type || 'info', undefined, category)

      dedup.process({
        id: n.id,
        category,
        priority,
        title: n.title,
        message: n.message as string | undefined,
        timestamp: n.timestamp ?? Date.now(),
        read: n.read ?? false,
        type: n.type,
        payload: n.payload,
      })
    }

    return dedup.getSnapshot()
  }, [notificationHistory])

  // Apply user filters
  const notifications = useMemo(() => {
    if (!filterConfig) return deduped
    return filterNotifications(deduped, filterConfig)
  }, [deduped, filterConfig])

  const unreadCount = useMemo(
    () => notifications.reduce((n, it) => (it.read ? n : n + 1), 0),
    [notifications],
  )

  return {
    notifications,
    unreadCount,
    filterConfig,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsRead,
    remove: (id: string) => {
      useStore.getState().removeNotification(id)
    },
    clear: clearNotificationHistory,
    deduplicator: deduplicatorRef.current,
  }
}

export default useSmartNotifications

/**
 * Convert a single raw Notification from the Zustand store into a
 * partial SmartNotification-like shape.
 */
export function toSmartNotificationInput(n: Notification) {
  const category = getCategoryForType(n.type || 'info')
  return {
    id: n.id,
    category,
    priority: getEffectivePriority(n.type || 'info', undefined, category),
    title: n.title,
    message: n.message as string | undefined,
    timestamp: n.timestamp ?? Date.now(),
    read: n.read ?? false,
    type: n.type,
    payload: n.payload,
  }
}
