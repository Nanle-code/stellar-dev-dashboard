'use strict';

/**
 * Pure rules for the bundle budget gate (#969).
 *
 * Kept dependency-free and CommonJS so both the CLI
 * (`scripts/check-bundle-budgets.mjs`) and the vitest suite
 * (`tests/ci/bundle-budgets.test.mjs`) can require it.
 */

/** Chunk that renders the Overview route — part of the first meaningful paint. */
const OVERVIEW_MODULE_MARKER = 'src/components/dashboard/Overview.tsx';

/**
 * Libraries that must never be reachable from the entry chunk or the Overview
 * chunk. They are heavy and only a subset of views need them, so they have to
 * arrive through a dynamic `import()`.
 *
 * `test` runs against resolved module ids (absolute-ish paths), which is why the
 * patterns anchor on the `node_modules/<pkg>/` segment.
 */
const HEAVY_LIBRARY_RULES = Object.freeze([
  {
    id: 'tfjs',
    label: 'TensorFlow.js (@tensorflow/tfjs)',
    test: /node_modules\/@tensorflow\/tfjs(-[a-z0-9-]+)?\//,
  },
  {
    id: 'react-force-graph',
    label: 'react-force-graph-2d / force-graph',
    test: /node_modules\/(?:react-force-graph[^/]*|force-graph)\//,
  },
  {
    id: 'd3-force-3d',
    label: 'd3-force-3d',
    test: /node_modules\/d3-force-3d\//,
  },
]);

/** Gzipped KB budgets per emitted chunk name. */
const DEFAULT_CHUNK_BUDGETS_KB = Object.freeze({
  vendor: 500,
  'react-vendor': 200,
  'charts-vendor': 350,
  'graph-vendor': 400,
  'ml-vendor': 450,
  'stellar-sdk': 400,
  index: 100, // Initial shell
  default: 150, // Route chunks / lazy chunks
});

class BudgetValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BudgetValidationError';
  }
}

function normalizeModuleId(id) {
  return String(id == null ? '' : id).replace(/\\/g, '/');
}

/**
 * Validate + normalize the artifact emitted by the `emit-bundle-module-map`
 * Vite plugin (`dist/bundle-modules.json`).
 */
function parseBundleModuleMap(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new BudgetValidationError(`bundle module map is not valid JSON: ${error.message}`);
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BudgetValidationError('bundle module map must be an object');
  }
  if (!parsed.chunks || typeof parsed.chunks !== 'object' || Array.isArray(parsed.chunks)) {
    throw new BudgetValidationError('bundle module map must contain a "chunks" object');
  }

  const chunks = {};
  for (const [fileName, chunk] of Object.entries(parsed.chunks)) {
    if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) {
      throw new BudgetValidationError(`chunk "${fileName}" must be an object`);
    }
    if (!Array.isArray(chunk.moduleIds)) {
      throw new BudgetValidationError(`chunk "${fileName}" must list moduleIds[]`);
    }
    chunks[fileName] = {
      name: typeof chunk.name === 'string' && chunk.name ? chunk.name : fileName,
      isEntry: Boolean(chunk.isEntry),
      isDynamicEntry: Boolean(chunk.isDynamicEntry),
      moduleIds: chunk.moduleIds.map(normalizeModuleId),
    };
  }

  return { generatedAt: parsed.generatedAt || null, chunks };
}

function isEntryChunk(chunk) {
  return Boolean(chunk && chunk.isEntry);
}

function chunkContains(chunk, marker) {
  return Boolean(
    chunk && Array.isArray(chunk.moduleIds) && chunk.moduleIds.some((id) => id.includes(marker))
  );
}

function isOverviewChunk(chunk) {
  return chunkContains(chunk, OVERVIEW_MODULE_MARKER);
}

/**
 * Fail when a heavy library is statically reachable from the entry chunk or the
 * Overview chunk. A lazy chunk (route/feature chunk that is neither) is allowed
 * to contain them — that is exactly what the dynamic imports are for.
 *
 * @returns {Array<{fileName: string, chunkName: string, rule: string, label: string, moduleId: string, reason: string}>}
 */
function findHeavyLibraryPlacementViolations(bundleModuleMap, rules = HEAVY_LIBRARY_RULES) {
  const map = parseBundleModuleMap(bundleModuleMap);
  const violations = [];

  for (const [fileName, chunk] of Object.entries(map.chunks)) {
    const reasons = [];
    if (isEntryChunk(chunk)) reasons.push('entry');
    if (isOverviewChunk(chunk)) reasons.push('overview');
    if (reasons.length === 0) continue;

    for (const rule of rules) {
      for (const moduleId of chunk.moduleIds) {
        if (rule.test.test(moduleId)) {
          violations.push({
            fileName,
            chunkName: chunk.name,
            rule: rule.id,
            label: rule.label,
            moduleId,
            reason: reasons.join('+'),
          });
        }
      }
    }
  }

  return violations;
}

/** `assets/index-9f8a2b.js` -> `index` */
function chunkNameFromFileName(fileName) {
  const base = String(fileName).split('/').pop();
  const match = base.match(/^(.+)-[A-Za-z0-9_-]+\.js$/);
  return match ? match[1] : base.replace(/\.js$/, '');
}

function budgetForChunk(chunkName, budgets = DEFAULT_CHUNK_BUDGETS_KB) {
  return Object.prototype.hasOwnProperty.call(budgets, chunkName)
    ? budgets[chunkName]
    : budgets.default;
}

/**
 * @param {Array<{fileName: string, sizeKB: number}>} assets
 * @returns {{passed: boolean, results: Array, failures: Array}}
 */
function evaluateChunkSizes(assets, budgets = DEFAULT_CHUNK_BUDGETS_KB) {
  if (!Array.isArray(assets)) {
    throw new BudgetValidationError('assets must be an array');
  }

  const results = assets.map((asset) => {
    if (
      !asset ||
      typeof asset.fileName !== 'string' ||
      typeof asset.sizeKB !== 'number' ||
      !Number.isFinite(asset.sizeKB)
    ) {
      throw new BudgetValidationError(
        'each asset needs { fileName: string, sizeKB: finite number }'
      );
    }
    const chunkName = chunkNameFromFileName(asset.fileName);
    const budget = budgetForChunk(chunkName, budgets);
    return {
      fileName: asset.fileName,
      chunkName,
      sizeKB: asset.sizeKB,
      budget,
      passed: asset.sizeKB <= budget,
    };
  });

  return {
    passed: results.every((result) => result.passed),
    results,
    failures: results.filter((result) => !result.passed),
  };
}

module.exports = {
  OVERVIEW_MODULE_MARKER,
  HEAVY_LIBRARY_RULES,
  DEFAULT_CHUNK_BUDGETS_KB,
  BudgetValidationError,
  normalizeModuleId,
  parseBundleModuleMap,
  isEntryChunk,
  chunkContains,
  isOverviewChunk,
  findHeavyLibraryPlacementViolations,
  chunkNameFromFileName,
  budgetForChunk,
  evaluateChunkSizes,
};
