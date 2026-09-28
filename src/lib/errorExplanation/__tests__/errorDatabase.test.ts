/**
 * Unit tests for error database
 */

import { describe, it, expect } from 'vitest';
import {
  getErrorExplanation,
  searchErrorExplanations,
  getErrorsByCategory,
  getAllErrorCodes
} from '../errorDatabase';

describe('Error Database', () => {
  describe('getErrorExplanation', () => {
    it('returns explanation for known error code', () => {
      const explanation = getErrorExplanation('tx_failed');
      expect(explanation).not.toBeNull();
      expect(explanation?.code).toBe('tx_failed');
      expect(explanation?.title).toBe('Transaction Failed');
    });

    it('returns null for unknown error code', () => {
      const explanation = getErrorExplanation('unknown_error_code');
      expect(explanation).toBeNull();
    });

    it('returns explanation for HTTP status codes', () => {
      const explanation = getErrorExplanation('404');
      expect(explanation).not.toBeNull();
      expect(explanation?.code).toBe('404');
      expect(explanation?.category).toBe('stellar');
    });

    it('returns explanation for Stellar operation codes', () => {
      const explanation = getErrorExplanation('op_no_trust');
      expect(explanation).not.toBeNull();
      expect(explanation?.code).toBe('op_no_trust');
      expect(explanation?.title).toBe('No Trustline');
    });

    it('returns explanation for network errors', () => {
      const explanation = getErrorExplanation('network_error');
      expect(explanation).not.toBeNull();
      expect(explanation?.category).toBe('network');
    });
  });

  describe('searchErrorExplanations', () => {
    it('finds explanations by error code', () => {
      const results = searchErrorExplanations('tx_failed');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].code).toBe('tx_failed');
    });

    it('finds explanations by title', () => {
      const results = searchErrorExplanations('insufficient');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.title.toLowerCase().includes('insufficient'))).toBe(true);
    });

    it('finds explanations by plain explanation', () => {
      const results = searchErrorExplanations('balance');
      expect(results.length).toBeGreaterThan(0);
    });

    it('finds explanations by common causes', () => {
      const results = searchErrorExplanations('network');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty array for no matches', () => {
      const results = searchErrorExplanations('xyz123nonexistent');
      expect(results).toEqual([]);
    });

    it('is case insensitive', () => {
      const results1 = searchErrorExplanations('TX_FAILED');
      const results2 = searchErrorExplanations('tx_failed');
      expect(results1.length).toBeGreaterThan(0);
      expect(results2.length).toBeGreaterThan(0);
    });
  });

  describe('getErrorsByCategory', () => {
    it('returns all stellar errors', () => {
      const results = getErrorsByCategory('stellar');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.category === 'stellar')).toBe(true);
    });

    it('returns all network errors', () => {
      const results = getErrorsByCategory('network');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.category === 'network')).toBe(true);
    });

    it('returns all validation errors', () => {
      const results = getErrorsByCategory('validation');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.category === 'validation')).toBe(true);
    });

    it('returns empty array for unknown category', () => {
      const results = getErrorsByCategory('unknown_category');
      expect(results).toEqual([]);
    });
  });

  describe('getAllErrorCodes', () => {
    it('returns all error codes', () => {
      const codes = getAllErrorCodes();
      expect(codes.length).toBeGreaterThan(0);
      expect(codes).toContain('tx_failed');
      expect(codes).toContain('404');
      expect(codes).toContain('network_error');
    });

    it('returns unique codes', () => {
      const codes = getAllErrorCodes();
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });
  });

  describe('Error Explanation Structure', () => {
    it('has all required fields', () => {
      const explanation = getErrorExplanation('tx_failed');
      expect(explanation).toHaveProperty('code');
      expect(explanation).toHaveProperty('category');
      expect(explanation).toHaveProperty('title');
      expect(explanation).toHaveProperty('plainExplanation');
      expect(explanation).toHaveProperty('technicalDetails');
      expect(explanation).toHaveProperty('commonCauses');
      expect(explanation).toHaveProperty('suggestedSolutions');
      expect(explanation).toHaveProperty('relatedDocs');
      expect(explanation).toHaveProperty('severity');
      expect(explanation).toHaveProperty('retryable');
    });

    it('has valid severity values', () => {
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      const codes = getAllErrorCodes();
      
      codes.forEach(code => {
        const explanation = getErrorExplanation(code);
        if (explanation) {
          expect(validSeverities).toContain(explanation.severity);
        }
      });
    });

    it('has boolean retryable field', () => {
      const codes = getAllErrorCodes();
      
      codes.forEach(code => {
        const explanation = getErrorExplanation(code);
        if (explanation) {
          expect(typeof explanation.retryable).toBe('boolean');
        }
      });
    });

    it('has array fields with correct types', () => {
      const explanation = getErrorExplanation('tx_failed');
      expect(Array.isArray(explanation?.commonCauses)).toBe(true);
      expect(Array.isArray(explanation?.suggestedSolutions)).toBe(true);
      expect(Array.isArray(explanation?.relatedDocs)).toBe(true);
    });
  });

  describe('Coverage of Common Errors', () => {
    it('covers transaction result codes', () => {
      const txCodes = ['tx_success', 'tx_failed', 'tx_too_early', 'tx_too_late', 'tx_bad_seq', 'tx_bad_auth', 'tx_insufficient_balance', 'tx_insufficient_fee'];
      
      txCodes.forEach(code => {
        const explanation = getErrorExplanation(code);
        expect(explanation).not.toBeNull();
        expect(explanation?.category).toBe('stellar');
      });
    });

    it('covers operation result codes', () => {
      const opCodes = ['op_success', 'op_no_destination', 'op_no_trust', 'op_underfunded', 'op_low_reserve', 'op_src_not_authorized'];
      
      opCodes.forEach(code => {
        const explanation = getErrorExplanation(code);
        expect(explanation).not.toBeNull();
        expect(explanation?.category).toBe('stellar');
      });
    });

    it('covers HTTP status codes', () => {
      const httpCodes = ['400', '401', '403', '404', '409', '429', '500', '502', '503', '504'];
      
      httpCodes.forEach(code => {
        const explanation = getErrorExplanation(code);
        expect(explanation).not.toBeNull();
      });
    });

    it('covers network errors', () => {
      const networkCodes = ['network_error', 'timeout'];
      
      networkCodes.forEach(code => {
        const explanation = getErrorExplanation(code);
        expect(explanation).not.toBeNull();
        expect(explanation?.category).toBe('network');
      });
    });

    it('covers Soroban RPC errors', () => {
      const rpcCodes = ['-32600', '-32601', '-32602', '-32603', '-32001', '-32002'];
      
      rpcCodes.forEach(code => {
        const explanation = getErrorExplanation(code);
        expect(explanation).not.toBeNull();
      });
    });
  });
});
