import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  OVERVIEW_MODULE_MARKER,
  HEAVY_LIBRARY_RULES,
  DEFAULT_CHUNK_BUDGETS_KB,
  BudgetValidationError,
  parseBundleModuleMap,
  chunkContains,
  isEntryChunk,
  isOverviewChunk,
  findHeavyLibraryPlacementViolations,
  chunkNameFromFileName,
  budgetForChunk,
  evaluateChunkSizes,
} = require('../../scripts/bundle-budget-rules.cjs');

// Importing the CLI must not execute the check (guard against a regression that
// would make the gate run — and process.exit — whenever the module is imported).
import * as cli from '../../scripts/check-bundle-budgets.mjs';

const MODULES = {
  entry: '/repo/node_modules/react-dom/client.js',
  tfjs: '/repo/node_modules/@tensorflow/tfjs/dist/index.js',
  tfjsCore: '/repo/node_modules/@tensorflow/tfjs-core/dist/index.js',
  tfjsNode: '/repo/node_modules/@tensorflow/tfjs-node/dist/index.js',
  forceGraph: '/repo/node_modules/react-force-graph-2d/dist/react-force-graph-2d.mjs',
  forceGraphCore: '/repo/node_modules/force-graph/dist/force-graph.mjs',
  d3Force3d: '/repo/node_modules/d3-force-3d/src/index.js',
  overview: `/repo/${OVERVIEW_MODULE_MARKER}`,
  otherSource: '/repo/src/components/layout/widgets/BalanceWidget.tsx',
};

function makeMap(chunks) {
  return { generatedAt: '2026-01-01T00:00:00.000Z', chunks };
}

function chunk(moduleIds, extra = {}) {
  return { name: 'chunk', isEntry: false, isDynamicEntry: false, moduleIds, ...extra };
}

const tempDirs = [];

