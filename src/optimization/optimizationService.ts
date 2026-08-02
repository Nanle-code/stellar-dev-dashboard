import { ContractStaticAnalyzer, PerformanceIssue } from './staticAnalyzer';
import { MLPerformanceSuggester, MLOptimizationSuggestion } from './suggester';
import { ContractBenchmarkingEngine, BenchmarkResult } from './benchmarkingEngine';

export interface OptimizationReport {
  summary: {
    totalIssuesFound: number;
    estimatedTotalGasSavingsPct: number;
    performanceScore: number; // 0 to 100
  };
  prioritizedIssues: PerformanceIssue[];
  mlSuggestions: MLOptimizationSuggestion[];
  benchmark: BenchmarkResult;
}

export class OptimizationService {
  private staticAnalyzer = new ContractStaticAnalyzer();
  private mlSuggester = new MLPerformanceSuggester();
  private benchmarkEngine = new ContractBenchmarkingEngine();

  public analyzeContract(
    contractCode: string,
    currentGasUsage: number = 100000
  ): OptimizationReport {
    // 1. Run static analysis rules
    const staticIssues = this.staticAnalyzer.analyze(contractCode);

    // 2. Run ML pattern suggestions
    const mlSuggestions = this.mlSuggester.suggestOptimizations(contractCode);

    // 3. Sort issues by impact (HIGH -> MEDIUM -> LOW)
    const impactPriority = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    staticIssues.sort((a, b) => impactPriority[a.impact] - impactPriority[b.impact]);

    // 4. Combine all savings percentages for the benchmark engine
    const allSavings = [
      ...staticIssues.map((i) => ({ estimatedGasSavingsPct: i.estimatedGasSavingsPct })),
      ...mlSuggestions.map((m) => ({ estimatedGasSavingsPct: m.estimatedImpactPct })),
    ];

    const benchmark = this.benchmarkEngine.benchmark(currentGasUsage, allSavings);

    // 5. Calculate overall performance score (100 is perfect)
    const performanceScore = Math.max(0, 100 - staticIssues.length * 15 - mlSuggestions.length * 10);

    return {
      summary: {
        totalIssuesFound: staticIssues.length + mlSuggestions.length,
        estimatedTotalGasSavingsPct: benchmark.savingsPercentage,
        performanceScore,
      },
      prioritizedIssues: staticIssues,
      mlSuggestions,
      benchmark,
    };
  }
}