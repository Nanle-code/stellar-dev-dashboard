import { describe, it, expect } from 'vitest';
import {
  compareFeeStrategiesDryRun,
  validateFeeStrategyInput,
  calculateStrategyFees,
  calculateStrategyLikelihood,
  stroopsToXLM,
  parseBalanceToStroops,
  MIN_BASE_FEE_STROOPS,
} from '../../../src/lib/feeStrategyDryRun';

const VALID_SOURCE_ACCOUNT = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const VALID_DESTINATION = 'GDH6EUBJPPBUWCTBTHGJSYOIFBWVHI5YQSPUQ6QKVTO6OZ22MLAK2PAV';

describe('Fee Strategy Dry-Run Comparison', () => {
  describe('Utility functions', () => {
    it('converts stroops to formatted XLM string correctly', () => {
      expect(stroopsToXLM(100)).toBe('0.0000100 XLM');
      expect(stroopsToXLM(10_000_000)).toBe('1.0000000 XLM');
      expect(stroopsToXLM(0)).toBe('0.0000000 XLM');
      expect(stroopsToXLM(-50)).toBe('0.0000000 XLM');
    });

    it('parses balances in numeric, stroops, and XLM string formats', () => {
      expect(parseBalanceToStroops(50)).toBe(500_000_000); // 50 XLM -> 500,000,000 stroops
      expect(parseBalanceToStroops(500_000)).toBe(500_000); // 500,000 stroops
      expect(parseBalanceToStroops('2.5 XLM')).toBe(25_000_000);
      expect(parseBalanceToStroops('1000 stroops')).toBe(1000);
      expect(parseBalanceToStroops(undefined)).toBeNull();
      expect(parseBalanceToStroops('invalid')).toBeNull();
    });

    it('calculates strategy fees adhering to minimum base fee and monotonic fee ordering', () => {
      const fees = calculateStrategyFees(2, 0.55);
      expect(fees.low.baseFee).toBeGreaterThanOrEqual(MIN_BASE_FEE_STROOPS);
      expect(fees.medium.baseFee).toBeGreaterThanOrEqual(fees.low.baseFee);
      expect(fees.high.baseFee).toBeGreaterThanOrEqual(fees.medium.baseFee);
      expect(fees.low.totalFee).toBe(fees.low.baseFee * 2);
      expect(fees.medium.totalFee).toBe(fees.medium.baseFee * 2);
      expect(fees.high.totalFee).toBe(fees.high.baseFee * 2);
    });
  });

  describe('Primary Flow: comparing strategies for valid transaction', () => {
    it('returns low, medium, and high strategies with valid metrics and recommendations', async () => {
      const report = await compareFeeStrategiesDryRun({
        sourceAccount: VALID_SOURCE_ACCOUNT,
        operations: [
          {
            type: 'payment',
            destination: VALID_DESTINATION,
            amount: '10',
          },
        ],
        memo: 'Invoice 101',
        network: 'testnet',
        currentLedgerLoad: 0.55,
        accountBalance: '50 XLM',
      });

      expect(report.valid).toBe(true);
      expect(report.isUnsupportedEnvironment).toBe(false);
      expect(report.validationErrors).toHaveLength(0);
      expect(report.strategyList).toHaveLength(3);

      const { low, medium, high } = report.strategies;

      // Strategy tiers
      expect(low.tier).toBe('low');
      expect(medium.tier).toBe('medium');
      expect(high.tier).toBe('high');

      // Cost ordering: low <= medium <= high
      expect(low.totalFee).toBeLessThanOrEqual(medium.totalFee);
      expect(medium.totalFee).toBeLessThanOrEqual(high.totalFee);

      // Success likelihood ordering: low <= medium <= high
      expect(low.successLikelihood).toBeLessThanOrEqual(medium.successLikelihood);
      expect(medium.successLikelihood).toBeLessThanOrEqual(high.successLikelihood);

      // Success likelihood values in [0, 1]
      expect(low.successLikelihood).toBeGreaterThan(0);
      expect(high.successLikelihood).toBeLessThanOrEqual(1);

      // Total fee formatted strings
      expect(low.totalFeeXLM).toMatch(/XLM$/);
      expect(medium.totalFeeXLM).toMatch(/XLM$/);
      expect(high.totalFeeXLM).toMatch(/XLM$/);

      // Cost difference relative to low
      expect(low.costDifferenceVsLow.stroops).toBe(0);
      expect(medium.costDifferenceVsLow.stroops).toBe(medium.totalFee - low.totalFee);
      expect(high.costDifferenceVsLow.stroops).toBe(high.totalFee - low.totalFee);

      // Recommended strategy at normal load 0.55 is medium
      expect(report.recommendedTier).toBe('medium');
      expect(medium.isRecommended).toBe(true);
      expect(low.isRecommended).toBe(false);

      // Balance coverage
      expect(low.canCoverFee).toBe(true);
      expect(medium.canCoverFee).toBe(true);
      expect(high.canCoverFee).toBe(true);

      // Execution trace
      expect(report.executionTrace.length).toBeGreaterThan(0);
    });
  });

  describe('Boundary Cases', () => {
    it('handles peak network congestion (load = 1.2) by recommending high priority strategy', async () => {
      const report = await compareFeeStrategiesDryRun({
        sourceAccount: VALID_SOURCE_ACCOUNT,
        operations: [
          {
            type: 'payment',
            destination: VALID_DESTINATION,
            amount: '5',
          },
        ],
        network: 'testnet',
        currentLedgerLoad: 1.2,
      });

      expect(report.valid).toBe(true);
      expect(report.recommendedTier).toBe('high');
      expect(report.strategies.high.isRecommended).toBe(true);
      expect(report.strategies.low.warnings.some((w) => w.toLowerCase().includes('congestion'))).toBe(true);
      expect(report.strategies.low.successLikelihood).toBeLessThan(report.strategies.high.successLikelihood);
    });

    it('handles zero network congestion (load = 0.1) by recommending low economy strategy', async () => {
      const report = await compareFeeStrategiesDryRun({
        sourceAccount: VALID_SOURCE_ACCOUNT,
        operations: [
          {
            type: 'payment',
            destination: VALID_DESTINATION,
            amount: '5',
          },
        ],
        network: 'testnet',
        currentLedgerLoad: 0.1,
      });

      expect(report.valid).toBe(true);
      expect(report.recommendedTier).toBe('low');
      expect(report.strategies.low.isRecommended).toBe(true);
      expect(report.strategies.low.successLikelihoodPercent).toBeGreaterThanOrEqual(80);
    });

    it('scales fees proportionally for multi-operation batches (10 operations)', async () => {
      const ops = Array.from({ length: 10 }, () => ({
        type: 'payment',
        destination: VALID_DESTINATION,
        amount: '1',
      }));

      const report = await compareFeeStrategiesDryRun({
        sourceAccount: VALID_SOURCE_ACCOUNT,
        operations: ops,
        network: 'testnet',
      });

      expect(report.operationCount).toBe(10);
      expect(report.strategies.low.totalFee).toBe(report.strategies.low.baseFee * 10);
      expect(report.strategies.medium.totalFee).toBe(report.strategies.medium.baseFee * 10);
      expect(report.strategies.high.totalFee).toBe(report.strategies.high.baseFee * 10);
      expect(report.strategies.low.totalFee).toBeGreaterThanOrEqual(1000); // 10 ops * 100 stroops min
    });

    it('applies custom fee overrides when specified', async () => {
      const report = await compareFeeStrategiesDryRun({
        sourceAccount: VALID_SOURCE_ACCOUNT,
        operations: [
          {
            type: 'payment',
            destination: VALID_DESTINATION,
            amount: '1',
          },
        ],
        network: 'testnet',
        customFeeOverrides: {
          low: 150,
          medium: 300,
          high: 600,
        },
      });

      expect(report.strategies.low.baseFee).toBe(150);
      expect(report.strategies.medium.baseFee).toBe(300);
      expect(report.strategies.high.baseFee).toBe(600);
    });

    it('detects insufficient account balance and adds warning', async () => {
      const report = await compareFeeStrategiesDryRun({
        sourceAccount: VALID_SOURCE_ACCOUNT,
        operations: [
          {
            type: 'payment',
            destination: VALID_DESTINATION,
            amount: '1',
          },
        ],
        network: 'testnet',
        accountBalance: '50 stroops', // 50 stroops (less than minimum 100 stroops fee)
      });

      expect(report.strategies.low.canCoverFee).toBe(false);
      expect(report.strategies.high.canCoverFee).toBe(false);
      expect(report.strategies.high.warnings.some((w) => w.toLowerCase().includes('insufficient'))).toBe(true);
    });
  });

  describe('Failure Cases and Unsupported Environments', () => {
    it('handles missing or invalid source account with clear error message', async () => {
      const report = await compareFeeStrategiesDryRun({
        sourceAccount: 'invalid-address',
        operations: [
          {
            type: 'payment',
            destination: VALID_DESTINATION,
            amount: '1',
          },
        ],
        network: 'testnet',
      });

      expect(report.valid).toBe(false);
      expect(report.validationErrors).toContain('Source account is not a valid ed25519 public key.');
      expect(report.strategies.low.successLikelihood).toBe(0);
      expect(report.strategies.medium.successLikelihood).toBe(0);
      expect(report.strategies.high.successLikelihood).toBe(0);
    });

    it('handles empty operations array gracefully', async () => {
      const report = await compareFeeStrategiesDryRun({
        sourceAccount: VALID_SOURCE_ACCOUNT,
        operations: [],
        network: 'testnet',
      });

      expect(report.valid).toBe(false);
      expect(report.validationErrors).toContain('At least one operation is required for fee strategy comparison.');
    });

    it('handles invalid operation parameters (negative amount and invalid destination)', async () => {
      const report = await compareFeeStrategiesDryRun({
        sourceAccount: VALID_SOURCE_ACCOUNT,
        operations: [
          {
            type: 'payment',
            destination: 'not-a-destination',
            amount: '-5',
          },
        ],
        network: 'testnet',
      });

      expect(report.valid).toBe(false);
      expect(report.validationErrors).toContain('Operation 1: Invalid destination address.');
      expect(report.validationErrors).toContain('Operation 1: Amount must be greater than zero.');
    });

    it('handles unsupported network environment with clear diagnostic error', async () => {
      const report = await compareFeeStrategiesDryRun({
        sourceAccount: VALID_SOURCE_ACCOUNT,
        operations: [
          {
            type: 'payment',
            destination: VALID_DESTINATION,
            amount: '1',
          },
        ],
        network: 'unsupported-stellar-network',
      });

      expect(report.valid).toBe(false);
      expect(report.isUnsupportedEnvironment).toBe(true);
      expect(report.environmentError).toContain('Unsupported network');
    });

    it('handles offline environment flag gracefully with clear warning', async () => {
      const report = await compareFeeStrategiesDryRun({
        sourceAccount: VALID_SOURCE_ACCOUNT,
        operations: [
          {
            type: 'payment',
            destination: VALID_DESTINATION,
            amount: '1',
          },
        ],
        network: 'testnet',
        isOffline: true,
      });

      expect(report.isUnsupportedEnvironment).toBe(true);
      expect(report.environmentError).toContain('Network is offline');
      expect(report.validationWarnings.some((w) => w.toLowerCase().includes('offline'))).toBe(true);
    });
  });
});
