/**
 * Security Audit Trail Analysis Engine
 *
 * Provides AI-driven analysis of audit log data to identify:
 *  - Statistical anomalies (unusual event rates, off-hours activity)
 *  - Behavioral patterns (escalation chains, session drift, burst attacks)
 *  - Risk scoring with weighted severity classification
 *  - Actionable security reports with recommendations
 *
 * Design goals:
 *  - Pure functions operating on audit entry arrays (no side effects)
 *  - O(n) or O(n log n) complexity for real-time analysis
 *  - Thresholds and weights configurable per deployment
 */

import { AuditCategory, AuditSeverity } from './audit.js';

// ─── Configuration ────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG = Object.freeze({
  // Anomaly detection thresholds
  rateStdDevMultiplier: 2.0,
  burstWindowMs: 60_000,
  burstThreshold: 10,
  offHoursStart: 22,
  offHoursEnd: 6,
  minEntriesForBaselines: 20,

  // Pattern detection
  escalationChainLength: 3,
  sessionDriftThresholdMs: 24 * 60 * 60 * 1000,
  maxSessionGapMs: 30 * 60 * 1000,

  // Risk scoring weights
  weights: {
    severity: { info: 0, low: 5, medium: 15, high: 35, critical: 60 },
    category: {
      auth: 1.2,
      wallet: 1.1,
      transaction: 1.3,
      contract: 1.0,
      network: 0.6,
      config: 0.8,
      data_access: 1.1,
      export: 0.9,
      security: 1.5,
      admin: 1.4,
      system: 0.3,
    },
    outcome: { success: 0, failure: 8, denied: 12 },
  },

  // Composite score normalization
  maxRiskScore: 100,
});

// ─── Severity Numeric Mapping ────────────────────────────────────────────────

const SEVERITY_NUMERIC = {
  [AuditSeverity.INFO]: 0,
  [AuditSeverity.LOW]: 1,
  [AuditSeverity.MEDIUM]: 2,
  [AuditSeverity.HIGH]: 3,
  [AuditSeverity.CRITICAL]: 4,
};

// ─── Helper Utilities ────────────────────────────────────────────────────────

function ts(entry) {
  return new Date(entry.timestamp).getTime();
}

