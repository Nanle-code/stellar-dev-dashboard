import { describe, it, expect, afterEach } from 'vitest';
import {
  DEMO_NETWORK,
  DEMO_MODE_LABEL,
  DemoModeError,
  validateDemoFixture,
  isDemoFixtureValid,
  getDemoFixture,
  getDemoFixtureSummary,
  hydrateDemoState,
  isDemoWriteAllowed,
  assertDemoWriteAllowed,
  type DemoFixture,
} from '../demoMode';
import { useStore } from '../store';

function cloneFixture(): DemoFixture {
  return JSON.parse(JSON.stringify(getDemoFixture())) as DemoFixture;
}

describe('Demo mode (#875)', () => {
  // ── Primary flow ───────────────────────────────────────────────────────────

  describe('Primary flow: curated read-only fixtures', () => {
    it('exposes a curated set of testnet accounts and contracts with history', () => {
      const fixture = getDemoFixture();

      expect(fixture.network).toBe(DEMO_NETWORK);
      expect(fixture.accounts.length).toBeGreaterThanOrEqual(3);
      expect(fixture.contracts.length).toBeGreaterThanOrEqual(3);
      expect(fixture.transactions.length).toBeGreaterThan(0);
      expect(fixture.operations.length).toBeGreaterThan(0);
    });

    it('uses only public keys and contract ids (no secret material)', () => {
      const fixture = getDemoFixture();

      fixture.accounts.forEach((account) => {
        expect(account.address).toMatch(/^G[A-Z2-7]{55}$/);
        expect(account.address.startsWith('S')).toBe(false);
        expect(account.account.balances.length).toBeGreaterThan(0);
      });

      fixture.contracts.forEach((contract) => {
        expect(contract.contractId).toMatch(/^C[A-Z2-7]{55}$/);
      });
    });

    it('hydrates a read-only Overview state from the fixtures', () => {
      const state = hydrateDemoState();
      const primary = getDemoFixture().accounts[0];

      expect(state.network).toBe('testnet');
      expect(state.connectedAddress).toBe(primary.address);
      expect(state.accountData).toEqual(primary.account);
      expect(state.transactions.length).toBe(getDemoFixtureSummary().transactionCount);
      expect(state.operations.length).toBe(getDemoFixtureSummary().operationCount);

      // Read-only: nothing is loading, no pagination cursors, overview tab.
      expect(state.accountLoading).toBe(false);
      expect(state.txLoading).toBe(false);
      expect(state.opsLoading).toBe(false);
      expect(state.txNextCursor).toBeNull();
      expect(state.opsNextCursor).toBeNull();
      expect(state.activeTab).toBe('overview');
    });

    it('reports a human-readable fixture summary', () => {
      const summary = getDemoFixtureSummary();
      expect(summary.accountCount).toBe(getDemoFixture().accounts.length);
      expect(summary.contractCount).toBe(getDemoFixture().contracts.length);
      expect(summary.transactionCount).toBeGreaterThan(0);
      expect(summary.operationCount).toBeGreaterThan(0);
      expect(summary.anchor).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ── Store integration ──────────────────────────────────────────────────────

  describe('Store integration', () => {
    afterEach(() => {
      useStore.getState().exitDemoMode();
    });

    it('enterDemoMode populates the store and flags a demo session', () => {
      useStore.getState().enterDemoMode();
      const state = useStore.getState();

      expect(state.isDemoMode).toBe(true);
      expect(state.network).toBe('testnet');
      expect(state.connectedAddress).toMatch(/^G[A-Z2-7]{55}$/);
      expect(state.transactions.length).toBeGreaterThan(0);
      expect(state.operations.length).toBeGreaterThan(0);
    });

    it('exitDemoMode clears the session and returns to a clean connect state', () => {
      useStore.getState().enterDemoMode();
      useStore.getState().exitDemoMode();
      const state = useStore.getState();

      expect(state.isDemoMode).toBe(false);
      expect(state.connectedAddress).toBeNull();
      expect(state.accountData).toBeNull();
      expect(state.transactions).toEqual([]);
      expect(state.operations).toEqual([]);
      expect(state.activeTab).toBe('overview');
    });
  });

  // ── Boundary cases ─────────────────────────────────────────────────────────

  describe('Boundary cases', () => {
    it('accepts the minimum viable fixture (one account, one contract)', () => {
      const fixture = cloneFixture();
      fixture.accounts = fixture.accounts.slice(0, 1);
      fixture.contracts = fixture.contracts.slice(0, 1);

      expect(isDemoFixtureValid(fixture)).toBe(true);
      expect(() => validateDemoFixture(fixture)).not.toThrow();
    });

    it('rejects an empty account set with FIXTURE_EMPTY', () => {
      const fixture = cloneFixture();
      fixture.accounts = [];

      try {
        validateDemoFixture(fixture);
        throw new Error('expected validateDemoFixture to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(DemoModeError);
        expect((err as DemoModeError).code).toBe('FIXTURE_EMPTY');
      }
    });

    it('treats demo mode as read-only for mutating actions', () => {
      expect(isDemoWriteAllowed(false)).toBe(true);
      expect(isDemoWriteAllowed(true)).toBe(false);

      expect(() => assertDemoWriteAllowed(false, 'faucet funding')).not.toThrow();
      expect(() => assertDemoWriteAllowed(true, 'faucet funding')).toThrow(/read-only/);
    });

    it('labels the demo clearly', () => {
      expect(DEMO_MODE_LABEL).toMatch(/demo/i);
    });
  });

  // ── Failure cases ──────────────────────────────────────────────────────────

  describe('Failure cases', () => {
    const expectCode = (input: unknown, code: string) => {
      try {
        validateDemoFixture(input);
        throw new Error('expected validateDemoFixture to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(DemoModeError);
        expect((err as DemoModeError).code).toBe(code);
      }
    };

    it('rejects non-object fixtures', () => {
      expectCode(null, 'INVALID_FIXTURE');
      expectCode('demo', 'INVALID_FIXTURE');
      expect(isDemoFixtureValid(null)).toBe(false);
    });

    it('rejects an unsupported fixture version', () => {
      const fixture = cloneFixture();
      (fixture as { version: number }).version = 99;
      expectCode(fixture, 'INVALID_FIXTURE');
    });

    it('refuses non-testnet fixture networks', () => {
      const fixture = cloneFixture();
      (fixture as { network: string }).network = 'mainnet';
      expectCode(fixture, 'UNSUPPORTED_NETWORK');
    });

    it('rejects malformed account addresses', () => {
      const fixture = cloneFixture();
      fixture.accounts[0].address = 'NOT_A_KEY';
      expectCode(fixture, 'MALFORMED_ACCOUNT');
    });

    it('rejects invalid contract ids', () => {
      const fixture = cloneFixture();
      fixture.contracts[0].contractId = 'not-a-contract';
      expectCode(fixture, 'INVALID_FIXTURE');
    });

    it('rejects fixtures without transaction history', () => {
      const fixture = cloneFixture();
      fixture.transactions = [];
      expectCode(fixture, 'FIXTURE_EMPTY');
    });

    it('throws READ_ONLY_DEMO when a write is attempted during demo mode', () => {
      try {
        assertDemoWriteAllowed(true, 'contract invocation');
        throw new Error('expected assertDemoWriteAllowed to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(DemoModeError);
        expect((err as DemoModeError).code).toBe('READ_ONLY_DEMO');
      }
    });
  });
});
