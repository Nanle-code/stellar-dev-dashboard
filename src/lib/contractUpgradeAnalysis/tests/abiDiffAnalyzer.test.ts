import { describe, it, expect } from 'vitest';
import { analyzeABIDiff } from '../abiDiffAnalyzer';
import type { ContractSpec } from '../types';

function baseSpec(): ContractSpec {
  return {
    specVersion: '1.0.0',
    contractId: 'C_TEST',
    functions: [],
    events: [],
    errors: [],
    storageSlots: [],
    metadata: { name: 'Test', version: '1.0.0' },
  };
}

describe('analyzeABIDiff', () => {
  it('returns empty diffs for identical specs', () => {
    const spec: ContractSpec = {
      ...baseSpec(),
      functions: [
        { name: 'transfer', inputs: [], outputs: [{ name: 'r', type: 'bool' }], mutability: 'stateful', authRequired: true },
      ],
      events: [{ name: 'Transfer', params: [{ name: 'amt', type: 'i128' }] }],
      errors: [{ name: 'Err', code: 1 }],
      storageSlots: [{ name: 'bal', type: 'i128', persistent: true }],
    };

    const result = analyzeABIDiff(spec, { ...spec, metadata: { name: 'Test', version: '2.0.0' } });
    expect(result.addedFunctions).toHaveLength(0);
    expect(result.removedFunctions).toHaveLength(0);
    expect(result.modifiedFunctions).toHaveLength(0);
    expect(result.breakingChanges).toHaveLength(0);
  });

  it('detects added functions', () => {
    const before = { ...baseSpec(), functions: [{ name: 'foo', inputs: [], outputs: [], mutability: 'view' as const, authRequired: false }] };
    const after = { ...baseSpec(), functions: [{ name: 'foo', inputs: [], outputs: [], mutability: 'view' as const, authRequired: false }, { name: 'bar', inputs: [], outputs: [], mutability: 'view' as const, authRequired: false }] };

    const result = analyzeABIDiff(before, after);
    expect(result.addedFunctions).toHaveLength(1);
    expect(result.addedFunctions[0].name).toBe('bar');
    expect(result.nonBreakingChanges).toHaveLength(1);
    expect(result.nonBreakingChanges[0].category).toBe('function-added');
  });

  it('detects removed functions as breaking', () => {
    const before = { ...baseSpec(), functions: [{ name: 'foo', inputs: [], outputs: [], mutability: 'stateful' as const, authRequired: true }] };
    const after = { ...baseSpec(), functions: [] };

    const result = analyzeABIDiff(before, after);
    expect(result.removedFunctions).toHaveLength(1);
    expect(result.removedFunctions[0].name).toBe('foo');
    expect(result.breakingChanges).toHaveLength(1);
    expect(result.breakingChanges[0].category).toBe('function-removed');
  });

  it('detects modified function signatures', () => {
    const before = { ...baseSpec(), functions: [{ name: 'foo', inputs: [{ name: 'x', type: 'i128' }], outputs: [], mutability: 'stateful' as const, authRequired: false }] };
    const after = { ...baseSpec(), functions: [{ name: 'foo', inputs: [{ name: 'x', type: 'string' }], outputs: [], mutability: 'stateful' as const, authRequired: false }] };

    const result = analyzeABIDiff(before, after);
    expect(result.modifiedFunctions).toHaveLength(1);
    expect(result.modifiedFunctions[0].inputChanges).toHaveLength(1);
    expect(result.modifiedFunctions[0].inputChanges[0].type).toEqual({ before: 'i128', after: 'string' });
    expect(result.breakingChanges.some((c) => c.category === 'parameter-type-changed')).toBe(true);
  });

  it('detects auth changes as breaking', () => {
    const before = { ...baseSpec(), functions: [{ name: 'foo', inputs: [], outputs: [], mutability: 'stateful' as const, authRequired: false }] };
    const after = { ...baseSpec(), functions: [{ name: 'foo', inputs: [], outputs: [], mutability: 'stateful' as const, authRequired: true }] };

    const result = analyzeABIDiff(before, after);
    expect(result.breakingChanges.some((c) => c.affectedFunction === 'foo' && c.category === 'behavior-changed')).toBe(true);
  });

  it('detects mutability changes as deprecation', () => {
    const before = { ...baseSpec(), functions: [{ name: 'foo', inputs: [], outputs: [], mutability: 'view' as const, authRequired: false }] };
    const after = { ...baseSpec(), functions: [{ name: 'foo', inputs: [], outputs: [], mutability: 'stateful' as const, authRequired: false }] };

    const result = analyzeABIDiff(before, after);
    expect(result.deprecations.some((d) => d.category === 'behavior-changed')).toBe(true);
  });

  it('detects added and removed events', () => {
    const before = { ...baseSpec(), events: [{ name: 'E1', params: [] }] };
    const after = { ...baseSpec(), events: [{ name: 'E2', params: [] }] };

    const result = analyzeABIDiff(before, after);
    expect(result.removedEvents).toHaveLength(1);
    expect(result.removedEvents[0].name).toBe('E1');
    expect(result.addedEvents).toHaveLength(1);
    expect(result.addedEvents[0].name).toBe('E2');
    expect(result.breakingChanges.some((c) => c.category === 'event-removed')).toBe(true);
  });

  it('detects storage layout changes', () => {
    const before = { ...baseSpec(), storageSlots: [{ name: 'slot_a', type: 'i128', persistent: true }] };
    const after = { ...baseSpec(), storageSlots: [{ name: 'slot_b', type: 'i128', persistent: true }] };

    const result = analyzeABIDiff(before, after);
    expect(result.storageChanges).toHaveLength(2);
    expect(result.storageChanges.some((s) => s.removed)).toBe(true);
    expect(result.storageChanges.some((s) => s.added)).toBe(true);
    expect(result.breakingChanges.some((c) => c.category === 'storage-layout-changed')).toBe(true);
  });

  it('detects added and removed errors', () => {
    const before = { ...baseSpec(), errors: [{ name: 'E1', code: 1 }] };
    const after = { ...baseSpec(), errors: [{ name: 'E2', code: 2 }] };

    const result = analyzeABIDiff(before, after);
    expect(result.removedErrors).toHaveLength(1);
    expect(result.addedErrors).toHaveLength(1);
    expect(result.breakingChanges.some((c) => c.category === 'error-removed')).toBe(true);
  });

  it('handles parameter additions and removals', () => {
    const before = { ...baseSpec(), functions: [{ name: 'foo', inputs: [{ name: 'a', type: 'i128' }], outputs: [], mutability: 'stateful' as const, authRequired: false }] };
    const after = { ...baseSpec(), functions: [{ name: 'foo', inputs: [{ name: 'a', type: 'i128' }, { name: 'b', type: 'string' }], outputs: [], mutability: 'stateful' as const, authRequired: false }] };

    const result = analyzeABIDiff(before, after);
    expect(result.modifiedFunctions).toHaveLength(1);
    expect(result.modifiedFunctions[0].inputChanges.some((c) => c.added)).toBe(true);
  });
});
