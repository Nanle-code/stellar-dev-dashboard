import { describe, it, expect, vi } from 'vitest'
import * as StellarSdk from '@stellar/stellar-sdk'
import { calculateOperationFeeAttribution, formatFeeAttribution, type FeeAttributionReport } from '../feeAttribution'
import { NETWORKS } from '../stellar'

const TESTNET_PASSPHRASE = NETWORKS.testnet.passphrase

const sourceKeypair = StellarSdk.Keypair.random()
const destKeypair1 = StellarSdk.Keypair.random()
const destKeypair2 = StellarSdk.Keypair.random()
const destKeypair3 = StellarSdk.Keypair.random()
const assetIssuerKeypair = StellarSdk.Keypair.random()
const contractIdKeypair = StellarSdk.Keypair.random()
const feeSourceKeypair = StellarSdk.Keypair.random()

function createTestParams(operations: Array<{ type: string; params: Record<string, unknown> }>, overrides = {}) {
  return {
    sourceAccount: sourceKeypair.publicKey(),
    operations,
    baseFee: 100,
    network: 'testnet',
    memo: 'test memo',
    memoType: 'text',
    ...overrides,
  }
}

describe('feeAttribution', () => {
  describe('calculateOperationFeeAttribution', () => {
    it('should calculate fee attribution for single payment operation', () => {
      const params = createTestParams([
        { 
          type: 'payment', 
          params: { 
            destination: destKeypair1.publicKey(),
            assetType: 'native',
            amount: '1000000',
          } 
        },
      ])
      
      const report = calculateOperationFeeAttribution(params)
      
      expect(report.totalFee).toBeGreaterThan(0)
      expect(report.baseFee).toBe(100)
      expect(report.operationCount).toBe(1)
      expect(report.operations).toHaveLength(1)
      expect(report.operations[0].operationType).toBe('payment')
      expect(report.operations[0].estimatedFee).toBeGreaterThanOrEqual(100)
      expect(report.operations[0].feeBreakdown.base).toBe(100)
      expect(report.operations[0].feeBreakdown.operationWeight).toBe(1.0)
    })

    it('should calculate fee attribution for multiple operations', () => {
      const params = createTestParams([
        { type: 'payment', params: { destination: destKeypair1.publicKey(), assetType: 'native', amount: '1000000' } },
        { type: 'createAccount', params: { destination: destKeypair2.publicKey(), startingBalance: '2.5' } },
        { type: 'changeTrust', params: { assetCode: 'USDC', assetIssuer: assetIssuerKeypair.publicKey() } },
      ])
      
      const report = calculateOperationFeeAttribution(params)
      
      expect(report.operationCount).toBe(3)
      expect(report.operations).toHaveLength(3)
      expect(report.totalFee).toBeGreaterThanOrEqual(300) // More than base fee * 3
      
      // Check operation weights are applied
      const paymentOp = report.operations.find(o => o.operationType === 'payment')
      const createAccountOp = report.operations.find(o => o.operationType === 'createAccount')
      const changeTrustOp = report.operations.find(o => o.operationType === 'changeTrust')
      
      expect(paymentOp?.feeBreakdown.operationWeight).toBe(1.0)
      expect(createAccountOp?.feeBreakdown.operationWeight).toBe(1.2)
      expect(changeTrustOp?.feeBreakdown.operationWeight).toBe(0.8)
    })

    it('should apply complexity multipliers for complex operations', () => {
      const params = createTestParams([
        { type: 'invokeHostFunction', params: { contractId: contractIdKeypair.publicKey(), functionName: 'test', args: [] } },
        { type: 'pathPaymentStrictSend', params: { sendAssetType: 'native', sendAmount: '1000000', destination: destKeypair1.publicKey(), destAssetType: 'credit_alphanum4', destAssetCode: 'USDC', destAssetIssuer: assetIssuerKeypair.publicKey(), destMin: '500000', path: [] } },
      ])
      
      const report = calculateOperationFeeAttribution(params)
      
      const invokeOp = report.operations.find(o => o.operationType === 'invokeHostFunction')
      const pathPaymentOp = report.operations.find(o => o.operationType === 'pathPaymentStrictSend')
      
      // Complexity multipliers should be >= 1.0
      expect(invokeOp?.feeBreakdown.complexityMultiplier).toBeGreaterThanOrEqual(1.0)
      expect(pathPaymentOp?.feeBreakdown.complexityMultiplier).toBeGreaterThanOrEqual(1.0)
    })

    it('should include source account in operation attribution', () => {
      const customSourceKeypair = StellarSdk.Keypair.random()
      const params = createTestParams([
        { 
          type: 'payment', 
          params: { 
            destination: destKeypair1.publicKey(),
            assetType: 'native',
            amount: '1000000',
            source: customSourceKeypair.publicKey(),
          } 
        },
      ])
      
      const report = calculateOperationFeeAttribution(params)
      
      expect(report.operations[0].sourceAccount).toBe(customSourceKeypair.publicKey())
    })

    it('should handle different base fees', () => {
      const params = createTestParams([
        { type: 'payment', params: { destination: destKeypair1.publicKey(), assetType: 'native', amount: '1000000' } },
      ], { baseFee: 500 })
      
      const report = calculateOperationFeeAttribution(params)
      
      expect(report.baseFee).toBe(500)
      expect(report.operations[0].baseFee).toBe(500)
      expect(report.operations[0].estimatedFee).toBeGreaterThanOrEqual(500)
    })

    it('should handle empty operations list', () => {
      const params = createTestParams([])
      
      const report = calculateOperationFeeAttribution(params)
      
      expect(report.totalFee).toBe(0)
      expect(report.operationCount).toBe(0)
      expect(report.operations).toHaveLength(0)
    })
  })

  describe('formatFeeAttribution', () => {
    it('should format fee attribution report as string', () => {
      const mockReport: FeeAttributionReport = {
        totalFee: 5000,
        baseFee: 100,
        operationCount: 2,
        operations: [
          {
            operationIndex: 0,
            operationType: 'payment',
            sourceAccount: 'GSOURCE1111111111111111111111111111111111111111111111111111',
            baseFee: 100,
            estimatedFee: 2000,
            feeBreakdown: { base: 100, operationWeight: 1.0, complexityMultiplier: 1.0 },
          },
          {
            operationIndex: 1,
            operationType: 'createAccount',
            sourceAccount: 'GSOURCE2222222222222222222222222222222222222222222222222222',
            baseFee: 100,
            estimatedFee: 3000,
            feeBreakdown: { base: 100, operationWeight: 1.2, complexityMultiplier: 1.0 },
          },
        ],
      }
      
      const formatted = formatFeeAttribution(mockReport)
      
      expect(formatted).toContain('Fee Attribution Breakdown')
      expect(formatted).toContain('5,000 stroops')
      expect(formatted).toContain('payment')
      expect(formatted).toContain('createAccount')
      expect(formatted).toContain('2,000')
      expect(formatted).toContain('3,000')
      expect(formatted).toContain('40.0%')
      expect(formatted).toContain('60.0%')
    })

    it('should format fee-bump section when present', () => {
      const mockReport: FeeAttributionReport = {
        totalFee: 10000,
        baseFee: 200,
        operationCount: 2,
        operations: [
          {
            operationIndex: 0,
            operationType: 'payment',
            baseFee: 100,
            estimatedFee: 3000,
            feeBreakdown: { base: 100, operationWeight: 1.0, complexityMultiplier: 1.0 },
          },
        ],
        feeBump: {
          feeSource: 'GFEEBUMPSOURCE11111111111111111111111111111111111111111111111111',
          baseFee: 200,
          innerTransactionFee: 5000,
        },
      }
      
      const formatted = formatFeeAttribution(mockReport)
      
      expect(formatted).toContain('Fee-Bump Transaction')
      expect(formatted).toContain('GFEEBUMPSOURCE')
      expect(formatted).toContain('200')
      expect(formatted).toContain('5,000')
    })
  })

  describe('getOperationTypeWeight', () => {
    it('should return correct weights for known operation types', () => {
      // This tests the internal function via calculateOperationFeeAttribution
      const params = createTestParams([
        { type: 'payment', params: { destination: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', assetType: 'native', amount: '1000000' } },
        { type: 'invokeHostFunction', params: { contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB', functionName: 'test', args: [] } },
        { type: 'accountMerge', params: { destination: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC' } },
      ])
      
      const report = calculateOperationFeeAttribution(params)
      
      const paymentOp = report.operations.find(o => o.operationType === 'payment')
      const invokeOp = report.operations.find(o => o.operationType === 'invokeHostFunction')
      const mergeOp = report.operations.find(o => o.operationType === 'accountMerge')
      
      expect(paymentOp?.feeBreakdown.operationWeight).toBe(1.0)
      expect(invokeOp?.feeBreakdown.operationWeight).toBe(2.0)
      expect(mergeOp?.feeBreakdown.operationWeight).toBe(0.5)
    })

    it('should default to 1.0 for unknown operation types', () => {
      const params = createTestParams([
        { type: 'unknownOperation', params: {} },
      ])
      
      const report = calculateOperationFeeAttribution(params)
      
      expect(report.operations[0].feeBreakdown.operationWeight).toBe(1.0)
    })
  })
})