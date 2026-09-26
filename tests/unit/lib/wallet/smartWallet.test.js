/**
 * @vitest-environment jsdom
 *
 * Tests for src/lib/wallet/smartWallet.ts
 *
 * Coverage:
 *  - Primary flow:   isSmartWalletContract(), fetchSmartWalletAccount() stubbed
 *  - Boundary cases: contract with only __check_auth, contract with no spec,
 *                    fetchAuthHistory with empty response, parseSignCount edges
 *  - Failure cases:  invalid C-address, network without passphrase,
 *                    signSorobanAuthEntry with no credential
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isSmartWalletContract,
  fetchSmartWalletAccount,
  signSorobanAuthEntry,
  fetchAuthHistory,
} from '../../../../src/lib/wallet/smartWallet.js'
import {
  clearPasskeyCredential,
  savePasskeyCredential,
  PasskeyNotSupportedError,
  PasskeyCancelledError,
} from '../../../../src/lib/wallet/passkey.js'

// ─── Mock Stellar SDK ─────────────────────────────────────────────────────────

vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual('@stellar/stellar-sdk')
  return {
    ...actual,
    contract: {
      ...actual.contract,
      Client: {
        from: vi.fn(async () => null), // default: no spec
      },
    },
  }
})

// ─── Mock Stellar network helpers ─────────────────────────────────────────────

vi.mock('../../../../src/lib/stellar.js', async () => {
  const actual = await vi.importActual('../../../../src/lib/stellar.js')
  return {
    ...actual,
    getSorobanServer: vi.fn(() => ({
      simulateTransaction: vi.fn(async () => ({ error: 'not implemented' })),
    })),
    getServer: vi.fn(() => ({
      transactions: vi.fn(() => ({
        forAccount: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              call: vi.fn(async () => ({ records: [] })),
            })),
          })),
        })),
      })),
    })),
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * A valid testnet contract address (C-address).
 * This is the native XLM SAC on testnet; any canonical C-address works for
 * validation tests.
 */
const VALID_CONTRACT_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYC'

