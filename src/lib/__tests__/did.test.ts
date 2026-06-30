/**
 * Tests for DID library
 */

import { describe, it, expect } from 'vitest'
import {
  generateDID,
  extractPublicKeyFromDID,
  extractNetworkFromDID,
  createDIDDocumentFromPublicKey,
  resolveDID,
  validateDIDDocument,
  addServiceEndpoint,
  removeServiceEndpoint,
  deactivateDIDDocument,
  isValidStellarDID,
  didToAddress,
  addressToDID,
} from '../did'
import { Keypair } from '@stellar/stellar-sdk'

describe('DID Library', () => {
  describe('generateDID', () => {
    it('should generate a valid DID from a public key', () => {
      const keypair = Keypair.random()
      const did = generateDID(keypair.publicKey(), 'public')
      
      expect(did).toMatch(/^did:stellar:public:G/)
      expect(did).toContain(keypair.publicKey())
    })

    it('should generate DID with testnet network', () => {
      const keypair = Keypair.random()
      const did = generateDID(keypair.publicKey(), 'testnet')
      
      expect(did).toMatch(/^did:stellar:testnet:G/)
    })

    it('should throw error for invalid public key', () => {
      expect(() => generateDID('invalid-key', 'public')).toThrow()
    })
  })

  describe('extractPublicKeyFromDID', () => {
    it('should extract public key from valid DID', () => {
      const keypair = Keypair.random()
      const did = generateDID(keypair.publicKey(), 'public')
      const extracted = extractPublicKeyFromDID(did)
      
      expect(extracted).toBe(keypair.publicKey())
    })

    it('should throw error for invalid DID format', () => {
      expect(() => extractPublicKeyFromDID('invalid-did')).toThrow()
    })

    it('should throw error for DID with invalid public key', () => {
      expect(() => extractPublicKeyFromDID('did:stellar:public:invalid')).toThrow()
    })
  })

  describe('extractNetworkFromDID', () => {
    it('should extract network from valid DID', () => {
      const keypair = Keypair.random()
      const did = generateDID(keypair.publicKey(), 'testnet')
      const network = extractNetworkFromDID(did)
      
      expect(network).toBe('testnet')
    })

    it('should throw error for invalid DID format', () => {
      expect(() => extractNetworkFromDID('invalid-did')).toThrow()
    })
  })

  describe('createDIDDocumentFromPublicKey', () => {
    it('should create a valid DID document', () => {
      const keypair = Keypair.random()
      const document = createDIDDocumentFromPublicKey(keypair.publicKey(), { network: 'public' })
      
      expect(document.id).toMatch(/^did:stellar:public:G/)
      expect(document['@context']).toBeDefined()
      expect(document.verificationMethod).toHaveLength(1)
      expect(document.authentication).toBeDefined()
      expect(document.created).toBeDefined()
      expect(document.updated).toBeDefined()
    })

    it('should include service endpoints when provided', () => {
      const keypair = Keypair.random()
      const services = [
        {
          id: 'did:stellar:public:G#service-1',
          type: 'DIDCommMessaging',
          serviceEndpoint: 'https://example.com',
        },
      ]
      const document = createDIDDocumentFromPublicKey(keypair.publicKey(), {
        network: 'public',
        services,
      })
      
      expect(document.service).toEqual(services)
    })

    it('should throw error for invalid public key', () => {
      expect(() => createDIDDocumentFromPublicKey('invalid-key')).toThrow()
    })
  })

  describe('resolveDID', () => {
    it('should resolve a valid DID to a DID document', async () => {
      const keypair = Keypair.random()
      const did = generateDID(keypair.publicKey(), 'public')
      const result = await resolveDID(did)
      
      expect(result.didDocument).toBeDefined()
      expect(result.didDocument.id).toBe(did)
      expect(result.didResolutionMetadata.error).toBeUndefined()
    })

    it('should return error for invalid DID', async () => {
      const result = await resolveDID('did:stellar:public:invalid')
      
      expect(result.didResolutionMetadata.error).toBeDefined()
    })
  })

  describe('validateDIDDocument', () => {
    it('should validate a correct DID document', () => {
      const keypair = Keypair.random()
      const document = createDIDDocumentFromPublicKey(keypair.publicKey())
      
      expect(validateDIDDocument(document)).toBe(true)
    })

    it('should reject document without ID', () => {
      const document = {
        '@context': 'https://www.w3.org/ns/did/v1',
        verificationMethod: [],
        authentication: [],
      } as any
      
      expect(validateDIDDocument(document)).toBe(false)
    })

    it('should reject document without verification methods', () => {
      const keypair = Keypair.random()
      const document = createDIDDocumentFromPublicKey(keypair.publicKey())
      document.verificationMethod = []
      
      expect(validateDIDDocument(document)).toBe(false)
    })

    it('should reject document without authentication', () => {
      const keypair = Keypair.random()
      const document = createDIDDocumentFromPublicKey(keypair.publicKey())
      delete document.authentication
      
      expect(validateDIDDocument(document)).toBe(false)
    })
  })

  describe('addServiceEndpoint', () => {
    it('should add a service endpoint to a DID document', () => {
      const keypair = Keypair.random()
      const document = createDIDDocumentFromPublicKey(keypair.publicKey())
      const service = {
        id: `${document.id}#service-1`,
        type: 'DIDCommMessaging',
        serviceEndpoint: 'https://example.com',
      }
      
      const updated = addServiceEndpoint(document, service)
      
      expect(updated.service).toBeDefined()
      expect(updated.service).toHaveLength(1)
      expect(updated.service?.[0]).toEqual(service)
      expect(updated.updated).not.toBe(document.updated)
    })
  })

  describe('removeServiceEndpoint', () => {
    it('should remove a service endpoint from a DID document', () => {
      const keypair = Keypair.random()
      const document = createDIDDocumentFromPublicKey(keypair.publicKey())
      const service = {
        id: `${document.id}#service-1`,
        type: 'DIDCommMessaging',
        serviceEndpoint: 'https://example.com',
      }
      
      const withService = addServiceEndpoint(document, service)
      const withoutService = removeServiceEndpoint(withService, service.id)
      
      expect(withoutService.service).toHaveLength(0)
    })
  })

  describe('deactivateDIDDocument', () => {
    it('should deactivate a DID document', () => {
      const keypair = Keypair.random()
      const document = createDIDDocumentFromPublicKey(keypair.publicKey())
      
      const deactivated = deactivateDIDDocument(document)
      
      expect(deactivated.deactivated).toBe(true)
      expect(deactivated.updated).not.toBe(document.updated)
    })
  })

  describe('isValidStellarDID', () => {
    it('should return true for valid Stellar DID', () => {
      const keypair = Keypair.random()
      const did = generateDID(keypair.publicKey(), 'public')
      
      expect(isValidStellarDID(did)).toBe(true)
    })

    it('should return false for invalid DID', () => {
      expect(isValidStellarDID('invalid-did')).toBe(false)
    })

    it('should return false for DID with invalid public key', () => {
      expect(isValidStellarDID('did:stellar:public:invalid')).toBe(false)
    })
  })

  describe('didToAddress', () => {
    it('should convert DID to Stellar address', () => {
      const keypair = Keypair.random()
      const did = generateDID(keypair.publicKey(), 'public')
      const address = didToAddress(did)
      
      expect(address).toBe(keypair.publicKey())
    })
  })

  describe('addressToDID', () => {
    it('should convert Stellar address to DID', () => {
      const keypair = Keypair.random()
      const did = addressToDID(keypair.publicKey(), 'public')
      
      expect(did).toBe(generateDID(keypair.publicKey(), 'public'))
    })
  })
})
