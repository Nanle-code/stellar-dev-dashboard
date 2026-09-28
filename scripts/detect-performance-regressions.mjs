#!/usr/bin/env node
/**
 * CI Performance Regression Detection
 * 
 * Runs after Lighthouse CI to analyze performance metrics and detect regressions.
 * Reads Lighthouse results from .lighthouseci directory and compares against
 * historical baselines stored in the repository.
 * 
 * Exit codes:
 *   0 - No high-confidence regressions detected (CI passes)
 *   1 - High-confidence regressions detected (CI fails)
 *   2 - Script error (invalid input, missing data, etc.)
 * 
 * Usage:
 *   node scripts/detect-performance-regressions.mjs [options]
 * 
 * Options:
 *   --threshold=<number>  Z-score threshold (default: 2.5)
 *   --dry-run            Print results without failing CI
 *   --verbose            Show detailed analysis
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Parse CLI arguments
const args = process.argv.slice(2);
const options = {
  threshold: parseFloat(args.find(a => a.startsWith('--threshold='))?.split('=')[1] || '2.5'),
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
};

/**
 * Load Lighthouse CI results from .lighthouseci directory.
 * Reads the most recent manifest and extracts performance metrics.
 * 
 * @returns {{ LCP: number, FCP: number, TBT: number, CLS: number, SI: number } | null}
 */
function loadLighthouseMetrics() {
  const lhciDir = join(ROOT, '.lighthouseci');
  
  if (!existsSync(lhciDir)) {
    console.error('Lighthouse CI directory not found. Run `npm run test:lighthouse` first.');
    return null;
  }
  
  // Find manifest.json
  const manifestPath = join(lhciDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error('Lighthouse manifest.json not found.');
    return null;
  }
  
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    
    // Get the most recent run
    if (!manifest.length || !manifest[0].jsonPath) {
      console.error('No Lighthouse results in manifest.');
      return null;
    }
    
    const resultPath = join(lhciDir, manifest[0].jsonPath);
    const result = JSON.parse(readFileSync(resultPath, 'utf8'));
    
    // Extract Web Vitals from audits
    const audits = result.audits;
    
    const metrics = {
      LCP: audits['largest-contentful-paint']?.numericValue || 0,
      FCP: audits['first-contentful-paint']?.numericValue || 0,
      TBT: audits['total-blocking-time']?.numericValue || 0,
      CLS: audits['cumulative-layout-shift']?.numericValue || 0,
      SI: audits['speed-index']?.numericValue || 0,
      performanceScore: result.categories.performance.score * 100,
    };
    
    return metrics;
  } catch (error) {
    console.error('Failed to parse Lighthouse results:', error.message);
    return null;
  }
}

/**
 * Load historical baselines from file storage (mock implementation).
 * In production, this would query a time-series DB or read from CI artifacts.
 * 
 * For MVP, we use simple JSON file storage with git history.
 * 
 * @returns {Record<string, { mean: number, stdDev: number, count: number }>}
 */
function loadHistoricalBaselines() {
  const baselinesPath = join(ROOT, '.ci-performance-baselines.json');
  
  if (!existsSync(baselinesPath)) {
    console.warn('No historical baselines found. This is the first run.');
    return {};
  }
  
  try {
    return JSON.parse(readFileSync(baselinesPath, 'utf8'));
  } catch (error) {
    console.error('Failed to load baselines:', error.message);
    return {};
  }
}

/**
 * Simple z-score calculation (inline for CI script independence).
 */
