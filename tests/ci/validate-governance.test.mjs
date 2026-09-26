import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRIBUTING_REQUIREMENTS,
  PR_TEMPLATE_REQUIREMENTS,
  REQUIRED_LABELS,
  checkCodeownersCoverage,
  checkRequiredStatements,
  codeownersPatternToRegExp,
  extractIssueFormLabels,
  findOwners,
  isSecuritySensitive,
  parseCodeowners,
  validateGovernance,
  validateLabels,
} from '../../scripts/validate-governance.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(REPO_ROOT, 'scripts/validate-governance.mjs');

const validLabels = () =>
  REQUIRED_LABELS.map((name) => ({ name, color: 'ededed', description: `${name} label` }));

describe('parseCodeowners', () => {
  it('parses rules, skipping comments and blank lines', () => {
    const { rules, errors } = parseCodeowners(
      '# header\n\n/src/lib/wallet/  @owner @org/security-team  # inline\n*.md docs@example.com\n',
    );
    expect(errors).toEqual([]);
    expect(rules).toEqual([
      { pattern: '/src/lib/wallet/', owners: ['@owner', '@org/security-team'], line: 3 },
      { pattern: '*.md', owners: ['docs@example.com'], line: 4 },
    ]);
  });

  it('keeps owner-less rules because they un-assign ownership', () => {
    const { rules } = parseCodeowners('/src/lib/wallet/ @owner\n/src/lib/wallet/ledger.ts\n');
    expect(rules[1]).toMatchObject({ pattern: '/src/lib/wallet/ledger.ts', owners: [] });
  });

  it('rejects unsupported syntax and malformed owners', () => {
    const { rules, errors } = parseCodeowners('!/src/secret.ts @owner\n/src/[ab].ts @owner\n/src/x.ts owner-without-at\n');
    expect(rules).toEqual([]);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/negated/);
    expect(errors[1]).toMatch(/character ranges/);
    expect(errors[2]).toMatch(/invalid owner.*owner-without-at/);
  });

  it('throws on non-string input', () => {
    expect(() => parseCodeowners(undefined)).toThrow(TypeError);
  });
});

describe('codeownersPatternToRegExp', () => {
  const matches = (pattern, file) => codeownersPatternToRegExp(pattern).test(file);

  it('anchors leading-slash and mid-slash patterns to the root', () => {
    expect(matches('/src/lib/wallet/', 'src/lib/wallet/freighter.ts')).toBe(true);
    expect(matches('/src/lib/wallet/', 'vendor/src/lib/wallet/freighter.ts')).toBe(false);
    expect(matches('docs/security', 'docs/security/endpoint-allowlist.md')).toBe(true);
  });

  it('matches unanchored names at any depth', () => {
    expect(matches('encryption.ts', 'src/lib/encryption.ts')).toBe(true);
    expect(matches('*.md', 'docs/community/issue-labels.md')).toBe(true);
  });

  it('treats a trailing /* as direct children only (GitHub semantics)', () => {
    expect(matches('docs/*', 'docs/contributing.md')).toBe(true);
    expect(matches('docs/*', 'docs/security/endpoint-allowlist.md')).toBe(false);
  });

  it('supports ** across directories', () => {
    expect(matches('/src/**/wallet/*.ts', 'src/lib/wallet/ledger.ts')).toBe(true);
    expect(matches('**/security.ts', 'src/lib/wallet/security.ts')).toBe(true);
  });

  it('escapes regex metacharacters in literal names', () => {
    expect(matches('/nginx.conf', 'nginxXconf')).toBe(false);
  });
});

describe('CODEOWNERS coverage', () => {
  const files = [
    'src/lib/wallet/freighter.ts',
    'src/lib/wallet/ledger.ts',
    'src/lib/encryption.ts',
    'src/components/dashboard/Card.tsx',
  ];

  it('passes when every sensitive file resolves to an owner (primary flow)', () => {
    const { rules } = parseCodeowners('/src/lib/wallet/ @sec\n/src/lib/encryption.ts @sec\n');
    const result = checkCodeownersCoverage(rules, files);
    expect(result).toEqual({ checked: 3, uncovered: [] });
  });

  it('uses the last matching rule, so an owner-less override un-assigns a file (boundary)', () => {
    const { rules } = parseCodeowners('/src/lib/wallet/ @sec\n/src/lib/wallet/ledger.ts\n/src/lib/encryption.ts @sec\n');
    expect(findOwners(rules, 'src/lib/wallet/ledger.ts')).toEqual([]);
    expect(checkCodeownersCoverage(rules, files).uncovered).toEqual(['src/lib/wallet/ledger.ts']);
  });

  it('reports sensitive files with no matching rule (failure case)', () => {
    const { rules } = parseCodeowners('/src/lib/wallet/ @sec\n');
    expect(checkCodeownersCoverage(rules, files).uncovered).toEqual(['src/lib/encryption.ts']);
  });

  it('classifies wallet, auth and crypto paths as security-sensitive', () => {
    expect(isSecuritySensitive('src/lib/wallet/idleTimeout.ts')).toBe(true);
    expect(isSecuritySensitive('src/lib/didAuth.ts')).toBe(true);
    expect(isSecuritySensitive('src/lib/encryption.ts')).toBe(true);
    expect(isSecuritySensitive('.github/workflows/ci.yml')).toBe(true);
    expect(isSecuritySensitive('src/lib/encryption.ts.bak')).toBe(false);
    expect(isSecuritySensitive('src/components/dashboard/Card.tsx')).toBe(false);
  });
});

