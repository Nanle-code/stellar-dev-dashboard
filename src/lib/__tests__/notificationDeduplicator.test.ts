/**
 * Tests for NotificationDeduplicator
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { NotificationDeduplicator } from '../notificationDeduplicator'
import type { SmartNotification } from '../notificationDeduplicator'
import type { NotificationCategory, NotificationPriority } from '../notificationCategories'

function makeInput(overrides: Partial<{
  id: string
  category: NotificationCategory
  priority: NotificationPriority
  title: string
  message: string
  timestamp: number
  source: string
  read: boolean
  type: string
}> = {}) {
  const now = Date.now()
  return {
    id: overrides.id ?? 'n1',
    category: overrides.category ?? ('transaction' as NotificationCategory),
    priority: overrides.priority ?? ('medium' as NotificationPriority),
    title: overrides.title ?? 'Test notification',
    message: overrides.message ?? 'This is a test',
    timestamp: overrides.timestamp ?? now,
    source: overrides.source ?? 'GABCDEF123',
    read: overrides.read ?? false,
    type: overrides.type ?? 'payment',
  }
}

describe('NotificationDeduplicator', () => {
  let dedup: NotificationDeduplicator

  beforeEach(() => {
    dedup = new NotificationDeduplicator({ windowMs: 60_000 })
  })

  it('should return a fresh notification on first occurrence', () => {
    const input = makeInput()
    const result = dedup.process(input)

    expect(result.id).toBe('n1')
    expect(result.count).toBe(1)
    expect(result.title).toBe('Test notification')
    expect(result.message).toBe('This is a test')
    expect(result.priority).toBe('medium')
    expect(result.category).toBe('transaction')
  })

  it('should increment count when identical notification arrives within window', () => {
    const input = makeInput({ id: 'n1', title: 'Payment received', message: '10 XLM' })
    dedup.process(input)

    const second = makeInput({ id: 'n2', title: 'Payment received', message: '10 XLM', timestamp: Date.now() + 10_000 })
    const result = dedup.process(second)

    expect(result.id).toBe('n2')
    expect(result.count).toBe(2)
    expect(result.title).toBe('Payment received')
  })

  it('should create a new group when notification arrives outside the window', () => {
    const input = makeInput({ id: 'n1', title: 'Same title', message: 'Same message', timestamp: 0 })
    dedup.process(input)

    const later = makeInput({
      id: 'n2',
      title: 'Same title',
      message: 'Same message',
      timestamp: 120_000,
    })
    const result = dedup.process(later)

    // Different group because outside the 60s window
    expect(result.count).toBe(1)
    expect(result.id).toBe('n2')
  })

  it('should cap count at maxCount', () => {
    const dedupCapped = new NotificationDeduplicator({ windowMs: 60_000, maxCount: 5 })

    for (let i = 0; i < 10; i++) {
      dedupCapped.process(makeInput({
        id: `n${i}`,
        title: 'Repeated event',
        message: 'Same message',
        timestamp: Date.now() + i * 1000,
      }))
    }

    const snapshot = dedupCapped.getSnapshot()
    expect(snapshot).toHaveLength(1)
    expect(snapshot[0].count).toBe(5)
  })

  it('should treat notifications with different titles as separate groups', () => {
    dedup.process(makeInput({ id: 'n1', title: 'Payment received', message: '10 XLM' }))
    dedup.process(makeInput({ id: 'n2', title: 'Balance alert', message: '10 XLM' }))

    const snapshot = dedup.getSnapshot()
    expect(snapshot).toHaveLength(2)
  })

  it('should treat notifications with different sources as separate groups', () => {
    dedup.process(makeInput({ id: 'n1', title: 'Payment', source: 'GA' }))
    dedup.process(makeInput({ id: 'n2', title: 'Payment', source: 'GB' }))

    const snapshot = dedup.getSnapshot()
    expect(snapshot).toHaveLength(2)
  })

  it('should sort by priority then recency', () => {
    dedup.process(makeInput({
      id: 'n1',
      title: 'Low priority',
      priority: 'low',
      timestamp: Date.now() - 10_000,
    }))
    dedup.process(makeInput({
      id: 'n2',
      title: 'Critical alert',
      priority: 'critical',
      timestamp: Date.now() - 20_000,
    }))
    dedup.process(makeInput({
      id: 'n3',
      title: 'High priority',
      priority: 'high',
      timestamp: Date.now() - 5_000,
    }))

    const snapshot = dedup.getSnapshot()
    expect(snapshot[0].title).toBe('Critical alert')
    expect(snapshot[1].title).toBe('High priority')
    expect(snapshot[2].title).toBe('Low priority')
  })

  it('should support reset', () => {
    dedup.process(makeInput({ id: 'n1' }))
    expect(dedup.getSnapshot()).toHaveLength(1)
    dedup.reset()
    expect(dedup.getSnapshot()).toHaveLength(0)
  })

  it('should support removeWhere', () => {
    dedup.process(makeInput({ id: 'n1', category: 'transaction' }))
    dedup.process(makeInput({ id: 'n2', category: 'security' }))

    dedup.removeWhere((n) => n.category === 'security')
    const snapshot = dedup.getSnapshot()
    expect(snapshot).toHaveLength(1)
    expect(snapshot[0].id).toBe('n1')
  })

  it('should support markAllRead', () => {
    dedup.process(makeInput({ id: 'n1', read: false }))
    dedup.process(makeInput({ id: 'n2', read: false }))

    dedup.markAllRead()
    const snapshot = dedup.getSnapshot()
    expect(snapshot.every((n) => n.read)).toBe(true)
  })

  it('should seed from existing notifications', () => {
    const existing: SmartNotification[] = [
      {
        id: 'existing-1',
        category: 'transaction',
        priority: 'medium',
        title: 'Existing',
        message: 'Seeding',
        timestamp: Date.now() - 30_000,
        lastOccurrence: Date.now() - 30_000,
        read: true,
        count: 3,
        source: 'GABCDEF123',
      },
    ]

    const result = dedup.process(
      makeInput({ id: 'new-1', title: 'Existing', message: 'Seeding' }),
      existing,
    )

    expect(result.count).toBe(4)
  })

  it('should support getSnapshot returning sorted results', () => {
    dedup.process(makeInput({ id: 'n1', title: 'A', timestamp: 100 }))
    dedup.process(makeInput({ id: 'n2', title: 'B', timestamp: 200 }))

    // Different titles → different groups
    const snapshot = dedup.getSnapshot()
    expect(snapshot).toHaveLength(2)
  })
})
