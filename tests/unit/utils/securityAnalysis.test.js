import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/utils/audit.js', () => ({
  AuditCategory: {
    AUTH: 'auth',
    WALLET: 'wallet',
    TRANSACTION: 'transaction',
    CONTRACT: 'contract',
    NETWORK: 'network',
    CONFIG: 'config',
    DATA_ACCESS: 'data_access',
    EXPORT: 'export',
    SECURITY: 'security',
    ADMIN: 'admin',
    SYSTEM: 'system',
  },
  AuditSeverity: {
    INFO: 'info',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
}));

import {
  detectRateAnomalies,
  detectOffHoursActivity,
  detectActorVelocityAnomalies,
  detectMultiActorBursts,
  detectEscalationChains,
  detectRepeatedFailures,
  detectSessionDrift,
  detectCategoryConcentration,
  scoreEntry,
  computeAggregateRisk,
  riskGrade,
  generateReport,
  createStreamingEngine,
  DEFAULT_CONFIG,
} from '../../../src/utils/securityAnalysis.js';

// ─── Test Factories ─────────────────────────────────────────────────────────

function makeEntry(overrides = {}) {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    action: 'auth.login.success',
    category: 'auth',
    severity: 'info',
    actor: 'user-A',
    target: null,
    outcome: 'success',
    metadata: {},
    sessionId: 'session-1',
    hash: 'abc123',
    prevHash: '0',
    ...overrides,
  };
}

function makeEntries(count, overrides = {}) {
  const base = makeEntry(overrides);
  return Array.from({ length: count }, (_, i) => ({
    ...base,
    id: `test-${i}`,
    timestamp: new Date(Date.now() + i * 1000).toISOString(),
  }));
}

function makeTimeShiftedEntries(count, intervalMs, actorFn, severityFn, overrides = {}) {
  const start = new Date('2026-01-01T10:00:00Z').getTime();
  return Array.from({ length: count }, (_, i) => makeEntry({
    ...overrides,
    timestamp: new Date(start + i * intervalMs).toISOString(),
    actor: typeof actorFn === 'function' ? actorFn(i) : actorFn,
    severity: typeof severityFn === 'function' ? severityFn(i) : severityFn,
  }));
}

// ─── detectRateAnomalies ────────────────────────────────────────────────────

describe('detectRateAnomalies', () => {
  it('returns empty when below minimum entries threshold', () => {
    const entries = makeEntries(5);
    const result = detectRateAnomalies(entries);
    expect(result.anomalies).toHaveLength(0);
    expect(result.bucketData).toHaveLength(0);
  });

  it('returns empty for uniform event distribution', () => {
    const entries = makeEntries(30);
    const result = detectRateAnomalies(entries);
    expect(result.anomalies).toHaveLength(0);
    expect(result.bucketData.length).toBeGreaterThan(0);
  });

  it('detects rate spikes when a bucket far exceeds the mean', () => {
    const start = new Date('2026-01-01T10:00:00Z').getTime();
    const entries = [];
    // Spread 25 events across 10 buckets (2-3 per bucket)
    for (let i = 0; i < 25; i++) {
      entries.push(makeEntry({
        timestamp: new Date(start + i * 200_000).toISOString(),
      }));
    }
    // Dump 15 events into one 60s bucket
    for (let i = 0; i < 15; i++) {
      entries.push(makeEntry({
        timestamp: new Date(start + 1_000_000 + i * 1000).toISOString(),
      }));
    }
    const result = detectRateAnomalies(entries);
    expect(result.anomalies.length).toBeGreaterThanOrEqual(1);
    expect(result.anomalies[0].type).toBe('rate_spike');
    expect(result.anomalies[0].count).toBeGreaterThanOrEqual(15);
  });

  it('uses custom config thresholds', () => {
    const entries = makeEntries(25);
    const result = detectRateAnomalies(entries, {
      ...DEFAULT_CONFIG,
      minEntriesForBaselines: 5,
      burstThreshold: 2,
    });
    // Even uniform data may not trigger, but should not error
    expect(result).toHaveProperty('anomalies');
    expect(result).toHaveProperty('bucketData');
  });
});

// ─── detectOffHoursActivity ─────────────────────────────────────────────────

