/**
 * Tests for Intelligent Dependency Management (#602).
 * Covers vulnerability detection (≥90%), safe recommendations,
 * conflict detection, and risk assessment reliability.
 */

import { describe, it, expect } from 'vitest'
import {
  analyzeDependencies,
  assessLicenseRisk,
  classifyUpdateRisk,
  compareSemver,
  computeDetectionRate,
  detectVersionConflicts,
  isVersionInRange,
  matchVulnerabilities,
  parseAuditReport,
  parseSemver,
  rangesOverlap,
  BUILTIN_VULNERABILITY_DB,
  type VulnerabilityRecord,
} from '../dependencyManagement'
import {
  SAMPLE_AUDIT,
  SAMPLE_LOCK_PACKAGES,
  SAMPLE_MANIFEST,
  SAMPLE_REGISTRY,
} from '../../data/dependencySample'

describe('semver helpers', () => {
  it('parses standard versions', () => {
    expect(parseSemver('1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: '',
    })
    expect(parseSemver('v2.0.0-beta.1')?.prerelease).toBe('beta.1')
  })

  it('compares versions correctly', () => {
    expect(compareSemver('1.2.3', '1.2.4')).toBeLessThan(0)
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
  })

  it('evaluates caret / tilde / comparison ranges', () => {
    expect(isVersionInRange('1.5.0', '^1.2.3')).toBe(true)
    expect(isVersionInRange('2.0.0', '^1.2.3')).toBe(false)
    expect(isVersionInRange('1.2.9', '~1.2.3')).toBe(true)
    expect(isVersionInRange('1.3.0', '~1.2.3')).toBe(false)
    expect(isVersionInRange('1.2.3', '>=1.0.0 <2.0.0')).toBe(true)
  })

  it('classifies update risk by semver delta', () => {
    expect(classifyUpdateRisk('1.0.0', '1.0.1')).toBe('safe')
    expect(classifyUpdateRisk('1.0.0', '1.1.0')).toBe('medium')
    expect(classifyUpdateRisk('1.0.0', '2.0.0')).toBe('breaking')
  })
})

describe('license risk assessment', () => {
  it('marks permissive licenses as ok', () => {
    expect(assessLicenseRisk('MIT')).toBe('ok')
    expect(assessLicenseRisk('Apache-2.0')).toBe('ok')
  })

  it('warns on copyleft and alerts on unknown', () => {
    expect(assessLicenseRisk('GPL-3.0')).toBe('warn')
    expect(assessLicenseRisk('UNKNOWN')).toBe('alert')
    expect(assessLicenseRisk(undefined)).toBe('alert')
  })
})

describe('vulnerability detection (AC: ≥90%)', () => {
  const vulnerablePackages = [
    { name: 'lodash', version: '4.17.20' },
    { name: 'axios', version: '1.4.0' },
    { name: 'ws', version: '8.11.0' },
    { name: 'semver', version: '7.5.1' },
    { name: 'json5', version: '2.2.0' },
    { name: 'braces', version: '3.0.2' },
    { name: 'follow-redirects', version: '1.15.0' },
    { name: 'ip', version: '1.1.8' },
    { name: 'micromatch', version: '4.0.5' },
    { name: 'path-to-regexp', version: '0.1.7' },
  ]

  const patchedPackages = [
    { name: 'lodash', version: '4.17.21' },
    { name: 'axios', version: '1.7.0' },
    { name: 'ws', version: '8.18.0' },
  ]

  it('identifies at least 90% of known vulnerable packages', () => {
    const findings = matchVulnerabilities(vulnerablePackages, BUILTIN_VULNERABILITY_DB)
    const rate = computeDetectionRate(vulnerablePackages, findings, BUILTIN_VULNERABILITY_DB)
    expect(rate).toBeGreaterThanOrEqual(0.9)
    expect(findings.size).toBeGreaterThanOrEqual(9)
  })

  it('does not flag patched versions', () => {
    const findings = matchVulnerabilities(patchedPackages, BUILTIN_VULNERABILITY_DB)
    expect(findings.size).toBe(0)
  })

  it('parses npm audit reports into findings', () => {
    const auditFindings = parseAuditReport(SAMPLE_AUDIT)
    expect(auditFindings.has('lodash')).toBe(true)
    expect(auditFindings.has('axios')).toBe(true)
    expect(auditFindings.get('ws')?.[0].severity).toBe('high')
  })
})

describe('conflict detection (AC: accurate)', () => {
  it('detects multiple installed versions of the same package', () => {
    const conflicts = detectVersionConflicts([
      {
        name: 'semver',
        version: '6.3.1',
        requiredBy: [{ parent: 'a', range: '^6.0.0' }],
      },
      {
        name: 'semver',
        version: '7.5.1',
        requiredBy: [{ parent: 'b', range: '^7.0.0' }],
      },
    ])
    expect(conflicts.some((c) => c.package === 'semver' && c.installedVersions.length === 2)).toBe(
      true
    )
  })

  it('detects unsatisfied parent ranges', () => {
    const conflicts = detectVersionConflicts([
      {
        name: 'path-to-regexp',
        version: '0.1.7',
        requiredBy: [
          { parent: 'express', range: '0.1.7' },
          { parent: 'router', range: '>=0.1.12' },
        ],
      },
    ])
    expect(conflicts.some((c) => c.package === 'path-to-regexp')).toBe(true)
    expect(conflicts[0].resolution.toLowerCase()).toMatch(/does not satisfy|no single version/)
  })

  it('rangesOverlap distinguishes compatible vs incompatible ranges', () => {
    expect(rangesOverlap('^1.0.0', '^1.5.0')).toBe(true)
    expect(rangesOverlap('^1.0.0', '^2.0.0')).toBe(false)
  })
})

