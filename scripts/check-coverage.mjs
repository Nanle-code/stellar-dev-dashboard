#!/usr/bin/env node
/**
 * Enforce coverage thresholds from testing/coverage-thresholds.json.
 * Exits 0 when coverage meets global floor; warns on per-file targets.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SUMMARY_PATH = join(process.cwd(), 'coverage', 'coverage-summary.json');
const THRESHOLDS_PATH = join(process.cwd(), 'testing', 'coverage-thresholds.json');

function loadJson(path) {
  if (!existsSync(path)) {
    console.error(`Missing file: ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

const summary = loadJson(SUMMARY_PATH);
const thresholds = loadJson(THRESHOLDS_PATH);
const total = summary.total;

if (!total) {
  console.error('No total coverage summary found.');
  process.exit(1);
}

let failed = false;

for (const metric of ['lines', 'functions', 'branches', 'statements']) {
  const pct = total[metric]?.pct ?? 0;
  const min = thresholds[metric] ?? 0;
  if (pct < min) {
    console.error(`FAIL: Global ${metric} coverage ${pct}% < ${min}%`);
    failed = true;
  } else {
    console.log(`PASS: Global ${metric} coverage ${pct}% >= ${min}%`);
  }
}

if (thresholds.targetPaths) {
  for (const [filePath, fileThresholds] of Object.entries(thresholds.targetPaths)) {
    const key = Object.keys(summary).find((k) => k.endsWith(filePath));
    if (!key) {
      console.warn(`WARN: No coverage data for target ${filePath}`);
      continue;
    }
    const fileCov = summary[key];
    for (const metric of ['lines', 'functions', 'branches', 'statements']) {
      const target = fileThresholds[metric];
      if (target == null) continue;
      const pct = fileCov[metric]?.pct ?? 0;
      if (pct < target) {
        console.warn(
          `WARN: ${filePath} ${metric} ${pct}% < target ${target}% (aspirational)`
        );
      }
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log('Coverage thresholds met.');
