/**
 * Tests for fee-bump, sponsorship, and clawback operations (#196)
 * Covers: transactionBuilder.js functions, validation schemas, and React component rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as StellarSdk from '@stellar/stellar-sdk'
import { feeBump, createOperation, OPERATION_TYPES } from '../../../src/lib/transactionBuilder'
import { validateOperation } from '../../../src/utils/transactionValidation'

// ─── Builder Unit Tests ────────────────────────────────────────────────────────

describe('feeBump builder function', () => {
  const validFeeSource = 'GANIOWIIIQ4XECWLM3BOLMDX7UWAEKKPRHAMOAOJPZ3CFGBXUQFRGMXA'
  const validPublicKey = 'GCB6LGWDIPB53EGK2BRA43I6VXUYT2A4KZODT7FGFM2FUGO2BAUHLWCN'
  const testnet = 'testnet'

  it('builds valid fee-bump transaction with signed inner transaction XDR', () => {
    // Create a simple inner transaction XDR
    const keypair = StellarSdk.Keypair.random()
    const account = new StellarSdk.Account(keypair.publicKey(), '0')
    const innerTx = new StellarSdk.TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: StellarSdk.Networks.TESTNET,
      timeout: 180,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: validPublicKey,
          asset: StellarSdk.Asset.native(),
          amount: '10',
        })
      )
      .setTimeout(180)
      .build()
    
    innerTx.sign(keypair)
    const innerXDR = innerTx.toXDR()

    const result = feeBump({
      feeSource: validFeeSource,
      baseFee: '200',
      innerTransaction: innerXDR,
      network: testnet,
    })

    expect(result).toBeDefined()
    expect(result.feeSource).toEqual(validFeeSource)
  })

  it('throws error on invalid fee source', () => {
    const keypair = StellarSdk.Keypair.random()
    const account = new StellarSdk.Account(keypair.publicKey(), '0')
    const innerTx = new StellarSdk.TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: StellarSdk.Networks.TESTNET,
      timeout: 180,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: validPublicKey,
          asset: StellarSdk.Asset.native(),
          amount: '10',
        })
      )
      .setTimeout(180)
      .build()
    innerTx.sign(keypair)

    expect(() => {
      feeBump({
        feeSource: 'invalid-key',
        baseFee: '200',
        innerTransaction: innerTx.toXDR(),
        network: testnet,
      })
    }).toThrow()
  })

  it('throws error on non-positive base fee', () => {
    const keypair = StellarSdk.Keypair.random()
    const account = new StellarSdk.Account(keypair.publicKey(), '0')
    const innerTx = new StellarSdk.TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: StellarSdk.Networks.TESTNET,
      timeout: 180,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: validPublicKey,
          asset: StellarSdk.Asset.native(),
          amount: '10',
        })
      )
      .setTimeout(180)
      .build()
    innerTx.sign(keypair)

    expect(() => {
      feeBump({
        feeSource: validFeeSource,
        baseFee: '0',
        innerTransaction: innerTx.toXDR(),
        network: testnet,
      })
    }).toThrow()

    expect(() => {
      feeBump({
        feeSource: validFeeSource,
        baseFee: '-100',
        innerTransaction: innerTx.toXDR(),
        network: testnet,
      })
    }).toThrow()
  })

  it('throws error on empty or invalid inner transaction XDR', () => {
    expect(() => {
      feeBump({
        feeSource: validFeeSource,
        baseFee: '200',
        innerTransaction: '',
        network: testnet,
      })
    }).toThrow()

    expect(() => {
      feeBump({
        feeSource: validFeeSource,
        baseFee: '200',
        innerTransaction: '   ',
        network: testnet,
      })
    }).toThrow()

    expect(() => {
      feeBump({
        feeSource: validFeeSource,
        baseFee: '200',
        innerTransaction: 'not-valid-xdr-definitely',
        network: testnet,
      })
    }).toThrow()
  })
})

describe('beginSponsoringFutureReserves operation', () => {
  const validSponsoredId = 'GCB6LGWDIPB53EGK2BRA43I6VXUYT2A4KZODT7FGFM2FUGO2BAUHLWCN'

  it('builds correct beginSponsoringFutureReserves operation', () => {
    const result = createOperation('beginSponsoringFutureReserves', {
      sponsoredId: validSponsoredId,
    })

    expect(result).toBeDefined()
    expect(result.type).toEqual(StellarSdk.xdr.OperationType.beginSponsoringFutureReserves())
  })

  it('allows creating operation with valid sponsored ID', () => {
    expect(() => {
      createOperation('beginSponsoringFutureReserves', {
        sponsoredId: validSponsoredId,
      })
    }).not.toThrow()
  })
})

describe('endSponsoringFutureReserves operation', () => {
  it('builds correct endSponsoringFutureReserves operation', () => {
    const result = createOperation('endSponsoringFutureReserves', {})

    expect(result).toBeDefined()
    expect(result.type).toEqual(StellarSdk.xdr.OperationType.endSponsoringFutureReserves())
  })

  it('has no required parameters', () => {
    expect(() => {
      createOperation('endSponsoringFutureReserves', {})
    }).not.toThrow()
  })
})

describe('clawback operation', () => {
  const validAssetCode = 'USDC'
  const validIssuer = 'GCB6LGWDIPB53EGK2BRA43I6VXUYT2A4KZODT7FGFM2FUGO2BAUHLWCN'
  const validFrom = 'GANIOWIIIQ4XECWLM3BOLMDX7UWAEKKPRHAMOAOJPZ3CFGBXUQFRGMXA'
  const validAmount = '100.50'

  it('builds correct clawback operation', () => {
    const result = createOperation('clawback', {
      assetCode: validAssetCode,
      assetIssuer: validIssuer,
      from: validFrom,
      amount: validAmount,
    })

    expect(result).toBeDefined()
    expect(result.type).toEqual(StellarSdk.xdr.OperationType.clawback())
  })

  it('accepts all required clawback parameters', () => {
    expect(() => {
      createOperation('clawback', {
        assetCode: validAssetCode,
        assetIssuer: validIssuer,
        from: validFrom,
        amount: validAmount,
      })
    }).not.toThrow()
  })

  it('rejects invalid amount (zero or negative)', () => {
    expect(() => {
      createOperation('clawback', {
        assetCode: validAssetCode,
        assetIssuer: validIssuer,
        from: validFrom,
        amount: '0',
      })
    }).toThrow()
  })
})

// ─── Validation Tests ──────────────────────────────────────────────────────────

describe('feeBump validation schema', () => {
  it('accepts valid feeBump params', () => {
    const params = {
      feeSource: 'GCB6LGWDIPB53EGK2BRA43I6VXUYT2A4KZODT7FGFM2FUGO2BAUHLWCN',
      baseFee: '200',
      innerTransaction: 'AAAAAgAAAACcvBZPVqHd3l7P1l7LjGq9l2vE6K7wqmD4s2pR3Rjwrg==',
    }
    const errors = validateOperation('feeBump', params)
    expect(errors).toHaveLength(0)
  })

  it('rejects missing feeSource', () => {
    const params = {
      baseFee: '200',
      innerTransaction: 'AAAAAgAAAACcvBZPVqHd3l7P1l7LjGq9l2vE6K7wqmD4s2pR3Rjwrg==',
    }
    const errors = validateOperation('feeBump', params)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'feeSource')).toBe(true)
  })

  it('rejects invalid feeSource', () => {
    const params = {
      feeSource: 'not-a-valid-key',
      baseFee: '200',
      innerTransaction: 'AAAAAgAAAACcvBZPVqHd3l7P1l7LjGq9l2vE6K7wqmD4s2pR3Rjwrg==',
    }
    const errors = validateOperation('feeBump', params)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'feeSource')).toBe(true)
  })

  it('rejects empty innerTransaction', () => {
    const params = {
      feeSource: 'GCB6LGWDIPB53EGK2BRA43I6VXUYT2A4KZODT7FGFM2FUGO2BAUHLWCN',
      baseFee: '200',
      innerTransaction: '',
    }
    const errors = validateOperation('feeBump', params)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'innerTransaction')).toBe(true)
  })

  it('rejects non-positive baseFee', () => {
    const params = {
      feeSource: 'GCB6LGWDIPB53EGK2BRA43I6VXUYT2A4KZODT7FGFM2FUGO2BAUHLWCN',
      baseFee: '0',
      innerTransaction: 'AAAAAgAAAACcvBZPVqHd3l7P1l7LjGq9l2vE6K7wqmD4s2pR3Rjwrg==',
    }
    const errors = validateOperation('feeBump', params)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'baseFee')).toBe(true)
  })
})

describe('beginSponsoringFutureReserves validation schema', () => {
  it('accepts valid sponsored ID', () => {
    const params = {
      sponsoredId: 'GCB6LGWDIPB53EGK2BRA43I6VXUYT2A4KZODT7FGFM2FUGO2BAUHLWCN',
    }
    const errors = validateOperation('beginSponsoringFutureReserves', params)
    expect(errors).toHaveLength(0)
  })

  it('rejects invalid sponsored ID', () => {
    const params = {
      sponsoredId: 'invalid-public-key',
    }
    const errors = validateOperation('beginSponsoringFutureReserves', params)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'sponsoredId')).toBe(true)
  })
})

describe('endSponsoringFutureReserves validation schema', () => {
  it('accepts with no params', () => {
    const errors = validateOperation('endSponsoringFutureReserves', {})
    expect(errors).toHaveLength(0)
  })
})

describe('clawback validation schema', () => {
  it('accepts valid clawback params', () => {
    const params = {
      assetCode: 'USDC',
      assetIssuer: 'GCB6LGWDIPB53EGK2BRA43I6VXUYT2A4KZODT7FGFM2FUGO2BAUHLWCN',
      from: 'GANIOWIIIQ4XECWLM3BOLMDX7UWAEKKPRHAMOAOJPZ3CFGBXUQFRGMXA',
      amount: '100.50',
    }
    const errors = validateOperation('clawback', params)
    expect(errors).toHaveLength(0)
  })

  it('rejects invalid asset code', () => {
    const params = {
      assetCode: 'TOOLONGNAMETHATEXCEEDSMAXLENGTH',
      assetIssuer: 'GCB6LGWDIPB53EGK2BRA43I6VXUYT2A4KZODT7FGFM2FUGO2BAUHLWCN',
      from: 'GANIOWIIIQ4XECWLM3BOLMDX7UWAEKKPRHAMOAOJPZ3CFGBXUQFRGMXA',
      amount: '100.50',
    }
    const errors = validateOperation('clawback', params)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'assetCode')).toBe(true)
  })

  it('rejects invalid issuer', () => {
    const params = {
      assetCode: 'USDC',
      assetIssuer: 'not-a-valid-issuer',
      from: 'GANIOWIIIQ4XECWLM3BOLMDX7UWAEKKPRHAMOAOJPZ3CFGBXUQFRGMXA',
      amount: '100.50',
    }
    const errors = validateOperation('clawback', params)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'assetIssuer')).toBe(true)
  })

  it('rejects invalid from account', () => {
    const params = {
      assetCode: 'USDC',
      assetIssuer: 'GCB6LGWDIPB53EGK2BRA43I6VXUYT2A4KZODT7FGFM2FUGO2BAUHLWCN',
      from: 'not-a-valid-account',
      amount: '100.50',
    }
    const errors = validateOperation('clawback', params)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'from')).toBe(true)
  })

  it('rejects negative or zero amount', () => {
    const paramsZero = {
      assetCode: 'USDC',
      assetIssuer: 'GCB6LGWDIPB53EGK2BRA43I6VXUYT2A4KZODT7FGFM2FUGO2BAUHLWCN',
      from: 'GANIOWIIIQ4XECWLM3BOLMDX7UWAEKKPRHAMOAOJPZ3CFGBXUQFRGMXA',
      amount: '0',
    }
    const errorsZero = validateOperation('clawback', paramsZero)
    expect(errorsZero.length).toBeGreaterThan(0)
    expect(errorsZero.some((e) => e.field === 'amount')).toBe(true)

    const paramsNegative = {
      assetCode: 'USDC',
      assetIssuer: 'GCB6LGWDIPB53EGK2BRA43I6VXUYT2A4KZODT7FGFM2FUGO2BAUHLWCN',
      from: 'GANIOWIIIQ4XECWLM3BOLMDX7UWAEKKPRHAMOAOJPZ3CFGBXUQFRGMXA',
      amount: '-50.0',
    }
    const errorsNegative = validateOperation('clawback', paramsNegative)
    expect(errorsNegative.length).toBeGreaterThan(0)
    expect(errorsNegative.some((e) => e.field === 'amount')).toBe(true)
  })
})

// ─── Operation Type Listing Tests ─────────────────────────────────────────────────

describe('OPERATION_TYPES includes all four new operations', () => {
  it('includes feeBump operation type', () => {
    const feeBumpOp = OPERATION_TYPES.find((op) => op.value === 'feeBump')
    expect(feeBumpOp).toBeDefined()
    expect(feeBumpOp.label).toContain('Fee')
  })

  it('includes clawback operation type', () => {
    const clawbackOp = OPERATION_TYPES.find((op) => op.value === 'clawback')
    expect(clawbackOp).toBeDefined()
    expect(clawbackOp.label).toContain('Clawback')
  })

  it('includes beginSponsoringFutureReserves operation type', () => {
    const beginOp = OPERATION_TYPES.find((op) => op.value === 'beginSponsoringFutureReserves')
    expect(beginOp).toBeDefined()
  })

  it('includes endSponsoringFutureReserves operation type', () => {
    const endOp = OPERATION_TYPES.find((op) => op.value === 'endSponsoringFutureReserves')
    expect(endOp).toBeDefined()
  })
})