describe('detectOffHoursActivity', () => {
  it('detects activity during off-hours (22:00-06:00)', () => {
    const entries = [
      makeEntry({ timestamp: '2026-01-01T23:00:00Z', action: 'tx.submit', severity: 'info' }),
      makeEntry({ timestamp: '2026-01-01T03:00:00Z', action: 'wallet.connect', severity: 'info' }),
      makeEntry({ timestamp: '2026-01-01T12:00:00Z', action: 'auth.login', severity: 'info' }),
    ];
    const result = detectOffHoursActivity(entries);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('off_hours_activity');
    expect(result[1].type).toBe('off_hours_activity');
  });

  it('returns empty for all business-hours activity', () => {
    const entries = [
      makeEntry({ timestamp: '2026-01-01T09:00:00Z' }),
      makeEntry({ timestamp: '2026-01-01T14:00:00Z' }),
      makeEntry({ timestamp: '2026-01-01T17:00:00Z' }),
    ];
    const result = detectOffHoursActivity(entries);
    expect(result).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(detectOffHoursActivity([])).toHaveLength(0);
  });

  it('grades critical/high severity entries as HIGH in off-hours', () => {
    const entries = [
      makeEntry({ timestamp: '2026-01-01T23:30:00Z', severity: 'critical' }),
    ];
    const result = detectOffHoursActivity(entries);
    expect(result[0].severity).toBe('high');
  });

  it('grades other severity entries as MEDIUM in off-hours', () => {
    const entries = [
      makeEntry({ timestamp: '2026-01-01T23:30:00Z', severity: 'low' }),
    ];
    const result = detectOffHoursActivity(entries);
    expect(result[0].severity).toBe('medium');
  });
});

// ─── detectActorVelocityAnomalies ───────────────────────────────────────────

describe('detectActorVelocityAnomalies', () => {
  it('returns empty when below minimum entries', () => {
    const entries = makeEntries(5);
    expect(detectActorVelocityAnomalies(entries)).toHaveLength(0);
  });

  it('returns empty when all actors have similar counts', () => {
    // Create entries evenly distributed across 5 actors
    const entries = [];
    for (let a = 0; a < 5; a++) {
      for (let i = 0; i < 6; i++) {
        entries.push(makeEntry({ actor: `actor-${a}` }));
      }
    }
    expect(detectActorVelocityAnomalies(entries)).toHaveLength(0);
  });

  it('detects an actor with significantly more actions', () => {
    const entries = [];
    // Normal actors: 3 actions each
    for (let a = 0; a < 5; a++) {
      for (let i = 0; i < 3; i++) {
        entries.push(makeEntry({ actor: `normal-${a}` }));
      }
    }
    // Overactive actor: 30 actions
    for (let i = 0; i < 30; i++) {
      entries.push(makeEntry({ actor: 'overactive' }));
    }
    const result = detectActorVelocityAnomalies(entries);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const overactive = result.find((r) => r.actor === 'overactive');
    expect(overactive).toBeDefined();
    expect(overactive.totalActions).toBe(30);
  });
});

// ─── detectMultiActorBursts ─────────────────────────────────────────────────

describe('detectMultiActorBursts', () => {
  it('detects many unique actors in a short window', () => {
    const start = Date.now();
    const entries = [];
    for (let i = 0; i < 12; i++) {
      entries.push(makeEntry({
        actor: `attacker-${i}`,
        timestamp: new Date(start + i * 1000).toISOString(),
      }));
    }
    const result = detectMultiActorBursts(entries, {
      ...DEFAULT_CONFIG,
      burstThreshold: 10,
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].type).toBe('multi_actor_burst');
    expect(result[0].uniqueActors).toBeGreaterThanOrEqual(10);
  });

  it('returns empty when actors are spread out', () => {
    const start = new Date('2026-01-01T10:00:00Z').getTime();
    const entries = [];
    for (let i = 0; i < 12; i++) {
      entries.push(makeEntry({
        actor: `user-${i}`,
        timestamp: new Date(start + i * 120_000).toISOString(), // 2min apart
      }));
    }
    const result = detectMultiActorBursts(entries);
    expect(result).toHaveLength(0);
  });

  it('returns empty for single actor', () => {
    const entries = makeEntries(15, { actor: 'same-actor' });
    expect(detectMultiActorBursts(entries)).toHaveLength(0);
  });
});

// ─── detectEscalationChains ─────────────────────────────────────────────────

