import { describe, it, expect, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  checkSubresourceIntegrity,
  createLocalHashLookup,
  isCrossOrigin,
  parseArgs,
  parseSubresources,
  validateIntegrityAttribute,
} from '../../scripts/verify-sri.mjs';

const BASE = 'https://dashboard.example/';
const VALID_INTEGRITY = 'sha384-' + 'A'.repeat(64);

const SAMPLE_HTML = `
<!doctype html>
<html>
  <head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href="https://cdn.vendor.test/styles.css" />
    <script src="https://cdn.vendor.test/lib.js"
            integrity="sha384-${'B'.repeat(64)}"
            crossorigin="anonymous"></script>
    <script src="/assets/app.js"></script>
  </head>
</html>`;

const tempDirs = [];
afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

describe('parseArgs', () => {
  it('defaults to index.html and validates flags', () => {
    expect(parseArgs([]).html).toEqual(['index.html']);
    expect(parseArgs(['--html', 'a.html', '--html', 'b.html', '--strict']).html).toEqual(['a.html', 'b.html']);
    expect(() => parseArgs(['--html'])).toThrow(/Missing value/);
    expect(() => parseArgs(['--nope'])).toThrow(/Unknown argument/);
  });
});

describe('parseSubresources', () => {
  it('extracts external scripts and stylesheets with their attributes', () => {
    const entries = parseSubresources(SAMPLE_HTML);
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://cdn.vendor.test/styles.css');
    expect(urls).toContain('https://cdn.vendor.test/lib.js');
    expect(urls).toContain('/assets/app.js');
    // preconnect links are not subresources
    expect(urls).not.toContain('https://fonts.googleapis.com');
  });

  it('never throws on invalid input', () => {
    expect(parseSubresources(null)).toEqual([]);
    expect(parseSubresources(42)).toEqual([]);
  });
});

describe('isCrossOrigin', () => {
  it('distinguishes first-party from third-party URLs', () => {
    expect(isCrossOrigin('/assets/app.js', BASE)).toBe(false);
    expect(isCrossOrigin('https://dashboard.example/app.js', BASE)).toBe(false);
    expect(isCrossOrigin('https://cdn.vendor.test/lib.js', BASE)).toBe(true);
    expect(isCrossOrigin('//cdn.vendor.test/lib.js', BASE)).toBe(true);
    expect(isCrossOrigin('not a url', 'not a base')).toBe(false);
  });
});

describe('validateIntegrityAttribute', () => {
  it('accepts well-formed digests and rejects malformed ones', () => {
    expect(validateIntegrityAttribute(VALID_INTEGRITY).valid).toBe(true);
    expect(validateIntegrityAttribute(`${VALID_INTEGRITY} sha256-${'C'.repeat(44)}`).valid).toBe(true);
    expect(validateIntegrityAttribute(null).valid).toBe(false);
    expect(validateIntegrityAttribute('md5-abc').valid).toBe(false);
    expect(validateIntegrityAttribute('sha384').valid).toBe(false);
  });
});

describe('checkSubresourceIntegrity', () => {
  it('warns (non-strict) about cross-origin assets missing integrity', () => {
    const result = checkSubresourceIntegrity([{ name: 'index.html', html: SAMPLE_HTML }], { baseUrl: BASE });
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(2); // two cross-origin entries
    expect(result.warnings.join(' ')).toMatch(/styles\.css/);
  });

  it('fails in strict mode when integrity is missing', () => {
    const result = checkSubresourceIntegrity([{ name: 'index.html', html: SAMPLE_HTML }], {
      baseUrl: BASE,
      strict: true,
    });
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toMatch(/styles\.css/);
  });

  it('fails on malformed integrity even when not strict', () => {
    const html = '<script src="https://cdn.vendor.test/lib.js" integrity="sha384-broken!"></script>';
    const result = checkSubresourceIntegrity([{ name: 'index.html', html }], { baseUrl: BASE });
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toMatch(/malformed|unsupported/);
  });
});

describe('createLocalHashLookup', () => {
  it('matches a locally-mapped digest and reports mismatches', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sri-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'lib.js');
    writeFileSync(file, 'console.log(1)');
    const digest = createHash('sha384').update('console.log(1)').digest('base64');

    const match = createLocalHashLookup({ 'https://cdn.vendor.test/lib.js': file }, dir);
    expect(match('https://cdn.vendor.test/lib.js', `sha384-${digest}`).ok).toBe(true);
    expect(match('https://cdn.vendor.test/lib.js', `sha384-${'Z'.repeat(64)}`).ok).toBe(false);
    expect(match('https://unmapped.test/x.js', `sha384-${digest}`).ok).toBe(true);
  });
});
