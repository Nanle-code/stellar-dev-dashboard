/**
 * Unit tests for Stellar transaction preconditions
 * #756 Support Stellar transaction preconditions
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { buildTransaction, simulateTransaction, validateSimulationParams } from '../stellar'

// ─── Stubs ─────────────────────────────────────────────────────────────────────

const mockAccount = {
  sequence: '100',
  publicKey: 'GABC1234',
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

describe('transaction preconditions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds a transaction with ledger bounds', async () => {
    const tx = await buildTransaction({
      sourceAccount: 'GABC1234',
      operations: [{ type: 'payment', destination: 'GDEF5678', amount: '10' }],
      baseFee: 100,
      timeBounds: {},
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
      sourceAccount: 'GABC1234',
      operations: [{ type: 'payment', destination: 'GDEF5678', amount: '10' }],
      baseFee: 100,
      timeBounds: {},
      preconditions: {
        minSequence: 50,
      },
      network: 'testnet',
    })
    expect(tx).toBeDefined()
  })

  it('builds a transaction with min sequence age', async () => {
    const tx = await buildTransaction({
      sourceAccount: 'GABC1234',
      operations: [{ type: 'payment', destination: 'GDEF5678', amount: '10' }],
      baseFee: 100,
      timeBounds: {},
      preconditions: {
        minSequenceAge: 300,
      },
      network: 'testnet',
    })
    expect(tx).toBeDefined()
  })

  it('builds a transaction with min sequence ledger gap', async () => {
    const tx = await buildTransaction({
      sourceAccount: 'GABC1234',
      operations: [{ type: 'payment', destination: 'GDEF5678', amount: '10' }],
      baseFee: 100,
      timeBounds: {},
      preconditions: {
        minSequenceLedgerGap: 5,
      },
      network: 'testnet',
    })
    expect(tx).toBeDefined()
  })

  it('builds a transaction with extra signers', async () => {
    const tx = await buildTransaction({
      sourceAccount: 'GABC1234',
      operations: [{ type: 'payment', destination: 'GDEF5678', amount: '10' }],
      baseFee: 100,
      timeBounds: {},
      preconditions: {
        extraSigners: ['GDEF5678', 'GHIJ9012'],
      },
      network: 'testnet',
    })
    expect(tx).toBeDefined()
  })

  it('validates invalid ledger bounds (min > max)', async () => {
    const result = await simulateTransaction({
      sourceAccount: 'GABC1234',
      operations: [{ type: 'payment', destination: 'GDEF5678', amount: '10' }],
      baseFee: 100,
      timeBounds: {},
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
      sourceAccount: 'GABC1234',
      operations: [{ type: 'payment', destination: 'GDEF5678', amount: '10' }],
      baseFee: 100,
      timeBounds: {},
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
      sourceAccount: 'GABC1234',
      operations: [{ type: 'payment', destination: 'GDEF5678', amount: '10' }],
      baseFee: 100,
      timeBounds: {},
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
      sourceAccount: 'GABC1234',
      operations: [{ type: 'payment', destination: 'GDEF5678', amount: '10' }],
      baseFee: 100,
      timeBounds: {},
      network: 'testnet',
    })
    expect(tx).toBeDefined()
  })

  it('validates boundary: zero ledger bounds', async () => {
    const tx = await buildTransaction({
      sourceAccount: 'GABC1234',
      operations: [{ type: 'payment', destination: 'GDEF5678', amount: '10' }],
      baseFee: 100,
      timeBounds: {},
      preconditions: {
        ledgerBounds: { minLedger: 0, maxLedger: 0 },
      },
      network: 'testnet',
    })
    expect(tx).toBeDefined()
  })
})
