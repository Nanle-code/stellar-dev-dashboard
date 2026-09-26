/**
 * @vitest-environment jsdom
 *
 * Tests for src/lib/wallet/passkey.ts
 *
 * Coverage:
 *  - Primary flow:   createPasskey() + assertPasskey() + buildSorobanAuthPayload()
 *  - Boundary cases: CBOR parsing edge cases, challenge derivation determinism,
 *                    toBase64Url / fromBase64Url round-trip
 *  - Failure cases:  unsupported browser, cancelled prompt, credential not found,
 *                    timeout, malformed CBOR
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isPasskeySupported,
  createPasskey,
  assertPasskey,
  buildSorobanAuthPayload,
  buildSorobanAuthEntry,
  deriveAuthEntryChallenge,
  extractCompressedPublicKey,
  parseSignCount,
  savePasskeyCredential,
  loadPasskeyCredential,
  clearPasskeyCredential,
  toBase64Url,
  fromBase64Url,
  toHex,
  fromHex,
  PasskeyNotSupportedError,
  PasskeyCancelledError,
  PasskeyCredentialNotFoundError,
  PasskeyTimeoutError,
} from '../../../../src/lib/wallet/passkey.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A minimal 33-byte compressed P-256 public key (even y → prefix 0x02) */
const MOCK_X = new Uint8Array(32).fill(0xaa)
const MOCK_Y_EVEN = new Uint8Array(32).fill(0xbb) // last byte 0xbb is odd → 0x03
const MOCK_Y_EVEN2 = (() => {
  const y = new Uint8Array(32).fill(0xcc)
  y[31] = 0x02 // even → prefix 0x02
  return y
})()

/**
 * Build a minimal COSE_Key CBOR blob for ES256 / P-256.
 * Structure: map(4) { 1:2, 3:-7, -2:<x>, -3:<y> }
 * (We include only -2 and -3 since our decodeCborMap reads them.)
 */
function buildCoseKeyCbor(x, y) {
  const chunks = []

  // map with 2 entries (-2 and -3)
  chunks.push(0xa2) // map(2)

  // key -2 (negative int: 1 → -(1+1)=-2)
  chunks.push(0x21) // negative int 1 → -2
  // value: bytes(32)
  chunks.push(0x58, 0x20) // bytes(32)
  chunks.push(...x)

  // key -3
  chunks.push(0x22) // negative int 2 → -3
  // value: bytes(32)
  chunks.push(0x58, 0x20) // bytes(32)
  chunks.push(...y)

  return new Uint8Array(chunks).buffer
}

/**
 * Build a minimal authenticatorData buffer with a sign counter at bytes 33–36.
 * Layout: rpIdHash(32) + flags(1) + signCount(4) + ...
 */
function buildAuthenticatorData(signCount = 42) {
  const buf = new Uint8Array(37)
  // rpIdHash: 32 bytes
  buf.fill(0x01, 0, 32)
  // flags: UP | UV set
  buf[32] = 0x05
  // sign count (big-endian uint32)
  buf[33] = (signCount >>> 24) & 0xff
  buf[34] = (signCount >>> 16) & 0xff
  buf[35] = (signCount >>> 8) & 0xff
  buf[36] = signCount & 0xff
  return buf
}

/**
 * Build a minimal credentialPublicKey embedded inside authenticatorData.
 * Layout: rpIdHash(32) + flags(1) + signCount(4) + aaguid(16) + credIdLen(2) + credId(credIdLen) + coseKey
 */
function buildAuthDataWithCredential(x, y, credIdLen = 16) {
  const coseBytes = new Uint8Array(buildCoseKeyCbor(x, y))
  const total = 55 + credIdLen + coseBytes.length
  const buf = new Uint8Array(total)
  buf.fill(0x02, 0, 32) // rpIdHash
  buf[32] = 0x45 // flags: AT set
  // sign count = 0
  // aaguid: bytes 37–52 (16 bytes)
  buf.fill(0x03, 37, 53)
  // credIdLen
  buf[53] = (credIdLen >> 8) & 0xff
  buf[54] = credIdLen & 0xff
  // credId: credIdLen bytes
  buf.fill(0x04, 55, 55 + credIdLen)
  // COSE key
  buf.set(coseBytes, 55 + credIdLen)
  return buf
}

