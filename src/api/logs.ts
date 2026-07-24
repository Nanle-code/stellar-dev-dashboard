/**
 * Log Analysis API
 * Provides client-side utilities for log analysis
 */

import { analyzeLogs, type LogEntry, type LogInsight } from '../lib/logAnalysis';

/**
 * Analyze logs on the client side
 * Returns structured insights about log entries
 */
export async function analyzeLogsAPI(logs: LogEntry[]): Promise<LogInsight> {
  // Client-side analysis - no server required
  return new Promise((resolve) => {
    // Simulate async operation
    setTimeout(() => {
      resolve(analyzeLogs(logs));
    }, 100);
  });
}

/**
 * Export analysis results as JSON
 */
export function exportAnalysisAsJSON(insight: LogInsight, filename = 'log-analysis.json'): void {
  const json = JSON.stringify(insight, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export analysis results as CSV
 */
export function exportAnalysisAsCSV(insight: LogInsight, filename = 'log-analysis.csv'): void {
  const rows: string[] = [];

  // Header
  rows.push('Log Analysis Report');
  rows.push(`Generated: ${insight.analysisTimestamp.toISOString()}`);
  rows.push('');

  // Summary
  rows.push('SUMMARY');
  rows.push(`Total Logs,${insight.totalLogs}`);
  rows.push(`Error Rate (%),${insight.errorRate}`);
  rows.push(`Issues Found,${insight.issuesFound}`);
  rows.push(`Patterns Found,${insight.patterns.length}`);
  rows.push('');

  // Top Issues
  rows.push('TOP ISSUES');
  rows.push('Title,Category,Severity,Occurrences,FirstSeen,LastSeen,Suggestion');
  insight.topIssues.forEach((issue) => {
    rows.push(
      `"${issue.title}","${issue.category}","${issue.severity}",${issue.occurrences},"${issue.firstSeen.toISOString()}","${issue.lastSeen.toISOString()}","${issue.suggestion.replace(/"/g, '""')}"`,
    );
  });
  rows.push('');

  // Patterns
  rows.push('PATTERNS');
  rows.push('Pattern,Frequency,Percentage (%),IsAnomaly');
  insight.patterns.forEach((pattern) => {
    rows.push(
      `"${pattern.pattern}",${pattern.frequency},${pattern.percentage.toFixed(2)},${pattern.isAnomaly}`,
    );
  });
  rows.push('');

  // Recommendations
  rows.push('RECOMMENDATIONS');
  insight.recommendations.forEach((rec) => {
    rows.push(`"${rec.replace(/"/g, '""')}"`);
  });

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
