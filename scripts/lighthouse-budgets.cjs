/**
 * Lighthouse Performance Budgets Specification & Enforcement Engine
 *
 * Defines and validates route-level Lighthouse performance budgets for
 * Mobile and Desktop targets. Enforces Core Web Vitals (LCP, CLS, TBT)
 * across key dashboard routes.
 *
 * @license Apache-2.0
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Standard supported device profiles
 * @type {ReadonlyArray<'desktop' | 'mobile'>}
 */
const SUPPORTED_DEVICES = Object.freeze(['desktop', 'mobile']);

/**
 * Key routes monitored for Lighthouse performance budgets
 * @type {ReadonlyArray<string>}
 */
const KEY_ROUTES = Object.freeze([
  '/*',
  '/',
  '/connect',
  '/overview',
  '/analytics',
  '/transactions',
  '/network',
  '/contracts',
  '/performance',
]);

/**
 * Default budgets per route and device.
 * Timings are in milliseconds, CLS is unitless score (0-1).
 */
const BUDGET_DEFINITIONS = Object.freeze({
  desktop: {
    preset: 'desktop',
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
    categories: {
      performance: { minScore: 0.7, warnScore: 0.8 },
      accessibility: { minScore: 0.9, warnScore: 0.95 },
      'best-practices': { minScore: 0.85, warnScore: 0.9 },
      seo: { minScore: 0.85, warnScore: 0.9 },
    },
    resourceSizes: [
      { resourceType: 'script', budget: 400 },
      { resourceType: 'total', budget: 800 },
      { resourceType: 'stylesheet', budget: 100 },
      { resourceType: 'document', budget: 50 },
      { resourceType: 'font', budget: 150 },
    ],
    routes: {
      '/*': {
        largestContentfulPaint: 2500,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 300,
        firstContentfulPaint: 2000,
      },
      '/': {
        largestContentfulPaint: 2500,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 300,
        firstContentfulPaint: 2000,
      },
      '/connect': {
        largestContentfulPaint: 1800,
        cumulativeLayoutShift: 0.05,
        totalBlockingTime: 150,
        firstContentfulPaint: 1200,
      },
      '/overview': {
        largestContentfulPaint: 2500,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 300,
        firstContentfulPaint: 2000,
      },
      '/analytics': {
        largestContentfulPaint: 3000,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 400,
        firstContentfulPaint: 2200,
      },
      '/transactions': {
        largestContentfulPaint: 2800,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 350,
        firstContentfulPaint: 2000,
      },
      '/network': {
        largestContentfulPaint: 2600,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 300,
        firstContentfulPaint: 2000,
      },
      '/contracts': {
        largestContentfulPaint: 2800,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 350,
        firstContentfulPaint: 2000,
      },
      '/performance': {
        largestContentfulPaint: 2700,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 300,
        firstContentfulPaint: 2000,
      },
    },
  },

  mobile: {
    preset: 'mobile',
    formFactor: 'mobile',
    screenEmulation: {
      mobile: true,
      width: 412,
      height: 823,
      deviceScaleFactor: 2.625,
      disabled: false,
    },
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
    categories: {
      performance: { minScore: 0.65, warnScore: 0.75 },
      accessibility: { minScore: 0.9, warnScore: 0.95 },
      'best-practices': { minScore: 0.85, warnScore: 0.9 },
      seo: { minScore: 0.85, warnScore: 0.9 },
    },
    resourceSizes: [
      { resourceType: 'script', budget: 350 },
      { resourceType: 'total', budget: 700 },
      { resourceType: 'stylesheet', budget: 80 },
      { resourceType: 'document', budget: 40 },
      { resourceType: 'font', budget: 120 },
    ],
    routes: {
      '/*': {
        largestContentfulPaint: 3500,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 500,
        firstContentfulPaint: 2500,
      },
      '/': {
        largestContentfulPaint: 3500,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 500,
        firstContentfulPaint: 2500,
      },
      '/connect': {
        largestContentfulPaint: 2500,
        cumulativeLayoutShift: 0.05,
        totalBlockingTime: 250,
        firstContentfulPaint: 1800,
      },
      '/overview': {
        largestContentfulPaint: 3500,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 500,
        firstContentfulPaint: 2500,
      },
      '/analytics': {
        largestContentfulPaint: 4000,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 600,
        firstContentfulPaint: 2800,
      },
      '/transactions': {
        largestContentfulPaint: 3800,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 550,
        firstContentfulPaint: 2600,
      },
      '/network': {
        largestContentfulPaint: 3500,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 500,
        firstContentfulPaint: 2500,
      },
      '/contracts': {
        largestContentfulPaint: 3800,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 550,
        firstContentfulPaint: 2600,
      },
      '/performance': {
        largestContentfulPaint: 3600,
        cumulativeLayoutShift: 0.1,
        totalBlockingTime: 500,
        firstContentfulPaint: 2500,
      },
    },
  },
});

