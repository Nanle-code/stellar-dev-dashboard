import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CostThresholdManager, type CostTagRule, type TransactionInput } from '../costThresholdManager'

describe('CostThresholdManager', () => {
  let manager: CostThresholdManager

  beforeEach(() => {
    // Clear mock storage if any
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    manager = new CostThresholdManager([], 'test_cost_threshold_rules')
  })

  // ---------------------------------------------------------------------------
  // Primary Flow
  // ---------------------------------------------------------------------------
  describe('Primary Flow', () => {
    it('should add, update, and retrieve cost tag rules', () => {
      const rule = manager.addRule({
        tag: 'billing',
        memoPrefix: '[APP:billing]',
        budgetLimitStroops: 10_000_000, // 1 XLM
        warningThresholdPercent: 80,
      })

      expect(rule.id).toBeDefined()
      expect(rule.tag).toBe('billing')
      expect(rule.enabled).toBe(true)

      const updated = manager.updateRule(rule.id, { budgetLimitStroops: 20_000_000 })
      expect(updated?.budgetLimitStroops).toBe(20_000_000)

      const rules = manager.getRules()
      expect(rules).toHaveLength(1)
      expect(rules[0].budgetLimitStroops).toBe(20_000_000)
    })

    it('should attribute fees and volume to configured application tags by memo prefix', () => {
      manager.addRule({
        tag: 'billing',
        memoPrefix: '[APP:billing]',
        budgetLimitStroops: 10_000_000, // 1 XLM
      })
      manager.addRule({
        tag: 'auth',
        memoPrefix: 'AUTH:',
        budgetLimitStroops: 5_000_000,
      })

      const transactions: TransactionInput[] = [
        {
          id: 'tx_1',
          fee_charged: '100',
          memo: '[APP:billing] Invoice #101',
          created_at: '2026-09-28T10:00:00Z',
          operations: [{ amount: '50000000' }], // 5 XLM volume
        },
        {
          id: 'tx_2',
          fee_charged: '200',
          memo: '[APP:billing] Invoice #102',
          created_at: '2026-09-28T10:05:00Z',
          operations: [{ amount: '20000000' }], // 2 XLM volume
        },
        {
          id: 'tx_3',
          fee_charged: '150',
          memo: 'AUTH: Session renewal',
          created_at: '2026-09-28T10:10:00Z',
        },
      ]

      const summary = manager.attributeTransactions(transactions)

      expect(summary.totalTransactions).toBe(3)
      expect(summary.totalAttributedFeeStroops).toBe(450)
      expect(summary.totalAttributedFeeXlm).toBe(450 / 10_000_000)
      expect(summary.totalUnattributedFeeStroops).toBe(0)
      expect(summary.tagBreakdown).toHaveLength(2)

      const billingTag = summary.tagBreakdown.find((b) => b.tag === 'billing')
      expect(billingTag).toBeDefined()
      expect(billingTag?.transactionCount).toBe(2)
      expect(billingTag?.totalFeeStroops).toBe(300)
      expect(billingTag?.averageFeeStroops).toBe(150)
      expect(billingTag?.totalVolumeStroops).toBe(70_000_000)
      expect(billingTag?.totalVolumeXlm).toBe(7)
      expect(billingTag?.status).toBe('ok')
    })

    it('should auto-discover tag prefixes when no explicit rule matches', () => {
      const transactions: TransactionInput[] = [
        {
          id: 'tx_auto_1',
          fee_charged: '500',
          memo: '[APP:nft-drop] Mint #42',
        },
        {
          id: 'tx_auto_2',
          fee_charged: '300',
          memo: 'TAG:rewards User payout',
        },
      ]

      const summary = manager.attributeTransactions(transactions)

      expect(summary.totalAttributedFeeStroops).toBe(800)
      expect(summary.tagBreakdown).toHaveLength(2)

      const nftTag = summary.tagBreakdown.find((b) => b.tag === 'nft-drop')
      expect(nftTag).toBeDefined()
      expect(nftTag?.ruleId).toBe('auto-discovered')
      expect(nftTag?.status).toBe('unbudgeted')
    })

    it('should export attribution report in JSON and CSV formats', () => {
      manager.addRule({
        tag: 'payments',
        memoPrefix: 'PAY:',
        budgetLimitStroops: 10_000_000,
      })

      const transactions: TransactionInput[] = [
        { id: 'tx_1', fee_charged: '1000', memo: 'PAY: Vendor invoice' },
      ]

      const summary = manager.attributeTransactions(transactions)

      const jsonExport = manager.exportAttributionReport(summary, 'json')
      expect(jsonExport).toContain('"tag": "payments"')
      expect(jsonExport).toContain('"totalFeeStroops": 1000')

      const csvExport = manager.exportAttributionReport(summary, 'csv')
      expect(csvExport).toContain('Tag,Rule ID,Transactions')
      expect(csvExport).toContain('"payments"')
      expect(csvExport).toContain('1000')
    }

)
  })

  // ---------------------------------------------------------------------------
  // Boundary Cases
  // ---------------------------------------------------------------------------
  describe('Boundary Cases', () => {
    it('should handle empty transaction list gracefully', () => {
      const summary = manager.attributeTransactions([])

      expect(summary.totalTransactions).toBe(0)
      expect(summary.totalOperations).toBe(0)
      expect(summary.totalAttributedFeeStroops).toBe(0)
      expect(summary.tagBreakdown).toHaveLength(0)
      expect(summary.thresholdAlerts).toHaveLength(0)
    })

    it('should trigger warning alert on reaching exact warning threshold percentage', () => {
      manager.addRule({
        tag: 'swap',
        memoPrefix: 'SWAP:',
        budgetLimitStroops: 1000,
        warningThresholdPercent: 80,
      })

      const transactions: TransactionInput[] = [
        { id: 'tx_1', fee_charged: '800', memo: 'SWAP: XLM-USDC' }, // Exactly 80% (800 / 1000)
      ]

      const summary = manager.attributeTransactions(transactions)
      const swapRecord = summary.tagBreakdown.find((b) => b.tag === 'swap')

      expect(swapRecord?.budgetUsedPercent).toBe(80)
      expect(swapRecord?.status).toBe('warning')
      expect(summary.thresholdAlerts).toHaveLength(1)
      expect(summary.thresholdAlerts[0].severity).toBe('warning')
      expect(summary.thresholdAlerts[0].tag).toBe('swap')
    })

    it('should trigger exceeded alert on reaching or exceeding 100% budget', () => {
      manager.addRule({
        tag: 'governance',
        memoPrefix: 'GOV:',
        budgetLimitStroops: 1000,
      })

      const transactions: TransactionInput[] = [
        { id: 'tx_1', fee_charged: '1000', memo: 'GOV: Vote #1' }, // Exactly 100%
      ]

      const summary = manager.attributeTransactions(transactions)
      const govRecord = summary.tagBreakdown.find((b) => b.tag === 'governance')

      expect(govRecord?.budgetUsedPercent).toBe(100)
      expect(govRecord?.status).toBe('exceeded')
      expect(summary.thresholdAlerts).toHaveLength(1)
      expect(summary.thresholdAlerts[0].severity).toBe('exceeded')
    })

    it('should handle zero-fee transactions correctly', () => {
      manager.addRule({ tag: 'free-tier', memoPrefix: 'FREE:' })

      const transactions: TransactionInput[] = [
        { id: 'tx_zero', fee_charged: '0', memo: 'FREE: Zero fee operation' },
      ]

      const summary = manager.attributeTransactions(transactions)
      const record = summary.tagBreakdown.find((b) => b.tag === 'free-tier')

      expect(record?.totalFeeStroops).toBe(0)
      expect(record?.averageFeeStroops).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Failure Cases & Robustness
  // ---------------------------------------------------------------------------
  describe('Failure Cases & Error Handling', () => {
    it('should handle null or undefined input gracefully', () => {
      // @ts-expect-error - testing invalid runtime input
      const summaryNull = manager.attributeTransactions(null)
      expect(summaryNull.totalTransactions).toBe(0)
      expect(summaryNull.warnings).toContain('Input transactions was empty or not an array.')

      // @ts-expect-error - testing invalid runtime input
      const summaryUndefined = manager.attributeTransactions(undefined)
      expect(summaryUndefined.totalTransactions).toBe(0)
    })

    it('should handle malformed transaction records with NaN or negative fees', () => {
      manager.addRule({ tag: 'test-app', memoPrefix: 'TEST:' })

      const transactions: TransactionInput[] = [
        { id: 'tx_bad_1', fee_charged: 'invalid_number', memo: 'TEST: 1' },
        { id: 'tx_bad_2', fee_charged: '-500', memo: 'TEST: 2' },
        { id: 'tx_good', fee_charged: '200', memo: 'TEST: 3' },
      ]

      const summary = manager.attributeTransactions(transactions)
      const record = summary.tagBreakdown.find((b) => b.tag === 'test-app')

      // Non-numeric and negative fees are safely parsed as 0
      expect(record?.totalFeeStroops).toBe(200)
      expect(record?.transactionCount).toBe(3)
    })

    it('should handle invalid regex patterns in rules without throwing', () => {
      manager.addRule({
        tag: 'broken-regex',
        memoPattern: '[invalid regex (unclosed bracket',
        enabled: true,
      })

      const transactions: TransactionInput[] = [
        { id: 'tx_1', fee_charged: '100', memo: 'Some random memo' },
      ]

      expect(() => manager.attributeTransactions(transactions)).not.toThrow()
    })

    it('should handle environments where localStorage throws permission/quota errors (SSR / Private Browsing)', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: The operation is insecure.')
      })
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      expect(() => {
        const ssrManager = new CostThresholdManager([], 'ssr_test_key')
        ssrManager.addRule({ tag: 'ssr-tag', memoPrefix: 'SSR:' })
        ssrManager.attributeTransactions([{ fee_charged: '100', memo: 'SSR: Test' }])
      }).not.toThrow()

      getItemSpy.mockRestore()
      setItemSpy.mockRestore()
    })

    it('should throw error when adding rule without required tag property', () => {
      expect(() => {
        // @ts-expect-error - testing missing tag property
        manager.addRule({})
      }).toThrow('Invalid rule input: tag is required')
    })
  })
})
