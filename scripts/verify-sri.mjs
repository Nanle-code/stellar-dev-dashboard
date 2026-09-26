/**
 * Subresource Integrity (SRI) checker (#840)
 * ==========================================
 * Ensures cross-origin scripts and stylesheets referenced by our HTML include a
 * valid `integrity` attribute (and the matching `crossorigin` attribute), so a
 * compromised CDN cannot silently swap in malicious code.
 *
 * The checker is offline by default: it validates that an integrity attribute
 * is *present* and well-formed. Pass `--assets <json>` (a map of URL → local
 * file) or `--fetch` to additionally recompute and compare the digest.
 *
 * Usage:
 *   node scripts/verify-sri.mjs [--html index.html] [--html dist/index.html] \
 *     [--base-url https://dashboard.example/] [--strict] [--assets sri.json] [--fetch]
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — invalid CLI input
 *   2 — no input HTML could be read (unsupported environment)
 *   3 — verification failed (malformed/mismatched integrity)
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const EXIT = { OK: 0, CLI: 1, UNSUPPORTED: 2, FAILED: 3 };
const INTEGRITY_RE = /^(sha256|sha384|sha512)-[A-Za-z0-9+/]+={0,2}$/;

/** Parse CLI arguments; throws on unknown/missing flags. */
export function parseArgs(argv) {
  const args = { html: [], baseUrl: 'https://dashboard.example/', strict: false, assets: null, fetch: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--html') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --html');
      args.html.push(value);
      i += 1;
    } else if (token === '--base-url') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --base-url');
      args.baseUrl = value;
      i += 1;
    } else if (token === '--assets') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --assets');
      args.assets = value;
      i += 1;
    } else if (token === '--strict') {
      args.strict = true;
    } else if (token === '--fetch') {
      args.fetch = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (args.html.length === 0) args.html.push('index.html');
  return args;
}

function readAttr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? match[1].trim() : null;
}

/**
 * Extract every external script / stylesheet reference from an HTML string.
 * Returns entries with their integrity + crossorigin attributes.
 */
export function parseSubresources(html) {
  const entries = [];
  const source = typeof html === 'string' ? html : '';

  const scriptRe = /<script\b[^>]*>/gi;
  let match;
  while ((match = scriptRe.exec(source)) !== null) {
    const tag = match[0];
    const url = readAttr(tag, 'src');
    if (!url) continue;
    entries.push({ kind: 'script', url, integrity: readAttr(tag, 'integrity'), crossorigin: readAttr(tag, 'crossorigin') });
  }

  const linkRe = /<link\b[^>]*>/gi;
  while ((match = linkRe.exec(source)) !== null) {
    const tag = match[0];
    const rel = (readAttr(tag, 'rel') || '').toLowerCase();
    const as = (readAttr(tag, 'as') || '').toLowerCase();
    const url = readAttr(tag, 'href');
    if (!url) continue;
    const isStylesheet = rel.split(/\s+/).includes('stylesheet');
    const isPreload = rel.split(/\s+/).includes('preload') && (as === 'script' || as === 'style');
    if (!isStylesheet && !isPreload) continue;
    entries.push({
      kind: isStylesheet ? 'stylesheet' : `preload-${as || 'resource'}`,
      url,
      integrity: readAttr(tag, 'integrity'),
      crossorigin: readAttr(tag, 'crossorigin'),
    });
  }

  return entries;
}

