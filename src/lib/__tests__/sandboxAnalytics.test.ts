import { describe, it, expect } from 'vitest';
import {
  getSandboxAccounts,
  getSandboxAccountById,
  getSandboxTrades,
  calculateTradeMetrics,
  calculatePortfolioMetrics,
  isEnvironmentSupported,
  assertEnvironmentSupported,
  validateAccountDataset,
  validateTradeDataset,
  SandboxDatasetError,
} from '../sandboxAnalytics';
import {
  SAMPLE_SANDBOX_ACCOUNTS,
  SAMPLE_SANDBOX_TRADES,
  ANONYMIZED_ADDRESSES,
  type SandboxAccount,
} from '../../fixtures/sandboxDatasets';

describe('Sandbox Analytics Service (#908)', () => {
  // ── Primary Flow Tests ─────────────────────────────────────────────────────

  describe('Primary Flow: Account & Trade Retrieval', () => {
    it('returns all pre-configured anonymized sandbox accounts', () => {
      const accounts = getSandboxAccounts();
      expect(accounts).toBeDefined();
      expect(accounts.length).toBe(SAMPLE_SANDBOX_ACCOUNTS.length);
      expect(accounts.length).toBeGreaterThanOrEqual(4);

      // Verify essential account structure
      accounts.forEach((acc) => {
        expect(acc.id).toMatch(/^G[A-Z0-9]{55}$/);
        expect(acc.account_id).toBe(acc.id);
        expect(acc.balances.length).toBeGreaterThan(0);
        expect(acc.signers.length).toBeGreaterThan(0);
        expect(acc.thresholds).toBeDefined();
        expect(acc.flags).toBeDefined();
      });
    });

    it('filters sandbox accounts by archetype', () => {
      const retail = getSandboxAccounts({ archetype: 'retail_active' });
      expect(retail).toHaveLength(1);
      expect(retail[0].displayName).toContain('Retail Trader');
      expect(retail[0].id).toBe(ANONYMIZED_ADDRESSES.RETAIL_TRADER);

      const mm = getSandboxAccounts({ archetype: 'institutional_market_maker' });
      expect(mm).toHaveLength(1);
      expect(mm[0].displayName).toContain('Market Maker');
      expect(mm[0].signers.length).toBe(3); // 2-of-3 multisig
    });

    it('filters sandbox accounts by asset code and tags', () => {
      const withAqua = getSandboxAccounts({ assetCode: 'AQUA' });
      expect(withAqua.length).toBeGreaterThanOrEqual(2);
      withAqua.forEach((acc) => {
        const hasAqua = acc.balances.some((b) => b.asset_code === 'AQUA');
        expect(hasAqua).toBe(true);
      });

      const daoTag = getSandboxAccounts({ tag: 'dao' });
      expect(daoTag).toHaveLength(1);
      expect(daoTag[0].archetype).toBe('soroban_dapp_treasury');
    });

    it('retrieves an account by its anonymized public key', () => {
      const account = getSandboxAccountById(ANONYMIZED_ADDRESSES.RETAIL_TRADER);
      expect(account).toBeDefined();
      expect(account.id).toBe(ANONYMIZED_ADDRESSES.RETAIL_TRADER);
      expect(account.archetype).toBe('retail_active');
    });

    it('retrieves sandbox trades and validates market pair filtering', () => {
      const xlmUsdcTrades = getSandboxTrades({ baseAsset: 'XLM', counterAsset: 'USDC' });
      expect(xlmUsdcTrades.length).toBeGreaterThanOrEqual(5);

      xlmUsdcTrades.forEach((trade) => {
        expect(trade.base_asset_type).toBe('native');
        expect(trade.counter_asset_code).toBe('USDC');
        expect(parseFloat(trade.base_amount)).toBeGreaterThan(0);
        expect(parseFloat(trade.counter_amount)).toBeGreaterThan(0);
        expect(trade.price.n).toBeGreaterThan(0);
        expect(trade.price.d).toBeGreaterThan(0);
      });
    });

    it('calculates trade metrics (VWAP, OHLC, volume) on sample DEX trades', () => {
      const trades = getSandboxTrades({ baseAsset: 'XLM', counterAsset: 'USDC' });
      const metrics = calculateTradeMetrics(trades);

      expect(metrics.tradeCount).toBe(trades.length);
      expect(metrics.totalVolumeBase).toBeGreaterThan(0);
      expect(metrics.totalVolumeCounter).toBeGreaterThan(0);
      expect(metrics.vwap).toBeGreaterThan(0.12);
      expect(metrics.vwap).toBeLessThan(0.14);
      expect(metrics.openPrice).toBe(0.1245);
      expect(metrics.closePrice).toBe(0.128);
      expect(metrics.highPrice).toBe(0.128);
      expect(metrics.lowPrice).toBe(0.1245);
      expect(metrics.priceChange).toBeGreaterThan(0);
      expect(metrics.priceChangePercent).toBeGreaterThan(0);
      expect(metrics.buyVolume + metrics.sellVolume).toBeCloseTo(metrics.totalVolumeBase, 4);
      expect(metrics.orderbookCount + metrics.liquidityPoolCount).toBe(trades.length);
    });

    it('calculates portfolio metrics, allocations, and concentration risks', () => {
      const account = getSandboxAccountById(ANONYMIZED_ADDRESSES.RETAIL_TRADER);
      const portfolio = calculatePortfolioMetrics(account);

      expect(portfolio.totalValueUsd).toBeGreaterThan(1500);
      expect(portfolio.allocations.length).toBe(3); // XLM, USDC, AQUA

      // Sum of percentages should approximately equal 100%
      const totalPct = portfolio.allocations.reduce((sum, a) => sum + a.percentage, 0);
      expect(totalPct).toBeCloseTo(100, 0);

      // Diversification score should be non-zero for 3 assets
      expect(portfolio.diversificationScore).toBeGreaterThan(20);
      expect(portfolio.diversificationScore).toBeLessThanOrEqual(100);

      // Concentration risks should flag assets > 25%
      expect(portfolio.concentrationRisks.length).toBeGreaterThan(0);
      portfolio.concentrationRisks.forEach((risk) => {
        expect(risk.percentage).toBeGreaterThan(25);
      });
    });

    it('guarantees complete anonymization with zero private keys or Mainnet credentials', () => {
      SAMPLE_SANDBOX_ACCOUNTS.forEach((acc) => {
        // Must only use public keys (starting with 'G')
        expect(acc.id.startsWith('G')).toBe(true);
        expect(acc.id.startsWith('S')).toBe(false); // No secret seeds!
        acc.signers.forEach((signer) => {
          expect(signer.key.startsWith('G')).toBe(true);
          expect(signer.key.startsWith('S')).toBe(false);
        });
        // Check for any accidental private key fields
        expect((acc as any).secret).toBeUndefined();
        expect((acc as any).seed).toBeUndefined();
        expect((acc as any).privateKey).toBeUndefined();
      });
    });
  });

  // ── Boundary Case Tests ────────────────────────────────────────────────────

  describe('Boundary Cases', () => {
    it('handles limit = 0 by returning an empty trade list', () => {
      const trades = getSandboxTrades({ limit: 0 });
      expect(trades).toEqual([]);
    });

    it('handles limit = 1 by returning exactly one trade record', () => {
      const trades = getSandboxTrades({ limit: 1 });
      expect(trades).toHaveLength(1);
    });

    it('handles offset beyond total count by returning an empty trade list', () => {
      const trades = getSandboxTrades({ offset: 9999 });
      expect(trades).toEqual([]);
    });

    it('handles exact timestamp boundary matching', () => {
      // Find a specific trade's timestamp
      const targetTime = SAMPLE_SANDBOX_TRADES[1].ledger_close_time;
      const exactMatch = getSandboxTrades({
        startTime: targetTime,
        endTime: targetTime,
      });

      expect(exactMatch.length).toBeGreaterThanOrEqual(1);
      exactMatch.forEach((t) => {
        expect(t.ledger_close_time).toBe(targetTime);
      });
    });

    it('handles non-matching asset query returning empty array gracefully', () => {
      const trades = getSandboxTrades({ baseAsset: 'NONEXISTENT', counterAsset: 'USDC' });
      expect(trades).toEqual([]);
    });

    it('calculates trade metrics on empty trade list with safe zeroes and nulls', () => {
      const emptyMetrics = calculateTradeMetrics([]);
      expect(emptyMetrics.tradeCount).toBe(0);
      expect(emptyMetrics.totalVolumeBase).toBe(0);
      expect(emptyMetrics.totalVolumeCounter).toBe(0);
      expect(emptyMetrics.vwap).toBe(0);
      expect(emptyMetrics.openPrice).toBeNull();
      expect(emptyMetrics.closePrice).toBeNull();
      expect(emptyMetrics.highPrice).toBeNull();
      expect(emptyMetrics.lowPrice).toBeNull();
      expect(emptyMetrics.priceChange).toBe(0);
      expect(emptyMetrics.priceChangePercent).toBe(0);
    });

    it('handles single-asset account portfolio calculation (100% concentration, 0 diversification)', () => {
      const singleAssetAccount: SandboxAccount = {
        ...SAMPLE_SANDBOX_ACCOUNTS[3], // new_onboarded_sandbox
        balances: [{ asset_type: 'native', balance: '1000.0000000' }],
      };

      const metrics = calculatePortfolioMetrics(singleAssetAccount);
      expect(metrics.totalValueUsd).toBe(125); // 1000 * 0.125
      expect(metrics.allocations).toHaveLength(1);
      expect(metrics.allocations[0].percentage).toBe(100);
      expect(metrics.diversificationScore).toBe(0); // Cannot be diversified with 1 asset
      expect(metrics.concentrationRisks).toHaveLength(1);
      expect(metrics.concentrationRisks[0].riskLevel).toBe('high');
    });

    it('accepts custom prices to calculate portfolio metrics with overrides', () => {
      const account = getSandboxAccountById(ANONYMIZED_ADDRESSES.RETAIL_TRADER);
      const customPrices = { XLM: 1.0, USDC: 1.0, AQUA: 0.1 };
      const metrics = calculatePortfolioMetrics(account, customPrices);

      // 4820.5 XLM * 1.0 + 1250.75 USDC * 1.0 + 18500 AQUA * 0.1
      const expectedTotal = 4820.5 + 1250.75 + 1850.0;
      expect(metrics.totalValueUsd).toBeCloseTo(expectedTotal, 1);
    });
  });

  // ── Failure & Error Path Tests ─────────────────────────────────────────────

  describe('Failure & Error Handling Paths', () => {
    it('throws UNSUPPORTED_ENVIRONMENT when attempting to run on mainnet without bypass', () => {
      expect(() => {
        getSandboxAccounts(undefined, { environment: 'mainnet' });
      }).toThrowError(SandboxDatasetError);

      try {
        getSandboxAccounts(undefined, { environment: 'mainnet' });
      } catch (err) {
        expect(err).toBeInstanceOf(SandboxDatasetError);
        expect((err as SandboxDatasetError).code).toBe('UNSUPPORTED_ENVIRONMENT');
        expect((err as SandboxDatasetError).message).toContain(
          "Sandbox demo datasets are not permitted on 'mainnet'"
        );
      }

      expect(() => {
        getSandboxTrades(undefined, { environment: 'production' });
      }).toThrowError(/UNSUPPORTED_ENVIRONMENT/);
    });

    it('permits execution on mainnet when allowMainnetDemo flag is explicitly provided', () => {
      const accounts = getSandboxAccounts(undefined, {
        environment: 'mainnet',
        allowMainnetDemo: true,
      });
      expect(accounts).toBeDefined();
      expect(accounts.length).toBeGreaterThan(0);
    });

    it('throws INVALID_INPUT for negative limit in getSandboxTrades', () => {
      expect(() => {
        getSandboxTrades({ limit: -5 });
      }).toThrowError(SandboxDatasetError);

      try {
        getSandboxTrades({ limit: -5 });
      } catch (err) {
        expect((err as SandboxDatasetError).code).toBe('INVALID_INPUT');
        expect((err as SandboxDatasetError).message).toContain(
          'limit must be a non-negative number'
        );
      }
    });

    it('throws INVALID_INPUT for negative offset in getSandboxTrades', () => {
      expect(() => {
        getSandboxTrades({ offset: -1 });
      }).toThrowError(/INVALID_INPUT/);
    });

    it('throws INVALID_INPUT when startTime is later than endTime', () => {
      expect(() => {
        getSandboxTrades({
          startTime: '2026-09-25T12:00:00Z',
          endTime: '2026-09-25T08:00:00Z',
        });
      }).toThrowError(SandboxDatasetError);

      try {
        getSandboxTrades({
          startTime: '2026-09-25T12:00:00Z',
          endTime: '2026-09-25T08:00:00Z',
        });
      } catch (err) {
        expect((err as SandboxDatasetError).code).toBe('INVALID_INPUT');
        expect((err as SandboxDatasetError).message).toContain(
          'startTime cannot be later than endTime'
        );
      }
    });

    it('throws INVALID_INPUT for malformed date strings', () => {
      expect(() => {
        getSandboxTrades({ startTime: 'not-a-date' });
      }).toThrowError(/INVALID_INPUT/);

      expect(() => {
        getSandboxTrades({ endTime: 'invalid-iso-string' });
      }).toThrowError(/INVALID_INPUT/);
    });

    it('throws INVALID_INPUT for unknown account archetype', () => {
      expect(() => {
        getSandboxAccounts({ archetype: 'arbitrary_fake_type' as any });
      }).toThrowError(/INVALID_INPUT/);
    });

    it('throws INVALID_INPUT for negative minNativeBalance', () => {
      expect(() => {
        getSandboxAccounts({ minNativeBalance: -100 });
      }).toThrowError(/INVALID_INPUT/);
    });

    it('throws INVALID_INPUT for empty or non-string accountId', () => {
      expect(() => {
        getSandboxAccountById('');
      }).toThrowError(/INVALID_INPUT/);

      expect(() => {
        getSandboxAccountById('   ');
      }).toThrowError(/INVALID_INPUT/);
    });

    it('throws INVALID_INPUT for malformed public key format', () => {
      // Not starting with G
      expect(() => {
        getSandboxAccountById('SBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H');
      }).toThrowError(/Expected 56 characters starting with 'G'/);

      // Wrong length
      expect(() => {
        getSandboxAccountById('GSHORT');
      }).toThrowError(/Expected 56 characters starting with 'G'/);
    });

    it('throws DATASET_NOT_FOUND when requesting non-existent valid public key', () => {
      const nonExistentKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
      expect(() => {
        getSandboxAccountById(nonExistentKey);
      }).toThrowError(SandboxDatasetError);

      try {
        getSandboxAccountById(nonExistentKey);
      } catch (err) {
        expect((err as SandboxDatasetError).code).toBe('DATASET_NOT_FOUND');
        expect((err as SandboxDatasetError).message).toContain('No sandbox account found');
      }
    });

    it('validates account datasets and throws VALIDATION_FAILED on invalid data', () => {
      expect(() => {
        validateAccountDataset('not an array');
      }).toThrowError(/VALIDATION_FAILED/);

      expect(() => {
        validateAccountDataset([{ id: 'G...', sequence: '123' }]); // missing balances
      }).toThrowError(/VALIDATION_FAILED/);

      expect(() => {
        validateAccountDataset([
          {
            id: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVTAX',
            sequence: '123',
            balances: [{ asset_type: 'native', balance: 'invalid-number' }],
            signers: [],
          },
        ]);
      }).toThrowError(/VALIDATION_FAILED/);
    });

    it('validates trade datasets and throws VALIDATION_FAILED on invalid data', () => {
      expect(() => {
        validateTradeDataset(null);
      }).toThrowError(/VALIDATION_FAILED/);

      expect(() => {
        validateTradeDataset([
          { id: 'trade1', ledger_close_time: '2026-09-25T00:00:00Z', base_amount: 'abc' },
        ]);
      }).toThrowError(/VALIDATION_FAILED/);

      expect(() => {
        validateTradeDataset([
          {
            id: 'trade1',
            ledger_close_time: '2026-09-25T00:00:00Z',
            base_amount: '100',
            counter_amount: '12',
            price: null, // missing price
          },
        ]);
      }).toThrowError(/VALIDATION_FAILED/);
    });

    it('tests isEnvironmentSupported utility helper', () => {
      expect(isEnvironmentSupported('testnet')).toBe(true);
      expect(isEnvironmentSupported('futurenet')).toBe(true);
      expect(isEnvironmentSupported('sandbox')).toBe(true);
      expect(isEnvironmentSupported('development')).toBe(true);
      expect(isEnvironmentSupported('mainnet')).toBe(false);
      expect(isEnvironmentSupported('production')).toBe(false);
      expect(isEnvironmentSupported('public')).toBe(false);
      expect(isEnvironmentSupported('mainnet', { allowMainnetDemo: true })).toBe(true);

      // assertEnvironmentSupported should succeed on safe environments
      expect(() => assertEnvironmentSupported({ environment: 'testnet' })).not.toThrow();
      expect(() =>
        assertEnvironmentSupported({ environment: 'mainnet', allowMainnetDemo: true })
      ).not.toThrow();

      // assertEnvironmentSupported should throw on production/mainnet without allowMainnetDemo
      expect(() => assertEnvironmentSupported({ environment: 'mainnet' })).toThrowError(
        /UNSUPPORTED_ENVIRONMENT/
      );
      expect(() => assertEnvironmentSupported({ environment: 'production' })).toThrowError(
        /UNSUPPORTED_ENVIRONMENT/
      );
    });
  });
});
