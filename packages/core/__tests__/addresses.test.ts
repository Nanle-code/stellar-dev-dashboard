import { describe, it, expect, vi } from 'vitest';
import {
  isValidEd25519PublicKey,
  isValidMuxedAccount,
  isFederatedAddress,
  parseMuxedAccount,
  isValidPublicKey,
  isValidContractId,
} from '../src/addresses.js';
import * as StellarSdk from '@stellar/stellar-sdk';

describe('Addresses', () => {
  describe('isValidEd25519PublicKey', () => {
    it('should validate correct Ed25519 public key', () => {
      const key = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
      expect(isValidEd25519PublicKey(key)).toBe(true);
    });

    it('should reject invalid key', () => {
      expect(isValidEd25519PublicKey('invalid')).toBe(false);
    });

    it('should reject M... key', () => {
      expect(isValidEd25519PublicKey('MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')).toBe(false);
    });
  });

  describe('isValidMuxedAccount', () => {
    it('should validate correct muxed account', () => {
      const muxed = StellarSdk.MuxedAccount.fromAddress(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '12345'
      );
      expect(isValidMuxedAccount(muxed.toString())).toBe(true);
    });

    it('should reject G... key', () => {
      expect(isValidMuxedAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')).toBe(false);
    });

    it('should reject invalid format', () => {
      expect(isValidMuxedAccount('invalid')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isValidMuxedAccount(null as any)).toBe(false);
      expect(isValidMuxedAccount(undefined as any)).toBe(false);
    });
  });

  describe('isFederatedAddress', () => {
    it('should validate name*domain format', () => {
      expect(isFederatedAddress('user*example.com')).toBe(true);
      expect(isFederatedAddress('user.name*sub.domain.org')).toBe(true);
    });

    it('should validate email-style format', () => {
      expect(isFederatedAddress('user@example.com')).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(isFederatedAddress('user')).toBe(false);
      expect(isFederatedAddress('user@')).toBe(false);
      expect(isFederatedAddress('*example.com')).toBe(false);
      expect(isFederatedAddress('user*.com')).toBe(false);
    });

    it('should reject empty', () => {
      expect(isFederatedAddress('')).toBe(false);
      expect(isFederatedAddress('   ')).toBe(false);
    });
  });

  describe('parseMuxedAccount', () => {
    it('should parse valid muxed account', () => {
      const muxed = StellarSdk.MuxedAccount.fromAddress(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '12345'
      );
      const result = parseMuxedAccount(muxed.toString());
      expect(result).not.toBeNull();
      expect(result?.masterAccount).toBe('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
      expect(result?.muxedId).toBe('12345');
    });

    it('should return null for invalid muxed', () => {
      expect(parseMuxedAccount('invalid')).toBeNull();
    });

    it('should return null for G... key', () => {
      expect(parseMuxedAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')).toBeNull();
    });
  });

  describe('isValidPublicKey', () => {
    it('should accept G... key', () => {
      expect(isValidPublicKey('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')).toBe(true);
    });

    it('should accept M... muxed account', () => {
      const muxed = StellarSdk.MuxedAccount.fromAddress(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '12345'
      );
      expect(isValidPublicKey(muxed.toString())).toBe(true);
    });

    it('should accept federated address', () => {
      expect(isValidPublicKey('user*example.com')).toBe(true);
    });

    it('should reject invalid', () => {
      expect(isValidPublicKey('invalid')).toBe(false);
      expect(isValidPublicKey('')).toBe(false);
    });
  });

  describe('isValidContractId', () => {
    it('should validate correct contract ID', () => {
      const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
      expect(isValidContractId(contractId)).toBe(true);
    });

    it('should reject G... key', () => {
      expect(isValidContractId('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')).toBe(false);
    });

    it('should reject invalid format', () => {
      expect(isValidContractId('invalid')).toBe(false);
    });
  });
});