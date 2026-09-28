import { describe, it, expect } from 'vitest';
import { CacheOptimizationService } from '../../src/cache/cacheOptimizationService';
import { CachePolicyPredictor } from '../../src/cache/cachePolicyPredictor';
import { CacheMonitor } from '../../src/cache/cacheMonitor';

describe('Dynamic AI Cache Optimization & Policy Engine', () => {
  it('should track cache hits, misses, and performance metrics', () => {
    const service = new CacheOptimizationService<string>();
    const fetchMock = () => 'stellar-data';

    // Miss on first request (populates cache)
    service.access('block-123', fetchMock);

    // Hit on subsequent requests
    service.access('block-123', fetchMock);
    service.access('block-123', fetchMock);

    const report = service.optimizeCachePolicies();

    expect(report.metrics.totalRequests).toBe(3);
    expect(report.metrics.hitCount).toBe(2);
    expect(report.metrics.missCount).toBe(1);
    expect(report.metrics.hitRatePct).toBeCloseTo(66.67, 1);
  });

  it('should recommend LFU policy and predict >30% hit rate improvement for frequency-skewed workloads', () => {
    const predictor = new CachePolicyPredictor();
    
    // Simulate frequency-skewed workload (e.g., hot key accessed repeatedly)
    const accessFreqMap: Record<string, number> = {};
    for (let i = 1; i <= 25; i++) {
      accessFreqMap[`key-${i}`] = 1;
    }
    accessFreqMap['hot-key-1'] = 50; // Heavily skewed key

    const metrics = {
      totalRequests: 100,
      hitCount: 50,
      missCount: 50,
      hitRatePct: 50,
      avgLatencyMs: 12,
      memoryUsagePct: 40,
      evictionCount: 5,
    };

    const recommendation = predictor.predictOptimalPolicy(metrics, accessFreqMap);

    expect(recommendation.recommendedPolicy).toBe('LFU');
    expect(recommendation.expectedHitRateImprovementPct).toBeGreaterThanOrEqual(30); // Meets >30% acceptance criteria
  });

  it('should switch to ADAPTIVE_TTL policy when memory pressure is high', () => {
    const service = new CacheOptimizationService<string>();

    // Seed some initial access
    service.access('tx-001', () => 'data');

    // High memory usage simulation (88%)
    const report = service.optimizeCachePolicies(88);

    expect(report.recommendation.recommendedPolicy).toBe('ADAPTIVE_TTL');
    expect(report.activePolicy).toBe('ADAPTIVE_TTL');
    expect(report.policyApplied).toBe(true);
  });

  it('should dynamically switch policy and adapt execution seamlessly', () => {
    const service = new CacheOptimizationService<number>();
    
    // Initial access
    service.access('ledger-456', () => 456);

    const controller = service.getController();
    expect(controller.getActivePolicy()).toBe('LRU');

    // Optimize under low hit rate scenario
    service.optimizeCachePolicies(50);

    // Verify cache remains functional after policy adjustment
    const value = service.access('ledger-456');
    expect(value).toBe(456);
  });
});