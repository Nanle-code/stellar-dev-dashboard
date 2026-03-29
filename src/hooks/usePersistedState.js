import { useState, useEffect, useCallback } from 'react'
import { getStoredValue, setStoredValue } from '../lib/storage'

/**
 * Custom hook for state that persists in IndexedDB.
 * Falls back to in-memory state if IndexedDB is unavailable.
 */
export function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(defaultValue)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getStoredValue(key).then((stored) => {
      if (!cancelled && stored !== null) {
        setValue(stored)
      }
      if (!cancelled) setLoaded(true)
    })
    return () => { cancelled = true }
  }, [key])

  const update = useCallback((newValue) => {
    setValue((prev) => {
      const resolved = typeof newValue === 'function' ? newValue(prev) : newValue
      setStoredValue(key, resolved)
      return resolved
    })
  }, [key])

  return [value, update, loaded]
}
