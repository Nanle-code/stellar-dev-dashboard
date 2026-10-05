#!/usr/bin/env node
/**
 * CI Gate: TypeScript Type Checker
 *
 * Runs `tsc --noEmit` against the project's TypeScript configuration and
 * enforces it as a required CI gate. Fails the build (exit 1) on any type
 * error so that broken pull requests cannot merge.
 *
 * Exit codes:
 *   0 - Type check passed (no errors).
 *   1 - Type check failed (one or more TypeScript errors).
 *   2 - Script error (invalid input, missing tsc, unsupported environment).
 *
 * Usage:
 *   node scripts/type-check.mjs [options]
 *
 * Options:
 *   --project=<path>   Path to tsconfig.json (default: ./tsconfig.json)
 *   --dry-run          Print the tsc command without executing it.
 *   --verbose          Show detailed diagnostics and timing.
 *   --help             Show this help message.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Minimum supported Node major version. The CI matrix targets Node 18+.
const MIN_NODE_MAJOR = 18;

export const DEFAULT_PROJECT = 'tsconfig.json';
export const EXIT_PASS = 0;
export const EXIT_TYPE_ERROR = 1;
export const EXIT_SCRIPT_ERROR = 2;

const options = {
  project: DEFAULT_PROJECT,
  dryRun: false,
  verbose: false,
};

export function resetOptions() {
  options.project = DEFAULT_PROJECT;
  options.dryRun = false;
  options.verbose = false;
}

export function parseArgs(argv) {
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      return { action: 'help' };
    }

    if (arg.startsWith('--project=')) {
      options.project = arg.slice('--project='.length);
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }

    return { action: 'error', message: `Unknown option: ${arg}` };
  }

  return { action: 'run' };
}

export function printHelp() {
  console.log(
    [
      'Usage: node scripts/type-check.mjs [options]',
      '',
      'Options:',
      '  --project=<path>   Path to tsconfig.json (default: ./tsconfig.json)',
      '  --dry-run          Print the tsc command without executing it.',
      '  --verbose          Show detailed diagnostics and timing.',
      '  --help             Show this help message.',
      '',
    ].join('\n')
  );
}

export function validateNodeVersion(nodeVersion = process.versions.node) {
  const [major] = nodeVersion.split('.').map(Number);
  if (major < MIN_NODE_MAJOR) {
    return {
      ok: false,
      message: `Unsupported Node.js version: ${nodeVersion}. Minimum supported version is ${MIN_NODE_MAJOR}.x.`,
    };
  }
  return { ok: true, message: `Node.js ${nodeVersion} — supported.` };
}

export function resolveTsconfigPath(project = options.project, root = ROOT) {
  const candidate = isAbsolute(project) ? project : resolve(root, project);

  if (!existsSync(candidate)) {
    return { ok: false, message: `TypeScript configuration not found: ${candidate}` };
  }

  let stat;
  try {
    stat = statSync(candidate);
  } catch (error) {
    return { ok: false, message: `Cannot read tsconfig at ${candidate}: ${error.message}` };
  }

  if (!stat.isFile()) {
    return { ok: false, message: `tsconfig path is not a file: ${candidate}` };
  }

  return { ok: true, path: candidate };
}

export function findTsc(
  existsFn = existsSync,
  localBin = resolve(ROOT, 'node_modules', '.bin', 'tsc')
) {
  if (existsFn(localBin)) {
    return { ok: true, path: localBin };
  }

  return {
    ok: false,
    message: 'TypeScript compiler (tsc) not found. Install it with `npm install`.',
  };
}

export function runTypeCheck(tscPath, tsconfigPath, runFn = runTscDefault) {
  const args = ['--noEmit', '--project', tsconfigPath];

  if (options.verbose) {
    console.log(`Running: ${tscPath} ${args.join(' ')}`);
  }

  if (options.dryRun) {
    console.log(`[dry-run] ${tscPath} ${args.join(' ')}`);
    return EXIT_PASS;
  }

  return runFn(tscPath, args);
}

function runTscDefault(tscPath, args) {
  try {
    const isWin = process.platform === 'win32';
    // On Windows the local tsc shim is a .cmd batch wrapper; quote it and
    // invoke through the shell so it resolves correctly.
    const targetBin = isWin && !tscPath.endsWith('.cmd') && existsSync(`${tscPath}.cmd`)
      ? `${tscPath}.cmd`
      : tscPath;
    const bin = isWin ? `"${targetBin}"` : targetBin;
    const formattedArgs = isWin
      ? args.map((arg) => (arg.includes(' ') && !arg.startsWith('"') ? `"${arg}"` : arg))
      : args;
    execFileSync(bin, formattedArgs, {
      cwd: ROOT,
      stdio: 'inherit',
      maxBuffer: 50 * 1024 * 1024,
      shell: isWin,
    });
    return EXIT_PASS;
  } catch (error) {
    // tsc exits non-zero when type errors are found.
    return error.status ?? EXIT_TYPE_ERROR;
  }
}

export function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);

  if (parsed.action === 'help') {
    printHelp();
    return EXIT_PASS;
  }

  if (parsed.action === 'error') {
    console.error(parsed.message);
    printHelp();
    return EXIT_SCRIPT_ERROR;
  }

  if (options.verbose) {
    console.log('=== TypeScript Type Check Gate ===');
  }

  const nodeCheck = validateNodeVersion();
  if (!nodeCheck.ok) {
    console.error(nodeCheck.message);
    return EXIT_SCRIPT_ERROR;
  }
  if (options.verbose) {
    console.log(nodeCheck.message);
  }

  const tsconfigCheck = resolveTsconfigPath();
  if (!tsconfigCheck.ok) {
    console.error(tsconfigCheck.message);
    return EXIT_SCRIPT_ERROR;
  }

  const tscCheck = findTsc();
  if (!tscCheck.ok) {
    console.error(tscCheck.message);
    return EXIT_SCRIPT_ERROR;
  }

  const exitCode = runTypeCheck(tscCheck.path, tsconfigCheck.path);

  if (exitCode === EXIT_PASS) {
    if (options.verbose) {
      console.log('✅ Type check passed.');
    }
    return EXIT_PASS;
  }

  console.error(
    `❌ Type check failed (exit ${exitCode}). Fix the reported TypeScript errors before merging.`
  );
  return EXIT_TYPE_ERROR;
}

const scriptPath = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && resolve(scriptPath) === resolve(process.argv[1]);

if (isDirectRun) {
  const exitCode = main();
  process.exit(exitCode);
}