function makeBuildFixture({ entryModuleIds, moduleMap }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-budgets-'));
  tempDirs.push(dir);
  const assetsDir = path.join(dir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, 'index-abc123.js'), 'console.log("entry");');
  fs.writeFileSync(path.join(assetsDir, 'ml-vendor-def456.js'), 'console.log("tfjs");');
  const moduleMapFile = path.join(dir, 'bundle-modules.json');
  fs.writeFileSync(
    moduleMapFile,
    JSON.stringify(moduleMap || makeMap({
      'assets/index-abc123.js': chunk(entryModuleIds || [MODULES.entry], { name: 'index', isEntry: true }),
      'assets/ml-vendor-def456.js': chunk([MODULES.tfjs], { name: 'ml-vendor', isDynamicEntry: true }),
    }))
  );
  return { assetsDir, moduleMapFile };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('Bundle budget gate (#969)', () => {
  describe('Primary flow — heavy libraries stay in lazy chunks', () => {
    it('parses the Rollup chunk map emitted by vite.config.js', () => {
      const map = parseBundleModuleMap(
        JSON.stringify(makeMap({
          'assets/index-abc123.js': chunk([MODULES.entry], { name: 'index', isEntry: true }),
          'assets/graph-vendor-def456.js': chunk([MODULES.forceGraph, MODULES.d3Force3d], {
            name: 'graph-vendor',
            isDynamicEntry: true,
          }),
        }))
      );

      expect(Object.keys(map.chunks)).toEqual([
        'assets/index-abc123.js',
        'assets/graph-vendor-def456.js',
      ]);
      expect(map.chunks['assets/index-abc123.js'].isEntry).toBe(true);
      expect(map.chunks['assets/graph-vendor-def456.js'].isDynamicEntry).toBe(true);
    });

    it('accepts an entry/Overview budget page with only app code in the first load', () => {
      const violations = findHeavyLibraryPlacementViolations(makeMap({
        'assets/index-abc123.js': chunk([MODULES.entry], { name: 'index', isEntry: true }),
        'assets/DashboardLayout-aaa111.js': chunk([MODULES.overview, MODULES.otherSource], {
          name: 'DashboardLayout',
        }),
        'assets/ml-vendor-bbb222.js': chunk([MODULES.tfjs, MODULES.tfjsCore], {
          name: 'ml-vendor',
          isDynamicEntry: true,
        }),
        'assets/graph-vendor-ccc333.js': chunk([MODULES.forceGraph, MODULES.d3Force3d], {
          name: 'graph-vendor',
          isDynamicEntry: true,
        }),
      }));

      expect(violations).toEqual([]);
    });

    it('passes the CLI run for a build whose entry chunk is clean', () => {
      const { assetsDir, moduleMapFile } = makeBuildFixture({
        entryModuleIds: [MODULES.entry, MODULES.overview],
      });

      const exitCode = cli.run({
        assetsDir,
        moduleMapFile,
        log: () => {},
        errorLog: () => {},
      });

      expect(exitCode).toBe(0);
    });

    it('exposes the CLI helpers the gate is built from', () => {
      expect(typeof cli.run).toBe('function');
      expect(typeof cli.collectChunkSizes).toBe('function');
      expect(typeof cli.readBundleModuleMap).toBe('function');
      expect(HEAVY_LIBRARY_RULES.map((rule) => rule.id)).toEqual([
        'tfjs',
        'react-force-graph',
        'd3-force-3d',
      ]);
      expect(DEFAULT_CHUNK_BUDGETS_KB['ml-vendor']).toBeGreaterThan(0);
      expect(DEFAULT_CHUNK_BUDGETS_KB['graph-vendor']).toBeGreaterThan(0);
    });
  });

  describe('Boundary cases', () => {
    it('passes a chunk that is exactly at its gzipped budget and fails just above it', () => {
      const budgets = { index: 100, default: 150 };

      const atBudget = evaluateChunkSizes([{ fileName: 'index-abc123.js', sizeKB: 100 }], budgets);
      const overBudget = evaluateChunkSizes(
        [{ fileName: 'index-abc123.js', sizeKB: 100.01 }],
        budgets
      );

      expect(atBudget.passed).toBe(true);
      expect(atBudget.results[0].passed).toBe(true);
      expect(overBudget.passed).toBe(false);
      expect(overBudget.failures).toHaveLength(1);
    });

    it('falls back to the default budget for unknown chunk names', () => {
      expect(budgetForChunk('ml-vendor', { 'ml-vendor': 450, default: 150 })).toBe(450);
      expect(budgetForChunk('some-new-route', { 'ml-vendor': 450, default: 150 })).toBe(150);
      expect(chunkNameFromFileName('assets/index-9f8a2b.js')).toBe('index');
      expect(chunkNameFromFileName('graph-vendor-9f8a2b.js')).toBe('graph-vendor');
    });

    it('allows heavy libraries in a lazy chunk that renders neither entry nor Overview', () => {
      const violations = findHeavyLibraryPlacementViolations(makeMap({
        'assets/index-abc123.js': chunk([MODULES.entry], { name: 'index', isEntry: true }),
        'assets/AnalyticsChart-ddd444.js': chunk([MODULES.overview, MODULES.otherSource], {
          name: 'AnalyticsChart',
        }),
        'assets/AdvancedChartSuite-eee555.js': chunk([MODULES.tfjs, MODULES.d3Force3d], {
          name: 'AdvancedChartSuite',
        }),
      }));

      expect(violations).toEqual([]);
    });

    it('detects the entry chunk by flag rather than by file name', () => {
      const violations = findHeavyLibraryPlacementViolations(makeMap({
        'assets/main-abc123.js': chunk([MODULES.tfjs], { name: 'main', isEntry: true }),
        'assets/index-def456.js': chunk([MODULES.entry], { name: 'index' }),
      }));

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        fileName: 'assets/main-abc123.js',
        rule: 'tfjs',
        reason: 'entry',
      });
    });

    it('treats a chunk that renders Overview as first-load even when it is not the entry', () => {
      expect(isEntryChunk(chunk([MODULES.entry]))).toBe(false);
      expect(isOverviewChunk(chunk([MODULES.overview]))).toBe(true);
      expect(chunkContains(chunk([MODULES.overview]), 'src/components/dashboard/Overview.tsx')).toBe(true);
    });
  });

  describe('Failure cases', () => {
    it('fails when TensorFlow.js leaks into the entry chunk', () => {
      const violations = findHeavyLibraryPlacementViolations(makeMap({
        'assets/index-abc123.js': chunk([MODULES.entry, MODULES.tfjs], {
          name: 'index',
          isEntry: true,
        }),
      }));

      expect(violations).toHaveLength(1);
      expect(violations[0].label).toMatch(/TensorFlow/);
      expect(violations[0].moduleId).toBe(MODULES.tfjs);
    });

    it('fails when graph or ML libraries leak into the Overview chunk', () => {
      const violations = findHeavyLibraryPlacementViolations(makeMap({
        'assets/index-abc123.js': chunk([MODULES.entry], { name: 'index', isEntry: true }),
        'assets/DashboardLayout-aaa111.js': chunk(
          [MODULES.overview, MODULES.tfjsCore, MODULES.forceGraph, MODULES.forceGraphCore, MODULES.d3Force3d],
          { name: 'DashboardLayout' }
        ),
      }));

      expect(violations.map((v) => v.rule).sort()).toEqual([
        'd3-force-3d',
        'react-force-graph',
        'react-force-graph',
        'tfjs',
      ]);
      expect(violations.every((v) => v.reason === 'overview')).toBe(true);
    });

    it('matches every tfjs package layout, including tfjs-core/tfjs-node', () => {
      const tfjsRule = HEAVY_LIBRARY_RULES.find((rule) => rule.id === 'tfjs');
      expect(tfjsRule.test.test(MODULES.tfjs)).toBe(true);
      expect(tfjsRule.test.test(MODULES.tfjsCore)).toBe(true);
      expect(tfjsRule.test.test(MODULES.tfjsNode)).toBe(true);
      expect(tfjsRule.test.test(MODULES.otherSource)).toBe(false);
    });

    it('returns exit code 1 and an actionable message when the entry chunk regresses', () => {
      const { assetsDir, moduleMapFile } = makeBuildFixture({
        entryModuleIds: [MODULES.entry, MODULES.tfjs],
      });
      const messages = [];

      const exitCode = cli.run({
        assetsDir,
        moduleMapFile,
        log: () => {},
        errorLog: (message) => messages.push(String(message)),
      });

      expect(exitCode).toBe(1);
      expect(messages.join('\n')).toMatch(/dynamic import\(\)/);
      expect(messages.join('\n')).toMatch(/TensorFlow/);
    });

    it('rejects a malformed bundle module map', () => {
      expect(() => parseBundleModuleMap('{not json')).toThrow(BudgetValidationError);
      expect(() => parseBundleModuleMap({})).toThrow(/chunks/);
      expect(() =>
        parseBundleModuleMap({ chunks: { 'assets/index-abc.js': { name: 'index' } } })
      ).toThrow(/moduleIds/);
      expect(() => evaluateChunkSizes([{ fileName: 'index.js', sizeKB: Number.NaN }])).toThrow(
        /fileName/
      );
    });

    it('fails the CLI when the build artifact needed for the rule is missing', () => {
      const { assetsDir } = makeBuildFixture({});

      const exitCode = cli.run({
        assetsDir,
        moduleMapFile: path.join(assetsDir, 'does-not-exist.json'),
        log: () => {},
        errorLog: () => {},
      });

      expect(exitCode).toBe(1);
    });
  });
});