/**
 * Standard Chrome flags for deterministic, non-flaky execution
 */
const DEFAULT_CHROME_FLAGS = Object.freeze([
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--headless=new',
  '--no-zygote',
  '--disable-extensions',
]);

/**
 * Custom error class for budget validation and enforcement failures
 */
class BudgetValidationError extends Error {
  /**
   * @param {string} message
   * @param {string} [code]
   */
  constructor(message, code = 'ERR_INVALID_BUDGET') {
    super(message);
    this.name = 'BudgetValidationError';
    this.code = code;
  }
}

/**
 * Validates a device profile name
 * @param {unknown} device
 * @returns {'desktop' | 'mobile'}
 */
function validateDevice(device) {
  if (typeof device !== 'string') {
    throw new BudgetValidationError(
      `Device must be a string, received: ${typeof device}`,
      'ERR_INVALID_DEVICE'
    );
  }
  const normalized = device.trim().toLowerCase();
  if (normalized !== 'desktop' && normalized !== 'mobile') {
    throw new BudgetValidationError(
      `Unsupported device "${device}". Supported devices are: ${SUPPORTED_DEVICES.join(', ')}`,
      'ERR_UNSUPPORTED_DEVICE'
    );
  }
  return normalized;
}

/**
 * Normalizes a route path for pattern matching
 * @param {string} routePath
 * @returns {string}
 */
