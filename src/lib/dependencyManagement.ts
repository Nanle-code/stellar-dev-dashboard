/**
 * dependencyManagement.ts
 * Issue #602: Intelligent Dependency Management
 *
 * Client-side AI-style analysis for project dependencies:
 *  - Vulnerability matching against audit / CVE data
 *  - Safe update recommendations with risk assessment
 *  - Version conflict detection and resolution hints
 *  - Dependency-tree health scoring
 *
 * No external AI API key is required — heuristics + structured rules
 * produce human-readable insights the UI can render directly.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type LicenseRisk = 'ok' | 'warn' | 'alert'
export type UpdateRisk = 'safe' | 'low' | 'medium' | 'high' | 'breaking'
export type DependencyKind = 'direct' | 'dev' | 'peer' | 'optional' | 'transitive'

export interface PackageManifest {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

export interface LockfilePackage {
  name: string
  version: string
  /** Packages that depend on this one (empty ⇒ likely a root/direct dep). */
  dependents?: string[]
  /** Declared ranges this package satisfies for each dependent. */
  requiredBy?: Array<{ parent: string; range: string }>
}

export interface VulnerabilityRecord {
  id: string
  package: string
  /** Inclusive lower bound of affected versions (semver). */
  affectedFrom?: string
  /** Exclusive upper bound of fixed versions (semver). */
  fixedIn?: string
  /** Explicit list of affected version strings (alternative to range). */
  affectedVersions?: string[]
  severity: Severity
  title: string
  description: string
  cve?: string
  cwe?: string
  url?: string
}

/** npm audit --json shape (subset we care about). */
export interface NpmAuditReport {
  vulnerabilities?: Record<
    string,
    {
      name?: string
      severity?: string
      via?: Array<string | { source?: number; name?: string; title?: string; severity?: string; url?: string; range?: string; cwe?: string[] }>
      effects?: string[]
      range?: string
      nodes?: string[]
      fixAvailable?: boolean | { name?: string; version?: string; isSemVerMajor?: boolean }
    }
  >
  metadata?: {
    vulnerabilities?: {
      info?: number
      low?: number
      moderate?: number
      high?: number
      critical?: number
      total?: number
    }
  }
}

export interface RegistryMeta {
  name: string
  latestVersion: string
  license?: string
  deprecated?: boolean
  /** Optional published versions for conflict / range checks. */
  versions?: string[]
}

export interface DependencyPackage {
  name: string
  version: string
  requestedRange: string
  kind: DependencyKind
  latestVersion: string
  outdated: boolean
  license: string
  licenseRisk: LicenseRisk
  deprecated: boolean
  vulnerabilities: VulnerabilityFinding[]
  updateRecommendation: UpdateRecommendation | null
}

export interface VulnerabilityFinding {
  id: string
  severity: Severity
  title: string
  description: string
  cve?: string
  fixedIn?: string
  url?: string
  source: 'knowledge-base' | 'audit-report'
}

export interface UpdateRecommendation {
  package: string
  fromVersion: string
  toVersion: string
  risk: UpdateRisk
  riskScore: number // 0-100 (higher = riskier)
  confidence: number // 0-1
  reason: string
  breakingChangeLikely: boolean
  safe: boolean
  steps: string[]
}

export interface VersionConflict {
  package: string
  conflictingRanges: Array<{ parent: string; range: string }>
  installedVersions: string[]
  severity: Severity
  resolution: string
  confidence: number
}

export interface DependencyHealthScore {
  overall: number // 0-100
  vulnerabilityScore: number
  freshnessScore: number
  conflictScore: number
  licenseScore: number
  status: 'good' | 'warning' | 'critical'
  tips: string[]
}

export interface DependencyAnalysisResult {
  packages: DependencyPackage[]
  vulnerabilities: VulnerabilityFinding[]
  recommendations: UpdateRecommendation[]
  conflicts: VersionConflict[]
  health: DependencyHealthScore
  insights: string[]
  detectionRate: number // fraction of known vulns identified (0-1)
  analyzedAt: string
  packageCount: number
  vulnerableCount: number
  outdatedCount: number
  conflictCount: number
}