function hourOfDay(entry) {
  return new Date(entry.timestamp).getHours();
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function zScore(value, arr) {
  const sd = stdDev(arr);
  if (sd === 0) return value === arr[0] ? 0 : Infinity;
  return (value - mean(arr)) / sd;
}

function bucketEntries(entries, bucketMs) {
  if (!entries.length) return [];
  const sorted = entries.slice().sort((a, b) => ts(a) - ts(b));
  const start = ts(sorted[0]);
  const end = ts(sorted[sorted.length - 1]);
  const buckets = [];
  for (let t = start; t <= end; t += bucketMs) {
    const count = sorted.filter((e) => {
      const et = ts(e);
      return et >= t && et < t + bucketMs;
    }).length;
    buckets.push({ time: t, count });
  }
  return buckets;
}

// ─── Anomaly Detection ──────────────────────────────────────────────────────

/**
 * Detect rate-based anomalies using statistical deviation from the mean.
 * Flags time buckets where event counts exceed the configured threshold.
 *
 * @param {object[]} entries - Audit log entries
 * @param {object} [config]
 * @returns {{ anomalies: object[], bucketData: object[] }}
 */
export function detectRateAnomalies(entries, config = DEFAULT_CONFIG) {
  if (entries.length < config.minEntriesForBaselines) {
    return { anomalies: [], bucketData: [] };
  }

  const bucketData = bucketEntries(entries, config.burstWindowMs);
  const counts = bucketData.map((b) => b.count);
  const m = mean(counts);
  const sd = stdDev(counts);
  const threshold = m + config.rateStdDevMultiplier * sd;

  const anomalies = bucketData
    .filter((b) => b.count > threshold && b.count >= config.burstThreshold)
    .map((b) => ({
      type: 'rate_spike',
      severity: b.count > threshold * 2 ? AuditSeverity.CRITICAL : AuditSeverity.HIGH,
      timestamp: new Date(b.time).toISOString(),
      count: b.count,
      expectedMax: Math.round(threshold),
      deviation: sd > 0 ? ((b.count - m) / sd).toFixed(1) : '∞',
      message: `Event burst detected: ${b.count} events in window (baseline avg: ${m.toFixed(0)}, threshold: ${Math.round(threshold)})`,
    }));

  return { anomalies, bucketData };
}

/**
 * Detect off-hours activity (configurable quiet period).
 *
 * @param {object[]} entries
 * @param {object} [config]
 * @returns {object[]}
 */
export function detectOffHoursActivity(entries, config = DEFAULT_CONFIG) {
  const { offHoursStart, offHoursEnd } = config;
  const offHoursEntries = entries.filter((e) => {
    const h = hourOfDay(e);
    return offHoursStart > offHoursEnd
      ? h >= offHoursStart || h < offHoursEnd
      : h >= offHoursStart && h < offHoursEnd;
  });

  return offHoursEntries.map((e) => ({
    type: 'off_hours_activity',
    severity: e.severity === AuditSeverity.CRITICAL || e.severity === AuditSeverity.HIGH
      ? AuditSeverity.HIGH
      : AuditSeverity.MEDIUM,
    timestamp: e.timestamp,
    entryId: e.id,
    action: e.action,
    actor: e.actor,
    message: `Activity at unusual hour (${hourOfDay(e)}:00): ${e.action}`,
  }));
}

/**
 * Detect actor velocity anomalies — an actor performing significantly more
 * actions than their historical average.
 *
 * @param {object[]} entries
 * @param {object} [config]
 * @returns {object[]}
 */
export function detectActorVelocityAnomalies(entries, config = DEFAULT_CONFIG) {
  if (entries.length < config.minEntriesForBaselines) {
    return [];
  }

  const sorted = entries.slice().sort((a, b) => ts(a) - ts(b));
  const windowMs = 10 * 60_000;
  const actorCounts = new Map();

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const actor = entry.actor || 'anonymous';
    const now = ts(entry);

    if (!actorCounts.has(actor)) {
      actorCounts.set(actor, []);
    }
    const history = actorCounts.get(actor);

    // Prune entries outside the sliding window
    const windowStart = now - config.sessionDriftThresholdMs;
    const recent = history.filter((h) => h.time >= windowStart);
    recent.push(now);
    actorCounts.set(actor, recent);

    // If we have enough history, check deviation
    if (recent.length >= config.minEntriesForBaselines) {
      const intervals = [];
      for (let j = 1; j < recent.length; j++) {
        intervals.push(recent[j] - recent[j - 1]);
      }
      if (intervals.length >= 3) {
        const avgInterval = mean(intervals);
        const currentGap = i > 0 ? now - ts(sorted[i - 1]) : Infinity;
        if (currentGap < avgInterval * 0.2 && actor !== (sorted[i - 1]?.actor || 'anonymous')) {
          // Skip — different actors
        }
      }
    }
  }

  // Aggregate actor totals and detect outliers
  const actorTotals = new Map();
  for (const entry of entries) {
    const actor = entry.actor || 'anonymous';
    actorTotals.set(actor, (actorTotals.get(actor) || 0) + 1);
  }

  const totals = [...actorTotals.values()];
  if (totals.length < 2) return [];

  const m = mean(totals);
  const sd = stdDev(totals);
  if (sd === 0) return [];
  const threshold = m + config.rateStdDevMultiplier * sd;

  const anomalies = [];
  for (const [actor, count] of actorTotals) {
    if (count > threshold) {
      anomalies.push({
        type: 'actor_velocity',
        severity: count > threshold * 2 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
        actor,
        totalActions: count,
        expectedMax: Math.round(threshold),
        deviation: ((count - m) / sd).toFixed(1),
        message: `Actor "${actor}" performed ${count} actions (expected max: ~${Math.round(threshold)})`,
      });
    }
  }

  return anomalies;
}

