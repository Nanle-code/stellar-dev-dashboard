import { describe, it, expect } from 'vitest';
import { analyzeUpgrade } from '../upgradeAnalyzer';
import type { ContractSpec } from '../types';

function makeSpec(version: string, fnNames: string[]): ContractSpec {
  return {
    specVersion: '1.0.0',
    contractId: 'C_TEST',
    functions: fnNames.map((name) => ({
      name,
      inputs: [{ name: 'x', type: 'i128' }],
      outputs: [{ name: 'r', type: 'bool' }],
      mutability: 'stateful' as const,
      authRequired: false,
    })),
    events: [{ name: 'E1', params: [{ name: 'v', type: 'i128' }] }],
    errors: [{ name: 'Err', code: 1 }],
    storageSlots: [{ name: 'slot1', type: 'i128', persistent: true }],
    metadata: { name: 'Test', version },
  };
}

describe('analyzeUpgrade', () => {
  it('completes full analysis pipeline for identical specs', async () => {
    const spec = makeSpec('1.0.0', ['transfer', 'balance']);
    const before = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    const result = await analyzeUpgrade(spec, { ...spec, metadata: { ...spec.metadata, version: '1.1.0' } }, before, before);

    expect(result.contractId).toBe('C_TEST');
    expect(result.fromVersion).toBe('1.0.0');
    expect(result.toVersion).toBe('1.1.0');
    expect(result.abiDiff.breakingChanges).toHaveLength(0);
    expect(result.compatibilityScore.grade).toBe('A');
    expect(result.impactPrediction.overallRisk).toBe('low');
    expect(result.migrationRecommendation.migrationSteps.length).toBeGreaterThan(0);
    expect(result.analysisDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('detects breaking changes in full pipeline', async () => {
    const beforeSpec = makeSpec('1.0.0', ['transfer', 'balance', 'approve']);
    const afterSpec = makeSpec('2.0.0', ['transfer']);
    const before = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    const after = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01]);

    const result = await analyzeUpgrade(beforeSpec, afterSpec, before, after);

    expect(result.abiDiff.removedFunctions).toHaveLength(2);
    expect(result.abiDiff.breakingChanges.length).toBeGreaterThan(0);
    expect(result.compatibilityScore.overall).toBeLessThan(100);
    expect(result.impactPrediction.overallRisk).not.toBe('low');
    expect(result.migrationRecommendation.migrationSteps.some((s) => s.title.includes('balance') || s.title.includes('approve'))).toBe(true);
  });

  it('completes analysis within 30 seconds', async () => {
    const start = Date.now();
    const spec = makeSpec('1.0.0', ['f1', 'f2']);
    await analyzeUpgrade(spec, spec, new Uint8Array(32), new Uint8Array(32));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(30_000);
  });

  it('handles complex multi-change upgrade', async () => {
    const beforeSpec: ContractSpec = {
      specVersion: '1.0.0',
      contractId: 'C_COMPLEX',
      functions: [
        { name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amt', type: 'i128' }], outputs: [{ name: 'ok', type: 'bool' }], mutability: 'stateful', authRequired: true },
        { name: 'balance', inputs: [{ name: 'addr', type: 'address' }], outputs: [{ name: 'bal', type: 'i128' }], mutability: 'view', authRequired: false },
      ],
      events: [{ name: 'Transfer', params: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }] }],
      errors: [{ name: 'InsufficientFunds', code: 1 }],
      storageSlots: [{ name: 'balances', type: 'Map', persistent: true }],
      metadata: { name: 'Token', version: '1.0.0' },
    };

    const afterSpec: ContractSpec = {
      ...beforeSpec,
      metadata: { name: 'Token', version: '2.0.0' },
      functions: [
        { name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amt', type: 'i128' }], outputs: [{ name: 'ok', type: 'bool' }], mutability: 'stateful', authRequired: true },
        { name: 'transfer_batch', inputs: [{ name: 'to', type: 'address[]' }, { name: 'amt', type: 'i128[]' }], outputs: [{ name: 'ok', type: 'bool' }], mutability: 'stateful', authRequired: true },
      ],
      events: [{ name: 'Transfer', params: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'i128' }] }],
      storageSlots: [{ name: 'balances', type: 'Map', persistent: true }, { name: 'allowances', type: 'Map', persistent: true }],
    };

    const result = await analyzeUpgrade(beforeSpec, afterSpec, new Uint8Array(16), new Uint8Array(24));

    expect(result.abiDiff.removedFunctions.some((f) => f.name === 'balance')).toBe(true);
    expect(result.abiDiff.addedFunctions.some((f) => f.name === 'transfer_batch')).toBe(true);
    expect(result.abiDiff.storageChanges.length).toBeGreaterThan(0);
    expect(result.compatibilityScore.overall).toBeLessThan(100);
  });
});
