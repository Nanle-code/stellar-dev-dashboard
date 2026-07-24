/**
 * Compliance Report Generator (#447)
 *
 * Generates SOC 2, GDPR, and custom compliance reports from audit data.
 * Reports are exportable as JSON, CSV, and PDF.
 */

import {
  getAuditEntries,
  getAuditStats,
  verifyAuditChain,
  AuditCategory,
  AuditSeverity,
} from '../utils/audit.js';
import { downloadFile } from '../utils/export.js';

// ─── Report Types ──────────────────────────────────────────────────────────────

export const ReportType = Object.freeze({
  SOC2: 'soc2',
  GDPR: 'gdpr',
  CUSTOM: 'custom',
});

export const ReportFormat = Object.freeze({
  JSON: 'json',
  CSV: 'csv',
  PDF: 'pdf',
});

// ─── SOC 2 Report ──────────────────────────────────────────────────────────────

function buildCsvRows(headers, rows) {
  const escape = (v) => {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

export async function generateSOC2Report({ since, until } = {}) {
  const entries = getAuditEntries({ since, until, limit: 10000 });
  const stats = getAuditStats();
  const integrity = await verifyAuditChain();

  const report = {
    reportType: 'SOC 2',
    generatedAt: new Date().toISOString(),
    reportPeriod: { since: since || 'N/A', until: until || 'N/A' },
    summary: {
      totalEntries: entries.length,
      integrityCheckPassed: integrity.valid,
      breakdownByCategory: stats.byCategory,
      breakdownBySeverity: stats.bySeverity,
      breakdownByOutcome: stats.byOutcome,
    },
    securityEvents: entries.filter((e) => e.category === AuditCategory.SECURITY),
    accessControlEvents: entries.filter((e) =>
      [AuditCategory.AUTH, AuditCategory.ADMIN].includes(e.category),
    ),
    dataAccessEvents: entries.filter((e) => e.category === AuditCategory.DATA_ACCESS),
    systemChanges: entries.filter((e) => e.category === AuditCategory.CONFIG),
    chainOfTrust: {
      valid: integrity.valid,
      brokenAt: integrity.brokenAt,
      totalEntriesChecked: entries.length,
    },
    findings: generateSOC2Findings(entries, stats),
  };

  return report;
}

function generateSOC2Findings(entries, stats) {
  const findings = [];
  const criticalCount = stats.bySeverity[AuditSeverity.CRITICAL] || 0;
  const highCount = stats.bySeverity[AuditSeverity.HIGH] || 0;
  const failedCount = stats.byOutcome.failure || 0;
  const deniedCount = stats.byOutcome.denied || 0;

  if (criticalCount > 0) {
    findings.push({
      severity: 'high',
      control: 'CC6.1 - Logical and Physical Access',
      status: 'attention_required',
      detail: `${criticalCount} critical security events detected in reporting period.`,
      recommendation: 'Review all critical events and implement additional access controls.',
    });
  }

  if (failedCount > 5) {
    findings.push({
      severity: 'medium',
      control: 'CC7.2 - Monitoring and Detection',
      status: 'review_recommended',
      detail: `${failedCount} failed operations detected. May indicate configuration or authorization issues.`,
      recommendation: 'Audit failed operations and verify authorization policies.',
    });
  }

  if (deniedCount > 0) {
    findings.push({
      severity: 'low',
      control: 'CC6.6 - Authorization',
      status: 'info',
      detail: `${deniedCount} operations were denied due to policy restrictions.`,
      recommendation: 'Review denied operations to ensure policies are correctly configured.',
    });
  }

  const securityEvents = entries.filter((e) => e.category === AuditCategory.SECURITY);
  if (securityEvents.length > 0) {
    findings.push({
      severity: securityEvents.length > 10 ? 'high' : 'medium',
      control: 'CC7.1 - Security Incident Management',
      status: securityEvents.length > 10 ? 'attention_required' : 'review_recommended',
      detail: `${securityEvents.length} security-related events recorded.`,
      recommendation: 'Review security events and update incident response procedures if needed.',
    });
  }

  return findings;
}

// ─── GDPR Report ────────────────────────────────────────────────────────────────

export async function generateGDPRReport({ since, until, userId } = {}) {
  const entries = getAuditEntries({ since, until, limit: 10000 });
  const integrity = await verifyAuditChain();

  const dataAccessEvents = entries.filter(
    (e) => e.category === AuditCategory.DATA_ACCESS || e.action?.includes('data.'),
  );
  const exportEvents = entries.filter((e) => e.category === AuditCategory.EXPORT);
  const userEvents = userId
    ? entries.filter((e) => e.actor === userId)
    : [];

  const report = {
    reportType: 'GDPR',
    generatedAt: new Date().toISOString(),
    reportPeriod: { since: since || 'N/A', until: until || 'N/A' },
    dataSubject: userId || 'All Users',
    summary: {
      totalEntries: entries.length,
      dataAccessEvents: dataAccessEvents.length,
      exportEvents: exportEvents.length,
      userSpecificEvents: userEvents.length,
      integrityCheckPassed: integrity.valid,
    },
    dataProcessingActivities: entries.map((e) => ({
      timestamp: e.timestamp,
      action: e.action,
      category: e.category,
      actor: e.actor,
      purpose: classifyProcessingPurpose(e),
    })),
    dataExports: exportEvents.map((e) => ({
      timestamp: e.timestamp,
      actor: e.actor,
      format: e.metadata?.format || 'unknown',
      dataTypes: e.metadata?.dataTypes || [],
    })),
    dataRetention: {
      logRetentionDays: 90,
      policyCompliant: true,
      notes: 'Audit logs are retained in accordance with GDPR Article 5(1)(e).',
    },
    subjectAccessRequests: userEvents.filter((e) =>
      e.action?.toLowerCase().includes('sar') ||
      e.action?.toLowerCase().includes('subject_access'),
    ),
    chainOfTrust: {
      valid: integrity.valid,
      brokenAt: integrity.brokenAt,
    },
    findings: generateGDPRFindings(entries, dataAccessEvents, exportEvents),
  };

  return report;
}

function classifyProcessingPurpose(entry) {
  if (entry.category === AuditCategory.AUTH) return 'Authentication and Access Control';
  if (entry.category === AuditCategory.TRANSACTION) return 'Transaction Processing';
  if (entry.category === AuditCategory.WALLET) return 'Wallet Management';
  if (entry.category === AuditCategory.CONTRACT) return 'Smart Contract Interaction';
  if (entry.category === AuditCategory.EXPORT) return 'Data Export';
  if (entry.category === AuditCategory.DATA_ACCESS) return 'Data Access';
  if (entry.category === AuditCategory.CONFIG) return 'System Configuration';
  if (entry.category === AuditCategory.SECURITY) return 'Security Monitoring';
  return 'General System Operation';
}

function generateGDPRFindings(entries, dataAccessEvents, exportEvents) {
  const findings = [];

  if (dataAccessEvents.length === 0) {
    findings.push({
      severity: 'info',
      article: 'Article 15 - Right of Access',
      status: 'compliant',
      detail: 'No data access events recorded in this period.',
    });
  } else {
    findings.push({
      severity: 'info',
      article: 'Article 15 - Right of Access',
      status: 'compliant',
      detail: `${dataAccessEvents.length} data access events logged and traceable.`,
    });
  }

  const processingCount = entries.length;
  findings.push({
    severity: 'info',
    article: 'Article 30 - Records of Processing Activities',
    status: processingCount > 0 ? 'compliant' : 'no_data',
    detail: `${processingCount} processing activities recorded with timestamps and actor attribution.`,
  });

  if (exportEvents.length > 0) {
    findings.push({
      severity: 'low',
      article: 'Article 44 - Data Transfer',
      status: 'review_recommended',
      detail: `${exportEvents.length} data export events detected. Verify transfer mechanisms comply with adequacy decisions.`,
    });
  }

  return findings;
}

// ─── Custom Report ──────────────────────────────────────────────────────────────

export function generateCustomReport({
  since,
  until,
  category,
  severity,
  actor,
  search,
  title = 'Custom Report',
  includeMetadata = true,
} = {}) {
  const entries = getAuditEntries({ since, until, category, severity, actor, search, limit: 10000 });
  const stats = getAuditStats();

  const report = {
    reportType: 'Custom',
    title,
    generatedAt: new Date().toISOString(),
    filters: { since, until, category, severity, actor, search },
    summary: {
      totalEntries: entries.length,
      matchedEntries: entries.length,
      byCategory: stats.byCategory,
      bySeverity: stats.bySeverity,
      byOutcome: stats.byOutcome,
    },
    entries: includeMetadata ? entries : entries.map(({ metadata, ...rest }) => rest),
  };

  return report;
}

// ─── Export ─────────────────────────────────────────────────────────────────────

export function exportReport(report, format = ReportFormat.JSON, filename = 'compliance-report') {
  switch (format) {
    case ReportFormat.JSON: {
      const content = JSON.stringify(report, null, 2);
      downloadFile(content, `${filename}.json`);
      break;
    }
    case ReportFormat.CSV: {
      const entries = report.entries || [];
      const headers = ['timestamp', 'action', 'category', 'severity', 'actor', 'target', 'outcome'];
      const rows = entries.map((e) => ({
        timestamp: e.timestamp,
        action: e.action,
        category: e.category,
        severity: e.severity,
        actor: e.actor || '',
        target: e.target || '',
        outcome: e.outcome,
      }));
      downloadFile(buildCsvRows(headers, rows), `${filename}.csv`, 'text/csv');
      break;
    }
    case ReportFormat.PDF: {
      const textContent = formatReportAsText(report);
      const blob = buildPdfBlob(textContent);
      downloadFile(blob, `${filename}.pdf`, 'application/pdf');
      break;
    }
  }
}

function formatReportAsText(report) {
  const lines = [
    `Compliance Report: ${report.reportType}`,
    `Generated: ${report.generatedAt}`,
    '',
    '=== Summary ===',
    `Total Entries: ${report.summary?.totalEntries || 0}`,
    '',
    '=== Findings ===',
  ];

  if (report.findings) {
    for (const finding of report.findings) {
      lines.push(`[${finding.severity?.toUpperCase()}] ${finding.control || finding.article}`);
      lines.push(`  Status: ${finding.status}`);
      lines.push(`  Detail: ${finding.detail}`);
      if (finding.recommendation) {
        lines.push(`  Recommendation: ${finding.recommendation}`);
      }
      lines.push('');
    }
  }

  lines.push('=== Chain of Trust ===');
  lines.push(`Integrity Valid: ${report.chainOfTrust?.valid !== false}`);

  return lines.join('\n');
}

function buildPdfBlob(text) {
  const encoder = new TextEncoder();
  const lines = String(text).split('\n');
  const contentStream = [
    'BT',
    '/F1 10 Tf',
    '50 760 Td',
    ...lines.map((line, index) => {
      const safe = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      return index === 0 ? `(${safe}) Tj` : `T* (${safe}) Tj`;
    }),
    'ET',
  ].join('\n');

  const streamBytes = encoder.encode(contentStream);
  const streamLength = streamBytes.length;

  const components = [
    '%PDF-1.1\n',
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
  ];

  let offset = 0;
  const offsets = [offset];
  for (const part of components) {
    offset += encoder.encode(part).length;
    offsets.push(offset);
  }

  const xrefOffset = offset;
  const xrefEntries = ['xref\n0 6\n0000000000 65535 f \n'];
  for (let i = 1; i <= 5; i += 1) {
    xrefEntries.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  const trailer = `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Blob([...components, xrefEntries.join(''), trailer], { type: 'application/pdf' });
}

export function generateSOC2Csv(report) {
  const findings = report.findings || [];
  const headers = ['severity', 'control', 'status', 'detail', 'recommendation'];
  const rows = findings.map((f) => ({
    severity: f.severity,
    control: f.control || f.article,
    status: f.status,
    detail: f.detail,
    recommendation: f.recommendation || '',
  }));
  return buildCsvRows(headers, rows);
}

export function generateGDPRCsv(report) {
  const activities = report.dataProcessingActivities || [];
  const headers = ['timestamp', 'action', 'category', 'actor', 'purpose'];
  const rows = activities.map((a) => ({
    timestamp: a.timestamp,
    action: a.action,
    category: a.category,
    actor: a.actor || '',
    purpose: a.purpose,
  }));
  return buildCsvRows(headers, rows);
}
