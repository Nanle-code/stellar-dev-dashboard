/**
 * Security Audit Trail Analysis (#587)
 *
 * Analyses audit log entries for security-relevant anomalies, recognises known
 * attack patterns, scores risk per finding / actor / overall, and produces an
 * actionable report with recommendations.
 *
 * Detection combines two approaches:
 *  - Behavioural baselines learned from the log itself (per-actor activity
 *    hours, robust z-scores over per-actor event volume) — no training data or
 *    network access required, so it runs entirely client-side.
 *  - Pattern rules for well-understood security events (credential stuffing,
 *    privilege/signer changes, bulk export, session sharing, audit tampering).
 *
 * Accepts entries from `src/utils/audit.ts` (`action`/`actor`/`outcome`) and
 * the legacy `src/lib/auditTrail.ts` shape (`type`/`userId`). Malformed entries
 * are skipped and counted rather than throwing.
 */

import { getAuditEntries, subscribeAudit } from '../utils/audit.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskLevel = 'none' | FindingSeverity;

export type FindingType =
  | 'brute_force'
  | 'credential_compromise'
  | 'volume_anomaly'
  | 'off_hours_activity'
  | 'privilege_escalation'
  | 'signer_change'
  | 'data_exfiltration'
  | 'session_anomaly'
  | 'audit_tampering'
  | 'unattributed_action'
  | 'high_severity_cluster';

export interface RawAuditEntry {
  id?: string;
  timestamp?: string | number;
  action?: string;
  type?: string;
  category?: string;
  severity?: string;
  actor?: string | null;
  userId?: string | null;
  target?: string | null;
  outcome?: string;
  sessionId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
  hash?: string;
  prevHash?: string;
  [key: string]: unknown;
}

interface NormalizedEntry {
  id: string;
  ts: number;
  action: string;
  category: string;
  severity: string;
  actor: string | null;
  target: string | null;
  outcome: 'success' | 'failure';
  sessionId: string | null;
  userAgent: string | null;
  ip: string | null;
  metadata: Record<string, unknown>;
  hash?: string;
  prevHash?: string;
}

export interface SecurityFinding {
  id: string;
  type: FindingType;
  title: string;
  severity: FindingSeverity;
  /** 0–100, severity weight scaled by detector confidence. */
  riskScore: number;
  confidence: number;
  actor: string | null;
  entryIds: string[];
  firstSeen: string;
  lastSeen: string;
  evidence: string;
  recommendation: string;
  /** Compliance controls this finding may violate. Empty when not compliance-relevant. */
  complianceControls: string[];
}

export interface ActorRisk {
  actor: string;
  riskScore: number;
  riskLevel: RiskLevel;
  findingCount: number;
  eventCount: number;
}

export interface SecurityRecommendation {
  priority: FindingSeverity;
  action: string;
  findingIds: string[];
}

export interface SecurityAuditReport {
  generatedAt: string;
  window: { from: string | null; to: string | null };
  entriesAnalyzed: number;
  entriesSkipped: number;
  durationMs: number;
  riskScore: number;
  riskLevel: RiskLevel;
  summary: string;
  findings: SecurityFinding[];
  actors: ActorRisk[];
  complianceViolations: SecurityFinding[];
  recommendations: SecurityRecommendation[];
}

export interface SecurityAnalysisOptions {
  /** Clock used for future-timestamp checks and `generatedAt`. */
  now?: () => number;
  /** Failed auth attempts within `bruteForceWindowMs` that trigger a finding. */
  bruteForceThreshold?: number;
  bruteForceWindowMs?: number;
  /** Bucket size for volume anomaly detection. */
  volumeBucketMs?: number;
  /** Robust z-score above which a bucket is anomalous. */
  volumeZThreshold?: number;
  /** Minimum events in a bucket before it can be flagged. */
  volumeMinEvents?: number;
  /** Minimum events for an actor before their activity-hour baseline is trusted. */
  baselineMinEvents?: number;
  /** Exports by one actor within an hour that indicate bulk exfiltration. */
  exportBurstThreshold?: number;
  /** Actors expected to perform privileged/admin actions. */
  trustedActors?: string[];
}

