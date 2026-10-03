/**
 * usePreferences — Issue #142
 * React hook for reading and updating user preferences, with automatic undo tracking.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  loadPreferences,
  savePreferences,
  updatePreference,
  updatePreferenceWithUndo,
  savePreferencesWithUndo,
  resetPreferencesWithUndo,
  addSavedAddress,
  removeSavedAddress,
  resetPreferences,
  DEFAULT_PREFERENCES,
  type UserPreferences,
  type AddressEntry,
} from '../lib/userPreferences'
import { preferenceUndoManager } from '../lib/preferenceUndoManager'

export interface UsePreferencesReturn {
  preferences: UserPreferences
  loading: boolean
  update: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K], options?: { recordUndo?: boolean }) => Promise<UserPreferences>
  save: (partial: Partial<UserPreferences>, options?: { recordUndo?: boolean }) => Promise<UserPreferences>
  addAddress: (entry: Omit<AddressEntry, 'addedAt'>) => Promise<void>
  removeAddress: (address: string) => Promise<void>
  reset: (options?: { recordUndo?: boolean }) => Promise<void>
  reload: () => Promise<UserPreferences>
}

export function usePreferences(): UsePreferencesReturn {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const prefs = await loadPreferences()
    setPreferences(prefs)
    return prefs
  }, [])

  useEffect(() => {
    reload().then(() => setLoading(false))
    const unsubscribe = preferenceUndoManager.subscribe(() => {
      reload()
    })
    return unsubscribe
  }, [reload])

  const update = useCallback(async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
    options: { recordUndo?: boolean } = { recordUndo: true }
  ) => {
    let next: UserPreferences
    if (options.recordUndo !== false) {
      const res = await updatePreferenceWithUndo(key, value)
      next = res.next
    } else {
      next = await updatePreference(key, value)
    }
    setPreferences(next)
    return next
  }, [])

  const save = useCallback(async (
    partial: Partial<UserPreferences>,
    options: { recordUndo?: boolean } = { recordUndo: true }
  ) => {
    let next: UserPreferences
    if (options.recordUndo !== false) {
      const res = await savePreferencesWithUndo(partial)
      next = res.next
    } else {
      next = await savePreferences(partial)
    }
    setPreferences(next)
    return next
  }, [])

  const addAddress = useCallback(async (entry: Omit<AddressEntry, 'addedAt'>) => {
    const next = await addSavedAddress(entry)
    setPreferences(next)
  }, [])

  const removeAddress = useCallback(async (address: string) => {
    const next = await removeSavedAddress(address)
    setPreferences(next)
  }, [])

  const reset = useCallback(async (options: { recordUndo?: boolean } = { recordUndo: true }) => {
    let next: UserPreferences
    if (options.recordUndo !== false) {
      const res = await resetPreferencesWithUndo()
      next = res.next
    } else {
      next = await resetPreferences()
    }
    setPreferences(next)
  }, [])

  return {
    preferences,
    loading,
    update,
    save,
    addAddress,
    removeAddress,
    reset,
    reload,
  }
}
