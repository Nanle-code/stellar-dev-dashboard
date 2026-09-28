import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProfiler, profile, profileAsync, getProfilerSummary, clearProfiler, setGlobalProfiler, getGlobalProfiler } from '../profiler.js';

describe('profiler', () => {
  beforeEach(() => {
    clearProfiler();
    setGlobalProfiler(createProfiler({ enabled: true, sampleRate: 1, maxSamples: 100 }));
  });

  it('creates a profiler with default config', () => {
    const profiler = createProfiler();
    const summary = profiler.getSummary();
    expect(summary.enabled).toBe(true);
    expect(summary.sampleRate).toBe(1);
    expect(summary.maxSamples).toBe(100);
    expect(summary.samples).toEqual([]);
  });

  it('creates a profiler with custom config', () => {
    const profiler = createProfiler({ enabled: true, sampleRate: 0.5, maxSamples: 50 });
    const summary = profiler.getSummary();
    expect(summary.sampleRate).toBe(0.5);
    expect(summary.maxSamples).toBe(50);
  });

  it('profiles synchronous functions', () => {
    const profiler = createProfiler({ enabled: true, sampleRate: 1, maxSamples: 10 });

    const result = profiler.profile('sync-test', () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) sum += i;
      return sum;
    });

    expect(result).toBe(499500);
    const summary = profiler.getSummary();
    expect(summary.samples.length).toBe(1);
    expect(summary.samples[0].name).toBe('sync-test');
    expect(summary.samples[0].duration).toBeGreaterThanOrEqual(0);
  });

  it('profiles asynchronous functions', async () => {
    const profiler = createProfiler({ enabled: true, sampleRate: 1, maxSamples: 10 });

    const result = await profiler.profile('async-test', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 'done';
    });

    expect(result).toBe('done');
    const summary = profiler.getSummary();
    expect(summary.samples.length).toBe(1);
    expect(summary.samples[0].duration).toBeGreaterThanOrEqual(5);
  });

  it('profiles async functions with profileAsync', async () => {
    const profiler = createProfiler({ enabled: true, sampleRate: 1, maxSamples: 10 });

    const result = await profiler.profileAsync('async-test-2', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 'async-done';
    });

    expect(result).toBe('async-done');
    const summary = profiler.getSummary();
    expect(summary.samples.length).toBe(1);
  });

  it('respects sampleRate', () => {
    const profiler = createProfiler({ enabled: true, sampleRate: 0, maxSamples: 100 });

    for (let i = 0; i < 100; i++) {
      profiler.profile('test', () => 1);
    }

    const summary = profiler.getSummary();
    expect(summary.samples.length).toBe(0);
  });

  it('respects maxSamples (FIFO)', () => {
    const profiler = createProfiler({ enabled: true, sampleRate: 1, maxSamples: 3 });

    profiler.profile('a', () => 1);
    profiler.profile('b', () => 2);
    profiler.profile('c', () => 3);
    profiler.profile('d', () => 4);

    const summary = profiler.getSummary();
    expect(summary.samples.length).toBe(3);
    expect(summary.samples[0].name).toBe('b');
    expect(summary.samples[2].name).toBe('d');
  });

  it('handles errors in profiled functions', () => {
    const profiler = createProfiler({ enabled: true, sampleRate: 1, maxSamples: 10 });

    expect(() => {
      profiler.profile('error-test', () => {
        throw new Error('test error');
      });
    }).toThrow('test error');

    const summary = profiler.getSummary();
    expect(summary.samples.length).toBe(1);
    expect(summary.samples[0].name).toBe('error-test');
  });

  it('handles errors in async profiled functions', async () => {
    const profiler = createProfiler({ enabled: true, sampleRate: 1, maxSamples: 10 });

    await expect(
      profiler.profile('async-error', async () => {
        await new Promise((r) => setTimeout(r, 1));
        throw new Error('async error');
      })
    ).rejects.toThrow('async error');

    const summary = profiler.getSummary();
    expect(summary.samples.length).toBe(1);
  });

  it('computes stats correctly', () => {
    const profiler = createProfiler({ enabled: true, sampleRate: 1, maxSamples: 100 });

    profiler.profile('stat-test', () => {
      // Add a small delay to ensure measurable duration
      const start = Date.now();
      while (Date.now() - start < 5) {}
      return 10;
    });
    profiler.profile('stat-test', () => {
      const start = Date.now();
      while (Date.now() - start < 5) {}
      return 20;
    });
    profiler.profile('stat-test', () => {
      const start = Date.now();
      while (Date.now() - start < 5) {}
      return 30;
    });
    profiler.profile('other', () => {
      const start = Date.now();
      while (Date.now() - start < 5) {}
      return 5;
    });

    const summary = profiler.getSummary();
    const stats = summary.stats.byName;

    expect(stats['stat-test'].count).toBe(3);
    // With artificial delay, avg should be around 5-15ms
    expect(stats['stat-test'].avgDuration).toBeGreaterThan(4);
    expect(stats['stat-test'].maxDuration).toBeGreaterThan(4);
    expect(stats['stat-test'].minDuration).toBeGreaterThan(4);

    expect(stats['other'].count).toBe(1);
    expect(stats['other'].avgDuration).toBeGreaterThan(4);
  });

  it('clears samples', () => {
    const profiler = createProfiler({ enabled: true, sampleRate: 1, maxSamples: 10 });
    profiler.profile('test', () => 1);
    profiler.clear();
    expect(profiler.getSummary().samples.length).toBe(0);
  });

  it('global profiler functions work', () => {
    const result = profile('global-test', () => 42);
    expect(result).toBe(42);

    const summary = getProfilerSummary();
    expect(summary.samples.length).toBe(1);
    expect(summary.samples[0].name).toBe('global-test');
  });

  it('global profiler profileAsync works', async () => {
    const result = await profileAsync('global-async', async () => {
      await new Promise((r) => setTimeout(r, 2));
      return 'async-result';
    });
    expect(result).toBe('async-result');

    const summary = getProfilerSummary();
    expect(summary.samples.length).toBe(1);
  });

  it('setGlobalProfiler replaces the global instance', () => {
    const custom = createProfiler({ enabled: true, sampleRate: 1, maxSamples: 5 });
    setGlobalProfiler(custom);

    profile('custom-global', () => 1);
    const summary = getProfilerSummary();
    expect(summary.maxSamples).toBe(5);
    expect(summary.samples[0].name).toBe('custom-global');
  });

  it('getGlobalProfiler returns the current instance', () => {
    const profiler = getGlobalProfiler();
    expect(profiler).toBeDefined();
    expect(typeof profiler.profile).toBe('function');
  });

  it('handles missing performance.now() gracefully', () => {
    const originalPerformance = global.performance;
    // @ts-ignore
    global.performance = undefined;

    const profiler = createProfiler({ enabled: true, sampleRate: 1, maxSamples: 10 });
    profiler.profile('no-perf', () => 1);

    const summary = profiler.getSummary();
    expect(summary.samples.length).toBe(1);
    expect(summary.samples[0].duration).toBeGreaterThanOrEqual(0);

    global.performance = originalPerformance;
  });

  it('clamps sampleRate to valid range', () => {
    const profiler1 = createProfiler({ sampleRate: -0.5 });
    expect(profiler1.getSummary().sampleRate).toBe(0);

    const profiler2 = createProfiler({ sampleRate: 1.5 });
    expect(profiler2.getSummary().sampleRate).toBe(1);
  });

  it('clamps maxSamples to minimum 1', () => {
    const profiler = createProfiler({ maxSamples: 0 });
    expect(profiler.getSummary().maxSamples).toBe(1);
  });
});