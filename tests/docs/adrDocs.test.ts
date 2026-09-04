import { describe, it, expect } from 'vitest';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const ADR_DIR = path.join(repoRoot, 'docs', 'adrs');
const README_PATH = path.join(ADR_DIR, 'README.md');

const REQUIRED_ADR_FILES = [
  'adr-0001-wallet-integration.md',
  'adr-0002-caching-strategy.md',
  'adr-0003-offline-mode.md',
  'adr-0004-soroban-tooling.md',
];

const REQUIRED_SECTIONS = [
  '## Context',
  '## Decision',
  '## Consequences',
  '## Compatibility & Migration',
  '## Security Considerations',
  '## Invalid Input, Unsupported Environments & Failure Paths',
  '## Alternatives Considered',
  '## References',
];

const VALID_STATUSES = new Set(['Accepted', 'Proposed', 'Superseded', 'Deprecated', 'Rejected']);

function validateAdrBasics(fileName: string, content: string): string[] {
  const errors: string[] = [];

  if (!/- \*\*Status:\*\*\s+[\w]+/m.test(content)) {
    errors.push('missing Status header');
  } else {
    const statusMatch = content.match(/- \*\*Status:\*\*\s+(\w+)/);
    if (statusMatch && !VALID_STATUSES.has(statusMatch[1])) {
      errors.push(`invalid Status value: ${statusMatch[1]}`);
    }
  }

  const dateMatch = content.match(/- \*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) {
    errors.push('missing or invalid Date header (expected YYYY-MM-DD)');
  } else {
    const today = new Date().toISOString().slice(0, 10);
    if (dateMatch[1] > today) {
      errors.push(`Date ${dateMatch[1]} is in the future`);
    }
  }

  if (!/- \*\*Deciders:/.test(content)) {
    errors.push('missing Deciders header');
  }
  if (!/- \*\*Area:/.test(content)) {
    errors.push('missing Area header');
  }
  if (!/^# ADR-\d{4}:/.test(content)) {
    errors.push('missing or malformed ADR title heading');
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      errors.push(`missing section ${section}`);
    }
  }

  return errors;
}

const markdownLinkPattern = /!?\[[^\]]*\]\(\s*([^\s)]+)(?:\s+"[^"]*")?\s*\)/g;

function internalLinkTargets(content: string): string[] {
  const targets: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = markdownLinkPattern.exec(content)) !== null) {
    const href = match[1];
    if (/^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/.test(href)) continue;
    targets.push(href.split('#')[0]);
  }
  return targets;
}

async function isFile(resolved: string): Promise<boolean> {
  try {
    const s = await stat(resolved);
    return s.isFile();
  } catch {
    return false;
  }
}

async function resolveMarkdownLink(sourceFile: string, href: string): Promise<boolean> {
  if (!href) return false;
  const resolved = path.resolve(path.dirname(sourceFile), href);
  if (await isFile(resolved)) return true;
  const withMd = `${resolved}.md`;
  if (await isFile(withMd)) return true;
  return false;
}

describe('architecture decision records', () => {
  it('captures the four core ADRs and indexes every one of them (primary flow)', async () => {
    const files = (await readdir(ADR_DIR)).filter((f) => f.endsWith('.md'));
    for (const required of REQUIRED_ADR_FILES) {
      expect(files).toContain(required);
    }

    const readme = await readFile(README_PATH, 'utf8');
    for (const required of REQUIRED_ADR_FILES) {
      expect(readme).toContain(`./${required}`);
    }

    const adrFiles = files.filter((f) => /^adr-\d{4}-.*\.md$/.test(f));
    expect(adrFiles.sort()).toEqual([...REQUIRED_ADR_FILES].sort());
  });

  it('uses valid headers, sequential numbering, and a non-future date (boundary case)', async () => {
    const entries = await readdir(ADR_DIR);
    const adrFiles = entries
      .filter((f) => /^adr-\d{4}-.*\.md$/.test(f))
      .sort();

    const numbers = adrFiles.map((f) => {
      const m = f.match(/^adr-(\d{4})-/);
      if (!m) throw new Error(`unparseable ADR file name: ${f}`);
      return Number(m[1]);
    });

    // Sequential and unique from 0001 — makes the boundary at the first record explicit.
    for (let i = 0; i < numbers.length; i++) {
      expect(numbers[i]).toBe(i + 1);
    }

    const distinct = new Set(numbers);
    expect(distinct.size).toBe(numbers.length);

    for (const file of adrFiles) {
      const content = await readFile(path.join(ADR_DIR, file), 'utf8');
      const errors = validateAdrBasics(file, content);
      expect(errors).toEqual([]);
    }
  });

  it('flags an ADR that is missing required sections (failure case)', () => {
    const broken = `# ADR-0999: Example

- **Status:** Accepted
- **Date:** 2026-08-29
- **Deciders:** Test
- **Area:** test

## Context

Some context.

`;
    const errors = validateAdrBasics('adr-0999-example.md', broken);
    expect(errors).toContain('missing section ## Decision');
    expect(errors).toContain('missing section ## References');
    expect(errors).toContain('missing section ## Invalid Input, Unsupported Environments & Failure Paths');
    expect(errors.length).toBeGreaterThan(0);

    const futureDated = broken.replace('2026-08-29', '2999-01-01');
    expect(validateAdrBasics('adr-0999-example.md', futureDated)).toContain(
      'Date 2999-01-01 is in the future'
    );
  });

  it('rejects a broken internal ADR link and resolves real ones (failure case)', async () => {
    const realAdr = path.join(ADR_DIR, 'adr-0001-wallet-integration.md');
    const content = await readFile(realAdr, 'utf8');

    const targets = internalLinkTargets(content);
    expect(targets.length).toBeGreaterThan(0);

    for (const target of targets) {
      await expect(resolveMarkdownLink(realAdr, target)).resolves.toBe(true);
    }

    await expect(resolveMarkdownLink(realAdr, './adr-9999-does-not-exist.md')).resolves.toBe(
      false
    );
  });
});