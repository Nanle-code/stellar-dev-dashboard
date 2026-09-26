/**
 * Verify published release artifacts (#833)
 * =========================================
 * Consumers of the dashboard's release builds need to confirm that the files
 * they downloaded are exactly the ones CI produced. This script verifies:
 *
 *   1. Every artifact listed in a release manifest exists and its SHA-256
 *      checksum (and optional byte size) matches.
 *   2. Optionally, a detached signature over the artifact can be verified with
 *      `gpg` or `minisign` when one of those tools is installed.
 *
 * Usage:
 *   node scripts/verify-release-artifacts.mjs \
 *     --manifest dist/release-manifest.json \
 *     [--dir .] [--strict] [--require-signature]
 *
 * Manifest shape:
 *   {
 *     "version": "1.2.3",
 *     "artifacts": [
 *       { "path": "dist/app.js", "sha256": "<hex>", "size": 1234,
 *         "signature": "dist/app.js.sig" }
 *     ],
 *     "signature": "dist/release-manifest.json.sig"   // optional
 *   }
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — invalid CLI input
 *   2 — unsupported environment (manifest not found / unreadable)
 *   3 — verification failed (missing file, checksum mismatch, bad signature)
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const EXIT = { OK: 0, CLI: 1, UNSUPPORTED: 2, FAILED: 3 };

/**
 * Parse CLI arguments. Throws on unknown/missing flags so misconfiguration
 * fails loudly instead of silently skipping verification.
 */
export function parseArgs(argv) {
  const args = { manifest: null, dir: '.', strict: false, requireSignature: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--manifest') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --manifest');
      args.manifest = value;
      i += 1;
    } else if (token === '--dir') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --dir');
      args.dir = value;
      i += 1;
    } else if (token === '--strict') {
      args.strict = true;
    } else if (token === '--require-signature') {
      args.requireSignature = true;
      args.strict = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (!args.manifest) throw new Error('--manifest is required');
  return args;
}

/** Compute the lower-case hex SHA-256 of a buffer. */
export function computeSha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Parse and shape-check a manifest. Returns `{ version, artifacts, signature }`.
 * Throws on malformed JSON or a missing/empty `artifacts` array.
 */
export function parseManifest(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Manifest is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Manifest must be a JSON object');
  }
  if (!Array.isArray(parsed.artifacts) || parsed.artifacts.length === 0) {
    throw new Error('Manifest must contain a non-empty "artifacts" array');
  }
  const artifacts = parsed.artifacts.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || typeof entry.path !== 'string' || entry.path.length === 0) {
      throw new Error(`artifacts[${index}] is missing a valid "path"`);
    }
    if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(entry.sha256)) {
      throw new Error(`artifacts[${index}] has an invalid "sha256" checksum`);
    }
    return {
      path: entry.path,
      sha256: entry.sha256.toLowerCase(),
      size: typeof entry.size === 'number' ? entry.size : null,
      signature: typeof entry.signature === 'string' ? entry.signature : null,
    };
  });
  return {
    version: typeof parsed.version === 'string' ? parsed.version : null,
    artifacts,
    signature: typeof parsed.signature === 'string' ? parsed.signature : null,
  };
}

/**
 * Verify a detached signature using gpg or minisign.
 * Never throws — returns `{ ok, verifier, reason }`.
 */
export function verifyDetachedSignature(artifactPath, signaturePath, { requireSignature = false } = {}) {
  if (!existsSync(signaturePath)) {
    return { ok: !requireSignature, verifier: null, reason: 'signature file not found' };
  }
  try {
    execFileSync('gpg', ['--verify', signaturePath, artifactPath], { stdio: 'pipe' });
    return { ok: true, verifier: 'gpg', reason: 'verified' };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      // fall through to minisign
    } else {
      return { ok: false, verifier: 'gpg', reason: 'gpg verification failed' };
    }
  }
  try {
    execFileSync('minisign', ['-V', '-m', artifactPath, '-x', signaturePath], { stdio: 'pipe' });
    return { ok: true, verifier: 'minisign', reason: 'verified' };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {
        ok: !requireSignature,
        verifier: null,
        reason: 'no signature verifier available (install gpg or minisign)',
      };
    }
    return { ok: false, verifier: 'minisign', reason: 'minisign verification failed' };
  }
}

function resolvePath(baseDir, target) {
  return path.isAbsolute(target) ? target : path.resolve(baseDir, target);
}

/**
 * Verify every artifact in a manifest.
 *
 * @returns {{ ok: boolean, checked: number, failures: string[], warnings: string[], signatures: Array }}
 */
export function verifyArtifacts(manifest, { baseDir = '.', requireSignature = false, strict = false } = {}) {
  const failures = [];
  const warnings = [];
  const signatures = [];
  let checked = 0;

  for (const artifact of manifest.artifacts) {
    const filePath = resolvePath(baseDir, artifact.path);
    if (!existsSync(filePath)) {
      failures.push(`missing artifact: ${artifact.path}`);
      continue;
    }
    const buffer = readFileSync(filePath);
    const actual = computeSha256(buffer);
    checked += 1;
    if (actual !== artifact.sha256) {
      failures.push(`checksum mismatch: ${artifact.path} (expected ${artifact.sha256}, got ${actual})`);
    }
    if (artifact.size !== null) {
      const stat = statSync(filePath);
      if (stat.size !== artifact.size) {
        failures.push(`size mismatch: ${artifact.path} (expected ${artifact.size}, got ${stat.size})`);
      }
    }

    const signaturePath = artifact.signature
      ? resolvePath(baseDir, artifact.signature)
      : `${filePath}.sig`;
    const result = verifyDetachedSignature(filePath, signaturePath, { requireSignature });
    signatures.push({ path: artifact.path, ...result });
    if (!result.ok) {
      failures.push(`signature invalid: ${artifact.path} (${result.reason})`);
    } else if (result.verifier === null && strict) {
      warnings.push(`signature not verified for ${artifact.path}: ${result.reason}`);
    }
  }

  return { ok: failures.length === 0, checked, failures, warnings, signatures };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[release-verify] ${error.message}`);
    process.exit(EXIT.CLI);
  }

  const manifestPath = path.resolve(args.manifest);
  if (!existsSync(manifestPath)) {
    console.error(`[release-verify] manifest not found: ${manifestPath}`);
    process.exit(EXIT.UNSUPPORTED);
  }

  let manifest;
  try {
    manifest = parseManifest(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    console.error(`[release-verify] invalid manifest: ${error.message}`);
    process.exit(EXIT.UNSUPPORTED);
  }

  const result = verifyArtifacts(manifest, {
    baseDir: args.dir,
    requireSignature: args.requireSignature,
    strict: args.strict,
  });

  for (const warning of result.warnings) console.warn(`[release-verify] warning: ${warning}`);

  if (!result.ok) {
    for (const failure of result.failures) console.error(`[release-verify] ${failure}`);
    console.error(`[release-verify] FAILED — ${result.failures.length} issue(s) across ${manifest.artifacts.length} artifact(s)`);
    process.exit(EXIT.FAILED);
  }

  console.log(`[release-verify] OK — verified ${result.checked} artifact(s)${manifest.version ? ` for v${manifest.version}` : ''}`);
  process.exit(EXIT.OK);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { EXIT };
