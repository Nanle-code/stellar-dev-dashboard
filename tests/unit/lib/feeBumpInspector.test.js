/**
 * Tests for feeBumpInspector — XDR envelope parsing utility.
 *
 * Covers the primary fee-bump flow, plain transaction flow, boundary cases,
 * and failure paths as required by the acceptance criteria.
 */

import { describe, it, expect } from 'vitest'
import * as StellarSdk from '@stellar/stellar-sdk'
import { inspectEnvelope } from '../../../src/utils/feeBumpInspector'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeKeypair() {
  return StellarSdk.Keypair.random()
}

function makeAccount(publicKey) {
  return new StellarSdk.Account(publicKey, '100')
}

function buildInnerTx(sourceKp, destinationKey, network = StellarSdk.Networks.TESTNET) {
  const tx = new StellarSdk.TransactionBuilder(makeAccount(sourceKp.publicKey()), {
    fee: '100',
    networkPassphrase: network,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationKey,
        asset: StellarSdk.Asset.native(),
        amount: '10',
      })
    )
    .setTimeout(180)
    .build()
  tx.sign(sourceKp)
  return tx
}

function buildFeeBumpXdr(feeSourceKp, innerTx, network = StellarSdk.Networks.TESTNET) {
  const fbTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    feeSourceKp.publicKey(),
    '300',
    innerTx,
    network,
  )
  fbTx.sign(feeSourceKp)
  return fbTx.toXDR()
}

// ─── Primary flow ─────────────────────────────────────────────────────────────

