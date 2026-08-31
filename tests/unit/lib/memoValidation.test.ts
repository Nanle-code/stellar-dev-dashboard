/**
 * Tests for memo requirement validation (#753).
 *
 * Covers:
 *  - validateMemo(): client-side format/length validation per memo type
 *  - checkDestinationMemoRequirement(): SEP-29 "memo required" destination check
 *  - transactionBuilder.js buildTransaction(): memo validation wired into the build path
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateMemo } from '../../../src/lib/validation'

// ─── validateMemo ──────────────────────────────────────────────────────────────

describe('validateMemo', () => {
  it('treats an empty memo as valid for every type (memo is optional)', () => {
    for (const type of ['none', 'text', 'id', 'hash', 'return'] as const) {
      expect(validateMemo('', type).valid).toBe(true)
      expect(validateMemo(undefined, type).valid).toBe(true)
    }
  })

  it('ignores content entirely for MEMO_NONE', () => {
    expect(validateMemo('anything goes here', 'none').valid).toBe(true)
  })

  describe('text memos', () => {
    it('accepts a memo at exactly the 28-byte limit', () => {
      const memo = 'a'.repeat(28)
      expect(validateMemo(memo, 'text')).toEqual({ valid: true, errors: [] })
    })

    it('rejects a memo one byte over the limit', () => {
      const memo = 'a'.repeat(29)
      const result = validateMemo(memo, 'text')
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toMatch(/28 bytes/)
    })

    it('measures UTF-8 byte length, not character count', () => {
      // 15 "é" characters = 15 chars but 30 bytes (2 bytes each in UTF-8).
      const memo = 'é'.repeat(15)
      expect(memo.length).toBe(15)
      const result = validateMemo(memo, 'text')
      expect(result.valid).toBe(false)
    })
  })

  describe('id memos', () => {
    it('accepts zero and the max unsigned 64-bit value', () => {
      expect(validateMemo('0', 'id').valid).toBe(true)
      expect(validateMemo('18446744073709551615', 'id').valid).toBe(true)
    })

    it('rejects a value beyond the unsigned 64-bit range', () => {
      const result = validateMemo('18446744073709551616', 'id')
      expect(result.valid).toBe(false)
    })

    it('rejects negative numbers and non-numeric input', () => {
      expect(validateMemo('-1', 'id').valid).toBe(false)
      expect(validateMemo('not-a-number', 'id').valid).toBe(false)
    })
  })

  describe('hash and return memos', () => {
    const validHash = 'a'.repeat(64)

    it('accepts a 64 hex character value', () => {
      expect(validateMemo(validHash, 'hash').valid).toBe(true)
      expect(validateMemo(validHash.toUpperCase(), 'return').valid).toBe(true)
    })

    it('rejects values that are not exactly 64 hex characters', () => {
      expect(validateMemo('a'.repeat(63), 'hash').valid).toBe(false)
      expect(validateMemo('a'.repeat(65), 'hash').valid).toBe(false)
      expect(validateMemo('z'.repeat(64), 'hash').valid).toBe(false) // 'z' is not hex
    })
  })

  it('fails closed for an unsupported memo type', () => {
    // @ts-expect-error deliberately passing an invalid type
    const result = validateMemo('value', 'bogus')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/Unsupported memo type/)
  })
})

// ─── checkDestinationMemoRequirement + buildTransaction (network-backed) ────────

const { loadAccountMock } = vi.hoisted(() => ({ loadAccountMock: vi.fn() }))

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>()
  class MockHorizonServer {
    loadAccount = loadAccountMock
  }
  return {
    ...actual,
    Horizon: { ...actual.Horizon, Server: MockHorizonServer },
  }
})

const StellarSdk = await import('@stellar/stellar-sdk')
const { checkDestinationMemoRequirement } = await import('../../../src/lib/stellar')
const { buildTransaction } = await import('../../../src/lib/transactionBuilder')

beforeEach(() => {
  loadAccountMock.mockReset()
})

describe('checkDestinationMemoRequirement', () => {
  const destination = 'GAQCITSVIIDTUWUNT2635UL77CIG27RAQKPHKFYLLFM6TOTCI7GIXOEP'

  it('reports unchecked for an empty destination', async () => {
    const result = await checkDestinationMemoRequirement('', 'testnet')
    expect(result.checked).toBe(false)
    expect(result.required).toBe(false)
    expect(result.error).toBeTruthy()
    expect(loadAccountMock).not.toHaveBeenCalled()
  })

  it('skips the network lookup for muxed accounts (they carry their own memo id)', async () => {
    const baseAccount = new StellarSdk.Account(destination, '0')
    const muxed = new StellarSdk.MuxedAccount(baseAccount, '1').accountId()
    const result = await checkDestinationMemoRequirement(muxed, 'testnet')
    expect(result).toEqual({ required: false, checked: true })
    expect(loadAccountMock).not.toHaveBeenCalled()
  })

  it('reports unchecked for input that is not a lookup-able account id', async () => {
    const result = await checkDestinationMemoRequirement('alice*example.com', 'testnet')
    expect(result.checked).toBe(false)
    expect(result.required).toBe(false)
    expect(result.error).toBeTruthy()
    expect(loadAccountMock).not.toHaveBeenCalled()
  })

  it('flags accounts that publish the SEP-29 config.memo_required data entry', async () => {
    loadAccountMock.mockResolvedValueOnce({
      data_attr: { 'config.memo_required': Buffer.from('1').toString('base64') },
    })

    const result = await checkDestinationMemoRequirement(destination, 'testnet')
    expect(result).toEqual({ required: true, checked: true })
  })

  it('does not flag accounts without the data entry', async () => {
    loadAccountMock.mockResolvedValueOnce({ data_attr: {} })

    const result = await checkDestinationMemoRequirement(destination, 'testnet')
    expect(result).toEqual({ required: false, checked: true })
  })

  it('treats an unfunded (404) destination as not requiring a memo', async () => {
    const error: any = new Error('Not Found')
    error.response = { status: 404 }
    loadAccountMock.mockRejectedValueOnce(error)

    const result = await checkDestinationMemoRequirement(destination, 'testnet')
    expect(result).toEqual({ required: false, checked: true })
  })

  it('surfaces an unsupported-environment/network failure without blocking the caller', async () => {
    loadAccountMock.mockRejectedValueOnce(new Error('Horizon is unreachable'))

    const result = await checkDestinationMemoRequirement(destination, 'testnet')
    expect(result.checked).toBe(false)
    expect(result.required).toBe(false)
    expect(result.error).toMatch(/unreachable/)
  })
})

describe('buildTransaction memo handling', () => {
  const sourceKeypair = StellarSdk.Keypair.random()
  const destination = StellarSdk.Keypair.random().publicKey()

  function mockAccountServer() {
    loadAccountMock.mockResolvedValue(new StellarSdk.Account(sourceKeypair.publicKey(), '100'))
  }

  it('builds a transaction with a valid text memo', async () => {
    mockAccountServer()
    const tx: any = await buildTransaction({
      sourceAccount: sourceKeypair.publicKey(),
      operations: [{ type: 'payment', params: { destination, amount: '10', assetType: 'native' } }],
      memo: 'order-42',
      memoType: 'text',
      network: 'testnet',
    })
    expect(tx.memo.type).toBe('text')
    expect(tx.memo.value.toString()).toBe('order-42')
  })

  it('rejects a text memo over the 28-byte limit before hitting the network', async () => {
    mockAccountServer()
    await expect(
      buildTransaction({
        sourceAccount: sourceKeypair.publicKey(),
        operations: [{ type: 'payment', params: { destination, amount: '10', assetType: 'native' } }],
        memo: 'this memo is definitely far too long for stellar',
        memoType: 'text',
        network: 'testnet',
      }),
    ).rejects.toThrow(/28 bytes/)
  })

  it('rejects an invalid memo id', async () => {
    mockAccountServer()
    await expect(
      buildTransaction({
        sourceAccount: sourceKeypair.publicKey(),
        operations: [{ type: 'payment', params: { destination, amount: '10', assetType: 'native' } }],
        memo: 'not-a-number',
        memoType: 'id',
        network: 'testnet',
      }),
    ).rejects.toThrow()
  })

  it('rejects an unsupported memo type', async () => {
    mockAccountServer()
    await expect(
      buildTransaction({
        sourceAccount: sourceKeypair.publicKey(),
        operations: [{ type: 'payment', params: { destination, amount: '10', assetType: 'native' } }],
        memo: 'value',
        memoType: 'bogus',
        network: 'testnet',
      }),
    ).rejects.toThrow(/Unsupported memo type/)
  })
})
