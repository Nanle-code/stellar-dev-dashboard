import { describe, it, expect } from 'vitest';
import { generateMigrationRecommendation } from '../migrationRecommender';
import type { ABIDiffResult, ImpactPrediction, CompatibilityScore } from '../types';

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

function lowImpact(): ImpactPrediction {
  return {
    overallRisk: 'low',
    confidenceScore: 0.8,
    affectedUserEstimate: 0,
    affectedIntegrationsEstimate: 0,
    estimatedMigrationComplexity: 'minimal',
    estimatedMigrationTimeHours: 0.5,
    featuresAffected: [],
    dataMigrationRequired: false,
    storageMigrationRequired: false,
    rollbackFeasible: true,
  };
}

function defaultCompat(): CompatibilityScore {
  return { overall: 100, functionCompat: 100, eventCompat: 100, storageCompat: 100, errorCompat: 100, bytecodeSimilarity: 100, grade: 'A', details: [] };
}

describe('generateMigrationRecommendation', () => {
  it('generates minimal recommendation for no changes', () => {
    const rec = generateMigrationRecommendation(emptyABIDiff(), lowImpact(), defaultCompat());
    expect(rec.migrationSteps.length).toBeGreaterThan(0);
    expect(rec.preMigrationChecks.length).toBeGreaterThan(0);
    expect(rec.postMigrationValidation.length).toBeGreaterThan(0);
    expect(rec.rollbackPlan).toContain('Rollback plan');
    expect(rec.estimatedTotalTimeMinutes).toBeGreaterThan(0);
  });

  it('adds storage migration step when storage is affected', () => {
    const impact: ImpactPrediction = { ...lowImpact(), storageMigrationRequired: true };
    const diff = { ...emptyABIDiff(), storageChanges: [{ slot: 'x', removed: true }] };
    const rec = generateMigrationRecommendation(diff, impact, defaultCompat());
    expect(rec.migrationSteps.some((s) => s.title.toLowerCase().includes('storage'))).toBe(true);
  });

  it('adds steps for removed functions', () => {
    const impact: ImpactPrediction = { ...lowImpact(), overallRisk: 'medium' };
    const diff = {
      ...emptyABIDiff(),
      removedFunctions: [{ name: 'foo', inputs: [], outputs: [], mutability: 'stateful' as const, authRequired: true }],
    };
    const rec = generateMigrationRecommendation(diff, impact, defaultCompat());
    expect(rec.migrationSteps.some((s) => s.title.includes('foo'))).toBe(true);
  });

  it('generates infeasible rollback plan for high-risk storage changes', () => {
    const impact: ImpactPrediction = { ...lowImpact(), rollbackFeasible: false };
    const rec = generateMigrationRecommendation(emptyABIDiff(), impact, defaultCompat());
    expect(rec.rollbackPlan).toContain('NOT feasible');
  });

  it('includes risk mitigation tips for critical risk', () => {
    const impact: ImpactPrediction = {
      ...lowImpact(),
      overallRisk: 'critical',
      estimatedMigrationComplexity: 'extensive',
    };
    const rec = generateMigrationRecommendation(emptyABIDiff(), impact, defaultCompat());
    expect(rec.riskMitigationTips.length).toBeGreaterThan(2);
    expect(rec.riskMitigationTips.some((t) => t.includes('phased'))).toBe(true);
  });

  it('adds event indexer step when events are removed', () => {
    const impact: ImpactPrediction = { ...lowImpact(), featuresAffected: ['Event indexers'] };
    const diff = {
      ...emptyABIDiff(),
      removedEvents: [{ name: 'Transfer', params: [] }],
    };
    const rec = generateMigrationRecommendation(diff, impact, defaultCompat());
    expect(rec.migrationSteps.some((s) => s.title.toLowerCase().includes('event'))).toBe(true);
  });

  it('includes auth update steps for auth changes', () => {
    const diff = {
      ...emptyABIDiff(),
      modifiedFunctions: [{
        name: 'deposit',
        before: { name: 'deposit', inputs: [], outputs: [], mutability: 'stateful' as const, authRequired: false },
        after: { name: 'deposit', inputs: [], outputs: [], mutability: 'stateful' as const, authRequired: true },
        inputChanges: [],
        outputChanges: [],
        mutabilityChanged: false,
        authChanged: true,
      }],
    };
    const rec = generateMigrationRecommendation(diff, lowImpact(), defaultCompat());
    expect(rec.migrationSteps.some((s) => s.title.toLowerCase().includes('auth') && s.title.includes('deposit'))).toBe(true);
  });
});
