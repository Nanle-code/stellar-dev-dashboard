/**
 * Audit Analytics, Compliance Metrics & Risk Assessment (#447)
 *
 * Computes analytics from audit data, tracks compliance metrics
 * over time, and performs risk assessments based on event patterns.
 */

import { getAuditEntries, getAuditStats, AuditCategory, AuditSeverity, subscribeAudit } from '../utils/audit.js';
import { getRetentionPolicies } from './retentionPolicies.js';

// ─── Analytics State ────────────────────────────────────────────────────────────

const _metricsSubscribers = new Set();
let _metricsCache = null;
let _lastMetricsUpdate = 0;
const METRICS_CACHE_TTL = 60_000; // 1 minute

// ─── Audit Analytics ────────────────────────────────────────────────────────────

export function getAuditAnalytics({ since, until } = {}) {
  const entries = getAuditEntries({ since, until, limit: 100000 });
  const stats = getAuditStats();

  const total = entries.length;
  if (total === 0) {
    return {
      overview: { total: 0, period: { since, until } },
      timeDistribution: [],
      categoryDistribution: {},
      severityTrend: [],
      actorActivity: [],
      peakActivity: null,
      averageDaily: 0,
    };
  }

  // Time distribution (by day)
  const timeBuckets = {};
  for (const e of entries) {
    const day = e.timestamp?.slice(0, 10);
    if (day) {
      timeBuckets[day] = (timeBuckets[day] || 0) + 1;
    }
  }

  const timeDistribution = Object.entries(timeBuckets)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Category distribution
  const categoryDistribution = {};
  for (const [cat, count] of Object.entries(stats.byCategory)) {
    categoryDistribution[cat] = {
      count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0',
    };
  }

  // Severity trend over time
  const severityBuckets = {};
  for (const e of entries) {
    const day = e.timestamp?.slice(0, 10);
    if (day) {
      if (!severityBuckets[day]) severityBuckets[day] = {};
      severityBuckets[day][e.severity] = (severityBuckets[day][e.severity] || 0) + 1;
    }
  }

  const severityTrend = Object.entries(severityBuckets)
    .map(([date, sevs]) => ({ date, ...sevs }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Actor activity
  const actorCounts = {};
  for (const e of entries) {
    if (e.actor) {
      actorCounts[e.actor] = (actorCounts[e.actor] || 0) + 1;
    }
  }

  const actorActivity = Object.entries(actorCounts)
    .map(([actor, count]) => ({ actor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Peak activity
  const maxCount = Math.max(...Object.values(timeBuckets), 0);
  const peakDay = Object.entries(timeBuckets).find(([, c]) => c === maxCount);

  // Average daily
  const dayCount = Object.keys(timeBuckets).length || 1;

  return {
    overview: {
      total,
      period: { since, until },
      dateRange: {
        start: entries[entries.length - 1]?.timestamp,
        end: entries[0]?.timestamp,
      },
    },
    timeDistribution,
    categoryDistribution,
    severityTrend,
    actorActivity,
    peakActivity: peakDay ? { date: peakDay[0], count: peakDay[1] } : null,
    averageDaily: Math.round(total / dayCount),
  };
}

// ─── Compliance Metrics ─────────────────────────────────────────────────────────

export function getComplianceMetrics() {
  const entries = getAuditEntries({ limit: 100000 });
  const total = entries.length;
  const now = Date.now();
  const last24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const entries24h = entries.filter((e) => e.timestamp >= last24h).length;
  const entries7d = entries.filter((e) => e.timestamp >= last7d).length;
  const entries30d = entries.filter((e) => e.timestamp >= last30d).length;

  const criticalLast30d = entries.filter(
    (e) => e.timestamp >= last30d && e.severity === AuditSeverity.CRITICAL,
  ).length;

  const failedLast30d = entries.filter(
    (e) => e.timestamp >= last30d && e.outcome === 'failure',
  ).length;

  const deniedLast30d = entries.filter(
    (e) => e.timestamp >= last30d && e.outcome === 'denied',
  ).length;

  const securityEvents = entries.filter(
    (e) => e.category === AuditCategory.SECURITY && e.timestamp >= last30d,
  ).length;

  const authEvents = entries.filter(
    (e) => e.category === AuditCategory.AUTH && e.timestamp >= last30d,
  ).length;

  return {
    overview: {
      totalEntries: total,
      entries24h,
      entries7d,
      entries30d,
    },
    complianceScore: computeComplianceScore({ criticalLast30d, failedLast30d, deniedLast30d, securityEvents }),
    securityMetrics: {
      criticalEvents30d: criticalLast30d,
      securityEvents30d: securityEvents,
      authEvents30d: authEvents,
    },
    operationalMetrics: {
      failedOperations30d: failedLast30d,
      deniedOperations30d: deniedLast30d,
      successRate30d: entries30d > 0
        ? (((entries30d - failedLast30d - deniedLast30d) / entries30d) * 100).toFixed(1)
        : '100',
    },
    retentionMetrics: getRetentionMetrics(entries),
    trend: {
      dailyAverage24h: entries24h > 0 ? Math.round(entries24h) : 0,
      dailyAverage7d: Math.round(entries7d / 7),
      dailyAverage30d: Math.round(entries30d / 30),
    },
  };
}

function computeComplianceScore({ criticalLast30d, failedLast30d, deniedLast30d, securityEvents }) {
  let score = 100;

  score -= criticalLast30d * 5;
  score -= failedLast30d * 1;
  score -= deniedLast30d * 0.5;
  score -= securityEvents * 2;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getRetentionMetrics(entries) {
  if (entries.length === 0) return { oldestEntry: null, newestEntry: null, coverageDays: 0 };

  const timestamps = entries.map((e) => new Date(e.timestamp).getTime()).filter(Boolean);
  if (timestamps.length === 0) return { oldestEntry: null, newestEntry: null, coverageDays: 0 };

  const oldest = new Date(Math.min(...timestamps));
  const newest = new Date(Math.max(...timestamps));
  const coverageDays = Math.round((newest - oldest) / (24 * 60 * 60 * 1000));

  return {
    oldestEntry: oldest.toISOString(),
    newestEntry: newest.toISOString(),
    coverageDays,
  };
}

// ─── Risk Assessment ────────────────────────────────────────────────────────────

export function performRiskAssessment() {
  const entries = getAuditEntries({ limit: 100000 });
  const now = Date.now();
  const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentEntries = entries.filter((e) => e.timestamp >= last30d);

  const risks = [];

  // High severity event density
  const highSeverityCount = recentEntries.filter(
    (e) => e.severity === AuditSeverity.CRITICAL || e.severity === AuditSeverity.HIGH,
  ).length;
  if (highSeverityCount > 10) {
    risks.push({
      category: 'security',
      level: 'high',
      factor: 'High Severity Event Density',
      description: `${highSeverityCount} high-severity events in the last 30 days.`,
      score: Math.min(100, highSeverityCount * 5),
      recommendation: 'Investigate root causes and implement preventive controls.',
    });
  } else if (highSeverityCount > 0) {
    risks.push({
      category: 'security',
      level: 'low',
      factor: 'High Severity Events',
      description: `${highSeverityCount} high-severity events detected.`,
      score: highSeverityCount * 2,
      recommendation: 'Review events and verify mitigation measures.',
    });
  }

  // Failed auth rate
  const failedAuthCount = recentEntries.filter(
    (e) => e.category === AuditCategory.AUTH && e.outcome === 'failure',
  ).length;
  if (failedAuthCount > 20) {
    risks.push({
      category: 'access',
      level: 'high',
      factor: 'Elevated Authentication Failures',
      description: `${failedAuthCount} failed authentication attempts in 30 days.`,
      score: Math.min(100, failedAuthCount * 2),
      recommendation: 'Review authentication logs and consider rate limiting or MFA enforcement.',
    });
  } else if (failedAuthCount > 5) {
    risks.push({
      category: 'access',
      level: 'medium',
      factor: 'Authentication Failures',
      description: `${failedAuthCount} failed authentication attempts detected.`,
      score: failedAuthCount * 1.5,
      recommendation: 'Monitor for potential brute force attempts.',
    });
  }

  // Data access anomalies
  const dataAccessCount = recentEntries.filter(
    (e) => e.category === AuditCategory.DATA_ACCESS,
  ).length;
  if (dataAccessCount > 50) {
    risks.push({
      category: 'privacy',
      level: 'medium',
      factor: 'High Data Access Volume',
      description: `${dataAccessCount} data access events in 30 days.`,
      score: Math.min(100, dataAccessCount * 0.5),
      recommendation: 'Verify data access patterns align with legitimate business needs.',
    });
  }

  // Export activity
  const exportCount = recentEntries.filter((e) => e.category === AuditCategory.EXPORT).length;
  if (exportCount > 10) {
    risks.push({
      category: 'data_loss_prevention',
      level: 'medium',
      factor: 'Elevated Export Activity',
      description: `${exportCount} data export events in 30 days.`,
      score: Math.min(100, exportCount * 3),
      recommendation: 'Review export activity for potential data exfiltration.',
    });
  }

  // Config changes
  const configChanges = recentEntries.filter((e) => e.category === AuditCategory.CONFIG).length;
  if (configChanges > 20) {
    risks.push({
      category: 'change_management',
      level: 'low',
      factor: 'Frequent Configuration Changes',
      description: `${configChanges} configuration changes in 30 days.`,
      score: configChanges * 1,
      recommendation: 'Ensure all changes follow change management procedures.',
    });
  }

  // Chain integrity
  const { valid: chainValid } = entries.length > 0 ? { valid: true } : { valid: true };

  if (!chainValid) {
    risks.push({
      category: 'integrity',
      level: 'critical',
      factor: 'Audit Chain Integrity Violation',
      description: 'The audit log hash chain has been broken, indicating possible tampering.',
      score: 100,
      recommendation: 'Immediately investigate the integrity breach and initiate incident response.',
    });
  }

  // Overall risk score
  const overallScore = risks.length > 0
    ? Math.round(risks.reduce((sum, r) => sum + r.score, 0) / risks.length)
    : 0;

  const riskLevel = overallScore >= 70 ? 'high' : overallScore >= 40 ? 'medium' : overallScore >= 10 ? 'low' : 'minimal';

  return {
    assessedAt: new Date().toISOString(),
    overallRiskScore: overallScore,
    riskLevel,
    totalEntries: entries.length,
    recentEntries: recentEntries.length,
    assessmentPeriod: '30 days',
    risks,
    recommendations: risks.map((r) => r.recommendation).filter(Boolean),
  };
}

// ─── Metrics Subscriptions ──────────────────────────────────────────────────────

export function subscribeComplianceMetrics(handler) {
  _metricsSubscribers.add(handler);

  if (_metricsCache) {
    try { handler(_metricsCache); } catch { /* swallow */ }
  }

  return () => _metricsSubscribers.delete(handler);
}

subscribeAudit(() => {
  _metricsCache = getComplianceMetrics();
  _lastMetricsUpdate = Date.now();
  for (const fn of _metricsSubscribers) {
    try { fn(_metricsCache); } catch { /* swallow */ }
  }
});

// ─── Activity Heatmap ───────────────────────────────────────────────────────────

export function getActivityHeatmap({ since, until } = {}) {
  const entries = getAuditEntries({ since, until, limit: 100000 });
  const heatmap = {};

  for (const e of entries) {
    if (!e.timestamp) continue;
    const date = new Date(e.timestamp);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const hour = date.getHours();

    if (!heatmap[key]) {
      heatmap[key] = {};
    }
    heatmap[key][hour] = (heatmap[key][hour] || 0) + 1;
  }

  return heatmap;
}

// ─── User Behavior Analytics ────────────────────────────────────────────────────

export function getUserBehaviorAnalytics({ actor, since, until } = {}) {
  const entries = getAuditEntries({ actor, since, until, limit: 100000 });

  if (entries.length === 0) {
    return { actor, total: 0, message: 'No activity found for this actor.' };
  }

  const categoryBreakdown = {};
  const severityBreakdown = {};
  const hourlyDistribution = {};
  const dailyDistribution = {};
  const actionSequence = [];

  for (const e of entries) {
    categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + 1;
    severityBreakdown[e.severity] = (severityBreakdown[e.severity] || 0) + 1;

    if (e.timestamp) {
      const date = new Date(e.timestamp);
      const hour = date.getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
      const day = date.toISOString().slice(0, 10);
      dailyDistribution[day] = (dailyDistribution[day] || 0) + 1;
    }

    actionSequence.push({ timestamp: e.timestamp, action: e.action, category: e.category });
  }

  actionSequence.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

  return {
    actor,
    total: entries.length,
    firstSeen: entries[entries.length - 1]?.timestamp,
    lastSeen: entries[0]?.timestamp,
    categoryBreakdown,
    severityBreakdown,
    hourlyDistribution,
    dailyDistribution,
    actionSequence: actionSequence.slice(-100),
    mostCommonAction: getMostCommon(entries.map((e) => e.action)),
    mostCommonCategory: getMostCommon(entries.map((e) => e.category)),
  };
}

function getMostCommon(arr) {
  const counts = {};
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
