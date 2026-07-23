/**
 * Notification-specific user preferences.
 *
 * Extends the general UserPreferences with per-category toggles,
 * priority thresholds, quiet hours, and deduplication settings.
 *
 * Persisted alongside general preferences via IndexedDB/storage.js.
 */

import { getStoredValue, setStoredValue } from './storage'
import type { NotificationCategory } from './notificationCategories'
import type { NotificationPriority } from './notificationCategories'
import { NOTIFICATION_CATEGORIES } from './notificationCategories'
import type { NotificationFilterConfig } from './notificationFilter'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuietHours {
  enabled: boolean
  /** 0-23, hour when quiet starts. */
  startHour: number
  /** 0-23, hour when quiet ends. */
  endHour: number
}

export interface NotificationPreferences {
  /** Per-category enable/disable override. */
  enabledCategories: Partial<Record<NotificationCategory, boolean>>
  /** Minimum priority to show. */
  minimumPriority: NotificationPriority
  /** Collapse similar notifications. */
  collapseGroups: boolean
  /** Quiet hours config. */
  quietHours: QuietHours
  /** Sound enabled per category. */
  soundsEnabled: Partial<Record<NotificationCategory, boolean>>
  /** Browser push notifications enabled per category. */
  pushEnabled: Partial<Record<NotificationCategory, boolean>>
  /** Deduplication window in ms. */
  dedupWindowMs: number
  /** Maximum age in ms before auto-clearing. 0 = no limit. */
  maxAgeMs: number
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export function defaultNotificationPreferences(): NotificationPreferences {
  const enabledCategories: Partial<Record<NotificationCategory, boolean>> = {}
  const soundsEnabled: Partial<Record<NotificationCategory, boolean>> = {}
  const pushEnabled: Partial<Record<NotificationCategory, boolean>> = {}

  for (const cat of Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[]) {
    enabledCategories[cat] = true
    soundsEnabled[cat] = cat === 'transaction' || cat === 'balance' || cat === 'security'
    pushEnabled[cat] = cat === 'security' || cat === 'balance'
  }

  return {
    enabledCategories,
    minimumPriority: 'low',
    collapseGroups: true,
    quietHours: {
      enabled: false,
      startHour: 22,
      endHour: 8,
    },
    soundsEnabled,
    pushEnabled,
    dedupWindowMs: 60_000,
    maxAgeMs: 0,
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const NOTIFICATION_PREFS_KEY = 'notification-preferences-v1'

export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await getStoredValue(NOTIFICATION_PREFS_KEY) as Partial<NotificationPreferences> | null
    const defaults = defaultNotificationPreferences()
    if (!stored) return defaults

    return {
      ...defaults,
      ...stored,
      enabledCategories: { ...defaults.enabledCategories, ...(stored.enabledCategories || {}) },
      soundsEnabled: { ...defaults.soundsEnabled, ...(stored.soundsEnabled || {}) },
      pushEnabled: { ...defaults.pushEnabled, ...(stored.pushEnabled || {}) },
    }
  } catch {
    return defaultNotificationPreferences()
  }
}

export async function saveNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const current = await loadNotificationPreferences()
  const next: NotificationPreferences = {
    ...current,
    ...prefs,
    enabledCategories: { ...current.enabledCategories, ...(prefs.enabledCategories || {}) },
    soundsEnabled: { ...current.soundsEnabled, ...(prefs.soundsEnabled || {}) },
    pushEnabled: { ...current.pushEnabled, ...(prefs.pushEnabled || {}) },
  }
  await setStoredValue(NOTIFICATION_PREFS_KEY, next)
  return next
}

export async function resetNotificationPreferences(): Promise<NotificationPreferences> {
  const defaults = defaultNotificationPreferences()
  await setStoredValue(NOTIFICATION_PREFS_KEY, defaults)
  return defaults
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive a NotificationFilterConfig from user notification preferences.
 */
export function preferencesToFilterConfig(prefs: NotificationPreferences): NotificationFilterConfig {
  return {
    enabledCategories: { ...prefs.enabledCategories },
    minimumPriority: prefs.minimumPriority,
    collapseGroups: prefs.collapseGroups,
    maxAgeMs: prefs.maxAgeMs,
  }
}

/**
 * Check if quiet hours are currently active.
 */
export function isInQuietHours(quietHours: QuietHours): boolean {
  if (!quietHours.enabled) return false
  const now = new Date().getHours()
  if (quietHours.startHour <= quietHours.endHour) {
    return now >= quietHours.startHour && now < quietHours.endHour
  }
  return now >= quietHours.startHour || now < quietHours.endHour
}
