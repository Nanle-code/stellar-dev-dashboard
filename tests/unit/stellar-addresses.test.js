import { describe, it, expect, vi } from 'vitest'
import {
  isValidPublicKey,
  isValidEd25519PublicKey,
  isValidMuxedAccount,
  isFederatedAddress,
  parseMuxedAccount,
  resolveAddress,
} from '../../src/lib/stellar'

describe('Stellar Address Handling', () => {
  // Test data
  const testEd25519 = 'GDN577S7IL2PEASLGLFODVKKS7IOJ6PYR2QF22GFROACDVHSI4R2ACPO'
  const testMuxed = 'MDN577S7IL2PEASLGLFODVKKS7IOJ6PYR2QF22GFROACDVHSI4R2AAAAAAAAAAAE2LMCA'
  const testFederated = 'user@example.com'
  const testFederatedWithDots = 'my.name@stellar.example.org'

  describe('Ed25519 validation (G...)', () => {
    it('should validate a valid Ed25519 public key', () => {
      expect(isValidEd25519PublicKey(testEd25519)).toBe(true)
    })

    it('should reject invalid Ed25519 keys', () => {
      expect(isValidEd25519PublicKey('INVALID')).toBe(false)
      expect(isValidEd25519PublicKey('G' + 'A'.repeat(55))).toBe(false)
      expect(isValidEd25519PublicKey('')).toBe(false)
    })
  })

  describe('Muxed account validation (M...)', () => {
    it('should validate a valid muxed account', () => {
      expect(isValidMuxedAccount(testMuxed)).toBe(true)
    })

    it('should reject non-muxed accounts', () => {
      expect(isValidMuxedAccount(testEd25519)).toBe(false)
      expect(isValidMuxedAccount('INVALID')).toBe(false)
      expect(isValidMuxedAccount('')).toBe(false)
    })
  })

  describe('Federated address validation', () => {
    it('should validate a federated address (name@domain)', () => {
      expect(isFederatedAddress(testFederated)).toBe(true)
      expect(isFederatedAddress(testFederatedWithDots)).toBe(true)
    })

    it('should reject invalid federated addresses', () => {
      expect(isFederatedAddress(testEd25519)).toBe(false)
      expect(isFederatedAddress(testMuxed)).toBe(false)
      expect(isFederatedAddress('@example.com')).toBe(false)
      expect(isFederatedAddress('user@')).toBe(false)
      expect(isFederatedAddress('user')).toBe(false)
      expect(isFederatedAddress('')).toBe(false)
    })
  })

  describe('Muxed account parsing', () => {
    it('should parse a muxed account and extract master account and ID', () => {
      const result = parseMuxedAccount(testMuxed)
      expect(result).not.toBeNull()
      expect(result?.masterAccount).toBeDefined()
      expect(result?.masterAccount).toMatch(/^G[A-Z2-7]{55}$/)
      expect(result?.muxedId).toBeDefined()
    })

    it('should return null for invalid muxed accounts', () => {
      expect(parseMuxedAccount(testEd25519)).toBeNull()
      expect(parseMuxedAccount('INVALID')).toBeNull()
      expect(parseMuxedAccount('')).toBeNull()
    })
  })

  describe('Universal address validation (isValidPublicKey)', () => {
    it('should accept Ed25519 public keys (G...)', () => {
      expect(isValidPublicKey(testEd25519)).toBe(true)
    })

    it('should accept muxed accounts (M...)', () => {
      expect(isValidPublicKey(testMuxed)).toBe(true)
    })

    it('should accept federated addresses', () => {
      expect(isValidPublicKey(testFederated)).toBe(true)
      expect(isValidPublicKey(testFederatedWithDots)).toBe(true)
    })

    it('should reject invalid addresses', () => {
      expect(isValidPublicKey('INVALID')).toBe(false)
      expect(isValidPublicKey('')).toBe(false)
      expect(isValidPublicKey(null)).toBe(false)
      expect(isValidPublicKey(undefined)).toBe(false)
    })

    it('should handle whitespace', () => {
      expect(isValidPublicKey('  ' + testEd25519 + '  ')).toBe(true)
      expect(isValidPublicKey('  ' + testMuxed + '  ')).toBe(true)
      expect(isValidPublicKey('  ' + testFederated + '  ')).toBe(true)
    })
  })

  describe('Address resolution', () => {
    it('should resolve Ed25519 public keys', async () => {
      const result = await resolveAddress(testEd25519, 'testnet')
      expect(result).not.toBeNull()
      expect(result?.accountId).toBe(testEd25519)
      expect(result?.inputType).toBe('ed25519')
      expect(result?.muxedId).toBeUndefined()
    })

    it('should resolve muxed accounts and extract ID', async () => {
      const result = await resolveAddress(testMuxed, 'testnet')
      expect(result).not.toBeNull()
      expect(result?.accountId).toMatch(/^G[A-Z2-7]{55}$/)
      expect(result?.inputType).toBe('muxed')
      expect(result?.muxedId).toBeDefined()
      expect(result?.originalInput).toBe(testMuxed)
    })

    it('should reject invalid addresses', async () => {
      const result = await resolveAddress('INVALID', 'testnet')
      expect(result).toBeNull()
    })

    it('should handle whitespace and trim input', async () => {
      const result = await resolveAddress('  ' + testEd25519 + '  ', 'testnet')
      expect(result).not.toBeNull()
      expect(result?.accountId).toBe(testEd25519)
    })
  })
})
