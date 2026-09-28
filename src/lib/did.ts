/**
 * Decentralized Identity (DID) Library for Stellar
 * Implements W3C DID Core specification for Stellar-based DIDs
 * @see https://www.w3.org/TR/did-core/
 */

import { StrKey, Keypair, xdr } from '@stellar/stellar-sdk'
import { v4 as uuidv4 } from 'uuid'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DIDDocument {
  '@context': string | string[]
  id: string
  alsoKnownAs?: string[]
  controller?: string | string[]
  verificationMethod: VerificationMethod[]
  authentication: string | string[] | VerificationMethod[]
  assertionMethod?: string | string[] | VerificationMethod[]
  keyAgreement?: string | string[] | VerificationMethod[]
  capabilityInvocation?: string | string[] | VerificationMethod[]
  capabilityDelegation?: string | string[] | VerificationMethod[]
  service?: ServiceEndpoint[]
  created?: string
  updated?: string
  deactivated?: boolean
}

export interface VerificationMethod {
  id: string
  type: string
  controller: string
  publicKeyBase58?: string
  publicKeyJwk?: JsonWebKey
  publicKeyMultibase?: string
}

export interface ServiceEndpoint {
  id: string
  type: string
  serviceEndpoint: string | Record<string, unknown>
  description?: string
}

export interface JsonWebKey {
  kty: string
  crv?: string
  x?: string
  y?: string
  kid?: string
  [key: string]: string | undefined
}

export interface DIDResolutionResult {
  didDocument: DIDDocument
  didResolutionMetadata: Record<string, unknown>
  didDocumentMetadata: Record<string, unknown>
}

export interface DIDResolutionMetadata {
  contentType?: string
  error?: string
}

export interface DIDDocumentMetadata {
  created?: string
  updated?: string
  deactivated?: boolean
  versionId?: string
  nextVersionId?: string
  nextUpdate?: string
  equivalentId?: string
  canonicalId?: string
}

export interface DIDCreateOptions {
  network?: string
  services?: ServiceEndpoint[]
  additionalContexts?: string[]
}

export interface DIDAuthenticationChallenge {
  challenge: string
  domain: string
  timestamp: number
  expiresAt: number
}

