#!/usr/bin/env node
/**
 * Mutation-testing gate for critical fee math (#895).
 *
 * Runs Stryker against `src/lib/feeMath.ts` using `stryker.feemath.conf.json`
 * and enforces a minimum mutation score. Exits 1 when the score is below the
 * gate so CI can block the PR.
 *
 * Stryker already exits non-zero when the configured `thresholds.break` is
 * breached; this wrapper additionally enforces a score floor for callers that
 * use `--incremental` or tolerate breaks, and prints a CI-friendly summary.
 *
 * Usage:
 *   node scripts/check-mutation-score.mjs            # run + enforce
 *   node scripts/check-mutation-score.mjs --min 80   # override score floor
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIN_SCORE_DEFAULT = 70;
const args = process.argv.slice(2);
const minIdx = args.indexOf('--min');
const MIN_SCORE = minIdx !== -1 && args[minIdx + 1] ? Number(args[minIdx + 1]) : MIN_SCORE_DEFAULT;

const CONFIG = 'stryker.feemath.conf.json';
const REPORT = 'reports/mutation/mutation.json';

if (!existsSync(CONFIG)) {
  console.error(`Missing Stryker config: ${CONFIG}`);
  process.exit(1);
}

console.log(`::group::Stryker mutation run (fee math gate, min score ${MIN_SCORE})`);
const result = spawnSync('pnpm', ['exec', 'stryker', 'run', CONFIG], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
console.log('::endgroup::');

// Prefer the machine-readable report when Stryker produced one.
if (existsSync(REPORT)) {
  try {
    const report = JSON.parse(readFileSync(REPORT, 'utf8'));
    const scores = report?.scores ?? {};
    const total = (scores.killed ?? 0) + (scores.timeout ?? 0) + (scores.survived ?? 0) + (scores.noCoverage ?? 0);
    const detected = (scores.killed ?? 0) + (scores.timeout ?? 0);
    const score = total > 0 ? (detected / total) * 100 : 0;
    console.log(`Mutation score: ${score.toFixed(2)}% (killed ${scores.killed ?? 0}, timeout ${scores.timeout ?? 0}, survived ${scores.survived ?? 0}, no coverage ${scores.noCoverage ?? 0})`);
    if (score < MIN_SCORE) {
      console.error(`FAIL: mutation score ${score.toFixed(2)}% is below the ${MIN_SCORE}% gate for critical fee math (#895).`);
      process.exit(1);
    }
    console.log(`PASS: mutation score meets the ${MIN_SCORE}% gate.`);
  } catch (err) {
    console.warn(`WARN: could not parse Stryker report (${err.message}); falling back to Stryker's exit code.`);
    process.exit(result.status ?? 1);
  }
} else {
  console.warn('WARN: no mutation.json report found; relying on Stryker exit code (thresholds.break).');
  process.exit(result.status ?? 1);
}
