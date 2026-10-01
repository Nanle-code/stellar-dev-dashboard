import { describe, it, expect } from 'vitest';
import { OPERATION_LABELS, getOperationLabel } from '../src/operationLabels.js';

describe('Operation Labels', () => {
  describe('OPERATION_LABELS', () => {
    it('should have labels for all known operation types', () => {
      expect(OPERATION_LABELS.create_account).toBe('Create Account');
      expect(OPERATION_LABELS.payment).toBe('Payment');
      expect(OPERATION_LABELS.path_payment_strict_send).toBe('Path Payment (Send)');
      expect(OPERATION_LABELS.path_payment_strict_receive).toBe('Path Payment (Receive)');
      expect(OPERATION_LABELS.manage_buy_offer).toBe('Buy Offer');
      expect(OPERATION_LABELS.manage_sell_offer).toBe('Sell Offer');
      expect(OPERATION_LABELS.change_trust).toBe('Change Trust');
      expect(OPERATION_LABELS.invoke_host_function).toBe('Contract Call');
    });

    it('should have Soroban operation labels', () => {
      expect(OPERATION_LABELS.liquidity_pool_deposit).toBe('Liquidity Pool Deposit');
      expect(OPERATION_LABELS.liquidity_pool_withdraw).toBe('Liquidity Pool Withdraw');
      expect(OPERATION_LABELS.extend_footprint_ttl).toBe('Extend Footprint TTL');
      expect(OPERATION_LABELS.restore_footprint).toBe('Restore Footprint');
    });

    it('should have sponsorship labels', () => {
      expect(OPERATION_LABELS.begin_sponsoring_future_reserves).toBe('Begin Sponsoring Future Reserves');
      expect(OPERATION_LABELS.end_sponsoring_future_reserves).toBe('End Sponsoring Future Reserves');
      expect(OPERATION_LABELS.revoke_sponsorship).toBe('Revoke Sponsorship');
    });
  });

  describe('getOperationLabel', () => {
    it('should return known label for known operation', () => {
      expect(getOperationLabel('payment')).toBe('Payment');
      expect(getOperationLabel('create_account')).toBe('Create Account');
    });

    it('should format unknown operation type', () => {
      expect(getOperationLabel('unknown_operation')).toBe('Unknown Operation');
      expect(getOperationLabel('some_custom_type')).toBe('Some Custom Type');
    });

    it('should handle empty string', () => {
      expect(getOperationLabel('')).toBe('');
    });
  });
});