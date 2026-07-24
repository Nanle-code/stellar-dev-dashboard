import type {
  ContractSpec,
  ContractUpgradeHistory,
  UpgradeAnalysisResult,
} from './types';
import { analyzeABIDiff } from './abiDiffAnalyzer';
import { analyzeBytecodeDiff } from './bytecodeDiffAnalyzer';
import { computeCompatibilityScore } from './compatibilityScorer';
import { predictImpact } from './impactPredictor';
import { generateMigrationRecommendation } from './migrationRecommender';

const ANALYSIS_TIMEOUT_MS = 30_000;

export async function analyzeUpgrade(
  beforeSpec: ContractSpec,
  afterSpec: ContractSpec,
  beforeBytecode: Uint8Array,
  afterBytecode: Uint8Array,
  history: ContractUpgradeHistory | null = null,
): Promise<UpgradeAnalysisResult> {
  const startTime = performance.now();

  const abiDiff = analyzeABIDiff(beforeSpec, afterSpec);

  const bytecodeDiff = analyzeBytecodeDiff(beforeBytecode, afterBytecode);

  const compatibilityScore = computeCompatibilityScore(abiDiff, bytecodeDiff);

  const impactPrediction = predictImpact(abiDiff, bytecodeDiff, compatibilityScore, history);

  const migrationRecommendation = generateMigrationRecommendation(
    abiDiff,
    impactPrediction,
    compatibilityScore,
  );

  const elapsed = performance.now() - startTime;

  if (elapsed > ANALYSIS_TIMEOUT_MS) {
    console.warn(
      `Upgrade analysis took ${Math.round(elapsed)}ms, exceeding ${ANALYSIS_TIMEOUT_MS}ms target`,
    );
  }

  return {
    contractId: beforeSpec.contractId,
    fromVersion: beforeSpec.metadata.version,
    toVersion: afterSpec.metadata.version,
    abiDiff,
    bytecodeDiff,
    compatibilityScore,
    impactPrediction,
    migrationRecommendation,
    analysisTimestamp: Date.now(),
    analysisDurationMs: Math.round(elapsed),
  };
}

export { analyzeABIDiff } from './abiDiffAnalyzer';
export { analyzeBytecodeDiff } from './bytecodeDiffAnalyzer';
export { computeCompatibilityScore } from './compatibilityScorer';
export { predictImpact } from './impactPredictor';
export { generateMigrationRecommendation } from './migrationRecommender';
export type * from './types';
