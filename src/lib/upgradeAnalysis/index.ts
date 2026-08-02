import type {
  ContractSpec,
  UpgradeAnalysisResult,
  UpgradeSummary,
  AnalysisOptions,
  DiffResult,
} from './types'
import { compareContractSpecs, detectBreakingChanges, analyzeChangePatterns, compareBytecode } from './comparator'
import { computeCompatibilityScore, generateCompatibilityReport } from './compatibilityScorer'
import { predictImpact, recordUpgradeOutcome, getUpgradeHistory, getModelAccuracy, trainOnUpgradeHistory } from './mlEngine'
import { generateMigrationRecommendations } from './migrationGenerator'
import { extractContractSpec } from '../contractInvoker'

export type {
  ContractSpec,
  UpgradeAnalysisResult,
  UpgradeSummary,
  AnalysisOptions,
  DiffResult,
  ContractChange,
  CompatibilityScore,
  ImpactPrediction,
  MigrationRecommendation,
  ContractFunction,
  ContractParameter,
} from './types'

function buildSummary(
  diff: DiffResult,
  compatibilityScore: number,
  recommendationsCount: number
): UpgradeSummary {
  const criticalIssues = diff.changes.filter(c =>
    ['function-removed', 'function-renamed'].includes(c.kind) && c.category === 'breaking'
  ).length

  let status: UpgradeSummary['status']
  if (criticalIssues > 0 && compatibilityScore < 0.3) status = 'critical'
  else if (diff.breakingCount > 0 && compatibilityScore < 0.6) status = 'breaking'
  else if (diff.breakingCount > 0 || compatibilityScore < 0.9) status = 'caution'
  else status = 'safe'

  const statusTitles: Record<UpgradeSummary['status'], string> = {
    safe: 'Safe to Upgrade',
    caution: 'Review Recommended',
    breaking: 'Breaking Changes Detected',
    critical: 'Critical Breaking Changes',
  }

  const statusDescriptions: Record<UpgradeSummary['status'], string> = {
    safe: 'The new contract version is fully backward compatible',
    caution: 'Minor changes detected - review recommended before upgrading',
    breaking: 'Breaking changes detected - migration required for existing integrations',
    critical: 'Critical breaking changes detected - immediate migration planning needed',
  }

  return {
    status,
    title: statusTitles[status],
    description: statusDescriptions[status],
    breakingChanges: diff.breakingCount,
    nonBreakingChanges: diff.nonBreakingCount,
    recommendations: recommendationsCount,
    criticalIssues,
  }
}

export async function analyzeUpgradeImpact(
  oldSpec: ContractSpec | null,
  newSpec: ContractSpec,
  contractId: string = '',
  oldVersion: string = 'previous',
  newVersion: string = 'current',
  options: AnalysisOptions = {}
): Promise<UpgradeAnalysisResult> {
  const startTime = performance.now()

  const { changes, breakingCount, nonBreakingCount } = compareContractSpecs(
    oldSpec || { functions: [], errorTypes: [], customTypes: [] },
    newSpec,
    contractId,
    oldVersion,
    newVersion
  )

  const diff: DiffResult = {
    contractId,
    oldVersion,
    newVersion,
    changes,
    breakingCount,
    nonBreakingCount,
    totalChanges: changes.length,
    compatibilityScore: 0,
    analyzedAt: new Date().toISOString(),
  }

  const compatibility = computeCompatibilityScore(oldSpec, newSpec, changes)
  diff.compatibilityScore = compatibility.overall

  const impactPrediction = predictImpact(changes, diff, newSpec)

  const patterns = analyzeChangePatterns(changes)

  const migrationRecommendations = generateMigrationRecommendations(
    changes,
    oldSpec,
    newSpec,
    patterns,
    {
      includeExamples: options.includeMigrationExamples ?? true,
      maxRecommendations: options.maxRecommendations ?? 20,
    }
  )

  const summary = buildSummary(diff, compatibility.overall, migrationRecommendations.length)

  const analysisTime = Math.round(performance.now() - startTime)

  return {
    diff,
    compatibility,
    impactPrediction,
    migrationRecommendations,
    summary,
    analysisTime,
  }
}

export async function analyzeWasmUpgrade(
  oldWasm: Uint8Array | string,
  newWasm: Uint8Array | string,
  contractId: string = '',
  oldVersion: string = 'previous',
  newVersion: string = 'current',
  options: AnalysisOptions = {}
): Promise<{
  bytecodeDiff: ReturnType<typeof compareBytecode>
  upgradeAnalysis: UpgradeAnalysisResult | null
}> {
  const bytecodeDiff = compareBytecode(oldWasm, newWasm)
  let upgradeAnalysis: UpgradeAnalysisResult | null = null

  if (bytecodeDiff.checksumChanged) {
    try {
      const oldSpec = await extractContractSpec(oldWasm)
      const newSpec = await extractContractSpec(newWasm)

      if (oldSpec && newSpec) {
        upgradeAnalysis = await analyzeUpgradeImpact(
          oldSpec as unknown as ContractSpec,
          newSpec as unknown as ContractSpec,
          contractId,
          oldVersion,
          newVersion,
          options
        )
      }
    } catch {
      // Spec extraction failed, return bytecode comparison only
    }
  }

  return { bytecodeDiff, upgradeAnalysis }
}

async function extractContractSpec(wasm: Uint8Array | string): Promise<unknown> {
  try {
    if (typeof wasm === 'string' && wasm.length > 0) {
      const bytes = typeof wasm === 'string' ? new TextEncoder().encode(wasm) : wasm
      return { functions: [], errorTypes: [], customTypes: [] }
    }
    return null
  } catch {
    return null
  }
}

export function recordOutcome(
  contractId: string,
  oldVersion: string,
  newVersion: string,
  changes: number,
  breakingChanges: number,
  actualImpact: 'none' | 'low' | 'medium' | 'high' | 'critical'
) {
  recordUpgradeOutcome({
    contractId,
    oldVersion,
    newVersion,
    changes,
    breakingChanges,
    actualImpact,
  })
}

export { getUpgradeHistory, getModelAccuracy, trainOnUpgradeHistory, generateCompatibilityReport }
