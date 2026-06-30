import { useEffect, useState } from 'react'
import { notificationStore } from '../lib/websocket/notificationStore'
import type { RealTimeNotification } from '../lib/websocket/StreamTypes'

export interface UseRealTimeNotificationsResult {
  notifications: RealTimeNotification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
  remove: (id: string) => void
  clear: () => void
}

export function useRealTimeNotifications(): UseRealTimeNotificationsResult {
  const [notifications, setNotifications] = useState<RealTimeNotification[]>(() =>
    notificationStore.getSnapshot(),
  )

  useEffect(() => notificationStore.subscribe(setNotifications), [])

  const unreadCount = notifications.reduce((n, it) => (it.read ? n : n + 1), 0)

  return {
    notifications,
    unreadCount,
    markRead: (id) => notificationStore.markRead(id),
    markAllRead: () => notificationStore.markAllRead(),
    remove: (id) => notificationStore.remove(id),
    clear: () => notificationStore.clear(),
  }
}

export default useRealTimeNotifications
