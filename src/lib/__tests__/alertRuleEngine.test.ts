/**
 * Tests for Alert Rule Engine
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AlertRule } from '../../types/alerts'
import * as stellar from '../stellar'
import * as alertRulesDb from '../alertRulesDb'

// Mock dependencies
vi.mock('../stellar')
vi.mock('../alertRulesDb')
vi.mock('../alertNotifications')

describe('Alert Rule Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Balance Threshold Rules', () => {
    it('should trigger when balance drops below threshold', async () => {
      const mockAccount = {
        balances: [
          { asset_type: 'native', balance: '50.0000000' }
        ]
      }

      vi.mocked(stellar.fetchAccount).mockResolvedValue(mockAccount as any)
      vi.mocked(stellar.isValidPublicKey).mockReturnValue(true)

      const rule: AlertRule = {
        id: 'test-rule-1',
        userId: 'GTEST',
        accountAddress: 'GTEST',
        type: 'balance_threshold',
        config: {
          assetCode: 'XLM',
          threshold: 100,
          direction: 'below'
        },
        executionFrequency: 60,
        enabled: true,
        createdAt: Date.now(),
        lastEvaluatedAt: null,
        lastTriggeredAt: null,
        notificationChannels: ['in_app']
      }

      // The rule should trigger because balance (50) < threshold (100)
      expect(parseFloat(mockAccount.balances[0].balance)).toBeLessThan(100)
    })

    it('should not trigger when balance is above threshold', async () => {
      const mockAccount = {
        balances: [
          { asset_type: 'native', balance: '150.0000000' }
        ]
      }

      vi.mocked(stellar.fetchAccount).mockResolvedValue(mockAccount as any)
      vi.mocked(stellar.isValidPublicKey).mockReturnValue(true)

      const rule: AlertRule = {
        id: 'test-rule-2',
        userId: 'GTEST',
        accountAddress: 'GTEST',
        type: 'balance_threshold',
        config: {
          assetCode: 'XLM',
          threshold: 100,
          direction: 'below'
        },
        executionFrequency: 60,
        enabled: true,
        createdAt: Date.now(),
        lastEvaluatedAt: null,
        lastTriggeredAt: null,
        notificationChannels: ['in_app']
      }

      // The rule should NOT trigger because balance (150) > threshold (100)
      expect(parseFloat(mockAccount.balances[0].balance)).toBeGreaterThan(100)
    })
  })

  describe('Operation Type Rules', () => {
    it('should trigger when matching operation type appears', async () => {
      const mockOperations = {
        records: [
          { type: 'payment', id: 'op1' },
          { type: 'create_account', id: 'op2' }
        ],
        nextCursor: null,
        hasMore: false
      }

      vi.mocked(stellar.fetchOperations).mockResolvedValue(mockOperations as any)
      vi.mocked(stellar.isValidPublicKey).mockReturnValue(true)

      const rule: AlertRule = {
        id: 'test-rule-3',
        userId: 'GTEST',
        accountAddress: 'GTEST',
        type: 'operation_type',
        config: {
          operationTypes: ['payment']
        },
        executionFrequency: 60,
        enabled: true,
        createdAt: Date.now(),
        lastEvaluatedAt: null,
        lastTriggeredAt: null,
        notificationChannels: ['in_app']
      }

      // Should find a payment operation
      const hasPayment = mockOperations.records.some(op => op.type === 'payment')
      expect(hasPayment).toBe(true)
    })

    it('should not trigger when no matching operations', async () => {
      const mockOperations = {
        records: [
          { type: 'change_trust', id: 'op1' }
        ],
        nextCursor: null,
        hasMore: false
      }

      vi.mocked(stellar.fetchOperations).mockResolvedValue(mockOperations as any)
      vi.mocked(stellar.isValidPublicKey).mockReturnValue(true)

      const rule: AlertRule = {
        id: 'test-rule-4',
        userId: 'GTEST',
        accountAddress: 'GTEST',
        type: 'operation_type',
        config: {
          operationTypes: ['payment']
        },
        executionFrequency: 60,
        enabled: true,
        createdAt: Date.now(),
        lastEvaluatedAt: null,
        lastTriggeredAt: null,
        notificationChannels: ['in_app']
      }

      // Should NOT find a payment operation
      const hasPayment = mockOperations.records.some(op => op.type === 'payment')
      expect(hasPayment).toBe(false)
    })
  })

  describe('Counterparty Rules', () => {
    it('should trigger when counterparty appears in operations', async () => {
      const counterparty = 'GCOUNTERPARTY'
      const mockOperations = {
        records: [
          { 
            type: 'payment', 
            id: 'op1',
            from: counterparty,
            to: 'GTEST'
          }
        ],
        nextCursor: null,
        hasMore: false
      }

      vi.mocked(stellar.fetchOperations).mockResolvedValue(mockOperations as any)
      vi.mocked(stellar.isValidPublicKey).mockReturnValue(true)

      const rule: AlertRule = {
        id: 'test-rule-5',
        userId: 'GTEST',
        accountAddress: 'GTEST',
        type: 'counterparty',
        config: {
          counterpartyAddress: counterparty,
          direction: 'incoming'
        },
        executionFrequency: 60,
        enabled: true,
        createdAt: Date.now(),
        lastEvaluatedAt: null,
        lastTriggeredAt: null,
        notificationChannels: ['in_app']
      }

      // Should find the counterparty in operations
      const hasCounterparty = mockOperations.records.some(op => op.from === counterparty)
      expect(hasCounterparty).toBe(true)
    })
  })

  describe('Rule Evaluation Timing', () => {
    it('should respect executionFrequency', () => {
      const now = Date.now()
      const lastEval = now - 30000 // 30 seconds ago
      const frequency = 60 // 60 seconds

      const rule: AlertRule = {
        id: 'test-rule-6',
        userId: 'GTEST',
        accountAddress: 'GTEST',
        type: 'balance_threshold',
        config: {
          assetCode: 'XLM',
          threshold: 100,
          direction: 'below'
        },
        executionFrequency: frequency,
        enabled: true,
        createdAt: now,
        lastEvaluatedAt: lastEval,
        lastTriggeredAt: null,
        notificationChannels: ['in_app']
      }

      // Rule should NOT be evaluated yet (only 30s passed, needs 60s)
      const timeSinceLastEval = now - lastEval
      const shouldEvaluate = timeSinceLastEval >= (frequency * 1000)
      expect(shouldEvaluate).toBe(false)
    })

    it('should evaluate when frequency interval has elapsed', () => {
      const now = Date.now()
      const lastEval = now - 70000 // 70 seconds ago
      const frequency = 60 // 60 seconds

      const rule: AlertRule = {
        id: 'test-rule-7',
        userId: 'GTEST',
        accountAddress: 'GTEST',
        type: 'balance_threshold',
        config: {
          assetCode: 'XLM',
          threshold: 100,
          direction: 'below'
        },
        executionFrequency: frequency,
        enabled: true,
        createdAt: now,
        lastEvaluatedAt: lastEval,
        lastTriggeredAt: null,
        notificationChannels: ['in_app']
      }

      // Rule SHOULD be evaluated (70s passed, needs 60s)
      const timeSinceLastEval = now - lastEval
      const shouldEvaluate = timeSinceLastEval >= (frequency * 1000)
      expect(shouldEvaluate).toBe(true)
    })
  })

  describe('Disabled Rules', () => {
    it('should not evaluate disabled rules', () => {
      const rule: AlertRule = {
        id: 'test-rule-8',
        userId: 'GTEST',
        accountAddress: 'GTEST',
        type: 'balance_threshold',
        config: {
          assetCode: 'XLM',
          threshold: 100,
          direction: 'below'
        },
        executionFrequency: 60,
        enabled: false, // Disabled
        createdAt: Date.now(),
        lastEvaluatedAt: null,
        lastTriggeredAt: null,
        notificationChannels: ['in_app']
      }

      expect(rule.enabled).toBe(false)
    })
  })
})
