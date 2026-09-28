import { describe, it, expect, beforeEach } from 'vitest'
import {
  createAlertRuleFromTemplate,
  getAlertRuleTemplate,
  listAlertRuleTemplates,
} from '../alertRuleTemplates'
import {
  evaluateFeeSpike,
  evaluateRpcLatency,
  evaluateSubmissionFailures,
} from '../alertRuleEngine'
import {
  clearMetric,
  incrementCounter,
  recordApiCall,
  recordFeeObservation,
  recordMetric,
} from '../../utils/metricsCollector'

describe('alertRuleTemplates', () => {
  beforeEach(() => {
    clearMetric('business.fee.stroops')
    clearMetric('business.tx.failure')
    clearMetric('technical.api.latency_ms')
  })

  it('lists starter templates for common developer incidents', () => {
    const templates = listAlertRuleTemplates()
    expect(templates.map((template) => template.id)).toEqual([
      'fee_spike',
      'submission_failures',
      'rpc_latency',
    ])
  })

  it('creates a fee spike rule from template defaults', () => {
    const template = getAlertRuleTemplate('fee_spike')
    expect(template).not.toBeNull()

    const rule = createAlertRuleFromTemplate({
      templateId: 'fee_spike',
      userId: 'GUSER',
      accountAddress: 'GACCOUNT',
    })

    expect(rule.type).toBe('fee_spike')
    expect(rule.config).toMatchObject({ multiplier: 2, windowSeconds: 900 })
  })

  it('rejects invalid template input', () => {
    expect(() =>
      createAlertRuleFromTemplate({
        templateId: 'fee_spike',
        userId: '',
        accountAddress: 'GACCOUNT',
      }),
    ).toThrow(/required/)
  })

  it('triggers fee spike evaluation when latest fee exceeds baseline', () => {
    const rule = createAlertRuleFromTemplate({
      templateId: 'fee_spike',
      userId: 'GUSER',
      accountAddress: 'GACCOUNT',
      overrides: { minSamples: 3, multiplier: 2, windowSeconds: 3600 },
    })

    recordFeeObservation(100)
    recordFeeObservation(110)
    recordFeeObservation(100)
    recordFeeObservation(250)

    expect(evaluateFeeSpike(rule)).toBe(true)
  })

  it('does not trigger submission failures below threshold', () => {
    const rule = createAlertRuleFromTemplate({
      templateId: 'submission_failures',
      userId: 'GUSER',
      accountAddress: 'GACCOUNT',
      overrides: { failureCountThreshold: 3, windowSeconds: 3600 },
    })

    incrementCounter('business.tx.failure', 1)
    incrementCounter('business.tx.failure', 1)

    expect(evaluateSubmissionFailures(rule)).toBe(false)
  })

  it('triggers rpc latency regression when percentile exceeds threshold', () => {
    const rule = createAlertRuleFromTemplate({
      templateId: 'rpc_latency',
      userId: 'GUSER',
      accountAddress: 'GACCOUNT',
      overrides: {
        endpoint: 'horizon',
        thresholdMs: 1000,
        minSamples: 3,
        percentile: 95,
        windowSeconds: 3600,
      },
    })

    recordApiCall('horizon', 400, 200)
    recordApiCall('horizon', 500, 200)
    recordApiCall('horizon', 1800, 200)

    expect(evaluateRpcLatency(rule)).toBe(true)
  })

  it('handles insufficient metric samples as a boundary case', () => {
    const rule = createAlertRuleFromTemplate({
      templateId: 'rpc_latency',
      userId: 'GUSER',
      accountAddress: 'GACCOUNT',
      overrides: { minSamples: 10, windowSeconds: 3600 },
    })

    recordMetric('technical.api.latency_ms', 2000, { endpoint: 'horizon' })
    expect(evaluateRpcLatency(rule)).toBe(false)
  })
})
