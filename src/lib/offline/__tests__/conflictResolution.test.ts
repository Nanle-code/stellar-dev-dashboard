import { describe, expect, it } from 'vitest';
import {
  deepEqual,
  detectConflict,
  overlappingFields,
  resolveConflict,
  type Conflict,
  type VersionedRecord,
} from '../conflictResolution';

interface Note {
  name: string;
  note: string;
}

function local(): VersionedRecord<Note> {
  return { id: 'rec-1', version: 3, baseVersion: 2, updatedAt: 200, data: { name: 'local', note: 'same' } };
}

function remote(): VersionedRecord<Note> {
  return { id: 'rec-1', version: 4, updatedAt: 150, data: { name: 'remote', note: 'same' } };
}

describe('detectConflict', () => {
  it('detects a conflict when remote advanced past the local base', () => {
    const conflict = detectConflict(local(), remote());
    expect(conflict).not.toBeNull();
    expect(conflict!.overlappingFields).toEqual(['name']);
  });

  it('fast-forwards when the remote version equals the local base', () => {
    const localRecord = { ...local(), baseVersion: 4 };
    expect(detectConflict(localRecord, remote())).toBeNull();
  });

  it('ignores identical data even when versions differ', () => {
    const localRecord = { ...local(), data: { name: 'remote', note: 'same' } };
    expect(detectConflict(localRecord, remote())).toBeNull();
  });

  it('returns null for mismatched ids', () => {
    expect(detectConflict(local(), { ...remote(), id: 'rec-2' })).toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(detectConflict(null, remote())).toBeNull();
    expect(detectConflict(local(), undefined)).toBeNull();
    expect(detectConflict({ ...local(), version: NaN }, remote())).toBeNull();
  });
});

describe('deepEqual / overlappingFields', () => {
  it('compares nested structures', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });

  it('lists only diverging fields', () => {
    expect(overlappingFields(local(), remote())).toEqual(['name']);
  });
});

describe('resolveConflict', () => {
  const conflict: Conflict<Note> = detectConflict(local(), remote())!;

  it('local-wins keeps local data and bumps the version', () => {
    const { merged, requiresUser } = resolveConflict(conflict, 'local-wins');
    expect(merged.data).toEqual({ name: 'local', note: 'same' });
    expect(merged.version).toBe(5);
    expect(merged.baseVersion).toBe(4);
    expect(requiresUser).toBe(false);
  });

  it('remote-wins keeps remote data', () => {
    expect(resolveConflict(conflict, 'remote-wins').merged.data).toEqual({ name: 'remote', note: 'same' });
  });

  it('last-write-wins picks the newer timestamp', () => {
    expect(resolveConflict(conflict, 'last-write-wins').merged.data.name).toBe('local');
    const olderLocal = { ...conflict, local: { ...conflict.local, updatedAt: 100 } };
    expect(resolveConflict(olderLocal, 'last-write-wins').merged.data.name).toBe('remote');
  });

  it('field-merge unions disjoint fields and respects a custom resolver', () => {
    const merged = resolveConflict(conflict, 'field-merge').merged;
    expect(merged.data).toEqual({ name: 'local', note: 'same' });

    const custom = resolveConflict(conflict, 'field-merge', {
      resolver: (field) => (field === 'name' ? 'resolved' : undefined),
    }).merged;
    expect(custom.data.name).toBe('resolved');
  });

  it('manual requires user input', () => {
    const resolution = resolveConflict(conflict, 'manual');
    expect(resolution.requiresUser).toBe(true);
    expect(resolution.strategy).toBe('manual');
  });

  it('falls back to manual for an unknown strategy', () => {
    const resolution = resolveConflict(conflict, 'nonsense' as never);
    expect(resolution.strategy).toBe('manual');
    expect(resolution.requiresUser).toBe(true);
  });
});
