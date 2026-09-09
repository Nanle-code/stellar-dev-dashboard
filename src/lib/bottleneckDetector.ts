// ML/Heuristic-based bottleneck detection for performance profiling
// Uses interpretable linear model with sigmoid activation for scoring

import { PERFORMANCE_BUDGETS } from './performanceMonitoring.js';

export type BottleneckCategory =
  | 'cpu'
  | 'memory'
  | 'network'
  | 'bundle'
  | 'web-vitals'
  | 'custom';

export type BottleneckSeverity = 'critical' | 'high' | 'medium' | 'low';

export type Bottleneck = {
  name: string;
  category: BottleneckCategory;
  score: number; // 0..1 confidence
  severity: BottleneckSeverity;
  reason: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  metadata?: Record<string, unknown>;
};

export type BottleneckFeatures = {
  normalizedValue: number;
  budgetRatio: number;
  p95Ratio: number;
  countNormalized: number;
  trendSlope: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
};

const DEFAULT_WEIGHTS = {
  normalizedValue: 0.55,
  budgetRatio: 0.3,
  p95Ratio: 0.05,
  countNormalized: 0.02,
  trendSlope: 0.01,
  trendIncreasing: 0.05,
  bias: -0.05,
};

const CATEGORY_KEYWORDS: Record<BottleneckCategory, string[]> = {
  cpu: ['longtask', 'parse', 'compile', 'evaluate', 'jank', 'frame', 'fps'],
  memory: ['heap', 'memory', 'gc', 'allocation', 'leak', 'retained'],
  network: ['api', 'request', 'response', 'ttfb', 'fetch', 'xhr', 'network', 'latency'],
  bundle: ['bundle', 'javascript', 'css', 'image', 'size', 'payload'],
  'web-vitals': ['lcp', 'fid', 'cls', 'fcp', 'ttfb', 'inp'],
  custom: [],
};

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function scoreFeatures(features: BottleneckFeatures, weights = DEFAULT_WEIGHTS): number {
  const linear =
    features.normalizedValue * weights.normalizedValue +
    features.budgetRatio * weights.budgetRatio +
    features.p95Ratio * weights.p95Ratio +
    features.countNormalized * weights.countNormalized +
    features.trendSlope * weights.trendSlope +
    (features.trendDirection === 'increasing' ? weights.trendIncreasing : 0) +
    weights.bias;
  return clamp(sigmoid(linear));
}

export function categorizeMetric(name: string): BottleneckCategory {
  const lower = name.toLowerCase();

  // Explicit patterns for common metric names - check these FIRST
  if (lower.startsWith('bundle:') || lower.startsWith('js_bundle') || lower.startsWith('css_bundle')) {
    return 'bundle';
  }
  if (lower.startsWith('lcp') || lower.startsWith('fid') || lower.startsWith('cls') || lower.startsWith('fcp') || lower.startsWith('inp')) {
    return 'web-vitals';
  }
  if (lower.startsWith('longtask') || lower.includes('long_task') || lower.startsWith('script_') || lower.startsWith('parse_') || lower.startsWith('frame_')) {
    return 'cpu';
  }
  if (lower.startsWith('heap') || lower.startsWith('memory')) {
    return 'memory';
  }
  if (lower.startsWith('api_') || lower.startsWith('request_') || lower.startsWith('response_') || lower.startsWith('ttfb')) {
    return 'network';
  }
  if (lower.startsWith('javascript') || lower.startsWith('css_') || lower.startsWith('image_')) {
    return 'bundle';
  }

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category as BottleneckCategory;
    }
  }

  if (lower.includes('time') || lower.includes('duration') || lower.includes('latency')) {
    return 'network';
  }

  return 'custom';
}

function getSeverity(score: number): BottleneckSeverity {
  if (score >= 0.7) return 'critical';
  if (score >= 0.55) return 'high';
  if (score >= 0.35) return 'medium';
  return 'low';
}

function getImpactEffort(category: BottleneckCategory, score: number): { impact: 'high' | 'medium' | 'low'; effort: 'high' | 'medium' | 'low' } {
  const impactMap: Record<BottleneckCategory, 'high' | 'medium' | 'low'> = {
    cpu: 'high',
    memory: 'high',
    network: 'medium',
    bundle: 'high',
    'web-vitals': 'high',
    custom: 'medium',
  };

  const effortMap: Record<BottleneckCategory, 'high' | 'medium' | 'low'> = {
    cpu: 'medium',
    memory: 'high',
    network: 'low',
    bundle: 'medium',
    'web-vitals': 'medium',
    custom: 'medium',
  };

  const baseImpact = impactMap[category] || 'medium';
  const baseEffort = effortMap[category] || 'medium';

  if (score >= 0.8) {
    return { impact: 'high', effort: baseEffort };
  }
  if (score >= 0.6) {
    return { impact: baseImpact, effort: baseEffort };
  }
  return { impact: 'low', effort: 'low' };
}

function computeBudgetRatio(value: number, budget: number): number {
  if (budget <= 0) return 0;
  return clamp(value / (budget * 1.25));
}

