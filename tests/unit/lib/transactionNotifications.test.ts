/**
 * Tests for Transaction Real-Time Notifications (#295)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { transactionNotificationStore } from '../lib/transactionNotifications'
import type { TransactionNotification } from '../lib/transactionNotifications'

describe('TransactionNotificationStore', () => {
  beforeEach(() => {
    transactionNotificationStore.clear()
  })

  describe('addNotification', () => {
    it('should add a notification', () => {
      const notification = {
        accountId: 'GTEST123',
        transaction: { id: 'tx1' },
        timestamp: Date.now(),
        type: 'payment' as const,
        amount: '100',
        asset: 'XLM',
        from: 'GAAA123',
        to: 'GBBB456',
        status: 'success' as const,
        read: false,
        network: 'testnet' as const,
      }

      transactionNotificationStore.addNotification(notification)

      const stored = transactionNotificationStore.getSnapshot()
      expect(stored).toHaveLength(1)
      expect(stored[0]).toMatchObject(notification)
    })

    it('should generate unique IDs', () => {
      const notification = {
        accountId: 'GTEST123',
        transaction: { id: 'tx1' },
        timestamp: Date.now(),
        type: 'payment' as const,
        status: 'success' as const,
        read: false,
        network: 'testnet' as const,
      }

      transactionNotificationStore.addNotification(notification)
      transactionNotificationStore.addNotification(notification)

      const stored = transactionNotificationStore.getSnapshot()
      expect(stored[0].id).not.toBe(stored[1].id)
    })

    it('should maintain max notifications limit', () => {
      transactionNotificationStore.setMaxNotifications(5)

      for (let i = 0; i < 10; i++) {
        transactionNotificationStore.addNotification({
          accountId: 'GTEST123',
          transaction: { id: `tx${i}` },
          timestamp: Date.now(),
          type: 'payment',
          status: 'success',
          read: false,
          network: 'testnet',
        })
      }

      const stored = transactionNotificationStore.getSnapshot()
      expect(stored).toHaveLength(5)
    })
  })

  describe('markRead', () => {
    it('should mark notification as read', () => {
      transactionNotificationStore.addNotification({
        accountId: 'GTEST123',
        transaction: { id: 'tx1' },
        timestamp: Date.now(),
        type: 'payment',
        status: 'success',
        read: false,
        network: 'testnet',
      })

      const stored = transactionNotificationStore.getSnapshot()
      const id = stored[0].id

      transactionNotificationStore.markRead(id)

      const updated = transactionNotificationStore.getSnapshot()
      expect(updated[0].read).toBe(true)
    })

    it('should not affect other notifications', () => {
      transactionNotificationStore.addNotification({
        accountId: 'GTEST123',
        transaction: { id: 'tx1' },
        timestamp: Date.now(),
        type: 'payment',
        status: 'success',
        read: false,
        network: 'testnet',
      })

      transactionNotificationStore.addNotification({
        accountId: 'GTEST456',
        transaction: { id: 'tx2' },
        timestamp: Date.now(),
        type: 'contract',
        status: 'success',
        read: false,
        network: 'testnet',
      })

      const stored = transactionNotificationStore.getSnapshot()
      transactionNotificationStore.markRead(stored[0].id)

      const updated = transactionNotificationStore.getSnapshot()
      expect(updated[0].read).toBe(true)
      expect(updated[1].read).toBe(false)
    })
  })

  describe('markAllRead', () => {
    it('should mark all notifications as read', () => {
      for (let i = 0; i < 3; i++) {
        transactionNotificationStore.addNotification({
          accountId: 'GTEST123',
          transaction: { id: `tx${i}` },
          timestamp: Date.now(),
          type: 'payment',
          status: 'success',
          read: false,
          network: 'testnet',
        })
      }

      transactionNotificationStore.markAllRead()

      const stored = transactionNotificationStore.getSnapshot()
      expect(stored.every((n) => n.read)).toBe(true)
    })
  })

  describe('remove', () => {
    it('should remove a notification', () => {
      transactionNotificationStore.addNotification({
        accountId: 'GTEST123',
        transaction: { id: 'tx1' },
        timestamp: Date.now(),
        type: 'payment',
        status: 'success',
        read: false,
        network: 'testnet',
      })

      const stored = transactionNotificationStore.getSnapshot()
      const id = stored[0].id

      transactionNotificationStore.remove(id)

      const updated = transactionNotificationStore.getSnapshot()
      expect(updated).toHaveLength(0)
    })
  })

  describe('clear', () => {
    it('should clear all notifications', () => {
      for (let i = 0; i < 5; i++) {
        transactionNotificationStore.addNotification({
          accountId: 'GTEST123',
          transaction: { id: `tx${i}` },
          timestamp: Date.now(),
          type: 'payment',
          status: 'success',
          read: false,
          network: 'testnet',
        })
      }

      transactionNotificationStore.clear()

      const stored = transactionNotificationStore.getSnapshot()
      expect(stored).toHaveLength(0)
    })
  })

  describe('getUnreadCount', () => {
    it('should count unread notifications', () => {
      transactionNotificationStore.addNotification({
        accountId: 'GTEST123',
        transaction: { id: 'tx1' },
        timestamp: Date.now(),
        type: 'payment',
        status: 'success',
        read: false,
        network: 'testnet',
      })

      transactionNotificationStore.addNotification({
        accountId: 'GTEST456',
        transaction: { id: 'tx2' },
        timestamp: Date.now(),
        type: 'payment',
        status: 'success',
        read: true,
        network: 'testnet',
      })

      expect(transactionNotificationStore.getUnreadCount()).toBe(1)
    })
  })

  describe('exportAsJSON', () => {
    it('should export as valid JSON', () => {
      transactionNotificationStore.addNotification({
        accountId: 'GTEST123',
        transaction: { id: 'tx1' },
        timestamp: Date.now(),
        type: 'payment',
        status: 'success',
        read: false,
        network: 'testnet',
      })

      const json = transactionNotificationStore.exportAsJSON()
      const parsed = JSON.parse(json)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(1)
    })
  })

  describe('exportAsCSV', () => {
    it('should export as valid CSV', () => {
      transactionNotificationStore.addNotification({
        accountId: 'GTEST123',
        transaction: { id: 'tx1' },
        timestamp: Date.now(),
        type: 'payment',
        amount: '100',
        asset: 'XLM',
        from: 'GAAA123',
        to: 'GBBB456',
        status: 'success',
        read: false,
        network: 'testnet',
      })

      const csv = transactionNotificationStore.exportAsCSV()

      expect(csv).toContain('ID,Account ID,Timestamp')
      expect(csv).toContain('GTEST123')
      expect(csv).toContain('payment')
    })
  })

  describe('subscribe', () => {
    it('should notify subscribers of changes', () => {
      const callback = vi.fn()
      const unsubscribe = transactionNotificationStore.subscribe(callback)

      transactionNotificationStore.addNotification({
        accountId: 'GTEST123',
        transaction: { id: 'tx1' },
        timestamp: Date.now(),
        type: 'payment',
        status: 'success',
        read: false,
        network: 'testnet',
      })

      expect(callback).toHaveBeenCalled()

      callback.mockClear()
      unsubscribe()

      transactionNotificationStore.addNotification({
        accountId: 'GTEST456',
        transaction: { id: 'tx2' },
        timestamp: Date.now(),
        type: 'payment',
        status: 'success',
        read: false,
        network: 'testnet',
      })

      expect(callback).not.toHaveBeenCalled()
    })
  })
})
