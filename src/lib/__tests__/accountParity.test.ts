import { describe, it, expect } from 'vitest';
import {
  calculateSpendableMetrics,
  normalizeTrustlines,
  filterTrustlines,
  normalizeAccountActivity,
  filterActivity,
  getMobileParityMatrix,
  type NormalizedTrustline,
  type AccountActivityItem,
} from '../accountParity';
import type { Horizon } from '@stellar/stellar-sdk';

describe('accountParity & Mobile Account Overview', () => {
  const mockAccountData: Horizon.AccountResponse = {
    id: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
    account_id: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
    sequence: '123456789',
    subentry_count: 4,
    inflation_destination: '',
    home_domain: 'example.com',
    last_modified_ledger: 1000,
    last_modified_time: '2026-09-20T10:00:00Z',
    thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
    flags: {
      auth_required: false,
      auth_revocable: false,
      auth_immutable: false,
      auth_clawback_enabled: false,
    },
    balances: [
      {
        asset_type: 'native',
        balance: '500.0000000',
        buying_liabilities: '0.0000000',
        selling_liabilities: '0.0000000',
      },
      {
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        asset_issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        balance: '150.5000000',
        limit: '10000.0000000',
        buying_liabilities: '0.0000000',
        selling_liabilities: '0.0000000',
        is_authorized: true,
        is_authorized_to_maintain_liabilities: false,
      },
      {
        asset_type: 'credit_alphanum12',
        asset_code: 'AQUA',
        asset_issuer: 'GBNZILSTVQZ4R7IKQDGHYGY2Q2Z6PQUUT2FWVNVKUBYA7JIVRHGIWUSC',
        balance: '0.0000000',
        limit: '50000.0000000',
        buying_liabilities: '0.0000000',
        selling_liabilities: '0.0000000',
        is_authorized: true,
        is_authorized_to_maintain_liabilities: false,
      },
      {
        asset_type: 'credit_alphanum4',
        asset_code: 'TEST',
        asset_issuer: 'GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2GIOVPX2S46HZ4N5NLGHA',
        balance: '50.0000000',
        limit: '1000.0000000',
        buying_liabilities: '0.0000000',
        selling_liabilities: '0.0000000',
        is_authorized: false,
        is_authorized_to_maintain_liabilities: false,
      },
    ],
    signers: [
      {
        key: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        weight: 1,
        type: 'ed25519_public_key',
      },
    ],
    data: {},
  } as unknown as Horizon.AccountResponse;

  describe('Primary Flow: Balances, Reserves, Trustlines & Activity Parity', () => {
    it('calculates spendable metrics and reserve distribution accurately', () => {
      const metrics = calculateSpendableMetrics(mockAccountData, undefined, 2);

      expect(metrics.totalXlm).toBe(500);
      expect(metrics.lockedXlm).toBeGreaterThan(0);
      expect(metrics.availableXlm).toBeLessThan(500);
      expect(metrics.spendablePercentage).toBeGreaterThan(0);
      expect(metrics.spendablePercentage).toBeLessThanOrEqual(100);
      expect(metrics.reserves).not.toBeNull();
      expect(metrics.reserves?.subentryReserve).toBeDefined();
    });

    it('normalizes trustlines with authorization flags and explorer links', () => {
      const trustlines = normalizeTrustlines(mockAccountData, 'testnet');

      expect(trustlines.length).toBe(3); // USDC, AQUA, TEST

      const usdc = trustlines.find((t) => t.assetCode === 'USDC');
      expect(usdc).toBeDefined();
      expect(usdc?.balance).toBe('150.5000000');
      expect(usdc?.balanceNumber).toBe(150.5);
      expect(usdc?.isAuthorized).toBe(true);
      expect(usdc?.isEmpty).toBe(false);
      expect(usdc?.explorerUrl).toContain('USDC-GBBD47IF');

      const aqua = trustlines.find((t) => t.assetCode === 'AQUA');
      expect(aqua?.isEmpty).toBe(true);

      const testAsset = trustlines.find((t) => t.assetCode === 'TEST');
      expect(testAsset?.isAuthorized).toBe(false);
    });

    it('normalizes recent activity feed with operation counts and statuses', () => {
      const mockTxs = [
        {
          id: 'tx_1',
          hash: 'abc1234567890abcdef',
          successful: true,
          operation_count: 3,
          created_at: '2026-09-26T12:00:00Z',
          fee_charged: '100',
          memo: 'Invoice 101',
        },
        {
          id: 'tx_2',
          hash: 'def9876543210fedcba',
          successful: false,
          operation_count: 1,
          created_at: '2026-09-26T11:00:00Z',
          fee_charged: '100',
        },
      ];

      const activity = normalizeAccountActivity(mockTxs, 'testnet');
      expect(activity.length).toBe(2);

      expect(activity[0].hash).toBe('abc1234567890abcdef');
      expect(activity[0].successful).toBe(true);
      expect(activity[0].type).toBe('3 Operations');
      expect(activity[0].memo).toBe('Invoice 101');
      expect(activity[0].explorerUrl).toContain('/tx/abc1234567890abcdef');

      expect(activity[1].successful).toBe(false);
      expect(activity[1].type).toBe('Transaction');
    });

    it('returns complete Mobile Parity Matrix documenting full web-to-mobile coverage', () => {
      const matrix = getMobileParityMatrix();
      expect(matrix.length).toBeGreaterThanOrEqual(8);

      const balancesFeature = matrix.find((f) => f.category === 'Balances');
      expect(balancesFeature?.webSupported).toBe(true);
      expect(balancesFeature?.mobileSupported).toBe(true);

      const trustlinesFeature = matrix.find((f) => f.category === 'Trustlines');
      expect(trustlinesFeature?.webSupported).toBe(true);
      expect(trustlinesFeature?.mobileSupported).toBe(true);

      const activityFeature = matrix.find((f) => f.category === 'Recent Activity');
      expect(activityFeature?.webSupported).toBe(true);
      expect(activityFeature?.mobileSupported).toBe(true);
    });
  });

  describe('Boundary Cases', () => {
    it('handles account with 0 non-native trustlines', () => {
      const nativeOnlyAccount = {
        balances: [{ asset_type: 'native', balance: '100.0000000' }],
      } as Horizon.AccountResponse;

      const trustlines = normalizeTrustlines(nativeOnlyAccount);
      expect(trustlines).toEqual([]);
    });

    it('handles account with 100% locked reserves (zero available balance)', () => {
      const lockedAccount = {
        balances: [{ asset_type: 'native', balance: '1.0000000' }],
        subentry_count: 10,
        signers: [{ weight: 1 }, { weight: 1 }],
      } as unknown as Horizon.AccountResponse;

      const metrics = calculateSpendableMetrics(lockedAccount);
      expect(metrics.totalXlm).toBe(1);
      expect(metrics.availableXlm).toBe(0);
      expect(metrics.spendablePercentage).toBe(0);
    });

    it('filters trustlines with "hideEmpty" and search queries', () => {
      const trustlines: NormalizedTrustline[] = [
        {
          assetCode: 'USDC',
          assetIssuer: 'GBBD47IF',
          assetType: 'credit_alphanum4',
          balance: '100',
          balanceNumber: 100,
          isAuthorized: true,
          isAuthorizedToMaintainLiabilities: false,
          isEmpty: false,
        },
        {
          assetCode: 'AQUA',
          assetIssuer: 'GBNZILST',
          assetType: 'credit_alphanum12',
          balance: '0',
          balanceNumber: 0,
          isAuthorized: true,
          isAuthorizedToMaintainLiabilities: false,
          isEmpty: true,
        },
      ];

      // Hide empty
      const nonEmpty = filterTrustlines(trustlines, { hideEmpty: true });
      expect(nonEmpty.length).toBe(1);
      expect(nonEmpty[0].assetCode).toBe('USDC');

      // Search by code
      const searchCode = filterTrustlines(trustlines, { query: 'aqua' });
      expect(searchCode.length).toBe(1);
      expect(searchCode[0].assetCode).toBe('AQUA');

      // Search with 0 matches
      const searchNone = filterTrustlines(trustlines, { query: 'NONEXISTENT' });
      expect(searchNone.length).toBe(0);
    });

    it('filters activity by status and search terms', () => {
      const activity: AccountActivityItem[] = [
        {
          id: '1',
          hash: '0x1234abcd',
          type: 'Transaction',
          timestamp: '2026-09-26T12:00:00Z',
          formattedDate: 'Sep 26, 12:00',
          successful: true,
          operationCount: 1,
          memo: 'Rent',
          explorerUrl: '',
        },
        {
          id: '2',
          hash: '0x5678efgh',
          type: 'Transaction',
          timestamp: '2026-09-26T11:00:00Z',
          formattedDate: 'Sep 26, 11:00',
          successful: false,
          operationCount: 1,
          memo: 'Subscription',
          explorerUrl: '',
        },
      ];

      const successOnly = filterActivity(activity, { status: 'success' });
      expect(successOnly.length).toBe(1);
      expect(successOnly[0].hash).toBe('0x1234abcd');

      const failedOnly = filterActivity(activity, { status: 'failed' });
      expect(failedOnly.length).toBe(1);
      expect(failedOnly[0].hash).toBe('0x5678efgh');

      const searchMemo = filterActivity(activity, { query: 'rent' });
      expect(searchMemo.length).toBe(1);
      expect(searchMemo[0].memo).toBe('Rent');
    });
  });

  describe('Failure & Edge Cases', () => {
    it('handles null / undefined / malformed account data gracefully', () => {
      expect(calculateSpendableMetrics(null)).toEqual({
        totalXlm: 0,
        availableXlm: 0,
        lockedXlm: 0,
        spendablePercentage: 0,
        reserves: null,
      });

      expect(calculateSpendableMetrics(undefined)).toEqual({
        totalXlm: 0,
        availableXlm: 0,
        lockedXlm: 0,
        spendablePercentage: 0,
        reserves: null,
      });

      expect(normalizeTrustlines(null)).toEqual([]);
      expect(normalizeTrustlines({} as any)).toEqual([]);
    });

    it('handles malformed transaction items in normalizeAccountActivity', () => {
      const malformedTxs = [
        {},
        { hash: null, operation_count: 'not-number' },
        null,
      ];

      const activity = normalizeAccountActivity(malformedTxs as any);
      expect(activity.length).toBe(3);
      expect(activity[0].id).toBeDefined();
      expect(activity[0].successful).toBe(true);
      expect(activity[1].operationCount).toBe(1);
    });

    it('handles invalid arguments to filter functions without crashing', () => {
      expect(filterTrustlines(null as any)).toEqual([]);
      expect(filterActivity(null as any)).toEqual([]);
    });
  });
});