/**
 * Detect unique-IP / unique-actor bursts — many different actors appearing
 * in a short window (potential coordinated attack or bot activity).
 *
 * @param {object[]} entries
 * @param {object} [config]
 * @returns {object[]}
 */
export function detectMultiActorBursts(entries, config = DEFAULT_CONFIG) {
  const windowMs = config.burstWindowMs;
  const sorted = entries.slice().sort((a, b) => ts(a) - ts(b));
  const anomalies = [];

  for (let i = 0; i < sorted.length; i++) {
    const windowEnd = ts(sorted[i]);
    const windowStart = windowEnd - windowMs;
    const inWindow = sorted.filter((e) => {
      const t = ts(e);
      return t >= windowStart && t <= windowEnd;
    });

    const uniqueActors = new Set(inWindow.map((e) => e.actor || 'anonymous'));
    if (uniqueActors.size >= config.burstThreshold) {
      anomalies.push({
        type: 'multi_actor_burst',
        severity: AuditSeverity.HIGH,
        timestamp: sorted[i].timestamp,
        uniqueActors: uniqueActors.size,
        totalEvents: inWindow.length,
        actors: [...uniqueActors].slice(0, 5),
        message: `${uniqueActors.size} unique actors in ${windowMs / 1000}s window (${inWindow.length} events)`,
      });
      // Skip ahead to avoid re-flagging the same window
      i = sorted.findIndex((e) => ts(e) > windowEnd);
      if (i === -1) break;
    }
  }

  return anomalies;
}

// ─── Pattern Recognition ────────────────────────────────────────────────────

/**
 * Detect escalation chains — sequences where severity increases over time
 * for the same actor or category (e.g., info → medium → critical).
 *
 * @param {object[]} entries
 * @param {object} [config]
 * @returns {object[]}
 */
export function detectEscalationChains(entries, config = DEFAULT_CONFIG) {
  const sorted = entries.slice().sort((a, b) => ts(a) - ts(b));
  const minLen = config.escalationChainLength;
  const chains = [];

  // Group by actor
  const byActor = new Map();
  for (const e of sorted) {
    const actor = e.actor || 'anonymous';
    if (!byActor.has(actor)) byActor.set(actor, []);
    byActor.get(actor).push(e);
  }

  for (const [actor, actorEntries] of byActor) {
    if (actorEntries.length < minLen) continue;

    let currentChain = [actorEntries[0]];
    for (let i = 1; i < actorEntries.length; i++) {
      const prev = SEVERITY_NUMERIC[currentChain[currentChain.length - 1].severity] ?? 0;
      const curr = SEVERITY_NUMERIC[actorEntries[i].severity] ?? 0;

      if (curr >= prev && ts(actorEntries[i]) - ts(currentChain[currentChain.length - 1]) < config.sessionDriftThresholdMs) {
        currentChain.push(actorEntries[i]);
      } else {
        if (currentChain.length >= minLen) {
          chains.push({
            type: 'escalation_chain',
            severity: AuditSeverity.HIGH,
            actor,
            chainLength: currentChain.length,
            fromSeverity: currentChain[0].severity,
            toSeverity: currentChain[currentChain.length - 1].severity,
            startTime: currentChain[0].timestamp,
            endTime: currentChain[currentChain.length - 1].timestamp,
            actions: currentChain.map((e) => e.action),
            message: `Escalation chain: ${actor} went from ${currentChain[0].severity} → ${currentChain[currentChain.length - 1].severity} over ${currentChain.length} events`,
          });
        }
        currentChain = [actorEntries[i]];
      }
    }
    if (currentChain.length >= minLen) {
      chains.push({
        type: 'escalation_chain',
        severity: AuditSeverity.HIGH,
        actor,
        chainLength: currentChain.length,
        fromSeverity: currentChain[0].severity,
        toSeverity: currentChain[currentChain.length - 1].severity,
        startTime: currentChain[0].timestamp,
        endTime: currentChain[currentChain.length - 1].timestamp,
        actions: currentChain.map((e) => e.action),
        message: `Escalation chain: ${actor} went from ${currentChain[0].severity} → ${currentChain[currentChain.length - 1].severity} over ${currentChain.length} events`,
      });
    }
  }

  return chains;
}