const DEFAULTS = {
  bruteForceThreshold: 5,
  bruteForceWindowMs: 5 * 60_000,
  volumeBucketMs: 10 * 60_000,
  volumeZThreshold: 6,
  volumeMinEvents: 20,
  baselineMinEvents: 30,
  exportBurstThreshold: 3,
};

const HOUR_MS = 3_600_000;
const FUTURE_SKEW_MS = 5 * 60_000;

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = { low: 20, medium: 45, high: 70, critical: 95 };
const SEVERITY_RANK: Record<FindingSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

const SENSITIVE_CATEGORIES = new Set(['admin', 'config', 'export', 'security', 'wallet', 'data_access']);
const PRIVILEGE_PATTERN = /role|permission|privilege|grant|access[_ .-]?control|make[_ .-]?admin|elevat/i;
const SIGNER_PATTERN = /signer|threshold|set[_ ]?options|master[_ ]?weight/i;
const AUTH_PATTERN = /login|logon|sign[_ .-]?in|auth|sep-?10|password|mfa|2fa/i;
const EXPORT_PATTERN = /export|download|dump/i;
const AUDIT_DELETE_PATTERN = /(audit|log).*(clear|delete|purge|truncate)|(clear|delete|purge|truncate).*(audit|log)/i;
const FAILURE_PATTERN = /fail|error|denied|reject|invalid/i;

// ─── Normalisation ────────────────────────────────────────────────────────────

function normalize(raw: RawAuditEntry, index: number): NormalizedEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const ts = typeof raw.timestamp === 'number' ? raw.timestamp : Date.parse(String(raw.timestamp ?? ''));
  if (!Number.isFinite(ts)) return null;
  const action = String(raw.action ?? raw.type ?? '').trim();
  if (!action) return null;

  const outcomeRaw = String(raw.outcome ?? '').toLowerCase();
  const failed = outcomeRaw
    ? outcomeRaw !== 'success'
    : FAILURE_PATTERN.test(action) || ['error', 'high', 'critical'].includes(String(raw.severity));

  const metadata = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};
  return {
    id: String(raw.id ?? `entry-${index}`),
    ts,
    action,
    category: String(raw.category ?? '').toLowerCase(),
    severity: String(raw.severity ?? 'info').toLowerCase(),
    actor: (raw.actor ?? raw.userId ?? null) || null,
    target: raw.target ?? null,
    outcome: failed ? 'failure' : 'success',
    sessionId: raw.sessionId ?? null,
    userAgent: raw.userAgent ?? null,
    ip: (raw.ip as string | null | undefined) ?? (typeof metadata.ip === 'string' ? metadata.ip : null),
    metadata,
    hash: typeof raw.hash === 'string' ? raw.hash : undefined,
    prevHash: typeof raw.prevHash === 'string' ? raw.prevHash : undefined,
  };
}

const isAuthEvent = (e: NormalizedEntry) => e.category === 'auth' || AUTH_PATTERN.test(e.action);
const isSensitive = (e: NormalizedEntry) =>
  SENSITIVE_CATEGORIES.has(e.category) || PRIVILEGE_PATTERN.test(e.action) || SIGNER_PATTERN.test(e.action);

// ─── Statistics helpers ───────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Robust z-score using median absolute deviation (resistant to the outliers we are hunting). */
function robustZ(value: number, values: number[]): number {
  const med = median(values);
  const mad = median(values.map((v) => Math.abs(v - med))) * 1.4826;
  // Floor the scale at 1 event so near-constant baselines don't explode.
  return (value - med) / Math.max(mad, 1);
}

// ─── Finding construction ─────────────────────────────────────────────────────