// ─── Mock WebAuthn credential objects ────────────────────────────────────────

/** Build a mock PublicKeyCredential returned by navigator.credentials.create() */
function buildMockCreateCredential(overrides = {}) {
  const credId = new Uint8Array(16).fill(0xfe)
  const x = MOCK_X
  const y = MOCK_Y_EVEN2
  const authData = buildAuthDataWithCredential(x, y)

  // Build a mock SPKI blob: ... 0x04 || x || y
  const spki = new Uint8Array(91)
  spki.fill(0x00)
  const uncompressedOffset = spki.length - 65
  spki[uncompressedOffset] = 0x04
  spki.set(x, uncompressedOffset + 1)
  spki.set(y, uncompressedOffset + 33)

  return {
    rawId: credId.buffer,
    response: {
      getPublicKey: vi.fn(() => spki.buffer),
      getAuthenticatorData: vi.fn(() => authData.buffer),
      clientDataJSON: new Uint8Array(10).buffer,
      attestationObject: new Uint8Array(10).buffer,
      ...overrides.response,
    },
    type: 'public-key',
    ...overrides,
  }
}

/** Build a mock PublicKeyCredential returned by navigator.credentials.get() */
function buildMockAssertCredential(signCount = 5, overrides = {}) {
  const credId = new Uint8Array(16).fill(0xfe)
  const authData = buildAuthenticatorData(signCount)
  const sig = new Uint8Array(64).fill(0xab)

  return {
    rawId: credId.buffer,
    response: {
      authenticatorData: authData.buffer,
      clientDataJSON: new TextEncoder().encode(
        JSON.stringify({ type: 'webauthn.get', challenge: 'test', origin: 'https://localhost' }),
      ).buffer,
      signature: sig.buffer,
      userHandle: null,
      ...overrides.response,
    },
    type: 'public-key',
    ...overrides,
  }
}

// ─── WebAuthn browser API mocking helpers ─────────────────────────────────────

function mockWebAuthnSupported(createResult, getResult) {
  Object.defineProperty(window, 'PublicKeyCredential', {
    value: class PublicKeyCredential {},
    writable: true,
    configurable: true,
  })

  navigator.credentials = {
    create: vi.fn(async () => createResult),
    get: vi.fn(async () => getResult),
  }
}

function removeWebAuthnSupport() {
  delete window.PublicKeyCredential
  delete navigator.credentials
}

// ─────────────────────────────────────────────────────────────────────────────

