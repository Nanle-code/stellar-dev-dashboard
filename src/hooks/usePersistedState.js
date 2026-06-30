import { useState, useEffect, useCallback, useRef } from 'react'
import { getStoredValue, setStoredValue } from '../lib/storage'
import { onStateChange, syncState, resolveStateConflict } from '../utils/stateSync'

/**
 * Custom hook for state that persists in IndexedDB with cross-tab sync (#105).
 *
 * Features:
 *  - Hydrates from IndexedDB on mount
 *  - Writes to IndexedDB and broadcasts on update
 *  - Subscribes to cross-tab changes and merges via last-writer-wins
 *  - Falls back to in-memory state if IndexedDB is unavailable
 *
 * @param {string} key          Storage key
 * @param {*}      defaultValue Default value when no persisted value exists
 * @returns {[value, update, loaded]}
 *   - value   — current state value
 *   - update  — setter (accepts value or updater function)
 *   - loaded  — true once the initial IDB hydration is complete
 */
export function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(defaultValue)
  const [loaded, setLoaded] = useState(false)
  const valueRef = useRef(defaultValue)

  // Keep a ref in sync so the cross-tab handler always sees the latest value
  useEffect(() => { valueRef.current = value }, [value])

  // Hydrate from IndexedDB on mount
  useEffect(() => {
    let cancelled = false
    getStoredValue(key).then((stored) => {
      if (!cancelled && stored !== null) {
        setValue(stored)
        valueRef.current = stored
      }
      if (!cancelled) setLoaded(true)
    }).catch(() => {
      if (!cancelled) setLoaded(true)
    })
    return () => { cancelled = true }
  }, [key])

  // Subscribe to cross-tab state changes (#105)
  useEffect(() => {
    const unsubscribe = onStateChange((changedKey, incomingValue) => {
      if (changedKey !== key) return
      setValue((current) => {
        const merged = resolveStateConflict(current, incomingValue)
        valueRef.current = merged
        return merged
      })
    })
    return unsubscribe
  }, [key])

  const update = useCallback((newValue) => {
    setValue((prev) => {
      const resolved = typeof newValue === 'function' ? newValue(prev) : newValue
      valueRef.current = resolved
      // Persist and broadcast to other tabs
      syncState(key, resolved).catch(() => {
        // Fallback: at least persist locally
        setStoredValue(key, resolved).catch(() => {})
      })
      return resolved
    })
  }, [key])

  return [value, update, loaded]
}
