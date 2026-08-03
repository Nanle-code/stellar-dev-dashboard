import { OptimizationService } from '../../src/optimization/optimizationService';

describe('OptimizationService', () => {
  let service: OptimizationService;

  beforeEach(() => {
    service = new OptimizationService();
  });

  it('should analyze inefficient contract code and generate an optimization report', () => {
    // Sample contract code with known performance anti-patterns
    const inefficientContractCode = `
      fn process_batch(env: Env) {
        for i in 0..100 {
          let val = env.storage().instance().get("my_key");
          let my_map = map.get(i).unwrap();
          let data = my_data.clone();
        }
      }
    `;

    const report = service.analyzeContract(inefficientContractCode, 100000);

    // 1. Check summary
    expect(report.summary.totalIssuesFound).toBeGreaterThan(0);
    expect(report.summary.estimatedTotalGasSavingsPct).toBeGreaterThan(0);

    // 2. Check prioritized issues sorting (HIGH before MEDIUM)
    if (report.prioritizedIssues.length >= 2) {
      const impactOrder = { HIGH: 1, MEDIUM: 2, LOW: 3 };
      const firstImpact = impactOrder[report.prioritizedIssues[0].impact];
      const secondImpact = impactOrder[report.prioritizedIssues[1].impact];
      expect(firstImpact).toBeLessThanOrEqual(secondImpact);
    }

    // 3. Check benchmark gas calculations
    expect(report.benchmark.baselineGas).toBe(100000);
    expect(report.benchmark.optimizedGasEstimate).toBeLessThan(100000);
    expect(report.benchmark.potentialSavings).toBeGreaterThan(0);
  });
});
