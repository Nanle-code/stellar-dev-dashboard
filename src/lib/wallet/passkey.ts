/**
 * WebAuthn / Passkey connector for Stellar smart wallets (secp256r1).
 *
 * Protocol 21 added secp256r1 (P-256) signature verification to Soroban,
 * which enables smart-wallet contracts whose __check_auth function validates
 * WebAuthn assertions instead of classical Ed25519 signatures.  These wallets
 * are identified by a contract ID (C-address) rather than a classic G-address.
 *
 * Flow overview
 * ─────────────
 * 1. createPasskey()         — navigator.credentials.create() → stores credentialId
 *                              + compressedPublicKey (from attestation CBOR)
 * 2. assertPasskey()         — navigator.credentials.get()  → returns an
 *                              AuthenticatorAssertionResponse suitable for
 *                              packing into a Soroban auth entry
 * 3. buildSorobanAuthEntry() — wraps the assertion into the XDR structure that
 *                              a passkey smart-wallet contract expects
 * 4. submitViaRelayer()      — posts the signed auth entry + envelope to a
 *                              fee-sponsor / relayer service so that the user
 *                              does not need to hold XLM for fees
 *
 * Browser support
 * ───────────────
 * WebAuthn (navigator.credentials) is available in:
 *   Chrome 67+, Edge 18+, Safari 14+, Firefox 60+
 * Check isPasskeySupported() before calling any other function.
 *
 * Error taxonomy
 * ──────────────
 * PasskeyNotSupportedError  — browser / platform has no authenticator API
 * PasskeyCancelledError     — user dismissed the prompt
 * PasskeyCredentialNotFoundError — stored credential not present on this device
 * PasskeyTimeoutError       — authenticator did not respond in time
 */

import * as StellarSdk from '@stellar/stellar-sdk'

// ─── Constants ────────────────────────────────────────────────────────────────

/** RP ID used when creating / asserting credentials.  Defaults to current hostname. */
function defaultRpId(): string {
  if (typeof window !== 'undefined') return window.location.hostname
  return 'localhost'
}

/** Human-readable name shown in the platform authenticator dialog. */
const RP_NAME = 'Stellar Dev Dashboard'

/** Timeout passed to the browser authenticator (ms). */
const WEBAUTHN_TIMEOUT_MS = 60_000

/** localStorage key for the active passkey credential metadata. */
const PASSKEY_STORAGE_KEY = 'stellar-passkey-credential'

// ─── Custom error types ───────────────────────────────────────────────────────

export class PasskeyNotSupportedError extends Error {
  constructor() {
    super(
      'WebAuthn passkeys are not supported in this browser. ' +
        'Please use Chrome 67+, Edge 18+, Safari 14+, or Firefox 60+.',
    )
    this.name = 'PasskeyNotSupportedError'
  }
}

export class PasskeyCancelledError extends Error {
  constructor() {
    super('The passkey prompt was cancelled. Please try again.')
    this.name = 'PasskeyCancelledError'
  }
}

export class PasskeyCredentialNotFoundError extends Error {
  constructor() {
    super(
      'The passkey credential was not found on this device. ' +
        'Make sure you are using the same device and authenticator that created the passkey.',
    )
    this.name = 'PasskeyCredentialNotFoundError'
  }
}

