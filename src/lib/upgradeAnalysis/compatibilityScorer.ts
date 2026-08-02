import type { ContractChange, ContractSpec, CompatibilityScore, CompatibilityBreakdown } from './types'

export function computeCompatibilityScore(
  oldSpec: ContractSpec | null,
  newSpec: ContractSpec,
  changes: ContractChange[]
): CompatibilityScore {
  const apiChanges = changes.filter(c => c.path[0] === 'functions')
  const storageChanges = changes.filter(c => c.path[0] === 'customTypes')
  const errorChanges = changes.filter(c => c.path[0] === 'errorTypes')

  const apiBreakages = apiChanges.filter(c => c.category === 'breaking')
  const apiScore = computeApiCompatibility(oldSpec, newSpec, apiChanges, apiBreakages)

  const storageBreakages = storageChanges.filter(c => c.category === 'breaking')
  const storageScore = computeStorageCompatibility(oldSpec, newSpec, storageBreakages)

  const errorBreakages = errorChanges.filter(c => c.category === 'breaking')
  const behavioralScore = computeBehavioralCompatibility(errorBreakages, changes)

  const integrationScore = computeIntegrationImpact(changes)

  const breakdown: CompatibilityBreakdown[] = [
    {
      area: 'API Compatibility',
      score: apiScore,
      weight: 0.4,
      details: [
        apiBreakages.length === 0
          ? 'All API functions are backward compatible'
          : `${apiBreakages.length} breaking API change(s) detected`,
        apiChanges.length === 0
          ? 'No API changes detected'
          : `${apiChanges.length} total API change(s) detected`,
      ],
    },
    {
      area: 'Storage Compatibility',
      score: storageScore,
      weight: 0.25,
      details: [
        storageBreakages.length === 0
          ? 'Storage types are backward compatible'
          : `${storageBreakages.length} storage type change(s) detected`,
      ],
    },
    {
      area: 'Behavioral Compatibility',
      score: behavioralScore,
      weight: 0.2,
      details: [
        errorBreakages.length === 0
          ? 'Error handling is backward compatible'
          : `${errorBreakages.length} error change(s) detected`,
      ],
    },
    {
      area: 'Integration Impact',
      score: integrationScore,
      weight: 0.15,
      details: [
        changes.length === 0
          ? 'No integration impact expected'
          : `${changes.length} total change(s) affecting integrations`,
      ],
    },
  ]

  const overall = breakdown.reduce((acc, b) => acc + b.score * b.weight, 0)

  return {
    overall: Math.round(overall * 100) / 100,
    apiCompatibility: apiScore,
    storageCompatibility: storageScore,
    behavioralCompatibility: behavioralScore,
    integrationImpact: integrationScore,
    breakdown,
  }
}

function computeApiCompatibility(
  oldSpec: ContractSpec | null,
  newSpec: ContractSpec,
  changes: ContractChange[],
  breakingChanges: ContractChange[]
): number {
  if (!oldSpec) return 1.0

  const totalOldFns = oldSpec.functions.length || 1
  const totalNewFns = newSpec.functions.length

  const functionRetentionRate = Math.min(1, totalNewFns / Math.max(totalOldFns, 1))

  const changePenalty = breakingChanges.length * 0.15
  const paramChangePenalty = changes.filter(c =>
    ['parameter-removed', 'parameter-type-changed', 'parameter-required-changed'].includes(c.kind)
  ).length * 0.1
  const returnTypePenalty = changes.filter(c => c.kind === 'return-type-changed').length * 0.2

  const totalPenalty = Math.min(1, changePenalty + paramChangePenalty + returnTypePenalty)

  return Math.max(0, Math.min(1, functionRetentionRate - totalPenalty))
}

function computeStorageCompatibility(
  oldSpec: ContractSpec | null,
  newSpec: ContractSpec,
  breakingChanges: ContractChange[]
): number {
  if (!oldSpec) return 1.0
  if (oldSpec.customTypes.length === 0 && newSpec.customTypes.length === 0) return 1.0
  const oldTypeCount = oldSpec.customTypes.length || 1
  const typeRetentionRate = Math.min(1, newSpec.customTypes.length / oldTypeCount)
  const penalty = breakingChanges.length * 0.2
  return Math.max(0, Math.min(1, typeRetentionRate - penalty))
}

function computeBehavioralCompatibility(
  errorBreakages: ContractChange[],
  allChanges: ContractChange[]
): number {
  const errorPenalty = errorBreakages.length * 0.25

  const functionAddedCount = allChanges.filter(c => c.kind === 'function-added').length
  const bonus = Math.min(functionAddedCount * 0.05, 0.15)

  const baseScore = 0.95
  return Math.max(0, Math.min(1, baseScore - errorPenalty + bonus))
}

function computeIntegrationImpact(changes: ContractChange[]): number {
  if (changes.length === 0) return 1.0

  const breakingCount = changes.filter(c => c.category === 'breaking').length
  const totalCount = changes.length

  const breakingRatio = breakingCount / Math.max(totalCount, 1)

  const weightedBreakingScore = changes.reduce((acc, c) => acc + c.impactScore, 0) / Math.max(totalCount, 1)
  const averageImpact = weightedBreakingScore

  const score = 1.0 - (breakingRatio * 0.6 + averageImpact * 0.4)
  return Math.max(0, Math.min(1, score))
}

export function generateCompatibilityReport(score: CompatibilityScore): string[] {
  const report: string[] = []
  if (score.overall >= 0.9) report.push('Highly compatible upgrade')
  else if (score.overall >= 0.7) report.push('Mostly compatible with minor issues')
  else if (score.overall >= 0.4) report.push('Significant compatibility concerns')
  else report.push('Major breaking changes detected - upgrade requires careful migration')

  for (const b of score.breakdown) {
    const status = b.score >= 0.8 ? 'Good' : b.score >= 0.5 ? 'Fair' : 'Poor'
    report.push(`${b.area}: ${status} (${Math.round(b.score * 100)}%)`)
  }

  return report
}
