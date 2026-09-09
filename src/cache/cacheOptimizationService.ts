import { CacheMonitor, CachePerformanceMetrics } from './cacheMonitor';
import { CachePolicyPredictor, PolicyRecommendation } from './cachePolicyPredictor';
import { DynamicCacheController } from './dynamicCacheController';

export interface CacheOptimizationReport {
  timestamp: string;
  metrics: CachePerformanceMetrics;
  recommendation: PolicyRecommendation;
  activePolicy: string;
  policyApplied: boolean;
}

export class CacheOptimizationService<T = any> {
  private monitor = new CacheMonitor();
  private predictor = new CachePolicyPredictor();
  private controller = new DynamicCacheController<T>();

  public access(key: string, fetchFn?: () => T): T | null {
    const startTime = Date.now();
    let value = this.controller.get(key);
    const isHit = value !== null;

    if (!isHit && fetchFn) {
      value = fetchFn();
      if (value !== null && value !== undefined) {
        this.controller.set(key, value);
      }
    }

    const latencyMs = Date.now() - startTime;
    this.monitor.recordAccess({
      key,
      timestamp: Date.now(),
      hit: isHit,
      latencyMs,
      dataAgeSeconds: 0,
    });

    return value;
  }

  public optimizeCachePolicies(memoryUsagePct = 50, targetFreshnessSeconds = 300): CacheOptimizationReport {
    const metrics = this.monitor.getMetrics(memoryUsagePct);
    const accessFreqMap = this.monitor.getAccessFrequencyMap();

    const recommendation = this.predictor.predictOptimalPolicy(
      metrics,
      accessFreqMap,
      targetFreshnessSeconds
    );

    const currentPolicy = this.controller.getActivePolicy();
    let policyApplied = false;

    if (currentPolicy !== recommendation.recommendedPolicy) {
      this.controller.setPolicy(recommendation.recommendedPolicy, recommendation.recommendedTtlSeconds);
      policyApplied = true;
    }

    return {
      timestamp: new Date().toISOString(),
      metrics,
      recommendation,
      activePolicy: this.controller.getActivePolicy(),
      policyApplied,
    };
  }

  public getController(): DynamicCacheController<T> {
    return this.controller;
  }
}