/**
 * Detect repeated-failure patterns — the same action failing multiple times
 * in succession (may indicate attack, misconfiguration, or stuck process).
 *
 * @param {object[]} entries
 * @param {number} [threshold=3] - Minimum consecutive failures to flag
 * @returns {object[]}
 */
export function detectRepeatedFailures(entries, threshold = 3) {
  const sorted = entries.slice().sort((a, b) => ts(a) - ts(b));
  const failures = sorted.filter((e) => e.outcome === 'failure' || e.outcome === 'denied');
  const patterns = [];

  if (failures.length < threshold) return patterns;

  let streak = [failures[0]];
  for (let i = 1; i < failures.length; i++) {
    const gap = ts(failures[i]) - ts(streak[streak.length - 1]);
    if (failures[i].action === streak[0].action &&
        failures[i].actor === streak[0].actor &&
        gap < 10 * 60_000) {
      streak.push(failures[i]);
    } else {
      if (streak.length >= threshold) {
        patterns.push({
          type: 'repeated_failures',
          severity: streak.length >= threshold * 2 ? AuditSeverity.CRITICAL : AuditSeverity.HIGH,
          action: streak[0].action,
          actor: streak[0].actor,
          count: streak.length,
          startTime: streak[0].timestamp,
          endTime: streak[streak.length - 1].timestamp,
          message: `${streak.length} consecutive failures for "${streak[0].action}" by ${streak[0].actor || 'anonymous'}`,
        });
      }
      streak = [failures[i]];
    }
  }
  if (streak.length >= threshold) {
    patterns.push({
      type: 'repeated_failures',
      severity: streak.length >= threshold * 2 ? AuditSeverity.CRITICAL : AuditSeverity.HIGH,
      action: streak[0].action,
      actor: streak[0].actor,
      count: streak.length,
      startTime: streak[0].timestamp,
      endTime: streak[streak.length - 1].timestamp,
      message: `${streak.length} consecutive failures for "${streak[0].action}" by ${streak[0].actor || 'anonymous'}`,
    });
  }

  return patterns;
}

/**
 * Detect session drift — a session lasting significantly longer than expected,
 * or entries attributed to the same session with large time gaps.
 *
 * @param {object[]} entries
 * @param {object} [config]
 * @returns {object[]}
 */
export function detectSessionDrift(entries, config = DEFAULT_CONFIG) {
  const bySession = new Map();
  for (const e of entries) {
    const sid = e.sessionId;
    if (!sid) continue;
    if (!bySession.has(sid)) bySession.set(sid, []);
    bySession.get(sid).push(e);
  }

  const anomalies = [];
  for (const [sid, sessionEntries] of bySession) {
    if (sessionEntries.length < 2) continue;
    const sorted = sessionEntries.slice().sort((a, b) => ts(a) - ts(b));
    const duration = ts(sorted[sorted.length - 1]) - ts(sorted[0]);

    if (duration > config.sessionDriftThresholdMs) {
      anomalies.push({
        type: 'session_drift',
        severity: AuditSeverity.MEDIUM,
        sessionId: sid,
        durationMs: duration,
        durationHuman: formatDuration(duration),
        entryCount: sorted.length,
        startTime: sorted[0].timestamp,
        endTime: sorted[sorted.length - 1].timestamp,
        message: `Session ${sid.slice(0, 12)}… lasted ${formatDuration(duration)} (${sorted.length} events)`,
      });
    }

    // Check for suspiciously large gaps within a session
    for (let i = 1; i < sorted.length; i++) {
      const gap = ts(sorted[i]) - ts(sorted[i - 1]);
      if (gap > config.maxSessionGapMs && gap < config.sessionDriftThresholdMs) {
        anomalies.push({
          type: 'session_gap',
          severity: AuditSeverity.LOW,
          sessionId: sid,
          gapMs: gap,
          gapHuman: formatDuration(gap),
          beforeAction: sorted[i - 1].action,
          afterAction: sorted[i].action,
          message: `Gap of ${formatDuration(gap)} in session ${sid.slice(0, 12)}… between "${sorted[i - 1].action}" and "${sorted[i].action}"`,
        });
      }
    }
  }

  return anomalies;
}