describe('passkey: browser support detection', () => {
  afterEach(() => {
    removeWebAuthnSupport()
  })

  it('returns true when all WebAuthn APIs are present', () => {
    mockWebAuthnSupported(null, null)
    expect(isPasskeySupported()).toBe(true)
  })

  it('returns false when PublicKeyCredential is absent', () => {
    navigator.credentials = { create: vi.fn(), get: vi.fn() }
    delete window.PublicKeyCredential
    expect(isPasskeySupported()).toBe(false)
  })

  it('returns false when navigator.credentials is absent', () => {
    delete navigator.credentials
    expect(isPasskeySupported()).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('passkey: createPasskey() — primary flow', () => {
  beforeEach(() => {
    const cred = buildMockCreateCredential()
    mockWebAuthnSupported(cred, null)
  })

  afterEach(() => {
    removeWebAuthnSupport()
    clearPasskeyCredential()
    vi.restoreAllMocks()
  })

  it('returns PasskeyCredentialMetadata with credentialId and compressedPublicKey', async () => {
    const meta = await createPasskey({ label: 'Test Key' })

    expect(meta.credentialId).toBeTypeOf('string')
    expect(meta.credentialId.length).toBeGreaterThan(0)
    expect(meta.compressedPublicKey).toBeTypeOf('string')
    expect(meta.compressedPublicKey.length).toBe(66) // 33 bytes hex
    expect(meta.label).toBe('Test Key')
    expect(meta.createdAt).toBeTypeOf('string')
  })

  it('persists the credential to localStorage', async () => {
    await createPasskey({ label: 'Persisted' })
    const stored = loadPasskeyCredential()

    expect(stored).not.toBeNull()
    expect(stored?.label).toBe('Persisted')
    expect(stored?.credentialId).toBeTypeOf('string')
  })

  it('calls navigator.credentials.create with ES256 algorithm', async () => {
    await createPasskey()
    const callArgs = navigator.credentials.create.mock.calls[0][0]
    const params = callArgs.publicKey

    expect(params.pubKeyCredParams).toContainEqual({ type: 'public-key', alg: -7 })
    expect(params.authenticatorSelection.userVerification).toBe('required')
    expect(params.attestation).toBe('none')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('passkey: createPasskey() — failure cases', () => {
  afterEach(() => {
    removeWebAuthnSupport()
    clearPasskeyCredential()
    vi.restoreAllMocks()
  })

  it('throws PasskeyNotSupportedError when WebAuthn is unavailable', async () => {
    removeWebAuthnSupport()
    await expect(createPasskey()).rejects.toThrow(PasskeyNotSupportedError)
  })

  it('throws PasskeyCancelledError on NotAllowedError from the authenticator', async () => {
    mockWebAuthnSupported(null, null)
    navigator.credentials.create = vi.fn(async () => {
      const err = new Error('User cancelled')
      err.name = 'NotAllowedError'
      throw err
    })

    await expect(createPasskey()).rejects.toThrow(PasskeyCancelledError)
  })

  it('throws PasskeyTimeoutError on TimeoutError from the authenticator', async () => {
    mockWebAuthnSupported(null, null)
    navigator.credentials.create = vi.fn(async () => {
      const err = new Error('Timed out')
      err.name = 'TimeoutError'
      throw err
    })

    await expect(createPasskey()).rejects.toThrow(PasskeyTimeoutError)
  })

  it('wraps unknown errors with a descriptive message', async () => {
    mockWebAuthnSupported(null, null)
    navigator.credentials.create = vi.fn(async () => {
      throw new Error('Device not available')
    })

    await expect(createPasskey()).rejects.toThrow('Passkey creation failed: Device not available')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('passkey: assertPasskey() — primary flow', () => {
  const challenge = new Uint8Array(32).fill(0xff)

  beforeEach(() => {
    const assertCred = buildMockAssertCredential(99)
    mockWebAuthnSupported(null, assertCred)
  })

  afterEach(() => {
    removeWebAuthnSupport()
    vi.restoreAllMocks()
  })

  it('returns a PasskeyAssertionResult with all expected fields', async () => {
    const result = await assertPasskey(challenge)

    expect(result.credentialId).toBeTypeOf('string')
    expect(result.authenticatorData).toBeInstanceOf(Uint8Array)
    expect(result.clientDataJSON).toBeInstanceOf(Uint8Array)
    expect(result.signature).toBeInstanceOf(Uint8Array)
    expect(result.userHandle).toBeNull()
  })

  it('passes the challenge to the browser API', async () => {
    await assertPasskey(challenge)
    const callArgs = navigator.credentials.get.mock.calls[0][0].publicKey
    expect(callArgs.challenge).toBe(challenge)
  })

  it('includes an allowCredentials entry when credentialId is provided', async () => {
    const credId = 'dGVzdA' // base64url for "test"
    await assertPasskey(challenge, credId)
    const callArgs = navigator.credentials.get.mock.calls[0][0].publicKey
    expect(callArgs.allowCredentials).toHaveLength(1)
    expect(callArgs.allowCredentials[0].type).toBe('public-key')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('passkey: assertPasskey() — failure cases', () => {
  const challenge = new Uint8Array(32).fill(0x0a)

  afterEach(() => {
    removeWebAuthnSupport()
    vi.restoreAllMocks()
  })

  it('throws PasskeyNotSupportedError when WebAuthn is unavailable', async () => {
    removeWebAuthnSupport()
    await expect(assertPasskey(challenge)).rejects.toThrow(PasskeyNotSupportedError)
  })

  it('throws PasskeyCancelledError on NotAllowedError', async () => {
    mockWebAuthnSupported(null, null)
    navigator.credentials.get = vi.fn(async () => {
      const err = new Error('User cancelled')
      err.name = 'NotAllowedError'
      throw err
    })

    await expect(assertPasskey(challenge)).rejects.toThrow(PasskeyCancelledError)
  })

  it('throws PasskeyCredentialNotFoundError when no credential is returned', async () => {
    mockWebAuthnSupported(null, null)
    navigator.credentials.get = vi.fn(async () => null)

    await expect(assertPasskey(challenge)).rejects.toThrow(PasskeyCredentialNotFoundError)
  })

  it('throws PasskeyCredentialNotFoundError on SecurityError', async () => {
    mockWebAuthnSupported(null, null)
    navigator.credentials.get = vi.fn(async () => {
      const err = new Error('No credentials found')
      err.name = 'SecurityError'
      throw err
    })

    await expect(assertPasskey(challenge)).rejects.toThrow(PasskeyCredentialNotFoundError)
  })

  it('throws PasskeyTimeoutError on TimeoutError', async () => {
    mockWebAuthnSupported(null, null)
    navigator.credentials.get = vi.fn(async () => {
      const err = new Error('Timed out')
      err.name = 'TimeoutError'
      throw err
    })

    await expect(assertPasskey(challenge)).rejects.toThrow(PasskeyTimeoutError)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('passkey: buildSorobanAuthPayload()', () => {
  it('builds a payload with all required fields', () => {
    const signCount = 7
    const mockAssertion = {
      authenticatorData: buildAuthenticatorData(signCount),
      clientDataJSON: new Uint8Array([1, 2, 3, 4]),
      signature: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      userHandle: null,
      credentialId: 'Y3JlZElk',
      assertion: {},
    }

    const pk = '02' + 'aa'.repeat(32)
    const payload = buildSorobanAuthPayload(mockAssertion, pk)

    expect(payload.compressedPublicKey).toBe(pk)
    expect(payload.signCount).toBe(signCount)
    expect(payload.authenticatorData).toBeTypeOf('string') // base64
    expect(payload.clientDataJSON).toBeTypeOf('string')
    expect(payload.signatureDer).toBeTypeOf('string')
    expect(payload.signatureDer.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('passkey: buildSorobanAuthEntry()', () => {
  it('returns a non-empty base64 string', () => {
    const payload = {
      authenticatorData: btoa(String.fromCharCode(...new Uint8Array(37).fill(1))),
      clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(10).fill(2))),
      signatureDer: 'deadbeef',
      compressedPublicKey: '02' + 'aa'.repeat(32),
      signCount: 1,
    }

    const xdr = buildSorobanAuthEntry(payload)
    expect(xdr).toBeTypeOf('string')
    expect(xdr.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('passkey: deriveAuthEntryChallenge()', () => {
  it('returns a 32-byte Uint8Array', async () => {
    const challenge = await deriveAuthEntryChallenge(
      toBase64Url(new Uint8Array(10).fill(0xcc)),
      'Test SDF Network ; September 2015',
    )
    expect(challenge).toBeInstanceOf(Uint8Array)
    expect(challenge.length).toBe(32)
  })

  it('is deterministic for the same inputs', async () => {
    const xdr = toBase64Url(new Uint8Array(16).fill(0x55))
    const passphrase = 'Test SDF Network ; September 2015'

    const a = await deriveAuthEntryChallenge(xdr, passphrase)
    const b = await deriveAuthEntryChallenge(xdr, passphrase)

    expect(a).toEqual(b)
  })

  it('produces different challenges for different passphrases', async () => {
    const xdr = toBase64Url(new Uint8Array(8).fill(0x11))

    const a = await deriveAuthEntryChallenge(xdr, 'Passphrase A')
    const b = await deriveAuthEntryChallenge(xdr, 'Passphrase B')

    expect(a).not.toEqual(b)
  })

  it('produces different challenges for different XDRs', async () => {
    const passphrase = 'Same Network'

    const a = await deriveAuthEntryChallenge(toBase64Url(new Uint8Array(8).fill(0x11)), passphrase)
    const b = await deriveAuthEntryChallenge(toBase64Url(new Uint8Array(8).fill(0x22)), passphrase)

    expect(a).not.toEqual(b)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('passkey: extractCompressedPublicKey() — boundary cases', () => {
  it('returns 33-byte compressed key with 0x02 prefix for even y', () => {
    const y = new Uint8Array(32).fill(0x00) // last byte even
    const cbor = buildCoseKeyCbor(MOCK_X, y)
    const compressed = extractCompressedPublicKey(cbor)

    expect(compressed).toBeInstanceOf(Uint8Array)
    expect(compressed.length).toBe(33)
    expect(compressed[0]).toBe(0x02)
    expect(compressed.slice(1)).toEqual(MOCK_X)
  })

  it('returns 33-byte compressed key with 0x03 prefix for odd y', () => {
    const y = new Uint8Array(32).fill(0x00)
    y[31] = 0x01 // odd last byte
    const cbor = buildCoseKeyCbor(MOCK_X, y)
    const compressed = extractCompressedPublicKey(cbor)

    expect(compressed[0]).toBe(0x03)
    expect(compressed.slice(1)).toEqual(MOCK_X)
  })

  it('throws on malformed CBOR (not a map)', () => {
    // 0x40 is bytes(0) — not a map
    const bad = new Uint8Array([0x40]).buffer
    expect(() => extractCompressedPublicKey(bad)).toThrow()
  })

  it('throws when x coordinate is missing', () => {
    // Build a CBOR map with only -3 (y), no -2 (x)
    const chunks = [
      0xa1, // map(1)
      0x22, // key -3
      0x58, 0x20, // bytes(32)
      ...new Uint8Array(32).fill(0xbb),
    ]
    expect(() => extractCompressedPublicKey(new Uint8Array(chunks).buffer)).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('passkey: parseSignCount()', () => {
  it('correctly parses the sign count from authenticatorData', () => {
    const data = buildAuthenticatorData(1000)
    expect(parseSignCount(data)).toBe(1000)
  })

  it('returns 0 for a buffer shorter than 37 bytes', () => {
    expect(parseSignCount(new Uint8Array(10))).toBe(0)
  })

  it('handles max uint32 sign count', () => {
    const data = buildAuthenticatorData(0xffffffff)
    expect(parseSignCount(data)).toBe(0xffffffff)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('passkey: encoding helpers', () => {
  it('toBase64Url / fromBase64Url round-trip', () => {
    const original = new Uint8Array([0x00, 0xff, 0xfe, 0x7e, 0x7f, 0xf0, 0x0a])
    const encoded = toBase64Url(original)
    const decoded = fromBase64Url(encoded)
    expect(decoded).toEqual(original)
  })

  it('toBase64Url omits padding and uses URL-safe chars', () => {
    const bytes = new Uint8Array([0xfb, 0xfc, 0xfd])
    const encoded = toBase64Url(bytes)
    expect(encoded).not.toContain('+')
    expect(encoded).not.toContain('/')
    expect(encoded).not.toContain('=')
  })

  it('toHex / fromHex round-trip', () => {
    const original = new Uint8Array([0x00, 0x1a, 0xff, 0xde, 0xad])
    const hex = toHex(original)
    expect(hex).toBe('001affdead')
    expect(fromHex(hex)).toEqual(original)
  })

  it('fromHex throws on odd-length hex string', () => {
    expect(() => fromHex('abc')).toThrow('even length')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('passkey: credential storage helpers', () => {
  afterEach(() => {
    clearPasskeyCredential()
  })

  it('savePasskeyCredential / loadPasskeyCredential round-trip', () => {
    const meta = {
      credentialId: 'abc123',
      compressedPublicKey: '02' + 'de'.repeat(32),
      label: 'My Key',
      createdAt: new Date().toISOString(),
    }

    savePasskeyCredential(meta)
    const loaded = loadPasskeyCredential()

    expect(loaded?.credentialId).toBe(meta.credentialId)
    expect(loaded?.compressedPublicKey).toBe(meta.compressedPublicKey)
    expect(loaded?.label).toBe(meta.label)
  })

  it('loadPasskeyCredential returns null when nothing is stored', () => {
    expect(loadPasskeyCredential()).toBeNull()
  })

  it('clearPasskeyCredential removes the stored credential', () => {
    savePasskeyCredential({
      credentialId: 'x',
      compressedPublicKey: '02' + '00'.repeat(32),
      createdAt: new Date().toISOString(),
    })
    clearPasskeyCredential()
    expect(loadPasskeyCredential()).toBeNull()
  })

  it('loadPasskeyCredential returns null for corrupted JSON', () => {
    localStorage.setItem('stellar-passkey-credential', '{bad json')
    expect(loadPasskeyCredential()).toBeNull()
  })

  it('loadPasskeyCredential returns null when required fields are missing', () => {
    localStorage.setItem('stellar-passkey-credential', JSON.stringify({ label: 'only label' }))
    expect(loadPasskeyCredential()).toBeNull()
  })
})