export interface AnalyzeDependenciesInput {
  manifest: PackageManifest
  lockPackages?: LockfilePackage[]
  audit?: NpmAuditReport
  registry?: RegistryMeta[]
  /** Extra vulnerability records (tests / custom DB). */
  vulnerabilityDb?: VulnerabilityRecord[]
}

// ---------------------------------------------------------------------------
// Built-in vulnerability knowledge base (common ecosystem CVEs)
// Used when no audit report is supplied; audit findings always take priority.
// ---------------------------------------------------------------------------

export const BUILTIN_VULNERABILITY_DB: VulnerabilityRecord[] = [
  {
    id: 'KB-LODASH-PROTO',
    package: 'lodash',
    affectedFrom: '0.0.0',
    fixedIn: '4.17.21',
    severity: 'high',
    title: 'Prototype Pollution in lodash',
    description: 'Versions of lodash before 4.17.21 are vulnerable to prototype pollution.',
    cve: 'CVE-2021-23337',
    cwe: 'CWE-1321',
    url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-23337',
  },
  {
    id: 'KB-AXIOS-SSRF',
    package: 'axios',
    affectedFrom: '0.8.1',
    fixedIn: '1.6.0',
    severity: 'high',
    title: 'SSRF / credential leakage in axios',
    description: 'Axios before 1.6.0 may follow malicious redirects exposing credentials.',
    cve: 'CVE-2023-45857',
    url: 'https://nvd.nist.gov/vuln/detail/CVE-2023-45857',
  },
  {
    id: 'KB-WS-DOS',
    package: 'ws',
    affectedFrom: '8.0.0',
    fixedIn: '8.17.1',
    severity: 'high',
    title: 'DoS via many HTTP headers in ws',
    description: 'A crafted request with many headers can cause DoS in ws < 8.17.1.',
    cve: 'CVE-2024-37890',
    url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-37890',
  },
  {
    id: 'KB-SEMVER-REDOS',
    package: 'semver',
    affectedFrom: '0.0.0',
    fixedIn: '7.5.2',
    severity: 'high',
    title: 'ReDoS in semver',
    description: 'semver before 7.5.2 is vulnerable to Regular Expression Denial of Service.',
    cve: 'CVE-2022-25883',
    url: 'https://nvd.nist.gov/vuln/detail/CVE-2022-25883',
  },
  {
    id: 'KB-JSON5-PROTO',
    package: 'json5',
    affectedFrom: '0.0.0',
    fixedIn: '2.2.2',
    severity: 'high',
    title: 'Prototype Pollution in json5',
    description: 'json5 before 2.2.2 is vulnerable to prototype pollution via parse.',
    cve: 'CVE-2022-46175',
    url: 'https://nvd.nist.gov/vuln/detail/CVE-2022-46175',
  },
  {
    id: 'KB-BRACES-REDOS',
    package: 'braces',
    affectedFrom: '0.0.0',
    fixedIn: '3.0.3',
    severity: 'high',
    title: 'Uncontrolled resource consumption in braces',
    description: 'braces before 3.0.3 may allocate excessive memory for crafted input.',
    cve: 'CVE-2024-4068',
    url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-4068',
  },
  {
    id: 'KB-FOLLOW-REDIRECTS',
    package: 'follow-redirects',
    affectedFrom: '0.0.0',
    fixedIn: '1.15.6',
    severity: 'medium',
    title: 'Sensitive information exposure in follow-redirects',
    description: 'follow-redirects before 1.15.6 may leak Authorization headers across hosts.',
    cve: 'CVE-2024-28849',
    url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-28849',
  },
  {
    id: 'KB-IP-SSRF',
    package: 'ip',
    affectedFrom: '0.0.0',
    fixedIn: '2.0.1',
    severity: 'high',
    title: 'SSRF bypass in ip package',
    description: 'ip before 2.0.1 incorrectly categorizes some private IPs as public.',
    cve: 'CVE-2023-42282',
    url: 'https://nvd.nist.gov/vuln/detail/CVE-2023-42282',
  },
  {
    id: 'KB-MICROMATCH-REDOS',
    package: 'micromatch',
    affectedFrom: '0.0.0',
    fixedIn: '4.0.8',
    severity: 'medium',
    title: 'ReDoS in micromatch',
    description: 'micromatch before 4.0.8 is vulnerable to Regular Expression Denial of Service.',
    cve: 'CVE-2024-4067',
    url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-4067',
  },
  {
    id: 'KB-PATH-TO-REGEXP',
    package: 'path-to-regexp',
    affectedFrom: '0.0.0',
    fixedIn: '0.1.12',
    severity: 'high',
    title: 'ReDoS in path-to-regexp',
    description: 'path-to-regexp before 0.1.12 can backtrack excessively on crafted paths.',
    cve: 'CVE-2024-45296',
    url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-45296',
  },
]

