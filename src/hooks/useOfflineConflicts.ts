/**
 * useOfflineConflicts (#412)
 *
 * React state container for the offline sync loop's conflict queue. Exposes the
 * pending conflicts plus a `resolve(id, strategy)` action that returns the
 * merged record to persist. Pure logic lives in `lib/offline/conflictResolution`.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  resolveConflict,
  type Conflict,
  type FieldResolver,
  type MergeStrategy,
  type Resolution,
  type VersionedRecord,
} from '../lib/offline/conflictResolution';

export interface UseOfflineConflictsResult<T> {
  conflicts: Conflict<T>[];
  resolutions: Resolution<T>[];
  resolve: (id: string, strategy: MergeStrategy) => VersionedRecord<T> | null;
  dismiss: (id: string) => void;
  add: (conflict: Conflict<T>) => void;
}

export function useOfflineConflicts<T = Record<string, unknown>>(
  initial: Conflict<T>[] = [],
  resolver?: FieldResolver<T>
): UseOfflineConflictsResult<T> {
  const [conflicts, setConflicts] = useState<Conflict<T>[]>(Array.isArray(initial) ? initial : []);
  const [resolutions, setResolutions] = useState<Resolution<T>[]>([]);

  const resolve = useCallback(
    (id: string, strategy: MergeStrategy): VersionedRecord<T> | null => {
      const conflict = conflicts.find((c) => c.id === id);
      if (!conflict) return null;
      const resolution = resolveConflict(conflict, strategy, { resolver });
      setResolutions((current) => [...current, resolution]);
      setConflicts((current) => current.filter((c) => c.id !== id));
      return resolution.merged;
    },
    [conflicts, resolver]
  );

  const dismiss = useCallback((id: string) => {
    setConflicts((current) => current.filter((c) => c.id !== id));
  }, []);

  const add = useCallback((conflict: Conflict<T>) => {
    setConflicts((current) => (current.some((c) => c.id === conflict.id) ? current : [...current, conflict]));
  }, []);

  return useMemo(
    () => ({ conflicts, resolutions, resolve, dismiss, add }),
    [conflicts, resolutions, resolve, dismiss, add]
  );
}

export default useOfflineConflicts;