function normalizeRoutePath(routePath) {
  if (typeof routePath !== 'string' || !routePath.trim()) {
    throw new BudgetValidationError('Route path must be a non-empty string', 'ERR_INVALID_ROUTE');
  }
  const trimmed = routePath.trim();
  if (trimmed === '/*') return trimmed;
  if (trimmed === '/') return '/';
  // Strip trailing slashes for uniformity
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Converts a route path to a regex pattern matching LHCI URLs
 * @param {string} routePath
 * @returns {string} Regex pattern string
 */
function routeToUrlPattern(routePath) {
  const norm = normalizeRoutePath(routePath);
  if (norm === '/*') {
    return '.*';
  }
  if (norm === '/') {
    // Matches root URL: http://localhost:port/ or http://localhost:port
    return 'https?://[^/]+/?$';
  }
  // Escape regex special chars
  const escaped = norm.replace(/([-[\]{}()*+?.,\\^$|#\s])/g, '\\$1');
  return `https?://[^/]+${escaped}(?:/|\\?.*)?$`;
}

/**
 * Validates a metric threshold
 * @param {string} metricName
 * @param {unknown} value
 * @param {{ min?: number, max?: number }} [bounds]
 */
function validateMetricValue(metricName, value, bounds = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BudgetValidationError(
      `Metric "${metricName}" must be a finite number, received: ${value}`,
      'ERR_INVALID_METRIC_VALUE'
    );
  }
  const min = bounds.min !== undefined ? bounds.min : 0;
  if (value < min) {
    throw new BudgetValidationError(
      `Metric "${metricName}" cannot be less than ${min}, received: ${value}`,
      'ERR_OUT_OF_BOUNDS_METRIC'
    );
  }
  if (bounds.max !== undefined && value > bounds.max) {
    throw new BudgetValidationError(
      `Metric "${metricName}" cannot exceed ${bounds.max}, received: ${value}`,
      'ERR_OUT_OF_BOUNDS_METRIC'
    );
  }
}

/**
 * Validates an entire budget configuration structure
 * @param {unknown} config
 * @returns {boolean}
 */
function validateBudgetConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new BudgetValidationError(
      'Budget configuration must be a non-null object',
      'ERR_INVALID_CONFIG'
    );
  }

  const typedConfig = /** @type {Record<string, any>} */ (config);

  for (const device of SUPPORTED_DEVICES) {
    if (!typedConfig[device]) {
      throw new BudgetValidationError(
        `Configuration is missing required device profile: "${device}"`,
        'ERR_MISSING_DEVICE_CONFIG'
      );
    }

    const devConfig = typedConfig[device];
    if (!devConfig.routes || typeof devConfig.routes !== 'object') {
      throw new BudgetValidationError(
        `Device profile "${device}" must define a "routes" map`,
        'ERR_MISSING_ROUTES'
      );
    }

    for (const [routePath, metrics] of Object.entries(devConfig.routes)) {
      normalizeRoutePath(routePath);

      if (!metrics || typeof metrics !== 'object') {
        throw new BudgetValidationError(
          `Route "${routePath}" in "${device}" has invalid metric definitions`,
          'ERR_INVALID_ROUTE_METRICS'
        );
      }

      // Ensure required core web vitals are present and valid
      if (metrics.largestContentfulPaint !== undefined) {
        validateMetricValue('largestContentfulPaint', metrics.largestContentfulPaint, { min: 0 });
      } else {
        throw new BudgetValidationError(
          `Route "${routePath}" in "${device}" is missing required metric: largestContentfulPaint`,
          'ERR_MISSING_REQUIRED_METRIC'
        );
      }

      if (metrics.cumulativeLayoutShift !== undefined) {
        validateMetricValue('cumulativeLayoutShift', metrics.cumulativeLayoutShift, {
          min: 0,
          max: 1.0,
        });
      } else {
        throw new BudgetValidationError(
          `Route "${routePath}" in "${device}" is missing required metric: cumulativeLayoutShift`,
          'ERR_MISSING_REQUIRED_METRIC'
        );
      }

      if (metrics.totalBlockingTime !== undefined) {
        validateMetricValue('totalBlockingTime', metrics.totalBlockingTime, { min: 0 });
      } else {
        throw new BudgetValidationError(
          `Route "${routePath}" in "${device}" is missing required metric: totalBlockingTime`,
          'ERR_MISSING_REQUIRED_METRIC'
        );
      }

      if (metrics.firstContentfulPaint !== undefined) {
        validateMetricValue('firstContentfulPaint', metrics.firstContentfulPaint, { min: 0 });
      }
    }

    // Validate categories if present
    if (devConfig.categories) {
      for (const [catName, scores] of Object.entries(devConfig.categories)) {
        const typedScores = /** @type {any} */ (scores);
        if (typedScores.minScore !== undefined) {
          validateMetricValue(`${catName}.minScore`, typedScores.minScore, { min: 0, max: 1 });
        }
        if (typedScores.warnScore !== undefined) {
          validateMetricValue(`${catName}.warnScore`, typedScores.warnScore, { min: 0, max: 1 });
        }
      }
    }
  }

  return true;
}

/**
 * Retrieves budget definition for a device
 * @param {'desktop' | 'mobile' | string} device
 * @returns {typeof BUDGET_DEFINITIONS['desktop']}
 */
function getDeviceBudgets(device) {
  const validated = validateDevice(device);
  return BUDGET_DEFINITIONS[validated];
}

/**
 * Generates an LHCI assertMatrix for use in lighthouserc configuration
 * @param {'desktop' | 'mobile' | string} device
 * @param {{ customOverrides?: Record<string, any> }} [options]
 * @returns {Array<{ matchingUrlPattern: string, assertions: Record<string, any> }>}
 */
function generateAssertMatrix(device, options = {}) {
  const deviceBudgets = getDeviceBudgets(device);
  const matrix = [];

  // 1. General catch-all baseline for all URLs (categories + fallback metrics)
  const baseCategories = deviceBudgets.categories || {};
  const baseAssertions = {};

  for (const [catName, scores] of Object.entries(baseCategories)) {
    if (scores.minScore !== undefined) {
      baseAssertions[`categories:${catName}`] = ['error', { minScore: scores.minScore }];
    }
  }

  const rootMetrics = deviceBudgets.routes['/*'] || deviceBudgets.routes['/'];
  if (rootMetrics) {
    baseAssertions['largest-contentful-paint'] = [
      'error',
      { maxNumericValue: rootMetrics.largestContentfulPaint },
    ];
    baseAssertions['cumulative-layout-shift'] = [
      'error',
      { maxNumericValue: rootMetrics.cumulativeLayoutShift },
    ];
    baseAssertions['total-blocking-time'] = [
      'error',
      { maxNumericValue: rootMetrics.totalBlockingTime },
    ];
    if (rootMetrics.firstContentfulPaint) {
      baseAssertions['first-contentful-paint'] = [
        'warn',
        { maxNumericValue: rootMetrics.firstContentfulPaint },
      ];
    }
  }

  matrix.push({
    matchingUrlPattern: '.*',
    assertions: baseAssertions,
  });

  // 2. Route-specific assertions
  for (const [routePath, metrics] of Object.entries(deviceBudgets.routes)) {
    if (routePath === '/*') continue; // Handled above

    const routePattern = routeToUrlPattern(routePath);
    const assertions = {
      'largest-contentful-paint': ['error', { maxNumericValue: metrics.largestContentfulPaint }],
      'cumulative-layout-shift': ['error', { maxNumericValue: metrics.cumulativeLayoutShift }],
      'total-blocking-time': ['error', { maxNumericValue: metrics.totalBlockingTime }],
    };

    if (metrics.firstContentfulPaint) {
      assertions['first-contentful-paint'] = [
        'warn',
        { maxNumericValue: metrics.firstContentfulPaint },
      ];
    }

    // Apply any route-level overrides
    if (options.customOverrides && options.customOverrides[routePath]) {
      Object.assign(assertions, options.customOverrides[routePath]);
    }

    matrix.push({
      matchingUrlPattern: routePattern,
      assertions,
    });
  }

  return matrix;
}

/**
 * Generates standard Lighthouse budgets.json array for a given device
 * @param {'desktop' | 'mobile' | string} device
 * @returns {Array<object>}
 */
function generateLighthouseBudgets(device) {
  const deviceBudgets = getDeviceBudgets(device);
  const budgets = [];

  for (const [routePath, metrics] of Object.entries(deviceBudgets.routes)) {
    const budgetEntry = {
      path: routePath,
      timings: [
        { metric: 'largest-contentful-paint', budget: metrics.largestContentfulPaint },
        { metric: 'cumulative-layout-shift', budget: metrics.cumulativeLayoutShift },
        { metric: 'total-blocking-time', budget: metrics.totalBlockingTime },
      ],
      resourceSizes: deviceBudgets.resourceSizes.map((r) => ({
        resourceType: r.resourceType,
        budget: r.budget,
      })),
    };

    if (metrics.firstContentfulPaint) {
      budgetEntry.timings.push({
        metric: 'first-contentful-paint',
        budget: metrics.firstContentfulPaint,
      });
    }

    budgets.push(budgetEntry);
  }

  return budgets;
}

/**
 * Checks system environment support for Lighthouse CI
 * @param {string} [projectRoot]
 * @returns {{ supported: boolean, warnings: string[], errors: string[] }}
 */
function checkEnvironmentSupport(projectRoot = process.cwd()) {
  const warnings = [];
  const errors = [];

  // Check dist directory
  const distPath = path.resolve(projectRoot, 'dist');
  if (!fs.existsSync(distPath)) {
    errors.push(`Build directory not found at "${distPath}". Run "pnpm run build" first.`);
  } else {
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      errors.push(`Entry point "index.html" not found in "${distPath}".`);
    }
  }

  // Check Node.js version (engines: >=22 <27)
  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  if (nodeMajor < 20) {
    errors.push(`Node.js version ${process.version} is not supported. Minimum required is v20.`);
  } else if (nodeMajor < 22) {
    warnings.push(`Node.js version ${process.version} is below recommended v22+.`);
  }

  // Check Chrome binary hints
  const hasCustomChrome = Boolean(process.env.CHROME_PATH || process.env.LIGHTHOUSE_CHROMIUM_PATH);
  if (
    !hasCustomChrome &&
    process.platform === 'linux' &&
    !fs.existsSync('/usr/bin/google-chrome')
  ) {
    warnings.push(
      'Standard Chrome binary not found in /usr/bin/google-chrome. Puppeteer or CHROME_PATH recommended.'
    );
  }

  return {
    supported: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Evaluates performance observations against device budget
 * @param {'desktop' | 'mobile'} device
 * @param {string} route
 * @param {{ LCP?: number, CLS?: number, TBT?: number, FCP?: number, performanceScore?: number }} metrics
 * @returns {{ passed: boolean, violations: Array<object>, summary: object }}
 */
function evaluateBudgetResults(device, route, metrics) {
  const deviceBudgets = getDeviceBudgets(device);
  const normalizedRoute = normalizeRoutePath(route);
  const routeBudget = deviceBudgets.routes[normalizedRoute] || deviceBudgets.routes['/*'];

  if (!routeBudget) {
    throw new BudgetValidationError(
      `No budget found for route "${route}" on device "${device}"`,
      'ERR_ROUTE_NOT_FOUND'
    );
  }

  const violations = [];

  // Check LCP
  if (metrics.LCP !== undefined) {
    validateMetricValue('LCP', metrics.LCP);
    if (metrics.LCP > routeBudget.largestContentfulPaint) {
      violations.push({
        metric: 'largest-contentful-paint',
        actual: metrics.LCP,
        budget: routeBudget.largestContentfulPaint,
        delta: metrics.LCP - routeBudget.largestContentfulPaint,
        unit: 'ms',
        route: normalizedRoute,
        device,
        remediation:
          'Defer non-critical scripts, prioritize above-the-fold assets, preload hero fonts or API data.',
      });
    }
  }

  // Check CLS
  if (metrics.CLS !== undefined) {
    validateMetricValue('CLS', metrics.CLS);
    if (metrics.CLS > routeBudget.cumulativeLayoutShift) {
      violations.push({
        metric: 'cumulative-layout-shift',
        actual: metrics.CLS,
        budget: routeBudget.cumulativeLayoutShift,
        delta: parseFloat((metrics.CLS - routeBudget.cumulativeLayoutShift).toFixed(4)),
        unit: 'score',
        route: normalizedRoute,
        device,
        remediation:
          'Reserve explicit dimensions on cards/charts/skeleton loaders, avoid layout-triggering DOM injections.',
      });
    }
  }

  // Check TBT
  if (metrics.TBT !== undefined) {
    validateMetricValue('TBT', metrics.TBT);
    if (metrics.TBT > routeBudget.totalBlockingTime) {
      violations.push({
        metric: 'total-blocking-time',
        actual: metrics.TBT,
        budget: routeBudget.totalBlockingTime,
        delta: metrics.TBT - routeBudget.totalBlockingTime,
        unit: 'ms',
        route: normalizedRoute,
        device,
        remediation:
          'Break long tasks into requestAnimationFrame/postTask slices, lazy-load heavy mathematical models (tfjs/wasm).',
      });
    }
  }

  // Check category score if provided
  if (metrics.performanceScore !== undefined) {
    validateMetricValue('performanceScore', metrics.performanceScore, { min: 0, max: 100 });
    const minScorePercent = (deviceBudgets.categories.performance.minScore || 0.7) * 100;
    if (metrics.performanceScore < minScorePercent) {
      violations.push({
        metric: 'performance-score',
        actual: metrics.performanceScore,
        budget: minScorePercent,
        delta: metrics.performanceScore - minScorePercent,
        unit: '%',
        route: normalizedRoute,
        device,
        remediation:
          'Address high-impact audits identified in Lighthouse performance diagnostic category.',
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    summary: {
      device,
      route: normalizedRoute,
      evaluatedMetrics: Object.keys(metrics).length,
      violationCount: violations.length,
      status: violations.length === 0 ? 'PASSED' : 'FAILED',
    },
  };
}

module.exports = {
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
};