describe('detectEscalationChains', () => {
  it('detects increasing severity for same actor', () => {
    const entries = makeTimeShiftedEntries(4, 1000, 'attacker', (i) => {
      return ['info', 'medium', 'high', 'critical'][i];
    });
    const result = detectEscalationChains(entries, {
      ...DEFAULT_CONFIG,
      escalationChainLength: 3,
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].type).toBe('escalation_chain');
    expect(result[0].actor).toBe('attacker');
    expect(result[0].fromSeverity).toBe('info');
    expect(result[0].toSeverity).toBe('critical');
  });

  it('returns empty when severity strictly decreases', () => {
    const entries = makeTimeShiftedEntries(4, 1000, 'user', (i) => {
      return ['critical', 'high', 'medium', 'info'][i];
    });
    const result = detectEscalationChains(entries);
    expect(result).toHaveLength(0);
  });

  it('returns empty when chain is shorter than minimum', () => {
    const entries = makeTimeShiftedEntries(2, 1000, 'user', (i) => {
      return ['info', 'critical'][i];
    });
    const result = detectEscalationChains(entries, {
      ...DEFAULT_CONFIG,
      escalationChainLength: 3,
    });
    expect(result).toHaveLength(0);
  });

  it('detects multiple chains for different actors', () => {
    const start = new Date('2026-01-01T10:00:00Z').getTime();
    const entries = [
      makeEntry({ actor: 'a1', severity: 'info', timestamp: new Date(start).toISOString() }),
      makeEntry({ actor: 'a1', severity: 'medium', timestamp: new Date(start + 1000).toISOString() }),
      makeEntry({ actor: 'a1', severity: 'critical', timestamp: new Date(start + 2000).toISOString() }),
      makeEntry({ actor: 'a2', severity: 'low', timestamp: new Date(start).toISOString() }),
      makeEntry({ actor: 'a2', severity: 'high', timestamp: new Date(start + 1000).toISOString() }),
      makeEntry({ actor: 'a2', severity: 'critical', timestamp: new Date(start + 2000).toISOString() }),
    ];
    const result = detectEscalationChains(entries);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── detectRepeatedFailures ─────────────────────────────────────────────────

describe('detectRepeatedFailures', () => {
  it('detects consecutive failures for same action and actor', () => {
    const start = Date.now();
    const entries = [];
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({
        action: 'tx.submit',
        actor: 'user-1',
        outcome: 'failure',
        timestamp: new Date(start + i * 5000).toISOString(),
      }));
    }
    const result = detectRepeatedFailures(entries);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('repeated_failures');
    expect(result[0].count).toBe(5);
    expect(result[0].action).toBe('tx.submit');
  });

  it('returns empty when fewer than threshold failures', () => {
    const entries = [
      makeEntry({ outcome: 'failure', action: 'auth.login' }),
      makeEntry({ outcome: 'failure', action: 'auth.login' }),
    ];
    expect(detectRepeatedFailures(entries, 3)).toHaveLength(0);
  });

  it('returns empty when failures are for different actions', () => {
    const start = Date.now();
    const entries = [
      makeEntry({ outcome: 'failure', action: 'auth.login', timestamp: new Date(start).toISOString() }),
      makeEntry({ outcome: 'failure', action: 'tx.submit', timestamp: new Date(start + 1000).toISOString() }),
      makeEntry({ outcome: 'failure', action: 'auth.login', timestamp: new Date(start + 2000).toISOString() }),
    ];
    expect(detectRepeatedFailures(entries, 3)).toHaveLength(0);
  });

  it('returns empty when failures are too far apart', () => {
    const start = new Date('2026-01-01T10:00:00Z').getTime();
    const entries = [
      makeEntry({ outcome: 'failure', action: 'auth.login', actor: 'u1', timestamp: new Date(start).toISOString() }),
      makeEntry({ outcome: 'failure', action: 'auth.login', actor: 'u1', timestamp: new Date(start + 20 * 60_000).toISOString() }),
      makeEntry({ outcome: 'failure', action: 'auth.login', actor: 'u1', timestamp: new Date(start + 40 * 60_000).toISOString() }),
    ];
    expect(detectRepeatedFailures(entries, 3)).toHaveLength(0);
  });

  it('grades severity as CRITICAL when count >= threshold * 2', () => {
    const start = Date.now();
    const entries = [];
    for (let i = 0; i < 6; i++) {
      entries.push(makeEntry({
        outcome: 'denied',
        action: 'admin.delete',
        actor: 'admin',
        timestamp: new Date(start + i * 2000).toISOString(),
      }));
    }
    const result = detectRepeatedFailures(entries, 3);
    expect(result[0].severity).toBe('critical');
  });
});

// ─── detectSessionDrift ─────────────────────────────────────────────────────

describe('detectSessionDrift', () => {
  it('detects session lasting longer than threshold', () => {
    const start = new Date('2026-01-01T10:00:00Z').getTime();
    const entries = [
      makeEntry({ sessionId: 'sess-long', timestamp: new Date(start).toISOString() }),
      makeEntry({ sessionId: 'sess-long', timestamp: new Date(start + 25 * 3600_000).toISOString() }),
    ];
    const result = detectSessionDrift(entries);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].type).toBe('session_drift');
    expect(result[0].sessionId).toBe('sess-long');
  });

  it('detects large gaps within a session', () => {
    const start = new Date('2026-01-01T10:00:00Z').getTime();
    const entries = [
      makeEntry({ sessionId: 'sess-gap', action: 'auth.login', timestamp: new Date(start).toISOString() }),
      makeEntry({ sessionId: 'sess-gap', action: 'tx.submit', timestamp: new Date(start + 45 * 60_000).toISOString() }),
    ];
    const result = detectSessionDrift(entries);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((r) => r.type === 'session_gap')).toBe(true);
  });

  it('returns empty for entries without sessionId', () => {
    const entries = [
      makeEntry({ sessionId: undefined }),
      makeEntry({ sessionId: undefined }),
    ];
    expect(detectSessionDrift(entries)).toHaveLength(0);
  });

  it('returns empty for short sessions', () => {
    const start = new Date('2026-01-01T10:00:00Z').getTime();
    const entries = [
      makeEntry({ sessionId: 'short', timestamp: new Date(start).toISOString() }),
      makeEntry({ sessionId: 'short', timestamp: new Date(start + 60_000).toISOString() }),
    ];
    expect(detectSessionDrift(entries)).toHaveLength(0);
  });
});

