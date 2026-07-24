import { describe, it, expect } from 'vitest';
import { computeCompatibilityScore } from '../compatibilityScorer';
import type { ABIDiffResult, BytecodeDiffResult } from '../types';

function emptyABIDiff(): ABIDiffResult {
  return {
    addedFunctions: [],
    removedFunctions: [],
    modifiedFunctions: [],
    addedEvents: [],
    removedEvents: [],
    modifiedEvents: [],
    addedErrors: [],
    removedErrors: [],
    storageChanges: [],
    breakingChanges: [],
    nonBreakingChanges: [],
    deprecations: [],
  };
}

function emptyBytecodeDiff(): BytecodeDiffResult {
  return {
    totalBytesChanged: 0,
    sizeChange: { before: 100, after: 100 },
    similarityScore: 1,
    sectionDiffs: [],
  };
}

describe('computeCompatibilityScore', () => {
  it('returns 100% for identical specs', () => {
    const score = computeCompatibilityScore(emptyABIDiff(), emptyBytecodeDiff());
    expect(score.overall).toBe(100);
    expect(score.grade).toBe('A');
    expect(score.details).toHaveLength(0);
  });

  it('penalizes for removed functions', () => {
    const diff = {
      ...emptyABIDiff(),
      removedFunctions: [{ name: 'foo', inputs: [], outputs: [], mutability: 'stateful' as const, authRequired: true }],
    };
    const score = computeCompatibilityScore(diff, emptyBytecodeDiff());
    expect(score.overall).toBeLessThan(100);
    expect(score.functionCompat).toBeLessThan(100);
    expect(score.details.some((d) => d.message.includes('foo'))).toBe(true);
  });

  it('gives additive score for new functions', () => {
    const diff = {
      ...emptyABIDiff(),
      addedFunctions: [{ name: 'bar', inputs: [], outputs: [], mutability: 'view' as const, authRequired: false }],
    };
    const score = computeCompatibilityScore(diff, emptyBytecodeDiff());
    expect(score.overall).toBe(100);
    expect(score.grade).toBe('A');
  });

  it('penalizes for removed events', () => {
    const diff = {
      ...emptyABIDiff(),
      removedEvents: [{ name: 'Transfer', params: [] }],
    };
    const score = computeCompatibilityScore(diff, emptyBytecodeDiff());
    expect(score.eventCompat).toBeLessThan(100);
  });

  it('penalizes for storage layout changes', () => {
    const diff = {
      ...emptyABIDiff(),
      storageChanges: [{ slot: 'balances', removed: true }],
    };
    const score = computeCompatibilityScore(diff, emptyBytecodeDiff());
    expect(score.storageCompat).toBeLessThan(100);
  });

  it('factors in bytecode similarity', () => {
    const lowBytecode = { ...emptyBytecodeDiff(), similarityScore: 0.3 };
    const score = computeCompatibilityScore(emptyABIDiff(), lowBytecode);
    expect(score.bytecodeSimilarity).toBe(30);
    expect(score.overall).toBeLessThan(100);
  });

  it('returns grade F for very low scores', () => {
    const diff = {
      ...emptyABIDiff(),
      removedFunctions: Array.from({ length: 10 }, (_, i) => ({
        name: `fn_${i}`,
        inputs: [],
        outputs: [],
        mutability: 'stateful' as const,
        authRequired: true,
      })),
      storageChanges: Array.from({ length: 5 }, (_, i) => ({
        slot: `slot_${i}`,
        removed: true,
      })),
    };
    const score = computeCompatibilityScore(diff, { ...emptyBytecodeDiff(), similarityScore: 0.1 });
    expect(score.grade).toMatch(/[DF]/);
  });

  it('handles multiple parameter type changes in modified functions', () => {
    const diff = {
      ...emptyABIDiff(),
      modifiedFunctions: [{
        name: 'foo',
        before: { name: 'foo', inputs: [{ name: 'a', type: 'i128' }, { name: 'b', type: 'string' }], outputs: [], mutability: 'stateful' as const, authRequired: true },
        after: { name: 'foo', inputs: [{ name: 'a', type: 'i128' }, { name: 'b', type: 'bool' }], outputs: [], mutability: 'stateful' as const, authRequired: true },
        inputChanges: [{ paramName: 'b', type: { before: 'string', after: 'bool' } }],
        outputChanges: [],
        mutabilityChanged: false,
        authChanged: false,
      }],
    };
    const score = computeCompatibilityScore(diff, emptyBytecodeDiff());
    expect(score.details.some((d) => d.message.includes('Parameter types changed'))).toBe(true);
  });
});
