/**
 * Intelligent Log Analysis System
 * Analyzes application logs to identify issues, patterns, and optimization opportunities.
 * Uses NLP and anomaly detection to generate actionable insights.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
export type IssueCategory = 'error' | 'performance' | 'security' | 'pattern' | 'anomaly';
export type InsightSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface LogIssue {
  id: string;
  category: IssueCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  affectedLogs: string[]; // log entry IDs
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  suggestion: string;
}

export interface LogPattern {
  pattern: string;
  frequency: number;
  percentage: number;
  examples: string[];
  isAnomaly: boolean;
}

export interface LogInsight {
  summary: string;
  totalLogs: number;
  issuesFound: number;
  errorRate: number;
  topIssues: LogIssue[];
  patterns: LogPattern[];
  recommendations: string[];
  analysisTimestamp: Date;
}

// Common error patterns for NLP matching
const ERROR_PATTERNS = [
  {
    regex: /connection (refused|timeout|reset)/i,
    category: 'error' as IssueCategory,
    severity: 'high' as InsightSeverity,
    title: 'Connection Failure',
  },
  {
    regex: /out of memory|heap|oom/i,
    category: 'performance' as IssueCategory,
    severity: 'critical' as InsightSeverity,
    title: 'Memory Issue',
  },
  {
    regex: /unauthorized|forbidden|401|403/i,
    category: 'security' as IssueCategory,
    severity: 'high' as InsightSeverity,
    title: 'Auth Failure',
  },
  {
    regex: /null (pointer|reference)|undefined is not/i,
    category: 'error' as IssueCategory,
    severity: 'medium' as InsightSeverity,
    title: 'Null Reference',
  },
  {
    regex: /timeout|timed out/i,
    category: 'performance' as IssueCategory,
    severity: 'medium' as InsightSeverity,
    title: 'Timeout',
  },
  {
    regex: /rate limit|too many requests|429/i,
    category: 'performance' as IssueCategory,
    severity: 'medium' as InsightSeverity,
    title: 'Rate Limit',
  },
  {
    regex: /database|db|sql|query/i,
    category: 'error' as IssueCategory,
    severity: 'high' as InsightSeverity,
    title: 'Database Error',
  },
  {
    regex: /ssl|tls|certificate/i,
    category: 'security' as IssueCategory,
    severity: 'high' as InsightSeverity,
    title: 'SSL/TLS Issue',
  },
];

/**
 * Analyzes a set of log entries and returns structured insights.
 * Implements NLP pattern matching and anomaly detection.
 * Targets 80%+ identification of log-relevant issues.
 */
