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
import {
  getScopedValue,
  setScopedValue,
  validateScope,
  createScope,
  StorageScope,
  isSensitiveKey,
  validatePreferenceValue,
  ScopedStorageError,
  safeScopedOperation,
} from './scopedStorage'

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

/**
 * Load notification preferences with network/account scope for sensitive keys
 * @param scope - The storage scope (network and optional account ID)
 * @returns Notification preferences with sensitive keys scoped
 */
export async function loadScopedNotificationPreferences(scope: StorageScope): Promise<NotificationPreferences> {
  const validation = validateScope(scope)
  if (!validation.valid) {
    throw new ScopedStorageError(
      `Invalid scope: ${validation.error}`,
      'INVALID_SCOPE'
    )
  }

  return safeScopedOperation(
    async () => {
      // Load global notification preferences first
      const globalPrefs = await loadNotificationPreferences()
      
      // Load scoped sensitive keys (pushEnabled and soundsEnabled are sensitive)
      const scopedPushEnabled = await getScopedValue(
        'notificationPreferences.pushEnabled',
        scope,
        getStoredValue
      )
      
      const scopedSoundsEnabled = await getScopedValue(
        'notificationPreferences.soundsEnabled',
        scope,
        getStoredValue
      )
      
      // Merge scoped preferences with global preferences
      return {
        ...globalPrefs,
        pushEnabled: scopedPushEnabled !== null ? scopedPushEnabled : globalPrefs.pushEnabled,
        soundsEnabled: scopedSoundsEnabled !== null ? scopedSoundsEnabled : globalPrefs.soundsEnabled,
      }
    },
    async () => {
      // Fallback to global preferences
      console.warn('Scoped notification preferences failed, using global')
      return loadNotificationPreferences()
    },
    'loadScopedNotificationPreferences'
  )
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

/**
 * Save notification preferences with network/account scope for sensitive keys
 * @param prefs - Preferences to save
 * @param scope - The storage scope (network and optional account ID)
 * @returns Notification preferences with sensitive keys scoped
 */
export async function saveScopedNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
  scope: StorageScope
): Promise<NotificationPreferences> {
  const validation = validateScope(scope)
  if (!validation.valid) {
    throw new ScopedStorageError(
      `Invalid scope: ${validation.error}`,
      'INVALID_SCOPE'
    )
  }

  return safeScopedOperation(
    async () => {
      // Separate sensitive and non-sensitive preferences
      const nonSensitivePrefs: Partial<NotificationPreferences> = {}
      const sensitivePrefs: Record<string, any> = {}
      
      // pushEnabled and soundsEnabled are sensitive
      if (prefs.pushEnabled !== undefined) {
        sensitivePrefs['notificationPreferences.pushEnabled'] = prefs.pushEnabled
      }
      
      if (prefs.soundsEnabled !== undefined) {
        sensitivePrefs['notificationPreferences.soundsEnabled'] = prefs.soundsEnabled
      }
      
      // Copy all other non-sensitive preferences
      for (const [key, value] of Object.entries(prefs)) {
        if (key === 'pushEnabled' || key === 'soundsEnabled') continue // Already handled
        (nonSensitivePrefs as any)[key] = value
      }
      
      // Save non-sensitive preferences globally
      let next = await loadNotificationPreferences()
      if (Object.keys(nonSensitivePrefs).length > 0) {
        next = await saveNotificationPreferences(nonSensitivePrefs)
      }
      
      // Save sensitive preferences with scoping
      for (const [key, value] of Object.entries(sensitivePrefs)) {
        await setScopedValue(key, value, scope, setStoredValue, { required: true })
      }
      
      // Return the merged scoped preferences
      return await loadScopedNotificationPreferences(scope)
    },
    async () => {
      // Fallback to global save
      console.warn('Scoped notification preferences failed, using global')
      return saveNotificationPreferences(prefs)
    },
    'saveScopedNotificationPreferences'
  )
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
