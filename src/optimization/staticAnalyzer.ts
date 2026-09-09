export interface PerformanceIssue {
  id: string;
  ruleName: string;
  line: number;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  suggestion: string;
  estimatedGasSavingsPct: number;
}

export class ContractStaticAnalyzer {
  private rules = [
    {
      id: 'PERF-001',
      name: 'Storage Read Inside Loop',
      pattern: /for\s*\(.*?\)\s*\{[^}]*?\b(storage|state|instance\(\)\.get)\b/s,
      impact: 'HIGH' as const,
      description: 'Repeated state/storage reads inside a loop cause significant gas overhead.',
      suggestion: 'Cache the state variable in a local stack variable before the loop.',
      estimatedGasSavingsPct: 35,
    },
    {
      id: 'PERF-002',
      name: 'Unbounded Vector Operations',
      pattern: /vec!\[\].*?\.extend|while\s*\(true\)/s,
      impact: 'HIGH' as const,
      description: 'Dynamically expanding arrays without cap limits can cause out-of-gas errors.',
      suggestion: 'Pre-allocate vector capacity or enforce page limits on dynamic arrays.',
      estimatedGasSavingsPct: 20,
    },
    {
      id: 'PERF-003',
      name: 'Redundant Data Serialization',
      pattern: /env\.storage\(\)\..*?\.set/s,
      impact: 'MEDIUM' as const,
      description: 'Frequent storage writes for unchanged state data.',
      suggestion: 'Only execute storage updates if state mutation has actually occurred.',
      estimatedGasSavingsPct: 15,
    },
  ];

  public analyze(code: string): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = code.split('\n');

    lines.forEach((lineText, idx) => {
      for (const rule of this.rules) {
        if (rule.pattern.test(lineText)) {
          issues.push({
            id: rule.id,
            ruleName: rule.name,
            line: idx + 1,
            impact: rule.impact,
            description: rule.description,
            suggestion: rule.suggestion,
            estimatedGasSavingsPct: rule.estimatedGasSavingsPct,
          });
        }
      }
    });

    return issues;
  }
}