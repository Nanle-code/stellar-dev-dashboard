/**
 * Verifiable Credentials (VC) Library for Stellar
 * Implements W3C Verifiable Credentials Data Model
 * @see https://www.w3.org/TR/vc-data-model/
 */

import { Keypair } from '@stellar/stellar-sdk'
import type { DIDDocument } from './did'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerifiableCredential {
  '@context': string | string[]
  id?: string
  type: string | string[]
  issuer: string
  issuanceDate: string
  expirationDate?: string
  credentialSubject: CredentialSubject | CredentialSubject[]
  credentialStatus?: CredentialStatus
  credentialSchema?: CredentialSchema
  refreshService?: RefreshService
  termsOfUse?: TermsOfUse[]
  evidence?: Evidence[]
  proof: Proof
}

export interface CredentialSubject {
  id?: string
  [key: string]: unknown
}

export interface CredentialStatus {
  id: string
  type: string
  [key: string]: unknown
}

export interface CredentialSchema {
  id: string
  type: string
}

export interface RefreshService {
  id: string
  type: string
  [key: string]: unknown
}

export interface TermsOfUse {
  type: string
  [key: string]: unknown
}

export interface Evidence {
  id?: string
  type: string[] | string
  [key: string]: unknown
}

export interface Proof {
  type: string
  created: string
  verificationMethod: string
  proofPurpose: string
  challenge?: string
  domain?: string
  jws?: string
  proofValue?: string
  [key: string]: unknown
}

export interface Presentation {
  '@context': string | string[]
  type: string | string[]
  verifiableCredential: VerifiableCredential[]
  id?: string
  holder?: string
  proof?: Proof
  [key: string]: unknown
}

export interface CredentialOptions {
  id?: string
  expirationDate?: string
  credentialStatus?: CredentialStatus
  credentialSchema?: CredentialSchema
  evidence?: Evidence[]
}

export interface PresentationOptions {
  id?: string
  holder?: string
  domain?: string
  challenge?: string
}

export interface SelectiveDisclosureOptions {
  revealFields: string[]
  hideFields: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_VC_CONTEXT = 'https://www.w3.org/2018/credentials/v1'
const DEFAULT_VC_TYPE = 'VerifiableCredential'
const DEFAULT_PRESENTATION_TYPE = 'VerifiablePresentation'
const PROOF_TYPE = 'Ed25519Signature2020'
const PROOF_PURPOSE_ASSERTION = 'assertionMethod'
const PROOF_PURPOSE_AUTHENTICATION = 'authentication'

// ─── Credential Creation ────────────────────────────────────────────────────────

/**
 * Create a new verifiable credential
 */
export function createCredential(
  issuerDID: string,
  credentialSubject: CredentialSubject | CredentialSubject[],
  options: CredentialOptions = {}
): Omit<VerifiableCredential, 'proof'> {
  const credential: Omit<VerifiableCredential, 'proof'> = {
    '@context': DEFAULT_VC_CONTEXT,
    type: [DEFAULT_VC_TYPE],
    issuer: issuerDID,
    issuanceDate: new Date().toISOString(),
    credentialSubject,
  }

  if (options.id) {
    credential.id = options.id
  }

  if (options.expirationDate) {
    credential.expirationDate = options.expirationDate
  }

  if (options.credentialStatus) {
    credential.credentialStatus = options.credentialStatus
  }

  if (options.credentialSchema) {
    credential.credentialSchema = options.credentialSchema
  }

  if (options.evidence) {
    credential.evidence = options.evidence
  }

  return credential
}

/**
 * Sign a credential with an issuer keypair
 */
export function signCredential(
  credential: Omit<VerifiableCredential, 'proof'>,
  issuerKeypair: Keypair,
  verificationMethodId: string
): VerifiableCredential {
  const issuerDID = credential.issuer
  const credentialToSign = { ...credential }

  // Remove fields that shouldn't be signed
  delete (credentialToSign as any).proof

  const message = JSON.stringify(credentialToSign)
  const encoder = new TextEncoder()
  const messageBytes = encoder.encode(message)
  const signature = issuerKeypair.sign(messageBytes).toString('base64')

  const proof: Proof = {
    type: PROOF_TYPE,
    created: new Date().toISOString(),
    verificationMethod: verificationMethodId,
    proofPurpose: PROOF_PURPOSE_ASSERTION,
    jws: signature,
  }

  return {
    ...credential,
    proof,
  }
}

/**
 * Verify a verifiable credential
 */
export async function verifyCredential(
  credential: VerifiableCredential,
  issuerDIDDocument: DIDDocument
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check if credential is expired
    if (credential.expirationDate && new Date(credential.expirationDate) < new Date()) {
      return { valid: false, error: 'Credential has expired' }
    }

    // Check if proof exists
    if (!credential.proof) {
      return { valid: false, error: 'Credential has no proof' }
    }

    // Find verification method
    const verificationMethod = issuerDIDDocument.verificationMethod.find(
      vm => vm.id === credential.proof.verificationMethod
    )

    if (!verificationMethod) {
      return { valid: false, error: 'Verification method not found in DID document' }
    }

    // Get public key
    const publicKey = verificationMethod.publicKeyBase58
    if (!publicKey) {
      return { valid: false, error: 'Public key not found in verification method' }
    }

    const keypair = Keypair.fromPublicKey(publicKey)

    // Create credential copy without proof for verification
    const credentialCopy = { ...credential }
    delete (credentialCopy as any).proof

    const message = JSON.stringify(credentialCopy)
    const encoder = new TextEncoder()
    const messageBytes = encoder.encode(message)

    // Decode signature
    const signatureString = credential.proof.jws || credential.proof.proofValue || ''
    const decodedSignature = atob(signatureString)
    const signatureBytes = new Uint8Array(decodedSignature.length)
    for (let i = 0; i < decodedSignature.length; i++) {
      signatureBytes[i] = decodedSignature.charCodeAt(i)
    }

    const isValid = keypair.verify(messageBytes, signatureBytes)

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Verification failed' }
  }
}

