import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as StellarSdk from '@stellar/stellar-sdk'
import { importBatchXdr, simulateBatchXdr, validateXdrForBroadcast, type XdrImportItem } from '../batchXdrImport'
import { NETWORKS } from '../stellar'

const TESTNET_PASSPHRASE = NETWORKS.testnet.passphrase

function createTestTransaction(ops: StellarSdk.Operation[] = []) {
  const keypair = StellarSdk.Keypair.random()
  const account = new StellarSdk.Account(keypair.publicKey(), '1')
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: TESTNET_PASSPHRASE,
  })
  tx.setTimeout(180)
  ops.forEach(op => tx.addOperation(op))
  return tx.build()
}

function createFeeBumpTransaction(innerTx: StellarSdk.Transaction) {
  const feeSource = StellarSdk.Keypair.random()
  return StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
    feeSource.publicKey(),
    '200',
    innerTx,
    TESTNET_PASSPHRASE
  )
}

describe('batchXdrImport', () => {
  let testTx: StellarSdk.Transaction
  let testFeeBumpTx: StellarSdk.FeeBumpTransaction
  let testTxXdr: string
  let testFeeBumpXdr: string

  beforeEach(() => {
    testTx = createTestTransaction([
      StellarSdk.Operation.payment({
        destination: StellarSdk.Keypair.random().publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: '1000000',
      }),
      StellarSdk.Operation.changeTrust({
        asset: new StellarSdk.Asset('USDC', StellarSdk.Keypair.random().publicKey()),
      }),
    ])
    testTxXdr = testTx.toXDR()

    const innerTx = createTestTransaction([
      StellarSdk.Operation.payment({
        destination: StellarSdk.Keypair.random().publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: '500000',
      }),
    ])
    testFeeBumpTx = createFeeBumpTransaction(innerTx)
    testFeeBumpXdr = testFeeBumpTx.toXDR()
  })

  describe('importBatchXdr', () => {
    it('should import valid standard transaction XDR', () => {
      const items: XdrImportItem[] = [
        { xdr: testTxXdr, label: 'Test Payment' },
      ]
      const result = importBatchXdr(items, { network: 'testnet' })
      
      expect(result.items).toHaveLength(1)
      expect(result.items[0].valid).toBe(true)
      expect(result.items[0].envelope).toBeDefined()
      expect(result.items[0].envelope?.type).toBe('transaction')
      expect(result.items[0].envelope?.operationCount).toBe(2)
      expect(result.summary.valid).toBe(1)
      expect(result.summary.invalid).toBe(0)
      expect(result.summary.totalOperations).toBe(2)
    })

    it('should import valid fee-bump transaction XDR', () => {
      const items: XdrImportItem[] = [
        { xdr: testFeeBumpXdr, label: 'Fee Bump Test' },
      ]
      const result = importBatchXdr(items, { network: 'testnet' })
      
      expect(result.items).toHaveLength(1)
      expect(result.items[0].valid).toBe(true)
      expect(result.items[0].envelope?.type).toBe('fee_bump')
      expect(result.items[0].envelope?.innerTransaction.operationCount).toBe(1)
      expect(result.summary.hasFeeBump).toBe(true)
    })

    it('should handle mixed valid and invalid XDRs', () => {
      const items: XdrImportItem[] = [
        { xdr: testTxXdr, label: 'Valid' },
        { xdr: 'invalid-xdr', label: 'Invalid' },
        { xdr: '', label: 'Empty' },
      ]
      const result = importBatchXdr(items, { network: 'testnet', skipEmpty: false })
      
      expect(result.items).toHaveLength(3)
      expect(result.summary.valid).toBe(1)
      expect(result.summary.invalid).toBe(2)
      expect(result.items[1].valid).toBe(false)
      expect(result.items[1].error).toContain('Could not parse XDR')
      expect(result.items[2].valid).toBe(false)
      expect(result.items[2].error).toBe('XDR is empty')
    })

    it('should skip empty XDRs when skipEmpty is true', () => {
      const items: XdrImportItem[] = [
        { xdr: testTxXdr, label: 'Valid' },
        { xdr: '', label: 'Empty' },
      ]
      const result = importBatchXdr(items, { network: 'testnet', skipEmpty: true })
      
      // When skipEmpty is true, empty items are still included but marked as invalid
      expect(result.items).toHaveLength(2)
      expect(result.summary.valid).toBe(1)
      expect(result.summary.invalid).toBe(1)
      expect(result.items[1].valid).toBe(false)
      expect(result.items[1].error).toBe('XDR is empty')
    })

    it('should respect maxItems limit', () => {
      const items: XdrImportItem[] = Array.from({ length: 150 }, (_, i) => ({
        xdr: testTxXdr,
        label: `Tx ${i}`,
      }))
      const result = importBatchXdr(items, { network: 'testnet', maxItems: 100 })
      
      expect(result.items).toHaveLength(100)
      expect(result.summary.total).toBe(100)
    })

    it('should include warnings for unsigned transactions', () => {
      const items: XdrImportItem[] = [
        { xdr: testTxXdr, label: 'Unsigned' },
      ]
      const result = importBatchXdr(items, { network: 'testnet' })
      
      expect(result.items[0].warnings).toBeDefined()
      expect(result.items[0].warnings?.some(w => w.includes('not signed'))).toBe(true)
    })

    it('should include warnings for zero operations', () => {
      const keypair = StellarSdk.Keypair.random()
      const account = new StellarSdk.Account(keypair.publicKey(), '1')
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: TESTNET_PASSPHRASE,
      })
      tx.setTimeout(180)
      const xdr = tx.build().toXDR()
      
      const items: XdrImportItem[] = [{ xdr, label: 'No Ops' }]
      const result = importBatchXdr(items, { network: 'testnet' })
      
      expect(result.items[0].warnings).toBeDefined()
      expect(result.items[0].warnings?.some(w => w.includes('no operations'))).toBe(true)
    })

    it('should calculate total fee correctly for fee-bump', () => {
      const items: XdrImportItem[] = [
        { xdr: testFeeBumpXdr, label: 'Fee Bump' },
      ]
      const result = importBatchXdr(items, { network: 'testnet' })
      
      const feeBumpFee = BigInt(testFeeBumpTx.fee)
      const innerFee = BigInt(testFeeBumpTx.innerTransaction.fee)
      expect(result.summary.totalFee).toBe((feeBumpFee + innerFee).toString())
    })
  })

  describe('validateXdrForBroadcast', () => {
    it('should validate signed transaction as ready for broadcast', () => {
      const keypair = StellarSdk.Keypair.random()
      testTx.sign(keypair)
      const signedXdr = testTx.toXDR()
      
      const result = validateXdrForBroadcast(signedXdr, 'testnet')
      
      expect(result.valid).toBe(true)
      expect(result.envelope).toBeDefined()
      expect(result.warnings).toBeUndefined()
    })

    it('should warn about unsigned transaction', () => {
      const result = validateXdrForBroadcast(testTxXdr, 'testnet')
      
      expect(result.valid).toBe(true)
      expect(result.warnings).toBeDefined()
      expect(result.warnings?.some(w => w.includes('not signed'))).toBe(true)
    })

    it('should warn about fee-bump with unsigned inner transaction', () => {
      // Create a fresh fee-bump transaction with unsigned inner transaction
      const innerKeypair = StellarSdk.Keypair.random()
      const innerAccount = new StellarSdk.Account(innerKeypair.publicKey(), '1')
      const innerTx = new StellarSdk.TransactionBuilder(innerAccount, {
        fee: '100',
        networkPassphrase: TESTNET_PASSPHRASE,
      })
      innerTx.setTimeout(180)
      innerTx.addOperation(StellarSdk.Operation.payment({
        destination: StellarSdk.Keypair.random().publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: '500000',
      }))
      const builtInnerTx = innerTx.build()
      
      const feeSource = StellarSdk.Keypair.random()
      const feeBumpTx = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
        feeSource.publicKey(),
        '200',
        builtInnerTx,
        TESTNET_PASSPHRASE
      )
      
      // Sign only the fee-bump, not the inner transaction
      const keypair = StellarSdk.Keypair.random()
      feeBumpTx.sign(keypair)
      const signedXdr = feeBumpTx.toXDR()
      
      const result = validateXdrForBroadcast(signedXdr, 'testnet')
      
      expect(result.valid).toBe(true)
      expect(result.warnings).toBeDefined()
      // Fee-bump transactions should have warnings about signing
      expect(result.warnings?.length).toBeGreaterThan(0)
    })

    it('should reject invalid XDR', () => {
      const result = validateXdrForBroadcast('not-valid-xdr', 'testnet')
      
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Could not parse XDR')
    })

    it('should reject empty XDR', () => {
      const result = validateXdrForBroadcast('', 'testnet')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('XDR is empty.')
    })
  })

  describe('simulateBatchXdr', () => {
    it('should simulate valid transactions', async () => {
      const keypair = StellarSdk.Keypair.random()
      testTx.sign(keypair)
      const signedXdr = testTx.toXDR()
      
      const items: XdrImportItem[] = [
        { xdr: signedXdr, label: 'Signed Tx' },
      ]
      const result = await simulateBatchXdr(items, 'testnet')
      
      expect(result.results).toHaveLength(1)
      expect(result.results[0].success).toBe(true)
      expect(result.results[0].fee).toBeDefined()
      expect(result.summary.successful).toBe(1)
      expect(result.summary.failed).toBe(0)
    })

    it('should handle invalid XDR in simulation', async () => {
      const items: XdrImportItem[] = [
        { xdr: 'invalid-xdr', label: 'Invalid' },
      ]
      const result = await simulateBatchXdr(items, 'testnet')
      
      expect(result.results).toHaveLength(1)
      expect(result.results[0].success).toBe(false)
      expect(result.results[0].error).toBeDefined()
      expect(result.summary.successful).toBe(0)
      expect(result.summary.failed).toBe(1)
    })
  })
})