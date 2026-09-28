export interface PerformanceBenchmark {
  name: string;
  timestamp: number;
  metrics: {
    LCP?: number;
    FID?: number;
    CLS?: number;
    FCP?: number;
    TTFB?: number;
  };
}

const BENCHMARK_STORAGE_KEY = 'performance-benchmarks';
const MAX_BENCHMARKS = 50;

export function saveBenchmark(name: string, metrics: PerformanceBenchmark['metrics']): void {
  const benchmarks = loadBenchmarks();
  benchmarks.push({
    name,
    timestamp: Date.now(),
    metrics,
  });

  if (benchmarks.length > MAX_BENCHMARKS) {
    benchmarks.shift();
  }

  localStorage.setItem(BENCHMARK_STORAGE_KEY, JSON.stringify(benchmarks));
}

export function loadBenchmarks(): PerformanceBenchmark[] {
  try {
    const stored = localStorage.getItem(BENCHMARK_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function detectRegression(currentMetrics: PerformanceBenchmark['metrics']): {
  hasRegression: boolean;
  details: Array<{ metric: string; current: number; baseline: number; delta: number }>;
} {
  const benchmarks = loadBenchmarks();
  if (benchmarks.length < 5) {
    return { hasRegression: false, details: [] };
  }

  const recentBaseline = benchmarks.slice(-5);
  const avgMetrics: Record<string, number> = {};

  Object.keys(currentMetrics).forEach(key => {
    const values = recentBaseline
      .map(b => b.metrics[key as keyof typeof b.metrics])
      .filter((v): v is number => v !== undefined);
    
    if (values.length > 0) {
      avgMetrics[key] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  });

  const details: Array<{ metric: string; current: number; baseline: number; delta: number }> = [];
  let hasRegression = false;

  Object.entries(currentMetrics).forEach(([metric, current]) => {
    if (current === undefined || avgMetrics[metric] === undefined) return;

    const baseline = avgMetrics[metric];
    const delta = ((current - baseline) / baseline) * 100;

    if (delta > 20) {
      hasRegression = true;
      details.push({ metric, current, baseline, delta });
    }
  });

  return { hasRegression, details };
}

export function clearBenchmarks(): void {
  localStorage.removeItem(BENCHMARK_STORAGE_KEY);
}