// ─── detectCategoryConcentration ────────────────────────────────────────────

describe('detectCategoryConcentration', () => {
  it('detects when one category dominates', () => {
    const entries = [];
    for (let i = 0; i < 18; i++) entries.push(makeEntry({ category: 'security' }));
    for (let i = 0; i < 2; i++) entries.push(makeEntry({ category: 'auth' }));
    const result = detectCategoryConcentration(entries);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].type).toBe('category_concentration');
    expect(result[0].category).toBe('security');
  });

  it('returns empty for balanced distribution', () => {
    const entries = [];
    const cats = ['auth', 'transaction', 'security', 'wallet', 'system'];
    for (let i = 0; i < 20; i++) {
      entries.push(makeEntry({ category: cats[i % cats.length] }));
    }
    expect(detectCategoryConcentration(entries)).toHaveLength(0);
  });

  it('returns empty when fewer than 10 entries', () => {
    const entries = makeEntries(5, { category: 'security' });
    expect(detectCategoryConcentration(entries)).toHaveLength(0);
  });
});

// ─── scoreEntry ──────────────────────────────────────────────────────────────

describe('scoreEntry', () => {
  it('returns 0 for info/success/system entry', () => {
    const entry = makeEntry({ severity: 'info', outcome: 'success', category: 'system' });
    expect(scoreEntry(entry)).toBe(0);
  });

  it('returns higher score for critical severity', () => {
    const crit = makeEntry({ severity: 'critical', outcome: 'success', category: 'system' });
    const info = makeEntry({ severity: 'info', outcome: 'success', category: 'system' });
    expect(scoreEntry(crit)).toBeGreaterThan(scoreEntry(info));
  });

  it('applies category multiplier', () => {
    const security = makeEntry({ severity: 'medium', outcome: 'success', category: 'security' });
    const system = makeEntry({ severity: 'medium', outcome: 'success', category: 'system' });
    expect(scoreEntry(security)).toBeGreaterThan(scoreEntry(system));
  });

  it('adds outcome penalty for failures', () => {
    const success = makeEntry({ severity: 'high', outcome: 'success', category: 'auth' });
    const failure = makeEntry({ severity: 'high', outcome: 'failure', category: 'auth' });
    expect(scoreEntry(failure)).toBeGreaterThan(scoreEntry(success));
  });

  it('caps at maxRiskScore', () => {
    const entry = makeEntry({ severity: 'critical', outcome: 'denied', category: 'security' });
    expect(scoreEntry(entry)).toBeLessThanOrEqual(100);
  });
});

