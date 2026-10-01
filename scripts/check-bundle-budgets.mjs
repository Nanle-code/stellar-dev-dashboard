#!/usr/bin/env node
/**
 * Bundle budget gate.
 *
 * Two families of checks run here:
 *
 * 1. Gzipped size budgets per emitted chunk (`DEFAULT_CHUNK_BUDGETS_KB`).
 * 2. Heavy-library placement rules (#969): `@tensorflow/tfjs`,
 *    `react-force-graph-2d`/`force-graph` and `d3-force-3d` must not appear in
 *    the entry chunk or in the chunk that renders the Overview route. They are
 *    expected to arrive through dynamic `import()` instead.
 *
 * The placement rules read `dist/bundle-modules.json`, which the
 * `emit-bundle-module-map` plugin in `vite.config.js` writes during
 * `vite build`. That map is authoritative (it comes straight from Rollup's
 * chunk graph) so the check does not have to guess from minified bundle text.
 *
 * Exit codes:
 *   0 — every budget and placement rule passed
 *   1 — a budget was exceeded, a heavy library leaked into the first load, or
 *       the build output could not be inspected
 *
 * Usage:
 *   node scripts/check-bundle-budgets.mjs
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const {
  DEFAULT_CHUNK_BUDGETS_KB,
  BudgetValidationError,
  parseBundleModuleMap,
  findHeavyLibraryPlacementViolations,
  evaluateChunkSizes,
} = require('./bundle-budget-rules.cjs');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
export const DIST_ASSETS = join(ROOT, 'dist', 'assets');
export const BUNDLE_MODULE_MAP = join(ROOT, 'dist', 'bundle-modules.json');

/**
 * Gzip every emitted JS asset and report its size in KB.
 * @returns {Array<{fileName: string, sizeKB: number, rawKB: number}>}
 */
export function collectChunkSizes(assetsDir = DIST_ASSETS) {
  const files = readdirSync(assetsDir).filter((file) => file.endsWith('.js'));

  return files.map((fileName) => {
    const content = readFileSync(join(assetsDir, fileName));
    return {
      fileName,
      sizeKB: zlib.gzipSync(content).length / 1024,
      rawKB: content.length / 1024,
    };
  });
}

/** Read + validate the chunk graph emitted during `vite build`. */
export function readBundleModuleMap(moduleMapFile = BUNDLE_MODULE_MAP) {
  return parseBundleModuleMap(readFileSync(moduleMapFile, 'utf8'));
}

/**
 * Locate `bundle-modules.json`. Vite keeps an explicit `fileName` verbatim, but
 * accept the `assets/` location too so a future change to `assetFileNames`
 * cannot silently disable the placement rules.
 */
export function resolveBundleModuleMapPath(root = ROOT) {
  const candidates = [
    join(root, 'dist', 'bundle-modules.json'),
    join(root, 'dist', 'assets', 'bundle-modules.json'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
}

/**
 * Run both check families.
 *
 * @param {object} [options]
 * @param {string} [options.assetsDir]     Directory holding the built JS assets.
 * @param {string} [options.moduleMapFile] Path to `bundle-modules.json`.
 * @param {object} [options.budgets]       Chunk name -> gzipped KB budget.
 * @param {(message?: unknown) => void} [options.log]
 * @param {(message?: unknown) => void} [options.errorLog]
 * @returns {number} process exit code
 */
export function run(options = {}) {
  const {
    assetsDir = DIST_ASSETS,
    moduleMapFile = resolveBundleModuleMapPath(),
    budgets = DEFAULT_CHUNK_BUDGETS_KB,
    log = console.log,
    errorLog = console.error,
  } = options;

  log('Checking bundle budgets...');

  let sizeReport;
  try {
    sizeReport = evaluateChunkSizes(collectChunkSizes(assetsDir), budgets);
  } catch (error) {
    errorLog(`Failed to analyze bundles: ${error.message}`);
    errorLog('Run `npm run build` (vite build) before the bundle budget check.');
    return 1;
  }

  for (const result of sizeReport.results) {
    const line = `${result.fileName}: ${result.sizeKB.toFixed(2)} KB (limit ${result.budget} KB)`;
    if (result.passed) {
      log(`✅ ${line}`);
    } else {
      errorLog(`❌ Budget Exceeded: ${line}`);
    }
  }

  let violations;
  try {
    violations = findHeavyLibraryPlacementViolations(readBundleModuleMap(moduleMapFile));
  } catch (error) {
    const detail =
      error instanceof BudgetValidationError ? error.message : `${moduleMapFile}: ${error.message}`;
    errorLog(`❌ Could not verify heavy-library placement: ${detail}`);
    errorLog(
      '   dist/bundle-modules.json is emitted by the `emit-bundle-module-map` plugin in vite.config.js during `vite build`.'
    );
    return 1;
  }

  for (const violation of violations) {
    errorLog(
      `❌ ${violation.label} is reachable from the ${violation.reason} chunk ` +
        `(${violation.fileName} ← ${violation.moduleId}). ` +
        'Load it with a dynamic import() instead.'
    );
  }

  if (sizeReport.failures.length === 0 && violations.length === 0) {
    log('\nAll bundle budgets passed!');
    return 0;
  }

  errorLog('\nBundle budget check failed. Please optimize your imports.');
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(run());
}