export interface DIDAuthenticationResponse {
  did: string
  signature: string
  challenge: string
  timestamp: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STELLAR_DID_METHOD = 'stellar'
const DEFAULT_DID_CONTEXT = 'https://www.w3.org/ns/did/v1'
const STELLAR_DID_CONTEXT = 'https://stellar.org/did/v1'

const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

// ─── DID Generation ─────────────────────────────────────────────────────────────

/**
 * Generate a Stellar DID from a public key
 * Format: did:stellar:<network>:<publicKey>
 */
export function generateDID(publicKey: string, network: string = 'public'): string {
  if (!StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new Error('Invalid Stellar public key')
  }

  const networkSegment = network === 'public' ? 'public' : network
  return `did:${STELLAR_DID_METHOD}:${networkSegment}:${publicKey}`
}

/**
 * Extract public key from a Stellar DID
 */
export function extractPublicKeyFromDID(did: string): string {
  const parts = did.split(':')
  if (parts.length !== 4 || parts[0] !== 'did' || parts[1] !== STELLAR_DID_METHOD) {
    throw new Error('Invalid Stellar DID format')
  }

  const publicKey = parts[3]
  if (!StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new Error('Invalid public key in DID')
  }

  return publicKey
}

/**
 * Extract network from a Stellar DID
 */
export function extractNetworkFromDID(did: string): string {
  const parts = did.split(':')
  if (parts.length !== 4 || parts[0] !== 'did' || parts[1] !== STELLAR_DID_METHOD) {
    throw new Error('Invalid Stellar DID format')
  }

  return parts[2]
}

/**
 * Create a new DID document with a Stellar keypair
 */
export function createDIDDocument(
  keypair: Keypair,
  options: DIDCreateOptions = {}
): DIDDocument {
  const publicKey = keypair.publicKey()
  const network = options.network || 'public'
  const did = generateDID(publicKey, network)

  const verificationMethodId = `${did}#key-1`
  const verificationMethod: VerificationMethod = {
    id: verificationMethodId,
    type: 'Ed25519VerificationKey2020',
    controller: did,
    publicKeyBase58: publicKey,
  }

  const context = [DEFAULT_DID_CONTEXT, STELLAR_DID_CONTEXT]
  if (options.additionalContexts) {
    context.push(...options.additionalContexts)
  }

  const document: DIDDocument = {
    '@context': context,
    id: did,
    verificationMethod: [verificationMethod],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  }

  if (options.services && options.services.length > 0) {
    document.service = options.services
  }

  return document
}

/**
 * Create a DID document from an existing public key
 */
export function createDIDDocumentFromPublicKey(
  publicKey: string,
  options: DIDCreateOptions = {}
): DIDDocument {
  if (!StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new Error('Invalid Stellar public key')
  }

  const network = options.network || 'public'
  const did = generateDID(publicKey, network)

  const verificationMethodId = `${did}#key-1`
  const verificationMethod: VerificationMethod = {
    id: verificationMethodId,
    type: 'Ed25519VerificationKey2020',
    controller: did,
    publicKeyBase58: publicKey,
  }

  const context = [DEFAULT_DID_CONTEXT, STELLAR_DID_CONTEXT]
  if (options.additionalContexts) {
    context.push(...options.additionalContexts)
  }

  const document: DIDDocument = {
    '@context': context,
    id: did,
    verificationMethod: [verificationMethod],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  }

  if (options.services && options.services.length > 0) {
    document.service = options.services
  }

  return document
}

// ─── DID Resolution ────────────────────────────────────────────────────────────

/**
 * Resolve a DID to its DID document
 * For Stellar DIDs, this constructs the document from the public key
 */
export async function resolveDID(did: string): Promise<DIDResolutionResult> {
  try {
    const publicKey = extractPublicKeyFromDID(did)
    const network = extractNetworkFromDID(did)

    const document = createDIDDocumentFromPublicKey(publicKey, { network })

    return {
      didDocument: document,
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
      didDocumentMetadata: {
        created: document.created,
        updated: document.updated,
      },
    }
  } catch (error) {
    return {
      didDocument: {} as DIDDocument,
      didResolutionMetadata: {
        error: 'invalidDid',
        contentType: 'application/did+ld+json',
      },
      didDocumentMetadata: {},
    }
  }
}

/**
 * Validate a DID document
 */
export function validateDIDDocument(document: DIDDocument): boolean {
  if (!document.id || !document.id.startsWith('did:stellar:')) {
    return false
  }

  if (!document.verificationMethod || document.verificationMethod.length === 0) {
    return false
  }

  if (!document.authentication) {
    return false
  }

  // Validate verification methods
  for (const vm of document.verificationMethod) {
    if (!vm.id || !vm.type || !vm.controller) {
      return false
    }

    if (!vm.publicKeyBase58 && !vm.publicKeyJwk && !vm.publicKeyMultibase) {
      return false
    }
  }

  return true
}

// ─── DID Authentication ───────────────────────────────────────────────────────

/**
 * Generate an authentication challenge
 */
export function generateChallenge(domain: string): DIDAuthenticationChallenge {
  const timestamp = Date.now()
  return {
    challenge: uuidv4(),
    domain,
    timestamp,
    expiresAt: timestamp + CHALLENGE_EXPIRY_MS,
  }
}

/**
 * Sign a challenge with a DID
 */
export function signChallenge(
  keypair: Keypair,
  challenge: DIDAuthenticationChallenge
): DIDAuthenticationResponse {
  const did = generateDID(keypair.publicKey())
  const message = JSON.stringify(challenge)

  const encoder = new TextEncoder()
  const messageBytes = encoder.encode(message)
  const signature = keypair.sign(messageBytes).toString('base64')

  return {
    did,
    signature,
    challenge: challenge.challenge,
    timestamp: Date.now(),
  }
}

/**
 * Verify a challenge response
 */
export async function verifyChallengeResponse(
  response: DIDAuthenticationResponse,
  originalChallenge: DIDAuthenticationChallenge
): Promise<boolean> {
  // Check if challenge matches
  if (response.challenge !== originalChallenge.challenge) {
    return false
  }

  // Check if challenge expired
  if (Date.now() > originalChallenge.expiresAt) {
    return false
  }

  try {
    const publicKey = extractPublicKeyFromDID(response.did)
    const keypair = Keypair.fromPublicKey(publicKey)

    const encoder = new TextEncoder()
    const messageBytes = encoder.encode(JSON.stringify(originalChallenge))
    
    // Decode base64 signature
    const signatureString = atob(response.signature)
    const signatureBytes = new Uint8Array(signatureString.length)
    for (let i = 0; i < signatureString.length; i++) {
      signatureBytes[i] = signatureString.charCodeAt(i)
    }

    return keypair.verify(messageBytes, signatureBytes)
  } catch {
    return false
  }
}

// ─── DID Document Management ───────────────────────────────────────────────────

/**
 * Add a service endpoint to a DID document
 */
export function addServiceEndpoint(
  document: DIDDocument,
  service: ServiceEndpoint
): DIDDocument {
  const updated = { ...document }
  if (!updated.service) {
    updated.service = []
  }
  updated.service = [...updated.service, service]
  updated.updated = new Date().toISOString()
  return updated
}

/**
 * Remove a service endpoint from a DID document
 */
export function removeServiceEndpoint(
  document: DIDDocument,
  serviceId: string
): DIDDocument {
  const updated = { ...document }
  if (updated.service) {
    updated.service = updated.service.filter(s => s.id !== serviceId)
  }
  updated.updated = new Date().toISOString()
  return updated
}

/**
 * Add a verification method to a DID document
 */
export function addVerificationMethod(
  document: DIDDocument,
  method: VerificationMethod
): DIDDocument {
  const updated = { ...document }
  updated.verificationMethod = [...updated.verificationMethod, method]
  updated.updated = new Date().toISOString()
  return updated
}

/**
 * Deactivate a DID document
 */
export function deactivateDIDDocument(document: DIDDocument): DIDDocument {
  return {
    ...document,
    deactivated: true,
    updated: new Date().toISOString(),
  }
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Check if a string is a valid Stellar DID
 */
export function isValidStellarDID(did: string): boolean {
  try {
    extractPublicKeyFromDID(did)
    return true
  } catch {
    return false
  }
}

/**
 * Convert a DID to a Stellar address
 */
export function didToAddress(did: string): string {
  return extractPublicKeyFromDID(did)
}

/**
 * Convert a Stellar address to a DID
 */
export function addressToDID(address: string, network: string = 'public'): string {
  return generateDID(address, network)
}

/**
 * Get the DID method
 */
export function getDIDMethod(did: string): string {
  const parts = did.split(':')
  if (parts.length < 2) {
    throw new Error('Invalid DID format')
  }
  return parts[1]
}