export class PasskeyTimeoutError extends Error {
  constructor() {
    super('The authenticator did not respond in time. Please try again.')
    this.name = 'PasskeyTimeoutError'
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PasskeyCredentialMetadata {
  /** Base64url-encoded credential ID. */
  credentialId: string
  /** Hex-encoded compressed secp256r1 / P-256 public key (33 bytes). */
  compressedPublicKey: string
  /** Contract address (C-address) of the deployed smart wallet. */
  contractId?: string
  /** Human-readable label for this credential. */
  label?: string
  /** ISO timestamp of creation. */
  createdAt: string
}

export interface PasskeyAssertionResult {
  /** The raw AuthenticatorAssertionResponse. */
  assertion: AuthenticatorAssertionResponse
  /** Base64url-encoded credential ID used. */
  credentialId: string
  /** The authenticatorData bytes (includes rpIdHash + flags + counter). */
  authenticatorData: Uint8Array
  /** The clientDataJSON bytes. */
  clientDataJSON: Uint8Array
  /** The DER-encoded signature bytes. */
  signature: Uint8Array
  /** The userHandle bytes, if returned. */
  userHandle: Uint8Array | null
}

export interface SorobanAuthPayload {
  /** Base64-encoded authenticatorData. */
  authenticatorData: string
  /** Base64-encoded clientDataJSON. */
  clientDataJSON: string
  /** Hex-encoded DER signature. */
  signatureDer: string
  /** Hex-encoded compressed public key. */
  compressedPublicKey: string
  /** Unix timestamp (seconds) — authenticator sign count acts as nonce. */
  signCount: number
}

export interface RelayerSubmitOptions {
  /** Base64-encoded unsigned transaction XDR. */
  unsignedXdr: string
  /** Soroban auth payload from assertPasskey(). */
  authPayload: SorobanAuthPayload
  /** Target network. */
  network: 'mainnet' | 'testnet' | 'futurenet' | 'local' | 'custom'
  /** Override relayer URL (optional; defaults to built-in testnet relayer). */
  relayerUrl?: string
}

export interface RelayerSubmitResult {
  /** Soroban RPC transaction hash. */
  hash: string
  /** Final transaction status from the relayer. */
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'TIMEOUT'
}

// ─── Browser detection ────────────────────────────────────────────────────────

/**
 * Returns true when the browser exposes navigator.credentials and supports
 * the 'public-key' credential type.
 */
export function isPasskeySupported(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof navigator?.credentials?.create !== 'function') return false
  if (typeof navigator?.credentials?.get !== 'function') return false
  if (typeof window.PublicKeyCredential === 'undefined') return false
  return true
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

/**
 * Persist passkey credential metadata to localStorage.
 */
export function savePasskeyCredential(meta: PasskeyCredentialMetadata): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(meta))
}

/**
 * Load passkey credential metadata from localStorage.
 * Returns null if nothing has been stored yet.
 */
export function loadPasskeyCredential(): PasskeyCredentialMetadata | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(PASSKEY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.credentialId || !parsed?.compressedPublicKey) return null
    return parsed as PasskeyCredentialMetadata
  } catch {
    return null
  }
}

/**
 * Remove stored passkey credential metadata.
 */
export function clearPasskeyCredential(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(PASSKEY_STORAGE_KEY)
}

// ─── CBOR / DER helpers ───────────────────────────────────────────────────────

/**
 * Decode a minimal CBOR map (integer keys only, byte-string values).
 * This is enough to extract the COSE_Key from WebAuthn attestation.
 *
 * We avoid pulling in a full CBOR library dependency; the COSE_Key structure
 * for ES256 (P-256) is small and deterministic.
 */
function decodeCborMap(data: Uint8Array): Map<number, Uint8Array> {
  const result = new Map<number, Uint8Array>()
  let offset = 0

  function readByte(): number {
    if (offset >= data.length) throw new Error('CBOR: unexpected end of buffer')
    return data[offset++]
  }

  function readUint(additionalInfo: number): number {
    if (additionalInfo < 24) return additionalInfo
    if (additionalInfo === 24) return readByte()
    if (additionalInfo === 25) return (readByte() << 8) | readByte()
    throw new Error(`CBOR: unsupported additional info ${additionalInfo}`)
  }

  const header = readByte()
  const majorType = header >> 5
  const additionalInfo = header & 0x1f
  if (majorType !== 5) throw new Error(`CBOR: expected map, got major type ${majorType}`)
  const count = readUint(additionalInfo)

  for (let i = 0; i < count; i++) {
    // Key (integer)
    const keyHeader = readByte()
    const keyMajor = keyHeader >> 5
    const keyAdditional = keyHeader & 0x1f
    let key: number
    if (keyMajor === 1) {
      // Negative integer: value is -1 - n
      key = -(1 + readUint(keyAdditional))
    } else if (keyMajor === 0) {
      key = readUint(keyAdditional)
    } else {
      throw new Error(`CBOR: unsupported key major type ${keyMajor}`)
    }

    // Value (byte string)
    const valHeader = readByte()
    const valMajor = valHeader >> 5
    const valAdditional = valHeader & 0x1f
    if (valMajor !== 2) throw new Error(`CBOR: expected bytes value, got major type ${valMajor}`)
    const length = readUint(valAdditional)
    result.set(key, data.slice(offset, offset + length))
    offset += length
  }

  return result
}