function makeFinding(
  type: FindingType,
  key: string,
  entries: NormalizedEntry[],
  fields: {
    title: string;
    severity: FindingSeverity;
    confidence: number;
    evidence: string;
    recommendation: string;
    complianceControls?: string[];
    actor?: string | null;
  }
): SecurityFinding {
  const confidence = Math.min(1, Math.max(0, fields.confidence));
  const ts = entries.map((e) => e.ts);
  return {
    id: `${type}:${key}`,
    type,
    title: fields.title,
    severity: fields.severity,
    riskScore: Math.round(SEVERITY_WEIGHT[fields.severity] * confidence),
    confidence: Number(confidence.toFixed(2)),
    actor: fields.actor !== undefined ? fields.actor : entries[0]?.actor ?? null,
    entryIds: entries.map((e) => e.id),
    firstSeen: new Date(Math.min(...ts)).toISOString(),
    lastSeen: new Date(Math.max(...ts)).toISOString(),
    evidence: fields.evidence,
    recommendation: fields.recommendation,
    complianceControls: fields.complianceControls ?? [],
  };
}

function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** Split time-sorted entries into clusters where consecutive gaps are ≤ windowMs. */
function clusters(entries: NormalizedEntry[], windowMs: number): NormalizedEntry[][] {
  const out: NormalizedEntry[][] = [];
  let current: NormalizedEntry[] = [];
  for (const e of entries) {
    if (current.length && e.ts - current[current.length - 1].ts > windowMs) {
      out.push(current);
      current = [];
    }
    current.push(e);
  }
  if (current.length) out.push(current);
  return out;
}

// ─── Detectors ────────────────────────────────────────────────────────────────

type Config = typeof DEFAULTS & { now: () => number; trustedActors: Set<string> };

function detectBruteForce(entries: NormalizedEntry[], cfg: Config): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const authEvents = entries.filter(isAuthEvent);
  const byPrincipal = groupBy(authEvents, (e) => e.actor ?? e.target ?? e.ip);

  for (const [principal, events] of byPrincipal) {
    const failures = events.filter((e) => e.outcome === 'failure');
    for (const burst of clusters(failures, cfg.bruteForceWindowMs)) {
      if (burst.length < cfg.bruteForceThreshold) continue;
      const last = burst[burst.length - 1];
      const success = events.find(
        (e) => e.outcome === 'success' && e.ts >= last.ts && e.ts - last.ts <= cfg.bruteForceWindowMs
      );
      const confidence = Math.min(1, 0.6 + burst.length / (cfg.bruteForceThreshold * 4));
      if (success) {
        findings.push(
          makeFinding('credential_compromise', `${principal}:${burst[0].ts}`, [...burst, success], {
            title: 'Successful login after repeated failures',
            severity: 'critical',
            confidence: Math.min(1, confidence + 0.15),
            evidence: `${burst.length} failed authentication attempts for ${principal} followed by a success.`,
            recommendation: `Treat ${principal} as potentially compromised: revoke active sessions, force credential rotation and review activity after ${new Date(success.ts).toISOString()}.`,
            complianceControls: ['SOC2 CC6.1', 'ISO27001 A.9.4.2'],
          })
        );
      } else {
        findings.push(
          makeFinding('brute_force', `${principal}:${burst[0].ts}`, burst, {
            title: 'Repeated authentication failures',
            severity: 'high',
            confidence,
            evidence: `${burst.length} failed authentication attempts for ${principal} within ${Math.round((last.ts - burst[0].ts) / 1000)}s.`,
            recommendation: `Rate-limit or temporarily lock authentication for ${principal} and verify the source of the attempts.`,
            complianceControls: ['SOC2 CC6.1'],
          })
        );
      }
    }
  }
  return findings;
}