function computeP95Ratio(values: number[], budget: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)] || sorted[sorted.length - 1];
  if (budget <= 0) return 0;
  return clamp(p95 / (budget * 1.25));
}

export interface MetricData {
  name: string;
  values: number[];
  budget?: number;
  count?: number;
  trendSlope?: number;
  trendDirection?: 'increasing' | 'decreasing' | 'stable';
}

export function detectBottlenecks(metrics: MetricData[], threshold = 0.5): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];

  for (const metric of metrics) {
    const { name, values, budget = getMetricBudget(name) } = metric;
    if (!values || values.length === 0) continue;

    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const max = Math.max(...values);
    const count = values.length;

    const normalizedValue = clamp(avg / (budget || 10000));
    const budgetRatio = computeBudgetRatio(max, budget);
    const p95Ratio = computeP95Ratio(values, budget);
    const countNormalized = clamp(count / 1000);
    const trendSlope = metric.trendSlope ?? 0;
    const trendDirection = metric.trendDirection ?? 'stable';

    const features: BottleneckFeatures = {
      normalizedValue,
      budgetRatio,
      p95Ratio,
      countNormalized,
      trendSlope: clamp(Math.abs(trendSlope) * 1000),
      trendDirection,
    };

    const score = scoreFeatures(features);
    if (score < threshold) continue;

    const category = categorizeMetric(name);
    const severity = getSeverity(score);
    const { impact, effort } = getImpactEffort(category, score);

    const bottleneck: Bottleneck = {
      name,
      category,
      score,
      severity,
      reason: generateReason(name, category, score, budgetRatio, trendDirection),
      recommendation: generateRecommendation(category, name, score),
      impact,
      effort,
      metadata: {
        avg,
        max,
        count,
        budget,
        budgetRatio,
        p95Ratio,
        trendSlope,
        trendDirection,
      },
    };

    bottlenecks.push(bottleneck);
  }

  return bottlenecks.sort((a, b) => b.score - a.score);
}

function getMetricBudget(name: string): number {
  const budget = PERFORMANCE_BUDGETS[name as keyof typeof PERFORMANCE_BUDGETS];
  return typeof budget === 'number' ? budget : 10000;
}

function generateReason(
  name: string,
  category: BottleneckCategory,
  score: number,
  budgetRatio: number,
  trendDirection: 'increasing' | 'decreasing' | 'stable'
): string {
  const severity = getSeverity(score);
  const trendStr = trendDirection === 'increasing' ? ' and trending upward' : trendDirection === 'decreasing' ? ' but improving' : '';
  const budgetStr = budgetRatio > 0.8 ? ' exceeding budget' : budgetRatio > 0.5 ? ' approaching budget' : '';

  return `${severity.toUpperCase()} ${category} bottleneck: ${name} is consistently slow${budgetStr}${trendStr} (confidence: ${(score * 100).toFixed(0)}%)`;
}

function generateRecommendation(category: BottleneckCategory, name: string, score: number): string {
  const baseRecs: Record<BottleneckCategory, string> = {
    cpu: 'Profile CPU usage with Chrome DevTools Performance tab. Break long tasks into smaller chunks using requestIdleCallback or Web Workers. Minimize main-thread JavaScript execution.',
    memory: 'Take heap snapshots to identify retained objects. Check for closure leaks, event listener leaks, and unbounded caches. Implement WeakMap/WeakRef where appropriate.',
    network: 'Implement caching (Cache-Control, SWR). Add request deduplication. Consider GraphQL/REST optimization. Use compression (Brotli/Gzip). Preload critical resources.',
    bundle: 'Enable code splitting with dynamic imports. Remove unused dependencies. Enable tree shaking. Compress with Brotli/Gzip. Lazy-load non-critical components.',
    'web-vitals': 'For LCP: optimize critical rendering path, preload hero images. For FID/INP: reduce main-thread blocking, defer non-critical JS. For CLS: reserve space for dynamic content.',
    custom: 'Investigate the specific metric. Collect traces for the slow path. Apply targeted optimization: caching, algorithmic improvement, or architectural change.',
  };

  let rec = baseRecs[category] || baseRecs.custom;

  if (score >= 0.85) {
    rec = `CRITICAL: ${rec} Immediate action required.`;
  } else if (score >= 0.7) {
    rec = `HIGH PRIORITY: ${rec} Schedule fix in current sprint.`;
  }

  return rec;
}

export function getBottleneckStats(bottlenecks: Bottleneck[]): {
  total: number;
  byCategory: Record<BottleneckCategory, number>;
  bySeverity: Record<BottleneckSeverity, number>;
  criticalCount: number;
} {
  const byCategory: Record<BottleneckCategory, number> = {
    cpu: 0,
    memory: 0,
    network: 0,
    bundle: 0,
    'web-vitals': 0,
    custom: 0,
  };
  const bySeverity: Record<BottleneckSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const b of bottlenecks) {
    byCategory[b.category]++;
    bySeverity[b.severity]++;
  }

  return {
    total: bottlenecks.length,
    byCategory,
    bySeverity,
    criticalCount: bySeverity.critical + bySeverity.high,
  };
}

export default {
  detectBottlenecks,
  getBottleneckStats,
  categorizeMetric,
  scoreFeatures,
};