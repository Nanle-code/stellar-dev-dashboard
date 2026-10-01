#!/usr/bin/env node
/**
 * Public roadmap & GitHub Project tooling (#1005).
 *
 * `.github/roadmap.json` is the single source of truth for milestones, their
 * exit criteria and the themes used to group issues on the GitHub Project.
 * This script keeps the docs-site roadmap page in sync with it and triages
 * open issues into milestones.
 *
 * Dependency-free on purpose so CI can run `--check` without `pnpm install`.
 *
 * Usage:
 *   node scripts/roadmap.mjs --check         Validate roadmap.json and fail if the docs page drifted
 *   node scripts/roadmap.mjs --write-docs    Regenerate the milestone section of the docs page
 *   node scripts/roadmap.mjs --plan          Show milestone/theme assignments for open issues (read-only, needs gh)
 *   node scripts/roadmap.mjs --apply         Create milestones and assign open issues (writes to GitHub, needs gh)
 *
 * Exit: 0 = ok, 1 = validation failure / drift, 2 = unsupported environment or usage error
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const ROADMAP_PATH = path.join(REPO_ROOT, '.github', 'roadmap.json')
export const DOCS_PAGE_PATH = path.join(REPO_ROOT, 'docs-site', 'docs', 'roadmap.md')

export const DOCS_START_MARKER = '{/* roadmap:milestones:start */}'
export const DOCS_END_MARKER = '{/* roadmap:milestones:end */}'

const MILESTONE_ID = /^v\d+\.\d+$/

// ─── Validation ──────────────────────────────────────────────────────────────

/** Return a list of human-readable problems with a roadmap object (empty when valid). */
export function validateRoadmap(roadmap) {
  const errors = []
  if (!roadmap || typeof roadmap !== 'object' || Array.isArray(roadmap)) {
    return ['roadmap must be a JSON object']
  }

  const milestones = Array.isArray(roadmap.milestones) ? roadmap.milestones : null
  if (!milestones || milestones.length === 0) {
    errors.push('roadmap.milestones must be a non-empty array')
  }
  const ids = new Set()
  for (const [i, m] of (milestones ?? []).entries()) {
    const where = `milestones[${i}]`
    if (!m || typeof m !== 'object') {
      errors.push(`${where} must be an object`)
      continue
    }
    if (typeof m.id !== 'string' || !MILESTONE_ID.test(m.id)) errors.push(`${where}.id must look like "v0.2"`)
    else if (ids.has(m.id)) errors.push(`${where}.id "${m.id}" is duplicated`)
    else ids.add(m.id)
    if (typeof m.title !== 'string' || !m.title.startsWith(`${m.id} `)) {
      errors.push(`${where}.title must start with its id ("${m.id} — …")`)
    }
    if (typeof m.summary !== 'string' || m.summary.trim() === '') errors.push(`${where}.summary is required`)
    if (!Array.isArray(m.exitCriteria) || m.exitCriteria.length === 0) {
      errors.push(`${where}.exitCriteria must list at least one criterion`)
    } else if (m.exitCriteria.some((c) => typeof c !== 'string' || c.trim() === '')) {
      errors.push(`${where}.exitCriteria must only contain non-empty strings`)
    }
  }

  const ordered = (milestones ?? []).map((m) => m?.id).filter((id) => MILESTONE_ID.test(id ?? ''))
  const sorted = [...ordered].sort(compareMilestoneIds)
  if (ordered.join() !== sorted.join()) errors.push('milestones must be listed in version order')

  if (!ids.has(roadmap.defaultMilestone)) {
    errors.push(`defaultMilestone "${roadmap.defaultMilestone}" is not a defined milestone`)
  }
  for (const [label, id] of Object.entries(roadmap.priorityLabels ?? {})) {
    if (!ids.has(id)) errors.push(`priorityLabels["${label}"] points at unknown milestone "${id}"`)
  }

  if (!Array.isArray(roadmap.themes) || roadmap.themes.length === 0) {
    errors.push('roadmap.themes must be a non-empty array')
  }
  const themeIds = new Set()
  for (const [i, t] of (roadmap.themes ?? []).entries()) {
    const where = `themes[${i}]`
    if (!t || typeof t.id !== 'string' || !t.id) {
      errors.push(`${where}.id is required`)
      continue
    }
    if (themeIds.has(t.id)) errors.push(`${where}.id "${t.id}" is duplicated`)
    themeIds.add(t.id)
    if (typeof t.name !== 'string' || !t.name) errors.push(`${where}.name is required`)
    if (!ids.has(t.milestone)) errors.push(`${where}.milestone "${t.milestone}" is not a defined milestone`)
    const matchers = [...(t.titlePrefixes ?? []), ...(t.labels ?? []), ...(t.keywords ?? [])]
    if (matchers.length === 0) errors.push(`${where} needs at least one titlePrefix, label or keyword`)
  }

  const project = roadmap.project
  if (!project || typeof project.title !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(project.repository ?? '')) {
    errors.push('project.title and project.repository ("owner/name") are required')
  } else {
    const groupings = new Set((project.views ?? []).map((v) => v.groupBy))
    for (const required of ['Theme', 'Milestone', 'Status']) {
      if (!groupings.has(required)) errors.push(`project.views must include a view grouped by ${required}`)
    }
  }

  return errors
}

