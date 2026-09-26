#!/usr/bin/env node

/**
 * Canary Deployment Health Probes for API Service
 *
 * Probes critical API routes during canary rollout and triggers auto-abort
 * if the error budget or latency budget is breached.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';

const execAsync = promisify(exec);

export class InvalidInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

export class UnsupportedEnvironmentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedEnvironmentError';
  }
}

export const SUPPORTED_ENVIRONMENTS = new Set([
  'production',
  'staging',
  'canary',
  'test',
  'development',
]);

export const DEFAULT_CONFIG = {
  url: 'http://localhost:4000',
  errorBudget: 0.05, // 5% error budget
  latencyBudgetMs: 2000, // 2000ms p95 latency threshold
  iterations: 3,
  intervalMs: 500,
  timeoutMs: 5000,
  environment: 'production',
  authToken: 'canary-probe-internal-token-2026',
  abortCommand: null,
};

export const DEFAULT_CRITICAL_ROUTES = [
  {
    id: 'liveness',
    name: 'API Liveness Probe',
    path: '/health',
    method: 'GET',
    expectedStatus: 200,
    validate: (data) => data?.status === 'ok',
    critical: true,
  },
  {
    id: 'readiness',
    name: 'API Deep Readiness Probe',
    path: '/health/deep',
    method: 'GET',
    expectedStatus: 200,
    validate: (data) => data?.status === 'healthy' || data?.status === 'ok',
    critical: true,
  },
  {
    id: 'api-docs',
    name: 'Public API Documentation & Schema',
    path: '/api/docs',
    method: 'GET',
    expectedStatus: 200,
    validate: (data) => Boolean(data?.apiVersion),
    critical: true,
  },
  {
    id: 'account-lookup',
    name: 'Account Details Route',
    path: '/api/v1/accounts/GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    method: 'GET',
    expectedStatus: 200,
    authenticated: true,
    validate: (data) => data?.id === 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    critical: true,
  },
  {
    id: 'transaction-query',
    name: 'Transaction Query Route',
    path: '/api/v1/transactions?accountId=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN&limit=5',
    method: 'GET',
    expectedStatus: 200,
    authenticated: true,
    validate: (data) => Array.isArray(data?.data),
    critical: true,
  },
  {
    id: 'gas-prediction',
    name: 'Gas Cost Prediction Computation',
    path: '/api/v1/gas/predict',
    method: 'POST',
    body: {
      contractId: 'CDISPATCHERCANARY1234567890',
      functionName: 'execute',
      operationsCount: 1,
    },
    expectedStatus: 200,
    authenticated: true,
    validate: (data) => typeof data?.predictedTotalFee === 'number',
    critical: true,
  },
];

/**
 * Parse and validate CLI arguments and environment variables.
 */
