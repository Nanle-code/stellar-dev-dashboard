import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  classifyIssue,
  compareMilestoneIds,
  DOCS_END_MARKER,
  DOCS_START_MARKER,
  injectMilestones,
  loadRoadmap,
  planTriage,
  renderMilestonesMarkdown,
  runCheck,
  validateRoadmap,
} from '../../scripts/roadmap.mjs';

const roadmap = loadRoadmap();
const docsPage = readFileSync(path.resolve('docs-site/docs/roadmap.md'), 'utf8');
const clone = () => JSON.parse(JSON.stringify(roadmap));

describe('roadmap.json (#1005)', () => {
  it('is valid and defines the three published milestones', () => {
    expect(validateRoadmap(roadmap)).toEqual([]);
    expect(roadmap.milestones.map((m: { title: string }) => m.title)).toEqual([
      'v0.2 — Solid foundation',
      'v0.3 — Protocol-current',
      'v1.0 — Production ready',
    ]);
  });

  it('keeps the docs-site roadmap page in sync', () => {
    expect(runCheck(roadmap, docsPage)).toEqual([]);
    for (const m of roadmap.milestones) {
      expect(docsPage).toContain(`### ${m.title}`);
      for (const criterion of m.exitCriteria) expect(docsPage).toContain(criterion);
    }
  });

  it('is linked from the README together with the starter-issues guide', () => {
    const readme = readFileSync(path.resolve('README.md'), 'utf8');
    expect(readme).toContain('(docs-site/docs/roadmap.md)');
    expect(readme).toContain('(docs/community/issue-labels.md)');
    expect(readme).toContain('(docs/community/roadmap-triage.md)');
  });

  it('registers the page in the docs-site sidebar', () => {
    expect(readFileSync(path.resolve('docs-site/sidebars.js'), 'utf8')).toContain("'roadmap'");
  });
});

describe('validateRoadmap failure paths', () => {
  it.each([null, [], 'roadmap'])('rejects non-object input %p', (input) => {
    expect(validateRoadmap(input)).toEqual(['roadmap must be a JSON object']);
  });

  it('flags unknown milestone references, bad ids and ordering', () => {
    const bad = clone();
    bad.defaultMilestone = 'v9.9';
    bad.themes[0].milestone = 'v0.1';
    bad.priorityLabels.bug = 'later';
    bad.milestones[0].id = '0.2';
    bad.milestones.reverse();
    const errors = validateRoadmap(bad).join('\n');
    expect(errors).toMatch(/defaultMilestone "v9.9"/);
    expect(errors).toMatch(/themes\[0\]\.milestone "v0.1"/);
    expect(errors).toMatch(/priorityLabels\["bug"\]/);
    expect(errors).toMatch(/must look like "v0.2"/);
    expect(errors).toMatch(/version order/);
  });

  it('requires exit criteria, theme matchers and all three board views', () => {
    const bad = clone();
    bad.milestones[1].exitCriteria = [];
    bad.themes[0] = { id: 'x', name: 'X', milestone: 'v0.2' };
    bad.project.views = bad.project.views.filter((v: { groupBy: string }) => v.groupBy !== 'Status');
    const errors = validateRoadmap(bad).join('\n');
    expect(errors).toMatch(/exitCriteria must list/);
    expect(errors).toMatch(/needs at least one titlePrefix/);
    expect(errors).toMatch(/grouped by Status/);
  });

  it('reports docs drift and missing markers', () => {
    const changed = clone();
    changed.milestones[0].exitCriteria.push('A brand new criterion.');
    expect(runCheck(changed, docsPage).join()).toMatch(/out of date/);
    expect(runCheck(roadmap, '# no markers').join()).toMatch(/must contain/);
    expect(runCheck(roadmap, null).join()).toMatch(/missing/);
  });
});

describe('docs rendering', () => {
  it('round-trips: injecting into the current page is a no-op', () => {
    expect(injectMilestones(docsPage, roadmap)).toBe(docsPage);
  });

  it('wraps output in MDX-safe markers and lists exit criteria as checkboxes', () => {
    const md = renderMilestonesMarkdown(roadmap);
    expect(md.startsWith(DOCS_START_MARKER)).toBe(true);
    expect(md.endsWith(DOCS_END_MARKER)).toBe(true);
    expect(md).not.toContain('<!--');
    expect(md).toContain('- [ ] ');
  });
});

describe('issue triage', () => {
  it.each([
    ['[2026 Testing] Add contract fixture factory for deterministic Soroban tests', [], 'testing', 'v0.2'],
    ['[2026 Community] Publish a public roadmap and GitHub Project board', [], 'community', 'v0.2'],
    ['D-002: Implement comprehensive E2E test coverage with Playwright', [], 'testing', 'v0.2'],
    ['AI-Powered Security Audit Trail Analysis', [], 'security', 'v0.2'],
    ['[2026 AI] Explain fee spikes', [], 'ai', 'v1.0'],
    ['Add Soroban RPC getLedgerEntries support', [], 'protocol', 'v0.3'],
    ['Improve Freighter reconnect UX', [], 'wallets', 'v0.3'],
  ])('%s → %s / %s', (title, labels, theme, milestone) => {
    expect(classifyIssue({ title, labels }, roadmap)).toMatchObject({ themeId: theme, milestone });
  });

  it('priority labels pull later-milestone issues forward', () => {
    const result = classifyIssue({ title: 'Improve mobile layout', labels: [{ name: 'bug' }] }, roadmap);
    expect(result).toMatchObject({ themeId: 'experience', milestone: 'v0.2' });
    expect(result.reason).toMatch(/"bug" label/);
  });

  it('boundary: unmatched issues fall back to the default milestone', () => {
    expect(classifyIssue({ title: 'Rename a variable' }, roadmap)).toMatchObject({
      themeId: null,
      themeName: 'Unsorted',
      milestone: roadmap.defaultMilestone,
    });
  });

  it('throws on malformed issues', () => {
    expect(() => classifyIssue({} as never, roadmap)).toThrow(TypeError);
    expect(() => planTriage('nope' as never, roadmap)).toThrow(TypeError);
  });

  it('plans assignments without overriding maintainer decisions', () => {
    const plan = planTriage(
      [
        { number: 1, title: '[2026 Testing] New', milestone: null },
        { number: 2, title: '[2026 Testing] Moved by hand', milestone: { title: 'v1.0 — Production ready' } },
        { number: 3, title: 'Legacy', milestone: { title: 'Sprint 4' } },
        { number: 4, title: 'A PR', pull_request: {} },
      ],
      roadmap
    );
    expect(plan.assign.map((i: { number: number }) => i.number)).toEqual([1]);
    expect(plan.keep).toEqual([expect.objectContaining({ number: 2, milestone: 'v1.0' })]);
    expect(plan.unknownMilestone).toEqual([expect.objectContaining({ number: 3, current: 'Sprint 4' })]);
  });

  it('orders milestone ids numerically', () => {
    expect(['v1.0', 'v0.10', 'v0.2'].sort(compareMilestoneIds)).toEqual(['v0.2', 'v0.10', 'v1.0']);
  });
});
