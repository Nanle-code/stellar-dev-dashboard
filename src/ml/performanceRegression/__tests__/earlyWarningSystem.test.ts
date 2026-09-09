import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatWarningPayload,
  emitWarning,
  emitBatchWarnings,
  clearWarningHistory,
  getWarningCount,
} from '../earlyWarningSystem.js';

// Mock AlertCenter
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

import { alertCenter } from '../../../../lib/alerts.js';

describe('formatWarningPayload', () => {
  const mockRegression = {
    metricName: 'LCP',
    value: 3000,
    baseline: { mean: 2000, stdDev: 200, count: 20 },
    zScore: 5.0,
    deviationPercent: 50,
    confidence: 0.85,
    severity: 'critical',
    timestamp: Date.now(),
  };
  
  it('creates warning payload with all required fields', () => {
    const warning = formatWarningPayload(mockRegression);
    
    expect(warning.id).toBeDefined();
    expect(warning.severity).toBe('critical');
    expect(warning.title).toContain('LCP');
    expect(warning.description).toBeDefined();
    expect(warning.timestamp).toBeDefined();
  });
  
  it('includes metric statistics in description', () => {
    const warning = formatWarningPayload(mockRegression);
    
    expect(warning.description).toContain('3000');
    expect(warning.description).toContain('2000');
    expect(warning.description).toContain('50.0%');
    expect(warning.description).toContain('5.00σ');
  });
  
  it('includes commit information when provided', () => {
    const commits = [
      {
        hash: 'abc123',
        author: 'John Doe',
        message: 'feat: add feature',
      },
    ];
    
    const warning = formatWarningPayload(mockRegression, commits);
    
    expect(warning.description).toContain('Recent commits');
    expect(warning.metadata.commits).toHaveLength(1);
  });
  
  it('maps regression severity to alert severity', () => {
    const criticalReg = { ...mockRegression, severity: 'critical' };
    const warningReg = { ...mockRegression, severity: 'warning' };
    
    const critical = formatWarningPayload(criticalReg);
    const warning = formatWarningPayload(warningReg);
    
    expect(critical.severity).toBe('critical');
    expect(warning.severity).toBe('warning');
  });
  
  it('includes metadata for programmatic access', () => {
    const warning = formatWarningPayload(mockRegression);
    
    expect(warning.metadata.metricName).toBe('LCP');
    expect(warning.metadata.value).toBe(3000);
    expect(warning.metadata.zScore).toBe(5.0);
    expect(warning.metadata.confidence).toBe(0.85);
  });
});

describe('emitWarning', () => {
  const mockRegression = {
    metricName: 'LCP',
    value: 3000,
    baseline: { mean: 2000, stdDev: 200, count: 20 },
    zScore: 5.0,
    deviationPercent: 50,
    confidence: 0.85,
    severity: 'critical',
    timestamp: Date.now(),
  };
  
  beforeEach(() => {
    clearWarningHistory();
    vi.clearAllMocks();
  });
  
  it('emits warning through AlertCenter', () => {
    const result = emitWarning(mockRegression);
    
    expect(result.emitted).toBe(true);
    expect(result.warning).toBeDefined();
    expect(alertCenter.push).toHaveBeenCalledWith([result.warning]);
  });
  
  it('deduplicates warnings with same ID', () => {
    const result1 = emitWarning(mockRegression);
    const result2 = emitWarning(mockRegression);
    
    expect(result1.emitted).toBe(true);
    expect(result2.emitted).toBe(false);
    expect(result2.reason).toContain('Duplicate');
    expect(alertCenter.push).toHaveBeenCalledTimes(1);
  });
  
  it('tracks warning emission for deduplication', () => {
    expect(getWarningCount()).toBe(0);
    
    emitWarning(mockRegression);
    
    expect(getWarningCount()).toBeGreaterThan(0);
  });
  
  it('includes commits in warning when provided', () => {
    const commits = [
      { hash: 'abc123', author: 'John', message: 'feat: test' },
    ];
    
    const result = emitWarning(mockRegression, commits);
    
    expect(result.warning.metadata.commits).toHaveLength(1);
  });
});

describe('emitBatchWarnings', () => {
  beforeEach(() => {
    clearWarningHistory();
    vi.clearAllMocks();
  });
  
  it('emits multiple warnings in batch', () => {
    const items = [
      {
        regression: {
          metricName: 'LCP',
          value: 3000,
          baseline: { mean: 2000, stdDev: 200, count: 20 },
          zScore: 5.0,
          deviationPercent: 50,
          confidence: 0.85,
          severity: 'critical',
          timestamp: Date.now(),
        },
        commits: [],
      },
      {
        regression: {
          metricName: 'FCP',
          value: 2000,
          baseline: { mean: 1500, stdDev: 150, count: 20 },
          zScore: 3.33,
          deviationPercent: 33.3,
          confidence: 0.75,
          severity: 'warning',
          timestamp: Date.now(),
        },
        commits: [],
      },
    ];
    
    const result = emitBatchWarnings(items);
    
    expect(result.emitted).toBe(2);
    expect(result.warnings).toHaveLength(2);
  });
  
  it('filters out duplicate warnings in batch', () => {
    const regression = {
      metricName: 'LCP',
      value: 3000,
      baseline: { mean: 2000, stdDev: 200, count: 20 },
      zScore: 5.0,
      deviationPercent: 50,
      confidence: 0.85,
      severity: 'critical',
      timestamp: Date.now(),
    };
    
    // Emit once
    emitWarning(regression);
    
    // Try batch with same regression
    const items = [{ regression, commits: [] }];
    const result = emitBatchWarnings(items);
    
    expect(result.emitted).toBe(0);
  });
});

describe('clearWarningHistory', () => {
  it('clears all tracked warnings', () => {
    const regression = {
      metricName: 'LCP',
      value: 3000,
      baseline: { mean: 2000, stdDev: 200, count: 20 },
      zScore: 5.0,
      deviationPercent: 50,
      confidence: 0.85,
      severity: 'critical',
      timestamp: Date.now(),
    };
    
    emitWarning(regression);
    expect(getWarningCount()).toBeGreaterThan(0);
    
    clearWarningHistory();
    expect(getWarningCount()).toBe(0);
  });
  
  it('allows re-emission after clearing', () => {
    const regression = {
      metricName: 'LCP',
      value: 3000,
      baseline: { mean: 2000, stdDev: 200, count: 20 },
      zScore: 5.0,
      deviationPercent: 50,
      confidence: 0.85,
      severity: 'critical',
      timestamp: Date.now(),
    };
    
    emitWarning(regression);
    const result1 = emitWarning(regression);
    expect(result1.emitted).toBe(false); // Duplicate
    
    clearWarningHistory();
    
    const result2 = emitWarning(regression);
    expect(result2.emitted).toBe(true); // Now allowed
  });
});
