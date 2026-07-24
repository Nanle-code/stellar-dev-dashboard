import { describe, it, expect } from 'vitest';
import { predictImpact } from '../impactPredictor';
import type { ABIDiffResult, BytecodeDiffResult, CompatibilityScore, ContractUpgradeHistory } from '../types';

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
  return { totalBytesChanged: 0, sizeChange: { before: 100, after: 100 }, similarityScore: 1, sectionDiffs: [] };
}

function perfectCompat(): CompatibilityScore {
  return {
    overall: 100,
    functionCompat: 100,
    eventCompat: 100,
    storageCompat: 100,
    errorCompat: 100,
    bytecodeSimilarity: 100,
    grade: 'A',
    details: [],
  };
}

describe('predictImpact', () => {
  it('returns low risk for no changes', () => {
    const result = predictImpact(emptyABIDiff(), emptyBytecodeDiff(), perfectCompat(), null);
    expect(result.overallRisk).toBe('low');
    expect(result.affectedUserEstimate).toBe(0);
    expect(result.estimatedMigrationComplexity).toBe('minimal');
    expect(result.rollbackFeasible).toBe(true);
  });

  it('increases risk with removed functions', () => {
    const diff = {
      ...emptyABIDiff(),
      removedFunctions: [{ name: 'foo', inputs: [], outputs: [], mutability: 'stateful' as const, authRequired: true }],
    };
    const compat: CompatibilityScore = { ...perfectCompat(), overall: 60, functionCompat: 0 };
    const result = predictImpact(diff, emptyBytecodeDiff(), compat, null);
    expect(result.overallRisk).not.toBe('low');
    expect(result.featuresAffected).toContain('Function callers');
    expect(result.estimatedMigrationTimeHours).toBeGreaterThan(0);
  });

  it('increases risk with removed events', () => {
    const diff = {
      ...emptyABIDiff(),
      removedEvents: [{ name: 'Transfer', params: [] }],
    };
    const compat: CompatibilityScore = { ...perfectCompat(), overall: 70, eventCompat: 0 };
    const result = predictImpact(diff, emptyBytecodeDiff(), compat, null);
    expect(result.featuresAffected).toContain('Event indexers');
    expect(result.dataMigrationRequired).toBe(true);
  });

  it('flags storage migration when storage changes exist', () => {
    const diff = {
      ...emptyABIDiff(),
      storageChanges: [{ slot: 'balances', removed: true }],
    };
    const compat: CompatibilityScore = { ...perfectCompat(), overall: 50, storageCompat: 0 };
    const result = predictImpact(diff, emptyBytecodeDiff(), compat, null);
    expect(result.storageMigrationRequired).toBe(true);
    expect(result.rollbackFeasible).toBe(false);
  });

  it('matches historical patterns when history is provided', () => {
    const history: ContractUpgradeHistory = {
      contractId: 'C_TEST',
      upgrades: [{
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        timestamp: Date.now() - 86400000,
        changes: [{ category: 'function-removed', severity: 'breaking', description: 'Removed foo' }],
        impact: { overallScore: 40, breakingChanges: 1, affectedIntegrations: 5, estimatedMigrationTime: '2h', riskLevel: 'medium' },
        rollbackAvailable: true,
      }],
    };
    const diff = {
      ...emptyABIDiff(),
      removedFunctions: [{ name: 'foo', inputs: [], outputs: [], mutability: 'stateful' as const, authRequired: true }],
    };
    const compat: CompatibilityScore = { ...perfectCompat(), overall: 55, functionCompat: 0 };
    const result = predictImpact(diff, emptyBytecodeDiff(), compat, history);
    expect(result.historicalPatternMatch).toBeDefined();
  });

  it('returns high confidence with upgrade history', () => {
    const history: ContractUpgradeHistory = {
      contractId: 'C_TEST',
      upgrades: Array.from({ length: 5 }, (_, i) => ({
        fromVersion: `${i}.0.0`,
        toVersion: `${i + 1}.0.0`,
        timestamp: Date.now() - (5 - i) * 86400000,
        changes: [{ category: 'function-added' as const, severity: 'additive' as const, description: 'Add' }],
        impact: { overallScore: 90, breakingChanges: 0, affectedIntegrations: 0, estimatedMigrationTime: '0h', riskLevel: 'low' as const },
        rollbackAvailable: true,
      })),
    };
    const result = predictImpact(emptyABIDiff(), emptyBytecodeDiff(), perfectCompat(), history);
    expect(result.confidenceScore).toBeGreaterThan(0.7);
  });

  it('flags critical risk for multiple severe changes', () => {
    const diff = {
      ...emptyABIDiff(),
      removedFunctions: Array.from({ length: 12 }, (_, i) => ({
        name: `fn_${i}`,
        inputs: [],
        outputs: [],
        mutability: 'stateful' as const,
        authRequired: true,
      })),
      storageChanges: [{ slot: 's1', removed: true }, { slot: 's2', removed: true }],
    };
    const compat: CompatibilityScore = {
      ...perfectCompat(),
      overall: 5,
      functionCompat: 0,
      storageCompat: 0,
    };
    const result = predictImpact(diff, emptyBytecodeDiff(), compat, null);
    expect(result.overallRisk).toBe('critical');
    expect(result.estimatedMigrationComplexity).toBe('extensive');
  });
});
