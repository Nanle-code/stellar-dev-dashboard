import { describe, it, expect, vi, beforeEach } from 'vitest';

const auditMock = vi.hoisted(() => ({
  entries: [] as unknown[],
  handlers: new Set<(entry: unknown) => void>(),
}));

vi.mock('../../utils/audit.js', () => ({
  getAuditEntries: () => auditMock.entries.slice(),
  subscribeAudit: (handler: (entry: unknown) => void) => {
    auditMock.handlers.add(handler);
    return () => auditMock.handlers.delete(handler);
  },
}));

import {
  analyzeSecurityAuditTrail,
  analyzeRecordedAuditLog,
  combineRiskScores,
  createStreamingSecurityAnalyzer,
  formatSecurityReportMarkdown,
  riskLevelFor,
  startLiveSecurityAnalysis,
  type RawAuditEntry,
} from '../securityAuditAnalysis';

// ─── Deterministic synthetic audit log ────────────────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const START = Date.parse('2026-09-01T00:00:00Z');
const at = (day: number, hour: number, minute = 0, second = 0) =>
  START + day * DAY + hour * 3_600_000 + minute * 60_000 + second * 1000;

const NORMAL_ACTIONS: Array<[string, string]> = [
  ['account.view', 'data_access'],
  ['dashboard.view', 'analytics'],
  ['transaction.submit', 'transaction'],
  ['contract.invoke', 'contract'],
  ['network.switch', 'network'],
];

let seq = 0;
function entry(ts: number, actor: string | null, action: string, category: string, extra: Partial<RawAuditEntry> = {}): RawAuditEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    timestamp: new Date(ts).toISOString(),
    action,
    category,
    severity: 'info',
    actor,
    target: null,
    outcome: 'success',
    sessionId: actor ? `${actor}-d${Math.floor((ts - START) / DAY)}` : 'system',
    userAgent: 'Mozilla/5.0',
    ip: actor ? `10.0.0.${actor.length}` : null,
    metadata: {},
    ...extra,
  };
}

interface LabelledAnomaly {
  name: string;
  ids: string[];
}