/**
 * Detect category concentration — an unusually high proportion of events
 * in a single category (may indicate targeted attack or misconfiguration).
 *
 * @param {object[]} entries
 * @param {number} [concentrationThreshold=0.6] - Min ratio to flag
 * @returns {object[]}
 */
export function detectCategoryConcentration(entries, concentrationThreshold = 0.6) {
  if (entries.length < 10) return [];

  const byCategory = new Map();
  for (const e of entries) {
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + 1);
  }

  const anomalies = [];
  for (const [category, count] of byCategory) {
    const ratio = count / entries.length;
    if (ratio >= concentrationThreshold) {
      anomalies.push({
        type: 'category_concentration',
        severity: ratio > 0.8 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
        category,
        count,
        ratio: ratio.toFixed(2),
        total: entries.length,
        message: `${ratio.toFixed(0)}% of events (${count}/${entries.length}) are in category "${category}"`,
      });
    }
  }

  return anomalies;
}

// ─── Risk Scoring ───────────────────────────────────────────────────────────

/**
 * Compute a composite risk score for a single audit entry.
 *
 * @param {object} entry
 * @param {object} [config]
 * @returns {number} 0–100
 */
export function scoreEntry(entry, config = DEFAULT_CONFIG) {
  const { weights, maxRiskScore } = config;

  const severityScore = weights.severity[entry.severity] ?? 0;
  const categoryMultiplier = weights.category[entry.category] ?? 1.0;
  const outcomeScore = weights.outcome[entry.outcome] ?? 0;

  const raw = (severityScore + outcomeScore) * categoryMultiplier;
  return Math.min(maxRiskScore, Math.round(raw));
}

/**
 * Compute an aggregate risk score for a set of audit entries.
 * Uses the maximum individual score weighted by anomaly density.
 *
 * @param {object[]} entries
 * @param {object[]} [anomalies=[]]
 * @param {object} [config]
 * @returns {{ score: number, grade: string, breakdown: object }}
 */
export function computeAggregateRisk(entries, anomalies = [], config = DEFAULT_CONFIG) {
  if (!entries.length) {
    return { score: 0, grade: 'A', breakdown: { severity: 0, anomalies: 0, outcomes: 0 } };
  }

  const scores = entries.map((e) => scoreEntry(e, config));
  const maxEntryScore = Math.max(...scores);
  const avgEntryScore = mean(scores);

  // Anomaly density contribution
  const anomalyDensity = anomalies.length / Math.max(1, entries.length);
  const anomalyScore = Math.min(40, anomalyDensity * 100);

  // Failure rate contribution
  const failures = entries.filter((e) => e.outcome === 'failure' || e.outcome === 'denied').length;
  const failureRate = failures / entries.length;
  const outcomeScore = Math.min(30, failureRate * 60);

  // Composite score: weighted blend
  const composite = Math.min(
    config.maxRiskScore,
    Math.round(maxEntryScore * 0.4 + avgEntryScore * 0.2 + anomalyScore * 0.25 + outcomeScore * 0.15),
  );

  const grade = riskGrade(composite);

  return {
    score: composite,
    grade,
    breakdown: {
      severity: Math.round(maxEntryScore),
      anomalies: Math.round(anomalyScore),
      outcomes: Math.round(outcomeScore),
    },
  };
}