export function parseArgs(argv = [], env = process.env) {
  const options = {
    url: env.CANARY_URL || DEFAULT_CONFIG.url,
    errorBudget:
      env.CANARY_ERROR_BUDGET !== undefined ? env.CANARY_ERROR_BUDGET : DEFAULT_CONFIG.errorBudget,
    latencyBudgetMs:
      env.CANARY_LATENCY_BUDGET_MS !== undefined
        ? env.CANARY_LATENCY_BUDGET_MS
        : DEFAULT_CONFIG.latencyBudgetMs,
    iterations:
      env.CANARY_PROBE_ROUNDS !== undefined ? env.CANARY_PROBE_ROUNDS : DEFAULT_CONFIG.iterations,
    intervalMs:
      env.CANARY_PROBE_INTERVAL_MS !== undefined
        ? env.CANARY_PROBE_INTERVAL_MS
        : DEFAULT_CONFIG.intervalMs,
    timeoutMs:
      env.CANARY_TIMEOUT_MS !== undefined ? env.CANARY_TIMEOUT_MS : DEFAULT_CONFIG.timeoutMs,
    environment: env.NODE_ENV || env.CANARY_ENVIRONMENT || DEFAULT_CONFIG.environment,
    authToken: env.CANARY_AUTH_TOKEN || DEFAULT_CONFIG.authToken,
    abortCommand: env.CANARY_ABORT_COMMAND || DEFAULT_CONFIG.abortCommand,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url' || arg === '-u') {
      options.url = argv[++i];
    } else if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1];
    } else if (arg === '--error-budget' || arg === '-b') {
      options.errorBudget = argv[++i];
    } else if (arg.startsWith('--error-budget=')) {
      options.errorBudget = arg.split('=')[1];
    } else if (arg === '--latency-budget-ms') {
      options.latencyBudgetMs = argv[++i];
    } else if (arg.startsWith('--latency-budget-ms=')) {
      options.latencyBudgetMs = arg.split('=')[1];
    } else if (arg === '--iterations' || arg === '-n') {
      options.iterations = argv[++i];
    } else if (arg.startsWith('--iterations=')) {
      options.iterations = arg.split('=')[1];
    } else if (arg === '--interval-ms') {
      options.intervalMs = argv[++i];
    } else if (arg.startsWith('--interval-ms=')) {
      options.intervalMs = arg.split('=')[1];
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = argv[++i];
    } else if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = arg.split('=')[1];
    } else if (arg === '--env' || arg === '-e') {
      options.environment = argv[++i];
    } else if (arg.startsWith('--env=')) {
      options.environment = arg.split('=')[1];
    } else if (arg === '--auth-token') {
      options.authToken = argv[++i];
    } else if (arg.startsWith('--auth-token=')) {
      options.authToken = arg.split('=')[1];
    } else if (arg === '--abort-command') {
      options.abortCommand = argv[++i];
    } else if (arg.startsWith('--abort-command=')) {
      options.abortCommand = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new InvalidInputError(`Unknown CLI argument: ${arg}`);
    }
  }

  // Validate URL
  if (!options.url || typeof options.url !== 'string') {
    throw new InvalidInputError('URL parameter is required and must be a valid HTTP(S) URL');
  }
  try {
    const parsedUrl = new URL(options.url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new InvalidInputError(
        `Invalid URL protocol "${parsedUrl.protocol}". Must be http: or https:`
      );
    }
  } catch (err) {
    if (err instanceof InvalidInputError) throw err;
    throw new InvalidInputError(`Malformed URL provided: "${options.url}"`);
  }

  // Validate errorBudget
  let parsedErrorBudget = options.errorBudget;
  if (typeof parsedErrorBudget === 'string' && parsedErrorBudget.endsWith('%')) {
    parsedErrorBudget = parseFloat(parsedErrorBudget.slice(0, -1)) / 100;
  } else {
    parsedErrorBudget = Number(parsedErrorBudget);
  }
  if (!Number.isFinite(parsedErrorBudget) || parsedErrorBudget < 0 || parsedErrorBudget > 1) {
    throw new InvalidInputError(
      `Invalid error budget: "${options.errorBudget}". Must be a number between 0.0 and 1.0 (or percentage e.g. 5%)`
    );
  }
  options.errorBudget = parsedErrorBudget;

  // Validate latencyBudgetMs
  const parsedLatencyBudget = Number(options.latencyBudgetMs);
  if (!Number.isFinite(parsedLatencyBudget) || parsedLatencyBudget <= 0) {
    throw new InvalidInputError(
      `Invalid latency budget: "${options.latencyBudgetMs}". Must be a positive number of milliseconds`
    );
  }
  options.latencyBudgetMs = parsedLatencyBudget;

  // Validate iterations
  const parsedIterations = Number(options.iterations);
  if (!Number.isInteger(parsedIterations) || parsedIterations < 1) {
    throw new InvalidInputError(
      `Invalid iterations: "${options.iterations}". Must be a positive integer >= 1`
    );
  }
  options.iterations = parsedIterations;

  // Validate intervalMs
  const parsedInterval = Number(options.intervalMs);
  if (!Number.isFinite(parsedInterval) || parsedInterval < 0) {
    throw new InvalidInputError(
      `Invalid interval: "${options.intervalMs}". Must be a non-negative number of milliseconds`
    );
  }
  options.intervalMs = parsedInterval;

  // Validate timeoutMs
  const parsedTimeout = Number(options.timeoutMs);
  if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
    throw new InvalidInputError(
      `Invalid timeout: "${options.timeoutMs}". Must be a positive number of milliseconds`
    );
  }
  options.timeoutMs = parsedTimeout;

  // Validate environment
  const normalizedEnv = String(options.environment || '')
    .trim()
    .toLowerCase();
  if (!SUPPORTED_ENVIRONMENTS.has(normalizedEnv)) {
    throw new UnsupportedEnvironmentError(
      `Unsupported environment: '${options.environment}'. Supported environments are: ${Array.from(SUPPORTED_ENVIRONMENTS).join(', ')}`
    );
  }
  options.environment = normalizedEnv;

  return options;
}