describe('validateLabels', () => {
  it('accepts a complete label set (primary flow)', () => {
    expect(validateLabels(validLabels())).toEqual([]);
  });

  it('accepts a description at exactly the 100-character GitHub limit (boundary)', () => {
    const labels = validLabels();
    labels[0].description = 'x'.repeat(100);
    expect(validateLabels(labels)).toEqual([]);
    labels[0].description = 'x'.repeat(101);
    expect(validateLabels(labels)).toEqual([expect.stringMatching(/exceeds 100/)]);
  });

  it('reports invalid colours, case-insensitive duplicates and missing required labels (failure case)', () => {
    const labels = validLabels().filter((l) => l.name !== 'difficulty: advanced');
    labels.push({ name: 'Good First Issue', color: '#7057ff', description: 'dup' });
    const errors = validateLabels(labels);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/duplicate label "Good First Issue"/),
        expect.stringMatching(/6 hex digits/),
        'missing required label "difficulty: advanced"',
      ]),
    );
  });

  it('rejects non-array input', () => {
    expect(validateLabels({ labels: [] })).toEqual([expect.stringMatching(/JSON array/)]);
  });
});

describe('extractIssueFormLabels', () => {
  it('reads inline and block label lists', () => {
    expect(extractIssueFormLabels("name: x\nlabels: ['good first issue', \"bug\"]\n")).toEqual(['good first issue', 'bug']);
    expect(extractIssueFormLabels('labels:\n  - bug\n  - "help wanted"\nbody: []\n')).toEqual(['bug', 'help wanted']);
    expect(extractIssueFormLabels('name: x\n')).toEqual([]);
  });
});

describe('merge policy statements', () => {
  it('finds every required statement in the committed PR template and contributing guide', () => {
    const template = readFileSync(path.join(REPO_ROOT, '.github/pull_request_template.md'), 'utf8');
    const contributing = readFileSync(path.join(REPO_ROOT, 'docs/contributing.md'), 'utf8');
    expect(checkRequiredStatements(template, PR_TEMPLATE_REQUIREMENTS)).toEqual([]);
    expect(checkRequiredStatements(contributing, CONTRIBUTING_REQUIREMENTS)).toEqual([]);
  });

  it('flags a template whose CI and conflict checkboxes were removed', () => {
    expect(checkRequiredStatements('## Summary\n\nCloses #1\n', PR_TEMPLATE_REQUIREMENTS)).toEqual([
      'ci-passing',
      'no-skipped-checks',
      'conflict-free',
    ]);
  });

  it('treats missing text as missing every statement', () => {
    expect(checkRequiredStatements(null, PR_TEMPLATE_REQUIREMENTS)).toHaveLength(PR_TEMPLATE_REQUIREMENTS.length);
  });
});

describe('validateGovernance on a fixture repository', () => {
  let root;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  function fixture({ codeowners, labels, template, contributing, issueForm } = {}) {
    root = mkdtempSync(path.join(tmpdir(), 'governance-'));
    const write = (rel, content) => {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), content);
    };
    const real = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    write('src/lib/wallet/freighter.ts', '');
    if (codeowners !== null) write('.github/CODEOWNERS', codeowners ?? '/src/lib/wallet/ @sec\n/.github/CODEOWNERS @sec\n');
    if (labels !== null) write('.github/labels.json', labels ?? JSON.stringify(validLabels()));
    if (template !== null) write('.github/pull_request_template.md', template ?? real('.github/pull_request_template.md'));
    if (contributing !== null) write('docs/contributing.md', contributing ?? real('docs/contributing.md'));
    if (issueForm) write('.github/ISSUE_TEMPLATE/starter.yml', issueForm);
    return root;
  }

  it('passes for a consistent repository', () => {
    const { errors, summary } = validateGovernance(fixture());
    expect(errors).toEqual([]);
    expect(summary.sensitiveFiles).toBeGreaterThan(0);
  });

  it('reports every missing policy file', () => {
    const { errors } = validateGovernance(
      fixture({ codeowners: null, labels: null, template: null, contributing: null }),
    );
    expect(errors).toEqual([
      '.github/CODEOWNERS is missing',
      '.github/labels.json is missing',
      '.github/pull_request_template.md is missing',
      'docs/contributing.md is missing',
    ]);
  });

  it('reports malformed labels.json and issue forms using unknown labels', () => {
    expect(validateGovernance(fixture({ labels: '{not json' })).errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/not valid JSON/)]),
    );
    rmSync(root, { recursive: true, force: true });

    const { errors } = validateGovernance(fixture({ issueForm: "labels: ['good first issue', 'typo-label']\n" }));
    expect(errors).toEqual(['.github/ISSUE_TEMPLATE/starter.yml: label "typo-label" is not defined in labels.json']);
  });

  it('flags a stale sensitive-path list when no sensitive files exist', () => {
    const dir = fixture();
    rmSync(path.join(dir, 'src'), { recursive: true });
    expect(validateGovernance(dir, { files: ['README.md'] }).errors).toEqual([
      expect.stringMatching(/SECURITY_SENSITIVE_PATHS may be stale/),
    ]);
  });
});

describe('CLI', () => {
  const run = (args) => {
    try {
      return { code: 0, out: execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', stdio: 'pipe' }) };
    } catch (error) {
      return { code: error.status, out: `${error.stdout}${error.stderr}` };
    }
  };

  it('passes on this repository', () => {
    const result = run([]);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/Governance check passed/);
  });

  it('exits 2 for an invalid --root', () => {
    const result = run(['--root', path.join(tmpdir(), 'definitely-not-here-governance')]);
    expect(result.code).toBe(2);
    expect(result.out).toMatch(/--root must point/);
  });

  it('exits 1 and lists problems for a non-compliant repository', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'governance-cli-'));
    try {
      const result = run(['--root', dir]);
      expect(result.code).toBe(1);
      expect(result.out).toMatch(/\.github\/CODEOWNERS is missing/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
