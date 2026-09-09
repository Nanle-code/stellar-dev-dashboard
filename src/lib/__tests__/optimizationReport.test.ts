import { describe, it, expect, vi } from 'vitest';
import { generateOptimizationReport, formatReport, exportReportJSON, exportReportCSV, type OptimizationReport } from '../optimizationReport.js';

// Mock the dependencies
vi.mock('../performanceMonitoring.js', () => ({
  getMetricsSummary: () => ({
    customMetrics: {
      API_RESPONSE_TIME: { average: 1200, count: 50, max: 2000 },
      QUICK_TASK: { average: 5, count: 200, max: 10 },
    },
    webVitals: {
      LCP: { value: 3200 },
      FID: { value: 150 },
      CLS: { value: 0.15 },
    },
    resources: {
      total: 25,
      totalSize: 1.5 * 1024 * 1024,
      byType: {
        script: { count: 10, totalSize: 800 * 1024, totalDuration: 500 },
        link: { count: 5, totalSize: 150 * 1024, totalDuration: 100 },
        img: { count: 10, totalSize: 600 * 1024, totalDuration: 200 },
      },
    },
    regressions: [],
    interactions: [],
  }),
  getAllMetrics: () => ({
    webVitals: [],
    customMetrics: [],
    resourceTimings: [],
    navigationTiming: null,
    regressions: [],
    interactions: [],
  }),
  PERFORMANCE_BUDGETS: {
    LCP: 2500,
    FID: 100,
    CLS: 0.1,
    FCP: 1800,
    TTFB: 800,
    LongTask: 200,
    API_RESPONSE_TIME: 1000,
    TRANSACTION_SIGNING_DURATION: 3000,
    TRANSACTION_SUBMIT_DURATION: 4000,
    CONTRACT_SIMULATION_DURATION: 3000,
    CONTRACT_INVOCATION_DURATION: 6000,
    USER_INTERACTION: 1,
    RENDER_TIME: 100,
    JS_BUNDLE_SIZE: 500 * 1024,
    CSS_BUNDLE_SIZE: 100 * 1024,
    IMAGE_SIZE: 200 * 1024,
    TOTAL_PAGE_SIZE: 2 * 1024 * 1024,
  },
}));

vi.mock('../profiler.js', () => ({
  createProfiler: () => ({
    profile: vi.fn(),
    getSummary: () => ({
      enabled: true,
      sampleRate: 1,
      maxSamples: 1000,
      samples: [],
      totalSamplesCollected: 0,
      droppedSamples: 0,
    }),
  }),
}));

vi.mock('../bottleneckDetector.js', () => ({
  detectBottlenecks: vi.fn((metrics) => metrics.map((m) => ({
    name: m.name,
    category: 'custom' as const,
    score: 0.8,
    severity: 'high' as const,
    reason: `The ${m.name} metric is consistently above the expected operating range`,
    recommendation: 'Optimize this metric',
    impact: 'high' as const,
    effort: 'medium' as const,
    metadata: {},
  }))),
  getBottleneckStats: vi.fn((bottlenecks) => ({
    total: bottlenecks.length,
    byCategory: { cpu: 0, memory: 0, network: 0, bundle: 0, 'web-vitals': 0, custom: bottlenecks.length },
    bySeverity: { critical: 0, high: bottlenecks.length, medium: 0, low: 0 },
    criticalCount: bottlenecks.length,
  })),
}));

vi.mock('../trendAnalyzer.js', () => ({
  analyzeMultipleTrends: vi.fn(() => [
    {
      name: 'API_RESPONSE_TIME',
      slope: 10,
      intercept: 1000,
      rSquared: 0.85,
      direction: 'increasing' as const,
      confidence: 0.8,
      points: 10,
      timeRange: { start: Date.now() - 600000, end: Date.now() },
      trendLine: [],
      anomalies: [],
    },
    {
      name: 'QUICK_TASK',
      slope: -0.5,
      intercept: 5,
      rSquared: 0.3,
      direction: 'stable' as const,
      confidence: 0.5,
      points: 10,
      timeRange: { start: Date.now() - 600000, end: Date.now() },
      trendLine: [],
      anomalies: [],
    },
  ]),
}));

