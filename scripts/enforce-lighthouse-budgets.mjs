#!/usr/bin/env node
/**
 * Lighthouse Performance Budgets Enforcement CLI
 *
 * Verifies that collected Lighthouse CI audit results adhere to the
 * defined performance budgets for Desktop and Mobile routes.
 *
 * Exit codes:
 *   0 — All budgets passed
 *   1 — Performance budget violation(s) detected (failure path)
 *   2 — Invalid CLI input or arguments (invalid input)
 *   3 — Unsupported environment (missing dist, missing manifest/reports)
 *
 * Usage:
 *   node scripts/enforce-lighthouse-budgets.mjs [options]
 *
 * Options:
 *   --device=<desktop|mobile>   Target device profile (default: evaluate all present in manifest)
 *   --report-dir=<path>         Path to .lighthouseci directory (default: .lighthouseci)
 *   --strict                    Treat warnings as hard failures
 *   --json                      Emit structured JSON output
 *   --help                      Show this help message
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  evaluateBudgetResults,
  getDeviceBudgets,
  checkEnvironmentSupport,
  SUPPORTED_DEVICES,
  normalizeRoutePath,
} = require('./lighthouse-budgets.cjs');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/**
 * Parses command-line arguments
 * @param {string[]} argv
 * @returns {{ device?: 'desktop' | 'mobile', reportDir: string, strict: boolean, json: boolean, help: boolean }}
 */
export function parseArgs(argv) {
  const options = {
    reportDir: join(ROOT, '.lighthouseci'),
    strict: false,
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }

    if (arg === '--strict') {
      options.strict = true;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg.startsWith('--device=')) {
      const val = arg.split('=')[1].toLowerCase().trim();
      if (!SUPPORTED_DEVICES.includes(val)) {
        throw new Error(
          `Invalid device "${val}". Supported devices: ${SUPPORTED_DEVICES.join(', ')}`
        );
      }
      options.device = val;
      continue;
    }

    if (arg === '--device') {
      const val = argv[++i]?.toLowerCase().trim();
      if (!val || !SUPPORTED_DEVICES.includes(val)) {
        throw new Error(
          `Invalid or missing value for --device. Supported: ${SUPPORTED_DEVICES.join(', ')}`
        );
      }
      options.device = val;
      continue;
    }

    if (arg.startsWith('--report-dir=')) {
      options.reportDir = resolve(ROOT, arg.split('=')[1]);
      continue;
    }

    if (arg === '--report-dir') {
      const val = argv[++i];
      if (!val) throw new Error('Missing value for --report-dir');
      options.reportDir = resolve(ROOT, val);
      continue;
    }

    throw new Error(`Unknown argument "${arg}". Run with --help for valid options.`);
  }

  return options;
}

/**
 * Extracts route path from a full URL
 * @param {string} fullUrl
 * @returns {string}
 */
export function extractRouteFromUrl(fullUrl) {
  try {
    const parsed = new URL(fullUrl);
    const pathname = parsed.pathname;
    return pathname === '' ? '/' : pathname;
  } catch {
    return '/';
  }
}

/**
 * Inspects a Lighthouse result file and extracts Core Web Vitals
 * @param {string} filePath
 * @returns {{ url: string, formFactor: 'desktop' | 'mobile', metrics: object }}
 */
export function parseLhrFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Lighthouse report file not found: ${filePath}`);
  }

  let lhr;
  try {
    lhr = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse Lighthouse JSON report at ${filePath}: ${err.message}`);
  }

  const audits = lhr.audits || {};
  const formFactor = lhr.configSettings?.formFactor === 'desktop' ? 'desktop' : 'mobile';

  return {
    url: lhr.finalUrl || lhr.requestedUrl || '/',
    formFactor,
    metrics: {
      LCP: audits['largest-contentful-paint']?.numericValue || 0,
      CLS: audits['cumulative-layout-shift']?.numericValue || 0,
      TBT: audits['total-blocking-time']?.numericValue || 0,
      FCP: audits['first-contentful-paint']?.numericValue || 0,
      performanceScore: (lhr.categories?.performance?.score ?? 0) * 100,
    },
  };
}

/**
 * Main execution runner
 */