const PERMISSIVE_LICENSES = new Set([
  'mit',
  'apache-2.0',
  'bsd-2-clause',
  'bsd-3-clause',
  'isc',
  '0bsd',
  'unlicense',
  'cc0-1.0',
  'mpl-2.0',
])

const COPYLEFT_WARN = new Set(['gpl-2.0', 'gpl-3.0', 'agpl-3.0', 'lgpl-2.1', 'lgpl-3.0'])

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 40,
  high: 25,
  medium: 12,
  low: 5,
  info: 1,
}

// ---------------------------------------------------------------------------
// Semver helpers (lightweight — no external dependency)
// ---------------------------------------------------------------------------

interface ParsedSemver {
  major: number
  minor: number
  patch: number
  prerelease: string
}

export function parseSemver(input: string): ParsedSemver | null {
  const cleaned = String(input || '')
    .trim()
    .replace(/^[vV]/, '')
    .split('+')[0]
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || '',
  }
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return 0
  if (pa.major !== pb.major) return pa.major - pb.major
  if (pa.minor !== pb.minor) return pa.minor - pb.minor
  if (pa.patch !== pb.patch) return pa.patch - pb.patch
  if (pa.prerelease === pb.prerelease) return 0
  if (!pa.prerelease) return 1
  if (!pb.prerelease) return -1
  return pa.prerelease < pb.prerelease ? -1 : 1
}

export function isVersionInRange(version: string, range: string): boolean {
  const v = parseSemver(version)
  if (!v) return false
  const r = String(range || '').trim()
  if (!r || r === '*' || r === 'x' || r === 'latest') return true

  // Exact
  if (/^\d+\.\d+\.\d+/.test(r) && !/[<>^*=~]/.test(r.replace(/^[vV]/, ''))) {
    return compareSemver(version, r.replace(/^[vV]/, '')) === 0
  }

  // Caret ^1.2.3
  if (r.startsWith('^')) {
    const base = parseSemver(r.slice(1))
    if (!base) return false
    if (compareSemver(version, r.slice(1)) < 0) return false
    if (base.major === 0) {
      if (base.minor === 0) return v.major === 0 && v.minor === 0 && v.patch === base.patch
      return v.major === 0 && v.minor === base.minor
    }
    return v.major === base.major
  }

  // Tilde ~1.2.3
  if (r.startsWith('~')) {
    const base = parseSemver(r.slice(1))
    if (!base) return false
    return (
      v.major === base.major &&
      v.minor === base.minor &&
      compareSemver(version, r.slice(1)) >= 0
    )
  }

  // >= / > / <= / <
  const ops = r.match(/(>=|<=|>|<|=)\s*([0-9]+\.[0-9]+\.[0-9]+[^\s]*)/g)
  if (ops) {
    return ops.every((token) => {
      const m = token.match(/(>=|<=|>|<|=)\s*(.+)/)
      if (!m) return true
      const [, op, target] = m
      const cmp = compareSemver(version, target)
      if (op === '>=') return cmp >= 0
      if (op === '>') return cmp > 0
      if (op === '<=') return cmp <= 0
      if (op === '<') return cmp < 0
      return cmp === 0
    })
  }

  // Hyphen range 1.2.3 - 2.0.0
  if (r.includes(' - ')) {
    const [lo, hi] = r.split(' - ').map((s) => s.trim())
    return compareSemver(version, lo) >= 0 && compareSemver(version, hi) <= 0
  }

  // OR ranges
  if (r.includes('||')) {
    return r.split('||').some((part) => isVersionInRange(version, part.trim()))
  }

  return false
}