/**
 * Extract the compressed P-256 public key from a WebAuthn attestation
 * credentialPublicKey (COSE_Key, CBOR-encoded).
 *
 * COSE key parameters for EC2 (kty=2, crv=P-256, alg=ES256):
 *   -1 → crv (1 = P-256)
 *   -2 → x   (32 bytes)
 *   -3 → y   (32 bytes)
 *
 * Returns the compressed form: 0x02 or 0x03 prefix + 32-byte x coordinate.
 */
export function extractCompressedPublicKey(credentialPublicKey: ArrayBuffer): Uint8Array {
  const coseKey = decodeCborMap(new Uint8Array(credentialPublicKey))
  const x = coseKey.get(-2)
  const y = coseKey.get(-3)

  if (!x || x.length !== 32) throw new Error('COSE key: missing or invalid x coordinate')
  if (!y || y.length !== 32) throw new Error('COSE key: missing or invalid y coordinate')

  // Determine even/odd prefix from the last byte of y
  const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03
  const compressed = new Uint8Array(33)
  compressed[0] = prefix
  compressed.set(x, 1)
  return compressed
}

/**
 * Parse the sign count from authenticatorData bytes.
 * Bytes 33–36 (0-indexed) are a big-endian uint32 sign counter.
 */
export function parseSignCount(authenticatorData: Uint8Array): number {
  if (authenticatorData.length < 37) return 0
  return (
    (authenticatorData[33] << 24) |
    (authenticatorData[34] << 16) |
    (authenticatorData[35] << 8) |
    authenticatorData[36]
  )
}

// ─── Encoding helpers ─────────────────────────────────────────────────────────

/** Convert ArrayBuffer to Uint8Array. */
function toUint8Array(buf: ArrayBuffer | Uint8Array): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf)
}

/** Encode Uint8Array to base64url (RFC 4648 §5). */
export function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/** Decode base64url string to Uint8Array. */
export function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
  const binary = atob(base64)
  return new Uint8Array(binary.length).map((_, i) => binary.charCodeAt(i))
}

/** Encode Uint8Array to hex string. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Decode hex string to Uint8Array. */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Hex string must have even length')
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

// ─── Core WebAuthn operations ─────────────────────────────────────────────────

/**
 * Create a new passkey credential on this device.
 *
 * Calls navigator.credentials.create() with a public-key credential
 * using ES256 (P-256 / secp256r1).  The attestation response is parsed
 * to extract the compressed public key which is stored alongside the
 * credential ID for later assertions.
 *
 * @param options.label  Human-readable label stored with the credential
 * @param options.rpId   Relying party ID (defaults to window.location.hostname)
 * @param options.userId Optional user ID bytes (random if omitted)
 */
