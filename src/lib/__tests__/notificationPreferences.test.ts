/**
 * Tests for notificationPreferences
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  defaultNotificationPreferences,
  preferencesToFilterConfig,
  isInQuietHours,
} from '../notificationPreferences'
import { DEFAULT_FILTER_CONFIG } from '../notificationFilter'

describe('defaultNotificationPreferences', () => {
  it('should return a complete preferences object', () => {
    const prefs = defaultNotificationPreferences()
    expect(prefs.minimumPriority).toBe('low')
    expect(prefs.collapseGroups).toBe(true)
    expect(prefs.dedupWindowMs).toBe(60_000)
    expect(prefs.maxAgeMs).toBe(0)
    expect(prefs.quietHours.enabled).toBe(false)
  })

  it('should have all categories enabled by default', () => {
    const prefs = defaultNotificationPreferences()
    const cats = ['transaction', 'balance', 'security', 'network', 'system', 'price', 'contract']
    for (const cat of cats) {
      expect(prefs.enabledCategories[cat]).toBe(true)
    }
  })

  it('should enable sounds for transaction, balance, security by default', () => {
    const prefs = defaultNotificationPreferences()
    expect(prefs.soundsEnabled.transaction).toBe(true)
    expect(prefs.soundsEnabled.balance).toBe(true)
    expect(prefs.soundsEnabled.security).toBe(true)
  })

  it('should enable push for security and balance by default', () => {
    const prefs = defaultNotificationPreferences()
    expect(prefs.pushEnabled.security).toBe(true)
    expect(prefs.pushEnabled.balance).toBe(true)
  })
})

describe('preferencesToFilterConfig', () => {
  it('should correctly map notification preferences to filter config', () => {
    const prefs = defaultNotificationPreferences()
    const config = preferencesToFilterConfig(prefs)

    expect(config.minimumPriority).toBe('low')
    expect(config.collapseGroups).toBe(true)
    expect(config.enabledCategories.transaction).toBe(true)
  })

  it('should respect disabled categories', () => {
    const prefs = defaultNotificationPreferences()
    prefs.enabledCategories.network = false
    prefs.enabledCategories.system = false

    const config = preferencesToFilterConfig(prefs)
    expect(config.enabledCategories.network).toBe(false)
    expect(config.enabledCategories.system).toBe(false)
    expect(config.enabledCategories.transaction).toBe(true)
  })

  it('should propagate maxAgeMs', () => {
    const prefs = defaultNotificationPreferences()
    prefs.maxAgeMs = 3600_000

    const config = preferencesToFilterConfig(prefs)
    expect(config.maxAgeMs).toBe(3600_000)
  })
})

describe('isInQuietHours', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('should return false when quiet hours are disabled', () => {
    const result = isInQuietHours({ enabled: false, startHour: 22, endHour: 8 })
    expect(result).toBe(false)
  })

  it('should return true during quiet hours (same day range)', () => {
    vi.setSystemTime(new Date('2024-01-01T23:00:00'))
    const result = isInQuietHours({ enabled: true, startHour: 22, endHour: 8 })
    expect(result).toBe(true)
  })

  it('should return false outside quiet hours (same day range)', () => {
    vi.setSystemTime(new Date('2024-01-01T12:00:00'))
    const result = isInQuietHours({ enabled: true, startHour: 22, endHour: 8 })
    expect(result).toBe(false)
  })

  it('should handle overnight quiet hours correctly', () => {
    // startHour > endHour means overnight (e.g., 22:00 - 08:00)
    vi.setSystemTime(new Date('2024-01-01T02:00:00'))
    const result = isInQuietHours({ enabled: true, startHour: 22, endHour: 8 })
    expect(result).toBe(true)
  })

  it('should return false during the day for overnight quiet hours', () => {
    vi.setSystemTime(new Date('2024-01-01T12:00:00'))
    const result = isInQuietHours({ enabled: true, startHour: 22, endHour: 8 })
    expect(result).toBe(false)
  })
})
