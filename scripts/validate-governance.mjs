#!/usr/bin/env node
/**
 * Contributor governance validator (#902, #909, #910).
 *
 * Checks that the repository's contribution policy files stay consistent:
 *   - .github/CODEOWNERS covers every security-sensitive path with an owner
 *   - .github/labels.json defines the difficulty / starter-issue label set
 *   - .github/pull_request_template.md and docs/contributing.md state the
 *     merge policy (passing CI, conflict-free branch)
 *   - issue forms only apply labels that exist in labels.json
 *
 * Dependency-free on purpose so CI can run it without `pnpm install`.
 *
 * Usage:  node scripts/validate-governance.mjs [--root <dir>]
 * Exit:   0 = valid, 1 = policy violation, 2 = unsupported environment / usage error
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ─── Security-sensitive paths (#910) ─────────────────────────────────────────

/**
 * Repo-relative path prefixes / files that must have a designated code owner.
 * A trailing slash means "everything under this directory".
 */
export const SECURITY_SENSITIVE_PATHS = [
  // Wallet connectors, signing, session handling
  'src/lib/wallet/',
  'src/components/dashboard/WalletConnect.tsx',
  'src/hooks/useWalletSessionListeners.ts',
  'src/lib/transactionSigningAuditLog.ts',
  'src/lib/multisig.ts',
  'src/lib/multisig/',
  'src/components/multisig/',
  'src/components/security/',
  // Authentication, identity and access control
  'src/lib/biometricAuth.ts',
  'src/lib/behavioralBiometrics/',
  'src/components/biometrics/',
  'src/lib/didAuth.ts',
  'src/lib/did.ts',
  'src/lib/verifiableCredentials.ts',
  'src/accessControl/',
  'src/lib/approvalSystem.ts',
  // Cryptography and trust boundaries
  'src/lib/encryption.ts',
  'src/lib/endpointAllowlist.ts',
  'src/lib/phishingDetector.ts',
  'src/lib/securityEvents.ts',
  // Security policy, headers and pipeline integrity
  'SECURITY.md',
  'docs/security/',
  'nginx.conf',
  '.github/workflows/',
  '.github/CODEOWNERS',
]

export function isSecuritySensitive(filePath, sensitivePaths = SECURITY_SENSITIVE_PATHS) {
  const normalized = toPosix(filePath)
  return sensitivePaths.some((entry) =>
    entry.endsWith('/') ? normalized.startsWith(entry) : normalized === entry,
  )
}

// ─── CODEOWNERS parsing & matching ───────────────────────────────────────────

// @user, @org/team, or an email address — the owner forms GitHub accepts.
const OWNER_RE = /^(@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\/[A-Za-z0-9._-]+)?|[^\s@]+@[^\s@]+\.[^\s@]+)$/

/**
 * Parse CODEOWNERS text. Returns `{ rules, errors }`; each rule is
 * `{ pattern, owners, line }`. Syntax GitHub does not support is reported as
 * an error rather than silently mis-matched.
 */
export function parseCodeowners(text) {
  if (typeof text !== 'string') {
    throw new TypeError('CODEOWNERS content must be a string')
  }

  const rules = []
  const errors = []

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1
    const content = raw.replace(/\s+#.*$/, '').trim()
    if (!content || content.startsWith('#')) return

    const [pattern, ...owners] = content.split(/\s+/)

    if (pattern.startsWith('!')) {
      errors.push(`line ${line}: negated patterns ("${pattern}") are not supported by CODEOWNERS`)
      return
    }
    if (/[[\]]/.test(pattern)) {
      errors.push(`line ${line}: character ranges ("${pattern}") are not supported by CODEOWNERS`)
      return
    }
    const badOwners = owners.filter((owner) => !OWNER_RE.test(owner))
    if (badOwners.length > 0) {
      errors.push(`line ${line}: invalid owner(s) ${badOwners.map((o) => `"${o}"`).join(', ')}`)
      return
    }

    rules.push({ pattern, owners, line })
  })

  return { rules, errors }
}