describe('optimizationReport', () => {
  describe('generateOptimizationReport', () => {
    it('generates a complete report structure', () => {
      const report = generateOptimizationReport();
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('timeRange');
      expect(report).toHaveProperty('overview');
      expect(report).toHaveProperty('bottlenecks');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('resourceSummary');
      expect(report).toHaveProperty('webVitalsSummary');
    });

    it('includes performance score in overview', () => {
      const report = generateOptimizationReport();
      expect(typeof report.overview.performanceScore).toBe('number');
      expect(report.overview.performanceScore).toBeGreaterThanOrEqual(0);
      expect(report.overview.performanceScore).toBeLessThanOrEqual(100);
    });

    it('includes bottleneck counts', () => {
      const report = generateOptimizationReport();
      expect(typeof report.overview.totalBottlenecks).toBe('number');
      expect(typeof report.overview.criticalBottlenecks).toBe('number');
    });

    it('includes trend summary', () => {
      const report = generateOptimizationReport();
      expect(report.overview.trendSummary).toHaveProperty('improving');
      expect(report.overview.trendSummary).toHaveProperty('degrading');
      expect(report.overview.trendSummary).toHaveProperty('stable');
    });

    it('includes profiler summary when provided', () => {
      const profilerSummary = {
        enabled: true,
        sampleRate: 0.1,
        maxSamples: 100,
        samples: [],
        stats: { totalSamples: 0, byName: {} },
      };
      const report = generateOptimizationReport(profilerSummary);
      expect(report.profilerSummary).toEqual(profilerSummary);
    });

    it('includes resource summary', () => {
      const report = generateOptimizationReport();
      expect(report.resourceSummary).toHaveProperty('totalResources');
      expect(report.resourceSummary).toHaveProperty('totalSize');
      expect(report.resourceSummary).toHaveProperty('jsBundleSize');
      expect(report.resourceSummary).toHaveProperty('cssBundleSize');
      expect(report.resourceSummary).toHaveProperty('imageSize');
      expect(report.resourceSummary).toHaveProperty('budgetViolations');
    });

    it('includes web vitals summary', () => {
      const report = generateOptimizationReport();
      expect(report.webVitalsSummary).toHaveProperty('LCP');
      expect(report.webVitalsSummary).toHaveProperty('FID');
      expect(report.webVitalsSummary).toHaveProperty('CLS');
      expect(report.webVitalsSummary.LCP).toHaveProperty('value');
      expect(report.webVitalsSummary.LCP).toHaveProperty('budget');
      expect(report.webVitalsSummary.LCP).toHaveProperty('withinBudget');
    });

    it('generates recommendations', () => {
      const report = generateOptimizationReport();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);
      for (const rec of report.recommendations) {
        expect(rec).toHaveProperty('id');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('category');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('impact');
        expect(rec).toHaveProperty('effort');
        expect(rec).toHaveProperty('affectedMetrics');
      }
    });
  });

  describe('formatReport', () => {
    it('formats report as readable text', () => {
      const report = generateOptimizationReport();
      const formatted = formatReport(report);
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('PERFORMANCE OPTIMIZATION REPORT');
      expect(formatted).toContain('OVERVIEW');
      expect(formatted).toContain('BOTTLENECKS');
      expect(formatted).toContain('TRENDS');
      expect(formatted).toContain('RECOMMENDATIONS');
      expect(formatted).toContain('RESOURCE SUMMARY');
      expect(formatted).toContain('WEB VITALS');
    });

    it('includes performance score in output', () => {
      const report = generateOptimizationReport();
      const formatted = formatReport(report);
      expect(formatted).toContain('Performance Score:');
    });

    it('formats bytes and milliseconds', () => {
      const report = generateOptimizationReport();
      const formatted = formatReport(report);
      expect(formatted).toContain('KB') || formatted.includes('MB') || formatted.includes('B');
      expect(formatted).toContain('ms');
    });
  });

  describe('exportReportJSON', () => {
    it('exports valid JSON', () => {
      const report = generateOptimizationReport();
      const json = exportReportJSON(report);
      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(report);
    });

    it('includes all report fields', () => {
      const report = generateOptimizationReport();
      const json = exportReportJSON(report);
      const parsed = JSON.parse(json);
      expect(parsed.generatedAt).toBe(report.generatedAt);
      expect(parsed.overview).toEqual(report.overview);
      expect(parsed.bottlenecks).toEqual(report.bottlenecks);
      expect(parsed.recommendations).toEqual(report.recommendations);
    });
  });

  describe('exportReportCSV', () => {
    it('exports CSV with bottlenecks section', () => {
      const report = generateOptimizationReport();
      const csv = exportReportCSV(report);
      expect(csv).toContain('BOTTLENECKS');
      expect(csv).toContain('Name,Category,Severity,Score');
    });

    it('exports CSV with trends section', () => {
      const report = generateOptimizationReport();
      const csv = exportReportCSV(report);
      expect(csv).toContain('TRENDS');
      expect(csv).toContain('Name,Direction,Slope');
    });

    it('exports CSV with recommendations section', () => {
      const report = generateOptimizationReport();
      const csv = exportReportCSV(report);
      expect(csv).toContain('RECOMMENDATIONS');
      expect(csv).toContain('Priority,Category,Title');
    });

    it('escapes quotes in CSV', () => {
      const report = generateOptimizationReport();
      // Add a recommendation with quotes
      report.recommendations[0].description = 'Test "quoted" text';
      const csv = exportReportCSV(report);
      expect(csv).toContain('Test ""quoted"" text');
    });
  });
});