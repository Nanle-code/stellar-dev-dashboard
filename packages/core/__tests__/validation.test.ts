import { describe, it, expect } from 'vitest';
import {
  validateStellarAddress,
  validateAmount,
  validateMemo,
  validateContractId,
  validateNetwork,
  validateUrl,
  validateHorizonUrl,
  validateSorobanUrl,
  validateNetworkPassphrase,
  composeValidations,
  type ValidationResult,
} from '../src/validation.js';

describe('Validation', () => {
  describe('validateStellarAddress', () => {
    it('should validate G... Ed25519 public key', () => {
      const result = validateStellarAddress('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate M... muxed account', () => {
      const result = validateStellarAddress('MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
      expect(result.valid).toBe(true);
    });

    it('should validate federated address (name*domain)', () => {
      const result = validateStellarAddress('user*example.com');
      expect(result.valid).toBe(true);
    });

    it('should reject empty string', () => {
      const result = validateStellarAddress('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stellar address is required.');
    });

    it('should reject invalid format', () => {
      const result = validateStellarAddress('invalid-address');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid Stellar address. Must be a G... address, M... muxed account, or name*domain federated address.');
    });

    it('should reject whitespace-only', () => {
      const result = validateStellarAddress('   ');
      expect(result.valid).toBe(false);
    });

    it('should trim whitespace', () => {
      const result = validateStellarAddress('  GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF  ');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateAmount', () => {
    it('should validate positive number', () => {
      const result = validateAmount('10.5');
      expect(result.valid).toBe(true);
    });

    it('should validate integer', () => {
      const result = validateAmount(100);
      expect(result.valid).toBe(true);
    });

    it('should reject zero', () => {
      const result = validateAmount('0');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Amount must be greater than zero.');
    });

    it('should reject negative number', () => {
      const result = validateAmount('-10');
      expect(result.valid).toBe(false);
    });

    it('should reject empty string', () => {
      const result = validateAmount('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Amount is required.');
    });

    it('should reject null/undefined', () => {
      expect(validateAmount(null).valid).toBe(false);
      expect(validateAmount(undefined).valid).toBe(false);
    });

    it('should reject NaN', () => {
      const result = validateAmount('not-a-number');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Amount must be a valid number.');
    });

    it('should reject too many decimal places', () => {
      const result = validateAmount('10.12345678');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Amount must have at most 7 decimal places.');
    });

    it('should accept up to 7 decimal places', () => {
      const result = validateAmount('10.1234567');
      expect(result.valid).toBe(true);
    });

    it('should respect min parameter', () => {
      const result = validateAmount('0.5', 1);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Amount must be at least 1.');
    });

    it('should respect max parameter', () => {
      const result = validateAmount('100', 0, 50);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Amount must not exceed 50.');
    });
  });

  describe('validateMemo', () => {
    it('should accept empty memo for non-none types', () => {
      expect(validateMemo('', 'text').valid).toBe(true);
      expect(validateMemo(null, 'id').valid).toBe(true);
      expect(validateMemo(undefined, 'hash').valid).toBe(true);
    });

    it('should accept any value for none type', () => {
      expect(validateMemo('anything', 'none').valid).toBe(true);
    });

    it('should validate text memo <= 28 bytes', () => {
      expect(validateMemo('short memo', 'text').valid).toBe(true);
      expect(validateMemo('a'.repeat(28), 'text').valid).toBe(true);
    });

    it('should reject text memo > 28 bytes', () => {
      const result = validateMemo('a'.repeat(29), 'text');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Memo text must be 28 bytes or fewer.');
    });

    it('should validate memo ID as uint64', () => {
      expect(validateMemo('12345', 'id').valid).toBe(true);
      expect(validateMemo('0', 'id').valid).toBe(true);
      expect(validateMemo('18446744073709551615', 'id').valid).toBe(true);
    });

    it('should reject invalid memo ID', () => {
      expect(validateMemo('abc', 'id').valid).toBe(false);
      expect(validateMemo('-1', 'id').valid).toBe(false);
      expect(validateMemo('18446744073709551616', 'id').valid).toBe(false);
    });

    it('should validate hash memo as 64 hex chars', () => {
      const validHash = 'a'.repeat(64);
      expect(validateMemo(validHash, 'hash').valid).toBe(true);
      expect(validateMemo(validHash.toUpperCase(), 'hash').valid).toBe(true);
    });

    it('should reject invalid hash memo', () => {
      expect(validateMemo('abc', 'hash').valid).toBe(false);
      expect(validateMemo('g'.repeat(64), 'hash').valid).toBe(false);
      expect(validateMemo('a'.repeat(63), 'hash').valid).toBe(false);
      expect(validateMemo('a'.repeat(65), 'hash').valid).toBe(false);
    });

    it('should validate return memo same as hash', () => {
      const validHash = 'b'.repeat(64);
      expect(validateMemo(validHash, 'return').valid).toBe(true);
    });

    it('should reject unsupported memo type', () => {
      const result = validateMemo('test', 'unsupported' as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unsupported memo type: unsupported.');
    });
  });

  describe('validateContractId', () => {
    it('should validate C... contract ID', () => {
      const result = validateContractId('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
      expect(result.valid).toBe(true);
    });

    it('should reject empty', () => {
      expect(validateContractId('').valid).toBe(false);
    });

    it('should reject invalid format', () => {
      expect(validateContractId('GAAAA...').valid).toBe(false);
      expect(validateContractId('invalid').valid).toBe(false);
    });
  });

  describe('validateNetwork', () => {
    it('should accept testnet', () => {
      expect(validateNetwork('testnet').valid).toBe(true);
    });

    it('should accept mainnet', () => {
      expect(validateNetwork('mainnet').valid).toBe(true);
    });

    it('should accept futurenet', () => {
      expect(validateNetwork('futurenet').valid).toBe(true);
    });

    it('should accept local', () => {
      expect(validateNetwork('local').valid).toBe(true);
    });

    it('should accept custom', () => {
      expect(validateNetwork('custom').valid).toBe(true);
    });

    it('should reject invalid network', () => {
      const result = validateNetwork('invalid');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Network must be one of: testnet, mainnet, futurenet, local, custom.');
    });
  });

  describe('validateUrl', () => {
    it('should accept valid HTTP URL', () => {
      expect(validateUrl('http://example.com').valid).toBe(true);
    });

    it('should accept valid HTTPS URL', () => {
      expect(validateUrl('https://example.com').valid).toBe(true);
    });

    it('should reject non-HTTP protocols', () => {
      expect(validateUrl('ftp://example.com').valid).toBe(false);
      expect(validateUrl('ws://example.com').valid).toBe(false);
    });

    it('should reject invalid URL format', () => {
      expect(validateUrl('not-a-url').valid).toBe(false);
      expect(validateUrl('http://').valid).toBe(false);
    });

    it('should handle required=false', () => {
      expect(validateUrl('', false).valid).toBe(true);
      expect(validateUrl(null, false).valid).toBe(true);
      expect(validateUrl(undefined, false).valid).toBe(true);
    });

    it('should require URL when required=true', () => {
      expect(validateUrl('', true).valid).toBe(false);
      expect(validateUrl(null, true).valid).toBe(false);
    });
  });

  describe('validateHorizonUrl', () => {
    it('should accept valid horizon URL', () => {
      expect(validateHorizonUrl('https://horizon-testnet.stellar.org').valid).toBe(true);
    });

    it('should accept custom horizon URL', () => {
      expect(validateHorizonUrl('https://custom.example.com/horizon').valid).toBe(true);
    });
  });

  describe('validateSorobanUrl', () => {
    it('should accept valid soroban URL', () => {
      expect(validateSorobanUrl('https://soroban-testnet.stellar.org').valid).toBe(true);
    });

    it('should accept optional when not required', () => {
      expect(validateSorobanUrl('', false).valid).toBe(true);
    });
  });

  describe('validateNetworkPassphrase', () => {
    it('should accept non-empty string', () => {
      expect(validateNetworkPassphrase('Test SDF Network ; September 2015').valid).toBe(true);
    });

    it('should reject empty when required', () => {
      expect(validateNetworkPassphrase('', true).valid).toBe(false);
    });

    it('should accept empty when not required', () => {
      expect(validateNetworkPassphrase('', false).valid).toBe(true);
    });
  });

  describe('composeValidations', () => {
    it('should combine valid results', () => {
      const result = composeValidations(
        { valid: true, errors: [] },
        { valid: true, errors: [] }
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should combine errors from invalid results', () => {
      const result = composeValidations(
        { valid: false, errors: ['Error 1'] },
        { valid: false, errors: ['Error 2', 'Error 3'] },
        { valid: true, errors: [] }
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Error 1', 'Error 2', 'Error 3']);
    });
  });
});