function detectVolumeAnomalies(entries: NormalizedEntry[], cfg: Config): SecurityFinding[] {
  const buckets = groupBy(entries, (e) => `${e.actor ?? 'anonymous'}|${Math.floor(e.ts / cfg.volumeBucketMs)}`);
  const counts = [...buckets.values()].map((b) => b.length);
  if (counts.length < 5) return [];

  const findings: SecurityFinding[] = [];
  for (const [key, bucket] of buckets) {
    if (bucket.length < cfg.volumeMinEvents) continue;
    const z = robustZ(bucket.length, counts);
    if (z < cfg.volumeZThreshold) continue;
    const actor = key.split('|')[0];
    findings.push(
      makeFinding('volume_anomaly', key, bucket, {
        title: 'Unusual burst of activity',
        severity: z >= cfg.volumeZThreshold * 2 ? 'high' : 'medium',
        confidence: Math.min(1, 0.5 + z / (cfg.volumeZThreshold * 4)),
        evidence: `${bucket.length} events from ${actor} in ${cfg.volumeBucketMs / 60_000} minutes (robust z-score ${z.toFixed(1)}).`,
        recommendation: `Check whether ${actor} is running automation or a compromised client; apply per-actor rate limits.`,
        actor: actor === 'anonymous' ? null : actor,
      })
    );
  }
  return findings;
}

function detectOffHours(entries: NormalizedEntry[], cfg: Config): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const [actor, events] of groupBy(entries, (e) => e.actor)) {
    if (events.length < cfg.baselineMinEvents) continue;
    const hist = new Array(24).fill(0);
    for (const e of events) hist[new Date(e.ts).getUTCHours()] += 1;
    const rareLimit = Math.max(3, events.length * 0.02);
    const rare = events.filter((e) => {
      const h = new Date(e.ts).getUTCHours();
      return hist[h] <= rareLimit && hist[h] / events.length < 0.05 && isSensitive(e);
    });
    for (const group of clusters(rare, HOUR_MS)) {
      const hour = new Date(group[0].ts).getUTCHours();
      findings.push(
        makeFinding('off_hours_activity', `${actor}:${group[0].ts}`, group, {
          title: 'Sensitive activity outside normal hours',
          severity: 'medium',
          confidence: 1 - hist[hour] / events.length,
          evidence: `${group.length} sensitive action(s) by ${actor} at ${String(hour).padStart(2, '0')}:00 UTC; only ${hist[hour]} of ${events.length} of their events occur in that hour.`,
          recommendation: `Confirm with ${actor} that this activity was intended; consider step-up authentication for sensitive actions outside working hours.`,
          complianceControls: ['SOC2 CC7.2'],
        })
      );
    }
  }
  return findings;
}

function detectPrivilegeChanges(entries: NormalizedEntry[], cfg: Config): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const byActor = groupBy(entries, (e) => e.actor ?? 'anonymous');

  for (const [actor, events] of byActor) {
    const trusted = cfg.trustedActors.has(actor);
    const privileged = events.filter((e) => PRIVILEGE_PATTERN.test(e.action) && !SIGNER_PATTERN.test(e.action));
    const denied = privileged.filter((e) => e.outcome === 'failure');
    const granted = privileged.filter((e) => e.outcome === 'success');
    // A user whose history is almost entirely non-privileged suddenly changing roles.
    const unusual = !trusted && granted.length > 0 && granted.length / events.length < 0.2;

    if (denied.length > 0) {
      findings.push(
        makeFinding('privilege_escalation', `${actor}:denied`, denied, {
          title: 'Denied privilege change attempts',
          severity: denied.length >= 3 ? 'high' : 'medium',
          confidence: Math.min(1, 0.55 + denied.length * 0.15),
          evidence: `${denied.length} denied privilege/permission change(s) by ${actor}.`,
          recommendation: `Review why ${actor} attempted privileged actions and confirm the account's role assignment.`,
          complianceControls: ['SOC2 CC6.3', 'ISO27001 A.9.2.3'],
          actor: actor === 'anonymous' ? null : actor,
        })
      );
    }
    if (unusual) {
      findings.push(
        makeFinding('privilege_escalation', `${actor}:granted`, granted, {
          title: 'Unexpected privilege change',
          severity: 'high',
          confidence: 0.75,
          evidence: `${actor} performed ${granted.length} privilege change(s) but is not a known administrator.`,
          recommendation: `Verify the change was approved; if not, revert the permission change and add ${actor} to an access review.`,
          complianceControls: ['SOC2 CC6.3', 'ISO27001 A.9.2.3'],
          actor: actor === 'anonymous' ? null : actor,
        })
      );
    }

    // Stellar-specific: adding signers / changing thresholds can hand over account control.
    const signerChanges = events.filter((e) => SIGNER_PATTERN.test(e.action) && e.outcome === 'success');
    if (signerChanges.length > 0 && !trusted) {
      findings.push(
        makeFinding('signer_change', `${actor}:${signerChanges[0].ts}`, signerChanges, {
          title: 'Account signer or threshold change',
          severity: 'high',
          confidence: 0.8,
          evidence: `${signerChanges.length} signer/threshold change(s) by ${actor}. These can transfer control of a Stellar account.`,
          recommendation: 'Confirm every new signer key out-of-band and check that thresholds still require the expected co-signers.',
          complianceControls: ['SOC2 CC6.1'],
          actor: actor === 'anonymous' ? null : actor,
        })
      );
    }
  }
  return findings;
}