// ─── Presentation Creation ────────────────────────────────────────────────────

/**
 * Create a verifiable presentation
 */
export function createPresentation(
  credentials: VerifiableCredential[],
  options: PresentationOptions = {}
): Omit<Presentation, 'proof'> {
  const presentation: Omit<Presentation, 'proof'> = {
    '@context': DEFAULT_VC_CONTEXT,
    type: [DEFAULT_PRESENTATION_TYPE],
    verifiableCredential: credentials,
  }

  if (options.id) {
    presentation.id = options.id
  }

  if (options.holder) {
    presentation.holder = options.holder
  }

  return presentation
}

/**
 * Sign a presentation with a holder keypair
 */
export function signPresentation(
  presentation: Omit<Presentation, 'proof'>,
  holderKeypair: Keypair,
  verificationMethodId: string,
  challenge?: string,
  domain?: string
): Presentation {
  const presentationToSign = { ...presentation }
  delete (presentationToSign as any).proof

  const message = JSON.stringify(presentationToSign)
  const encoder = new TextEncoder()
  const messageBytes = encoder.encode(message)
  const signature = holderKeypair.sign(messageBytes).toString('base64')

  const proof: Proof = {
    type: PROOF_TYPE,
    created: new Date().toISOString(),
    verificationMethod: verificationMethodId,
    proofPurpose: PROOF_PURPOSE_AUTHENTICATION,
  }

  if (challenge) {
    proof.challenge = challenge
  }

  if (domain) {
    proof.domain = domain
  }

  proof.jws = signature

  return {
    ...presentation,
    proof,
  } as Presentation
}

/**
 * Verify a verifiable presentation
 */
export async function verifyPresentation(
  presentation: Presentation,
  holderDIDDocument: DIDDocument,
  challenge?: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check if proof exists
    if (!presentation.proof) {
      return { valid: false, error: 'Presentation has no proof' }
    }

    // Verify challenge if provided
    if (challenge && presentation.proof.challenge !== challenge) {
      return { valid: false, error: 'Challenge mismatch' }
    }

    // Find verification method
    const verificationMethod = holderDIDDocument.verificationMethod.find(
      vm => vm.id === presentation.proof.verificationMethod
    )

    if (!verificationMethod) {
      return { valid: false, error: 'Verification method not found in DID document' }
    }

    // Get public key
    const publicKey = verificationMethod.publicKeyBase58
    if (!publicKey) {
      return { valid: false, error: 'Public key not found in verification method' }
    }

    const keypair = Keypair.fromPublicKey(publicKey)

    // Create presentation copy without proof for verification
    const presentationCopy = { ...presentation }
    delete (presentationCopy as any).proof

    const message = JSON.stringify(presentationCopy)
    const encoder = new TextEncoder()
    const messageBytes = encoder.encode(message)

    // Decode signature
    const signatureString = presentation.proof.jws || presentation.proof.proofValue || ''
    const decodedSignature = atob(signatureString)
    const signatureBytes = new Uint8Array(decodedSignature.length)
    for (let i = 0; i < decodedSignature.length; i++) {
      signatureBytes[i] = decodedSignature.charCodeAt(i)
    }

    const isValid = keypair.verify(messageBytes, signatureBytes)

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' }
    }

    // Verify all credentials in the presentation
    for (const credential of presentation.verifiableCredential) {
      // Note: In a real implementation, you would need to resolve the issuer's DID document
      // For now, we just check that the credential has a valid structure
      if (!credential.proof) {
        return { valid: false, error: 'Credential in presentation has no proof' }
      }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Verification failed' }
  }
}

