import type {
  ContractChange,
  ContractSpec,
  ImpactPrediction,
  RiskFactor,
  UpgradeHistoryEntry,
  DiffResult,
} from './types'

const HISTORY_KEY = 'stellar:dashboard:upgrade-history'

function loadUpgradeHistory(): UpgradeHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveUpgradeHistory(history: UpgradeHistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-100)))
  } catch {}
}

function computeBreakingProbability(changes: ContractChange[]): number {
  if (changes.length === 0) return 0
  const breakingCount = changes.filter(c => c.category === 'breaking').length
  const breakingRatio = breakingCount / changes.length

  const averageImpact = changes
    .filter(c => c.category === 'breaking')
    .reduce((acc, c) => acc + c.impactScore, 0) / Math.max(breakingCount, 1)

  const functionRemovals = changes.filter(c => c.kind === 'function-removed').length
  const signatureChanges = changes.filter(c =>
    ['parameter-removed', 'parameter-type-changed', 'return-type-changed'].includes(c.kind)
  ).length

  let probability = breakingRatio * 0.4 + averageImpact * 0.3

  if (functionRemovals > 0) probability += Math.min(functionRemovals * 0.15, 0.3)
  if (signatureChanges > 0) probability += Math.min(signatureChanges * 0.1, 0.2)

  return Math.min(1, Math.max(0, probability))
}

function computeOverallSeverity(
  probability: number,
  breakingCount: number,
  changes: ContractChange[]
): ImpactPrediction['overallSeverity'] {
  if (breakingCount === 0) return 'none'

  const hasCriticalChanges = changes.some(c => c.kind === 'function-removed' && c.category === 'breaking')

  if (hasCriticalChanges && probability > 0.7) return 'critical'
  if (breakingCount >= 5 || probability > 0.6) return 'high'
  if (breakingCount >= 2 || probability > 0.3) return 'medium'
  return 'low'
}

function estimateMigrationEffort(
  changes: ContractChange[],
  probability: number
): ImpactPrediction['migrationEffort'] {
  if (changes.length === 0) return 'trivial'

  const breakingChanges = changes.filter(c => c.category === 'breaking')
  const criticalChanges = changes.filter(c =>
    ['function-removed', 'function-renamed'].includes(c.kind)
  )

  if (criticalChanges.length > 2 || breakingChanges.length > 5 || probability > 0.8) return 'major'
  if (criticalChanges.length > 0 || breakingChanges.length > 2 || probability > 0.5) return 'significant'
  if (breakingChanges.length > 0 || probability > 0.2) return 'moderate'
  return 'trivial'
}

function estimateAffectedIntegrations(changes: ContractChange[], probability: number): number {
  const functionChanges = changes.filter(c => c.path[0] === 'functions')
  const uniqueFunctions = new Set(functionChanges.map(c => c.path[1]))
  const downstreamMultiplier = probability > 0.5 ? 3 : 1

  return Math.ceil(uniqueFunctions.size * downstreamMultiplier)
}

function estimateDownstreamFailures(changes: ContractChange[], probability: number): number {
  const breakingChanges = changes.filter(c => c.category === 'breaking')
  const weightedBreakingCount = breakingChanges.reduce((sum, c) => sum + c.impactScore, 0)
  return Math.ceil(weightedBreakingCount * probability * 2)
}

function generateRiskFactors(
  changes: ContractChange[],
  _spec: ContractSpec | null,
  probability: number
): RiskFactor[] {
  const factors: RiskFactor[] = []

  const removedFunctions = changes.filter(c => c.kind === 'function-removed')
  if (removedFunctions.length > 0) {
    factors.push({
      name: 'Function Removals',
      severity: removedFunctions.length > 2 ? 'high' : 'medium',
      description: `${removedFunctions.length} function(s) removed - existing callers will break`,
      mitigation: 'Identify all callers and update to use replacement functions or implement fallback logic',
    })
  }

  const paramChanges = changes.filter(c =>
    ['parameter-removed', 'parameter-type-changed', 'parameter-added'].includes(c.kind)
  )
  if (paramChanges.length > 0) {
    factors.push({
      name: 'Signature Changes',
      severity: paramChanges.length > 3 ? 'high' : 'medium',
      description: `${paramChanges.length} parameter change(s) detected`,
      mitigation: 'Update all function call sites to match new signatures',
    })
  }

  const renamedFunctions = changes.filter(c => c.kind === 'function-renamed')
  if (renamedFunctions.length > 0) {
    factors.push({
      name: 'Function Renames',
      severity: renamedFunctions.length > 1 ? 'high' : 'medium',
      description: `${renamedFunctions.length} function(s) renamed`,
      mitigation: 'Update function references and redeploy dependent contracts',
    })
  }

  const typeChanges = changes.filter(c =>
    ['custom-type-changed', 'custom-type-removed'].includes(c.kind)
  )
  if (typeChanges.length > 0) {
    factors.push({
      name: 'Type Definition Changes',
      severity: probability > 0.5 ? 'high' : 'medium',
      description: `${typeChanges.length} type definition change(s) detected`,
      mitigation: 'Update type serialization/deserialization in client code',
    })
  }

  const returnTypeChanges = changes.filter(c => c.kind === 'return-type-changed')
  if (returnTypeChanges.length > 0) {
    factors.push({
      name: 'Return Type Changes',
      severity: 'medium',
      description: `${returnTypeChanges.length} return type change(s) - may break callers that depend on return value format`,
      mitigation: 'Update return value handling code',
    })
  }

  if (probability > 0.6) {
    factors.push({
      name: 'High Breaking Probability',
      severity: 'high',
      description: `Breaking change probability of ${Math.round(probability * 100)}% suggests significant downstream impact`,
      mitigation: 'Consider phased rollout with integration testing',
    })
  }

  return factors
}