/**
 * Execute a single HTTP probe against a target route.
 */
export async function probeRoute(baseUrl, route, options = {}, fetchImpl = globalThis.fetch) {
  const fullUrl = new URL(route.path, baseUrl).toString();
  const timeoutMs = options.timeoutMs || DEFAULT_CONFIG.timeoutMs;
  const authToken = options.authToken || DEFAULT_CONFIG.authToken;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    Accept: 'application/json',
    ...(route.body ? { 'Content-Type': 'application/json' } : {}),
  };

  if (route.authenticated && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const startTime = performance.now();

  try {
    const response = await fetchImpl(fullUrl, {
      method: route.method || 'GET',
      headers,
      body: route.body ? JSON.stringify(route.body) : undefined,
      signal: controller.signal,
    });

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    clearTimeout(timeoutId);

    const isStatusExpected = response.status === (route.expectedStatus || 200);

    let data = null;
    let parseError = null;
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (err) {
        parseError = err.message;
      }
    } else {
      try {
        data = await response.text();
      } catch {
        data = '';
      }
    }

    if (!isStatusExpected) {
      return {
        routeId: route.id,
        name: route.name,
        path: route.path,
        success: false,
        status: response.status,
        latencyMs,
        error: `Unexpected HTTP status ${response.status} (expected ${route.expectedStatus || 200})`,
        data,
      };
    }

    if (parseError) {
      return {
        routeId: route.id,
        name: route.name,
        path: route.path,
        success: false,
        status: response.status,
        latencyMs,
        error: `Malformed JSON response: ${parseError}`,
      };
    }

    if (route.validate && typeof route.validate === 'function') {
      const isValid = route.validate(data);
      if (!isValid) {
        return {
          routeId: route.id,
          name: route.name,
          path: route.path,
          success: false,
          status: response.status,
          latencyMs,
          error: 'Response validation failed against schema expectations',
          data,
        };
      }
    }

    return {
      routeId: route.id,
      name: route.name,
      path: route.path,
      success: true,
      status: response.status,
      latencyMs,
      data,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    const isTimeout = err.name === 'AbortError' || controller.signal.aborted;

    return {
      routeId: route.id,
      name: route.name,
      path: route.path,
      success: false,
      status: isTimeout ? 408 : 0,
      latencyMs,
      error: isTimeout
        ? `Probe timed out after ${timeoutMs}ms`
        : `Network/connection error: ${err.message}`,
    };
  }
}

/**
 * Calculate aggregate health metrics, error budget consumption, and percentile latencies.
 */
