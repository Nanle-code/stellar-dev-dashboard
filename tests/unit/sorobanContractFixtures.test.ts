import { describe, it, expect } from 'vitest';
import { rpc } from '@stellar/stellar-sdk';
import {
  createSorobanFixtureFactory,
  SorobanFixtureError,
  SOROBAN_FIXTURE_SCENARIOS,
} from '../__factories__/sorobanContractFixtures';
import {
  classifySimulationResponse,
  DEFAULT_SOROBAN_RESOURCE_LIMITS,
} from '../../src/lib/stellar/simulationOutcome';

describe('Soroban contract fixture factory (#896)', () => {
  describe('determinism', () => {
    it('produces identical output for identical options', () => {
      const a = createSorobanFixtureFactory({ seed: 'counter' });
      const b = createSorobanFixtureFactory({ seed: 'counter' });
      expect(a.contractId).toBe(b.contractId);
      expect(a.simulationSuccess()).toEqual(b.simulationSuccess());
      expect(a.authFailure()).toEqual(b.authFailure());
      expect(a.resourceExhaustion()).toEqual(b.resourceExhaustion());
    });

    it('derives distinct, valid addresses from different seeds', () => {
      const a = createSorobanFixtureFactory({ seed: 'alpha' });
      const b = createSorobanFixtureFactory({ seed: 'beta' });
      expect(a.contractId).not.toBe(b.contractId);
      expect(a.contractId).toMatch(/^C[A-Z2-7]{55}$/);
      expect(a.accountId).toMatch(/^G[A-Z2-7]{55}$/);
    });

    it('advances ledger and id per response and replays after reset()', () => {
      const f = createSorobanFixtureFactory({ seed: 'seq', startLedger: 500 });
      const first = f.simulationSuccess();
      const second = f.simulationSuccess();
      expect(first.id).toBe(1);
      expect(second.id).toBe(2);
      expect(second.result.latestLedger).toBe(first.result.latestLedger + 1);
      f.reset();
      expect(f.simulationSuccess()).toEqual(first);
    });
  });

  describe('simulation success', () => {
    it('emits real XDR that the SDK parses as a successful simulation', () => {
      const f = createSorobanFixtureFactory();
      const raw = f.simulationSuccess({ returnValue: 7, minResourceFee: 1234 });
      const parsed = rpc.parseRawSimulation(raw.result as rpc.Api.RawSimulateTransactionResponse);
      expect(rpc.Api.isSimulationSuccess(parsed)).toBe(true);
      expect(rpc.Api.isSimulationError(parsed)).toBe(false);
      expect(classifySimulationResponse(raw)).toMatchObject({ kind: 'success', ok: true, minResourceFee: '1234' });
    });

    it('boundary: usage exactly at the limit succeeds with a warning', () => {
      const f = createSorobanFixtureFactory();
      const raw = f.simulationSuccess({ cpuInsns: DEFAULT_SOROBAN_RESOURCE_LIMITS.cpuInstructions });
      const outcome = classifySimulationResponse(raw);
      expect(outcome.kind).toBe('success');
      expect(outcome.warnings).toEqual([expect.stringContaining('cpuInstructions usage is at 100%')]);
    });

    it('boundary: usage one instruction over the limit is resource exhaustion', () => {
      const f = createSorobanFixtureFactory();
      const raw = f.simulationSuccess({ cpuInsns: DEFAULT_SOROBAN_RESOURCE_LIMITS.cpuInstructions + 1 });
      expect(classifySimulationResponse(raw)).toMatchObject({
        kind: 'resource_exhaustion',
        exhaustedResource: 'cpuInstructions',
      });
    });
  });

  describe('failure cases', () => {
    it('auth failure is an SDK simulation error classified as auth_failure', () => {
      const f = createSorobanFixtureFactory();
      const raw = f.authFailure({ reason: 'invalid_signature' });
      const parsed = rpc.parseRawSimulation(raw.result as rpc.Api.RawSimulateTransactionResponse);
      expect(rpc.Api.isSimulationError(parsed)).toBe(true);
      expect(raw.result.error).toContain(f.accountId);
      expect(classifySimulationResponse(raw).kind).toBe('auth_failure');
    });

    it.each([
      ['cpu', 'cpuInstructions'],
      ['memory', 'memoryBytes'],
    ] as const)('resource exhaustion (%s) names the exhausted resource', (resource, expected) => {
      const f = createSorobanFixtureFactory();
      const outcome = classifySimulationResponse(f.resourceExhaustion({ resource }));
      expect(outcome).toMatchObject({ kind: 'resource_exhaustion', ok: false, exhaustedResource: expected });
    });

    it('restore_required carries a parseable restore preamble', () => {
      const f = createSorobanFixtureFactory();
      const raw = f.restoreRequired();
      const parsed = rpc.parseRawSimulation(raw.result as rpc.Api.RawSimulateTransactionResponse);
      expect(rpc.Api.isSimulationRestore(parsed)).toBe(true);
      expect(classifySimulationResponse(raw).kind).toBe('restore_required');
    });

    it('rpc_error surfaces the JSON-RPC error message', () => {
      const f = createSorobanFixtureFactory();
      expect(classifySimulationResponse(f.rpcError({ message: 'boom' }))).toMatchObject({
        kind: 'rpc_error',
        message: 'boom',
      });
    });
  });

  describe('request handler', () => {
    it('echoes request ids and routes simulateTransaction by scenario', () => {
      const f = createSorobanFixtureFactory();
      for (const scenario of SOROBAN_FIXTURE_SCENARIOS) {
        const res = f.handle({ jsonrpc: '2.0', id: 'req-9', method: 'simulateTransaction' }, scenario);
        expect(res.id).toBe('req-9');
        const expectedKind = scenario === 'success' ? 'success' : scenario;
        expect(classifySimulationResponse(res).kind).toBe(expectedKind);
      }
    });

    it('answers getNetwork with the fixture passphrase', () => {
      const f = createSorobanFixtureFactory({ network: 'futurenet' });
      const res = f.handle({ id: 1, method: 'getNetwork' }) as { result: { passphrase: string } };
      expect(res.result.passphrase).toBe(f.networkPassphrase);
    });

    it('returns JSON-RPC errors for unknown or missing methods', () => {
      const f = createSorobanFixtureFactory();
      expect(f.handle({ id: 1, method: 'nope' })).toMatchObject({ error: { code: -32601 } });
      expect(f.handle(null)).toMatchObject({ error: { code: -32600 } });
    });
  });

  describe('invalid input and unsupported environments', () => {
    it.each(['public', 'mainnet'])('refuses the %s network', (network) => {
      expect(() => createSorobanFixtureFactory({ network: network as never })).toThrow(/not supported/);
    });

    it('rejects unknown networks, empty seeds and bad numbers', () => {
      expect(() => createSorobanFixtureFactory({ network: 'moonnet' as never })).toThrow(SorobanFixtureError);
      expect(() => createSorobanFixtureFactory({ seed: '  ' })).toThrow(/seed/);
      expect(() => createSorobanFixtureFactory({ startLedger: -1 })).toThrow(/startLedger/);
      const f = createSorobanFixtureFactory();
      expect(() => f.simulationSuccess({ cpuInsns: 1.5 })).toThrow(/cpuInsns/);
      expect(() => f.resourceExhaustion({ resource: 'disk' as never })).toThrow(/resource/);
      expect(() => f.handle({ method: 'simulateTransaction' }, 'flaky' as never)).toThrow(/scenario/);
    });
  });
});

describe('classifySimulationResponse (#896)', () => {
  it.each([null, 'text', 42, []])('treats %p as invalid_response', (input) => {
    expect(classifySimulationResponse(input).kind).toBe('invalid_response');
  });

  it('accepts a bare result object as well as the JSON-RPC envelope', () => {
    const f = createSorobanFixtureFactory();
    expect(classifySimulationResponse(f.simulationSuccess().result).kind).toBe('success');
  });

  it('flags a success payload without transactionData as invalid', () => {
    expect(classifySimulationResponse({ result: { latestLedger: 1 } }).kind).toBe('invalid_response');
  });

  it('falls back to simulation_error for unrecognised host errors', () => {
    const outcome = classifySimulationResponse({ result: { error: 'HostError: Error(Contract, #3)' } });
    expect(outcome).toMatchObject({ kind: 'simulation_error', ok: false });
  });
});