// ─── computeAggregateRisk ───────────────────────────────────────────────────

describe('computeAggregateRisk', () => {
  it('returns score 0 / grade A for empty entries', () => {
    const result = computeAggregateRisk([]);
    expect(result.score).toBe(0);
    expect(result.grade).toBe('A');
  });

  it('returns higher score with more anomalies', () => {
    const entries = makeEntries(10, { severity: 'medium', outcome: 'success', category: 'auth' });
    const low = computeAggregateRisk(entries, []);
    const high = computeAggregateRisk(entries, Array.from({ length: 5 }, () => ({ type: 'test', severity: 'high' })));
    expect(high.score).toBeGreaterThanOrEqual(low.score);
  });

  it('returns higher score with more failures', () => {
    const successEntries = makeEntries(10, { outcome: 'success' });
    const failureEntries = makeEntries(10, { outcome: 'failure' });
    expect(computeAggregateRisk(failureEntries).score).toBeGreaterThan(
      computeAggregateRisk(successEntries).score,
    );
  });

  it('returns valid grades', () => {
    const entries = makeEntries(10, { severity: 'critical', outcome: 'denied', category: 'security' });
    const result = computeAggregateRisk(entries);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade);
  });
});

// ─── riskGrade ──────────────────────────────────────────────────────────────

describe('riskGrade', () => {
  it('returns A for scores 0-10', () => {
    expect(riskGrade(0)).toBe('A');
    expect(riskGrade(10)).toBe('A');
  });

  it('returns B for scores 11-25', () => {
    expect(riskGrade(11)).toBe('B');
    expect(riskGrade(25)).toBe('B');
  });

  it('returns C for scores 26-50', () => {
    expect(riskGrade(26)).toBe('C');
    expect(riskGrade(50)).toBe('C');
  });

  it('returns D for scores 51-75', () => {
    expect(riskGrade(51)).toBe('D');
    expect(riskGrade(75)).toBe('D');
  });

  it('returns F for scores 76-100', () => {
    expect(riskGrade(76)).toBe('F');
    expect(riskGrade(100)).toBe('F');
  });
});

// ─── generateReport ─────────────────────────────────────────────────────────

describe('generateReport', () => {
  it('returns empty report for empty entries', () => {
    const report = generateReport([]);
    expect(report.entryCount).toBe(0);
    expect(report.findings).toHaveLength(0);
    expect(report.recommendations).toHaveLength(0);
    expect(report.riskScore.grade).toBe('A');
  });

  it('includes all required fields', () => {
    const report = generateReport(makeEntries(5));
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('entryCount');
    expect(report).toHaveProperty('riskScore');
    expect(report).toHaveProperty('findings');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('recommendations');
    expect(report).toHaveProperty('entryStats');
    expect(report).toHaveProperty('timeRange');
  });

  it('sorts findings by severity (highest first)', () => {
    const start = Date.now();
    const entries = [];
    // Create entries that will trigger multiple finding types
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({
        severity: 'info',
        outcome: 'success',
        timestamp: new Date(start + i * 1000).toISOString(),
      }));
    }
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({
        severity: 'critical',
        outcome: 'failure',
        timestamp: new Date(start + 5000 + i * 1000).toISOString(),
      }));
    }
    const report = generateReport(entries);
    for (let i = 1; i < report.findings.length; i++) {
      const sevOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
      const prev = sevOrder[report.findings[i - 1].severity] ?? 0;
      const curr = sevOrder[report.findings[i].severity] ?? 0;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('aggregates findings by type and severity', () => {
    const start = Date.now();
    const entries = [];
    // Create many off-hours entries
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({
        timestamp: new Date(new Date('2026-01-01T23:00:00Z').getTime() + i * 60_000).toISOString(),
      }));
    }
    const report = generateReport(entries);
    expect(report.summary).toHaveProperty('totalFindings');
    expect(report.summary).toHaveProperty('byType');
    expect(report.summary).toHaveProperty('bySeverity');
  });

  it('includes entry-level stats', () => {
    const entries = [
      makeEntry({ severity: 'high', category: 'auth', outcome: 'failure' }),
      makeEntry({ severity: 'info', category: 'system', outcome: 'success' }),
    ];
    const report = generateReport(entries);
    expect(report.entryStats.bySeverity.high).toBe(1);
    expect(report.entryStats.byCategory.auth).toBe(1);
    expect(report.entryStats.byOutcome.failure).toBe(1);
  });

  it('provides recommendations based on findings', () => {
    const start = new Date('2026-01-01T10:00:00Z').getTime();
    const entries = [];
    // Create repeated failures
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({
        outcome: 'failure',
        action: 'auth.login',
        actor: 'attacker',
        timestamp: new Date(start + i * 5000).toISOString(),
      }));
    }
    const report = generateReport(entries);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});

