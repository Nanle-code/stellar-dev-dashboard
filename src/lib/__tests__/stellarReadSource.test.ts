import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HorizonReadSource,
  RpcReadSource,
  RpcFirstReadSource,
  getStellarReadSource,
  evaluateReadSourceCapabilities,
  StellarReadSource,
} from '../stellar';
import {
  HORIZON_RECORDS_FIXTURE,
  RPC_RECORDS_FIXTURE,
} from '../../fixtures/stellarReadSourceFixtures';

const mockHorizonServerGetter = () => {
  const createBuilder = (records: any[]) => {
    const builder: any = {
      order: () => builder,
      limit: () => builder,
      cursor: () => builder,
      forAccount: () => builder,
      call: vi.fn().mockImplementation(() => Promise.resolve({ records })),
    };
    return builder;
  };

  return {
    ledgers: () => createBuilder(HORIZON_RECORDS_FIXTURE.ledgers),
    transactions: () => createBuilder(HORIZON_RECORDS_FIXTURE.transactions),
    operations: () => createBuilder(HORIZON_RECORDS_FIXTURE.operations),
    offers: () => createBuilder(HORIZON_RECORDS_FIXTURE.offers),
  } as any;
};

const mockRpcServerGetter = () => ({
  getLatestLedger: vi.fn().mockImplementation(() => Promise.resolve(RPC_RECORDS_FIXTURE.latestLedger)),
  getTransactions: vi.fn().mockImplementation(() => Promise.resolve({
    transactions: RPC_RECORDS_FIXTURE.transactions,
    latestLedger: 524100,
    oldestLedger: 424100,
    cursor: 'tx-cursor-1',
  })),
  getEvents: vi.fn().mockImplementation(() => Promise.resolve({
    latestLedger: 524100,
    events: RPC_RECORDS_FIXTURE.events,
  })),
} as any);

describe('Stellar Read Source Contract Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const runReadSourceContractScenarios = (
    sourceName: string,
    createSource: () => StellarReadSource,
    expectedSourceType: 'rpc' | 'horizon'
  ) => {
    describe(`Contract Scenarios for ${sourceName}`, () => {
      it('should fetch ledgers and return normalized ledger objects (Primary Flow)', async () => {
        const source = createSource();
        const result = await source.getLedgers({ limit: 5 });

        expect(result).toBeDefined();
        expect(result.source).toBe(expectedSourceType);
        expect(Array.isArray(result.ledgers)).toBe(true);
        expect(result.ledgers.length).toBeGreaterThan(0);

        const ledger = result.ledgers[0];
        expect(ledger.sequence).toBeGreaterThan(0);
        expect(ledger.hash).toBeDefined();
        expect(ledger.closeTime).toBeDefined();
      });

      it('should fetch transactions and return normalized transaction objects (Primary Flow)', async () => {
        const source = createSource();
        const result = await source.getTransactions({ limit: 5 });

        expect(result).toBeDefined();
        expect(result.source).toBe(expectedSourceType);
        expect(Array.isArray(result.transactions)).toBe(true);
        expect(result.transactions.length).toBeGreaterThan(0);

        const tx = result.transactions[0];
        expect(tx.hash).toBeDefined();
        expect(tx.ledger).toBeGreaterThan(0);
        expect(['SUCCESS', 'FAILED', 'PENDING']).toContain(tx.status);
      });

      it('should fetch contract/system events and return normalized event objects (Primary Flow)', async () => {
        const source = createSource();
        const result = await source.getEvents({ limit: 5 });

        expect(result).toBeDefined();
        expect(result.source).toBe(expectedSourceType);
        expect(Array.isArray(result.events)).toBe(true);
        expect(result.events.length).toBeGreaterThan(0);

        const event = result.events[0];
        expect(event.id).toBeDefined();
        expect(event.ledger).toBeGreaterThan(0);
      });
    });
  };

  runReadSourceContractScenarios(
    'HorizonReadSource',
    () => new HorizonReadSource('testnet', mockHorizonServerGetter),
    'horizon'
  );

  runReadSourceContractScenarios(
    'RpcReadSource',
    () => new RpcReadSource('testnet', 100_000, mockRpcServerGetter),
    'rpc'
  );

  runReadSourceContractScenarios(
    'RpcFirstReadSource',
    () =>
      new RpcFirstReadSource(
        'testnet',
        new RpcReadSource('testnet', 100_000, mockRpcServerGetter),
        new HorizonReadSource('testnet', mockHorizonServerGetter)
      ),
    'rpc'
  );

  describe('Boundary Cases', () => {
    it('should detect retention limit boundary when startLedger is past retention window (~100k ledgers)', async () => {
      const rpcSource = new RpcReadSource('testnet', 100_000, mockRpcServerGetter);
      const result = await rpcSource.getLedgers({ startLedger: 100_000, limit: 5 });

      expect(result.retentionLimitReached).toBe(true);
    });

    it('should handle empty parameter inputs gracefully and apply default limits', async () => {
      const horizonSource = new HorizonReadSource('testnet', mockHorizonServerGetter);
      const result = await horizonSource.getLedgers();

      expect(result.ledgers).toBeDefined();
      expect(result.source).toBe('horizon');
    });
  });

  describe('Failure & Fallback Cases', () => {
    it('should fall back to Horizon when RPC endpoint throws an error (RPC Fallback Flow)', async () => {
      const failingRpcServerGetter = () => ({
        getLatestLedger: vi.fn().mockImplementation(() => Promise.reject(new Error('RPC failure'))),
        getTransactions: vi.fn().mockImplementation(() => Promise.reject(new Error('RPC failure'))),
        getEvents: vi.fn().mockImplementation(() => Promise.reject(new Error('RPC failure'))),
      } as any);

      const rpcFirstSource = new RpcFirstReadSource(
        'testnet',
        new RpcReadSource('testnet', 100_000, failingRpcServerGetter),
        new HorizonReadSource('testnet', mockHorizonServerGetter)
      );

      const result = await rpcFirstSource.getLedgers({ limit: 5 });

      expect(result.source).toBe('horizon');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should return unsupported capability status when getAccountOffers is called on RPC source', async () => {
      const rpcSource = new RpcReadSource('testnet', 100_000, mockRpcServerGetter);
      const result = await rpcSource.getAccountOffers('GBZC6Y2Y7Q3ZQ2Y4QZJ2XZ3Z5YXZ6Z7Z2Y4QZJ2XZ3Z5YXZ6Z7Z2Y4');

      expect(result.supported).toBe(false);
      expect(result.offers.length).toEqual(0);
      expect(result.message).toContain('not supported on Stellar RPC');
    });
  });

  describe('Factory and Capability Helpers', () => {
    it('should create appropriate StellarReadSource instance via getStellarReadSource', () => {
      const source = getStellarReadSource('testnet', 'rpc-first');
      expect(source).toBeInstanceOf(RpcFirstReadSource);
    });

    it('should evaluate capabilities for network profiles correctly', () => {
      const info = evaluateReadSourceCapabilities('testnet');

      expect(info.hasHorizon).toBe(true);
      expect(info.hasRpc).toBe(true);
      expect(info.capabilities.defaultReadSource).toBe('rpc');
      expect(info.capabilities.accountOffers).toBe(true);
    });
  });
});
