#!/usr/bin/env node
/**
 * Generate a CycloneDX SBOM for npm dependencies.
 *
 * Usage:
 *   node scripts/generate-sbom.mjs [--output path] [--format cyclonedx|spdx]
 *
 * Exit codes:
 *   0 — SBOM written successfully
 *   1 — invalid CLI input
 *   2 — unsupported environment (npm sbom unavailable)
 *   3 — generation failed
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SUPPORTED_FORMATS = new Set(['cyclonedx', 'spdx']);
const DEFAULT_OUTPUT = 'dist/sbom.cyclonedx.json';

function parseArgs(argv) {
  const args = { output: DEFAULT_OUTPUT, format: 'cyclonedx' };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--output') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --output');
      }
      args.output = value;
      i += 1;
      continue;
    }

    if (token === '--format') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --format');
      }
      args.format = value.toLowerCase();
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (!SUPPORTED_FORMATS.has(args.format)) {
    throw new Error(`Unsupported format "${args.format}". Use cyclonedx or spdx.`);
  }

  return args;
}

function ensureNpmSbomAvailable() {
  try {
    execFileSync('npm', ['sbom', '--help'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function generateSbom(format) {
  const sbomFormat = format === 'spdx' ? 'spdx' : 'cyclonedx';
  const output = execFileSync('npm', ['sbom', '--sbom-format', sbomFormat], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });

  const parsed = JSON.parse(output);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('npm sbom returned invalid JSON');
  }

  return parsed;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[sbom] ${err.message}`);
    process.exit(1);
  }

  if (!existsSync('package-lock.json')) {
    console.error('[sbom] package-lock.json is required. Run npm ci before generating an SBOM.');
    process.exit(3);
  }

  if (!ensureNpmSbomAvailable()) {
    console.error('[sbom] npm sbom is unavailable in this environment (requires npm 9+).');
    process.exit(2);
  }

  try {
    const sbom = generateSbom(args.format);
    const outputPath = path.resolve(args.output);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');

    const componentCount = Array.isArray(sbom.components) ? sbom.components.length : null;
    console.log(`[sbom] Wrote ${outputPath}${componentCount !== null ? ` (${componentCount} components)` : ''}`);
  } catch (err) {
    console.error('[sbom] Generation failed:', err.message || err);
    process.exit(3);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parseArgs, generateSbom, ensureNpmSbomAvailable, SUPPORTED_FORMATS };