function buildDataset() {
  seq = 0;
  const rand = mulberry32(587);
  const users = Array.from({ length: 15 }, (_, i) => `user-${i + 1}`);
  const normal: RawAuditEntry[] = [];

  for (let day = 0; day < 7; day++) {
    for (const user of users) {
      normal.push(entry(at(day, 9, Math.floor(rand() * 30)), user, 'auth.login', 'auth'));
      const count = 12 + Math.floor(rand() * 14);
      for (let i = 0; i < count; i++) {
        const [action, category] = NORMAL_ACTIONS[Math.floor(rand() * NORMAL_ACTIONS.length)];
        normal.push(entry(at(day, 9 + Math.floor(rand() * 9), Math.floor(rand() * 60), Math.floor(rand() * 60)), user, action, category));
      }
      if (rand() < 0.15) normal.push(entry(at(day, 10, 5), user, 'auth.login', 'auth', { outcome: 'failure' }));
      if (rand() < 0.2) normal.push(entry(at(day, 15, 30), user, 'report.export', 'export'));
    }
    // A trusted admin manages roles every day.
    normal.push(entry(at(day, 11), 'admin-1', 'role.grant', 'admin'));
    for (let i = 0; i < 20; i++) normal.push(entry(at(day, 9 + (i % 8), i * 2), 'admin-1', 'dashboard.view', 'analytics'));
  }

  const anomalies: LabelledAnomaly[] = [];
  const extra: RawAuditEntry[] = [];
  const add = (name: string, list: RawAuditEntry[]) => {
    extra.push(...list);
    anomalies.push({ name, ids: list.map((e) => e.id as string) });
  };

  for (const [i, user] of ['user-1', 'user-2'].entries()) {
    add(`brute force ${user}`, Array.from({ length: 8 }, (_, k) => entry(at(2 + i, 13, 0, k * 10), user, 'auth.login', 'auth', { outcome: 'failure' })));
  }
  add('credential compromise', [
    ...Array.from({ length: 7 }, (_, k) => entry(at(4, 14, 0, k * 8), 'user-3', 'auth.login', 'auth', { outcome: 'failure' })),
    entry(at(4, 14, 1, 30), 'user-3', 'auth.login', 'auth'),
  ]);
  for (const [i, user] of ['user-4', 'user-5'].entries()) {
    add(`volume burst ${user}`, Array.from({ length: 80 }, (_, k) => entry(at(3 + i, 12, 1, k * 3), user, 'account.view', 'data_access')));
  }
  add('off-hours key export', [entry(at(5, 3, 12), 'user-6', 'wallet.export_key', 'wallet')]);
  add('off-hours config change', [entry(at(2, 2, 40), 'user-7', 'config.update', 'config')]);
  add('off-hours admin', [entry(at(6, 23, 5), 'user-8', 'security.disable_mfa', 'security')]);
  add('unexpected role grant', [entry(at(3, 11, 20), 'user-9', 'role.grant', 'admin')]);
  add('denied permission changes', Array.from({ length: 3 }, (_, k) => entry(at(4, 10, k * 5), 'user-10', 'permission.change', 'admin', { outcome: 'denied' })));
  add('signer added', [entry(at(1, 14, 10), 'user-11', 'account.add_signer', 'wallet')]);
  add('threshold lowered', [entry(at(5, 15, 45), 'user-12', 'account.set_thresholds', 'wallet')]);
  add('bulk exports', Array.from({ length: 5 }, (_, k) => entry(at(2, 16, k * 6), 'user-13', 'report.export', 'export')));
  add('huge export', [entry(at(6, 10, 0), 'user-14', 'transactions.export', 'export', { metadata: { records: 60_000 } })]);
  add('session hijack', [entry(at(3, 12, 30), 'mallory', 'account.view', 'data_access', { sessionId: 'user-15-d3' })]);
  add('many clients', Array.from({ length: 5 }, (_, k) => entry(at(1, 11, k * 4), 'user-15', 'account.view', 'data_access', { ip: `203.0.113.${k}` })));
  add('audit cleared', [entry(at(6, 16, 0), 'user-2', 'audit.clear', 'system')]);
  add('unattributed admin action', [entry(at(4, 12, 0), null, 'config.update', 'admin')]);
  add('high severity cluster', Array.from({ length: 3 }, (_, k) => entry(at(5, 13, k), 'user-9', 'contract.invoke', 'contract', { severity: 'critical', outcome: 'success' })));

  const all = [...normal, ...extra].sort((a, b) => Date.parse(String(a.timestamp)) - Date.parse(String(b.timestamp)));
  const now = Date.parse(String(all[all.length - 1].timestamp)) + 3_600_000;

  const future = entry(now + DAY, 'user-1', 'dashboard.view', 'analytics');
  all.push(future);
  anomalies.push({ name: 'future timestamp', ids: [future.id as string] });

  // Hash-chain the log in time order, then delete one entry to break the chain.
  all.forEach((e, i) => {
    e.hash = `h${i}`;
    e.prevHash = i === 0 ? '0' : `h${i - 1}`;
  });
  const deletedIndex = all.findIndex((e, i) => i > all.length / 2 && e.action === 'dashboard.view');
  const afterDeleted = all[deletedIndex + 1];
  all.splice(deletedIndex, 1);
  anomalies.push({ name: 'deleted audit entry', ids: [afterDeleted.id as string] });

  return { entries: all, anomalies, normalCount: normal.length, now };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('analyzeSecurityAuditTrail (#587)', () => {
  const dataset = buildDataset();
  const report = analyzeSecurityAuditTrail(dataset.entries, { now: () => dataset.now, trustedActors: ['admin-1'] });

  it('detects at least 80% of labelled security anomalies', () => {
    const flagged = new Set(report.findings.flatMap((f) => f.entryIds));
    const detected = dataset.anomalies.filter((a) => a.ids.some((id) => flagged.has(id)));
    const missed = dataset.anomalies.filter((a) => !detected.includes(a)).map((a) => a.name);
    expect(detected.length / dataset.anomalies.length, `missed: ${missed.join(', ')}`).toBeGreaterThanOrEqual(0.8);
  });

  it('keeps false positives low on normal traffic', () => {
    const anomalyIds = new Set(dataset.anomalies.flatMap((a) => a.ids));
    const falsePositives = report.findings.filter((f) => !f.entryIds.some((id) => anomalyIds.has(id)));
    expect(falsePositives.length / report.findings.length).toBeLessThanOrEqual(0.2);
  });

  it('reports no findings for clean traffic (failure-path baseline)', () => {
    const clean = buildDataset().entries.filter((e) => {
      const n = Number(String(e.id).slice(1));
      return n <= dataset.normalCount;
    });
    // Rebuild a consistent chain so the clean log carries no tampering signal.
    clean.forEach((e, i) => {
      e.hash = `c${i}`;
      e.prevHash = i === 0 ? '0' : `c${i - 1}`;
    });
    const cleanReport = analyzeSecurityAuditTrail(clean, { now: () => dataset.now, trustedActors: ['admin-1'] });
    expect(cleanReport.findings).toEqual([]);
    expect(cleanReport.riskLevel).toBe('none');
  });

  it('scores the credential compromise as critical and ranks it near the top', () => {
    const compromise = report.findings.find((f) => f.type === 'credential_compromise');
    expect(compromise).toMatchObject({ severity: 'critical', actor: 'user-3' });
    expect(report.findings[0].severity).toBe('critical');
    expect(report.riskLevel).toBe('critical');
    expect(report.actors.find((a) => a.actor === 'user-3')?.riskLevel).toMatch(/high|critical/);
  });

  it('produces actionable, prioritised recommendations and compliance mappings', () => {
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations[0].priority).toBe('critical');
    for (const r of report.recommendations) {
      expect(r.action.length).toBeGreaterThan(20);
      expect(r.findingIds.length).toBeGreaterThan(0);
    }
    expect(report.complianceViolations.some((f) => f.complianceControls.includes('SOX 404'))).toBe(true);
  });

  it('completes in real time for 10k entries', () => {
    const big = Array.from({ length: 10 }, () => buildDataset().entries).flat().slice(0, 10_000);
    const started = performance.now();
    analyzeSecurityAuditTrail(big, { now: () => dataset.now });
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it('respects trustedActors for expected admin activity', () => {
    const untrusted = analyzeSecurityAuditTrail(dataset.entries, { now: () => dataset.now });
    const trusted = report;
    const adminFindings = (r: typeof report) => r.findings.filter((f) => f.actor === 'admin-1' && f.type === 'privilege_escalation');
    expect(adminFindings(trusted)).toHaveLength(0);
    expect(adminFindings(untrusted).length).toBeGreaterThan(0);
    expect(untrusted.findings.some((f) => f.actor === 'user-11' && f.type === 'signer_change')).toBe(true);
    const suppressed = analyzeSecurityAuditTrail(dataset.entries, { now: () => dataset.now, trustedActors: ['user-11'] });
    expect(suppressed.findings.some((f) => f.actor === 'user-11' && f.type === 'signer_change')).toBe(false);
  });

  it('boundary: brute-force threshold is inclusive', () => {
    const failures = (n: number) =>
      Array.from({ length: n }, (_, k) => entry(at(0, 12, 0, k), 'bob', 'auth.login', 'auth', { outcome: 'failure' }));
    expect(analyzeSecurityAuditTrail(failures(4)).findings.some((f) => f.type === 'brute_force')).toBe(false);
    expect(analyzeSecurityAuditTrail(failures(5)).findings.some((f) => f.type === 'brute_force')).toBe(true);
  });

  it('accepts the legacy auditTrail shape (type/userId)', () => {
    const legacy = Array.from({ length: 6 }, (_, k) => ({
      id: `l${k}`,
      timestamp: new Date(at(0, 10, 0, k)).toISOString(),
      type: 'LOGIN_FAILED',
      message: 'bad password',
      userId: 'carol',
      severity: 'warning',
    }));
    const r = analyzeSecurityAuditTrail(legacy);
    expect(r.findings.find((f) => f.type === 'brute_force')?.actor).toBe('carol');
  });

  describe('invalid input', () => {
    it('throws on non-array input', () => {
      expect(() => analyzeSecurityAuditTrail(null as never)).toThrow(TypeError);
    });

    it('skips malformed entries instead of failing', () => {
      const r = analyzeSecurityAuditTrail([
        null as never,
        { timestamp: 'not-a-date', action: 'x' },
        { timestamp: new Date(START).toISOString() },
        entry(START, 'dave', 'dashboard.view', 'analytics'),
      ]);
      expect(r.entriesAnalyzed).toBe(1);
      expect(r.entriesSkipped).toBe(3);
    });

    it('handles an empty log', () => {
      const r = analyzeSecurityAuditTrail([], { now: () => START });
      expect(r).toMatchObject({ riskScore: 0, riskLevel: 'none', findings: [], window: { from: null, to: null } });
      expect(r.summary).toMatch(/No audit entries/);
    });
  });
});

describe('risk scoring helpers', () => {
  it('combines scores with noisy-OR and clamps', () => {
    expect(combineRiskScores([])).toBe(0);
    expect(combineRiskScores([50, 50])).toBe(75);
    expect(combineRiskScores([100, 10])).toBe(100);
    expect(combineRiskScores([-5, 150])).toBe(100);
  });

  it.each([
    [0, 'none'],
    [1, 'low'],
    [29, 'low'],
    [30, 'medium'],
    [60, 'high'],
    [85, 'critical'],
  ] as const)('riskLevelFor(%i) = %s', (score, level) => {
    expect(riskLevelFor(score)).toBe(level);
  });
});

describe('formatSecurityReportMarkdown', () => {
  it('renders summary, actions, findings and controls', () => {
    const { entries, now } = buildDataset();
    const md = formatSecurityReportMarkdown(analyzeSecurityAuditTrail(entries, { now: () => now }));
    expect(md).toContain('# Security Audit Trail Report');
    expect(md).toContain('## Recommended actions');
    expect(md).toContain('| Severity | Risk | Finding | Actor | Evidence |');
    expect(md).toContain('## Compliance controls affected');
  });
});

describe('real-time analysis', () => {
  beforeEach(() => {
    auditMock.entries = [];
    auditMock.handlers.clear();
  });

  it('streams each finding once as entries arrive', () => {
    const seen: string[] = [];
    const analyzer = createStreamingSecurityAnalyzer({ onFinding: (f) => seen.push(f.id) });
    for (let k = 0; k < 4; k++) {
      expect(analyzer.ingest(entry(at(0, 12, 0, k), 'erin', 'auth.login', 'auth', { outcome: 'failure' }))).toEqual([]);
    }
    const fresh = analyzer.ingest(entry(at(0, 12, 0, 5), 'erin', 'auth.login', 'auth', { outcome: 'failure' }));
    expect(fresh.map((f) => f.type)).toEqual(['brute_force']);
    // Same burst growing does not produce a duplicate alert.
    expect(analyzer.ingest(entry(at(0, 12, 0, 6), 'erin', 'auth.login', 'auth', { outcome: 'failure' }))).toEqual([]);
    expect(seen).toHaveLength(1);
    expect(analyzer.report().findings).toHaveLength(1);
  });

  it('bounds the sliding window and validates its size', () => {
    const analyzer = createStreamingSecurityAnalyzer({ maxEntries: 3 });
    analyzer.ingest([1, 2, 3, 4, 5].map((k) => entry(at(0, 9, k), 'finn', 'dashboard.view', 'analytics')));
    expect(analyzer.size()).toBe(3);
    analyzer.reset();
    expect(analyzer.size()).toBe(0);
    expect(() => createStreamingSecurityAnalyzer({ maxEntries: 0 })).toThrow(RangeError);
  });

  it('subscribes to the recorded audit log', () => {
    const onFinding = vi.fn();
    const stop = startLiveSecurityAnalysis(onFinding);
    const [handler] = auditMock.handlers;
    handler(entry(at(0, 12), null, 'role.grant', 'admin'));
    expect(onFinding).toHaveBeenCalledWith(expect.objectContaining({ type: 'unattributed_action' }));
    stop();
    expect(auditMock.handlers.size).toBe(0);
  });

  it('analyses the recorded audit log on demand', () => {
    auditMock.entries = [entry(at(0, 12), 'gina', 'audit.clear', 'system')];
    expect(analyzeRecordedAuditLog().findings[0]).toMatchObject({ type: 'audit_tampering', actor: 'gina' });
  });
});