export function calculateMetrics(probeResults = [], errorBudget = 0.05, latencyBudgetMs = 2000) {
  const totalRequests = probeResults.length;
  const successfulRequests = probeResults.filter((r) => r.success).length;
  const failedRequests = totalRequests - successfulRequests;
  const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;

  const latencies = probeResults.map((r) => r.latencyMs).sort((a, b) => a - b);
  const minLatencyMs = latencies.length > 0 ? latencies[0] : 0;
  const maxLatencyMs = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
  const avgLatencyMs =
    latencies.length > 0
      ? Math.round((latencies.reduce((sum, val) => sum + val, 0) / latencies.length) * 100) / 100
      : 0;

  const p95Index = latencies.length > 0 ? Math.floor(latencies.length * 0.95) : 0;
  const p95LatencyMs =
    latencies.length > 0 ? latencies[Math.min(p95Index, latencies.length - 1)] : 0;

  // Boundary condition: errorRate must be strictly greater than errorBudget to breach
  const errorBudgetBreached = errorRate > errorBudget;
  const latencyBudgetBreached = p95LatencyMs > latencyBudgetMs;
  const aborted = errorBudgetBreached || latencyBudgetBreached;

  const perRoute = {};
  for (const result of probeResults) {
    if (!perRoute[result.routeId]) {
      perRoute[result.routeId] = {
        routeId: result.routeId,
        name: result.name,
        path: result.path,
        total: 0,
        success: 0,
        failed: 0,
        latencies: [],
        errors: [],
      };
    }
    const rStat = perRoute[result.routeId];
    rStat.total += 1;
    if (result.success) {
      rStat.success += 1;
    } else {
      rStat.failed += 1;
      if (result.error) rStat.errors.push(result.error);
    }
    rStat.latencies.push(result.latencyMs);
  }

  for (const rStat of Object.values(perRoute)) {
    rStat.errorRate = rStat.total > 0 ? rStat.failed / rStat.total : 0;
    rStat.avgLatencyMs =
      rStat.latencies.length > 0
        ? Math.round((rStat.latencies.reduce((a, b) => a + b, 0) / rStat.latencies.length) * 100) /
          100
        : 0;
  }

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    errorRate: Math.round(errorRate * 10000) / 10000,
    errorBudget,
    errorBudgetBreached,
    latencyBudgetMs,
    p95LatencyMs,
    avgLatencyMs,
    minLatencyMs,
    maxLatencyMs,
    latencyBudgetBreached,
    aborted,
    perRoute,
  };
}

/**
 * Sleep helper for interval pacing.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute the full canary health probe workflow across configured iterations.
 */
export async function runCanaryHealthProbes(
  options = {},
  fetchImpl = globalThis.fetch,
  execImpl = execAsync,
  routes = DEFAULT_CRITICAL_ROUTES
) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const allResults = [];

  console.log(`[Canary Health Probe] Starting canary rollout evaluation`);
  console.log(`  Target URL:       ${config.url}`);
  console.log(`  Environment:      ${config.environment}`);
  console.log(`  Error Budget:     ${(config.errorBudget * 100).toFixed(1)}%`);
  console.log(`  Latency Budget:   ${config.latencyBudgetMs}ms (p95)`);
  console.log(`  Rounds:           ${config.iterations}`);
  console.log(`  Interval:         ${config.intervalMs}ms`);
  console.log(`  Critical Routes:  ${routes.length}`);
  console.log('------------------------------------------------------------');

  for (let round = 1; round <= config.iterations; round++) {
    console.log(`[Round ${round}/${config.iterations}] Probing critical routes...`);
    for (const route of routes) {
      const result = await probeRoute(config.url, route, config, fetchImpl);
      allResults.push(result);
      const symbol = result.success ? '✔' : '✖';
      console.log(
        `  ${symbol} [${result.status}] ${route.method || 'GET'} ${route.path} (${result.latencyMs}ms)${result.error ? ` - ${result.error}` : ''}`
      );
    }

    if (round < config.iterations && config.intervalMs > 0) {
      await sleep(config.intervalMs);
    }
  }

  const metrics = calculateMetrics(allResults, config.errorBudget, config.latencyBudgetMs);

  console.log('------------------------------------------------------------');
  console.log(`[Canary Health Probe] Final Evaluation:`);
  console.log(`  Total Probes:       ${metrics.totalRequests}`);
  console.log(`  Successful:         ${metrics.successfulRequests}`);
  console.log(`  Failed:             ${metrics.failedRequests}`);
  console.log(
    `  Observed Error Rate: ${(metrics.errorRate * 100).toFixed(2)}% (Budget: ${(config.errorBudget * 100).toFixed(2)}%)`
  );
  console.log(`  Avg Latency:        ${metrics.avgLatencyMs}ms`);
  console.log(
    `  P95 Latency:        ${metrics.p95LatencyMs}ms (Budget: ${config.latencyBudgetMs}ms)`
  );

  let abortReason = null;
  if (metrics.errorBudgetBreached) {
    abortReason = `Error budget breached: ${(metrics.errorRate * 100).toFixed(2)}% failures exceeded ${(config.errorBudget * 100).toFixed(2)}% budget`;
  } else if (metrics.latencyBudgetBreached) {
    abortReason = `Latency budget breached: p95 latency ${metrics.p95LatencyMs}ms exceeded ${config.latencyBudgetMs}ms budget`;
  }

  if (metrics.aborted) {
    console.error(`\n🚨 CANARY ROLLOUT AUTO-ABORT TRIGGERED: ${abortReason}`);

    if (config.abortCommand) {
      console.log(`[Canary Health Probe] Executing rollback/abort command: ${config.abortCommand}`);
      try {
        await execImpl(config.abortCommand);
        console.log(`[Canary Health Probe] Abort command executed successfully.`);
      } catch (cmdErr) {
        console.error(`[Canary Health Probe] Failed to execute abort command: ${cmdErr.message}`);
      }
    }

    return {
      success: false,
      aborted: true,
      abortReason,
      metrics,
      results: allResults,
    };
  }

  console.log(`\n✅ CANARY HEALTH PROBES PASSED: All critical routes healthy within error budget.`);
  return {
    success: true,
    aborted: false,
    abortReason: null,
    metrics,
    results: allResults,
  };
}

