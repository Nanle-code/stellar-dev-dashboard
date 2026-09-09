export interface ContractFunction {
  name: string
  doc: string
  summary: string
  parameters: ContractParameter[]
  returnType: string
  returnTypes: string[]
  signature: string
}

export interface ContractParameter {
  name: string
  type: string
  description: string
  required: boolean
}

export interface ContractSpec {
  functions: ContractFunction[]
  errorTypes: ContractError[]
  customTypes: ContractCustomType[]
}

export interface ContractError {
  code: number
  name: string
  description: string
}

export interface ContractCustomType {
  name: string
  description: string
  summary: string
}

export type ChangeCategory = 'breaking' | 'non-breaking' | 'unknown'

export type ChangeKind =
  | 'function-removed'
  | 'function-added'
  | 'parameter-removed'
  | 'parameter-added'
  | 'parameter-type-changed'
  | 'parameter-required-changed'
  | 'return-type-changed'
  | 'function-renamed'
  | 'error-added'
  | 'error-removed'
  | 'error-code-changed'
  | 'custom-type-removed'
  | 'custom-type-added'
  | 'custom-type-changed'

export interface ContractChange {
  kind: ChangeKind
  category: ChangeCategory
  description: string
  detail: string
  path: string[]
  oldValue?: unknown
  newValue?: unknown
  confidence: number
  impactScore: number
}

export interface DiffResult {
  contractId: string
  oldVersion: string
  newVersion: string
  changes: ContractChange[]
  breakingCount: number
  nonBreakingCount: number
  totalChanges: number
  compatibilityScore: number
  analyzedAt: string
}

export interface CompatibilityScore {
  overall: number
  apiCompatibility: number
  storageCompatibility: number
  behavioralCompatibility: number
  integrationImpact: number
  breakdown: CompatibilityBreakdown[]
}

export interface CompatibilityBreakdown {
  area: string
  score: number
  weight: number
  details: string[]
}

export interface MigrationRecommendation {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  category: string
  title: string
  description: string
  affectedUsers: string
  effort: string
  complexity: string
  codeExample?: string
  migrationSteps: string[]
  riskLevel: 'high' | 'medium' | 'low'
  estimatedAffectedRate: number
}

export interface ImpactPrediction {
  overallSeverity: 'critical' | 'high' | 'medium' | 'low' | 'none'
  breakingProbability: number
  estimatedAffectedIntegrations: number
  migrationEffort: 'trivial' | 'moderate' | 'significant' | 'major'
  riskFactors: RiskFactor[]
  predictedDownstreamFailures: number
  confidence: number
}

export interface RiskFactor {
  name: string
  severity: 'high' | 'medium' | 'low'
  description: string
  mitigation: string
}

export interface UpgradeAnalysisResult {
  diff: DiffResult
  compatibility: CompatibilityScore
  impactPrediction: ImpactPrediction
  migrationRecommendations: MigrationRecommendation[]
  summary: UpgradeSummary
  analysisTime: number
}

export interface UpgradeSummary {
  status: 'safe' | 'caution' | 'breaking' | 'critical'
  title: string
  description: string
  breakingChanges: number
  nonBreakingChanges: number
  recommendations: number
  criticalIssues: number
}

export interface UpgradeHistoryEntry {
  contractId: string
  oldVersion: string
  newVersion: string
  changes: number
  breakingChanges: number
  actualImpact: 'none' | 'low' | 'medium' | 'high' | 'critical'
  timestamp: number
}

export interface AnalysisOptions {
  includeMigrationExamples?: boolean
  includeRiskFactors?: boolean
  maxRecommendations?: number
  timeThreshold?: number
}