export async function createPasskey(options: {
  label?: string
  rpId?: string
  userId?: Uint8Array
} = {}): Promise<PasskeyCredentialMetadata> {
  if (!isPasskeySupported()) throw new PasskeyNotSupportedError()

  const rpId = options.rpId ?? defaultRpId()
  const userId = options.userId ?? crypto.getRandomValues(new Uint8Array(32))
  const label = options.label ?? 'Stellar Smart Wallet'
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  let credential: PublicKeyCredential
  try {
    const result = await navigator.credentials.create({
      publicKey: {
        rp: { id: rpId, name: RP_NAME },
        user: {
          id: userId,
          name: label,
          displayName: label,
        },
        challenge,
        pubKeyCredParams: [
          // ES256 = P-256 = secp256r1 (COSE algorithm -7)
          { type: 'public-key', alg: -7 },
        ],
        authenticatorSelection: {
          // Prefer platform authenticators (Touch ID, Windows Hello, etc.)
          authenticatorAttachment: 'platform',
          residentKey: 'preferred',
          requireResidentKey: false,
          userVerification: 'required',
        },
        timeout: WEBAUTHN_TIMEOUT_MS,
        attestation: 'none',
      },
    })
    credential = result as PublicKeyCredential
  } catch (err: unknown) {
    const error = err as Error
    if (error?.name === 'NotAllowedError') throw new PasskeyCancelledError()
    if (error?.name === 'TimeoutError') throw new PasskeyTimeoutError()
    throw new Error(`Passkey creation failed: ${error?.message ?? String(err)}`)
  }

  const response = credential.response as AuthenticatorAttestationResponse
  const credentialId = toBase64Url(toUint8Array(credential.rawId))

  // Extract the public key from the attestation object.
  // getPublicKey() is the spec-defined method (returns DER-encoded SubjectPublicKeyInfo).
  // We fall back to parsing the COSE key from authenticatorData when unavailable.
  let compressedPublicKey: string

  if (typeof response.getPublicKey === 'function') {
    const spkiBytes = response.getPublicKey()
    if (spkiBytes && spkiBytes.byteLength >= 65) {
      // SubjectPublicKeyInfo for EC P-256 ends with: 0x04 || x (32) || y (32)
      const spki = new Uint8Array(spkiBytes)
      // Find the uncompressed point marker 0x04
      const idx = spki.lastIndexOf(0x04)
      if (idx !== -1 && spki.length >= idx + 65) {
        const x = spki.slice(idx + 1, idx + 33)
        const y = spki.slice(idx + 33, idx + 65)
        const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03
        const compressed = new Uint8Array(33)
        compressed[0] = prefix
        compressed.set(x, 1)
        compressedPublicKey = toHex(compressed)
      } else {
        throw new Error('Could not parse public key from SPKI blob')
      }
    } else {
      throw new Error('getPublicKey() returned an unexpected result')
    }
  } else {
    // Fallback: parse the COSE_Key from the authenticatorData in the attestation object
    const authData = toUint8Array(response.getAuthenticatorData?.() ?? new ArrayBuffer(0))
    // authenticatorData layout: rpIdHash(32) + flags(1) + signCount(4) + attestedCredentialData
    // attestedCredentialData: aaguid(16) + credIdLen(2) + credId(credIdLen) + credentialPublicKey
    if (authData.length < 55) throw new Error('authenticatorData too short to contain credential')
    const credIdLen = (authData[53] << 8) | authData[54]
    const coseKeyOffset = 55 + credIdLen
    compressedPublicKey = toHex(extractCompressedPublicKey(authData.slice(coseKeyOffset).buffer))
  }

  const meta: PasskeyCredentialMetadata = {
    credentialId,
    compressedPublicKey,
    label,
    createdAt: new Date().toISOString(),
  }

  savePasskeyCredential(meta)
  return meta
}

/**
 * Assert (authenticate with) an existing passkey credential.
 *
 * Calls navigator.credentials.get() to prompt the user for their passkey.
 * Returns the raw assertion response for use with buildSorobanAuthPayload().
 *
 * @param challengeBytes  The Soroban auth-entry hash (32 bytes) that the
 *                        authenticator will sign over (via clientDataJSON).
 * @param credentialId    Base64url credential ID (from loadPasskeyCredential()).
 *                        When omitted the browser shows a selection dialog.
 * @param rpId            Relying party ID (defaults to window.location.hostname).
 */
