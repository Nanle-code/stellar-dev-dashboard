/**
 * Offline conflict resolution (D-009 / #412)
 * ==========================================
 * Offline-first queues replay local writes when connectivity returns. If the
 * server-side record changed while we were offline, replaying blindly would
 * clobber the remote edit. This module provides:
 *
 *   - version-stamped records (`version` + `baseVersion`);
 *   - conflict detection between a local edit and the latest remote record;
 *   - merge strategies: local-wins, remote-wins, last-write-wins, field-merge
 *     and a `manual` strategy that defers to the user;
 *   - a per-field resolver hook for domain-specific merges.
 *
 * Everything is pure and dependency-free, and invalid input is handled without
 * throwing so the sync loop can always make progress.
 */

export type MergeStrategy = 'local-wins' | 'remote-wins' | 'last-write-wins' | 'field-merge' | 'manual';

export interface VersionedRecord<T = Record<string, unknown>> {
  id: string;
  /** Current version stamp of the record. */
  version: number;
  /** Version this local copy was derived from (used for conflict detection). */
  baseVersion?: number;
  /** Epoch ms of the last write. */
  updatedAt: number;
  /** Device/user that produced the write (for diagnostics). */
  updatedBy?: string;
  data: T;
}

export interface Conflict<T = Record<string, unknown>> {
  id: string;
  local: VersionedRecord<T>;
  remote: VersionedRecord<T>;
  /** Fields that differ between the two records. */
  overlappingFields: string[];
  detectedAt: number;
}

export interface Resolution<T = Record<string, unknown>> {
  strategy: MergeStrategy;
  merged: VersionedRecord<T>;
  /** True when the caller must ask the user to choose. */
  requiresUser: boolean;
  conflict: Conflict<T>;
}

export type FieldResolver<T> = (
  field: string,
  localValue: unknown,
  remoteValue: unknown,
  local: VersionedRecord<T>,
  remote: VersionedRecord<T>
) => unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isVersionedRecord(value: unknown): value is VersionedRecord {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (typeof value.version !== 'number' || !Number.isFinite(value.version)) return false;
  if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return false;
  return true;
}

/** Structural equality with a depth guard; unknown values are compared by identity. */
export function deepEqual(a: unknown, b: unknown, depth = 0): boolean {
  if (a === b) return true;
  if (depth > 12) return false;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index], depth + 1));
  }

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], depth + 1)
  );
}

/** Fields whose values differ between two records. */
export function overlappingFields<T>(local: VersionedRecord<T>, remote: VersionedRecord<T>): string[] {
  const localData = isRecord(local.data) ? (local.data as Record<string, unknown>) : {};
  const remoteData = isRecord(remote.data) ? (remote.data as Record<string, unknown>) : {};
  const keys = new Set([...Object.keys(localData), ...Object.keys(remoteData)]);
  return [...keys].filter((key) => !deepEqual(localData[key], remoteData[key])).sort();
}

/**
 * Detect a conflict between a pending local edit and the latest remote record.
 *
 * Returns `null` when:
 *  - either record is invalid / missing;
 *  - the ids differ;
 *  - the remote version equals the local `baseVersion` (fast-forward), or
 *  - the data is structurally identical.
 */
export function detectConflict<T = Record<string, unknown>>(
  local: VersionedRecord<T> | null | undefined,
  remote: VersionedRecord<T> | null | undefined
): Conflict<T> | null {
  if (!isVersionedRecord(local) || !isVersionedRecord(remote)) return null;
  if (local.id !== remote.id) return null;
  if (!isRecord(local.data) || !isRecord(remote.data)) return null;
  if (typeof local.baseVersion === 'number' && local.baseVersion === remote.version) return null;
  if (deepEqual(local.data, remote.data)) return null;

  return {
    id: local.id,
    local,
    remote,
    overlappingFields: overlappingFields(local, remote),
    detectedAt: Date.now(),
  };
}

function nextVersion<T>(conflict: Conflict<T>): number {
  return Math.max(conflict.local.version, conflict.remote.version) + 1;
}

function withMeta<T>(record: VersionedRecord<T>, version: number, baseVersion: number): VersionedRecord<T> {
  return { ...record, version, baseVersion };
}

/**
 * Resolve a conflict using the requested strategy.
 *
 * Unknown strategies fall back to `manual` so a resolution model is always
 * returned and the user is asked to intervene.
 */
export function resolveConflict<T = Record<string, unknown>>(
  conflict: Conflict<T>,
  strategy: MergeStrategy = 'manual',
  options: { resolver?: FieldResolver<T>; now?: number } = {}
): Resolution<T> {
  const version = nextVersion(conflict);
  const baseVersion = conflict.remote.version;

  switch (strategy) {
    case 'local-wins':
      return { strategy, merged: withMeta(conflict.local, version, baseVersion), requiresUser: false, conflict };

    case 'remote-wins':
      return { strategy, merged: withMeta(conflict.remote, version, baseVersion), requiresUser: false, conflict };

    case 'last-write-wins': {
      const winner =
        conflict.local.updatedAt >= conflict.remote.updatedAt ? conflict.local : conflict.remote;
      return { strategy, merged: withMeta(winner, version, baseVersion), requiresUser: false, conflict };
    }

    case 'field-merge': {
      const localData = conflict.local.data as Record<string, unknown>;
      const remoteData = conflict.remote.data as Record<string, unknown>;
      const mergedData: Record<string, unknown> = { ...remoteData };
      for (const key of Object.keys(localData)) {
        if (!conflict.overlappingFields.includes(key)) {
          mergedData[key] = localData[key];
          continue;
        }
        const resolved = options.resolver
          ? options.resolver(key, localData[key], remoteData[key], conflict.local, conflict.remote)
          : conflict.local.updatedAt >= conflict.remote.updatedAt
            ? localData[key]
            : remoteData[key];
        mergedData[key] = resolved;
      }
      const merged: VersionedRecord<T> = {
        ...conflict.local,
        data: mergedData as T,
        version,
        baseVersion,
      };
      return { strategy, merged, requiresUser: false, conflict };
    }

    case 'manual':
    default:
      return {
        strategy: 'manual',
        merged: withMeta(conflict.local, version, baseVersion),
        requiresUser: true,
        conflict,
      };
  }
}