describe('inspectEnvelope — fee-bump transaction (primary flow)', () => {
  it('returns ok=true and type=fee_bump for a valid fee-bump XDR', () => {
    const feeSourceKp = makeKeypair()
    const innerKp = makeKeypair()
    const destKp = makeKeypair()

    const inner = buildInnerTx(innerKp, destKp.publicKey())
    const xdr = buildFeeBumpXdr(feeSourceKp, inner)

    const result = inspectEnvelope(xdr, 'testnet')

    expect(result.ok).toBe(true)
    expect(result.envelope.type).toBe('fee_bump')
  })

  it('exposes feeSource on the outer envelope', () => {
    const feeSourceKp = makeKeypair()
    const innerKp = makeKeypair()
    const destKp = makeKeypair()

    const inner = buildInnerTx(innerKp, destKp.publicKey())
    const xdr = buildFeeBumpXdr(feeSourceKp, inner)

    const result = inspectEnvelope(xdr, 'testnet')

    expect(result.ok).toBe(true)
    expect(result.envelope.feeSource).toBe(feeSourceKp.publicKey())
  })

  it('exposes inner transaction details including source, fee, operationCount, and signatures', () => {
    const feeSourceKp = makeKeypair()
    const innerKp = makeKeypair()
    const destKp = makeKeypair()

    const inner = buildInnerTx(innerKp, destKp.publicKey())
    const xdr = buildFeeBumpXdr(feeSourceKp, inner)

    const result = inspectEnvelope(xdr, 'testnet')

    expect(result.ok).toBe(true)
    const fb = result.envelope
    expect(fb.type).toBe('fee_bump')
    expect(fb.innerTransaction.source).toBe(innerKp.publicKey())
    expect(fb.innerTransaction.operationCount).toBe(1)
    expect(fb.innerTransaction.operations[0].type).toBe('payment')
    expect(fb.innerTransaction.signatures).toBeGreaterThanOrEqual(1)
    expect(fb.innerTransaction.fee).toBe('100')
  })

  it('produces a valid 64-char hex hash for both outer and inner envelopes', () => {
    const feeSourceKp = makeKeypair()
    const innerKp = makeKeypair()
    const destKp = makeKeypair()

    const inner = buildInnerTx(innerKp, destKp.publicKey())
    const xdr = buildFeeBumpXdr(feeSourceKp, inner)

    const result = inspectEnvelope(xdr, 'testnet')

    expect(result.ok).toBe(true)
    const fb = result.envelope
    expect(fb.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(fb.innerTransaction.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(fb.hash).not.toBe(fb.innerTransaction.hash)
  })

  it('outer fee is higher than inner fee (fee-bump always pays more)', () => {
    const feeSourceKp = makeKeypair()
    const innerKp = makeKeypair()
    const destKp = makeKeypair()

    const inner = buildInnerTx(innerKp, destKp.publicKey())
    const xdr = buildFeeBumpXdr(feeSourceKp, inner)

    const result = inspectEnvelope(xdr, 'testnet')

    expect(result.ok).toBe(true)
    const fb = result.envelope
    expect(parseInt(fb.fee)).toBeGreaterThan(parseInt(fb.innerTransaction.fee))
  })
})

// ─── Plain transaction flow ───────────────────────────────────────────────────

describe('inspectEnvelope — plain transaction', () => {
  it('returns ok=true and type=transaction for a plain transaction XDR', () => {
    const kp = makeKeypair()
    const destKp = makeKeypair()
    const tx = buildInnerTx(kp, destKp.publicKey())

    const result = inspectEnvelope(tx.toXDR(), 'testnet')

    expect(result.ok).toBe(true)
    expect(result.envelope.type).toBe('transaction')
  })

  it('exposes source, fee, operationCount, and hash for a plain transaction', () => {
    const kp = makeKeypair()
    const destKp = makeKeypair()
    const tx = buildInnerTx(kp, destKp.publicKey())

    const result = inspectEnvelope(tx.toXDR(), 'testnet')

    expect(result.ok).toBe(true)
    const info = result.envelope
    expect(info.source).toBe(kp.publicKey())
    expect(info.operationCount).toBe(1)
    expect(info.fee).toBe('100')
    expect(info.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('reports correct operation list for a multi-operation transaction', () => {
    const kp = makeKeypair()
    const destA = makeKeypair()
    const destB = makeKeypair()

    const tx = new StellarSdk.TransactionBuilder(makeAccount(kp.publicKey()), {
      fee: '200',
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: destA.publicKey(),
          asset: StellarSdk.Asset.native(),
          amount: '5',
        })
      )
      .addOperation(
        StellarSdk.Operation.payment({
          destination: destB.publicKey(),
          asset: StellarSdk.Asset.native(),
          amount: '3',
        })
      )
      .setTimeout(180)
      .build()

    const result = inspectEnvelope(tx.toXDR(), 'testnet')

    expect(result.ok).toBe(true)
    expect(result.envelope.operationCount).toBe(2)
    expect(result.envelope.operations.every((op) => op.type === 'payment')).toBe(true)
  })
})

// ─── Boundary cases ───────────────────────────────────────────────────────────

describe('inspectEnvelope — boundary cases', () => {
  it('handles an unsigned (zero-signature) plain transaction', () => {
    const kp = makeKeypair()
    const destKp = makeKeypair()

    // Build but do NOT sign
    const tx = new StellarSdk.TransactionBuilder(makeAccount(kp.publicKey()), {
      fee: '100',
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: destKp.publicKey(),
          asset: StellarSdk.Asset.native(),
          amount: '1',
        })
      )
      .setTimeout(180)
      .build()

    const result = inspectEnvelope(tx.toXDR(), 'testnet')

    expect(result.ok).toBe(true)
    expect(result.envelope.signatures).toBe(0)
  })

  it('returns ok=false for whitespace-only input without throwing', () => {
    const result = inspectEnvelope('   ', 'testnet')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('falls back to testnet passphrase for an unknown network name', () => {
    // Should not throw — unknown network resolves to testnet passphrase
    const kp = makeKeypair()
    const destKp = makeKeypair()
    const tx = buildInnerTx(kp, destKp.publicKey())

    // 'custom' network might not have a passphrase in tests; should not throw
    expect(() => inspectEnvelope(tx.toXDR(), 'unknown-network')).not.toThrow()
  })
})

// ─── Failure cases ────────────────────────────────────────────────────────────

describe('inspectEnvelope — failure cases', () => {
  it('returns ok=false for empty string', () => {
    const result = inspectEnvelope('', 'testnet')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('empty')
  })

  it('returns ok=false for a non-XDR string', () => {
    const result = inspectEnvelope('not-valid-xdr-at-all', 'testnet')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns ok=false for truncated/corrupted XDR', () => {
    const kp = makeKeypair()
    const destKp = makeKeypair()
    const tx = buildInnerTx(kp, destKp.publicKey())
    const truncated = tx.toXDR().slice(0, 20) // deliberately corrupt

    const result = inspectEnvelope(truncated, 'testnet')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('does not throw — always returns a discriminated union', () => {
    const inputs = [null, undefined, 123, {}, [], '']
    for (const input of inputs) {
      expect(() => inspectEnvelope(input, 'testnet')).not.toThrow()
    }
  })
})
