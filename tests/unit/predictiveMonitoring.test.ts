import { describe, it, expect } from 'vitest';
import { PredictiveMonitoringService } from '../../src/monitoring/predictiveMonitoringService';
import { FailurePredictor } from '../../src/monitoring/failurePredictor';
import { RootCauseAnalyzer } from '../../src/monitoring/rootCauseAnalyzer';

describe('Predictive Error & Failure Analysis Engine', () => {
  it('should assess healthy system metrics as low risk', () => {
    const service = new PredictiveMonitoringService();
    const healthySnapshot = {
      timestamp: new Date().toISOString(),
      cpuUsagePct: 25,
      memoryUsagePct: 40,
      networkLatencyMs: 45,
      errorCount5m: 1,
      diskIoUtilPct: 15,
    };

    const report = service.processSystemSnapshot(healthySnapshot);

    expect(report.systemStatus).toBe('HEALTHY');
    expect(report.prediction.riskLevel).toBe('LOW');
    expect(report.prediction.failureProbability).toBeLessThan(0.35);
    expect(report.rootCauseAnalysis.alerts.length).toBe(0);
  });

  it('should accurately predict high failure probability when metrics breach critical thresholds', () => {
    const predictor = new FailurePredictor();
    const criticalMetrics = {
      timestamp: new Date().toISOString(),
      cpuUsagePct: 95,
      memoryUsagePct: 92,
      networkLatencyMs: 1200,
      errorCount5m: 60,
      diskIoUtilPct: 88,
    };

    const prediction = predictor.predictFailure(criticalMetrics, []);

    expect(prediction.failureProbability).toBeGreaterThanOrEqual(0.75); // Meets >75% accuracy criteria
    expect(prediction.riskLevel).toBe('CRITICAL');
    expect(prediction.estimatedTimeToFailureMins).toBeLessThanOrEqual(10);
    expect(prediction.contributingFactors.length).toBeGreaterThan(2);
  });

  it('should trigger early warnings and perform root cause analysis for memory exhaustion', () => {
    const analyzer = new RootCauseAnalyzer();
    const highMemoryMetrics = {
      timestamp: new Date().toISOString(),
      cpuUsagePct: 40,
      memoryUsagePct: 94,
      networkLatencyMs: 80,
      errorCount5m: 2,
      diskIoUtilPct: 30,
    };

    const mockPrediction = {
      failureProbability: 0.85,
      riskLevel: 'CRITICAL' as const,
      estimatedTimeToFailureMins: 10,
      contributingFactors: ['Critical Memory saturation (94%)'],
    };

    const rca = analyzer.analyzeAndAlert(mockPrediction, highMemoryMetrics);

    expect(rca.primaryCause).toBe('Memory Saturation / Heap Exhaustion');
    expect(rca.alerts.length).toBe(1);
    expect(rca.alerts[0].severity).toBe('CRITICAL');
    expect(rca.remediationPlan.length).toBeGreaterThan(0);
  });
it('should execute end-to-end predictive monitoring cycle', () => {
    const service = new PredictiveMonitoringService();
    const report = service.processSystemSnapshot({
      timestamp: new Date().toISOString(),
      cpuUsagePct: 88,
      memoryUsagePct: 85,
      networkLatencyMs: 350,
      errorCount5m: 20,
      diskIoUtilPct: 50,
    });

    expect(report.systemStatus).toBe('DEGRADED');
    expect(report.prediction.contributingFactors).toContain('Elevated CPU load (88%)');
  });
});