function detectExfiltration(entries: NormalizedEntry[], cfg: Config): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const exports = entries.filter((e) => e.category === 'export' || EXPORT_PATTERN.test(e.action));
  for (const [actor, events] of groupBy(exports, (e) => e.actor ?? 'anonymous')) {
    for (const group of clusters(events, HOUR_MS)) {
      const rows = group.reduce((sum, e) => sum + (Number(e.metadata.records ?? e.metadata.count ?? 0) || 0), 0);
      if (group.length < cfg.exportBurstThreshold && rows < 10_000) continue;
      findings.push(
        makeFinding('data_exfiltration', `${actor}:${group[0].ts}`, group, {
          title: 'Bulk data export',
          severity: group.length >= cfg.exportBurstThreshold * 2 || rows >= 50_000 ? 'high' : 'medium',
          confidence: Math.min(1, 0.55 + group.length * 0.08 + (rows >= 10_000 ? 0.2 : 0)),
          evidence: `${group.length} export(s)${rows ? ` covering ${rows} records` : ''} by ${actor} within an hour.`,
          recommendation: `Confirm the business need for these exports and check where the files were sent; restrict bulk export to approved roles.`,
          complianceControls: ['GDPR Art. 32', 'SOC2 CC6.7'],
          actor: actor === 'anonymous' ? null : actor,
        })
      );
    }
  }
  return findings;
}

function detectSessionAnomalies(entries: NormalizedEntry[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  for (const [sessionId, events] of groupBy(entries, (e) => e.sessionId)) {
    const actors = new Set(events.map((e) => e.actor).filter(Boolean));
    if (actors.size > 1) {
      findings.push(
        makeFinding('session_anomaly', `session:${sessionId}`, events, {
          title: 'Session used by multiple identities',
          severity: 'high',
          confidence: 0.85,
          evidence: `Session ${sessionId} carried activity for ${actors.size} identities: ${[...actors].join(', ')}.`,
          recommendation: 'Invalidate the session and investigate possible session fixation or token theft.',
          complianceControls: ['SOC2 CC6.1'],
          actor: null,
        })
      );
    }
  }
  for (const [actor, events] of groupBy(entries, (e) => e.actor)) {
    for (const group of clusters(events, HOUR_MS)) {
      const agents = new Set(group.map((e) => e.ip ?? e.userAgent).filter(Boolean));
      if (agents.size <= 3) continue;
      findings.push(
        makeFinding('session_anomaly', `${actor}:clients:${group[0].ts}`, group, {
          title: 'Actor active from many clients',
          severity: 'medium',
          confidence: Math.min(1, 0.4 + agents.size * 0.1),
          evidence: `${actor} used ${agents.size} distinct IPs/user agents within an hour.`,
          recommendation: `Confirm ${actor}'s devices; shared or leaked credentials often show up as many concurrent clients.`,
        })
      );
    }
  }
  return findings;
}

function detectTampering(ordered: NormalizedEntry[], cfg: Config): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  // Hash chain: each entry's prevHash must equal the previous entry's hash.
  const chained = ordered.filter((e) => e.hash && e.prevHash);
  for (let i = 1; i < chained.length; i++) {
    if (chained[i].prevHash !== chained[i - 1].hash) {
      findings.push(
        makeFinding('audit_tampering', `chain:${chained[i].id}`, [chained[i - 1], chained[i]], {
          title: 'Audit hash chain broken',
          severity: 'critical',
          confidence: 0.9,
          evidence: `Entry ${chained[i].id} does not chain to ${chained[i - 1].id}; entries may have been removed or edited.`,
          recommendation: 'Preserve the current log, compare against backups/exports, and restrict write access to audit storage.',
          complianceControls: ['SOC2 CC7.2', 'SOX 404', 'ISO27001 A.12.4.2'],
          actor: null,
        })
      );
    }
  }

  const now = cfg.now();
  const future = ordered.filter((e) => e.ts > now + FUTURE_SKEW_MS);
  if (future.length) {
    findings.push(
      makeFinding('audit_tampering', 'future-timestamps', future, {
        title: 'Audit entries dated in the future',
        severity: 'medium',
        confidence: 0.7,
        evidence: `${future.length} entr${future.length === 1 ? 'y has' : 'ies have'} timestamps more than 5 minutes ahead of the analysis clock.`,
        recommendation: 'Check client clock skew and whether entries were injected with forged timestamps.',
        complianceControls: ['ISO27001 A.12.4.4'],
        actor: null,
      })
    );
  }

  for (const e of ordered) {
    if (!AUDIT_DELETE_PATTERN.test(e.action)) continue;
    findings.push(
      makeFinding('audit_tampering', `clear:${e.id}`, [e], {
        title: 'Audit log cleared or truncated',
        severity: 'high',
        confidence: 0.85,
        evidence: `${e.actor ?? 'An unknown actor'} ran "${e.action}".`,
        recommendation: 'Audit deletion should require a retention-policy approval; confirm one exists for this change.',
        complianceControls: ['SOX 404', 'SOC2 CC7.2'],
      })
    );
  }
  return findings;
}

