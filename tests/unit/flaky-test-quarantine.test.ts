import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadRegistry,
  saveRegistry,
  createDefaultRegistry,
  validateRegistry,
  generateTestId,
  validateOwnerHandle,
  detectAndQuarantine,
  assignOwner,
  reinstateTest,
  recordTestRuns,
  generateQuarantineFilter,
  generateTriageReport,
  checkQuarantineHealth,
  parseArgs,
  InvalidInputError,
  QuarantinePolicyError,
} from '../../scripts/flaky-test-quarantine.mjs';

describe('Flaky Test Quarantine & Triage Workflow (#898)', () => {
  let tmpDir;
  let tmpRegistryPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quarantine-test-'));
    tmpRegistryPath = path.join(tmpDir, 'test-quarantine.json');
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── 1. Registry & Validation Tests ───────────────────────────────────────────
  describe('Registry Loading, Saving & Validation', () => {
    it('primary flow: creates and saves a valid default registry', () => {
      const registry = createDefaultRegistry();
      expect(registry.version).toBe('1.0.0');
      expect(registry.quarantinedTests).toEqual([]);
      expect(registry.policy.requireOwnerBeforeReinstatement).toBe(true);

      saveRegistry(tmpRegistryPath, registry);
      expect(fs.existsSync(tmpRegistryPath)).toBe(true);

      const loaded = loadRegistry(tmpRegistryPath);
      expect(loaded.version).toBe('1.0.0');
      expect(loaded.quarantinedTests.length).toBe(0);
    });

    it('failure case: throws InvalidInputError when registry structure is corrupted', () => {
      fs.writeFileSync(
        tmpRegistryPath,
        '{"version": 123, "quarantinedTests": "not-an-array"}',
        'utf8'
      );
      expect(() => loadRegistry(tmpRegistryPath)).toThrowError(InvalidInputError);
    });

    it('failure case: throws InvalidInputError on invalid test item entries', () => {
      const badRegistry = {
        version: '1.0.0',
        quarantinedTests: [{ id: '123' }], // missing testFile and testName
      };
      expect(() => validateRegistry(badRegistry)).toThrowError(InvalidInputError);
    });
  });

  // ── 2. Owner Handle Validation ───────────────────────────────────────────────
  describe('Owner Handle Validation', () => {
    it('primary flow: validates standard GitHub handles, teams, and emails', () => {
      expect(validateOwnerHandle('@alice')).toBe(true);
      expect(validateOwnerHandle('bob')).toBe(true);
      expect(validateOwnerHandle('team/frontend-infra')).toBe(true);
      expect(validateOwnerHandle('dev@stellar-dashboard.org')).toBe(true);
    });

    it('boundary & failure cases: rejects empty, whitespace, or invalid owner handles', () => {
      expect(validateOwnerHandle('')).toBe(false);
      expect(validateOwnerHandle('   ')).toBe(false);
      expect(validateOwnerHandle(null)).toBe(false);
      expect(validateOwnerHandle(undefined)).toBe(false);
      expect(validateOwnerHandle('invalid owner with spaces')).toBe(false);
    });
  });

  // ── 3. Auto-Quarantine Detection ────────────────────────────────────────────
  describe('Flaky Test Detection & Auto-Quarantine', () => {
    it('primary flow: auto-quarantines tests that exhibit retries or repeat flakiness', () => {
      const registry = createDefaultRegistry();
      const testRuns = [
        {
          testFile: 'src/lib/__tests__/dex.test.ts',
          testName: 'fetches live orderbook depth with polling retry',
          retryCount: 2, // flaked and passed on retry
          errorMessage: 'Timed out waiting for Horizon mock stream',
        },
        {
          testFile: 'src/lib/__tests__/analytics.test.ts',
          testName: 'computes 24h volume',
          retryCount: 0,
          isFlaky: false,
        },
      ];

      const result = detectAndQuarantine(testRuns, registry);
      expect(result.newlyQuarantined.length).toBe(1);
      expect(result.totalQuarantined).toBe(1);

      const quarantined = registry.quarantinedTests[0];
      expect(quarantined.testFile).toBe('src/lib/__tests__/dex.test.ts');
      expect(quarantined.status).toBe('quarantined');
      expect(quarantined.owner).toBeNull(); // No owner yet
      expect(quarantined.consecutivePasses).toBe(0);
    });

    it('boundary case: ignores stable tests with 0 retries and flakiness below threshold', () => {
      const registry = createDefaultRegistry();
      const testRuns = [
        {
          testFile: 'src/lib/__tests__/stable.test.ts',
          testName: 'pure math calculation',
          retryCount: 0,
          flakyOccurrences: 1, // Below default threshold of 2
          isFlaky: false,
        },
      ];

      const result = detectAndQuarantine(testRuns, registry, { flakinessThreshold: 2 });
      expect(result.newlyQuarantined.length).toBe(0);
      expect(result.totalQuarantined).toBe(0);
    });
  });

  // ── 4. Owner Assignment & Reinstatement Policy ───────────────────────────────
  describe('Mandatory Owner Assignment & Reinstatement Verification', () => {
    it('primary flow: assigns owner, records passes, and reinstates test once criteria are met', () => {
      const registry = createDefaultRegistry({
        policy: { requiredPassesForReinstatement: 3, requireOwnerBeforeReinstatement: true },
      });
      const testId = generateTestId('src/lib/__tests__/dex.test.ts', 'flaky query');

      registry.quarantinedTests.push({
        id: testId,
        testFile: 'src/lib/__tests__/dex.test.ts',
        testName: 'flaky query',
        status: 'quarantined',
        quarantinedAt: new Date().toISOString(),
        owner: null,
        consecutivePasses: 0,
      });

      // 1. Assign owner
      const assigned = assignOwner(testId, '@stellar-dev', registry, {
        issueUrl: 'https://github.com/Nanle-code/stellar-dev-dashboard/issues/898',
        notes: 'Investigating async timeout in Dex mock stream',
      });
      expect(assigned.owner.handle).toBe('@stellar-dev');
      expect(assigned.status).toBe('triaged');

      // 2. Record 3 passing runs
      recordTestRuns([{ id: testId, passed: true }], registry);
      recordTestRuns([{ id: testId, passed: true }], registry);
      recordTestRuns([{ id: testId, passed: true }], registry);

      const entry = registry.quarantinedTests.find((t) => t.id === testId);
      expect(entry.consecutivePasses).toBe(3);
      expect(entry.status).toBe('reinstatement_pending');

      // 3. Reinstate test
      const reinstatement = reinstateTest(testId, registry, {
        remediationNotes: 'Fixed mock timer race condition in dex.test.ts',
      });
      expect(reinstatement.success).toBe(true);
      expect(entry.status).toBe('reinstated');
      expect(entry.reinstatedAt).toBeDefined();
    });

    it('FAILURE PATH (CRITICAL POLICY): Rejects reinstatement if test has NO assigned owner', () => {
      const registry = createDefaultRegistry({
        policy: { requiredPassesForReinstatement: 2, requireOwnerBeforeReinstatement: true },
      });
      const testId = 'unowned-test-123';

      registry.quarantinedTests.push({
        id: testId,
        testFile: 'src/lib/__tests__/unowned.test.ts',
        testName: 'unowned flaky test',
        status: 'quarantined',
        quarantinedAt: new Date().toISOString(),
        owner: null, // NO OWNER
        consecutivePasses: 5, // Meets pass streak but lacks owner!
      });

      // Must throw QuarantinePolicyError because owner is missing
      expect(() => reinstateTest(testId, registry)).toThrowError(QuarantinePolicyError);
      expect(() => reinstateTest(testId, registry)).toThrowError(
        /A verified owner is strictly required/
      );
    });

    it('boundary case: Rejects reinstatement if consecutive pass count is insufficient', () => {
      const registry = createDefaultRegistry({
        policy: { requiredPassesForReinstatement: 5, requireOwnerBeforeReinstatement: true },
      });
      const testId = 'owned-test-456';

      registry.quarantinedTests.push({
        id: testId,
        testFile: 'src/lib/__tests__/partially-fixed.test.ts',
        testName: 'partially fixed test',
        status: 'triaged',
        quarantinedAt: new Date().toISOString(),
        owner: { handle: '@qa-lead', assignedAt: new Date().toISOString() },
        consecutivePasses: 4, // 4 out of 5 required passes
      });

      expect(() => reinstateTest(testId, registry)).toThrowError(QuarantinePolicyError);
      expect(() => reinstateTest(testId, registry)).toThrowError(/4\/5 consecutive passes/);
    });

    it('failure case: Throws InvalidInputError when trying to assign invalid owner or non-existent test', () => {
      const registry = createDefaultRegistry();
      expect(() => assignOwner('non-existent-id', '@alice', registry)).toThrowError(
        InvalidInputError
      );
      expect(() => assignOwner('some-id', '   ', registry)).toThrowError(InvalidInputError);
    });
  });

  // ── 5. Quarantine Filters & Triage Reports ───────────────────────────────────
  describe('Quarantine Filters & Triage Reporting', () => {
    it('primary flow: generates Vitest and Playwright exclusion patterns for active quarantined tests', () => {
      const registry = createDefaultRegistry();
      registry.quarantinedTests = [
        {
          id: 'test-1',
          testFile: 'src/lib/__tests__/a.test.ts',
          testName: 'flaky test alpha',
          status: 'quarantined',
        },
        {
          id: 'test-2',
          testFile: 'src/lib/__tests__/b.test.ts',
          testName: 'flaky test beta (with regex special characters [0-9]+)',
          status: 'triaged',
        },
        {
          id: 'test-3',
          testFile: 'src/lib/__tests__/c.test.ts',
          testName: 'reinstated test gamma',
          status: 'reinstated', // Should NOT be in filter
        },
      ];

      const vitestFilter = generateQuarantineFilter(registry, 'vitest');
      expect(vitestFilter).toContain('flaky test alpha');
      expect(vitestFilter).toContain(
        'flaky test beta \\(with regex special characters \\[0-9\\]\\+\\)'
      );
      expect(vitestFilter).not.toContain('reinstated test gamma');

      const listFilter = generateQuarantineFilter(registry, 'list');
      expect(listFilter.length).toBe(2);
    });

    it('primary flow: generates Markdown triage report with warnings for unassigned tests', () => {
      const registry = createDefaultRegistry();
      registry.quarantinedTests = [
        {
          id: 'unassigned-1',
          testFile: 'src/lib/__tests__/a.test.ts',
          testName: 'unassigned flaky test',
          status: 'quarantined',
          quarantinedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days old (Aging)
          owner: null,
          consecutivePasses: 0,
        },
      ];

      const report = generateTriageReport(registry);
      expect(report).toContain('Flaky Test Quarantine Triage Report');
      expect(report).toContain('UNASSIGNED');
      expect(report).toContain('AGING');

      const health = checkQuarantineHealth(registry);
      expect(health.isHealthy).toBe(false);
      expect(health.unassignedCount).toBe(1);
      expect(health.agingCount).toBe(1);
    });

    it('boundary case: returns empty string filter and clean report when 0 quarantined tests', () => {
      const registry = createDefaultRegistry();
      expect(generateQuarantineFilter(registry, 'vitest')).toBe('');
      expect(generateQuarantineFilter(registry, 'playwright')).toBe('');

      const report = generateTriageReport(registry);
      expect(report).toContain('All test suites are healthy');

      const health = checkQuarantineHealth(registry);
      expect(health.isHealthy).toBe(true);
      expect(health.totalActive).toBe(0);
    });
  });

  // ── 6. CLI Argument Parsing ─────────────────────────────────────────────────
  describe('CLI Argument Parsing', () => {
    it('parses CLI subcommands and options properly', () => {
      const args1 = parseArgs([
        '--assign-owner',
        '@dev1',
        '--test-id',
        'test-123',
        '--issue',
        'https://issue/898',
      ]);
      expect(args1.command).toBe('assign-owner');
      expect(args1.owner).toBe('@dev1');
      expect(args1.testId).toBe('test-123');
      expect(args1.issueUrl).toBe('https://issue/898');

      const args2 = parseArgs(['--reinstate', 'test-123', '--force']);
      expect(args2.command).toBe('reinstate');
      expect(args2.testId).toBe('test-123');
      expect(args2.force).toBe(true);

      const args3 = parseArgs(['--check', '--registry', 'custom/quarantine.json']);
      expect(args3.command).toBe('check');
      expect(args3.registry).toBe('custom/quarantine.json');
    });
  });
});
