/**
 * Tests for notificationCategories
 */

import { describe, it, expect } from 'vitest'
import {
  getCategoryForType,
  getEffectivePriority,
  getNotificationGroupKey,
  comparePriority,
  PRIORITY_RANK,
  NOTIFICATION_CATEGORIES,
} from '../notificationCategories'

describe('getCategoryForType', () => {
  it('should map known types to correct categories', () => {
    expect(getCategoryForType('success')).toBe('system')
    expect(getCategoryForType('error')).toBe('system')
    expect(getCategoryForType('tx_confirm')).toBe('transaction')
    expect(getCategoryForType('account_change')).toBe('balance')
    expect(getCategoryForType('network_event')).toBe('network')
    expect(getCategoryForType('price_alert')).toBe('price')
    expect(getCategoryForType('payment')).toBe('transaction')
    expect(getCategoryForType('trade')).toBe('transaction')
    expect(getCategoryForType('contract')).toBe('contract')
  })

  it('should return system for unknown types', () => {
    expect(getCategoryForType('unknown_type')).toBe('system')
    expect(getCategoryForType('')).toBe('system')
  })
})

describe('getEffectivePriority', () => {
  it('should return critical for error level', () => {
    expect(getEffectivePriority('info', 'error')).toBe('critical')
  })

  it('should return high for warning level', () => {
    expect(getEffectivePriority('info', 'warning')).toBe('high')
  })

  it('should return default priority for category when no level given', () => {
    expect(getEffectivePriority('tx_confirm')).toBe('medium')
    expect(getEffectivePriority('account_change')).toBe('high')
    expect(getEffectivePriority('network_event')).toBe('low')
    expect(getEffectivePriority('price_alert')).toBe('medium')
  })

  it('should use category default when level is info', () => {
    expect(getEffectivePriority('network_event', 'info')).toBe('low')
    expect(getEffectivePriority('tx_confirm', 'info')).toBe('medium')
  })
})

describe('getNotificationGroupKey', () => {
  it('should produce the same key for identical inputs', () => {
    const key1 = getNotificationGroupKey({
      title: 'Payment received',
      message: '10 XLM from GA...',
      category: 'transaction',
      source: 'GA',
    })
    const key2 = getNotificationGroupKey({
      title: 'Payment received',
      message: '10 XLM from GA...',
      category: 'transaction',
      source: 'GA',
    })
    expect(key1).toBe(key2)
  })

  it('should produce different keys for different titles', () => {
    const key1 = getNotificationGroupKey({
      title: 'Payment received',
      message: '10 XLM',
      category: 'transaction',
      source: 'GA',
    })
    const key2 = getNotificationGroupKey({
      title: 'Balance alert',
      message: '10 XLM',
      category: 'transaction',
      source: 'GA',
    })
    expect(key1).not.toBe(key2)
  })

  it('should produce different keys for different categories', () => {
    const key1 = getNotificationGroupKey({
      title: 'Alert',
      message: 'Something happened',
      category: 'transaction',
      source: 'GA',
    })
    const key2 = getNotificationGroupKey({
      title: 'Alert',
      message: 'Something happened',
      category: 'security',
      source: 'GA',
    })
    expect(key1).not.toBe(key2)
  })

  it('should truncate long messages to 80 chars', () => {
    const longMsg = 'x'.repeat(200)
    const key = getNotificationGroupKey({
      title: 'Long message',
      message: longMsg,
      category: 'system',
    })
    expect(key.length).toBeLessThan('Long message'.length + 80 + 20)
  })

  it('should handle missing source', () => {
    const withSource = getNotificationGroupKey({
      title: 'Test',
      category: 'system',
      source: 'src1',
    })
    const withoutSource = getNotificationGroupKey({
      title: 'Test',
      category: 'system',
    })
    expect(withSource).not.toBe(withoutSource)
  })
})

describe('comparePriority', () => {
  it('should return negative when a is higher priority than b', () => {
    expect(comparePriority('critical', 'low')).toBeLessThan(0)
  })

  it('should return positive when a is lower priority than b', () => {
    expect(comparePriority('low', 'critical')).toBeGreaterThan(0)
  })

  it('should return zero for same priority', () => {
    expect(comparePriority('medium', 'medium')).toBe(0)
  })
})

describe('PRIORITY_RANK', () => {
  it('should have correct ordering', () => {
    expect(PRIORITY_RANK.critical).toBeLessThan(PRIORITY_RANK.high)
    expect(PRIORITY_RANK.high).toBeLessThan(PRIORITY_RANK.medium)
    expect(PRIORITY_RANK.medium).toBeLessThan(PRIORITY_RANK.low)
  })
})

describe('NOTIFICATION_CATEGORIES', () => {
  it('should have entries for all expected categories', () => {
    const cats = ['transaction', 'balance', 'security', 'network', 'system', 'price', 'contract']
    for (const cat of cats) {
      expect(NOTIFICATION_CATEGORIES[cat]).toBeDefined()
      expect(NOTIFICATION_CATEGORIES[cat].label).toBeDefined()
      expect(NOTIFICATION_CATEGORIES[cat].defaultPriority).toBeDefined()
    }
  })
})
