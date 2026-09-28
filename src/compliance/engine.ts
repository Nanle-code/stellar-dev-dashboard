import { ComplianceEvent, defaultRules, Rule } from './rules';

export interface Finding {
  ruleId: string;
  severity: Rule['severity'];
  explanation: string;
  score?: number; // ML or heuristic confidence
}

export class ComplianceEngine {
  private rules: Rule[];

  constructor(rules: Rule[] = defaultRules) {
    this.rules = rules;
  }

  // Lightweight ML-enhanced heuristic scoring. Replace with model integration later.
  private mlScore(event: ComplianceEvent): number {
    let score = 0;
    if (event.amount) score += Math.min(1, event.amount / 50000);
    const memo = (event.memo || '').length > 0 ? 0.1 : 0;
    score += memo;
    const rapid = (event.metadata?.recentTransfersCount ?? 0) / 10;
    score += Math.min(0.5, rapid);
    return Math.min(1, score);
  }

  evaluate(event: ComplianceEvent): { findings: Finding[]; mlScore: number } {
    const findings: Finding[] = [];
    for (const r of this.rules) {
      try {
        if (r.match(event)) {
          findings.push({ ruleId: r.id, severity: r.severity, explanation: r.explanation });
        }
      } catch (e) {
        // swallow rule errors but continue
      }
    }

    const score = this.mlScore(event);
    if (score >= 0.8) {
      findings.push({ ruleId: 'ml-anomaly', severity: 'high', explanation: 'ML anomaly score high', score });
    }

    return { findings, mlScore: score };
  }
}

export default ComplianceEngine;
