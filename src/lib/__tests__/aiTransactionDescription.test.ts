import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateTransactionDescription,
  generateBatchDescriptions,
  extractTransactionFeatures,
  formatAddress,
  formatAmount,
  saveUserCorrection,
  recordUserFeedback,
  getSystemAccuracyMetrics,
  getStoredOverrides,
  getStoredFeedback,
  getLearnedRules,
  TransactionInput
} from '../aiTransactionDescription'

describe('aiTransactionDescription system (#548)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  describe('Helpers', () => {
    it('formats addresses with optional label maps', () => {
      const labels = { GADDR1234567890ABCDEF: 'Binance Hot Wallet' }
      expect(formatAddress('GADDR1234567890ABCDEF', labels)).toBe('Binance Hot Wallet')
      expect(formatAddress('GCXXXXXXXXXXXXYYYYYYYYYYYYZZZZZZZZZZZZ')).toBe('GCXX...ZZZZ')
      expect(formatAddress('')).toBe('Unknown Account')
    })

    it('formats currency amounts cleanly', () => {
      expect(formatAmount(100, 'XLM')).toBe('100 XLM')
      expect(formatAmount('50.5', 'USDC')).toBe('50.5 USDC')
      expect(formatAmount('')).toBe('')
    })
  })

  describe('Feature Extraction', () => {
    it('extracts transaction properties accurately', () => {
      const tx: TransactionInput = {
        id: 'tx_1',
        hash: 'hash_1',
        created_at: new Date().toISOString(),
        memo: 'sep-24 deposit',
        operations: [
          { type: 'path_payment_strict_send', amount: '100', asset_code: 'XLM', dest_asset_code: 'USDC' }
        ]
      }
      const features = extractTransactionFeatures(tx)
      expect(features.opTypes).toContain('path_payment_strict_send')
      expect(features.isPathPayment).toBe(true)
      expect(features.hasAnchorMemo).toBe(true)
    })
  })

  describe('NLG Description Generation for Stellar Operation Types', () => {
    it('generates human-readable descriptions for simple payments', () => {
      const tx: TransactionInput = {
        id: 'tx_pay',
        hash: '0xhash123456789',
        created_at: new Date().toISOString(),
        source_account: 'GAAA1111222233334444',
        memo: 'Invoice 101',
        operations: [
          {
            type: 'payment',
            from: 'GAAA1111222233334444',
            to: 'GBBB5555666677778888',
            amount: '250',
            asset_code: 'USDC'
          }
        ]
      }

      const res = generateTransactionDescription(tx)
      expect(res.category).toBe('Transfer')
      expect(res.description).toContain('Sent 250 USDC from GAAA...4444 to GBBB...8888 with memo "Invoice 101"')
      expect(res.confidence).toBeGreaterThan(0.85)
    })

    it('generates descriptions for DEX swaps and path payments', () => {
      const tx: TransactionInput = {
        id: 'tx_swap',
        hash: '0xswap123456789',
        created_at: new Date().toISOString(),
        operations: [
          {
            type: 'path_payment_strict_send',
            source_amount: '100',
            source_asset_code: 'XLM',
            destination_amount: '12',
            destination_asset_code: 'USDC'
          }
        ]
      }

      const res = generateTransactionDescription(tx)
      expect(res.category).toBe('Trade & Exchange')
      expect(res.description).toContain('Swapped 100 XLM for 12 USDC via DEX')
      expect(res.confidence).toBeGreaterThan(0.85)
    })

    it('generates descriptions for Soroban smart contract invocations', () => {
      const tx: TransactionInput = {
        id: 'tx_contract',
        hash: '0xcontract123456789',
        created_at: new Date().toISOString(),
        operations: [
          {
            type: 'invoke_host_function',
            function_name: 'swap_tokens',
            contract_id: 'CCONTRACT1234567890'
          }
        ]
      }

      const res = generateTransactionDescription(tx)
      expect(res.category).toBe('Smart Contract')
      expect(res.description).toContain("Executed smart contract function 'swap_tokens' on CCON...7890")
      expect(res.confidence).toBeGreaterThan(0.85)
    })

    it('generates descriptions for Anchor deposits and withdrawals', () => {
      const tx: TransactionInput = {
        id: 'tx_anchor',
        hash: '0xanchor123456789',
        created_at: new Date().toISOString(),
        memo: 'sep-24 deposit ref-99',
        operations: [
          {
            type: 'payment',
            amount: '500',
            asset_code: 'USDC'
          }
        ]
      }

      const res = generateTransactionDescription(tx)
      expect(res.category).toBe('Anchor & Offramp')
      expect(res.description).toContain('Deposit of 500 USDC via Anchor service')
      expect(res.confidence).toBeGreaterThan(0.85)
    })
  })

  describe('User Corrections & Feedback Learning Loop', () => {
    it('applies manual user overrides for specific transactions', () => {
      const tx: TransactionInput = {
        id: 'tx_custom',
        hash: '0xcustom_hash_99',
        created_at: new Date().toISOString(),
        operations: [{ type: 'payment', amount: '10' }]
      }

      saveUserCorrection('0xcustom_hash_99', 'Monthly Subscription Payment to Acme Corp')

      const res = generateTransactionDescription(tx)
      expect(res.isUserOverride).toBe(true)
      expect(res.description).toBe('Monthly Subscription Payment to Acme Corp')
      expect(res.confidence).toBe(1.0)
    })

    it('learns pattern rules from user corrections and applies them to similar transactions', () => {
      const txPattern1: TransactionInput = {
        id: 'tx_p1',
        hash: '0xpattern_1',
        created_at: new Date().toISOString(),
        operations: [{ type: 'change_trust', asset_code: 'AQUA' }]
      }

      saveUserCorrection('0xpattern_1', 'Opted into AQUA Rewards Token', 'change_trust:AQUA')

      const txPattern2: TransactionInput = {
        id: 'tx_p2',
        hash: '0xpattern_2',
        created_at: new Date().toISOString(),
        operations: [{ type: 'change_trust', asset_code: 'AQUA' }]
      }

      const res = generateTransactionDescription(txPattern2)
      expect(res.description).toBe('Opted into AQUA Rewards Token')
      expect(res.confidence).toBe(0.95)
    })

    it('records feedback and maintains system accuracy metrics >= 85%', () => {
      recordUserFeedback({
        txHash: '0xhash1',
        rating: 'helpful',
        originalDescription: 'Sent 10 XLM',
        timestamp: new Date().toISOString()
      }, 'payment_single')

      recordUserFeedback({
        txHash: '0xhash2',
        rating: 'helpful',
        originalDescription: 'Swapped XLM for USDC',
        timestamp: new Date().toISOString()
      }, 'dex_swap')

      const metrics = getSystemAccuracyMetrics()
      expect(metrics.helpfulCount).toBe(2)
      expect(metrics.accuracyPercentage).toBeGreaterThanOrEqual(85)
    })
  })

  describe('Batch Description Generation', () => {
    it('annotates arrays of transactions in batch', () => {
      const txs: TransactionInput[] = [
        {
          id: 'tx_b1',
          hash: '0xb1',
          created_at: new Date().toISOString(),
          operations: [{ type: 'payment', amount: '5', asset_code: 'XLM' }]
        },
        {
          id: 'tx_b2',
          hash: '0xb2',
          created_at: new Date().toISOString(),
          operations: [{ type: 'invoke_host_function', function_name: 'mint' }]
        }
      ]

      const batch = generateBatchDescriptions(txs)
      expect(Object.keys(batch)).toHaveLength(2)
      expect(batch['0xb1'].description).toBeDefined()
      expect(batch['0xb2'].description).toBeDefined()
    })
  })
})
