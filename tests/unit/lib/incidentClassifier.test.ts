/**
 * Unit tests for incidentClassifier.ts (#593)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  classifyIncident,
  classifyBatch,
  getClassifierAccuracy,
  submitClassificationFeedback,
  getRecentClassifications,
  analyzeClassificationTrends,
  subscribeToIncidents,
  incidentClassifier,
} from '../../../src/lib/incidentClassifier'
import type { IncidentEvidence } from '../../../src/lib/incidentClassifier'

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Mock security events
vi.mock('../../../src/lib/securityEvents', () => ({
  SecurityEventType: Object.freeze({
    AUTH_LOGIN_SUCCESS: 'auth.login.success',
    AUTH_LOGIN_FAILED: 'auth.login.failed',
    AUTH_LOGOUT: 'auth.logout',
    AUTH_SESSION_EXPIRED: 'auth.session.expired',
    WALLET_CONNECTED: 'wallet.connected',
    WALLET_DISCONNECTED: 'wallet.disconnected',
    WALLET_SIGN_REQUEST: 'wallet.sign.request',
    WALLET_SIGN_REJECTED: 'wallet.sign.rejected',
    WALLET_KEY_EXPORTED: 'wallet.key.exported',
    TX_SUBMITTED: 'tx.submitted',
    TX_FAILED: 'tx.failed',
    TX_HIGH_VALUE: 'tx.high_value',
    TX_SUSPICIOUS: 'tx.suspicious',
    NETWORK_SWITCHED: 'network.switched',
    CONFIG_CHANGED: 'config.changed',
    RATE_LIMIT_HIT: 'security.rate_limit_hit',
    CSP_VIOLATION: 'security.csp_violation',
    XSS_ATTEMPT: 'security.xss_attempt',
    PERMISSION_DENIED: 'security.permission_denied',
    INTEGRITY_VIOLATION: 'security.integrity_violation',
  }),
}))

function makeEvidence(
  eventType: string,
  overrides: Partial<IncidentEvidence> = {}
): IncidentEvidence {
  return {
    eventType,
    timestamp: new Date().toISOString(),
    actor: 'GABCDEF1234567890ABCDEF1234567890ABCDEF',
    target: 'GTARGET1234567890ABCDEF1234567890ABC',
    ...overrides,
  }
}

describe('classifyIncident', () => {
  it('classifies a known security event with correct category and severity', () => {
    const result = classifyIncident('security.xss_attempt', [
      makeEvidence('security.xss_attempt'),
    ])

    expect(result.classification.category).toBe('security_breach')
    expect(result.classification.severity).toBe('critical')
    expect(result.classification.confidence).toBeGreaterThan(0.5)
    expect(result.classification.autoClassified).toBe(true)
    expect(result.riskScore).toBeGreaterThan(50)
    expect(result.requiresImmediateAttention).toBe(true)
  })

  it('classifies an auth login failed event as authentication_attack', () => {
    const result = classifyIncident('auth.login.failed', [
      makeEvidence('auth.login.failed'),
      makeEvidence('auth.login.failed'),
      makeEvidence('auth.login.failed'),
    ])

    expect(result.classification.category).toBe('authentication_attack')
    expect(result.classification.severity).toBe('medium')
  })

  it('escalates severity when burst count is high', () => {
    const result = classifyIncident(
      'auth.login.failed',
      [makeEvidence('auth.login.failed')],
      { burstCount: 10 }
    )

    // Medium escalated by 2 = critical
    expect(result.classification.severity).toBe('critical')
  })

  it('escalates severity when anomaly score is high', () => {
    const result = classifyIncident(
      'wallet.key.exported',
      [makeEvidence('wallet.key.exported')],
      { anomalyScore: 80 }
    )

    // Already critical, so stays critical
    expect(result.classification.severity).toBe('critical')
  })

  it('classifies unknown events as unknown category', () => {
    const result = classifyIncident('some.unknown.event', [
      makeEvidence('some.unknown.event'),
    ])

    expect(result.classification.category).toBe('unknown')
    expect(result.classification.confidence).toBeLessThan(0.8)
  })

  it('marks critical severity as requiring immediate attention', () => {
    const result = classifyIncident('security.integrity_violation', [
      makeEvidence('security.integrity_violation'),
    ])

    expect(result.requiresImmediateAttention).toBe(true)
  })

  it('generates recommendations for the incident', () => {
    const result = classifyIncident('wallet.key.exported', [
      makeEvidence('wallet.key.exported'),
    ])

    expect(result.recommendations.length).toBeGreaterThan(0)

    // First recommendation should be fully automated (lock_wallet)
    const autoActions = result.recommendations.filter(
      (r) => r.automationLevel === 'fully_automated'
    )
    expect(autoActions.length).toBeGreaterThan(0)
  })

  it('only returns automated recommendations for low severity incidents', () => {
    const result = classifyIncident('auth.logout', [
      makeEvidence('auth.logout'),
    ])

    const nonAuto = result.recommendations.filter(
      (r) => r.automationLevel !== 'fully_automated'
    )
    expect(nonAuto.length).toBe(0)
  })

  it('includes descriptive summary for operators', () => {
    const result = classifyIncident('security.csp_violation', [
      makeEvidence('security.csp_violation'),
    ])

    expect(result.summary.length).toBeGreaterThan(50)
    expect(result.summary).toContain('Security Breach')
    expect(result.summary).toContain('high severity')
  })
})

describe('classifyBatch', () => {
  it('classifies multiple events', () => {
    const results = classifyBatch([
      { eventType: 'auth.login.failed', evidence: [makeEvidence('auth.login.failed')] },
      { eventType: 'wallet.key.exported', evidence: [makeEvidence('wallet.key.exported')] },
      { eventType: 'tx.high_value', evidence: [makeEvidence('tx.high_value')] },
    ])

    expect(results).toHaveLength(3)
    expect(results[0].classification.category).toBe('authentication_attack')
    expect(results[1].classification.category).toBe('wallet_compromise')
    expect(results[2].classification.category).toBe('high_value_transfer')
  })
})

describe('accuracy tracking', () => {
  beforeEach(() => {
    // Reset by submitting feedback on all recent
    const recent = getRecentClassifications(1000)
    recent.forEach((c) => {
      submitClassificationFeedback(c.id, true)
    })
  })

  it('tracks classification accuracy metrics', () => {
    classifyIncident('auth.login.failed', [makeEvidence('auth.login.failed')])

    const accuracy = getClassifierAccuracy()
    expect(accuracy.totalClassified).toBeGreaterThanOrEqual(1)
    expect(accuracy.accuracy).toBeGreaterThanOrEqual(0)
  })

  it('updates accuracy with feedback', () => {
    const result = classifyIncident('auth.login.failed', [
      makeEvidence('auth.login.failed'),
    ])

    submitClassificationFeedback(result.classification.id, true)
    const accuracy = getClassifierAccuracy()
    expect(accuracy.feedbackReceived).toBeGreaterThanOrEqual(1)
  })

  it('corrects classification category with feedback', () => {
    const result = classifyIncident('some.unknown.event', [
      makeEvidence('some.unknown.event'),
    ])
    expect(result.classification.category).toBe('unknown')

    submitClassificationFeedback(
      result.classification.id,
      false,
      'security_breach',
      'high'
    )

    const recent = getRecentClassifications(1000)
    const updated = recent.find((c) => c.id === result.classification.id)
    if (updated) {
      expect(updated.category).toBe('security_breach')
      expect(updated.severity).toBe('high')
      expect(updated.autoClassified).toBe(false)
    }
  })
})

describe('subscription', () => {
  it('notifies subscribers when incidents are classified', () => {
    const handler = vi.fn()
    const unsub = subscribeToIncidents(handler)

    classifyIncident('auth.login.failed', [makeEvidence('auth.login.failed')])

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        classification: expect.objectContaining({
          category: 'authentication_attack',
        }),
      })
    )

    unsub()

    // Should not be called after unsub
    classifyIncident('tx.submitted', [makeEvidence('tx.submitted')])
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('trend analysis', () => {
  it('analyzes classification trends', () => {
    // Classify multiple incidents
    classifyIncident('auth.login.failed', [makeEvidence('auth.login.failed')])
    classifyIncident('auth.login.failed', [makeEvidence('auth.login.failed')])
    classifyIncident('wallet.key.exported', [makeEvidence('wallet.key.exported')])

    const trends = analyzeClassificationTrends()
    expect(trends.totalLast24h).toBeGreaterThan(0)
    expect(trends.mostCommonCategory).toBeTruthy()
    expect(['info', 'low', 'medium', 'high', 'critical']).toContain(
      trends.averageSeverity
    )
  })
})

describe('getRecentClassifications', () => {
  it('returns recent classifications with limit', () => {
    for (let i = 0; i < 10; i++) {
      classifyIncident('auth.login.failed', [makeEvidence('auth.login.failed')])
    }

    const recent = getRecentClassifications(5)
    expect(recent.length).toBeLessThanOrEqual(5)
  })
})

describe('incidentClassifier singleton', () => {
  it('exports a singleton with all methods', () => {
    expect(incidentClassifier.classify).toBeDefined()
    expect(incidentClassifier.classifyBatch).toBeDefined()
    expect(incidentClassifier.reclassify).toBeDefined()
    expect(incidentClassifier.submitFeedback).toBeDefined()
    expect(incidentClassifier.getAccuracy).toBeDefined()
    expect(incidentClassifier.subscribe).toBeDefined()
    expect(incidentClassifier.getRecent).toBeDefined()
    expect(incidentClassifier.analyzeTrends).toBeDefined()
  })
})

describe('risk score calculation', () => {
  it('returns higher risk for critical severity', () => {
    const critical = classifyIncident('security.integrity_violation', [
      makeEvidence('security.integrity_violation'),
    ])
    const info = classifyIncident('auth.login.success', [
      makeEvidence('auth.login.success'),
    ])

    expect(critical.riskScore).toBeGreaterThan(info.riskScore)
  })

  it('clamps risk score to 100', () => {
    const result = classifyIncident('security.integrity_violation', [
      makeEvidence('security.integrity_violation'),
      makeEvidence('security.integrity_violation'),
      makeEvidence('security.integrity_violation'),
      makeEvidence('security.integrity_violation'),
      makeEvidence('security.integrity_violation'),
    ])

    expect(result.riskScore).toBeLessThanOrEqual(100)
  })
})