function escapeRegExp(text) {
  return text.replace(/[.+^${}()|\\]/g, '\\$&')
}

/**
 * Convert a CODEOWNERS (gitignore-style) pattern to a RegExp over
 * repo-relative POSIX paths.
 */
export function codeownersPatternToRegExp(pattern) {
  let p = pattern
  const anchored = p.startsWith('/') || p.slice(0, -1).includes('/')
  p = p.replace(/^\//, '')
  const directoryOnly = p.endsWith('/')
  p = p.replace(/\/$/, '')

  let body = ''
  for (let i = 0; i < p.length; i += 1) {
    const ch = p[i]
    if (ch === '*' && p[i + 1] === '*') {
      if (p[i + 2] === '/') {
        body += '(?:.*/)?'
        i += 2
      } else {
        body += '.*'
        i += 1
      }
    } else if (ch === '*') {
      body += '[^/]*'
    } else if (ch === '?') {
      body += '[^/]'
    } else {
      body += escapeRegExp(ch)
    }
  }

  const prefix = anchored ? '^' : '^(?:.*/)?'
  // A match on a directory also owns everything beneath it — except a
  // trailing `/*`, which GitHub documents as direct children only.
  const directChildrenOnly = p === '*' ? false : p.endsWith('/*')
  const suffix = directoryOnly ? '/.*$' : directChildrenOnly ? '$' : '(?:/.*)?$'
  return new RegExp(prefix + body + suffix)
}

/** Owners for a path: the LAST matching rule wins, as on GitHub. */
export function findOwners(rules, filePath) {
  const normalized = toPosix(filePath)
  let owners = null
  for (const rule of rules) {
    if (codeownersPatternToRegExp(rule.pattern).test(normalized)) {
      owners = rule.owners
    }
  }
  return owners ?? []
}

/**
 * Every security-sensitive file must resolve to at least one owner. A later
 * rule with no owners un-assigns ownership, which is reported here too.
 */
export function checkCodeownersCoverage(rules, files, sensitivePaths = SECURITY_SENSITIVE_PATHS) {
  const sensitive = files.map(toPosix).filter((file) => isSecuritySensitive(file, sensitivePaths))
  const uncovered = sensitive.filter((file) => findOwners(rules, file).length === 0)
  return { checked: sensitive.length, uncovered }
}

// ─── Labels (#909) ───────────────────────────────────────────────────────────

export const REQUIRED_LABELS = [
  'good first issue',
  'difficulty: beginner',
  'difficulty: intermediate',
  'difficulty: advanced',
  'help wanted',
]

const GITHUB_LABEL_DESCRIPTION_MAX = 100
const GITHUB_LABEL_NAME_MAX = 50

export function validateLabels(labels, required = REQUIRED_LABELS) {
  const errors = []
  if (!Array.isArray(labels)) {
    return ['labels.json must contain a JSON array of { name, color, description } objects']
  }

  const seen = new Set()
  labels.forEach((label, index) => {
    const where = `labels[${index}]`
    if (!label || typeof label !== 'object') {
      errors.push(`${where}: must be an object`)
      return
    }
    const { name, color, description } = label
    if (typeof name !== 'string' || !name.trim()) {
      errors.push(`${where}: "name" is required`)
      return
    }
    if (name.length > GITHUB_LABEL_NAME_MAX) {
      errors.push(`${where} "${name}": name exceeds ${GITHUB_LABEL_NAME_MAX} characters`)
    }
    const key = name.trim().toLowerCase()
    if (seen.has(key)) errors.push(`${where}: duplicate label "${name}" (names are case-insensitive)`)
    seen.add(key)
    if (typeof color !== 'string' || !/^[0-9a-fA-F]{6}$/.test(color)) {
      errors.push(`${where} "${name}": "color" must be 6 hex digits without "#"`)
    }
    if (typeof description !== 'string' || !description.trim()) {
      errors.push(`${where} "${name}": "description" is required`)
    } else if (description.length > GITHUB_LABEL_DESCRIPTION_MAX) {
      errors.push(`${where} "${name}": description exceeds ${GITHUB_LABEL_DESCRIPTION_MAX} characters`)
    }
  })

  for (const name of required) {
    if (!seen.has(name.toLowerCase())) errors.push(`missing required label "${name}"`)
  }
  return errors
}

/** Labels referenced by an issue form's top-level `labels:` key. */
export function extractIssueFormLabels(yamlText) {
  const inline = yamlText.match(/^labels:\s*\[([^\]]*)\]/m)
  if (inline) {
    return inline[1]
      .split(',')
      .map((item) => item.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }
  const block = yamlText.match(/^labels:\s*\n((?:\s+-\s*.+\n?)+)/m)
  if (block) {
    return block[1]
      .split('\n')
      .map((item) => item.replace(/^\s+-\s*/, '').trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }
  return []
}

// ─── Merge policy text (#902) ────────────────────────────────────────────────

/** Statements the PR template must carry as checklist items. */
export const PR_TEMPLATE_REQUIREMENTS = [
  { id: 'ci-passing', pattern: /- \[ \] .*all (required )?ci checks (are )?pass/i },
  { id: 'no-skipped-checks', pattern: /- \[ \] .*no required checks? (are|is) (failing, )?(pending|skipped)/i },
  { id: 'conflict-free', pattern: /- \[ \] .*no merge conflicts/i },
  { id: 'linked-issue', pattern: /closes #/i },
]

/** Statements docs/contributing.md must contain. */
export const CONTRIBUTING_REQUIREMENTS = [
  { id: 'merge-section', pattern: /^## Merge requirements$/im },
  { id: 'ci-must-pass', pattern: /all (required )?(continuous integration|ci) checks must pass/i },
  { id: 'no-pending-skipped', pattern: /failing, pending,? or skipped/i },
  { id: 'conflict-free', pattern: /free of merge conflicts/i },
  { id: 'labels-guide-link', pattern: /\]\(\.\/community\/issue-labels\.md\)/ },
  { id: 'codeowners-section', pattern: /CODEOWNERS/ },
]

export function checkRequiredStatements(text, requirements) {
  if (typeof text !== 'string') return requirements.map((r) => r.id)
  return requirements.filter((r) => !r.pattern.test(text)).map((r) => r.id)
}

// ─── Repository scan ─────────────────────────────────────────────────────────

function toPosix(filePath) {
  return String(filePath).split(path.sep).join('/').replace(/^\.\//, '')
}

const WALK_SKIP = new Set(['.git', 'node_modules', 'dist', 'coverage', '.pnpm-store'])

function walk(root, dir = '') {
  const out = []
  for (const entry of readdirSync(path.join(root, dir))) {
    if (WALK_SKIP.has(entry)) continue
    const rel = dir ? `${dir}/${entry}` : entry
    const stats = statSync(path.join(root, rel))
    if (stats.isDirectory()) out.push(...walk(root, rel))
    else out.push(rel)
  }
  return out
}

/** Tracked files via git; falls back to a filesystem walk outside a git checkout. */
export function listRepoFiles(root) {
  try {
    const output = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const files = output.split('\0').filter(Boolean)
    if (files.length > 0) return files
  } catch {
    // git missing or not a repository — fall through.
  }
  return walk(root)
}

function readOptional(root, rel) {
  const full = path.join(root, rel)
  return existsSync(full) ? readFileSync(full, 'utf8') : null
}

/**
 * Run every check against a repository root. Returns a list of error strings
 * (empty when valid) plus a short summary for logging.
 */
export function validateGovernance(root, { files } = {}) {
  const errors = []
  const summary = {}

  // CODEOWNERS
  const codeowners = readOptional(root, '.github/CODEOWNERS')
  if (codeowners === null) {
    errors.push('.github/CODEOWNERS is missing')
  } else {
    const { rules, errors: parseErrors } = parseCodeowners(codeowners)
    errors.push(...parseErrors.map((e) => `.github/CODEOWNERS ${e}`))
    const repoFiles = files ?? listRepoFiles(root)
    const coverage = checkCodeownersCoverage(rules, repoFiles)
    summary.sensitiveFiles = coverage.checked
    if (coverage.checked === 0) {
      errors.push('no security-sensitive files found — SECURITY_SENSITIVE_PATHS may be stale')
    }
    coverage.uncovered.forEach((file) => errors.push(`.github/CODEOWNERS: no owner for security-sensitive file ${file}`))
  }

  // Labels
  const labelsText = readOptional(root, '.github/labels.json')
  let labelNames = new Set()
  if (labelsText === null) {
    errors.push('.github/labels.json is missing')
  } else {
    try {
      const labels = JSON.parse(labelsText)
      errors.push(...validateLabels(labels).map((e) => `.github/labels.json: ${e}`))
      if (Array.isArray(labels)) {
        labelNames = new Set(labels.map((l) => String(l?.name ?? '').toLowerCase()))
        summary.labels = labels.length
      }
    } catch (error) {
      errors.push(`.github/labels.json is not valid JSON: ${error.message}`)
    }
  }

  // Issue forms may only apply catalogued labels.
  const templateDir = path.join(root, '.github/ISSUE_TEMPLATE')
  if (existsSync(templateDir)) {
    for (const file of readdirSync(templateDir).filter((f) => /\.ya?ml$/.test(f) && f !== 'config.yml')) {
      const used = extractIssueFormLabels(readFileSync(path.join(templateDir, file), 'utf8'))
      used
        .filter((name) => !labelNames.has(name.toLowerCase()))
        .forEach((name) => errors.push(`.github/ISSUE_TEMPLATE/${file}: label "${name}" is not defined in labels.json`))
    }
  }

  // Merge policy text
  const template = readOptional(root, '.github/pull_request_template.md')
  if (template === null) {
    errors.push('.github/pull_request_template.md is missing')
  } else {
    checkRequiredStatements(template, PR_TEMPLATE_REQUIREMENTS).forEach((id) =>
      errors.push(`.github/pull_request_template.md: missing required item "${id}"`),
    )
  }

  const contributing = readOptional(root, 'docs/contributing.md')
  if (contributing === null) {
    errors.push('docs/contributing.md is missing')
  } else {
    checkRequiredStatements(contributing, CONTRIBUTING_REQUIREMENTS).forEach((id) =>
      errors.push(`docs/contributing.md: missing required statement "${id}"`),
    )
  }

  return { errors, summary }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function main(argv) {
  const [major] = process.versions.node.split('.').map(Number)
  if (!Number.isInteger(major) || major < 18) {
    console.error(`validate-governance requires Node.js 18 or newer (found ${process.versions.node}).`)
    return 2
  }

  let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const rootFlag = argv.indexOf('--root')
  if (rootFlag !== -1) {
    const value = argv[rootFlag + 1]
    if (!value || !existsSync(value)) {
      console.error(`--root must point to an existing directory (got ${value ?? 'nothing'}).`)
      return 2
    }
    root = path.resolve(value)
  }

  const { errors, summary } = validateGovernance(root)
  if (errors.length > 0) {
    console.error(`Governance check failed with ${errors.length} problem(s):`)
    errors.forEach((error) => console.error(`  ✗ ${error}`))
    return 1
  }
  console.log(
    `Governance check passed: ${summary.sensitiveFiles} security-sensitive files owned, ${summary.labels} labels defined, merge policy documented.`,
  )
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