export function classifyUpdateRisk(from: string, to: string): UpdateRisk {
  const a = parseSemver(from)
  const b = parseSemver(to)
  if (!a || !b) return 'medium'
  if (b.major > a.major) return 'breaking'
  if (b.minor > a.minor) return a.major === 0 ? 'high' : 'medium'
  if (b.patch > a.patch) return 'safe'
  if (compareSemver(to, from) === 0) return 'safe'
  return 'low'
}

function riskToScore(risk: UpdateRisk): number {
  switch (risk) {
    case 'safe':
      return 10
    case 'low':
      return 25
    case 'medium':
      return 50
    case 'high':
      return 75
    case 'breaking':
      return 95
    default:
      return 50
  }
}

function normalizeLicense(license?: string): string {
  if (!license) return 'UNKNOWN'
  return license.trim()
}

export function assessLicenseRisk(license?: string): LicenseRisk {
  const key = normalizeLicense(license).toLowerCase()
  if (!license || key === 'unknown' || key === 'unlicensed' || key === 'proprietary') return 'alert'
  if (COPYLEFT_WARN.has(key)) return 'warn'
  if (PERMISSIVE_LICENSES.has(key)) return 'ok'
  if (key.includes('gpl') || key.includes('agpl')) return 'warn'
  return 'ok'
}

function normalizeSeverity(raw?: string): Severity {
  const s = String(raw || '').toLowerCase()
  if (s === 'critical') return 'critical'
  if (s === 'high') return 'high'
  if (s === 'moderate' || s === 'medium') return 'medium'
  if (s === 'low') return 'low'
  return 'info'
}

function isVersionAffected(version: string, record: VulnerabilityRecord): boolean {
  if (record.affectedVersions?.length) {
    return record.affectedVersions.includes(version)
  }
  if (record.fixedIn && compareSemver(version, record.fixedIn) >= 0) return false
  if (record.affectedFrom && compareSemver(version, record.affectedFrom) < 0) return false
  if (record.fixedIn || record.affectedFrom) return true
  return false
}

// ---------------------------------------------------------------------------
// Core analysis steps
// ---------------------------------------------------------------------------

export function extractManifestPackages(
  manifest: PackageManifest
): Array<{ name: string; requestedRange: string; kind: DependencyKind }> {
  const out: Array<{ name: string; requestedRange: string; kind: DependencyKind }> = []
  const push = (map: Record<string, string> | undefined, kind: DependencyKind) => {
    if (!map) return
    for (const [name, requestedRange] of Object.entries(map)) {
      out.push({ name, requestedRange, kind })
    }
  }
  push(manifest.dependencies, 'direct')
  push(manifest.devDependencies, 'dev')
  push(manifest.peerDependencies, 'peer')
  push(manifest.optionalDependencies, 'optional')
  return out
}

export function matchVulnerabilities(
  packages: Array<{ name: string; version: string }>,
  db: VulnerabilityRecord[] = BUILTIN_VULNERABILITY_DB
): Map<string, VulnerabilityFinding[]> {
  const map = new Map<string, VulnerabilityFinding[]>()
  for (const pkg of packages) {
    const hits = db
      .filter((r) => r.package === pkg.name && isVersionAffected(pkg.version, r))
      .map(
        (r): VulnerabilityFinding => ({
          id: r.id,
          severity: r.severity,
          title: r.title,
          description: r.description,
          cve: r.cve,
          fixedIn: r.fixedIn,
          url: r.url,
          source: 'knowledge-base',
        })
      )
    if (hits.length) map.set(pkg.name, hits)
  }
  return map
}

export function parseAuditReport(audit?: NpmAuditReport): Map<string, VulnerabilityFinding[]> {
  const map = new Map<string, VulnerabilityFinding[]>()
  if (!audit?.vulnerabilities) return map

  for (const [pkgName, entry] of Object.entries(audit.vulnerabilities)) {
    const findings: VulnerabilityFinding[] = []
    const vias = Array.isArray(entry.via) ? entry.via : []
    for (const via of vias) {
      if (typeof via === 'string') continue
      findings.push({
        id: `AUDIT-${via.source ?? pkgName}-${via.title ?? 'finding'}`.replace(/\s+/g, '-'),
        severity: normalizeSeverity(via.severity || entry.severity),
        title: via.title || `Vulnerability in ${pkgName}`,
        description: via.title || `npm audit reported a ${entry.severity || 'unknown'} issue in ${pkgName}.`,
        url: via.url,
        fixedIn:
          typeof entry.fixAvailable === 'object' && entry.fixAvailable?.version
            ? entry.fixAvailable.version
            : undefined,
        source: 'audit-report',
      })
    }
    if (!findings.length && entry.severity) {
      findings.push({
        id: `AUDIT-${pkgName}`,
        severity: normalizeSeverity(entry.severity),
        title: `Vulnerability in ${pkgName}`,
        description: `npm audit severity: ${entry.severity}. Range: ${entry.range || 'n/a'}.`,
        fixedIn:
          typeof entry.fixAvailable === 'object' && entry.fixAvailable?.version
            ? entry.fixAvailable.version
            : undefined,
        source: 'audit-report',
      })
    }
    if (findings.length) map.set(pkgName, findings)
  }
  return map
}

