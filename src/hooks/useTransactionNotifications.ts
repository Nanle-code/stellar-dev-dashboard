/**
 * Hook for Transaction Real-Time Notifications (#295)
 */

import { useEffect, useState } from 'react'
import { transactionNotificationStore } from '../lib/transactionNotifications'
import type { TransactionNotification } from '../lib/transactionNotifications'

export interface UseTransactionNotificationsResult {
  notifications: TransactionNotification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
  remove: (id: string) => void
  clear: () => void
  startMonitoring: (accountId: string, network?: 'mainnet' | 'testnet') => Promise<void>
  stopMonitoring: (accountId: string) => void
  stopAllMonitoring: () => void
  setSoundEnabled: (enabled: boolean) => void
  exportAsJSON: () => string
  exportAsCSV: () => string
}

export function useTransactionNotifications(): UseTransactionNotificationsResult {
  const [notifications, setNotifications] = useState<TransactionNotification[]>(() =>
    transactionNotificationStore.getSnapshot(),
  )

  useEffect(() => transactionNotificationStore.subscribe(setNotifications), [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return {
    notifications,
    unreadCount,
    markRead: (id) => transactionNotificationStore.markRead(id),
    markAllRead: () => transactionNotificationStore.markAllRead(),
    remove: (id) => transactionNotificationStore.remove(id),
    clear: () => transactionNotificationStore.clear(),
    startMonitoring: (accountId, network) =>
      transactionNotificationStore.startMonitoring(accountId, network),
    stopMonitoring: (accountId) => transactionNotificationStore.stopMonitoring(accountId),
    stopAllMonitoring: () => transactionNotificationStore.stopAllMonitoring(),
    setSoundEnabled: (enabled) => transactionNotificationStore.setSoundEnabled(enabled),
    exportAsJSON: () => transactionNotificationStore.exportAsJSON(),
    exportAsCSV: () => transactionNotificationStore.exportAsCSV(),
  }
}

export default useTransactionNotifications
