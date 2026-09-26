#!/usr/bin/env node
/**
 * Flaky Test Quarantine & Triage Manager
 *
 * Automatically detects repeatedly flaky tests, isolates them in a quarantine
 * registry to prevent blocking main CI, and enforces mandatory owner assignment
 * and verified pass-streaks before any test can be reinstated.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';

export const DEFAULT_REGISTRY_PATH = '.github/test-quarantine.json';
export const DEFAULT_FLAKINESS_THRESHOLD = 2; // Number of flaky occurrences before auto-quarantine
export const DEFAULT_REQUIRED_PASSES = 5; // Consecutive passes in quarantine before reinstatement
export const DEFAULT_MAX_QUARANTINE_DAYS = 30;

// ─── Error Classes ────────────────────────────────────────────────────────────

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

export class QuarantinePolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QuarantinePolicyError';
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function generateTestId(testFile, testName) {
  if (!testFile || !testName) {
    throw new InvalidInputError('testFile and testName are required to generate test ID.');
  }
  const normalized = `${testFile.trim()}::${testName.trim()}`;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
}

export function validateOwnerHandle(owner) {
  if (typeof owner !== 'string' || !owner.trim()) {
    return false;
  }
  const clean = owner.trim();
  // Valid handles: @username, username, team/name, email@domain.com
  return /^(@?[a-zA-Z0-9_\-\.]+|\b[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+|[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)$/.test(
    clean
  );
}

// ─── Registry Management ──────────────────────────────────────────────────────

export function createDefaultRegistry(overrides = {}) {
  return {
    version: '1.0.0',
    description:
      'Registry of quarantined flaky tests with required owner assignments and reinstatement criteria.',
    policy: {
      flakinessThreshold: DEFAULT_FLAKINESS_THRESHOLD,
      requiredPassesForReinstatement: DEFAULT_REQUIRED_PASSES,
      requireOwnerBeforeReinstatement: true,
      maxQuarantineDays: DEFAULT_MAX_QUARANTINE_DAYS,
      ...overrides.policy,
    },
    lastUpdated: new Date().toISOString(),
    quarantinedTests: overrides.quarantinedTests || [],
  };
}

export function loadRegistry(registryPath = DEFAULT_REGISTRY_PATH) {
  if (!registryPath || typeof registryPath !== 'string') {
    throw new InvalidInputError('Registry path must be a non-empty string.');
  }

  const resolved = path.resolve(process.cwd(), registryPath);
  if (!fs.existsSync(resolved)) {
    return createDefaultRegistry();
  }

  let content;
  try {
    content = fs.readFileSync(resolved, 'utf8');
  } catch (err) {
    throw new UnsupportedEnvironmentError(
      `Failed to read quarantine registry from ${resolved}: ${err.message}`
    );
  }

  try {
    const parsed = JSON.parse(content);
    validateRegistry(parsed);
    return parsed;
  } catch (err) {
    if (err instanceof InvalidInputError) throw err;
    throw new InvalidInputError(`Corrupted quarantine registry at ${resolved}: ${err.message}`);
  }
}

export function saveRegistry(registryPath = DEFAULT_REGISTRY_PATH, registry) {
  if (!registry || typeof registry !== 'object') {
    throw new InvalidInputError('Cannot save invalid registry object.');
  }
  validateRegistry(registry);

  registry.lastUpdated = new Date().toISOString();
  const resolved = path.resolve(process.cwd(), registryPath);
  const dir = path.dirname(resolved);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    fs.writeFileSync(resolved, JSON.stringify(registry, null, 2) + '\n', 'utf8');
  } catch (err) {
    throw new UnsupportedEnvironmentError(
      `Failed to write quarantine registry to ${resolved}: ${err.message}`
    );
  }
}

export function validateRegistry(registry) {
  if (!registry || typeof registry !== 'object') {
    throw new InvalidInputError('Registry must be a valid JSON object.');
  }

  if (!registry.version || typeof registry.version !== 'string') {
    throw new InvalidInputError('Registry missing required "version" field.');
  }

  if (!Array.isArray(registry.quarantinedTests)) {
    throw new InvalidInputError('Registry "quarantinedTests" must be an array.');
  }

  for (let i = 0; i < registry.quarantinedTests.length; i++) {
    const item = registry.quarantinedTests[i];
    if (!item.id || typeof item.id !== 'string') {
      throw new InvalidInputError(`Quarantined test at index ${i} missing required "id".`);
    }
    if (!item.testFile || typeof item.testFile !== 'string') {
      throw new InvalidInputError(`Quarantined test "${item.id}" missing required "testFile".`);
    }
    if (!item.testName || typeof item.testName !== 'string') {
      throw new InvalidInputError(`Quarantined test "${item.id}" missing required "testName".`);
    }
    if (!item.status || typeof item.status !== 'string') {
      throw new InvalidInputError(`Quarantined test "${item.id}" missing required "status".`);
    }
  }

  return true;
}

// ─── Detection & Auto-Quarantine ──────────────────────────────────────────────

/**
 * Ingests test execution results and identifies flaky tests to quarantine.
 * A test is considered flaky if:
 * 1. It passed on retry (retries > 0), OR
 * 2. It failed in the current run and has prior failure history exceeding threshold.
 */