function findSimilarUpgrades(
  currentChanges: ContractChange[],
  history: UpgradeHistoryEntry[]
): { similarCount: number; avgImpact: number } {
  const currentKinds = new Set(currentChanges.map(c => c.kind))
  const currentBreakingCount = currentChanges.filter(c => c.category === 'breaking').length

  const similar = history.filter(entry => {
    const changeKindMatch = Math.abs(entry.changes - currentChanges.length) <= 2
    const breakingMatch = entry.breakingChanges === currentBreakingCount ||
                          Math.abs(entry.breakingChanges - currentBreakingCount) <= 1
    return changeKindMatch && breakingMatch
  })

  if (similar.length === 0) return { similarCount: 0, avgImpact: 0.3 }

  const impactValues: Record<string, number> = {
    none: 0,
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    critical: 1.0,
  }

  const avgImpact = similar.reduce((sum, e) => sum + (impactValues[e.actualImpact] || 0.5), 0) / similar.length
  return { similarCount: similar.length, avgImpact }
}

export function predictImpact(
  changes: ContractChange[],
  diff: DiffResult,
  spec: ContractSpec | null
): ImpactPrediction {
  const history = loadUpgradeHistory()
  const { similarCount, avgImpact } = findSimilarUpgrades(changes, history)
  const breakingProbability = computeBreakingProbability(changes)
  const mlProbability = similarCount > 0
    ? breakingProbability * 0.6 + avgImpact * 0.4
    : breakingProbability

  const adjustedProbability = similarCount > 2
    ? mlProbability
    : mlProbability * 0.8 + 0.2

  const factors = generateRiskFactors(changes, spec, adjustedProbability)

  const prediction: ImpactPrediction = {
    overallSeverity: computeOverallSeverity(adjustedProbability, diff.breakingCount, changes),
    breakingProbability: Math.round(adjustedProbability * 100) / 100,
    estimatedAffectedIntegrations: estimateAffectedIntegrations(changes, adjustedProbability),
    migrationEffort: estimateMigrationEffort(changes, adjustedProbability),
    riskFactors: factors,
    predictedDownstreamFailures: estimateDownstreamFailures(changes, adjustedProbability),
    confidence: similarCount > 0
      ? Math.min(0.95, 0.5 + similarCount * 0.05)
      : 0.6,
  }

  return prediction
}

export function recordUpgradeOutcome(entry: Omit<UpgradeHistoryEntry, 'timestamp'>) {
  const history = loadUpgradeHistory()
  history.push({ ...entry, timestamp: Date.now() })
  saveUpgradeHistory(history)
}

export function getUpgradeHistory(): UpgradeHistoryEntry[] {
  return loadUpgradeHistory()
}

export function getModelAccuracy(): {
  accuracy: number
  totalPredictions: number
  status: string
} {
  const history = loadUpgradeHistory()
  if (history.length < 3) {
    return { accuracy: 0, totalPredictions: history.length, status: 'learning' }
  }

  let correct = 0
  for (let i = 1; i < history.length; i++) {
    const entry = history[i]
    if (entry.actualImpact === 'none' && entry.breakingChanges === 0) correct++
    else if (entry.actualImpact !== 'none' && entry.breakingChanges > 0) correct++
  }

  const accuracy = history.length > 1 ? correct / (history.length - 1) : 0
  return {
    accuracy: Math.round(accuracy * 100),
    totalPredictions: history.length,
    status: accuracy >= 0.8 ? 'high' : accuracy >= 0.5 ? 'medium' : 'learning',
  }
}

export function trainOnUpgradeHistory(history: UpgradeHistoryEntry[]): {
  patterns: Record<string, number>
  threshold: number
  recommendationsCount: number
} {
  if (history.length < 2) {
    return { patterns: {}, threshold: 0.5, recommendationsCount: 0 }
  }

  const impactValues: Record<string, number> = {
    none: 0,
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    critical: 1.0,
  }

  const patterns: Record<string, number> = {}

  for (const entry of history) {
    if (entry.breakingChanges > 0) {
      const impact = impactValues[entry.actualImpact] || 0.5
      const ratio = entry.breakingChanges / Math.max(entry.changes, 1)

      patterns['breaking-ratio-' + Math.round(ratio * 10)] =
        (patterns['breaking-ratio-' + Math.round(ratio * 10)] || 0) + impact

      patterns['breaking-count-' + Math.min(entry.breakingChanges, 5)] =
        (patterns['breaking-count-' + Math.min(entry.breakingChanges, 5)] || 0) + impact
    }
  }

  const threshold = history.length > 5
    ? history.reduce((sum, e) => sum + (impactValues[e.actualImpact] || 0.3), 0) / history.length
    : 0.5

  return {
    patterns,
    threshold,
    recommendationsCount: history.length,
  }
}
