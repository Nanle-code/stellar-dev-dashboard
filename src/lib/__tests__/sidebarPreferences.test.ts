import { describe, expect, it } from 'vitest';
import {
  loadCollapsedSidebarGroups,
  saveCollapsedSidebarGroups,
  SIDEBAR_GROUP_STATE_KEY,
} from '../sidebarPreferences';

describe('sidebar workspace preferences', () => {
  it('starts with Admin / Diagnostics collapsed and remembers later changes', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(loadCollapsedSidebarGroups(storage)).toEqual(['admin']);
    saveCollapsedSidebarGroups(['explore', 'admin'], storage);
    expect(values.get(SIDEBAR_GROUP_STATE_KEY)).toBe('["explore","admin"]');
    expect(loadCollapsedSidebarGroups(storage)).toEqual(['explore', 'admin']);
  });

  it('ignores malformed values and unknown workspace keys', () => {
    expect(loadCollapsedSidebarGroups({ getItem: () => '{broken' })).toEqual(['admin']);
    expect(loadCollapsedSidebarGroups({ getItem: () => '["missing","build"]' })).toEqual(['build']);
  });

  it('continues with defaults when browser storage is unavailable', () => {
    const unavailableStorage = {
      getItem: () => { throw new Error('storage blocked'); },
      setItem: () => { throw new Error('storage blocked'); },
    };

    expect(loadCollapsedSidebarGroups(unavailableStorage)).toEqual(['admin']);
    expect(() => saveCollapsedSidebarGroups(['build'], unavailableStorage)).not.toThrow();
  });
});