// ─── Selective Disclosure ───────────────────────────────────────────────────────

/**
 * Create a selective disclosure of a credential
 * This allows revealing only specific fields from a credential
 */
export function createSelectiveDisclosure(
  credential: VerifiableCredential,
  options: SelectiveDisclosureOptions
): VerifiableCredential {
  const selectiveCredential = { ...credential }

  if (Array.isArray(selectiveCredential.credentialSubject)) {
    selectiveCredential.credentialSubject = selectiveCredential.credentialSubject.map(subject => {
      const filteredSubject: CredentialSubject = { id: subject.id }
      
      for (const field of options.revealFields) {
        if (field in subject) {
          (filteredSubject as any)[field] = (subject as any)[field]
        }
      }

      return filteredSubject
    })
  } else {
    const filteredSubject: CredentialSubject = { id: selectiveCredential.credentialSubject.id }
    
    for (const field of options.revealFields) {
      if (field in selectiveCredential.credentialSubject) {
        (filteredSubject as any)[field] = (selectiveCredential.credentialSubject as any)[field]
      }
    }

    selectiveCredential.credentialSubject = filteredSubject
  }

  // Note: In a full implementation, you would need to re-sign the credential
  // with a new proof that covers only the disclosed fields
  // For now, we keep the original proof but this would need to be updated
  // in a production implementation with proper selective disclosure cryptography

  return selectiveCredential
}

/**
 * Check if a credential supports selective disclosure
 */
export function supportsSelectiveDisclosure(credential: VerifiableCredential): boolean {
  // Check if the credential has the necessary structure for selective disclosure
  return (
    credential.credentialSubject !== null &&
    typeof credential.credentialSubject === 'object'
  )
}

// ─── Credential Status ─────────────────────────────────────────────────────────

/**
 * Check if a credential is revoked
 */
export async function checkCredentialStatus(
  credential: VerifiableCredential
): Promise<{ valid: boolean; error?: string }> {
  if (!credential.credentialStatus) {
    // No status means the credential is considered valid
    return { valid: true }
  }

  // In a real implementation, this would make a request to the status service
  // For now, we return valid as a placeholder
  // TODO: Implement actual status checking based on the status type
  return { valid: true }
}

/**
 * Revoke a credential (issuer-side operation)
 */
export function revokeCredential(
  credential: VerifiableCredential,
  revocationReason?: string
): CredentialStatus {
  // In a real implementation, this would update the status service
  // For now, we return a status object as a placeholder
  return {
    id: `${credential.id}#status`,
    type: 'RevocationList2021Status',
    revocationReason,
  }
}

// ─── Credential Utilities ──────────────────────────────────────────────────────

/**
 * Get the credential type
 */
export function getCredentialTypes(credential: VerifiableCredential): string[] {
  if (Array.isArray(credential.type)) {
    return credential.type
  }
  return [credential.type]
}

/**
 * Check if a credential is of a specific type
 */
export function isCredentialType(credential: VerifiableCredential, type: string): boolean {
  return getCredentialTypes(credential).includes(type)
}

/**
 * Get the credential issuer
 */
export function getCredentialIssuer(credential: VerifiableCredential): string {
  return credential.issuer
}

/**
 * Get the credential subject ID
 */
export function getCredentialSubjectId(credential: VerifiableCredential): string | undefined {
  if (Array.isArray(credential.credentialSubject)) {
    return credential.credentialSubject[0]?.id
  }
  return credential.credentialSubject?.id
}

/**
 * Check if a credential is expired
 */
export function isCredentialExpired(credential: VerifiableCredential): boolean {
  if (!credential.expirationDate) {
    return false
  }
  return new Date(credential.expirationDate) < new Date()
}

/**
 * Get the time until credential expiration
 */
export function getTimeUntilExpiration(credential: VerifiableCredential): number | null {
  if (!credential.expirationDate) {
    return null
  }
  const expiration = new Date(credential.expirationDate).getTime()
  const now = Date.now()
  return Math.max(0, expiration - now)
}

/**
 * Validate credential structure
 */
export function validateCredentialStructure(credential: VerifiableCredential): boolean {
  if (!credential['@context']) {
    return false
  }

  if (!credential.type || credential.type.length === 0) {
    return false
  }

  if (!credential.issuer) {
    return false
  }

  if (!credential.issuanceDate) {
    return false
  }

  if (!credential.credentialSubject) {
    return false
  }

  return true
}
