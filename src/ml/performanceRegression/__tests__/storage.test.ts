import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadMetricData,
  saveMetricData,
  deleteMetricData,
  loadMultipleBaselines,
  recordObservation,
  STORAGE_PREFIX,
  MAX_OBSERVATIONS_PER_METRIC,
} from '../storage.js';

// Mock storage layer
vi.mock('../../../../lib/storage.js', () => {
  const storage = new Map();
  
  return {
    getStoredValue: vi.fn(async (key) => storage.get(key) || null),
    setStoredValue: vi.fn(async (key, value) => storage.set(key, value)),
    removeStoredValue: vi.fn(async (key) => storage.delete(key)),
  };
});

import { getStoredValue, setStoredValue, removeStoredValue } from '../../../lib/storage.js';

describe('loadMetricData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('loads metric data from storage', async () => {
    const mockData = {
      observations: [{ value: 100, timestamp: Date.now() }],
      baseline: { mean: 100, stdDev: 10, count: 1 },
      updatedAt: Date.now(),
    };
    
    getStoredValue.mockResolvedValue(mockData);
    
    const data = await loadMetricData('LCP');
    
    expect(getStoredValue).toHaveBeenCalledWith(`${STORAGE_PREFIX}LCP`);
    expect(data).toEqual(mockData);
  });
  
  it('returns null when metric not found', async () => {
    getStoredValue.mockResolvedValue(null);
    
    const data = await loadMetricData('UNKNOWN');
    
    expect(data).toBeNull();
  });
  
  it('returns null on storage error', async () => {
    getStoredValue.mockRejectedValue(new Error('Storage error'));
    
    const data = await loadMetricData('LCP');
    
    expect(data).toBeNull();
  });
});

describe('saveMetricData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('saves metric data to storage', async () => {
    const observations = [{ value: 100, timestamp: Date.now() }];
    const baseline = { mean: 100, stdDev: 10, count: 1 };
    
    await saveMetricData('LCP', observations, baseline);
    
    expect(setStoredValue).toHaveBeenCalledWith(
      `${STORAGE_PREFIX}LCP`,
      expect.objectContaining({
        observations,
        baseline,
        updatedAt: expect.any(Number),
      })
    );
  });
  
  it('limits observations to MAX_OBSERVATIONS_PER_METRIC', async () => {
    const manyObservations = Array.from({ length: MAX_OBSERVATIONS_PER_METRIC + 100 }, (_, i) => ({
      value: i,
      timestamp: Date.now(),
    }));
    
    const baseline = { mean: 500, stdDev: 100, count: manyObservations.length };
    
    await saveMetricData('LCP', manyObservations, baseline);
    
    const savedData = setStoredValue.mock.calls[0][1];
    expect(savedData.observations).toHaveLength(MAX_OBSERVATIONS_PER_METRIC);
    // Should keep the most recent ones
    expect(savedData.observations[0].value).toBeGreaterThanOrEqual(100);
  });
  
  it('does not throw on storage error', async () => {
    setStoredValue.mockRejectedValue(new Error('Storage full'));
    
    await expect(saveMetricData('LCP', [], {})).resolves.toBeUndefined();
  });
});

describe('deleteMetricData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('deletes metric data from storage', async () => {
    await deleteMetricData('LCP');
    
    expect(removeStoredValue).toHaveBeenCalledWith(`${STORAGE_PREFIX}LCP`);
  });
  
  it('does not throw on storage error', async () => {
    removeStoredValue.mockRejectedValue(new Error('Storage error'));
    
    await expect(deleteMetricData('LCP')).resolves.toBeUndefined();
  });
});

describe('loadMultipleBaselines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('loads baselines for multiple metrics', async () => {
    const mockData = {
      LCP: {
        observations: [{ value: 100, timestamp: Date.now() }],
        baseline: { mean: 100, stdDev: 10, count: 1 },
      },
      FCP: {
        observations: [{ value: 200, timestamp: Date.now() }],
        baseline: { mean: 200, stdDev: 20, count: 1 },
      },
    };
    
    getStoredValue.mockImplementation(async (key) => {
      const metricName = key.replace(STORAGE_PREFIX, '');
      return mockData[metricName] || null;
    });
    
    const baselines = await loadMultipleBaselines(['LCP', 'FCP']);
    
    expect(baselines.LCP).toEqual(mockData.LCP.baseline);
    expect(baselines.FCP).toEqual(mockData.FCP.baseline);
  });
  
  it('skips metrics without stored data', async () => {
    getStoredValue.mockResolvedValue(null);
    
    const baselines = await loadMultipleBaselines(['LCP', 'FCP']);
    
    expect(baselines).toEqual({});
  });
  
  it('handles partial failures gracefully', async () => {
    getStoredValue.mockImplementation(async (key) => {
      if (key.includes('LCP')) {
        return {
          baseline: { mean: 100, stdDev: 10, count: 1 },
        };
      }
      throw new Error('Storage error');
    });
    
    const baselines = await loadMultipleBaselines(['LCP', 'FCP']);
    
    expect(baselines.LCP).toBeDefined();
    expect(baselines.FCP).toBeUndefined();
  });
});

describe('recordObservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('records new observation and updates baseline', async () => {
    const existingData = {
      observations: [{ value: 100, timestamp: Date.now() - 1000 }],
      baseline: { mean: 100, stdDev: 0, count: 1 },
    };
    
    getStoredValue.mockResolvedValue(existingData);
    
    const computeBaseline = vi.fn((observations) => ({
      mean: observations.reduce((sum, o) => sum + o.value, 0) / observations.length,
      stdDev: 10,
      count: observations.length,
    }));
    
    const result = await recordObservation('LCP', 200, computeBaseline);
    
    expect(result.observation.value).toBe(200);
    expect(result.baseline.count).toBe(2);
    expect(computeBaseline).toHaveBeenCalled();
    expect(setStoredValue).toHaveBeenCalled();
  });
  
  it('creates new metric data when none exists', async () => {
    getStoredValue.mockResolvedValue(null);
    
    const computeBaseline = vi.fn(() => ({
      mean: 100,
      stdDev: 0,
      count: 1,
    }));
    
    const result = await recordObservation('NEW_METRIC', 100, computeBaseline);
    
    expect(result.observation.value).toBe(100);
    expect(result.baseline).toBeDefined();
  });
  
  it('timestamps observations automatically', async () => {
    getStoredValue.mockResolvedValue(null);
    
    const computeBaseline = vi.fn(() => ({ mean: 100, stdDev: 0, count: 1 }));
    
    const result = await recordObservation('LCP', 100, computeBaseline);
    
    expect(result.observation.timestamp).toBeGreaterThan(0);
    expect(result.observation.timestamp).toBeLessThanOrEqual(Date.now());
  });
});
