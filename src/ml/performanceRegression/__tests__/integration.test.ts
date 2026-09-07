import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordMetric,
  analyzePerformanceMetrics,
  getHighConfidenceRegressions,
  shouldFailCI,
} from '../index.js';

// Mock all dependencies
vi.mock('../../../../lib/storage.js', () => {
  const storage = new Map();
  return {
    getStoredValue: vi.fn(async (key) => storage.get(key) || null),
    setStoredValue: vi.fn(async (key, value) => {
      storage.set(key, value);
    }),
    removeStoredValue: vi.fn(async (key) => storage.delete(key)),
  };
});

vi.mock('../../../../lib/alerts.js', () => ({
  alertCenter: {
    push: vi.fn(),
  },
  ALERT_SEVERITY: {
    INFO: 'info',
    WARNING: 'warning',
    CRITICAL: 'critical',
  },
}));

vi.mock('node:child_process', () => {
  const execMock = vi.fn((cmd, options, callback) => {
    const mockCommits = [
      'abc123|John Doe <john@example.com>|1640000000|feat: add feature',
      'def456|Alice <alice@example.com>|1640001000|fix: bug fix',
    ].join('\n');
    const cb = typeof options === 'function' ? options : callback;
    if (typeof cb === 'function') cb(null, mockCommits, '');
  });
  return {
    default: { exec: execMock },
    exec: execMock,
  };
});

vi.mock('node:util', () => ({
  promisify: (fn) => fn,
}));

import { getStoredValue } from '../../../lib/storage.js';
import { alertCenter } from '../../../lib/alerts.js';