function calculateZScore(value, mean, stdDev) {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Detect regressions using simple statistical comparison.
 */
function detectRegressions(metrics, baselines, threshold) {
  const regressions = [];
  
  for (const [metricName, value] of Object.entries(metrics)) {
    const baseline = baselines[metricName];
    
    if (!baseline || baseline.count < 7) {
      if (options.verbose) {
        console.log(`ℹ️  ${metricName}: No baseline (${baseline?.count || 0} samples)`);
      }
      continue;
    }
    
    const zScore = calculateZScore(value, baseline.mean, baseline.stdDev);
    
    if (zScore > threshold) {
      const deviationPercent = ((value - baseline.mean) / baseline.mean) * 100;
      const confidence = Math.min((Math.abs(zScore) - 2.5) / 2.5 + 0.5, 1.0);
      
      regressions.push({
        metricName,
        value,
        baseline: baseline.mean,
        stdDev: baseline.stdDev,
        zScore,
        deviationPercent,
        confidence,
        severity: zScore > threshold * 1.5 ? 'critical' : 'warning',
      });
    } else if (options.verbose) {
      console.log(`✅ ${metricName}: ${value.toFixed(2)} (z=${zScore.toFixed(2)})`);
    }
  }
  
  return regressions;
}

/**
 * Format and print regression report.
 */
function printReport(regressions, metrics) {
  if (regressions.length === 0) {
    console.log('✅ No performance regressions detected.');
    console.log('');
    console.log('Current metrics:');
    for (const [name, value] of Object.entries(metrics)) {
      console.log(`  ${name}: ${value.toFixed(2)}`);
    }
    return;
  }
  
  console.log('');
  console.log('⚠️  Performance Regressions Detected');
  console.log('═'.repeat(60));
  console.log('');
  
  for (const r of regressions) {
    const icon = r.severity === 'critical' ? '❌' : '⚠️';
    console.log(`${icon} ${r.metricName}`);
    console.log(`   Current:   ${r.value.toFixed(2)}`);
    console.log(`   Baseline:  ${r.baseline.toFixed(2)} ± ${r.stdDev.toFixed(2)}`);
    console.log(`   Deviation: ${r.deviationPercent.toFixed(1)}% (${r.zScore.toFixed(2)}σ)`);
    console.log(`   Confidence: ${(r.confidence * 100).toFixed(0)}%`);
    console.log('');
  }
  
  const highConfidence = regressions.filter(r => r.confidence >= 0.5);
  
  if (highConfidence.length > 0) {
    console.log(`${highConfidence.length} high-confidence regression(s) will fail CI.`);
  } else {
    console.log('All regressions are low-confidence (CI will pass with warning).');
  }
  
  console.log('');
}

/**
 * Post comment to GitHub PR (if in PR context).
 */
async function postPRComment(regressions) {
  const prNumber = process.env.GITHUB_PR_NUMBER || process.env.GITHUB_REF?.match(/\/pull\/(\d+)\//)?.[1];
  const token = process.env.GITHUB_TOKEN;
  
  if (!prNumber || !token) {
    if (options.verbose) {
      console.log('Not in PR context or missing GITHUB_TOKEN. Skipping PR comment.');
    }
    return;
  }
  
  const highConfidence = regressions.filter(r => r.confidence >= 0.5);
  
  let body = '## ⚠️ Performance Regression Detected\n\n';
  
  if (highConfidence.length > 0) {
    body += `**${highConfidence.length} high-confidence regression(s) found:**\n\n`;
  } else {
    body += `**${regressions.length} low-confidence regression(s) found (informational):**\n\n`;
  }
  
  body += '| Metric | Current | Baseline | Deviation | Confidence |\n';
  body += '|--------|---------|----------|-----------|------------|\n';
  
  for (const r of regressions) {
    const icon = r.severity === 'critical' ? '❌' : '⚠️';
    body += `| ${icon} ${r.metricName} | ${r.value.toFixed(2)} | ${r.baseline.toFixed(2)} ± ${r.stdDev.toFixed(2)} | ${r.deviationPercent.toFixed(1)}% (${r.zScore.toFixed(2)}σ) | ${(r.confidence * 100).toFixed(0)}% |\n`;
  }
  
  body += '\n*Regression detection threshold: ' + options.threshold + 'σ*\n';
  
  console.log('PR comment preview:');
  console.log(body);
  
  // Note: Actual GitHub API call would go here
  // For now, just log the comment body
}

/**
 * Main execution.
 */
async function main() {
  console.log('Performance Regression Detection');
  console.log('─'.repeat(60));
  console.log(`Threshold: ${options.threshold}σ`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log('');
  
  // Load metrics
  const metrics = loadLighthouseMetrics();
  if (!metrics) {
    console.error('Failed to load Lighthouse metrics.');
    process.exit(2);
  }
  
  // Load baselines
  const baselines = loadHistoricalBaselines();
  
  // Detect regressions
  const regressions = detectRegressions(metrics, baselines, options.threshold);
  
  // Print report
  printReport(regressions, metrics);
  
  // Post PR comment
  if (regressions.length > 0 && process.env.GITHUB_ACTIONS === 'true') {
    await postPRComment(regressions);
  }
  
  // Determine exit code
  const highConfidence = regressions.filter(r => r.confidence >= 0.5);
  
  if (options.dryRun) {
    console.log('Dry run mode: exiting with code 0 regardless of results.');
    process.exit(0);
  }
  
  if (highConfidence.length > 0) {
    console.error('');
    console.error('❌ CI check failed: high-confidence performance regressions detected.');
    process.exit(1);
  }
  
  if (regressions.length > 0) {
    console.log('');
    console.log('⚠️  Low-confidence regressions detected (CI passes with warning).');
  }
  
  process.exit(0);
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(2);
});