function mergeVulnerabilityMaps(
  ...maps: Array<Map<string, VulnerabilityFinding[]>>
): Map<string, VulnerabilityFinding[]> {
  const merged = new Map<string, VulnerabilityFinding[]>()
  for (const map of maps) {
    for (const [name, findings] of map) {
      const existing = merged.get(name) || []
      const seen = new Set(existing.map((f) => f.id + f.title))
      for (const f of findings) {
        const key = f.id + f.title
        if (!seen.has(key)) {
          existing.push(f)
          seen.add(key)
        }
      }
      merged.set(name, existing)
    }
  }
  return merged
}

export function detectVersionConflicts(lockPackages: LockfilePackage[] = []): VersionConflict[] {
  const byName = new Map<string, LockfilePackage[]>()
  for (const pkg of lockPackages) {
    const list = byName.get(pkg.name) || []
    list.push(pkg)
    byName.set(pkg.name, list)
  }

  const conflicts: VersionConflict[] = []

  for (const [name, installs] of byName) {
    const versions = [...new Set(installs.map((p) => p.version))]
    const ranges = installs.flatMap((p) => p.requiredBy || [])

    // Multiple installed versions ⇒ conflict / duplication
    if (versions.length > 1) {
      conflicts.push({
        package: name,
        conflictingRanges: ranges.length
          ? ranges
          : versions.map((v) => ({ parent: '(tree)', range: v })),
        installedVersions: versions.sort(compareSemver),
        severity: versions.length > 2 ? 'high' : 'medium',
        resolution: `Deduplicate ${name} by aligning dependents on a single compatible range (prefer ${versions.sort(compareSemver).at(-1)}).`,
        confidence: 0.92,
      })
      continue
    }

    // Single install that does not satisfy a declared parent range
    if (versions.length === 1 && ranges.length) {
      const installed = versions[0]
      const unsatisfied = ranges.filter((r) => !isVersionInRange(installed, r.range))
      if (unsatisfied.length) {
        conflicts.push({
          package: name,
          conflictingRanges: unsatisfied,
          installedVersions: [installed],
          severity: 'high',
          resolution: `Installed ${name}@${installed} does not satisfy ${unsatisfied
            .map((u) => `${u.parent} → ${u.range}`)
            .join(', ')}. Reinstall or relax the stricter range.`,
          confidence: 0.95,
        })
      }
    }

    // Incompatible peer-style range intersections among parents
    if (ranges.length >= 2) {
      const incompatiblePairs: Array<{ parent: string; range: string }> = []
      for (let i = 0; i < ranges.length; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
          if (!rangesOverlap(ranges[i].range, ranges[j].range)) {
            incompatiblePairs.push(ranges[i], ranges[j])
          }
        }
      }
      if (incompatiblePairs.length) {
        const unique = [
          ...new Map(incompatiblePairs.map((r) => [`${r.parent}:${r.range}`, r])).values(),
        ]
        conflicts.push({
          package: name,
          conflictingRanges: unique,
          installedVersions: versions,
          severity: 'critical',
          resolution: `No single version of ${name} satisfies all parent ranges. Upgrade or pin parents to compatible ranges.`,
          confidence: 0.9,
        })
      }
    }
  }

  // Deduplicate by package+resolution
  const seen = new Set<string>()
  return conflicts.filter((c) => {
    const key = `${c.package}|${c.resolution}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Approximate range overlap for caret/tilde/exact common cases. */
export function rangesOverlap(a: string, b: string): boolean {
  const candidates = ['0.0.0', '0.1.0', '0.5.0', '1.0.0', '1.2.3', '1.5.0', '2.0.0', '2.5.0', '3.0.0', '10.0.0']
  // Also probe extracted bases
  for (const range of [a, b]) {
    const m = range.match(/(\d+\.\d+\.\d+)/)
    if (m) candidates.push(m[1])
  }
  return [...new Set(candidates)].some(
    (v) => isVersionInRange(v, a) && isVersionInRange(v, b)
  )
}

export function buildUpdateRecommendation(
  pkg: {
    name: string
    version: string
    latestVersion: string
    vulnerabilities: VulnerabilityFinding[]
    kind: DependencyKind
    deprecated?: boolean
  }
): UpdateRecommendation | null {
  if (!pkg.latestVersion || compareSemver(pkg.latestVersion, pkg.version) <= 0) {
    // Still recommend a security bump if vulns list a fixedIn ahead of current
    const fixTargets = pkg.vulnerabilities
      .map((v) => v.fixedIn)
      .filter((v): v is string => Boolean(v) && compareSemver(v!, pkg.version) > 0)
      .sort(compareSemver)
    if (!fixTargets.length) return null
    const toVersion = fixTargets[fixTargets.length - 1]
    return finalizeRecommendation(pkg, toVersion, true)
  }
  return finalizeRecommendation(pkg, pkg.latestVersion, pkg.vulnerabilities.length > 0)
}

function finalizeRecommendation(
  pkg: {
    name: string
    version: string
    vulnerabilities: VulnerabilityFinding[]
    kind: DependencyKind
    deprecated?: boolean
  },
  toVersion: string,
  securityDriven: boolean
): UpdateRecommendation {
  const risk = classifyUpdateRisk(pkg.version, toVersion)
  let riskScore = riskToScore(risk)
  if (securityDriven) riskScore = Math.max(0, riskScore - 15) // security patches are preferred
  if (pkg.kind === 'dev') riskScore = Math.max(0, riskScore - 10)
  if (pkg.deprecated) riskScore = Math.min(100, riskScore + 20)

  const breakingChangeLikely = risk === 'breaking' || risk === 'high'
  const safe = risk === 'safe' || risk === 'low' || (risk === 'medium' && securityDriven)

  const maxSev = pkg.vulnerabilities.reduce<Severity | null>((acc, v) => {
    if (!acc) return v.severity
    return SEVERITY_WEIGHT[v.severity] > SEVERITY_WEIGHT[acc] ? v.severity : acc
  }, null)

  const reasonParts: string[] = []
  if (securityDriven && maxSev) {
    reasonParts.push(`Patches ${maxSev}-severity vulnerability`)
  }
  if (compareSemver(toVersion, pkg.version) > 0) {
    reasonParts.push(`Moves ${pkg.version} → ${toVersion} (${risk} risk)`)
  }
  if (pkg.deprecated) reasonParts.push('Package is deprecated — plan a replacement')
  if (!reasonParts.length) reasonParts.push('Routine maintenance update')

  const steps: string[] = []
  if (safe && !breakingChangeLikely) {
    steps.push(`npm install ${pkg.name}@${toVersion}`)
    steps.push('Run unit and integration tests')
  } else {
    steps.push(`Review changelog for ${pkg.name} between ${pkg.version} and ${toVersion}`)
    steps.push(`Update in a dedicated branch: npm install ${pkg.name}@${toVersion}`)
    steps.push('Run full regression suite and visual checks')
    if (breakingChangeLikely) steps.push('Audit call sites for breaking API changes')
  }

  return {
    package: pkg.name,
    fromVersion: pkg.version,
    toVersion,
    risk,
    riskScore,
    confidence: safe ? 0.9 : breakingChangeLikely ? 0.75 : 0.85,
    reason: reasonParts.join('. ') + '.',
    breakingChangeLikely,
    safe,
    steps,
  }
}

export function computeDependencyHealthScore(input: {
  packages: DependencyPackage[]
  conflicts: VersionConflict[]
}): DependencyHealthScore {
  const { packages, conflicts } = input
  if (!packages.length) {
    return {
      overall: 100,
      vulnerabilityScore: 100,
      freshnessScore: 100,
      conflictScore: 100,
      licenseScore: 100,
      status: 'good',
      tips: ['No dependencies declared.'],
    }
  }

  const vulnPenalty = packages.reduce(
    (sum, p) => sum + p.vulnerabilities.reduce((s, v) => s + SEVERITY_WEIGHT[v.severity], 0),
    0
  )
  const vulnerabilityScore = Math.max(0, 100 - vulnPenalty)

  const outdated = packages.filter((p) => p.outdated).length
  const freshnessScore = Math.max(0, Math.round(100 - (outdated / packages.length) * 100))

  const conflictPenalty = conflicts.reduce((sum, c) => sum + SEVERITY_WEIGHT[c.severity], 0)
  const conflictScore = Math.max(0, 100 - conflictPenalty)

  const licenseAlerts = packages.filter((p) => p.licenseRisk !== 'ok').length
  const licenseScore = Math.max(0, Math.round(100 - (licenseAlerts / packages.length) * 80))

  const overall = Math.round(
    vulnerabilityScore * 0.4 + freshnessScore * 0.25 + conflictScore * 0.25 + licenseScore * 0.1
  )

  const tips: string[] = []
  const vulnCount = packages.filter((p) => p.vulnerabilities.length > 0).length
  if (vulnCount) tips.push(`Patch ${vulnCount} vulnerable package${vulnCount === 1 ? '' : 's'}`)
  if (outdated) tips.push(`Update ${outdated} outdated package${outdated === 1 ? '' : 's'}`)
  if (conflicts.length) tips.push(`Resolve ${conflicts.length} version conflict${conflicts.length === 1 ? '' : 's'}`)
  if (licenseAlerts) tips.push(`Review ${licenseAlerts} license risk${licenseAlerts === 1 ? '' : 's'}`)
  if (!tips.length) tips.push('Dependency tree looks healthy — keep audits running in CI')

  const status: DependencyHealthScore['status'] =
    overall >= 80 ? 'good' : overall >= 55 ? 'warning' : 'critical'

  return { overall, vulnerabilityScore, freshnessScore, conflictScore, licenseScore, status, tips }
}

function resolveInstalledVersion(
  name: string,
  requestedRange: string,
  lockPackages: LockfilePackage[],
  registry?: RegistryMeta
): string {
  const locked = lockPackages.find((p) => p.name === name)
  if (locked) return locked.version

  // Strip range operators for a best-effort current version
  const exact = requestedRange.replace(/^[\^~>=<\s]*/, '').split(' ')[0]
  if (parseSemver(exact)) return exact
  if (registry?.latestVersion) return registry.latestVersion
  return exact || '0.0.0'
}

/**
 * Detection rate: share of packages that are actually vulnerable (per combined
 * DB + audit) for which we emitted at least one finding. Targets ≥ 90%.
 */
export function computeDetectionRate(
  packages: Array<{ name: string; version: string }>,
  findings: Map<string, VulnerabilityFinding[]>,
  groundTruthDb: VulnerabilityRecord[]
): number {
  const trulyVulnerable = packages.filter((p) =>
    groundTruthDb.some((r) => r.package === p.name && isVersionAffected(p.version, r))
  )
  if (!trulyVulnerable.length) return 1
  const detected = trulyVulnerable.filter((p) => (findings.get(p.name) || []).length > 0)
  return detected.length / trulyVulnerable.length
}

export function generateInsights(result: Omit<DependencyAnalysisResult, 'insights'>): string[] {
  const insights: string[] = []
  const critical = result.vulnerabilities.filter((v) => v.severity === 'critical' || v.severity === 'high')
  if (critical.length) {
    insights.push(
      `${critical.length} high-or-critical issue${critical.length === 1 ? '' : 's'} need attention before the next release.`
    )
  }
  const safeRecs = result.recommendations.filter((r) => r.safe)
  if (safeRecs.length) {
    insights.push(
      `${safeRecs.length} safe update${safeRecs.length === 1 ? '' : 's'} can be applied with low regression risk.`
    )
  }
  const breaking = result.recommendations.filter((r) => r.breakingChangeLikely)
  if (breaking.length) {
    insights.push(
      `${breaking.length} update${breaking.length === 1 ? '' : 's'} look breaking — schedule dedicated upgrade work.`
    )
  }
  if (result.conflicts.length) {
    insights.push(
      `${result.conflicts.length} version conflict${result.conflicts.length === 1 ? '' : 's'} detected in the dependency tree.`
    )
  }
  insights.push(
    `Overall dependency health score: ${result.health.overall}/100 (${result.health.status}).`
  )
  if (result.detectionRate >= 0.9) {
    insights.push(
      `Vulnerability detection coverage ${(result.detectionRate * 100).toFixed(0)}% meets the 90% reliability target.`
    )
  }
  return insights
}

/**
 * Primary entry point — analyze a project's dependency graph.
 */
export function analyzeDependencies(input: AnalyzeDependenciesInput): DependencyAnalysisResult {
  const {
    manifest,
    lockPackages = [],
    audit,
    registry = [],
    vulnerabilityDb = BUILTIN_VULNERABILITY_DB,
  } = input

  const registryMap = new Map(registry.map((r) => [r.name, r]))
  const declared = extractManifestPackages(manifest)

  // Include transitive lock packages not in the manifest
  const declaredNames = new Set(declared.map((d) => d.name))
  const transitive = lockPackages
    .filter((p) => !declaredNames.has(p.name))
    .map((p) => ({
      name: p.name,
      requestedRange: p.version,
      kind: 'transitive' as const,
    }))

  const allDeclared = [...declared, ...transitive]

  const versioned = allDeclared.map((d) => {
    const meta = registryMap.get(d.name)
    const version = resolveInstalledVersion(d.name, d.requestedRange, lockPackages, meta)
    return { ...d, version, meta }
  })

  const kbFindings = matchVulnerabilities(
    versioned.map((p) => ({ name: p.name, version: p.version })),
    vulnerabilityDb
  )
  const auditFindings = parseAuditReport(audit)
  const findings = mergeVulnerabilityMaps(kbFindings, auditFindings)

  const conflicts = detectVersionConflicts(lockPackages)

  const packages: DependencyPackage[] = versioned.map((p) => {
    const meta = p.meta
    const latestVersion = meta?.latestVersion || p.version
    const license = normalizeLicense(meta?.license)
    const vulns = findings.get(p.name) || []
    const outdated = compareSemver(latestVersion, p.version) > 0
    const pkg: DependencyPackage = {
      name: p.name,
      version: p.version,
      requestedRange: p.requestedRange,
      kind: p.kind,
      latestVersion,
      outdated,
      license,
      licenseRisk: assessLicenseRisk(license),
      deprecated: Boolean(meta?.deprecated),
      vulnerabilities: vulns,
      updateRecommendation: null,
    }
    pkg.updateRecommendation = buildUpdateRecommendation(pkg)
    return pkg
  })

  const recommendations = packages
    .map((p) => p.updateRecommendation)
    .filter((r): r is UpdateRecommendation => Boolean(r))
    .sort((a, b) => {
      // Prefer safe security fixes first, then higher risk scores that are still actionable
      if (a.safe !== b.safe) return a.safe ? -1 : 1
      return b.riskScore - a.riskScore
    })

  const vulnerabilities = packages.flatMap((p) => p.vulnerabilities)
  const health = computeDependencyHealthScore({ packages, conflicts })
  const detectionRate = computeDetectionRate(
    versioned.map((p) => ({ name: p.name, version: p.version })),
    findings,
    vulnerabilityDb
  )

  const partial = {
    packages,
    vulnerabilities,
    recommendations,
    conflicts,
    health,
    detectionRate,
    analyzedAt: new Date().toISOString(),
    packageCount: packages.length,
    vulnerableCount: packages.filter((p) => p.vulnerabilities.length > 0).length,
    outdatedCount: packages.filter((p) => p.outdated).length,
    conflictCount: conflicts.length,
  }

  return {
    ...partial,
    insights: generateInsights(partial),
  }
}

/**
 * Convenience: analyze using only a manifest + optional known versions.
 * Useful for demos and unit tests without a lockfile.
 */
export function analyzeManifest(
  manifest: PackageManifest,
  options: Omit<AnalyzeDependenciesInput, 'manifest'> = {}
): DependencyAnalysisResult {
  return analyzeDependencies({ manifest, ...options })
}