/**
 * CLI Entry point
 */
async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(`
Canary Deployment Health Probes for API Service

Usage:
  node scripts/canary-health-probe.mjs [options]

Options:
  --url, -u            Canary API base URL (default: http://localhost:4000)
  --error-budget, -b   Maximum tolerable error budget ratio (e.g. 0.05 or 5%, default: 0.05)
  --latency-budget-ms  Maximum p95 latency threshold in ms (default: 2000)
  --iterations, -n     Number of probe rounds (default: 3)
  --interval-ms        Interval between rounds in ms (default: 500)
  --timeout-ms         Timeout per probe in ms (default: 5000)
  --env, -e            Target environment (default: production)
  --auth-token         Bearer token for authenticated routes
  --abort-command      Command to execute if rollout is aborted (e.g. "docker compose stop api-canary")
  --help, -h           Show this help message
      `);
      process.exit(0);
    }

    const report = await runCanaryHealthProbes(options);

    // Write to GitHub Actions step summary if available
    if (process.env.GITHUB_STEP_SUMMARY) {
      const summaryContent = [
        `## 🕊️ Canary Deployment Health Probe Report`,
        '',
        `| Metric | Value | Budget | Result |`,
        `|--------|-------|--------|--------|`,
        `| Status | ${report.aborted ? '❌ ABORTED' : '✅ HEALTHY'} | - | ${report.aborted ? 'FAILED' : 'PASSED'} |`,
        `| Total Probes | ${report.metrics.totalRequests} | - | - |`,
        `| Error Rate | ${(report.metrics.errorRate * 100).toFixed(2)}% | ${(options.errorBudget * 100).toFixed(2)}% | ${report.metrics.errorBudgetBreached ? '❌ BREACHED' : '✅ OK'} |`,
        `| P95 Latency | ${report.metrics.p95LatencyMs}ms | ${options.latencyBudgetMs}ms | ${report.metrics.latencyBudgetBreached ? '❌ BREACHED' : '✅ OK'} |`,
        `| Avg Latency | ${report.metrics.avgLatencyMs}ms | - | - |`,
        '',
        report.aborted
          ? `> **Auto-Abort Triggered**: ${report.abortReason}`
          : '> **Rollout Approved**: Canary service healthy and performing within budget thresholds.',
      ].join('\n');

      try {
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryContent);
      } catch (err) {
        console.warn(`Failed to write to GITHUB_STEP_SUMMARY: ${err.message}`);
      }
    }

    if (!report.success || report.aborted) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Canary probe error: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('canary-health-probe.mjs')) {
  main();
}