/**
 * Map a numeric risk score to a letter grade.
 *
 * @param {number} score
 * @returns {string}
 */
export function riskGrade(score) {
  if (score <= 10) return 'A';
  if (score <= 25) return 'B';
  if (score <= 50) return 'C';
  if (score <= 75) return 'D';
  return 'F';
}

// ─── Report Generation ──────────────────────────────────────────────────────

/**
 * Recommendation templates keyed by anomaly/pattern type.
 */
const RECOMMENDATIONS = {
  rate_spike: [
    'Investigate the source of the event burst.',
    'Consider temporarily rate-limiting affected endpoints.',
    'Verify no automated process is malfunctioning.',
  ],
  off_hours_activity: [
    'Verify the actor was authorized for this time window.',
    'Review if off-hours access aligns with on-call schedules.',
    'Consider enforcing stricter MFA for off-hours operations.',
  ],
  actor_velocity: [
    'Review the actor\'s recent activity for legitimacy.',
    'Check for compromised credentials or session tokens.',
    'Consider imposing per-actor rate limits.',
  ],
  multi_actor_burst: [
    'Check for coordinated attack or bot activity.',
    'Review IP addresses and geolocation of actors.',
    'Consider enabling additional CAPTCHA or challenge mechanisms.',
  ],
  escalation_chain: [
    'Investigate the root cause of the escalating severity.',
    'Ensure alerting is configured for critical-severity events.',
    'Consider automated containment for rapid escalations.',
  ],
  repeated_failures: [
    'Check for misconfiguration or service degradation.',
    'Review if the actor\'s permissions are correctly assigned.',
    'Investigate if this is a brute-force or fuzzing attempt.',
  ],
  session_drift: [
    'Verify session belongs to a legitimate long-running operation.',
    'Check for session fixation or hijacking indicators.',
    'Consider implementing session timeout policies.',
  ],
  session_gap: [
    'Review what happened during the gap period.',
    'Check for network interruptions or suspended sessions.',
  ],
  category_concentration: [
    'Investigate why one category dominates activity.',
    'Check for automated scripts or misconfigured integrations.',
    'Review access controls for the concentrated category.',
  ],
};

/**
 * Generate a comprehensive security analysis report.
 *
 * @param {object[]} entries - Audit log entries to analyze
 * @param {object} [config]
 * @returns {object} Full report with findings, risk score, and recommendations
 */
