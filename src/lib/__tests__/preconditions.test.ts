/**
 * Unit tests for Stellar transaction preconditions
 * #756 Support Stellar transaction preconditions
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as StellarSdk from '@stellar/stellar-sdk'
import { buildTransaction, simulateTransaction, validateSimulationParams } from '../stellar'

// ─── Stubs ─────────────────────────────────────────────────────────────────────

const VALID_SOURCE = StellarSdk.Keypair.random().publicKey()
const VALID_DEST = StellarSdk.Keypair.random().publicKey()
const VALID_SIGNER_1 = StellarSdk.Keypair.random().publicKey()
const VALID_SIGNER_2 = StellarSdk.Keypair.random().publicKey()

const mockAccount = {
  sequence: '100',
  publicKey: VALID_SOURCE,
}

vi.mock('../stellar', async () => {
  const actual = await vi.importActual('../stellar')
  return {
    ...actual,
    getServer: vi.fn(() => ({
      loadAccount: vi.fn().mockResolvedValue(mockAccount),
    })),
  }
})

// ─── Tests ─────────────────────────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000)

describe('transaction preconditions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds a transaction with ledger bounds', async () => {
    const tx = await buildTransaction({
      sourceAccount: VALID_SOURCE,
      operations: [{ type: 'payment', destination: VALID_DEST, amount: '10' }],
      baseFee: 100,
      timeBounds: { maxTime: NOW + 180 },
      preconditions: {
        ledgerBounds: { minLedger: 1000, maxLedger: 2000 },
      },
      network: 'testnet',
    })
    expect(tx).toBeDefined()
    expect(tx.toXDR()).toBeTruthy()
  })

  it('builds a transaction with min sequence', async () => {
    const tx = await buildTransaction({
      sourceAccount: VALID_SOURCE,
      operations: [{ type: 'payment', destination: VALID_DEST, amount: '10' }],
      baseFee: 100,
      timeBounds: { maxTime: NOW + 180 },
      preconditions: {
        minSequence: 50,
      },
      network: 'testnet',
    })
    expect(tx).toBeDefined()
  })

  it('builds a transaction with min sequence age', async () => {
    const tx = await buildTransaction({
      sourceAccount: VALID_SOURCE,
      operations: [{ type: 'payment', destination: VALID_DEST, amount: '10' }],
      baseFee: 100,
      timeBounds: { maxTime: NOW + 180 },
      preconditions: {
        minSequenceAge: 300,
      },
      network: 'testnet',
    })
    expect(tx).toBeDefined()
  })

  it('builds a transaction with min sequence ledger gap', async () => {
    const tx = await buildTransaction({
      sourceAccount: VALID_SOURCE,
      operations: [{ type: 'payment', destination: VALID_DEST, amount: '10' }],
      baseFee: 100,
      timeBounds: { maxTime: NOW + 180 },
      preconditions: {
        minSequenceLedgerGap: 5,
      },
      network: 'testnet',
    })
    expect(tx).toBeDefined()
  })

  it('builds a transaction with extra signers', async () => {
    const tx = await buildTransaction({
      sourceAccount: VALID_SOURCE,
      operations: [{ type: 'payment', destination: VALID_DEST, amount: '10' }],
      baseFee: 100,
      timeBounds: { maxTime: NOW + 180 },
      preconditions: {
        extraSigners: [VALID_SIGNER_1, VALID_SIGNER_2],
      },
      network: 'testnet',
    })
    expect(tx).toBeDefined()
  })

  it('validates invalid ledger bounds (min > max)', async () => {
    const result = await simulateTransaction({
      sourceAccount: VALID_SOURCE,
      operations: [{ type: 'payment', destination: VALID_DEST, amount: '10' }],
      baseFee: 100,
      timeBounds: { maxTime: NOW + 180 },
      preconditions: {
        ledgerBounds: { minLedger: 2000, maxLedger: 1000 },
      },
      network: 'testnet',
    })
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.includes('minLedger cannot be greater than maxLedger'))).toBe(true)
  })

  it('validates negative min sequence', async () => {
    const result = await simulateTransaction({
      sourceAccount: VALID_SOURCE,
      operations: [{ type: 'payment', destination: VALID_DEST, amount: '10' }],
      baseFee: 100,
      timeBounds: { maxTime: NOW + 180 },
      preconditions: {
        minSequence: -1,
      },
      network: 'testnet',
    })
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.includes('Min sequence cannot be negative'))).toBe(true)
  })

  it('validates invalid extra signer public key', async () => {
    const result = await simulateTransaction({
      sourceAccount: VALID_SOURCE,
      operations: [{ type: 'payment', destination: VALID_DEST, amount: '10' }],
      baseFee: 100,
      timeBounds: { maxTime: NOW + 180 },
      preconditions: {
        extraSigners: ['invalid'],
      },
      network: 'testnet',
    })
    expect(result.success).toBe(false)
    expect(result.errors.some((e) => e.includes('Invalid extra signer'))).toBe(true)
  })

  it('handles missing preconditions gracefully', async () => {
    const tx = await buildTransaction({
      sourceAccount: VALID_SOURCE,
      operations: [{ type: 'payment', destination: VALID_DEST, amount: '10' }],
      baseFee: 100,
      timeBounds: { maxTime: NOW + 180 },
      network: 'testnet',
    })
    expect(tx).toBeDefined()
  })

  it('validates boundary: zero ledger bounds', async () => {
    const tx = await buildTransaction({
      sourceAccount: VALID_SOURCE,
      operations: [{ type: 'payment', destination: VALID_DEST, amount: '10' }],
      baseFee: 100,
      timeBounds: { maxTime: NOW + 180 },
      preconditions: {
        ledgerBounds: { minLedger: 0, maxLedger: 0 },
      },
      network: 'testnet',
    })
    expect(tx).toBeDefined()
  })
})