export async function assertPasskey(
  challengeBytes: Uint8Array,
  credentialId?: string,
  rpId?: string,
): Promise<PasskeyAssertionResult> {
  if (!isPasskeySupported()) throw new PasskeyNotSupportedError()

  const allowCredentials: PublicKeyCredentialDescriptor[] = credentialId
    ? [{ type: 'public-key', id: fromBase64Url(credentialId) }]
    : []

  let credential: PublicKeyCredential
  try {
    const result = await navigator.credentials.get({
      publicKey: {
        rpId: rpId ?? defaultRpId(),
        challenge: challengeBytes,
        allowCredentials,
        userVerification: 'required',
        timeout: WEBAUTHN_TIMEOUT_MS,
      },
    })
    if (!result) throw new PasskeyCredentialNotFoundError()
    credential = result as PublicKeyCredential
  } catch (err: unknown) {
    const error = err as Error
    if (error instanceof PasskeyCredentialNotFoundError) throw error
    if (error?.name === 'NotAllowedError') throw new PasskeyCancelledError()
    if (error?.name === 'TimeoutError') throw new PasskeyTimeoutError()
    if (
      error?.name === 'SecurityError' ||
      (typeof error?.message === 'string' &&
        (error.message.toLowerCase().includes('not found') ||
          error.message.toLowerCase().includes('no credentials')))
    ) {
      throw new PasskeyCredentialNotFoundError()
    }
    throw new Error(`Passkey assertion failed: ${error?.message ?? String(err)}`)
  }

  const response = credential.response as AuthenticatorAssertionResponse
  const authenticatorData = toUint8Array(response.authenticatorData)
  const clientDataJSON = toUint8Array(response.clientDataJSON)
  const signature = toUint8Array(response.signature)
  const userHandle = response.userHandle ? toUint8Array(response.userHandle) : null

  return {
    assertion: response,
    credentialId: toBase64Url(toUint8Array(credential.rawId)),
    authenticatorData,
    clientDataJSON,
    signature,
    userHandle,
  }
}

/**
 * Build a SorobanAuthPayload from a PasskeyAssertionResult.
 * This payload is passed to buildSorobanAuthEntry() or submitViaRelayer().
 */
export function buildSorobanAuthPayload(
  assertion: PasskeyAssertionResult,
  compressedPublicKey: string,
): SorobanAuthPayload {
  return {
    authenticatorData: btoa(String.fromCharCode(...assertion.authenticatorData)),
    clientDataJSON: btoa(String.fromCharCode(...assertion.clientDataJSON)),
    signatureDer: toHex(assertion.signature),
    compressedPublicKey,
    signCount: parseSignCount(assertion.authenticatorData),
  }
}

/**
 * Derive a deterministic 32-byte challenge for a Soroban auth entry.
 *
 * The challenge passed to navigator.credentials.get() becomes the value
 * embedded in clientDataJSON.  Soroban smart-wallet contracts verify this
 * value against the hash of the auth entry they expect to be authorised.
 *
 * We compute: SHA-256( network_passphrase || auth_entry_xdr )
 * and use those bytes as the WebAuthn challenge so the contract can replay
 * the same computation on-chain.
 *
 * @param authEntryXdr      Base64-encoded SorobanAuthorizationEntry XDR
 * @param networkPassphrase Stellar network passphrase
 */
export async function deriveAuthEntryChallenge(
  authEntryXdr: string,
  networkPassphrase: string,
): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const passphraseBytes = encoder.encode(networkPassphrase)
  const xdrBytes = fromBase64Url(authEntryXdr)

  // SHA-256( passphrase || xdr )
  const input = new Uint8Array(passphraseBytes.length + xdrBytes.length)
  input.set(passphraseBytes, 0)
  input.set(xdrBytes, passphraseBytes.length)

  const hashBuffer = await crypto.subtle.digest('SHA-256', input)
  return new Uint8Array(hashBuffer)
}

