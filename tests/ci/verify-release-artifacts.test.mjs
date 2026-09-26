import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  computeSha256,
  parseArgs,
  parseManifest,
  verifyArtifacts,
  verifyDetachedSignature,
} from '../../scripts/verify-release-artifacts.mjs';

const SHA_HELLO = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

const tempDirs = [];
function makeTempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-verify-'));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('parseArgs', () => {
  it('applies defaults and parses flags', () => {
    expect(parseArgs(['--manifest', 'dist/manifest.json'])).toEqual({
      manifest: 'dist/manifest.json',
      dir: '.',
      strict: false,
      requireSignature: false,
    });
    expect(parseArgs(['--manifest', 'm.json', '--dir', 'out', '--require-signature']).requireSignature).toBe(true);
  });

  it('rejects missing and unknown flags', () => {
    expect(() => parseArgs([])).toThrow(/--manifest is required/);
    expect(() => parseArgs(['--manifest'])).toThrow(/Missing value/);
    expect(() => parseArgs(['--manifest', 'm.json', '--bogus'])).toThrow(/Unknown argument/);
  });
});

describe('parseManifest', () => {
  it('parses a valid manifest', () => {
    const manifest = parseManifest(
      JSON.stringify({ version: '1.2.3', artifacts: [{ path: 'dist/app.js', sha256: SHA_HELLO, size: 5 }] })
    );
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.artifacts[0]).toMatchObject({ path: 'dist/app.js', sha256: SHA_HELLO, size: 5 });
  });

  it('rejects malformed JSON and bad shapes', () => {
    expect(() => parseManifest('not json')).toThrow(/valid JSON/);
    expect(() => parseManifest('{}')).toThrow(/artifacts/);
    expect(() => parseManifest(JSON.stringify({ artifacts: [{}] }))).toThrow(/path/);
    expect(() => parseManifest(JSON.stringify({ artifacts: [{ path: 'a', sha256: 'nope' }] }))).toThrow(/sha256/);
  });
});

describe('computeSha256', () => {
  it('matches the known digest for "hello"', () => {
    expect(computeSha256(Buffer.from('hello'))).toBe(SHA_HELLO);
  });
});

describe('verifyArtifacts', () => {
  it('verifies a matching artifact', () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, 'app.js'), 'hello');
    const manifest = parseManifest(
      JSON.stringify({ artifacts: [{ path: 'app.js', sha256: SHA_HELLO, size: 5 }] })
    );
    const result = verifyArtifacts(manifest, { baseDir: dir });
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(1);
    expect(result.failures).toEqual([]);
  });

  it('reports a checksum mismatch', () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, 'app.js'), 'hello');
    const manifest = parseManifest(
      JSON.stringify({ artifacts: [{ path: 'app.js', sha256: '0'.repeat(64) }] })
    );
    const result = verifyArtifacts(manifest, { baseDir: dir });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/checksum mismatch/);
  });

  it('reports missing artifacts without throwing', () => {
    const manifest = parseManifest(JSON.stringify({ artifacts: [{ path: 'gone.js', sha256: SHA_HELLO }] }));
    const result = verifyArtifacts(manifest, { baseDir: makeTempDir() });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toMatch(/missing artifact/);
  });
});

describe('verifyDetachedSignature', () => {
  it('treats an absent signature as optional by default', () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, 'app.js'), 'hello');
    const result = verifyDetachedSignature(path.join(dir, 'app.js'), path.join(dir, 'app.js.sig'));
    expect(result.ok).toBe(true);
  });

  it('fails when a signature is required but missing', () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, 'app.js'), 'hello');
    const result = verifyDetachedSignature(path.join(dir, 'app.js'), path.join(dir, 'app.js.sig'), {
      requireSignature: true,
    });
    expect(result.ok).toBe(false);
  });
});