export function detectAndQuarantine(testRuns, registry, options = {}) {
  if (!Array.isArray(testRuns)) {
    throw new InvalidInputError('testRuns must be an array of test run objects.');
  }
  if (!registry || typeof registry !== 'object') {
    throw new InvalidInputError('registry must be provided.');
  }

  const threshold =
    options.flakinessThreshold ||
    registry.policy?.flakinessThreshold ||
    DEFAULT_FLAKINESS_THRESHOLD;
  const newlyQuarantined = [];
  const updatedQuarantined = [];

  for (const testRun of testRuns) {
    if (!testRun.testFile || !testRun.testName) {
      continue; // Skip invalid run entry
    }

    const testId = testRun.id || generateTestId(testRun.testFile, testRun.testName);
    const isFlaky =
      testRun.isFlaky ||
      (testRun.retryCount && testRun.retryCount > 0) ||
      testRun.flakyOccurrences >= threshold;

    let existing = registry.quarantinedTests.find((t) => t.id === testId);

    if (isFlaky) {
      if (!existing) {
        const newEntry = {
          id: testId,
          testFile: testRun.testFile,
          testName: testRun.testName,
          suiteName: testRun.suiteName || undefined,
          quarantinedAt: new Date().toISOString(),
          status: 'quarantined',
          flakinessCount: testRun.flakyOccurrences || 1,
          failureHistory: [
            {
              timestamp: new Date().toISOString(),
              errorSnippet: testRun.errorMessage
                ? String(testRun.errorMessage).slice(0, 300)
                : 'Test flaked during execution',
              commit: options.commit || process.env.GITHUB_SHA || 'local',
            },
          ],
          owner: null, // Owner is strictly required before reinstatement
          consecutivePasses: 0,
          notes: testRun.notes || 'Automatically quarantined due to repeated flakiness.',
        };

        registry.quarantinedTests.push(newEntry);
        newlyQuarantined.push(newEntry);
      } else if (existing.status !== 'reinstated') {
        existing.flakinessCount = (existing.flakinessCount || 0) + 1;
        existing.consecutivePasses = 0; // Reset pass streak on new flake
        if (!existing.failureHistory) existing.failureHistory = [];
        existing.failureHistory.push({
          timestamp: new Date().toISOString(),
          errorSnippet: testRun.errorMessage
            ? String(testRun.errorMessage).slice(0, 300)
            : 'Test flaked again in run',
          commit: options.commit || process.env.GITHUB_SHA || 'local',
        });
        updatedQuarantined.push(existing);
      }
    }
  }

  return {
    newlyQuarantined,
    updatedQuarantined,
    totalQuarantined: registry.quarantinedTests.filter((t) => t.status !== 'reinstated').length,
  };
}

