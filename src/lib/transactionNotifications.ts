/**
 * Transaction Real-Time Notification System (#295)
 *
 * Integrates with Stellar's streaming API to provide real-time notifications
 * for incoming transactions on monitored accounts. Supports mainnet and testnet
 * with automatic network switching.
 *
 * Features:
 * - Real-time updates via Stellar Horizon SSE API
 * - Toast notifications for new transactions
 * - Optional sound alerts
 * - Notification history panel (10+ notifications retained)
 * - Network-aware (mainnet/testnet)
 */

import { getServer } from './stellar'
import type { Transaction } from 'stellar-sdk'

export interface TransactionNotification {
  id: string
  accountId: string
  transaction: any
  timestamp: number
  type: 'payment' | 'trade' | 'contract' | 'other'
  amount?: string
  asset?: string
  from?: string
  to?: string
  status: 'success' | 'pending' | 'failed'
  read: boolean
  network: 'mainnet' | 'testnet'
}

interface NotificationStoreState {
  notifications: TransactionNotification[]
  maxNotifications: number
  soundEnabled: boolean
  isMonitoring: boolean
}

class TransactionNotificationStore {
  private state: NotificationStoreState = {
    notifications: [],
    maxNotifications: 50,
    soundEnabled: false,
    isMonitoring: false,
  }

  private subscribers: Set<() => void> = new Set()
  private unsubscribeStreamers: Map<string, () => void> = new Map()

  /**
   * Subscribe to notification changes
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  /**
   * Notify all subscribers of state change
   */
  private notify(): void {
    this.subscribers.forEach((cb) => cb())
  }

  /**
   * Get current snapshot of notifications
   */
  getSnapshot(): TransactionNotification[] {
    return [...this.state.notifications]
  }

  /**
   * Add a new transaction notification
   */
  addNotification(notification: Omit<TransactionNotification, 'id'>): void {
    const newNotif: TransactionNotification = {
      ...notification,
      id: `${notification.accountId}-${notification.timestamp}-${Math.random()}`,
    }

    this.state.notifications.unshift(newNotif)

    // Trim to max size
    if (this.state.notifications.length > this.state.maxNotifications) {
      this.state.notifications = this.state.notifications.slice(
        0,
        this.state.maxNotifications,
      )
    }

    // Play sound if enabled
    if (this.state.soundEnabled) {
      this.playNotificationSound()
    }

    this.notify()
  }