export function compareMilestoneIds(a, b) {
  const [aMaj, aMin] = a.slice(1).split('.').map(Number)
  const [bMaj, bMin] = b.slice(1).split('.').map(Number)
  return aMaj - bMaj || aMin - bMin
}

// ─── Triage ──────────────────────────────────────────────────────────────────

/** Words inside a leading "[2026 Testing]" style tag, lower-cased. */
function titleTagWords(title) {
  const match = /^\s*\[([^\]]+)\]/.exec(title ?? '')
  return match ? match[1].toLowerCase().split(/\s+/) : []
}

function labelNames(issue) {
  return (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean).map((l) => l.toLowerCase())
}

/**
 * Decide the theme and milestone for an issue.
 * Precedence: title tag → theme labels → keyword score (title weighted above body) → default.
 * Priority labels (e.g. bug, security) always pull the issue into their milestone.
 */
export function classifyIssue(issue, roadmap) {
  if (!issue || typeof issue.title !== 'string') {
    throw new TypeError('classifyIssue expects an issue with a string title')
  }
  const tagWords = titleTagWords(issue.title)
  const labels = labelNames(issue)
  const title = ` ${issue.title.toLowerCase()} `
  const body = ` ${(issue.body ?? '').toLowerCase()} `

  let theme = null
  let reason = 'no theme matched'

  theme = roadmap.themes.find((t) => (t.titlePrefixes ?? []).some((p) => tagWords.includes(p.toLowerCase())))
  if (theme) reason = 'title tag'

  if (!theme) {
    theme = roadmap.themes.find((t) => (t.labels ?? []).some((l) => labels.includes(l.toLowerCase())))
    if (theme) reason = 'label'
  }

  if (!theme) {
    let best = 0
    for (const t of roadmap.themes) {
      const score = (t.keywords ?? []).reduce((sum, k) => {
        const needle = k.toLowerCase()
        return sum + (title.includes(needle) ? 3 : 0) + (body.includes(needle) ? 1 : 0)
      }, 0)
      if (score > best) {
        best = score
        theme = t
      }
    }
    if (theme) reason = 'keywords'
  }

  let milestone = theme?.milestone ?? roadmap.defaultMilestone
  const priority = Object.entries(roadmap.priorityLabels ?? {}).find(([label]) => labels.includes(label.toLowerCase()))
  if (priority && compareMilestoneIds(priority[1], milestone) < 0) {
    milestone = priority[1]
    reason += `; "${priority[0]}" label`
  }

  return { themeId: theme?.id ?? null, themeName: theme?.name ?? 'Unsorted', milestone, reason }
}

/**
 * Build a triage plan. Issues whose milestone is already a roadmap milestone
 * are left alone so maintainer decisions stick; issues on unknown milestones
 * are reported rather than silently moved.
 */
export function planTriage(issues, roadmap) {
  if (!Array.isArray(issues)) throw new TypeError('planTriage expects an array of issues')
  const byTitle = new Map(roadmap.milestones.map((m) => [m.title, m]))
  const plan = { assign: [], keep: [], unknownMilestone: [] }

  for (const issue of issues) {
    if (issue.pull_request || issue.isPullRequest) continue
    const current = typeof issue.milestone === 'string' ? issue.milestone : issue.milestone?.title
    const classification = classifyIssue(issue, roadmap)
    const entry = { number: issue.number, title: issue.title, ...classification }
    if (!current) plan.assign.push(entry)
    else if (byTitle.has(current)) plan.keep.push({ ...entry, milestone: byTitle.get(current).id })
    else plan.unknownMilestone.push({ ...entry, current })
  }
  return plan
}

// ─── Docs page ───────────────────────────────────────────────────────────────

export function renderMilestonesMarkdown(roadmap) {
  const sections = roadmap.milestones.map((m) => {
    const themes = roadmap.themes.filter((t) => t.milestone === m.id).map((t) => t.name)
    return [
      `### ${m.title}`,
      '',
      m.summary,
      '',
      themes.length ? `**Themes:** ${themes.join(', ')}` : '**Themes:** none yet',
      '',
      '**Exit criteria**',
      '',
      ...m.exitCriteria.map((c) => `- [ ] ${c}`),
    ].join('\n')
  })
  return `${DOCS_START_MARKER}\n\n${sections.join('\n\n')}\n\n${DOCS_END_MARKER}`
}

/** Replace the generated block in a docs page; throws if the markers are missing. */
export function injectMilestones(page, roadmap) {
  const start = page.indexOf(DOCS_START_MARKER)
  const end = page.indexOf(DOCS_END_MARKER)
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`docs page must contain ${DOCS_START_MARKER} and ${DOCS_END_MARKER}`)
  }
  return page.slice(0, start) + renderMilestonesMarkdown(roadmap) + page.slice(end + DOCS_END_MARKER.length)
}

