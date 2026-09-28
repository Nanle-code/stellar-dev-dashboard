import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import vitestConfig, { coverageThresholds } from '../../vitest.config.js';

describe('Vitest Unified Test Runner Configuration (#961)', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const pkgPath = path.resolve(rootDir, 'package.json');
  const jestConfigPath = path.resolve(rootDir, 'jest.config.js');

  it('primary flow: configures Vitest as the single test runner with unified coverage', () => {
    expect(vitestConfig.test).toBeDefined();
    expect(vitestConfig.test.environment).toBe('jsdom');
    expect(vitestConfig.test.globals).toBe(true);
    expect(vitestConfig.test.clearMocks).toBe(true);

    const coverage = vitestConfig.test.coverage;
    expect(coverage).toBeDefined();
    expect(coverage.provider).toBe('v8');
    expect(coverage.reportsDirectory).toBe('./coverage');
    expect(coverage.thresholds).toBeDefined();
    expect(coverage.thresholds.lines).toBe(coverageThresholds.lines);
    expect(coverage.thresholds.functions).toBe(coverageThresholds.functions);
  });

  it('boundary case: coverage thresholds and test exclusions adhere to safety bounds', () => {
    // Threshold boundaries: 0 <= metric <= 100
    for (const metric of ['lines', 'functions', 'branches', 'statements']) {
      expect(coverageThresholds[metric]).toBeGreaterThanOrEqual(0);
      expect(coverageThresholds[metric]).toBeLessThanOrEqual(100);
    }

    // Per-file targets boundary check
    if (coverageThresholds.targetPaths) {
      for (const [targetFile, targetRules] of Object.entries(coverageThresholds.targetPaths)) {
        expect(targetFile).toMatch(/^src\//);
        for (const [metric, value] of Object.entries(targetRules as Record<string, number>)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      }
    }

    // Excludes should safeguard non-unit test runner paths
    const excludes = vitestConfig.test.exclude || [];
    expect(excludes).toContain('node_modules/**');
    expect(excludes).toContain('tests/e2e/**');
    expect(excludes).toContain('tests/visual/**');
    expect(excludes).toContain('tests/ci/**');
  });

  it('failure case: ensures Jest runner configs, Babel Jest presets, and test:jest scripts are absent', () => {
    // jest.config.js must not exist
    expect(fs.existsSync(jestConfigPath)).toBe(false);

    // package.json must not contain Jest test runner scripts or Jest-only dependencies
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.scripts['test:jest']).toBeUndefined();
    expect(pkg.scripts['test:jest:coverage']).toBeUndefined();

    const devDeps = pkg.devDependencies || {};
    expect(devDeps['@types/jest']).toBeUndefined();
    expect(devDeps['@babel/preset-env']).toBeUndefined();
    expect(devDeps['@babel/preset-react']).toBeUndefined();
    expect(devDeps['@babel/preset-typescript']).toBeUndefined();
  });
});