  /**
   * Mark notification as read
   */
  markRead(id: string): void {
    const notif = this.state.notifications.find((n) => n.id === id)
    if (notif) {
      notif.read = true
      this.notify()
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllRead(): void {
    this.state.notifications.forEach((n) => (n.read = true))
    this.notify()
  }

  /**
   * Remove a notification
   */
  remove(id: string): void {
    this.state.notifications = this.state.notifications.filter((n) => n.id !== id)
    this.notify()
  }

  /**
   * Clear all notifications
   */
  clear(): void {
    this.state.notifications = []
    this.notify()
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.state.notifications.filter((n) => !n.read).length
  }

  /**
   * Enable/disable sound alerts
   */
  setSoundEnabled(enabled: boolean): void {
    this.state.soundEnabled = enabled
  }

  /**
   * Set max notifications to retain
   */
  setMaxNotifications(max: number): void {
    this.state.maxNotifications = max
    if (this.state.notifications.length > max) {
      this.state.notifications = this.state.notifications.slice(0, max)
      this.notify()
    }
  }

  /**
   * Start monitoring account for transactions
   */
  async startMonitoring(
    accountId: string,
    network: 'mainnet' | 'testnet' = 'testnet',
  ): Promise<void> {
    if (this.unsubscribeStreamers.has(accountId)) {
      return // Already monitoring
    }

    this.state.isMonitoring = true

    try {
      const server = getServer(network)

      const unsubscribe = server
        .transactions()
        .forAccount(accountId)
        .stream({
          onmessage: (tx: any) => {
            this.handleNewTransaction(tx, accountId, network)
          },
          onerror: (err: Error) => {
            console.error(`Transaction stream error for ${accountId}:`, err)
          },
        })

      this.unsubscribeStreamers.set(accountId, unsubscribe)
    } catch (err) {
      console.error('Failed to start monitoring:', err)
      this.state.isMonitoring = false
    }
  }

  /**
   * Stop monitoring account
   */
  stopMonitoring(accountId: string): void {
    const unsubscribe = this.unsubscribeStreamers.get(accountId)
    if (unsubscribe) {
      unsubscribe()
      this.unsubscribeStreamers.delete(accountId)
    }

    if (this.unsubscribeStreamers.size === 0) {
      this.state.isMonitoring = false
    }
  }

  /**
   * Stop all monitoring
   */
  stopAllMonitoring(): void {
    this.unsubscribeStreamers.forEach((unsubscribe) => {
      unsubscribe()
    })
    this.unsubscribeStreamers.clear()
    this.state.isMonitoring = false
  }

  /**
   * Parse and categorize transaction
   */
  private categorizeTransaction(tx: any): {
    type: TransactionNotification['type']
    amount?: string
    asset?: string
    from?: string
    to?: string
  } {
    const operations = tx.operations || []

    if (operations.length === 0) {
      return { type: 'other' }
    }

    const firstOp = operations[0]

    switch (firstOp.type) {
      case 'payment':
        return {
          type: 'payment',
          amount: firstOp.amount,
          asset: firstOp.asset_code || 'XLM',
          from: firstOp.from || tx.source_account,
          to: firstOp.to,
        }
      case 'path_payment_strict_receive':
      case 'path_payment_strict_send':
        return {
          type: 'payment',
          amount: firstOp.amount || firstOp.send_max,
          asset: firstOp.asset_code || 'XLM',
          from: firstOp.from || tx.source_account,
          to: firstOp.to,
        }
      case 'manage_sell_offer':
      case 'manage_buy_offer':
        return {
          type: 'trade',
          amount: firstOp.amount,
          asset: `${firstOp.selling_asset_code}/${firstOp.buying_asset_code}`,
        }
      case 'invoke_host_function':
        return {
          type: 'contract',
          amount: undefined,
          asset: 'Soroban',
        }
      default:
        return { type: 'other' }
    }
  }

  /**
   * Handle new transaction from stream
   */
  private handleNewTransaction(
    tx: any,
    accountId: string,
    network: 'mainnet' | 'testnet',
  ): void {
    const categoryInfo = this.categorizeTransaction(tx)

    this.addNotification({
      accountId,
      transaction: tx,
      timestamp: new Date(tx.created_at).getTime(),
      type: categoryInfo.type,
      amount: categoryInfo.amount,
      asset: categoryInfo.asset,
      from: categoryInfo.from,
      to: categoryInfo.to,
      status: 'success',
      read: false,
      network,
    })
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()

      oscillator.connect(gain)
      gain.connect(audioContext.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'

      gain.gain.setValueAtTime(0.3, audioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (err) {
      console.warn('Could not play notification sound:', err)
    }
  }

  /**
   * Export notifications as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.state.notifications, null, 2)
  }

  /**
   * Export notifications as CSV
   */
  exportAsCSV(): string {
    const headers = [
      'ID',
      'Account ID',
      'Timestamp',
      'Type',
      'Amount',
      'Asset',
      'From',
      'To',
      'Status',
      'Network',
    ]

    const rows = this.state.notifications.map((n) => [
      n.id,
      n.accountId,
      new Date(n.timestamp).toISOString(),
      n.type,
      n.amount || '',
      n.asset || '',
      n.from || '',
      n.to || '',
      n.status,
      n.network,
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n')

    return csvContent
  }
}

// Export singleton instance
export const transactionNotificationStore = new TransactionNotificationStore()

export default transactionNotificationStore