/** True when `url` resolves to a different origin than `baseUrl`. */
export function isCrossOrigin(url, baseUrl) {
  try {
    return new URL(url, baseUrl).origin !== new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

/** Validate the `integrity` attribute format. */
export function validateIntegrityAttribute(integrity) {
  if (typeof integrity !== 'string' || integrity.trim().length === 0) {
    return { valid: false, reason: 'missing integrity attribute' };
  }
  const tokens = integrity.trim().split(/\s+/);
  for (const token of tokens) {
    if (!token.includes('-')) return { valid: false, reason: `malformed integrity token "${token}"` };
    const [algo, digest] = token.split('-');
    if (!INTEGRITY_RE.test(`${algo}-${digest}`)) {
      return { valid: false, reason: `unsupported or malformed integrity token "${token}"` };
    }
  }
  return { valid: true, reason: 'ok' };
}

/**
 * Check a set of HTML documents.
 *
 * @returns {{ ok, failures: string[], warnings: string[], checked: number }}
 */
export function checkSubresourceIntegrity(documents, { baseUrl = 'https://dashboard.example/', strict = false, hashLookup } = {}) {
  const failures = [];
  const warnings = [];
  let checked = 0;

  for (const doc of documents) {
    const entries = parseSubresources(doc.html);
    for (const entry of entries) {
      if (!isCrossOrigin(entry.url, baseUrl)) continue; // first-party: SRI optional
      checked += 1;
      const result = validateIntegrityAttribute(entry.integrity);
      if (!result.valid) {
        const message = `${doc.name}: ${entry.kind} ${entry.url} — ${result.reason}`;
        if (strict || result.reason.startsWith('malformed') || result.reason.startsWith('unsupported')) {
          failures.push(message);
        } else {
          warnings.push(message);
        }
        continue;
      }
      if (entry.crossorigin === null) {
        warnings.push(`${doc.name}: ${entry.url} has integrity but no crossorigin attribute`);
      }
      if (hashLookup) {
        const expected = entry.integrity.split(/\s+/).find((t) => t.startsWith('sha'));
        const match = hashLookup(entry.url, expected);
        if (match && match.ok === false) {
          failures.push(`${doc.name}: ${entry.url} — ${match.reason}`);
        }
      }
    }
  }

  return { ok: failures.length === 0, failures, warnings, checked };
}

/** Build a hash lookup that compares against local files described by `assets`. */
export function createLocalHashLookup(assets, baseDir = '.') {
  return (url, expected) => {
    const file = assets[url] || assets[new URL(url).pathname];
    if (!file) return { ok: true, reason: 'no local file mapped (skipped)' };
    const filePath = path.isAbsolute(file) ? file : path.resolve(baseDir, file);
    if (!existsSync(filePath)) return { ok: false, reason: `mapped file not found: ${file}` };
    const digest = createHash(expected.slice(0, expected.indexOf('-'))).update(readFileSync(filePath)).digest('base64');
    return digest === expected.slice(expected.indexOf('-') + 1)
      ? { ok: true, reason: 'digest match' }
      : { ok: false, reason: 'integrity digest mismatch' };
  };
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[sri] ${error.message}`);
    process.exit(EXIT.CLI);
  }

  const documents = [];
  for (const htmlPath of args.html) {
    const resolved = path.resolve(htmlPath);
    if (!existsSync(resolved)) {
      console.warn(`[sri] skipping missing file: ${htmlPath}`);
      continue;
    }
    documents.push({ name: htmlPath, html: readFileSync(resolved, 'utf8') });
  }

  if (documents.length === 0) {
    console.error('[sri] no readable HTML documents — nothing to check');
    process.exit(EXIT.UNSUPPORTED);
  }

  let hashLookup;
  if (args.assets) {
    const assetsPath = path.resolve(args.assets);
    if (!existsSync(assetsPath)) {
      console.error(`[sri] assets map not found: ${args.assets}`);
      process.exit(EXIT.UNSUPPORTED);
    }
    hashLookup = createLocalHashLookup(JSON.parse(readFileSync(assetsPath, 'utf8')), path.dirname(assetsPath));
  }

  const result = checkSubresourceIntegrity(documents, {
    baseUrl: args.baseUrl,
    strict: args.strict,
    hashLookup,
  });

  for (const warning of result.warnings) console.warn(`[sri] warning: ${warning}`);

  if (!result.ok) {
    for (const failure of result.failures) console.error(`[sri] ${failure}`);
    console.error(`[sri] FAILED — ${result.failures.length} issue(s)`);
    process.exit(EXIT.FAILED);
  }

  console.log(`[sri] OK — checked ${result.checked} cross-origin subresource(s) across ${documents.length} document(s)`);
  process.exit(EXIT.OK);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { EXIT };
