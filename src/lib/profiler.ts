// Lightweight non-blocking performance profiler
// Samples function execution times with configurable sampling rate and bounded storage

export type ProfilerConfig = {
  enabled?: boolean;
  sampleRate?: number; // 0-1, fraction of calls to sample
  maxSamples?: number; // maximum samples to retain (FIFO)
};

export type Sample = {
  name: string;
  duration: number;
  timestamp: number;
};

export type ProfilerSummary = {
  enabled: boolean;
  sampleRate: number;
  maxSamples: number;
  samples: Sample[];
  stats: {
    totalSamples: number;
    byName: Record<string, { count: number; avgDuration: number; maxDuration: number; minDuration: number }>;
  };
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function createProfiler(config: ProfilerConfig = {}) {
  const enabled = config.enabled ?? true;
  const sampleRate = clamp(config.sampleRate ?? 1, 0, 1);
  const maxSamples = Math.max(1, config.maxSamples ?? 100);
  const samples: Sample[] = [];

  const shouldRecord = () => enabled && Math.random() <= sampleRate;

  const record = (name: string, duration: number) => {
    if (!shouldRecord()) return;
    const sample: Sample = { name, duration, timestamp: Date.now() };
    samples.push(sample);
    if (samples.length > maxSamples) {
      samples.splice(0, samples.length - maxSamples);
    }
  };

  const getStats = () => {
    const byName: Record<string, { count: number; sum: number; max: number; min: number }> = {};

    for (const s of samples) {
      if (!byName[s.name]) {
        byName[s.name] = { count: 0, sum: 0, max: s.duration, min: s.duration };
      }
      const stat = byName[s.name];
      stat.count++;
      stat.sum += s.duration;
      stat.max = Math.max(stat.max, s.duration);
      stat.min = Math.min(stat.min, s.duration);
    }

    const result: Record<string, { count: number; avgDuration: number; maxDuration: number; minDuration: number }> = {};
    for (const [name, stat] of Object.entries(byName)) {
      result[name] = {
        count: stat.count,
        avgDuration: stat.sum / stat.count,
        maxDuration: stat.max,
        minDuration: stat.min,
      };
    }

    return result;
  };

  return {
    profile<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
      const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
      try {
        const result = fn();
        if (result && typeof (result as Promise<T>).then === 'function') {
          return (result as Promise<T>).finally(() => {
            const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
            record(name, end - start);
          });
        }
        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        record(name, end - start);
        return result;
      } catch (error) {
        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        record(name, end - start);
        throw error;
      }
    },

    profileAsync<T>(name: string, asyncFn: () => Promise<T>): Promise<T> {
      const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
      return asyncFn().finally(() => {
        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        record(name, end - start);
      });
    },

    getSummary(): ProfilerSummary {
      return {
        enabled,
        sampleRate,
        maxSamples,
        samples: [...samples],
        stats: {
          totalSamples: samples.length,
          byName: getStats(),
        },
      };
    },

    clear(): void {
      samples.length = 0;
    },

    getConfig(): Required<ProfilerConfig> {
      return { enabled, sampleRate, maxSamples };
    },

    setConfig(config: Partial<ProfilerConfig>): void {
      if (config.enabled !== undefined) config.enabled;
      if (config.sampleRate !== undefined) config.sampleRate;
      if (config.maxSamples !== undefined) config.maxSamples;
    },
  };
}

// Global profiler instance
let globalProfiler = createProfiler();

export function getGlobalProfiler() {
  return globalProfiler;
}

export function setGlobalProfiler(profiler: ReturnType<typeof createProfiler>) {
  globalProfiler = profiler;
}

export function profile<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
  return globalProfiler.profile(name, fn);
}

export function profileAsync<T>(name: string, asyncFn: () => Promise<T>): Promise<T> {
  return globalProfiler.profileAsync(name, asyncFn);
}

export function getProfilerSummary(): ProfilerSummary {
  return globalProfiler.getSummary();
}

export function clearProfiler(): void {
  globalProfiler.clear();
}

export default {
  createProfiler,
  getGlobalProfiler,
  setGlobalProfiler,
  profile,
  profileAsync,
  getProfilerSummary,
  clearProfiler,
};