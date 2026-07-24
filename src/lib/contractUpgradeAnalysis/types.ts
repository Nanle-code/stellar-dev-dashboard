export type ChangeSeverity = 'breaking' | 'deprecation' | 'non-breaking' | 'additive';

export type ChangeCategory =
  | 'function-removed'
  | 'function-added'
  | 'function-signature-changed'
  | 'parameter-type-changed'
  | 'parameter-added'
  | 'parameter-removed'
  | 'return-type-changed'
  | 'event-removed'
  | 'event-added'
  | 'event-signature-changed'
  | 'storage-layout-changed'
  | 'error-removed'
  | 'error-added'
  | 'interface-removed'
  | 'interface-added'
  | 'behavior-changed';

export interface ContractSpec {
  specVersion: string;
  contractId: string;
  functions: ContractFunction[];
  events: ContractEvent[];
  errors: ContractError[];
  storageSlots: StorageSlot[];
  metadata: ContractMetadata;
}

export interface ContractFunction {
  name: string;
  inputs: ContractParam[];
  outputs: ContractParam[];
  mutability: 'pure' | 'view' | 'stateful';
  authRequired: boolean;
  docs?: string;
}

export interface ContractParam {
  name: string;
  type: string;
  components?: ContractParam[];
  indexed?: boolean;
}

export interface ContractEvent {
  name: string;
  params: ContractParam[];
  docs?: string;
}

export interface ContractError {
  name: string;
  code: number;
  message?: string;
}

export interface StorageSlot {
  name: string;
  type: string;
  persistent: boolean;
}

export interface ContractMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
}

export interface ContractUpgradeHistory {
  contractId: string;
  upgrades: UpgradeRecord[];
}

export interface UpgradeRecord {
  fromVersion: string;
  toVersion: string;
  timestamp: number;
  changes: ChangeRecord[];
  impact: UpgradeImpact;
  rollbackAvailable: boolean;
}

export interface ChangeRecord {
  category: ChangeCategory;
  severity: ChangeSeverity;
  description: string;
  affectedFunction?: string;
  affectedParam?: string;
}

export interface UpgradeImpact {
  overallScore: number;
  breakingChanges: number;
  affectedIntegrations: number;
  estimatedMigrationTime: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ABIDiffResult {
  addedFunctions: ContractFunction[];
  removedFunctions: ContractFunction[];
  modifiedFunctions: FunctionDiff[];
  addedEvents: ContractEvent[];
  removedEvents: ContractEvent[];
  modifiedEvents: EventDiff[];
  addedErrors: ContractError[];
  removedErrors: ContractError[];
  storageChanges: StorageDiff[];
  breakingChanges: ChangeRecord[];
  nonBreakingChanges: ChangeRecord[];
  deprecations: ChangeRecord[];
}

export interface FunctionDiff {
  name: string;
  before: ContractFunction;
  after: ContractFunction;
  inputChanges: ParamDiff[];
  outputChanges: ParamDiff[];
  mutabilityChanged: boolean;
  authChanged: boolean;
}

export interface ParamDiff {
  paramName: string;
  type?: { before: string; after: string };
  added?: boolean;
  removed?: boolean;
  reordered?: boolean;
}

export interface EventDiff {
  name: string;
  before: ContractEvent;
  after: ContractEvent;
  paramChanges: ParamDiff[];
}

export interface StorageDiff {
  slot: string;
  type?: { before: string; after: string };
  added?: boolean;
  removed?: boolean;
  persistentChanged?: boolean;
}

export interface BytecodeDiffResult {
  totalBytesChanged: number;
  sizeChange: { before: number; after: number };
  similarityScore: number;
  sectionDiffs: SectionDiff[];
}

export interface SectionDiff {
  sectionName: string;
  bytesChanged: number;
  percentageChanged: number;
}

export interface CompatibilityScore {
  overall: number;
  functionCompat: number;
  eventCompat: number;
  storageCompat: number;
  errorCompat: number;
  bytecodeSimilarity: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  details: CompatibilityDetail[];
}

export interface CompatibilityDetail {
  area: string;
  score: number;
  message: string;
  severity: ChangeSeverity;
}

export interface ImpactPrediction {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  confidenceScore: number;
  affectedUserEstimate: number;
  affectedIntegrationsEstimate: number;
  estimatedMigrationComplexity: 'minimal' | 'moderate' | 'significant' | 'extensive';
  estimatedMigrationTimeHours: number;
  featuresAffected: string[];
  dataMigrationRequired: boolean;
  storageMigrationRequired: boolean;
  rollbackFeasible: boolean;
  historicalPatternMatch?: string;
}

export interface MigrationStep {
  order: number;
  title: string;
  description: string;
  estimatedTimeMinutes: number;
  complexity: 'simple' | 'moderate' | 'complex';
  required: boolean;
  codeExample?: string;
}

export interface MigrationRecommendation {
  overallStrategy: string;
  migrationSteps: MigrationStep[];
  preMigrationChecks: string[];
  postMigrationValidation: string[];
  rollbackPlan: string;
  estimatedTotalTimeMinutes: number;
  riskMitigationTips: string[];
}

export interface UpgradeAnalysisResult {
  contractId: string;
  fromVersion: string;
  toVersion: string;
  abiDiff: ABIDiffResult;
  bytecodeDiff: BytecodeDiffResult;
  compatibilityScore: CompatibilityScore;
  impactPrediction: ImpactPrediction;
  migrationRecommendation: MigrationRecommendation;
  analysisTimestamp: number;
  analysisDurationMs: number;
}
