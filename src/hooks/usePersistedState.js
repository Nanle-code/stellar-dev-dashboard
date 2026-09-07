import { useState, useEffect, useCallback, useRef } from 'react'
import { getStoredValue, setStoredValue } from '../lib/storage'
import {
  onStateChange,
  syncState,
  resolveStateConflict,
  getTabId,
  loadSyncedState,
} from '../utils/stateSync'

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

  // Track the version/metadata of the value currently held locally so incoming
  // cross-tab updates can be resolved deterministically (#751).
  const localVersionRef = useRef(0)
  const localTsRef = useRef(0)
  const localWriterRef = useRef('')

  // Keep a ref in sync so the cross-tab handler always sees the latest value
  useEffect(() => { valueRef.current = value }, [value])

  // Hydrate from IndexedDB on mount
  useEffect(() => {
    let cancelled = false
    getStoredValue(key).then((stored) => {
      if (!cancelled && stored !== null) {
        setValue(stored)
        valueRef.current = stored
        const synced = loadSyncedState(key)
        if (synced) {
          localVersionRef.current = synced.version
          localTsRef.current = synced.timestamp
          localWriterRef.current = synced.writerId
        }
      }
      if (!cancelled) setLoaded(true)
    }).catch(() => {
      if (!cancelled) setLoaded(true)
    })
    return () => { cancelled = true }
  }, [key])

  // Subscribe to cross-tab state changes (#105, deterministic since #751)
  useEffect(() => {
    const unsubscribe = onStateChange((changedKey, incomingValue, meta) => {
      if (changedKey !== key) return
      setValue((current) => {
        const localMeta = {
          version: localVersionRef.current,
          timestamp: localTsRef.current,
          writerId: localWriterRef.current,
        }
        const merged = resolveStateConflict(current, localMeta, incomingValue, meta)
        if (merged === incomingValue) {
          // Incoming won — adopt its metadata so the next local comparison is
          // made against the canonical, higher-version record.
          localVersionRef.current = meta ? meta.version : localVersionRef.current
          localTsRef.current = meta ? meta.timestamp : localTsRef.current
          localWriterRef.current = meta ? meta.writerId : localWriterRef.current
          valueRef.current = incomingValue
        }
        return merged
      })
    })
    return unsubscribe
  }, [key])

  const update = useCallback((newValue) => {
    setValue((prev) => {
      const resolved = typeof newValue === 'function' ? newValue(prev) : newValue
      valueRef.current = resolved
      // Persist with deterministic, conflict-safe cross-tab sync (#751)
      syncState(key, resolved).then((version) => {
        localVersionRef.current = version
        localTsRef.current = Date.now()
        localWriterRef.current = getTabId()
      }).catch(() => {
        // Fallback: at least persist locally
        setStoredValue(key, resolved).catch(() => {})
      })
      return resolved
    })
  }, [key])

  return [value, update, loaded]
}
