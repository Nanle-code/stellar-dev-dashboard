/**
 * DID Authentication Integration with Wallets
 * Provides authentication flows using DIDs with Stellar wallets
 */

import { Keypair } from '@stellar/stellar-sdk'
import {
  generateDID,
  generateChallenge,
  signChallenge,
  verifyChallengeResponse,
  resolveDID,
  type DIDAuthenticationChallenge,
  type DIDAuthenticationResponse,
} from './did'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DIDAuthSession {
  sessionId: string
  challenge: DIDAuthenticationChallenge
  did: string | null
  timestamp: number
  expiresAt: number
}

export interface DIDAuthResult {
  success: boolean
  did: string | null
  error?: string
}

export interface WalletAuthOptions {
  domain?: string
  challengeExpiryMs?: number
}

export interface DIDAuthState {
  isAuthenticated: boolean
  did: string | null
  session: DIDAuthSession | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CHALLENGE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes
const SESSION_STORAGE_KEY = 'did:auth:session'

// ─── Session Management ────────────────────────────────────────────────────────

/**
 * Create a new DID authentication session
 */
export function createAuthSession(domain: string = window.location.hostname): DIDAuthSession {
  const challenge = generateChallenge(domain)
  return {
    sessionId: crypto.randomUUID(),
    challenge,
    did: null,
    timestamp: Date.now(),
    expiresAt: challenge.expiresAt,
  }
}

/**
 * Store an auth session
 */
export function storeAuthSession(session: DIDAuthSession): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch (error) {
    console.error('Failed to store auth session:', error)
  }
}

/**
 * Retrieve an auth session
 */
export function getAuthSession(): DIDAuthSession | null {
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!stored) return null

    const session = JSON.parse(stored) as DIDAuthSession

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }

    return session
  } catch {
    return null
  }
}

/**
 * Clear an auth session
 */
export function clearAuthSession(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear auth session:', error)
  }
}

/**
 * Update an auth session with DID
 */
export function updateAuthSessionWithDID(sessionId: string, did: string): DIDAuthSession | null {
  const session = getAuthSession()
  if (!session || session.sessionId !== sessionId) {
    return null
  }

  session.did = did
  storeAuthSession(session)
  return session
}

// ─── Wallet Authentication ─────────────────────────────────────────────────────

/**
 * Authenticate with a wallet using DID
 */
export async function authenticateWithWallet(
  publicKey: string,
  signature: string,
  sessionId: string
): Promise<DIDAuthResult> {
  try {
    const session = getAuthSession()
    if (!session) {
      return { success: false, did: null, error: 'No active authentication session' }
    }

    if (session.sessionId !== sessionId) {
      return { success: false, did: null, error: 'Invalid session ID' }
    }

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      clearAuthSession()
      return { success: false, did: null, error: 'Session expired' }
    }

    // Generate DID from public key
    const did = generateDID(publicKey)

    // Create response object
    const response: DIDAuthenticationResponse = {
      did,
      signature,
      challenge: session.challenge.challenge,
      timestamp: Date.now(),
    }

    // Verify the challenge response
    const isValid = await verifyChallengeResponse(response, session.challenge)

    if (!isValid) {
      return { success: false, did: null, error: 'Invalid signature' }
    }

    // Update session with DID
    updateAuthSessionWithDID(sessionId, did)

    return { success: true, did, error: undefined }
  } catch (error) {
    return {
      success: false,
      did: null,
      error: error instanceof Error ? error.message : 'Authentication failed',
    }
  }
}

/**
 * Sign a challenge with a wallet keypair
 */
export function signChallengeWithWallet(
  keypair: Keypair,
  sessionId: string
): { signature: string; did: string } | null {
  try {
    const session = getAuthSession()
    if (!session || session.sessionId !== sessionId) {
      return null
    }

    const response = signChallenge(keypair, session.challenge)
    return {
      signature: response.signature,
      did: response.did,
    }
  } catch {
    return null
  }
}

/**
 * Start a new authentication flow
 */
export function startAuthFlow(domain?: string): DIDAuthSession {
  clearAuthSession()
  const session = createAuthSession(domain)
  storeAuthSession(session)
  return session
}

/**
 * Complete an authentication flow
 */
export function completeAuthFlow(sessionId: string): DIDAuthResult {
  const session = getAuthSession()
  if (!session || session.sessionId !== sessionId) {
    return { success: false, did: null, error: 'Invalid session' }
  }

  if (!session.did) {
    return { success: false, did: null, error: 'Authentication not completed' }
  }

  return { success: true, did: session.did }
}

/**
 * Cancel an authentication flow
 */
export function cancelAuthFlow(): void {
  clearAuthSession()
}

// ─── DID Resolution for Authentication ─────────────────────────────────────────

/**
 * Resolve DID for authentication purposes
 */