export function analyzeLogs(logs: LogEntry[]): LogInsight {
  if (logs.length === 0) {
    return {
      summary: 'No logs to analyze.',
      totalLogs: 0,
      issuesFound: 0,
      errorRate: 0,
      topIssues: [],
      patterns: [],
      recommendations: [],
      analysisTimestamp: new Date(),
    };
  }

  const errorLogs = logs.filter((l) => l.level === 'ERROR' || l.level === 'FATAL');
  const errorRate = (errorLogs.length / logs.length) * 100;

  // Pattern recognition
  const issueMap = new Map<string, LogIssue>();
  for (const log of logs) {
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.regex.test(log.message)) {
        const key = pattern.title;
        if (issueMap.has(key)) {
          const issue = issueMap.get(key)!;
          issue.occurrences++;
          issue.affectedLogs.push(log.id);
          if (log.timestamp > issue.lastSeen) issue.lastSeen = log.timestamp;
          if (log.timestamp < issue.firstSeen) issue.firstSeen = log.timestamp;
        } else {
          issueMap.set(key, {
            id: crypto.randomUUID(),
            category: pattern.category,
            severity: pattern.severity,
            title: pattern.title,
            description: `Detected ${pattern.title} in log messages`,
            affectedLogs: [log.id],
            occurrences: 1,
            firstSeen: log.timestamp,
            lastSeen: log.timestamp,
            suggestion: getSuggestion(pattern.title),
          });
        }
      }
    }
  }

  // Frequency pattern analysis
  const messageFrequency = new Map<string, number>();
  for (const log of logs) {
    const normalized = normalizeMessage(log.message);
    messageFrequency.set(normalized, (messageFrequency.get(normalized) ?? 0) + 1);
  }

  const patterns: LogPattern[] = Array.from(messageFrequency.entries())
    .filter(([, count]) => count > 1)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([pattern, frequency]) => ({
      pattern,
      frequency,
      percentage: (frequency / logs.length) * 100,
      examples: logs
        .filter((l) => normalizeMessage(l.message) === pattern)
        .slice(0, 3)
        .map((l) => l.message),
      isAnomaly: frequency > logs.length * 0.3, // >30% = anomaly
    }));

  const topIssues = Array.from(issueMap.values())
    .sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    })
    .slice(0, 5);

  const recommendations = generateRecommendations(topIssues, errorRate, patterns);

  return {
    summary: generateSummary(logs.length, topIssues.length, errorRate),
    totalLogs: logs.length,
    issuesFound: issueMap.size,
    errorRate: Math.round(errorRate * 100) / 100,
    topIssues,
    patterns,
    recommendations,
    analysisTimestamp: new Date(),
  };
}

function normalizeMessage(message: string): string {
  return message
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '<timestamp>')
    .replace(/\b\d+\b/g, '<number>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .substring(0, 100);
}

function getSuggestion(issueTitle: string): string {
  const suggestions: Record<string, string> = {
    'Connection Failure':
      'Check network connectivity and service health. Consider implementing retry logic with exponential backoff.',
    'Memory Issue':
      'Review memory allocation patterns. Consider increasing heap size or optimizing data structures.',
    'Auth Failure':
      'Review authentication configuration and token expiry. Check for credential rotation issues.',
    'Null Reference':
      'Add null checks and defensive programming. Review data validation at boundaries.',
    Timeout: 'Increase timeout thresholds or optimize slow operations. Consider async processing.',
    'Rate Limit':
      'Implement request queuing and throttling. Consider caching frequently requested data.',
    'Database Error':
      'Check database connectivity and query performance. Review connection pool settings.',
    'SSL/TLS Issue': 'Verify certificate validity and chain. Check TLS version compatibility.',
  };

  return suggestions[issueTitle] ?? 'Investigate and address the root cause of this issue.';
}

function generateRecommendations(
  issues: LogIssue[],
  errorRate: number,
  patterns: LogPattern[],
): string[] {
  const recs: string[] = [];

  if (errorRate > 10) {
    recs.push(`High error rate (${errorRate.toFixed(1)}%) detected. Prioritize error resolution.`);
  }

  if (issues.some((i) => i.severity === 'critical')) {
    recs.push('Critical issues detected. Immediate attention required.');
  }

  if (patterns.some((p) => p.isAnomaly)) {
    recs.push('Anomalous log patterns detected. Investigate unusual activity.');
  }

  if (issues.some((i) => i.category === 'security')) {
    recs.push('Security-related issues found. Review access controls and auth configuration.');
  }

  if (recs.length === 0) {
    recs.push('Log health looks good. Continue monitoring for emerging patterns.');
  }

  return recs;
}

function generateSummary(total: number, issues: number, errorRate: number): string {
  if (errorRate > 20) {
    return `Critical: High error rate of ${errorRate.toFixed(1)}% across ${total} logs. ${issues} issue types identified.`;
  }
  if (errorRate > 5) {
    return `Warning: Elevated error rate of ${errorRate.toFixed(1)}% across ${total} logs. ${issues} issue types identified.`;
  }
  return `Analysis complete: ${total} logs analyzed, ${issues} issue types found, error rate ${errorRate.toFixed(1)}%.`;
}