function detectUnattributed(entries: NormalizedEntry[]): SecurityFinding[] {
  const orphaned = entries.filter(
    (e) => !e.actor && (SENSITIVE_CATEGORIES.has(e.category) || PRIVILEGE_PATTERN.test(e.action)) && e.category !== 'data_access'
  );
  if (orphaned.length === 0) return [];
  return [
    makeFinding('unattributed_action', 'no-actor', orphaned, {
      title: 'Privileged actions without an actor',
      severity: orphaned.length >= 5 ? 'high' : 'medium',
      confidence: 0.8,
      evidence: `${orphaned.length} sensitive action(s) were logged without an actor, so they cannot be attributed to anyone.`,
      recommendation: 'Make sure every privileged code path passes an actor to recordAudit().',
      complianceControls: ['SOC2 CC7.2', 'ISO27001 A.12.4.1'],
      actor: null,
    }),
  ];
}

function detectHighSeverityClusters(entries: NormalizedEntry[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const severe = entries.filter((e) => e.severity === 'high' || e.severity === 'critical');
  for (const [actor, events] of groupBy(severe, (e) => e.actor ?? 'anonymous')) {
    for (const group of clusters(events, 10 * 60_000)) {
      if (group.length < 3) continue;
      findings.push(
        makeFinding('high_severity_cluster', `${actor}:${group[0].ts}`, group, {
          title: 'Cluster of high-severity events',
          severity: group.some((e) => e.severity === 'critical') ? 'high' : 'medium',
          confidence: Math.min(1, 0.5 + group.length * 0.1),
          evidence: `${group.length} high/critical audit events for ${actor} within minutes of each other.`,
          recommendation: 'Review these events together; correlated high-severity events often share one root cause.',
          actor: actor === 'anonymous' ? null : actor,
        })
      );
    }
  }
  return findings;
}

// ─── Scoring & reporting ──────────────────────────────────────────────────────

/** Noisy-OR combination: independent risks compound but never exceed 100. */
export function combineRiskScores(scores: number[]): number {
  const remaining = scores.reduce((acc, s) => acc * (1 - Math.min(100, Math.max(0, s)) / 100), 1);
  return Math.round((1 - remaining) * 100);
}

export function riskLevelFor(score: number): RiskLevel {
  if (score >= 85) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}

function buildRecommendations(findings: SecurityFinding[]): SecurityRecommendation[] {
  const byAction = new Map<string, SecurityRecommendation>();
  for (const f of findings) {
    const existing = byAction.get(f.recommendation);
    if (existing) {
      existing.findingIds.push(f.id);
      if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[existing.priority]) existing.priority = f.severity;
    } else {
      byAction.set(f.recommendation, { priority: f.severity, action: f.recommendation, findingIds: [f.id] });
    }
  }
  return [...byAction.values()].sort((a, b) => SEVERITY_RANK[b.priority] - SEVERITY_RANK[a.priority]);
}