export async function resolveDIDForAuth(did: string): Promise<{
  valid: boolean
  didDocument: any
  error?: string
}> {
  try {
    const result = await resolveDID(did)

    if (result.didResolutionMetadata.error) {
      return {
        valid: false,
        didDocument: null,
        error: result.didResolutionMetadata.error,
      }
    }

    return {
      valid: true,
      didDocument: result.didDocument,
    }
  } catch (error) {
    return {
      valid: false,
      didDocument: null,
      error: error instanceof Error ? error.message : 'DID resolution failed',
    }
  }
}

// ─── Authentication State Management ─────────────────────────────────────────

/**
 * Get current authentication state
 */
export function getAuthState(): DIDAuthState {
  const session = getAuthSession()
  return {
    isAuthenticated: session !== null && session.did !== null,
    did: session?.did || null,
    session,
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const state = getAuthState()
  return state.isAuthenticated
}

/**
 * Get authenticated DID
 */
export function getAuthenticatedDID(): string | null {
  const state = getAuthState()
  return state.did
}

/**
 * Logout (clear authentication)
 */
export function logout(): void {
  clearAuthSession()
}

// ─── Freighter Integration ─────────────────────────────────────────────────────

/**
 * Authenticate with Freighter wallet using DID
 */
export async function authenticateWithFreighter(): Promise<DIDAuthResult> {
  try {
    // Check if Freighter is available
    if (!window.freighterApi) {
      return { success: false, did: null, error: 'Freighter wallet not found' }
    }

    // Start auth flow
    const session = startAuthFlow()

    // Get public key from Freighter
    const publicKey = await window.freighterApi.getPublicKey()
    if (!publicKey || typeof publicKey !== 'string') {
      return { success: false, did: null, error: 'Failed to get public key from Freighter' }
    }

    // Sign the challenge with Freighter
    const message = JSON.stringify(session.challenge)
    const signature = await window.freighterApi.signMessage(message)

    if (!signature) {
      return { success: false, did: null, error: 'Failed to sign message with Freighter' }
    }

    // Authenticate with the signature
    return await authenticateWithWallet(publicKey, signature, session.sessionId)
  } catch (error) {
    return {
      success: false,
      did: null,
      error: error instanceof Error ? error.message : 'Freighter authentication failed',
    }
  }
}

/**
 * Disconnect Freighter wallet
 */
export function disconnectFreighter(): void {
  logout()
}

// ─── Ledger Integration ───────────────────────────────────────────────────────

/**
 * Authenticate with Ledger wallet using DID
 */
export async function authenticateWithLedger(publicKey: string): Promise<DIDAuthResult> {
  try {
    // Start auth flow
    const session = startAuthFlow()

    // Note: Ledger signing would need to be implemented separately
    // This is a placeholder for the Ledger integration
    // In a real implementation, you would use the Ledger device to sign the challenge

    return {
      success: false,
      did: null,
      error: 'Ledger authentication requires device interaction - not implemented in this placeholder',
    }
  } catch (error) {
    return {
      success: false,
      did: null,
      error: error instanceof Error ? error.message : 'Ledger authentication failed',
    }
  }
}

/**
 * Disconnect Ledger wallet
 */
export function disconnectLedger(): void {
  logout()
}

// ─── Authentication Utilities ─────────────────────────────────────────────────

/**
 * Validate a DID for authentication
 */
export function validateDIDForAuth(did: string): boolean {
  try {
    // Basic validation - check if it's a valid Stellar DID
    return did.startsWith('did:stellar:') && did.split(':').length === 4
  } catch {
    return false
  }
}

/**
 * Get authentication error message
 */
export function getAuthErrorMessage(error: string | undefined): string {
  if (!error) return 'Unknown error'

  const errorMessages: Record<string, string> = {
    'No active authentication session': 'Please start a new authentication session',
    'Invalid session ID': 'Invalid session, please try again',
    'Session expired': 'Session expired, please start a new authentication',
    'Invalid signature': 'Signature verification failed',
    'Freighter wallet not found': 'Please install the Freighter wallet extension',
    'Failed to get public key from Freighter': 'Could not retrieve public key from wallet',
    'Failed to sign message with Freighter': 'Could not sign message with wallet',
  }

  return errorMessages[error] || error
}

/**
 * Check if authentication session is valid
 */
export function isSessionValid(): boolean {
  const session = getAuthSession()
  if (!session) return false

  return Date.now() <= session.expiresAt
}

/**
 * Get time until session expiration
 */
export function getSessionTimeRemaining(): number {
  const session = getAuthSession()
  if (!session) return 0

  return Math.max(0, session.expiresAt - Date.now())
}

// ─── Type Extensions ───────────────────────────────────────────────────────────

declare global {
  interface Window {
    freighterApi?: {
      getPublicKey: () => Promise<string | null>
      signMessage: (message: string) => Promise<string | null>
      signTransaction: (xdr: string) => Promise<string | null>
      isConnected: () => Promise<boolean>
    }
  }
}