// ─── Soroban auth-entry builder ───────────────────────────────────────────────

/**
 * Build the SorobanAuthorizedInvocation + CustomAccountAuthorizationEntry
 * XDR map that a passkey smart-wallet contract expects in __check_auth.
 *
 * The contract typically expects a ScMap with these keys:
 *   "auth_data"     → bytes  (authenticatorData)
 *   "client_data"   → bytes  (clientDataJSON)
 *   "signature"     → bytes  (DER-encoded secp256r1 signature)
 *   "pk"            → bytes  (compressed P-256 public key, 33 bytes)
 *
 * Returns a Base64-encoded ScVal (ScMap) that can be attached to the
 * SorobanAuthorizationEntry as the `credentials.custom.auth_entries` value.
 */
export function buildSorobanAuthEntry(payload: SorobanAuthPayload): string {
  const { Address, xdr, nativeToScVal } = StellarSdk

  const authDataBytes = Uint8Array.from(atob(payload.authenticatorData), (c) => c.charCodeAt(0))
  const clientDataBytes = Uint8Array.from(atob(payload.clientDataJSON), (c) => c.charCodeAt(0))
  const sigBytes = fromHex(payload.signatureDer)
  const pkBytes = fromHex(payload.compressedPublicKey)

  // Build ScMap: { auth_data, client_data, signature, pk }
  const scMap = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: nativeToScVal('auth_data', { type: 'symbol' }),
      val: xdr.ScVal.scvBytes(Buffer.from(authDataBytes)),
    }),
    new xdr.ScMapEntry({
      key: nativeToScVal('client_data', { type: 'symbol' }),
      val: xdr.ScVal.scvBytes(Buffer.from(clientDataBytes)),
    }),
    new xdr.ScMapEntry({
      key: nativeToScVal('signature', { type: 'symbol' }),
      val: xdr.ScVal.scvBytes(Buffer.from(sigBytes)),
    }),
    new xdr.ScMapEntry({
      key: nativeToScVal('pk', { type: 'symbol' }),
      val: xdr.ScVal.scvBytes(Buffer.from(pkBytes)),
    }),
  ])

  return scMap.toXDR('base64')
}

// ─── Relayer / fee-sponsor submission ─────────────────────────────────────────

/** Default relayer URLs per network. */
const DEFAULT_RELAYER_URLS: Record<string, string> = {
  testnet: 'https://stellar-passkey-relayer.testnet.stellar.org/submit',
  mainnet: 'https://stellar-passkey-relayer.stellar.org/submit',
}

/**
 * Submit a passkey-signed Soroban transaction via a fee-sponsor relayer.
 *
 * The relayer takes the unsigned transaction XDR + the auth payload,
 * wraps the auth entry into the transaction's SorobanData, sponsors
 * the fee, and broadcasts the final transaction to the Soroban RPC.
 *
 * @returns RelayerSubmitResult with the transaction hash and final status.
 */
export async function submitViaRelayer(opts: RelayerSubmitOptions): Promise<RelayerSubmitResult> {
  const relayerUrl = opts.relayerUrl ?? DEFAULT_RELAYER_URLS[opts.network]
  if (!relayerUrl) {
    throw new Error(
      `No relayer URL configured for network "${opts.network}". ` +
        `Provide a relayerUrl in the options.`,
    )
  }

  const body = JSON.stringify({
    unsignedXdr: opts.unsignedXdr,
    authPayload: opts.authPayload,
    network: opts.network,
  })

  let response: Response
  try {
    response = await fetch(relayerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  } catch (err: unknown) {
    throw new Error(`Relayer request failed: ${(err as Error)?.message ?? String(err)}`)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Relayer returned HTTP ${response.status}: ${text}`)
  }

  let result: RelayerSubmitResult
  try {
    result = await response.json()
  } catch {
    throw new Error('Relayer returned an unexpected non-JSON response')
  }

  if (!result?.hash) throw new Error('Relayer response is missing transaction hash')
  return result
}
