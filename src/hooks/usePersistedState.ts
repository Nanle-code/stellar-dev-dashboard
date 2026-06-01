import { useState, useEffect, useCallback, useRef } from 'react';
import { getStoredValue, setStoredValue } from '../lib/storage';
import { onStateChange, syncState, resolveStateConflict } from '../utils/stateSync';

export type PersistedStateUpdater<T> = T | ((prev: T) => T);

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, (newValue: PersistedStateUpdater<T>) => void, boolean] {
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const valueRef = useRef<T>(defaultValue);

  useEffect(() => { valueRef.current = value; }, [value]);

  useEffect(() => {
    let cancelled = false;
    getStoredValue(key)
      .then((stored: T | null) => {
        if (!cancelled && stored !== null) {
          setValue(stored);
          valueRef.current = stored;
        }
        if (!cancelled) setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => {
    const unsubscribe = onStateChange((changedKey: string, incomingValue: T) => {
      if (changedKey !== key) return;
      setValue((current) => {
        const merged = resolveStateConflict(current, incomingValue);
        valueRef.current = merged;
        return merged;
      });
    });
    return unsubscribe;
  }, [key]);

  const update = useCallback(
    (newValue: PersistedStateUpdater<T>) => {
      setValue((prev) => {
        const resolved = typeof newValue === 'function' ? (newValue as (p: T) => T)(prev) : newValue;
        valueRef.current = resolved;
        syncState(key, resolved).catch(() => {
          setStoredValue(key, resolved).catch(() => {});
        });
        return resolved;
      });
    },
    [key],
  );

  return [value, update, loaded];
}