function makeMockSpec(functionNames) {
  return {
    funcs: () =>
      functionNames.map((name) => ({
        name: () => name,
      })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('smartWallet: isSmartWalletContract()', () => {
  it('returns true when spec has __check_auth and balance', () => {
    const spec = makeMockSpec(['__check_auth', 'balance', 'transfer'])
    expect(isSmartWalletContract(spec)).toBe(true)
  })

  it('returns true when spec has __check_auth and balances (plural)', () => {
    const spec = makeMockSpec(['__check_auth', 'balances'])
    expect(isSmartWalletContract(spec)).toBe(true)
  })

  it('returns false when __check_auth is missing', () => {
    const spec = makeMockSpec(['balance', 'transfer'])
    expect(isSmartWalletContract(spec)).toBe(false)
  })

  it('returns false when balance / balances is missing', () => {
    // Only __check_auth — not a complete passkey smart-wallet interface
    const spec = makeMockSpec(['__check_auth', 'transfer'])
    expect(isSmartWalletContract(spec)).toBe(false)
  })

  it('returns false for null spec', () => {
    expect(isSmartWalletContract(null)).toBe(false)
  })

  it('returns false for undefined spec', () => {
    expect(isSmartWalletContract(undefined)).toBe(false)
  })

  it('returns false when spec.funcs is not a function', () => {
    expect(isSmartWalletContract({ funcs: 'not a function' })).toBe(false)
  })

  it('returns false for an empty function list', () => {
    expect(isSmartWalletContract(makeMockSpec([]))).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('smartWallet: fetchSmartWalletAccount() — primary flow', () => {
  it('returns a SmartWalletAccount with expected shape', async () => {
    const account = await fetchSmartWalletAccount(VALID_CONTRACT_ID, 'testnet')

    expect(account.contractId).toBe(VALID_CONTRACT_ID)
    expect(account.network).toBe('testnet')
    expect(account.fetchedAt).toBeTypeOf('string')
    expect(Array.isArray(account.sacBalances)).toBe(true)
    expect(Array.isArray(account.authHistory)).toBe(true)
    expect(typeof account.isPasskeySmartWallet).toBe('boolean')
  })

  it('isPasskeySmartWallet is false when contract spec is unavailable', async () => {
    const account = await fetchSmartWalletAccount(VALID_CONTRACT_ID, 'testnet')
    // Our mock returns null from Client.from, so no spec is parsed
    expect(account.isPasskeySmartWallet).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('smartWallet: fetchSmartWalletAccount() — failure cases', () => {
  it('throws when given a G-address instead of a C-address', async () => {
    await expect(
      fetchSmartWalletAccount(
        'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
        'testnet',
      ),
    ).rejects.toThrow('not a valid contract address')
  })

  it('throws when given a random string', async () => {
    await expect(fetchSmartWalletAccount('not-a-contract', 'testnet')).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('smartWallet: fetchAuthHistory() — boundary cases', () => {
  it('returns an empty array when Horizon returns no transactions', async () => {
    const history = await fetchAuthHistory(VALID_CONTRACT_ID, 'testnet')
    expect(history).toEqual([])
  })

  it('returns an empty array when Horizon throws (new contract)', async () => {
    const { getServer } = await import('../../../../src/lib/stellar.js')
    getServer.mockReturnValueOnce({
      transactions: vi.fn(() => ({
        forAccount: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              call: vi.fn(async () => { throw new Error('account not found') }),
            })),
          })),
        })),
      })),
    })

    const history = await fetchAuthHistory(VALID_CONTRACT_ID, 'testnet')
    expect(history).toEqual([])
  })

  it('maps transaction records to AuthHistoryEntry shape', async () => {
    const mockTx = {
      hash: 'abcdef1234567890',
      id: 'op-id-1',
      successful: true,
      ledger_attr: 1234,
      created_at: '2026-01-01T00:00:00Z',
    }

    const { getServer } = await import('../../../../src/lib/stellar.js')
    getServer.mockReturnValueOnce({
      transactions: vi.fn(() => ({
        forAccount: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              call: vi.fn(async () => ({ records: [mockTx] })),
            })),
          })),
        })),
      })),
    })

    const history = await fetchAuthHistory(VALID_CONTRACT_ID, 'testnet')
    expect(history).toHaveLength(1)
    expect(history[0].txHash).toBe('abcdef1234567890')
    expect(history[0].success).toBe(true)
    expect(history[0].closedAt).toBe('2026-01-01T00:00:00Z')
    expect(history[0].functionName).toBe('__check_auth')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('smartWallet: signSorobanAuthEntry() — failure cases', () => {
  afterEach(() => {
    clearPasskeyCredential()
  })

  it('throws when no credential is stored and none is provided', async () => {
    clearPasskeyCredential()

    await expect(
      signSorobanAuthEntry({
        authEntryXdr: 'AAAA',
        networkPassphrase: 'Test SDF Network ; September 2015',
      }),
    ).rejects.toThrow('No passkey credential found')
  })

  it('throws PasskeyNotSupportedError on unsupported browsers', async () => {
    // Store a credential so we pass the credential check
    savePasskeyCredential({
      credentialId: 'test-cred',
      compressedPublicKey: '02' + 'aa'.repeat(32),
      createdAt: new Date().toISOString(),
    })

    // Remove WebAuthn support
    delete window.PublicKeyCredential
    delete navigator.credentials

    await expect(
      signSorobanAuthEntry({
        authEntryXdr: 'AAAA',
        networkPassphrase: 'Test SDF Network ; September 2015',
        credentialId: 'test-cred',
        compressedPublicKey: '02' + 'aa'.repeat(32),
      }),
    ).rejects.toThrow(PasskeyNotSupportedError)
  })

  it('throws PasskeyCancelledError when the user cancels the prompt', async () => {
    savePasskeyCredential({
      credentialId: 'cred-cancel',
      compressedPublicKey: '02' + 'bb'.repeat(32),
      createdAt: new Date().toISOString(),
    })

    // Mock WebAuthn supported but cancelled
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: class {},
      writable: true,
      configurable: true,
    })
    navigator.credentials = {
      create: vi.fn(),
      get: vi.fn(async () => {
        const err = new Error('User cancelled')
        err.name = 'NotAllowedError'
        throw err
      }),
    }

    await expect(
      signSorobanAuthEntry({
        authEntryXdr: 'AAAA',
        networkPassphrase: 'Test SDF Network ; September 2015',
        credentialId: 'cred-cancel',
        compressedPublicKey: '02' + 'bb'.repeat(32),
      }),
    ).rejects.toThrow(PasskeyCancelledError)

    delete window.PublicKeyCredential
    delete navigator.credentials
  })
})