// ─── GitHub (gh CLI) ─────────────────────────────────────────────────────────

function gh(args, { input } = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] })
}

function assertGhAvailable() {
  try {
    gh(['--version'])
  } catch {
    const err = new Error('The GitHub CLI (gh) is required for --plan and --apply. Install it and run `gh auth login`.')
    err.exitCode = 2
    throw err
  }
}

function fetchOpenIssues(repository) {
  const out = gh(['issue', 'list', '--repo', repository, '--state', 'open', '--limit', '1000', '--json', 'number,title,body,labels,milestone'])
  return JSON.parse(out)
}

function applyPlan(roadmap, plan) {
  const repo = roadmap.project.repository
  const existing = new Set(JSON.parse(gh(['api', `repos/${repo}/milestones?state=all&per_page=100`])).map((m) => m.title))
  for (const m of roadmap.milestones) {
    if (existing.has(m.title)) continue
    const description = `${m.summary}\n\nExit criteria:\n${m.exitCriteria.map((c) => `- ${c}`).join('\n')}`
    gh(['api', `repos/${repo}/milestones`, '-f', `title=${m.title}`, '-f', `description=${description}`])
    console.info(`created milestone ${m.title}`)
  }
  const titles = new Map(roadmap.milestones.map((m) => [m.id, m.title]))
  for (const item of plan.assign) {
    gh(['issue', 'edit', String(item.number), '--repo', repo, '--milestone', titles.get(item.milestone)])
    console.info(`#${item.number} → ${item.milestone} (${item.themeName})`)
  }
}

function printPlan(plan) {
  const rows = (list, label) => {
    console.info(`\n${label} (${list.length})`)
    for (const i of list) console.info(`  #${i.number}\t${i.milestone}\t${i.themeName}\t${i.title}${i.current ? `\t[current: ${i.current}]` : ''}`)
  }
  rows(plan.assign, 'To assign')
  rows(plan.unknownMilestone, 'On a milestone not in roadmap.json — triage by hand')
  console.info(`\nAlready on a roadmap milestone: ${plan.keep.length}`)
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

export function loadRoadmap(file = ROADMAP_PATH) {
  if (!existsSync(file)) throw Object.assign(new Error(`${file} not found`), { exitCode: 2 })
  return JSON.parse(readFileSync(file, 'utf8'))
}

export function runCheck(roadmap, page) {
  const errors = validateRoadmap(roadmap)
  if (errors.length === 0) {
    if (page === null) errors.push(`${path.relative(REPO_ROOT, DOCS_PAGE_PATH)} is missing`)
    else {
      try {
        if (injectMilestones(page, roadmap) !== page) {
          errors.push('docs-site/docs/roadmap.md is out of date; run `node scripts/roadmap.mjs --write-docs`')
        }
      } catch (e) {
        errors.push(e.message)
      }
    }
  }
  return errors
}

function main(argv) {
  const mode = argv[0]
  const modes = ['--check', '--write-docs', '--plan', '--apply']
  if (!modes.includes(mode)) {
    console.error(`Usage: node scripts/roadmap.mjs ${modes.join(' | ')}`)
    return 2
  }

  const roadmap = loadRoadmap()
  if (mode === '--check' || mode === '--write-docs') {
    const page = existsSync(DOCS_PAGE_PATH) ? readFileSync(DOCS_PAGE_PATH, 'utf8') : null
    if (mode === '--write-docs') {
      const errors = validateRoadmap(roadmap)
      if (errors.length || page === null) {
        for (const e of errors) console.error(`✗ ${e}`)
        if (page === null) console.error(`✗ ${DOCS_PAGE_PATH} is missing`)
        return 1
      }
      writeFileSync(DOCS_PAGE_PATH, injectMilestones(page, roadmap))
      console.info(`updated ${path.relative(REPO_ROOT, DOCS_PAGE_PATH)}`)
      return 0
    }
    const errors = runCheck(roadmap, page)
    for (const e of errors) console.error(`✗ ${e}`)
    if (errors.length === 0) console.info(`✓ roadmap valid: ${roadmap.milestones.length} milestones, ${roadmap.themes.length} themes, docs in sync`)
    return errors.length ? 1 : 0
  }

  const errors = validateRoadmap(roadmap)
  if (errors.length) {
    for (const e of errors) console.error(`✗ ${e}`)
    return 1
  }
  assertGhAvailable()
  const plan = planTriage(fetchOpenIssues(roadmap.project.repository), roadmap)
  printPlan(plan)
  if (mode === '--apply') applyPlan(roadmap, plan)
  else console.info('\nRead-only. Re-run with --apply to create milestones and assign issues.')
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`✗ ${e.message}`)
    process.exitCode = e.exitCode ?? 1
  }
}