// ─── Owner Assignment ─────────────────────────────────────────────────────────

/**
 * Assigns an owner to a quarantined test.
 * Owner assignment transitions status from 'quarantined' to 'triaged' / 'in_remediation'.
 */
export function assignOwner(testId, ownerHandle, registry, options = {}) {
  if (!testId || typeof testId !== 'string') {
    throw new InvalidInputError('testId must be a non-empty string.');
  }
  if (!ownerHandle || !validateOwnerHandle(ownerHandle)) {
    throw new InvalidInputError(
      `Invalid owner handle: "${ownerHandle}". Must be a valid GitHub handle, team, or email.`
    );
  }
  if (!registry || !Array.isArray(registry.quarantinedTests)) {
    throw new InvalidInputError('Invalid registry object.');
  }

  const cleanHandle = ownerHandle.trim().startsWith('@')
    ? ownerHandle.trim()
    : `@${ownerHandle.trim()}`;
  const entry = registry.quarantinedTests.find((t) => t.id === testId);

  if (!entry) {
    throw new InvalidInputError(`Quarantined test with ID "${testId}" not found in registry.`);
  }

  entry.owner = {
    handle: cleanHandle,
    assignedAt: new Date().toISOString(),
    assignedBy: options.assignedBy || process.env.GITHUB_ACTOR || 'system',
    team: options.team || undefined,
  };

  if (entry.status === 'quarantined') {
    entry.status = 'triaged';
  }

  if (options.issueUrl) {
    entry.issueUrl = options.issueUrl;
  }

  if (options.notes) {
    entry.notes = options.notes;
  }

  return entry;
}

// ─── Reinstatement Enforcement ────────────────────────────────────────────────

/**
 * Reinstates a quarantined test back into normal CI execution.
 * MANDATORY RULE: A test CANNOT be reinstated without an assigned owner!
 * Also requires meeting minimum consecutive pass streak.
 */
export function reinstateTest(testId, registry, options = {}) {
  if (!testId || typeof testId !== 'string') {
    throw new InvalidInputError('testId must be a non-empty string.');
  }
  if (!registry || !Array.isArray(registry.quarantinedTests)) {
    throw new InvalidInputError('Invalid registry object.');
  }

  const entry = registry.quarantinedTests.find((t) => t.id === testId);
  if (!entry) {
    throw new InvalidInputError(`Quarantined test with ID "${testId}" not found in registry.`);
  }

  if (entry.status === 'reinstated') {
    return {
      success: true,
      alreadyReinstated: true,
      entry,
    };
  }

  // 1. Mandatory Owner Enforcement Rule
  const requireOwner = registry.policy?.requireOwnerBeforeReinstatement ?? true;
  if (
    requireOwner &&
    (!entry.owner || !entry.owner.handle || !validateOwnerHandle(entry.owner.handle))
  ) {
    throw new QuarantinePolicyError(
      `Cannot reinstate test "${entry.testName} (${entry.id})": A verified owner is strictly required before reinstatement. Please assign an owner first using --assign-owner.`
    );
  }

  // 2. Minimum Pass Streak Verification Rule
  const requiredPasses = options.force
    ? 0
    : registry.policy?.requiredPassesForReinstatement || DEFAULT_REQUIRED_PASSES;
  const currentPasses = entry.consecutivePasses || 0;

  if (currentPasses < requiredPasses) {
    throw new QuarantinePolicyError(
      `Cannot reinstate test "${entry.testName} (${entry.id})": Test has only ${currentPasses}/${requiredPasses} consecutive passes in quarantine verification runs.`
    );
  }

  // Reinstatement approved
  entry.status = 'reinstated';
  entry.reinstatedAt = new Date().toISOString();
  entry.reinstatedBy = options.reinstatedBy || entry.owner.handle;
  if (options.remediationNotes) {
    entry.remediationNotes = options.remediationNotes;
  }

  return {
    success: true,
    entry,
  };
}

