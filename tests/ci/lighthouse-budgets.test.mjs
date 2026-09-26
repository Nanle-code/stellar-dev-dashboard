import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  SUPPORTED_DEVICES,
  KEY_ROUTES,
  BUDGET_DEFINITIONS,
  DEFAULT_CHROME_FLAGS,
  BudgetValidationError,
  validateDevice,
  validateBudgetConfig,
  normalizeRoutePath,
  routeToUrlPattern,
  validateMetricValue,
  getDeviceBudgets,
  generateAssertMatrix,
  generateLighthouseBudgets,
  checkEnvironmentSupport,
  evaluateBudgetResults,
} = require('../../scripts/lighthouse-budgets.cjs');

import * as cli from '../../scripts/enforce-lighthouse-budgets.mjs';

describe('Lighthouse Performance Budgets System', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // 1. PRIMARY FLOW
  // ══════════════════════════════════════════════════════════════════════════
  describe('Primary Flow', () => {
    it('defines supported device profiles for desktop and mobile', () => {
      expect(SUPPORTED_DEVICES).toContain('desktop');
      expect(SUPPORTED_DEVICES).toContain('mobile');
      expect(SUPPORTED_DEVICES.length).toBe(2);
    });

    it('covers all key dashboard routes in budget definitions', () => {
      for (const route of KEY_ROUTES) {
        expect(BUDGET_DEFINITIONS.desktop.routes[route]).toBeDefined();
        expect(BUDGET_DEFINITIONS.mobile.routes[route]).toBeDefined();
      }
    });

    it('enforces LCP, CLS, and TBT metrics for every desktop and mobile route', () => {
      for (const device of SUPPORTED_DEVICES) {
        const budgets = BUDGET_DEFINITIONS[device];
        expect(budgets.routes).toBeTypeOf('object');

        for (const [routePath, metrics] of Object.entries(budgets.routes)) {
          expect(metrics.largestContentfulPaint, `${device} ${routePath} LCP`).toBeGreaterThan(0);
          expect(
            metrics.cumulativeLayoutShift,
            `${device} ${routePath} CLS`
          ).toBeGreaterThanOrEqual(0);
          expect(metrics.cumulativeLayoutShift, `${device} ${routePath} CLS`).toBeLessThanOrEqual(
            1.0
          );
          expect(metrics.totalBlockingTime, `${device} ${routePath} TBT`).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('generates valid LHCI assertMatrix for desktop with route patterns', () => {
      const matrix = generateAssertMatrix('desktop');
      expect(Array.isArray(matrix)).toBe(true);
      expect(matrix.length).toBeGreaterThan(1);

      // Baseline pattern exists
      const baseline = matrix.find((m) => m.matchingUrlPattern === '.*');
      expect(baseline).toBeDefined();
      expect(baseline.assertions['categories:performance']).toBeDefined();
      expect(baseline.assertions['largest-contentful-paint']).toBeDefined();
      expect(baseline.assertions['cumulative-layout-shift']).toBeDefined();
      expect(baseline.assertions['total-blocking-time']).toBeDefined();

      // Route-specific assertions exist
      const connectPattern = matrix.find((m) => m.matchingUrlPattern.includes('connect'));
      expect(connectPattern).toBeDefined();
      expect(connectPattern.assertions['largest-contentful-paint']).toEqual([
        'error',
        { maxNumericValue: 1800 },
      ]);
      expect(connectPattern.assertions['cumulative-layout-shift']).toEqual([
        'error',
        { maxNumericValue: 0.05 },
      ]);
      expect(connectPattern.assertions['total-blocking-time']).toEqual([
        'error',
        { maxNumericValue: 150 },
      ]);
    });

    it('generates valid LHCI assertMatrix for mobile with mobile-tailored thresholds', () => {
      const matrix = generateAssertMatrix('mobile');
      expect(Array.isArray(matrix)).toBe(true);

      const overviewPattern = matrix.find((m) => m.matchingUrlPattern.includes('overview'));
      expect(overviewPattern).toBeDefined();
      expect(overviewPattern.assertions['largest-contentful-paint']).toEqual([
        'error',
        { maxNumericValue: 3500 },
      ]);
      expect(overviewPattern.assertions['cumulative-layout-shift']).toEqual([
        'error',
        { maxNumericValue: 0.1 },
      ]);
      expect(overviewPattern.assertions['total-blocking-time']).toEqual([
        'error',
        { maxNumericValue: 500 },
      ]);
    });

    it('generates standard Lighthouse budgets.json array for desktop and mobile', () => {
      const desktopBudgets = generateLighthouseBudgets('desktop');
      expect(Array.isArray(desktopBudgets)).toBe(true);
      expect(desktopBudgets.length).toBeGreaterThanOrEqual(KEY_ROUTES.length - 1);

      const connectBudget = desktopBudgets.find((b) => b.path === '/connect');
      expect(connectBudget).toBeDefined();
      expect(connectBudget.timings).toEqual(
        expect.arrayContaining([
          { metric: 'largest-contentful-paint', budget: 1800 },
          { metric: 'cumulative-layout-shift', budget: 0.05 },
          { metric: 'total-blocking-time', budget: 150 },
        ])
      );
      expect(connectBudget.resourceSizes).toBeDefined();

      const mobileBudgets = generateLighthouseBudgets('mobile');
      const mobileConnect = mobileBudgets.find((b) => b.path === '/connect');
      expect(mobileConnect.timings).toEqual(
        expect.arrayContaining([
          { metric: 'largest-contentful-paint', budget: 2500 },
          { metric: 'cumulative-layout-shift', budget: 0.05 },
          { metric: 'total-blocking-time', budget: 250 },
        ])
      );
    });

    it('successfully evaluates passing metrics within budget', () => {
      const result = evaluateBudgetResults('desktop', '/overview', {
        LCP: 2200,
        CLS: 0.04,
        TBT: 180,
        performanceScore: 85,
      });

      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
      expect(result.summary.status).toBe('PASSED');
      expect(result.summary.violationCount).toBe(0);
    });

    it('includes standard headless flags for non-flaky browser execution', () => {
      expect(DEFAULT_CHROME_FLAGS).toContain('--no-sandbox');
      expect(DEFAULT_CHROME_FLAGS).toContain('--headless=new');
      expect(DEFAULT_CHROME_FLAGS).toContain('--disable-dev-shm-usage');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. BOUNDARY CASES
  // ══════════════════════════════════════════════════════════════════════════
  describe('Boundary Cases', () => {
    it('passes when metric values exactly equal the budget threshold', () => {
      // Desktop /overview: LCP: 2500, CLS: 0.10, TBT: 300
      const boundaryResult = evaluateBudgetResults('desktop', '/overview', {
        LCP: 2500,
        CLS: 0.1,
        TBT: 300,
        performanceScore: 70, // Min desktop score is 0.70 * 100
      });

      expect(boundaryResult.passed).toBe(true);
      expect(boundaryResult.violations.length).toBe(0);
    });

    it('handles zero total blocking time (TBT = 0)', () => {
      const result = evaluateBudgetResults('mobile', '/connect', {
        LCP: 1200,
        CLS: 0,
        TBT: 0,
        performanceScore: 98,
      });

      expect(result.passed).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('normalizes route paths with and without trailing slashes', () => {
      expect(normalizeRoutePath('/connect')).toBe('/connect');
      expect(normalizeRoutePath('/connect/')).toBe('/connect');
      expect(normalizeRoutePath('/')).toBe('/');
      expect(normalizeRoutePath('/*')).toBe('/*');
      expect(normalizeRoutePath('  /analytics/  ')).toBe('/analytics');
    });

    it('evaluates routes with trailing slashes against the same budget', () => {
      const withoutSlash = evaluateBudgetResults('desktop', '/analytics', {
        LCP: 2900,
        CLS: 0.05,
        TBT: 350,
      });
      const withSlash = evaluateBudgetResults('desktop', '/analytics/', {
        LCP: 2900,
        CLS: 0.05,
        TBT: 350,
      });

      expect(withoutSlash.passed).toBe(true);
      expect(withSlash.passed).toBe(true);
      expect(withoutSlash.summary.route).toBe(withSlash.summary.route);
    });

    it('applies custom assertion overrides when generating assertMatrix', () => {
      const customOverrides = {
        '/connect': {
          'largest-contentful-paint': ['error', { maxNumericValue: 1200 }],
        },
      };

      const matrix = generateAssertMatrix('desktop', { customOverrides });
      const connectEntry = matrix.find((m) => m.matchingUrlPattern.includes('connect'));
      expect(connectEntry.assertions['largest-contentful-paint']).toEqual([
        'error',
        { maxNumericValue: 1200 },
      ]);
    });

    it('matches root URL pattern correctly', () => {
      const pattern = routeToUrlPattern('/');
      const regex = new RegExp(pattern);

      expect(regex.test('http://localhost:4173/')).toBe(true);
      expect(regex.test('http://localhost:4173')).toBe(true);
      expect(regex.test('http://localhost:4173/connect')).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. FAILURE CASES & INVALID INPUT
  // ══════════════════════════════════════════════════════════════════════════
  describe('Failure Cases & Invalid Input Handling', () => {
    it('detects LCP violation and provides actionable remediation guidance', () => {
      const result = evaluateBudgetResults('desktop', '/connect', {
        LCP: 2100, // Budget is 1800ms
        CLS: 0.02,
        TBT: 100,
      });

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBe(1);
      const v = result.violations[0];
      expect(v.metric).toBe('largest-contentful-paint');
      expect(v.actual).toBe(2100);
      expect(v.budget).toBe(1800);
      expect(v.delta).toBe(300);
      expect(v.remediation).toMatch(/defer|preload|prioritize/i);
    });

    it('detects multiple simultaneous Core Web Vitals violations', () => {
      const result = evaluateBudgetResults('desktop', '/overview', {
        LCP: 3200, // Budget: 2500
        CLS: 0.25, // Budget: 0.10
        TBT: 600, // Budget: 300
        performanceScore: 55, // Budget: 70
      });

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBe(4);
      const metricNames = result.violations.map((v) => v.metric);
      expect(metricNames).toContain('largest-contentful-paint');
      expect(metricNames).toContain('cumulative-layout-shift');
      expect(metricNames).toContain('total-blocking-time');
      expect(metricNames).toContain('performance-score');
    });

    it('rejects unsupported device names with clear error', () => {
      expect(() => validateDevice('tablet')).toThrow(/unsupported device/i);
      expect(() => validateDevice('smartwatch')).toThrow(/unsupported device/i);
      expect(() => validateDevice(null)).toThrow(/must be a string/i);
      expect(() => validateDevice(123)).toThrow(/must be a string/i);
    });

    it('rejects invalid metric values (negative, NaN, non-finite)', () => {
      expect(() => validateMetricValue('LCP', -50)).toThrow(/cannot be less than 0/i);
      expect(() => validateMetricValue('LCP', NaN)).toThrow(/must be a finite number/i);
      expect(() => validateMetricValue('LCP', Infinity)).toThrow(/must be a finite number/i);
      expect(() => validateMetricValue('LCP', 'fast')).toThrow(/must be a finite number/i);
      expect(() => validateMetricValue('CLS', 1.5, { max: 1.0 })).toThrow(/cannot exceed 1/i);
    });

    it('rejects invalid route definitions', () => {
      expect(() => normalizeRoutePath('')).toThrow(/non-empty string/i);
      expect(() => normalizeRoutePath('   ')).toThrow(/non-empty string/i);
      expect(() => normalizeRoutePath(null)).toThrow(/non-empty string/i);
    });

    it('validates budget configuration schema and rejects malformed objects', () => {
      expect(() => validateBudgetConfig(null)).toThrow(/non-null object/i);
      expect(() => validateBudgetConfig([])).toThrow(/non-null object/i);
      expect(() => validateBudgetConfig({ other: {} })).toThrow(/missing required device profile/i);
      expect(() => validateBudgetConfig({ desktop: {}, mobile: {} })).toThrow(
        /must define a "routes" map/i
      );

      // Missing required metric
      const brokenConfig = {
        desktop: {
          routes: {
            '/': {
              largestContentfulPaint: 2500,
              // missing CLS & TBT
            },
          },
        },
        mobile: { routes: {} },
      };
      expect(() => validateBudgetConfig(brokenConfig)).toThrow(/missing required metric/i);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. CLI RUNNER & ENVIRONMENT HANDLING
  // ══════════════════════════════════════════════════════════════════════════
  describe('CLI Runner & Environment Checks', () => {
    it('parses valid CLI options', () => {
      const opts = cli.parseArgs([
        '--device=mobile',
        '--report-dir=custom-lhci',
        '--strict',
        '--json',
      ]);
      expect(opts.device).toBe('mobile');
      expect(opts.strict).toBe(true);
      expect(opts.json).toBe(true);
      expect(opts.reportDir).toContain('custom-lhci');
    });

    it('fails fast on invalid CLI options', () => {
      expect(() => cli.parseArgs(['--unknown-flag'])).toThrow(/unknown argument/i);
      expect(() => cli.parseArgs(['--device=fridge'])).toThrow(/invalid device/i);
      expect(() => cli.parseArgs(['--device'])).toThrow(/missing value/i);
      expect(() => cli.parseArgs(['--report-dir'])).toThrow(/missing value/i);
    });

    it('extracts route path correctly from URLs', () => {
      expect(cli.extractRouteFromUrl('http://localhost:4173/')).toBe('/');
      expect(cli.extractRouteFromUrl('http://localhost:4173/connect')).toBe('/connect');
      expect(cli.extractRouteFromUrl('http://localhost:4173/analytics?tab=live')).toBe(
        '/analytics'
      );
      expect(cli.extractRouteFromUrl('invalid-url')).toBe('/');
    });

    it('detects build environment support accurately', () => {
      const envCheck = checkEnvironmentSupport();
      expect(envCheck).toBeTypeOf('object');
      expect(Array.isArray(envCheck.warnings)).toBe(true);
      expect(Array.isArray(envCheck.errors)).toBe(true);
      // Since dist/ exists from our build step, supported should be true
      expect(envCheck.supported).toBe(true);
    });

    it('fails environment check when dist directory is missing', () => {
      const fakeDir = path.resolve(__dirname, 'non_existent_dist_dir_12345');
      const envCheck = checkEnvironmentSupport(fakeDir);
      expect(envCheck.supported).toBe(false);
      expect(envCheck.errors.some((e) => e.includes('Build directory not found'))).toBe(true);
    });

    it('parses simulated LHR file and extracts Web Vitals', () => {
      const tempLhrPath = path.resolve(__dirname, 'test-lhr-temp.json');
      const sampleLhr = {
        finalUrl: 'http://localhost:4173/overview',
        configSettings: { formFactor: 'desktop' },
        categories: { performance: { score: 0.92 } },
        audits: {
          'largest-contentful-paint': { numericValue: 2150 },
          'cumulative-layout-shift': { numericValue: 0.035 },
          'total-blocking-time': { numericValue: 120 },
          'first-contentful-paint': { numericValue: 1100 },
        },
      };

      fs.writeFileSync(tempLhrPath, JSON.stringify(sampleLhr), 'utf8');

      try {
        const parsed = cli.parseLhrFile(tempLhrPath);
        expect(parsed.url).toBe('http://localhost:4173/overview');
        expect(parsed.formFactor).toBe('desktop');
        expect(parsed.metrics.LCP).toBe(2150);
        expect(parsed.metrics.CLS).toBe(0.035);
        expect(parsed.metrics.TBT).toBe(120);
        expect(parsed.metrics.performanceScore).toBe(92);
      } finally {
        if (fs.existsSync(tempLhrPath)) {
          fs.unlinkSync(tempLhrPath);
        }
      }
    });

    it('returns exit code 3 when reports directory is not found', async () => {
      const code = await cli.run(['--report-dir=non-existent-report-dir-xyz']);
      expect(code).toBe(3);
    });
  });
});