describe('update recommendations (AC: safe)', () => {
  it('marks patch security upgrades as safe', () => {
    const result = analyzeDependencies({
      manifest: {
        dependencies: {
          lodash: '4.17.20',
        },
      },
      lockPackages: [{ name: 'lodash', version: '4.17.20' }],
      registry: [{ name: 'lodash', latestVersion: '4.17.21', license: 'MIT' }],
    })
    const rec = result.recommendations.find((r) => r.package === 'lodash')
    expect(rec).toBeTruthy()
    expect(rec!.toVersion).toBe('4.17.21')
    expect(rec!.safe).toBe(true)
    expect(rec!.breakingChangeLikely).toBe(false)
    expect(rec!.risk).toBe('safe')
  })

  it('flags major upgrades as breaking / not blindly safe', () => {
    const result = analyzeDependencies({
      manifest: { dependencies: { leftpad: '1.0.0' } },
      lockPackages: [{ name: 'leftpad', version: '1.0.0' }],
      registry: [{ name: 'leftpad', latestVersion: '2.0.0', license: 'MIT' }],
      vulnerabilityDb: [],
    })
    const rec = result.recommendations.find((r) => r.package === 'leftpad')
    expect(rec).toBeTruthy()
    expect(rec!.breakingChangeLikely).toBe(true)
    expect(rec!.safe).toBe(false)
    expect(rec!.risk).toBe('breaking')
  })
})

describe('risk assessment reliability (AC)', () => {
  it('produces a coherent health score for the sample project', () => {
    const result = analyzeDependencies({
      manifest: SAMPLE_MANIFEST,
      lockPackages: SAMPLE_LOCK_PACKAGES,
      audit: SAMPLE_AUDIT,
      registry: SAMPLE_REGISTRY,
    })

    expect(result.packageCount).toBeGreaterThan(5)
    expect(result.vulnerableCount).toBeGreaterThan(0)
    expect(result.conflictCount).toBeGreaterThan(0)
    expect(result.health.overall).toBeGreaterThanOrEqual(0)
    expect(result.health.overall).toBeLessThanOrEqual(100)
    expect(result.health.vulnerabilityScore).toBeLessThan(100)
    expect(['good', 'warning', 'critical']).toContain(result.health.status)
    expect(result.insights.length).toBeGreaterThan(0)
    expect(result.detectionRate).toBeGreaterThanOrEqual(0.9)
  })

  it('scores a clean tree as healthy', () => {
    const result = analyzeDependencies({
      manifest: {
        dependencies: {
          react: '^18.3.0',
        },
      },
      lockPackages: [{ name: 'react', version: '18.3.1' }],
      registry: [{ name: 'react', latestVersion: '18.3.1', license: 'MIT' }],
      vulnerabilityDb: [],
    })
    expect(result.vulnerableCount).toBe(0)
    expect(result.conflictCount).toBe(0)
    expect(result.health.overall).toBeGreaterThanOrEqual(80)
    expect(result.health.status).toBe('good')
  })

  it('weights critical vulns heavier than low', () => {
    const criticalDb: VulnerabilityRecord[] = [
      {
        id: 'C1',
        package: 'pkg-a',
        affectedFrom: '0.0.0',
        fixedIn: '2.0.0',
        severity: 'critical',
        title: 'Critical',
        description: 'crit',
      },
    ]
    const lowDb: VulnerabilityRecord[] = [
      {
        id: 'L1',
        package: 'pkg-a',
        affectedFrom: '0.0.0',
        fixedIn: '2.0.0',
        severity: 'low',
        title: 'Low',
        description: 'low',
      },
    ]
    const critical = analyzeDependencies({
      manifest: { dependencies: { 'pkg-a': '1.0.0' } },
      lockPackages: [{ name: 'pkg-a', version: '1.0.0' }],
      registry: [{ name: 'pkg-a', latestVersion: '2.0.0', license: 'MIT' }],
      vulnerabilityDb: criticalDb,
    })
    const low = analyzeDependencies({
      manifest: { dependencies: { 'pkg-a': '1.0.0' } },
      lockPackages: [{ name: 'pkg-a', version: '1.0.0' }],
      registry: [{ name: 'pkg-a', latestVersion: '2.0.0', license: 'MIT' }],
      vulnerabilityDb: lowDb,
    })
    expect(critical.health.vulnerabilityScore).toBeLessThan(low.health.vulnerabilityScore)
  })
})

describe('end-to-end sample analysis (#602)', () => {
  it('surfaces lodash/axios/ws vulns and actionable recommendations', () => {
    const result = analyzeDependencies({
      manifest: SAMPLE_MANIFEST,
      lockPackages: SAMPLE_LOCK_PACKAGES,
      audit: SAMPLE_AUDIT,
      registry: SAMPLE_REGISTRY,
    })

    const names = result.packages.filter((p) => p.vulnerabilities.length > 0).map((p) => p.name)
    expect(names).toEqual(expect.arrayContaining(['lodash', 'axios', 'ws']))

    const safeRecs = result.recommendations.filter((r) => r.safe)
    expect(safeRecs.length).toBeGreaterThan(0)
    expect(safeRecs.every((r) => r.steps.length > 0)).toBe(true)

    expect(result.conflicts.some((c) => c.package === 'semver' || c.package === 'path-to-regexp')).toBe(
      true
    )
  })
})
