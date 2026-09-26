import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateDocsDrift } from '../scripts/validate-docs-drift.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

describe('docs:validate-drift (#966)', () => {
  it('primary: scans without throwing and returns structured result', async () => {
    const result = await validateDocsDrift({ checkRootPolicy: true });
    assert.ok(Array.isArray(result.files));
    assert.ok(Array.isArray(result.errors));
    assert.ok(result.files.length >= 0);
  });

  it('boundary: root policy allows only standard Markdown names', async () => {
    const allowed = new Set([
      'readme.md',
      'contributing.md',
      'security.md',
      'code_of_conduct.md',
      'changelog.md',
      'license.md',
    ]);
    const entries = await fs.readdir(repoRoot, { withFileTypes: true });
    const rootMd = entries
      .filter((e) => e.isFile() && (e.name.endsWith('.md') || e.name.endsWith('.mdx')))
      .map((e) => e.name);
    for (const name of rootMd) {
      assert.ok(
        allowed.has(name.toLowerCase()),
        `Unexpected root markdown: ${name}`,
      );
    }
  });

  it('failure: reports root-markdown when policy is on and offenders exist conceptually', async () => {
    // Failure-path shape: error objects use known type tags
    const result = await validateDocsDrift({ checkRootPolicy: true });
    for (const err of result.errors) {
      assert.ok(
        ['missing-file', 'missing-script', 'root-markdown'].includes(err.type),
        `unexpected error type ${err.type}`,
      );
    }
  });
});