export async function run(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (err) {
    console.error(`[lh-budget-error] ${err.message}`);
    return 2;
  }

  if (options.help) {
    console.log(`
Lighthouse Performance Budgets Enforcement CLI

Enforces route-level budgets for LCP, CLS, and TBT across Mobile and Desktop.

Usage:
  node scripts/enforce-lighthouse-budgets.mjs [options]

Options:
  --device=<desktop|mobile>   Target device profile
  --report-dir=<path>         Path to .lighthouseci directory (default: .lighthouseci)
  --strict                    Treat warnings as hard failures
  --json                      Emit structured JSON output
  --help                      Show this help message
    `);
    return 0;
  }

  // Check environment prerequisites
  const envCheck = checkEnvironmentSupport(ROOT);
  if (!envCheck.supported) {
    console.error(`[lh-budget-unsupported] Environment check failed:`);
    for (const err of envCheck.errors) {
      console.error(`  - ${err}`);
    }
    return 3;
  }

  if (!existsSync(options.reportDir)) {
    console.error(
      `[lh-budget-unsupported] Reports directory not found at "${options.reportDir}". Run "pnpm run test:lighthouse" first.`
    );
    return 3;
  }

  const manifestPath = join(options.reportDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`[lh-budget-unsupported] manifest.json not found in "${options.reportDir}".`);
    return 3;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    console.error(`[lh-budget-unsupported] Failed to parse manifest.json: ${err.message}`);
    return 3;
  }

  if (!Array.isArray(manifest) || manifest.length === 0) {
    console.error('[lh-budget-unsupported] Manifest contains no Lighthouse run entries.');
    return 3;
  }

  const evaluationResults = [];
  let totalViolations = 0;

  for (const entry of manifest) {
    if (!entry.jsonPath) continue;

    const reportPath = join(options.reportDir, entry.jsonPath);
    let lhrData;
    try {
      lhrData = parseLhrFile(reportPath);
    } catch (err) {
      console.error(`[lh-budget-error] ${err.message}`);
      return 3;
    }

    const device = options.device || lhrData.formFactor;
    const route = extractRouteFromUrl(lhrData.url);

    try {
      const evaluation = evaluateBudgetResults(device, route, lhrData.metrics);
      evaluationResults.push({
        url: lhrData.url,
        route,
        device,
        metrics: lhrData.metrics,
        evaluation,
      });

      if (!evaluation.passed) {
        totalViolations += evaluation.violations.length;
      }
    } catch (err) {
      console.error(`[lh-budget-error] Evaluation error for ${route} (${device}): ${err.message}`);
      return 1;
    }
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          passed: totalViolations === 0,
          totalRuns: evaluationResults.length,
          totalViolations,
          results: evaluationResults,
        },
        null,
        2
      )
    );
    return totalViolations === 0 ? 0 : 1;
  }

  // Formatted console output
  console.log('\n============================================================');
  console.log('       Lighthouse Performance Budget Enforcement Report      ');
  console.log('============================================================\n');

  for (const res of evaluationResults) {
    const statusIcon = res.evaluation.passed ? '✅' : '❌';
    console.log(
      `${statusIcon} Route: ${res.route} | Profile: ${res.device.toUpperCase()} | URL: ${res.url}`
    );
    console.log(
      `   LCP: ${res.metrics.LCP.toFixed(0)} ms | CLS: ${res.metrics.CLS.toFixed(3)} | TBT: ${res.metrics.TBT.toFixed(0)} ms | Score: ${res.metrics.performanceScore.toFixed(0)}`
    );

    if (!res.evaluation.passed) {
      console.log(`   Violations (${res.evaluation.violations.length}):`);
      for (const v of res.evaluation.violations) {
        console.log(
          `     - [${v.metric}] Actual: ${v.actual}${v.unit} > Budget: ${v.budget}${v.unit} (Over by +${v.delta}${v.unit})`
        );
        console.log(`       Remediation: ${v.remediation}`);
      }
    }
    console.log('');
  }

  console.log('------------------------------------------------------------');
  if (totalViolations === 0) {
    console.log('🎉 ALL LIGHTHOUSE PERFORMANCE BUDGETS PASSED!\n');
    return 0;
  } else {
    console.error(
      `🚨 BUDGET FAILURE: ${totalViolations} performance budget violation(s) detected.\n`
    );
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  run().then((code) => {
    if (code !== 0) process.exit(code);
  });
}
