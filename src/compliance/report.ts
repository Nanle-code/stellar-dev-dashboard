import { Finding } from './engine';

export interface ComplianceReport {
  accountId: string;
  generatedAt: string;
  totalFindings: number;
  bySeverity: Record<string, number>;
  findings: Finding[];
  summary: string;
}

export function generateReport(accountId: string, findings: Finding[]): ComplianceReport {
  const bySeverity: Record<string, number> = {};
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  }

  const report: ComplianceReport = {
    accountId,
    generatedAt: new Date().toISOString(),
    totalFindings: findings.length,
    bySeverity,
    findings,
    summary: `Found ${findings.length} issues for account ${accountId}`,
  };

  // eslint-disable-next-line no-console
  console.info('Compliance Report:', JSON.stringify(report));
  return report;
}