// ─── Run Recording ────────────────────────────────────────────────────────────

/**
 * Updates pass/fail streaks for quarantined tests running in isolated verification matrix.
 */
export function recordTestRuns(runResults, registry) {
  if (!Array.isArray(runResults)) {
    throw new InvalidInputError('runResults must be an array.');
  }
  if (!registry || !Array.isArray(registry.quarantinedTests)) {
    throw new InvalidInputError('Invalid registry object.');
  }

  const updated = [];
  for (const res of runResults) {
    const testId = res.id || generateTestId(res.testFile, res.testName);
    const entry = registry.quarantinedTests.find((t) => t.id === testId);
    if (entry && entry.status !== 'reinstated') {
      if (res.passed) {
        entry.consecutivePasses = (entry.consecutivePasses || 0) + 1;
        if (
          entry.consecutivePasses >=
            (registry.policy?.requiredPassesForReinstatement || DEFAULT_REQUIRED_PASSES) &&
          entry.owner
        ) {
          entry.status = 'reinstatement_pending';
        }
      } else {
        entry.consecutivePasses = 0; // Streak broken
        entry.status = entry.owner ? 'triaged' : 'quarantined';
      }
      updated.push(entry);
    }
  }

  return updated;
}

// ─── Quarantine Filter Generation ─────────────────────────────────────────────

/**
 * Returns exclusion or inclusion patterns for test runners (Vitest / Playwright).
 */