// ─── createStreamingEngine ──────────────────────────────────────────────────

describe('createStreamingEngine', () => {
  let engine;

  beforeEach(() => {
    engine = createStreamingEngine();
  });

  it('starts with empty buffer', () => {
    expect(engine.buffer).toHaveLength(0);
  });

  it('adds entries to buffer', () => {
    engine.addEntry(makeEntry());
    engine.addEntry(makeEntry());
    expect(engine.buffer).toHaveLength(2);
  });

  it('returns cached findings until buffer changes', () => {
    engine.addEntry(makeEntry());
    const f1 = engine.getFindings();
    const f2 = engine.getFindings();
    expect(f1).toBe(f2); // Same reference (cached)
  });

  it('invalidates cache when new entry is added', () => {
    engine.addEntry(makeEntry());
    const f1 = engine.getFindings();
    engine.addEntry(makeEntry());
    const f2 = engine.getFindings();
    expect(f1).not.toBe(f2); // Different reference (cache invalidated)
  });

  it('returns valid risk score', () => {
    engine.addEntry(makeEntry({ severity: 'info', outcome: 'success' }));
    const risk = engine.getRiskScore();
    expect(risk).toHaveProperty('score');
    expect(risk).toHaveProperty('grade');
    expect(risk.score).toBeGreaterThanOrEqual(0);
    expect(risk.score).toBeLessThanOrEqual(100);
  });

  it('returns valid report', () => {
    engine.addEntry(makeEntry());
    const report = engine.getReport();
    expect(report).toHaveProperty('entryCount', 1);
    expect(report).toHaveProperty('findings');
    expect(report).toHaveProperty('riskScore');
  });

  it('reset clears the buffer', () => {
    engine.addEntry(makeEntry());
    engine.addEntry(makeEntry());
    engine.reset();
    expect(engine.buffer).toHaveLength(0);
  });

  it('caps buffer at 2000 entries', () => {
    for (let i = 0; i < 2100; i++) {
      engine.addEntry(makeEntry());
    }
    expect(engine.buffer.length).toBeLessThanOrEqual(2000);
  });

  it('analyzes entries in real-time as they arrive', () => {
    const start = Date.now();
    // Add entries that create a repeated failure pattern
    for (let i = 0; i < 5; i++) {
      engine.addEntry(makeEntry({
        outcome: 'failure',
        action: 'tx.submit',
        actor: 'user-1',
        timestamp: new Date(start + i * 3000).toISOString(),
      }));
    }
    const report = engine.getReport();
    expect(report.summary.totalFindings).toBeGreaterThanOrEqual(1);
  });
});

// ─── Integration: full pipeline ─────────────────────────────────────────────

describe('full analysis pipeline', () => {
  it('generates a comprehensive report from realistic audit data', () => {
    const start = new Date('2026-01-01T10:00:00Z').getTime();
    const entries = [];

    // Normal activity
    for (let i = 0; i < 20; i++) {
      entries.push(makeEntry({
        timestamp: new Date(start + i * 30_000).toISOString(),
        severity: 'info',
        outcome: 'success',
        category: i % 3 === 0 ? 'auth' : 'transaction',
        actor: `user-${i % 5}`,
      }));
    }

    // Off-hours activity
    entries.push(makeEntry({
      timestamp: '2026-01-01T23:30:00Z',
      severity: 'high',
      outcome: 'failure',
      category: 'security',
      actor: 'unknown',
    }));

    // Repeated failures
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({
        timestamp: new Date(start + 1_000_000 + i * 5000).toISOString(),
        severity: 'medium',
        outcome: 'failure',
        action: 'auth.login',
        actor: 'brute-forcer',
      }));
    }

    const report = generateReport(entries);
    expect(report.entryCount).toBe(entries.length);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.riskScore.score).toBeGreaterThanOrEqual(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.timeRange).toBeDefined();
  });
});