describe('Performance Regression Detection — Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('recordMetric', () => {
    it('records metric and computes baseline', async () => {
      // Record multiple observations
      await recordMetric('LCP', 2000);
      await recordMetric('LCP', 2100);
      await recordMetric('LCP', 1900);
      await recordMetric('LCP', 2050);
      await recordMetric('LCP', 2150);
      await recordMetric('LCP', 1950);
      await recordMetric('LCP', 2000);
      await recordMetric('LCP', 2100);
      
      const result = await recordMetric('LCP', 2050);
      
      expect(result.baseline).toBeDefined();
      expect(result.baseline.count).toBeGreaterThan(0);
      expect(result.baseline.mean).toBeGreaterThan(0);
      expect(result.baseline.insufficientData).toBe(false);
    });
  });
  
  describe('analyzePerformanceMetrics', () => {
    beforeEach(async () => {
      // Seed baseline data for multiple metrics
      for (let i = 0; i < 10; i++) {
        await recordMetric('LCP', 2000 + Math.random() * 200);
        await recordMetric('FCP', 1000 + Math.random() * 100);
        await recordMetric('TBT', 300 + Math.random() * 50);
      }
    });
    
    it('detects no regressions when metrics are within baseline', async () => {
      const metricValues = {
        LCP: 2100,
        FCP: 1050,
        TBT: 320,
      };
      
      const result = await analyzePerformanceMetrics(metricValues, { 
        emitWarnings: false,
        correlateCommits: false,
      });
      
      expect(result.regressions).toHaveLength(0);
    });
    
    it('detects regression when metric exceeds baseline', async () => {
      const metricValues = {
        LCP: 3500, // Significantly above baseline (~2000)
        FCP: 1050,
        TBT: 320,
      };
      
      const result = await analyzePerformanceMetrics(metricValues, {
        emitWarnings: false,
        correlateCommits: false,
      });
      
      expect(result.regressions.length).toBeGreaterThan(0);
      const lcpRegression = result.regressions.find(r => r.metricName === 'LCP');
      expect(lcpRegression).toBeDefined();
      expect(lcpRegression.detected).toBe(true);
    });
    
    it('emits warnings when emitWarnings=true', async () => {
      const metricValues = {
        LCP: 3500,
      };
      
      await analyzePerformanceMetrics(metricValues, {
        emitWarnings: true,
        correlateCommits: false,
      });
      
      expect(alertCenter.push).toHaveBeenCalled();
    });
    
    it('correlates with git commits when correlateCommits=true', async () => {
      const metricValues = {
        LCP: 3500,
      };
      
      const result = await analyzePerformanceMetrics(metricValues, {
        emitWarnings: true,
        correlateCommits: true,
      });
      
      if (result.warnings.length > 0) {
        expect(result.warnings[0].metadata.commits).toBeDefined();
      }
    });
    
    it('detects multiple regressions across metrics', async () => {
      const metricValues = {
        LCP: 3500,
        FCP: 1800,
        TBT: 500,
      };
      
      const result = await analyzePerformanceMetrics(metricValues, {
        emitWarnings: false,
        correlateCommits: false,
      });
      
      expect(result.regressions.length).toBeGreaterThan(1);
    });
  });
  
  describe('getHighConfidenceRegressions', () => {
    it('filters high-confidence regressions (confidence >= 0.5)', () => {
      const regressions = [
        { metricName: 'LCP', confidence: 0.8, detected: true },
        { metricName: 'FCP', confidence: 0.3, detected: true },
        { metricName: 'TBT', confidence: 0.6, detected: true },
      ];
      
      const highConfidence = getHighConfidenceRegressions(regressions);
      
      expect(highConfidence).toHaveLength(2);
      expect(highConfidence.map(r => r.metricName)).toContain('LCP');
      expect(highConfidence.map(r => r.metricName)).toContain('TBT');
    });
  });
  
  describe('shouldFailCI', () => {
    it('returns true when high-confidence regressions exist', () => {
      const regressions = [
        { confidence: 0.8 },
        { confidence: 0.3 },
      ];
      
      expect(shouldFailCI(regressions)).toBe(true);
    });
    
    it('returns false when only low-confidence regressions exist', () => {
      const regressions = [
        { confidence: 0.3 },
        { confidence: 0.4 },
      ];
      
      expect(shouldFailCI(regressions)).toBe(false);
    });
    
    it('returns false when no regressions', () => {
      expect(shouldFailCI([])).toBe(false);
    });
  });
  
  describe('End-to-end regression detection flow', () => {
    it('completes full workflow: baseline → detect → warn → CI decision', async () => {
      // Step 1: Build baseline (normal metrics over time)
      for (let i = 0; i < 10; i++) {
        await recordMetric('LCP', 2000 + Math.random() * 100);
      }
      
      // Step 2: Inject regression
      const regressedMetrics = {
        LCP: 3000, // 5σ above mean
      };
      
      // Step 3: Analyze
      const analysis = await analyzePerformanceMetrics(regressedMetrics, {
        emitWarnings: true,
        correlateCommits: true,
      });
      
      // Step 4: Verify detection
      expect(analysis.regressions).toHaveLength(1);
      expect(analysis.regressions[0].metricName).toBe('LCP');
      
      // Step 5: Verify warning emission
      expect(alertCenter.push).toHaveBeenCalled();
      expect(analysis.warnings).toHaveLength(1);
      
      // Step 6: CI decision
      const failCI = shouldFailCI(analysis.regressions);
      expect(failCI).toBe(true);
    });
  });
  
  describe('80% detection rate validation', () => {
    /**
     * Property-based acceptance test:
     * Generate 100 synthetic time-series with injected regressions.
     * Verify detection rate ≥ 80%.
     */
    it('achieves >= 80% detection rate for 3σ regressions', async () => {
      const trials = 100;
      let detected = 0;
      
      for (let trial = 0; trial < trials; trial++) {
        // Create fresh metric namespace
        const metricName = `TEST_METRIC_${trial}`;
        
        // Build baseline: 10 observations around mean=2000, stdDev=200
        for (let i = 0; i < 10; i++) {
          const value = 2000 + (Math.random() - 0.5) * 400; // ±200
          await recordMetric(metricName, value);
        }
        
        // Inject regression: 3σ above mean
        const regressedValue = 2000 + 3 * 200; // 2600
        
        // Analyze
        const result = await analyzePerformanceMetrics(
          { [metricName]: regressedValue },
          { emitWarnings: false, correlateCommits: false }
        );
        
        if (result.regressions.length > 0 && result.regressions[0].detected) {
          detected++;
        }
      }
      
      const detectionRate = detected / trials;
      
      expect(detectionRate).toBeGreaterThanOrEqual(0.8);
    }, 30000); // 30s timeout for property test
  });
});