export function generateQuarantineFilter(registry, format = 'vitest') {
  if (!registry || !Array.isArray(registry.quarantinedTests)) {
    throw new InvalidInputError('Invalid registry object.');
  }

  const activeQuarantined = registry.quarantinedTests.filter((t) => t.status !== 'reinstated');

  if (format === 'list') {
    return activeQuarantined.map((t) => ({
      id: t.id,
      file: t.testFile,
      name: t.testName,
      owner: t.owner?.handle || 'UNASSIGNED',
      status: t.status,
    }));
  }

  if (format === 'playwright') {
    // Returns grep invert regex pattern
    if (activeQuarantined.length === 0) return '';
    const escapedNames = activeQuarantined.map((t) => escapeRegex(t.testName)).join('|');
    return `(${escapedNames})`;
  }

  // Vitest regex exclusion pattern
  if (activeQuarantined.length === 0) return '';
  const escaped = activeQuarantined.map((t) => escapeRegex(t.testName)).join('|');
  return `(${escaped})`;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Triage Report & Audit ────────────────────────────────────────────────────

/**
 * Generates Markdown triage report and checks quarantine health policy.
 */
export function generateTriageReport(registry) {
  if (!registry || !Array.isArray(registry.quarantinedTests)) {
    throw new InvalidInputError('Invalid registry object.');
  }

  const active = registry.quarantinedTests.filter((t) => t.status !== 'reinstated');
  const unassigned = active.filter((t) => !t.owner || !t.owner.handle);
  const pendingReinstatement = active.filter((t) => t.status === 'reinstatement_pending');
  const maxDays = registry.policy?.maxQuarantineDays || DEFAULT_MAX_QUARANTINE_DAYS;

  let report = '# Flaky Test Quarantine Triage Report\n\n';
  report += `**Total Quarantined**: ${active.length} | **Unassigned**: ${unassigned.length} | **Ready for Reinstatement**: ${pendingReinstatement.length}\n\n`;

  if (unassigned.length > 0) {
    report += `> [!WARNING]\n`;
    report += `> **${unassigned.length} quarantined test(s) are missing an assigned owner.** Tests cannot be reinstated without an owner.\n\n`;
  }

  if (active.length === 0) {
    report += 'All test suites are healthy. No active tests in quarantine.\n';
    return report;
  }

  report += '| Test ID | Test File & Name | Owner | Status | Passes | Quarantined Age |\n';
  report += '|:---|:---|:---|:---|:---:|:---:|\n';

  const now = Date.now();
  for (const t of active) {
    const ageDays = Math.floor((now - new Date(t.quarantinedAt).getTime()) / (1000 * 60 * 60 * 24));
    const ageDisplay = ageDays > maxDays ? `⚠️ ${ageDays}d (AGING)` : `${ageDays}d`;
    const ownerDisplay = t.owner?.handle ? `\`${t.owner.handle}\`` : '**⚠️ UNASSIGNED**';
    const passes = `${t.consecutivePasses || 0}/${registry.policy?.requiredPassesForReinstatement || DEFAULT_REQUIRED_PASSES}`;

    report += `| \`${t.id}\` | **${escapeMarkdown(t.testName)}**<br>_${escapeMarkdown(t.testFile)}_ | ${ownerDisplay} | \`${t.status}\` | ${passes} | ${ageDisplay} |\n`;
  }

  return report;
}

function escapeMarkdown(text) {
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function checkQuarantineHealth(registry) {
  if (!registry || !Array.isArray(registry.quarantinedTests)) {
    throw new InvalidInputError('Invalid registry object.');
  }

  const active = registry.quarantinedTests.filter((t) => t.status !== 'reinstated');
  const unassigned = active.filter((t) => !t.owner || !t.owner.handle);
  const now = Date.now();
  const maxDays = registry.policy?.maxQuarantineDays || DEFAULT_MAX_QUARANTINE_DAYS;
  const aging = active.filter((t) => {
    const ageDays = Math.floor((now - new Date(t.quarantinedAt).getTime()) / (1000 * 60 * 60 * 24));
    return ageDays > maxDays;
  });

  return {
    isHealthy: unassigned.length === 0 && aging.length === 0,
    totalActive: active.length,
    unassignedCount: unassigned.length,
    unassignedTests: unassigned,
    agingCount: aging.length,
    agingTests: aging,
  };
}

// ─── CLI Entrypoint & Argument Parsing ────────────────────────────────────────

export function parseArgs(argv = []) {
  const args = {
    command: 'check',
    registry: DEFAULT_REGISTRY_PATH,
    testId: null,
    owner: null,
    issueUrl: null,
    notes: null,
    resultsPath: null,
    format: 'vitest',
    force: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--registry':
      case '-r':
        args.registry = argv[++i];
        break;
      case '--test-id':
      case '-id':
        args.testId = argv[++i];
        break;
      case '--owner':
      case '-o':
        args.owner = argv[++i];
        break;
      case '--issue':
        args.issueUrl = argv[++i];
        break;
      case '--notes':
        args.notes = argv[++i];
        break;
      case '--results':
        args.resultsPath = argv[++i];
        break;
      case '--format':
        args.format = argv[++i];
        break;
      case '--force':
        args.force = true;
        break;
      case '--assign-owner':
        args.command = 'assign-owner';
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
          args.owner = argv[++i];
        }
        break;
      case '--reinstate':
        args.command = 'reinstate';
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
          args.testId = argv[++i];
        }
        break;
      case '--detect':
        args.command = 'detect';
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
          args.resultsPath = argv[++i];
        }
        break;
      case '--record-run':
        args.command = 'record-run';
        if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
          args.resultsPath = argv[++i];
        }
        break;
      case '--export-filter':
      case '--filter':
        args.command = 'filter';
        break;
      case '--report':
        args.command = 'report';
        break;
      case '--check':
        args.command = 'check';
        break;
      case '--help':
      case '-h':
        args.command = 'help';
        break;
      default:
        if (!arg.startsWith('-') && !args.testId) {
          args.testId = arg;
        }
        break;
    }
  }

  return args;
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (args.command === 'help') {
    console.info(`
Flaky Test Quarantine & Triage CLI

Usage:
  node scripts/flaky-test-quarantine.mjs [options]

Commands:
  --check                    Check quarantine registry health and unassigned tests
  --report                   Output Markdown triage report (and write GITHUB_STEP_SUMMARY)
  --assign-owner <owner>     Assign an owner to a quarantined test (--test-id <id>)
  --reinstate                Reinstate a fixed test (--test-id <id>) [REQUIRES OWNER]
  --detect <results.json>    Detect flaky tests in results and auto-quarantine
  --record-run <results.json> Record pass/fail streaks for quarantined tests
  --filter                   Output runner filter pattern for quarantined tests

Options:
  --registry <path>          Path to test-quarantine.json (default: .github/test-quarantine.json)
  --test-id <id>             Quarantined test ID
  --owner <handle>           GitHub username, team, or email
  --format <vitest|playwright|list>  Output format for filters
`);
    return 0;
  }

  const registry = loadRegistry(args.registry);

  switch (args.command) {
    case 'assign-owner': {
      if (!args.testId) {
        throw new InvalidInputError('Missing required --test-id argument for assign-owner.');
      }
      if (!args.owner) {
        throw new InvalidInputError('Missing required --owner argument for assign-owner.');
      }
      const entry = assignOwner(args.testId, args.owner, registry, {
        issueUrl: args.issueUrl,
        notes: args.notes,
      });
      saveRegistry(args.registry, registry);
      console.info(
        `Assigned owner ${entry.owner.handle} to test "${entry.testName}" (${entry.id}). Status: ${entry.status}.`
      );
      return 0;
    }

    case 'reinstate': {
      if (!args.testId) {
        throw new InvalidInputError('Missing required --test-id argument for reinstatement.');
      }
      const result = reinstateTest(args.testId, registry, {
        force: args.force,
        remediationNotes: args.notes,
      });
      saveRegistry(args.registry, registry);
      console.info(`Successfully reinstated test "${result.entry.testName}" (${result.entry.id}).`);
      return 0;
    }

    case 'detect': {
      if (!args.resultsPath) {
        throw new InvalidInputError('Missing required test results file path for detect.');
      }
      const raw = fs.readFileSync(path.resolve(process.cwd(), args.resultsPath), 'utf8');
      const testRuns = JSON.parse(raw);
      const res = detectAndQuarantine(testRuns, registry);
      saveRegistry(args.registry, registry);
      console.info(
        `Detection complete: ${res.newlyQuarantined.length} newly quarantined, ${res.totalQuarantined} total active in quarantine.`
      );
      return 0;
    }

    case 'record-run': {
      if (!args.resultsPath) {
        throw new InvalidInputError('Missing required test results file path for record-run.');
      }
      const raw = fs.readFileSync(path.resolve(process.cwd(), args.resultsPath), 'utf8');
      const testRuns = JSON.parse(raw);
      const updated = recordTestRuns(testRuns, registry);
      saveRegistry(args.registry, registry);
      console.info(`Updated pass streaks for ${updated.length} quarantined tests.`);
      return 0;
    }

    case 'filter': {
      const filter = generateQuarantineFilter(registry, args.format);
      if (typeof filter === 'string') {
        process.stdout.write(filter);
      } else {
        console.info(JSON.stringify(filter, null, 2));
      }
      return 0;
    }

    case 'report': {
      const report = generateTriageReport(registry);
      console.info(report);
      if (process.env.GITHUB_STEP_SUMMARY) {
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
      }
      return 0;
    }

    case 'check':
    default: {
      const health = checkQuarantineHealth(registry);
      console.info(`Quarantine Status: ${health.totalActive} active quarantined tests.`);
      if (!health.isHealthy) {
        if (health.unassignedCount > 0) {
          console.warn(
            `WARNING: ${health.unassignedCount} quarantined test(s) missing required owner assignment.`
          );
        }
        if (health.agingCount > 0) {
          console.warn(
            `WARNING: ${health.agingCount} quarantined test(s) exceed maximum quarantine duration.`
          );
        }
      } else {
        console.info('All quarantined tests have assigned owners and comply with triage policy.');
      }
      return 0;
    }
  }
}

// Direct execution guard
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  runCli().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
