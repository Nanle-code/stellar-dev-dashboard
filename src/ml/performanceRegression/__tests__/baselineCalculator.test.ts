import { describe, it, expect } from 'vitest';
import {
  calculateStats,
  computeBaseline,
  addObservation,
  validateBaseline,
  DEFAULT_LOOKBACK_DAYS,
  MIN_DATA_POINTS,
} from '../baselineCalculator.js';

describe('calculateStats', () => {
  it('calculates mean and standard deviation correctly', () => {
    const values = [10, 20, 30, 40, 50];
    const stats = calculateStats(values);
    
    expect(stats.mean).toBeCloseTo(30, 2);
    expect(stats.stdDev).toBeCloseTo(15.81, 2);
    expect(stats.count).toBe(5);
  });
  
  it('handles single value', () => {
    const stats = calculateStats([42]);
    
    expect(stats.mean).toBe(42);
    expect(stats.stdDev).toBe(0);
    expect(stats.count).toBe(1);
  });
  
  it('returns zero stats for empty array', () => {
    const stats = calculateStats([]);
    
    expect(stats.mean).toBe(0);
    expect(stats.stdDev).toBe(0);
    expect(stats.count).toBe(0);
  });
  
  it('filters out non-numeric and infinite values', () => {
    const values = [10, NaN, 20, Infinity, 30, -Infinity, 40];
    const stats = calculateStats(values);
    
    expect(stats.count).toBe(4);
    expect(stats.mean).toBe(25);
  });
  
  it('uses Welford algorithm for numerical stability', () => {
    // Test with values that could cause numerical instability
    const values = [1e10, 1e10 + 1, 1e10 + 2, 1e10 + 3];
    const stats = calculateStats(values);
    
    expect(stats.mean).toBeCloseTo(1e10 + 1.5, -8);
    expect(stats.stdDev).toBeGreaterThan(0);
  });
});

describe('computeBaseline', () => {
  const now = Date.now();
  
  const makeObservations = (count, startDaysAgo = 0) => {
    return Array.from({ length: count }, (_, i) => ({
      value: 100 + i * 10,
      timestamp: now - (startDaysAgo + count - i - 1) * 24 * 60 * 60 * 1000,
    }));
  };
  
  it('computes baseline from recent observations within lookback window', () => {
    const observations = makeObservations(10, 5); // 10 obs, 5-15 days ago
    const baseline = computeBaseline(observations, 14);
    
    expect(baseline.count).toBe(10);
    expect(baseline.mean).toBeCloseTo(145, 2);
    expect(baseline.stdDev).toBeGreaterThan(0);
    expect(baseline.insufficientData).toBe(false);
  });
  
  it('excludes observations outside lookback window', () => {
    const recent = makeObservations(5, 0);
    const old = makeObservations(5, 20); // 20+ days ago
    const observations = [...recent, ...old];
    
    const baseline = computeBaseline(observations, 14);
    
    expect(baseline.count).toBe(5); // Only recent ones
  });
  
  it('flags insufficient data when count < MIN_DATA_POINTS', () => {
    const observations = makeObservations(5); // Less than MIN_DATA_POINTS (7)
    const baseline = computeBaseline(observations);
    
    expect(baseline.insufficientData).toBe(true);
    expect(baseline.count).toBeLessThan(MIN_DATA_POINTS);
  });
  
  it('uses default lookback days when not specified', () => {
    const observations = makeObservations(10);
    const baseline = computeBaseline(observations);
    
    expect(baseline.lookbackDays).toBe(DEFAULT_LOOKBACK_DAYS);
  });
  
  it('includes computedAt timestamp', () => {
    const observations = makeObservations(10);
    const baseline = computeBaseline(observations);
    
    expect(baseline.computedAt).toBeGreaterThan(0);
    expect(baseline.computedAt).toBeLessThanOrEqual(Date.now());
  });
});

describe('addObservation', () => {
  const now = Date.now();
  
  it('adds new observation to existing list', () => {
    const observations = [
      { value: 100, timestamp: now - 1000 },
      { value: 200, timestamp: now - 2000 },
    ];
    
    const updated = addObservation(observations, 300, now);
    
    expect(updated).toHaveLength(3);
    expect(updated[2].value).toBe(300);
    expect(updated[2].timestamp).toBe(now);
  });
  
  it('prunes old observations outside lookback window', () => {
    const lookbackDays = 7;
    const cutoff = now - lookbackDays * 24 * 60 * 60 * 1000;
    
    const observations = [
      { value: 100, timestamp: cutoff - 1000 }, // Too old
      { value: 200, timestamp: cutoff + 1000 }, // Within window
    ];
    
    const updated = addObservation(observations, 300, now, lookbackDays);
    
    expect(updated).toHaveLength(2); // Old one pruned
    expect(updated[0].value).toBe(200);
  });
  
  it('uses current timestamp when not provided', () => {
    const updated = addObservation([], 100);
    
    expect(updated[0].timestamp).toBeGreaterThan(0);
    expect(updated[0].timestamp).toBeLessThanOrEqual(Date.now());
  });
  
  it('throws error for invalid value', () => {
    expect(() => addObservation([], NaN)).toThrow('Invalid metric value');
    expect(() => addObservation([], Infinity)).toThrow('Invalid metric value');
    expect(() => addObservation([], 'invalid')).toThrow('Invalid metric value');
  });
});

describe('validateBaseline', () => {
  it('validates baseline with sufficient data', () => {
    const baseline = {
      mean: 100,
      stdDev: 10,
      count: 10,
      insufficientData: false,
    };
    
    const result = validateBaseline(baseline);
    
    expect(result.valid).toBe(true);
  });
  
  it('rejects baseline with insufficient data', () => {
    const baseline = {
      mean: 100,
      stdDev: 10,
      count: 5,
      insufficientData: true,
    };
    
    const result = validateBaseline(baseline);
    
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Insufficient data');
  });
  
  it('rejects baseline with zero standard deviation', () => {
    const baseline = {
      mean: 100,
      stdDev: 0,
      count: 10,
      insufficientData: false,
    };
    
    const result = validateBaseline(baseline);
    
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Zero standard deviation');
  });
  
  it('rejects null baseline', () => {
    const result = validateBaseline(null);
    
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Baseline not found');
  });
});