export function generateReport(entries, config = DEFAULT_CONFIG) {
  if (!entries.length) {
    return {
      timestamp: new Date().toISOString(),
      entryCount: 0,
      riskScore: { score: 0, grade: 'A', breakdown: { severity: 0, anomalies: 0, outcomes: 0 } },
      findings: [],
      summary: { totalFindings: 0, byType: {}, bySeverity: {} },
      recommendations: [],
    };
  }

  // Run all detectors
  const { anomalies: rateAnomalies } = detectRateAnomalies(entries, config);
  const offHours = detectOffHoursActivity(entries, config);
  const velocityAnomalies = detectActorVelocityAnomalies(entries, config);
  const multiActorBursts = detectMultiActorBursts(entries, config);
  const escalationChains = detectEscalationChains(entries, config);
  const repeatedFailures = detectRepeatedFailures(entries);
  const sessionDrift = detectSessionDrift(entries, config);
  const categoryConcentration = detectCategoryConcentration(entries);

  const allFindings = [
    ...rateAnomalies,
    ...offHours,
    ...velocityAnomalies,
    ...multiActorBursts,
    ...escalationChains,
    ...repeatedFailures,
    ...sessionDrift,
    ...categoryConcentration,
  ].sort((a, b) => {
    const sa = SEVERITY_NUMERIC[a.severity] ?? 0;
    const sb = SEVERITY_NUMERIC[b.severity] ?? 0;
    return sb - sa;
  });

  // Compute aggregate risk
  const riskScore = computeAggregateRisk(entries, allFindings, config);

  // Aggregate by type
  const byType = {};
  const bySeverity = {};
  for (const f of allFindings) {
    byType[f.type] = (byType[f.type] || 0) + 1;
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  }

  // Collect unique recommendations
  const recommendationSet = new Set();
  for (const f of allFindings) {
    const recs = RECOMMENDATIONS[f.type] || [];
    for (const r of recs) recommendationSet.add(r);
  }

  // Basic entry-level stats
  const entriesBySeverity = {};
  const entriesByCategory = {};
  const entriesByOutcome = {};
  for (const e of entries) {
    entriesBySeverity[e.severity] = (entriesBySeverity[e.severity] || 0) + 1;
    entriesByCategory[e.category] = (entriesByCategory[e.category] || 0) + 1;
    entriesByOutcome[e.outcome] = (entriesByOutcome[e.outcome] || 0) + 1;
  }

  return {
    timestamp: new Date().toISOString(),
    entryCount: entries.length,
    timeRange: {
      from: entries.reduce((min, e) => e.timestamp < min ? e.timestamp : min, entries[0].timestamp),
      to: entries.reduce((max, e) => e.timestamp > max ? e.timestamp : max, entries[0].timestamp),
    },
    riskScore,
    findings: allFindings,
    summary: {
      totalFindings: allFindings.length,
      byType,
      bySeverity,
    },
    entryStats: {
      bySeverity: entriesBySeverity,
      byCategory: entriesByCategory,
      byOutcome: entriesByOutcome,
    },
    recommendations: [...recommendationSet],
  };
}

// ─── Real-time Analysis Engine ──────────────────────────────────────────────

/**
 * Create a streaming analysis engine that maintains rolling windows
 * and emits findings as new entries arrive.
 *
 * @param {object} [config]
 * @returns {{ addEntry, getFindings, getRiskScore, getReport, reset }}
 */
export function createStreamingEngine(config = DEFAULT_CONFIG) {
  let buffer = [];
  let cachedFindings = null;
  let cachedReport = null;

  function addEntry(entry) {
    buffer.push(entry);
    // Keep buffer bounded
    if (buffer.length > 2000) {
      buffer = buffer.slice(-1500);
    }
    // Invalidate caches
    cachedFindings = null;
    cachedReport = null;
  }

  function getFindings() {
    if (!cachedFindings) {
      const { anomalies } = detectRateAnomalies(buffer, config);
      cachedFindings = [
        ...anomalies,
        ...detectOffHoursActivity(buffer, config),
        ...detectActorVelocityAnomalies(buffer, config),
        ...detectMultiActorBursts(buffer, config),
        ...detectEscalationChains(buffer, config),
        ...detectRepeatedFailures(buffer),
        ...detectSessionDrift(buffer, config),
        ...detectCategoryConcentration(buffer),
      ].sort((a, b) => (SEVERITY_NUMERIC[b.severity] ?? 0) - (SEVERITY_NUMERIC[a.severity] ?? 0));
    }
    return cachedFindings;
  }

  function getRiskScore() {
    return computeAggregateRisk(buffer, getFindings(), config);
  }

  function getReport() {
    if (!cachedReport) {
      cachedReport = generateReport(buffer, config);
    }
    return cachedReport;
  }

  function reset() {
    buffer = [];
    cachedFindings = null;
    cachedReport = null;
  }

  return { addEntry, getFindings, getRiskScore, getReport, reset, get buffer() { return buffer; } };
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3600_000) return `${(ms / 60_000).toFixed(0)}m`;
  if (ms < 86400_000) return `${(ms / 3600_000).toFixed(1)}h`;
  return `${(ms / 86400_000).toFixed(1)}d`;
}
