import { describe, expect, it } from 'vitest'
import { predictTransactionFailure } from '../transactionFailurePrediction'

describe('predictTransactionFailure', () => {
  it('assigns a high success probability to healthy transactions', () => {
    const result = predictTransactionFailure({
      sourceAccount: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890',
      balance: 2500000,
      sequenceNumber: 42,
      fee: 100,
      operationTypes: ['payment'],
      networkCongestion: 0.2,
      historicalFailureRate: 0.03,
      hasMemo: false,
    })

    expect(result.successProbability).toBeGreaterThan(0.85)
    expect(result.riskLevel).toBe('low')
    expect(result.confidenceInterval.lower).toBeLessThan(result.confidenceInterval.upper)
    expect(result.remediationActions).toEqual([])
  })

  it('flags risky transactions with actionable remediation steps', () => {
    const result = predictTransactionFailure({
      sourceAccount: '',
      balance: 150,
      sequenceNumber: 999,
      fee: 1,
      operationTypes: ['createAccount', 'clawback'],
      networkCongestion: 1.25,
      historicalFailureRate: 0.28,
      hasMemo: true,
    })

    expect(result.successProbability).toBeLessThan(0.5)
    expect(result.riskLevel).toBe('high')
    expect(result.warning).toContain('high-risk')
    expect(result.remediationActions.length).toBeGreaterThan(0)
    expect(result.confidenceInterval.lower).toBeLessThanOrEqual(result.successProbability)
  })
})
