/**
 * usePreferences — Issue #142
 * React hook for reading and updating user preferences.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  loadPreferences,
  savePreferences,
  updatePreference,
  addSavedAddress,
  removeSavedAddress,
  resetPreferences,
  DEFAULT_PREFERENCES,
  type UserPreferences,
  type AddressEntry,
} from '../lib/userPreferences'

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPreferences().then((prefs) => {
      setPreferences(prefs)
      setLoading(false)
    })
  }, [])

  const update = useCallback(async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    const next = await updatePreference(key, value)
    setPreferences(next)
    return next
  }, [])

  const save = useCallback(async (partial: Partial<UserPreferences>) => {
    const next = await savePreferences(partial)
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

  const reset = useCallback(async () => {
    const next = await resetPreferences()
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
  }
}
