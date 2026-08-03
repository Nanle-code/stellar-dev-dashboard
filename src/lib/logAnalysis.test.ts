import { describe, it, expect } from 'vitest';
import {
  analyzeLogs,
  type LogEntry,
  type LogLevel,
} from './logAnalysis';

// Helper to create log entries
function createLog(
  id: string,
  level: LogLevel,
  message: string,
  timestamp = new Date(),
): LogEntry {
  return {
    id,
    timestamp,
    level,
    message,
  };
}

describe('logAnalysis', () => {
  describe('analyzeLogs', () => {
    it('returns empty insight for empty input', () => {
      const result = analyzeLogs([]);
      expect(result.totalLogs).toBe(0);
      expect(result.issuesFound).toBe(0);
      expect(result.errorRate).toBe(0);
      expect(result.topIssues).toHaveLength(0);
      expect(result.patterns).toHaveLength(0);
      expect(result.summary).toBe('No logs to analyze.');
    });

    it('detects connection errors', () => {
      const logs = [
        createLog('1', 'ERROR', 'Connection refused to database'),
        createLog('2', 'ERROR', 'Connection timeout occurred'),
        createLog('3', 'ERROR', 'Connection reset by peer'),
        createLog('4', 'INFO', 'System running'),
      ];

      const result = analyzeLogs(logs);

      expect(result.totalLogs).toBe(4);
      expect(result.topIssues.length).toBeGreaterThan(0);
      const connectionIssue = result.topIssues.find((i) => i.title === 'Connection Failure');
      expect(connectionIssue).toBeDefined();
      expect(connectionIssue?.occurrences).toBe(3);
      expect(connectionIssue?.severity).toBe('high');
      expect(connectionIssue?.category).toBe('error');
    });

    it('calculates correct error rate', () => {
      const logs = [
        createLog('1', 'ERROR', 'Something failed'),
        createLog('2', 'ERROR', 'Another error'),
        createLog('3', 'INFO', 'Running fine'),
        createLog('4', 'INFO', 'All good'),
        createLog('5', 'WARN', 'Warning here'),
      ];

      const result = analyzeLogs(logs);
      expect(result.errorRate).toBe(40); // 2 errors out of 5 logs
    });

    it('identifies anomalous patterns (>30% frequency)', () => {
      const logs = [
        createLog('1', 'INFO', 'Request processed'),
        createLog('2', 'INFO', 'Request processed'),
        createLog('3', 'INFO', 'Request processed'),
        createLog('4', 'INFO', 'Request processed'),
        createLog('5', 'ERROR', 'Timeout occurred'),
      ];

      const result = analyzeLogs(logs);
      const anomalyPattern = result.patterns.find((p) => p.isAnomaly);
      expect(anomalyPattern).toBeDefined();
      expect(anomalyPattern?.frequency).toBeGreaterThan(1);
    });

    it('generates recommendations for high error rate', () => {
      const logs = Array.from({ length: 100 }, (_, i) =>
        i < 25
          ? createLog(String(i), 'ERROR', 'Error message')
          : createLog(String(i), 'INFO', 'Info message'),
      );

      const result = analyzeLogs(logs);
      expect(result.errorRate).toBe(25);
      expect(result.recommendations.some((r) => r.includes('High error rate'))).toBe(true);
    });

    it('sorts issues by severity', () => {
      const logs = [
        createLog('1', 'ERROR', 'Out of memory issue'),
        createLog('2', 'ERROR', 'Timeout occurred'),
        createLog('3', 'ERROR', 'Unauthorized access'),
        createLog('4', 'INFO', 'Normal operation'),
      ];

      const result = analyzeLogs(logs);
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      for (let i = 0; i < result.topIssues.length - 1; i++) {
        const current = severityOrder[result.topIssues[i]!.severity];
        const next = severityOrder[result.topIssues[i + 1]!.severity];
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('detects memory issues as critical', () => {
      const logs = [
        createLog('1', 'ERROR', 'Out of memory error'),
        createLog('2', 'INFO', 'Running'),
      ];

      const result = analyzeLogs(logs);
      const memoryIssue = result.topIssues.find((i) => i.title === 'Memory Issue');
      expect(memoryIssue).toBeDefined();
      expect(memoryIssue?.severity).toBe('critical');
    });

    it('detects security issues', () => {
      const logs = [
        createLog('1', 'ERROR', 'Unauthorized user access'),
        createLog('2', 'ERROR', 'Forbidden resource'),
        createLog('3', 'ERROR', 'SSL certificate error'),
        createLog('4', 'INFO', 'Normal'),
      ];

      const result = analyzeLogs(logs);
      const securityIssues = result.topIssues.filter((i) => i.category === 'security');
      expect(securityIssues.length).toBeGreaterThan(0);
      expect(securityIssues.some((i) => i.title === 'Auth Failure')).toBe(true);
    });

    it('detects database errors', () => {
      const logs = [
        createLog('1', 'ERROR', 'Database connection failed'),
        createLog('2', 'ERROR', 'SQL query error'),
        createLog('3', 'INFO', 'Normal'),
      ];

      const result = analyzeLogs(logs);
      const dbIssue = result.topIssues.find((i) => i.title === 'Database Error');
      expect(dbIssue).toBeDefined();
      expect(dbIssue?.category).toBe('error');
    });

    it('identifies null reference errors', () => {
      const logs = [
        createLog('1', 'ERROR', 'null pointer exception'),
        createLog('2', 'ERROR', 'undefined is not a function'),
        createLog('3', 'INFO', 'Normal'),
      ];

      const result = analyzeLogs(logs);
      const nullIssue = result.topIssues.find((i) => i.title === 'Null Reference');
      expect(nullIssue).toBeDefined();
      expect(nullIssue?.severity).toBe('medium');
    });

    it('detects rate limiting issues', () => {
      const logs = [
        createLog('1', 'ERROR', 'rate limit exceeded'),
        createLog('2', 'ERROR', 'too many requests'),
        createLog('3', 'ERROR', '429 error'),
        createLog('4', 'INFO', 'Normal'),
      ];

      const result = analyzeLogs(logs);
      const rateLimitIssue = result.topIssues.find((i) => i.title === 'Rate Limit');
      expect(rateLimitIssue).toBeDefined();
      expect(rateLimitIssue?.category).toBe('performance');
    });

    it('generates appropriate suggestion for each issue type', () => {
      const logs = [
        createLog('1', 'ERROR', 'Connection timeout'),
        createLog('2', 'INFO', 'Normal'),
      ];

      const result = analyzeLogs(logs);
      expect(result.topIssues[0]?.suggestion).toContain('retry');
    });

    it('limits to top 5 issues', () => {
      const logs = [
        createLog('1', 'ERROR', 'Connection refused'),
        createLog('2', 'ERROR', 'Out of memory'),
        createLog('3', 'ERROR', 'Unauthorized'),
        createLog('4', 'ERROR', 'null pointer'),
        createLog('5', 'ERROR', 'Timeout'),
        createLog('6', 'ERROR', 'Rate limit'),
        createLog('7', 'ERROR', 'Database error'),
        createLog('8', 'INFO', 'Normal'),
      ];

      const result = analyzeLogs(logs);
      expect(result.topIssues.length).toBeLessThanOrEqual(5);
    });

    it('limits to top 10 patterns', () => {
      const logs = Array.from({ length: 20 }, (_, i) => {
        const message =
          i % 2 === 0
            ? 'Pattern A'
            : i % 3 === 0
              ? 'Pattern B'
              : i % 5 === 0
                ? 'Pattern C'
                : 'Pattern D';
        return createLog(String(i), 'INFO', message);
      });

      const result = analyzeLogs(logs);
      expect(result.patterns.length).toBeLessThanOrEqual(10);
    });

    it('normalizes timestamps in patterns', () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 86400000);
      const logs = [
        createLog('1', 'INFO', `${now.toISOString()} Request processed`),
        createLog('2', 'INFO', `${tomorrow.toISOString()} Request processed`),
        createLog('3', 'INFO', 'Request processed'),
      ];

      const result = analyzeLogs(logs);
      // Timestamps should be normalized, so pattern should be recognized
      const requestPattern = result.patterns.find((p) =>
        p.pattern.includes('Request processed'),
      );
      expect(requestPattern).toBeDefined();
    });

    it('critical error recommendation with >10% error rate', () => {
      const logs = Array.from({ length: 20 }, (_, i) =>
        i < 3
          ? createLog(String(i), 'FATAL', 'Critical failure')
          : createLog(String(i), 'INFO', 'OK'),
      );

      const result = analyzeLogs(logs);
      expect(result.recommendations.some((r) => r.includes('Critical'))).toBe(true);
    });
  });
});
