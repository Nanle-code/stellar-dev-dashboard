export interface BenchmarkResult {
  baselineGas: number;
  optimizedGasEstimate: number;
  potentialSavings: number;
  savingsPercentage: number;
}

export class ContractBenchmarkingEngine {
  public benchmark(baseGasCost: number, detectedIssues: { estimatedGasSavingsPct: number }[]): BenchmarkResult {
    const totalSavingsPct = Math.min(
      85, // Safety cap on max realistic improvement
      detectedIssues.reduce((acc, curr) => acc + curr.estimatedGasSavingsPct, 0)
    );

    const potentialSavings = Math.round(baseGasCost * (totalSavingsPct / 100));
    const optimizedGasEstimate = baseGasCost - potentialSavings;

    return {
      baselineGas: baseGasCost,
      optimizedGasEstimate,
      potentialSavings,
      savingsPercentage: totalSavingsPct,
    };
  }
}