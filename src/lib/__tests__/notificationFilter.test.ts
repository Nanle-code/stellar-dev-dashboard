/**
 * Tests for notificationFilter
 */

import { describe, it, expect } from 'vitest'
import { filterNotifications, DEFAULT_FILTER_CONFIG, priorityOnlyConfig, isCriticalNotification } from '../notificationFilter'
import { PRIORITY_ORDER } from '../notificationCategories'
import type { SmartNotification } from '../notificationDeduplicator'

function makeNotif(overrides: Partial<SmartNotification> = {}): SmartNotification {
  return {
    id: overrides.id ?? 'n1',
    category: overrides.category ?? 'transaction',
    priority: overrides.priority ?? 'medium',
    title: overrides.title ?? 'Test',
    message: overrides.message ?? 'Test message',
    timestamp: overrides.timestamp ?? Date.now() - 10_000,
    lastOccurrence: overrides.lastOccurrence ?? Date.now() - 10_000,
    read: overrides.read ?? false,
    count: overrides.count ?? 1,
    type: overrides.type ?? 'payment',
  }
}

describe('filterNotifications', () => {
  it('should return all notifications when filter config allows everything', () => {
    const notifications = [
      makeNotif({ id: 'n1', category: 'transaction' }),
      makeNotif({ id: 'n2', category: 'security' }),
      makeNotif({ id: 'n3', category: 'network' }),
    ]

    const result = filterNotifications(notifications, DEFAULT_FILTER_CONFIG)
    expect(result).toHaveLength(3)
  })

  it('should filter out disabled categories', () => {
    const notifications = [
      makeNotif({ id: 'n1', category: 'transaction' }),
      makeNotif({ id: 'n2', category: 'network' }),
    ]

    const config = {
      ...DEFAULT_FILTER_CONFIG,
      enabledCategories: { transaction: true, network: false, balance: true, security: true, system: true, price: true, contract: true },
    }

    const result = filterNotifications(notifications, config)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('n1')
  })

  it('should filter out notifications below minimum priority', () => {
    const notifications = [
      makeNotif({ id: 'n1', priority: 'critical' }),
      makeNotif({ id: 'n2', priority: 'high' }),
      makeNotif({ id: 'n3', priority: 'medium' }),
      makeNotif({ id: 'n4', priority: 'low' }),
    ]

    const config = {
      ...DEFAULT_FILTER_CONFIG,
      minimumPriority: 'high' as const,
    }

    const result = filterNotifications(notifications, config)
    expect(result).toHaveLength(2)
    expect(result[0].priority).toBe('critical')
    expect(result[1].priority).toBe('high')
  })

  it('should filter out old notifications when maxAgeMs is set', () => {
    const now = Date.now()
    const notifications = [
      makeNotif({ id: 'n1', lastOccurrence: now - 10_000 }),
      makeNotif({ id: 'n2', lastOccurrence: now - 200_000 }),
    ]

    const config = {
      ...DEFAULT_FILTER_CONFIG,
      maxAgeMs: 60_000,
    }

    const result = filterNotifications(notifications, config)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('n1')
  })

  it('should sort by priority in priority mode', () => {
    const notifications = [
      makeNotif({ id: 'n1', priority: 'low', lastOccurrence: Date.now() }),
      makeNotif({ id: 'n2', priority: 'critical', lastOccurrence: Date.now() - 10_000 }),
      makeNotif({ id: 'n3', priority: 'high', lastOccurrence: Date.now() - 5_000 }),
    ]

    const result = filterNotifications(notifications, DEFAULT_FILTER_CONFIG, 'priority')
    expect(result[0].id).toBe('n2') // critical first
    expect(result[1].id).toBe('n3') // high
    expect(result[2].id).toBe('n1') // low
  })

  it('should sort by recency in recent mode', () => {
    const notifications = [
      makeNotif({ id: 'n1', lastOccurrence: 100 }),
      makeNotif({ id: 'n2', lastOccurrence: 300 }),
      makeNotif({ id: 'n3', lastOccurrence: 200 }),
    ]

    const result = filterNotifications(notifications, DEFAULT_FILTER_CONFIG, 'recent')
    expect(result[0].id).toBe('n2') // most recent (300)
    expect(result[1].id).toBe('n3') // 200
    expect(result[2].id).toBe('n1') // 100
  })

  it('should sort by category then recency in category mode', () => {
    const notifications = [
      makeNotif({ id: 'n1', category: 'security', lastOccurrence: 100 }),
      makeNotif({ id: 'n2', category: 'balance', lastOccurrence: 300 }),
      makeNotif({ id: 'n3', category: 'security', lastOccurrence: 200 }),
    ]

    const result = filterNotifications(notifications, DEFAULT_FILTER_CONFIG, 'category')
    expect(result[0].id).toBe('n2') // balance
    expect(result[1].id).toBe('n3') // security (200)
    expect(result[2].id).toBe('n1') // security (100)
  })
})

describe('priorityOnlyConfig', () => {
  it('should create a config that only shows high and critical', () => {
    const config = priorityOnlyConfig()
    expect(config.minimumPriority).toBe('high')
  })

  it('should merge with base config', () => {
    const config = priorityOnlyConfig({ maxAgeMs: 30_000 })
    expect(config.minimumPriority).toBe('high')
    expect(config.maxAgeMs).toBe(30_000)
  })
})

describe('isCriticalNotification', () => {
  it('should return true for critical priority', () => {
    const n = makeNotif({ priority: 'critical' })
    expect(isCriticalNotification(n)).toBe(true)
  })

  it('should return false for non-critical priority', () => {
    const n = makeNotif({ priority: 'high' })
    expect(isCriticalNotification(n)).toBe(false)

    const n2 = makeNotif({ priority: 'medium' })
    expect(isCriticalNotification(n2)).toBe(false)

    const n3 = makeNotif({ priority: 'low' })
    expect(isCriticalNotification(n3)).toBe(false)
  })
})