/**
 * Analyse a batch of audit entries and produce a security report.
 * Pure and synchronous: the same input and clock always yield the same report.
 */
export function analyzeSecurityAuditTrail(
  rawEntries: RawAuditEntry[],
  options: SecurityAnalysisOptions = {}
): SecurityAuditReport {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const cfg: Config = {
    ...DEFAULTS,
    ...Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)),
    now: options.now ?? Date.now,
    trustedActors: new Set(options.trustedActors ?? []),
  } as Config;

  if (!Array.isArray(rawEntries)) {
    throw new TypeError('analyzeSecurityAuditTrail expects an array of audit entries');
  }

  const normalized: NormalizedEntry[] = [];
  let skipped = 0;
  rawEntries.forEach((raw, i) => {
    const entry = normalize(raw, i);
    if (entry) normalized.push(entry);
    else skipped += 1;
  });
  // Stable sort keeps insertion order for equal timestamps, which the hash-chain check relies on.
  const entries = normalized.map((e, i) => ({ e, i })).sort((a, b) => a.e.ts - b.e.ts || a.i - b.i).map(({ e }) => e);

  const findings = [
    ...detectBruteForce(entries, cfg),
    ...detectVolumeAnomalies(entries, cfg),
    ...detectOffHours(entries, cfg),
    ...detectPrivilegeChanges(entries, cfg),
    ...detectExfiltration(entries, cfg),
    ...detectSessionAnomalies(entries),
    ...detectTampering(entries, cfg),
    ...detectUnattributed(entries),
    ...detectHighSeverityClusters(entries),
  ].sort((a, b) => b.riskScore - a.riskScore || a.id.localeCompare(b.id));

  const eventCounts = new Map<string, number>();
  for (const e of entries) if (e.actor) eventCounts.set(e.actor, (eventCounts.get(e.actor) ?? 0) + 1);

  const actors: ActorRisk[] = [...groupBy(findings, (f) => f.actor)]
    .map(([actor, list]) => {
      const riskScore = combineRiskScores(list.map((f) => f.riskScore));
      return {
        actor,
        riskScore,
        riskLevel: riskLevelFor(riskScore),
        findingCount: list.length,
        eventCount: eventCounts.get(actor) ?? 0,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  const riskScore = combineRiskScores(findings.map((f) => f.riskScore));
  const riskLevel = riskLevelFor(riskScore);
  const complianceViolations = findings.filter((f) => f.complianceControls.length > 0);

  const summary =
    entries.length === 0
      ? 'No audit entries to analyse.'
      : findings.length === 0
        ? `Analysed ${entries.length} audit entries; no security issues detected.`
        : `Analysed ${entries.length} audit entries; found ${findings.length} issue(s), overall risk ${riskLevel} (${riskScore}/100). ` +
          `Top issue: ${findings[0].title}.`;

  const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    generatedAt: new Date(cfg.now()).toISOString(),
    window: {
      from: entries.length ? new Date(entries[0].ts).toISOString() : null,
      to: entries.length ? new Date(entries[entries.length - 1].ts).toISOString() : null,
    },
    entriesAnalyzed: entries.length,
    entriesSkipped: skipped,
    durationMs: Math.round((ended - started) * 100) / 100,
    riskScore,
    riskLevel,
    summary,
    findings,
    actors,
    complianceViolations,
    recommendations: buildRecommendations(findings),
  };
}

/** Render a report as Markdown for sharing in tickets or incident channels. */
export function formatSecurityReportMarkdown(report: SecurityAuditReport): string {
  const lines = [
    '# Security Audit Trail Report',
    '',
    `Generated ${report.generatedAt} · ${report.entriesAnalyzed} entries` +
      (report.entriesSkipped ? ` (${report.entriesSkipped} malformed skipped)` : ''),
    '',
    `**Overall risk:** ${report.riskLevel} (${report.riskScore}/100)`,
    '',
    report.summary,
  ];
  if (report.recommendations.length) {
    lines.push('', '## Recommended actions', '');
    report.recommendations.forEach((r, i) => lines.push(`${i + 1}. **[${r.priority}]** ${r.action}`));
  }
  if (report.findings.length) {
    lines.push('', '## Findings', '', '| Severity | Risk | Finding | Actor | Evidence |', '|---|---|---|---|---|');
    for (const f of report.findings) {
      const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      lines.push(`| ${f.severity} | ${f.riskScore} | ${cell(f.title)} | ${cell(f.actor ?? '—')} | ${cell(f.evidence)} |`);
    }
  }
  if (report.complianceViolations.length) {
    const controls = [...new Set(report.complianceViolations.flatMap((f) => f.complianceControls))].sort();
    lines.push('', '## Compliance controls affected', '', controls.map((c) => `- ${c}`).join('\n'));
  }
  return lines.join('\n') + '\n';
}

// ─── Real-time analysis ───────────────────────────────────────────────────────

export interface StreamingAnalyzerOptions extends SecurityAnalysisOptions {
  /** Entries kept in the sliding window (oldest dropped first). */
  maxEntries?: number;
  onFinding?: (finding: SecurityFinding) => void;
}

/**
 * Incremental analyser for live audit streams. Each `ingest` re-analyses the
 * bounded sliding window and reports only findings not seen before, so
 * callers get each alert once.
 */
export function createStreamingSecurityAnalyzer(options: StreamingAnalyzerOptions = {}) {
  const maxEntries = options.maxEntries ?? 5_000;
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError('maxEntries must be a positive integer');
  }
  const buffer: RawAuditEntry[] = [];
  const reported = new Set<string>();
  let lastReport: SecurityAuditReport | null = null;

  function ingest(entries: RawAuditEntry | RawAuditEntry[]): SecurityFinding[] {
    const batch = Array.isArray(entries) ? entries : [entries];
    buffer.push(...batch);
    if (buffer.length > maxEntries) buffer.splice(0, buffer.length - maxEntries);

    lastReport = analyzeSecurityAuditTrail(buffer, options);
    const fresh = lastReport.findings.filter((f) => !reported.has(f.id));
    for (const f of fresh) {
      reported.add(f.id);
      options.onFinding?.(f);
    }
    return fresh;
  }

  return {
    ingest,
    report: () => lastReport ?? analyzeSecurityAuditTrail(buffer, options),
    size: () => buffer.length,
    reset() {
      buffer.length = 0;
      reported.clear();
      lastReport = null;
    },
  };
}

/** Analyse the in-memory audit log recorded through `src/utils/audit.ts`. */
export function analyzeRecordedAuditLog(options: SecurityAnalysisOptions & { since?: string; until?: string } = {}) {
  const { since, until, ...rest } = options;
  // getAuditEntries is inferred from JS defaults and under-types its filter argument.
  const query = getAuditEntries as (filter: { since?: string; until?: string; limit?: number }) => unknown[];
  return analyzeSecurityAuditTrail(query({ since, until, limit: 100_000 }) as RawAuditEntry[], rest);
}

/** Stream findings for every new entry recorded through `recordAudit`. Returns an unsubscribe function. */
export function startLiveSecurityAnalysis(onFinding: (finding: SecurityFinding) => void, options: StreamingAnalyzerOptions = {}) {
  const analyzer = createStreamingSecurityAnalyzer({ ...options, onFinding });
  return subscribeAudit((entry: RawAuditEntry) => analyzer.ingest(entry));
}
