import type {
  ABIDiffResult,
  BytecodeDiffResult,
  CompatibilityScore,
  ImpactPrediction,
  UpgradeRecord,
  ContractUpgradeHistory,
} from './types';

interface FeatureVector {
  removedFnCount: number;
  addedFnCount: number;
  modifiedFnCount: number;
  authChangedCount: number;
  mutabilityChangedCount: number;
  removedEventCount: number;
  addedEventCount: number;
  removedErrorCount: number;
  storageChangesCount: number;
  storageRemovedCount: number;
  bytecodeSimilarity: number;
  sizeChangeRatio: number;
  functionCompatScore: number;
  eventCompatScore: number;
  storageCompatScore: number;
  overallCompatScore: number;
  prevUpgradeCount: number;
  avgPrevImpactScore: number;
}

function extractFeatures(
  abiDiff: ABIDiffResult,
  bytecodeDiff: BytecodeDiffResult,
  compatScore: CompatibilityScore,
  history: ContractUpgradeHistory | null,
): FeatureVector {
  const prevUpgrades = history?.upgrades ?? [];
  const avgImpact =
    prevUpgrades.length > 0
      ? prevUpgrades.reduce((sum, u) => sum + u.impact.overallScore, 0) / prevUpgrades.length
      : 0;

  const sizeChangeRatio =
    bytecodeDiff.sizeChange.before > 0
      ? bytecodeDiff.sizeChange.after / bytecodeDiff.sizeChange.before
      : 1;

  return {
    removedFnCount: abiDiff.removedFunctions.length,
    addedFnCount: abiDiff.addedFunctions.length,
    modifiedFnCount: abiDiff.modifiedFunctions.length,
    authChangedCount: abiDiff.modifiedFunctions.filter((f) => f.authChanged).length,
    mutabilityChangedCount: abiDiff.modifiedFunctions.filter((f) => f.mutabilityChanged).length,
    removedEventCount: abiDiff.removedEvents.length,
    addedEventCount: abiDiff.addedEvents.length,
    removedErrorCount: abiDiff.removedErrors.length,
    storageChangesCount: abiDiff.storageChanges.length,
    storageRemovedCount: abiDiff.storageChanges.filter((s) => s.removed).length,
    bytecodeSimilarity: compatScore.bytecodeSimilarity / 100,
    sizeChangeRatio: Math.min(Math.max(sizeChangeRatio, 0.1), 5),
    functionCompatScore: compatScore.functionCompat / 100,
    eventCompatScore: compatScore.eventCompat / 100,
    storageCompatScore: compatScore.storageCompat / 100,
    overallCompatScore: compatScore.overall / 100,
    prevUpgradeCount: prevUpgrades.length,
    avgPrevImpactScore: avgImpact / 100,
  };
}

const BREAKING_THRESHOLD_WEIGHTS: Record<string, number> = {
  removedFnCount: 0.32,
  removedEventCount: 0.16,
  removedErrorCount: 0.08,
  storageRemovedCount: 0.24,
  authChangedCount: 0.10,
  mutabilityChangedCount: 0.07,
};

const INTEGRATION_WEIGHTS: Record<string, number> = {
  removedFnCount: 0.35,
  modifiedFnCount: 0.2,
  removedEventCount: 0.2,
  removedErrorCount: 0.05,
  storageChangesCount: 0.1,
  authChangedCount: 0.1,
};

function computeBreakingRisk(features: FeatureVector): number {
  let risk = 0;
  for (const [key, weight] of Object.entries(BREAKING_THRESHOLD_WEIGHTS)) {
    const val = features[key as keyof FeatureVector];
    if (typeof val === 'number') {
      risk += Math.min(val / 3, 1) * weight;
    }
  }

  risk += (1 - features.overallCompatScore) * 0.3;
  risk += (1 - features.bytecodeSimilarity) * 0.1;

  return Math.min(Math.max(risk, 0), 1);
}

function estimateAffectedIntegrations(features: FeatureVector): number {
  let estimate = 0;
  for (const [key, weight] of Object.entries(INTEGRATION_WEIGHTS)) {
    const val = features[key as keyof FeatureVector];
    if (typeof val === 'number') {
      estimate += val * weight;
    }
  }
  return Math.round(estimate * 100);
}

function estimateMigrationComplexity(features: FeatureVector): ImpactPrediction['estimatedMigrationComplexity'] {
  const score =
    features.removedFnCount * 3 +
    features.storageRemovedCount * 4 +
    features.authChangedCount * 2 +
    features.mutabilityChangedCount * 1 +
    features.removedEventCount * 1.5;

  if (score === 0) return 'minimal';
  if (score <= 5) return 'moderate';
  if (score <= 15) return 'significant';
  return 'extensive';
}

function estimateMigrationHours(
  complexity: ImpactPrediction['estimatedMigrationComplexity'],
  features: FeatureVector,
): number {
  const baseHours: Record<string, number> = {
    minimal: 0.5,
    moderate: 2,
    significant: 8,
    extensive: 24,
  };

  let hours = baseHours[complexity];
  hours += features.removedFnCount * 1.5;
  hours += features.storageRemovedCount * 3;
  hours += features.authChangedCount * 0.5;

  return Math.round(hours * 10) / 10;
}

function matchHistoricalPattern(
  currentFeatures: FeatureVector,
  history: ContractUpgradeHistory,
): string | undefined {
  if (history.upgrades.length === 0) return undefined;

  let bestMatch: UpgradeRecord | null = null;
  let bestScore = Infinity;

  for (const upgrade of history.upgrades) {
    const changes = upgrade.changes;
    const removedFns = changes.filter((c) => c.category === 'function-removed').length;
    const removedEvents = changes.filter((c) => c.category === 'event-removed').length;

    const distance =
      Math.abs(removedFns - currentFeatures.removedFnCount) +
      Math.abs(removedEvents - currentFeatures.removedEventCount) +
      Math.abs(upgrade.impact.overallScore - currentFeatures.overallCompatScore * 100) / 50;

    if (distance < bestScore) {
      bestScore = distance;
      bestMatch = upgrade;
    }
  }

  if (bestScore < 3 && bestMatch) {
    return `Similar to upgrade from v${bestMatch.fromVersion} to v${bestMatch.toVersion}`;
  }

  return undefined;
}

function determineRiskLevel(risk: number): ImpactPrediction['overallRisk'] {
  if (risk < 0.2) return 'low';
  if (risk < 0.5) return 'medium';
  if (risk < 0.75) return 'high';
  return 'critical';
}

function determineAffectedUsers(
  risk: number,
  features: FeatureVector,
  _prevUpgradeCount: number,
): number {
  const base = risk * 500;
  const multiplier = 1 + features.prevUpgradeCount * 0.1;
  return Math.round(base * multiplier);
}

export function predictImpact(
  abiDiff: ABIDiffResult,
  bytecodeDiff: BytecodeDiffResult,
  compatScore: CompatibilityScore,
  history: ContractUpgradeHistory | null,
): ImpactPrediction {
  const features = extractFeatures(abiDiff, bytecodeDiff, compatScore, history);

  const breakingRisk = computeBreakingRisk(features);
  const overallRisk = determineRiskLevel(breakingRisk);
  const complexity = estimateMigrationComplexity(features);
  const migrationHours = estimateMigrationHours(complexity, features);
  const affectedIntegrations = estimateAffectedIntegrations(features);
  const affectedUsers = determineAffectedUsers(breakingRisk, features, features.prevUpgradeCount);

  const featuresAffected: string[] = [];
  if (features.removedFnCount > 0) featuresAffected.push('Function callers');
  if (features.removedEventCount > 0) featuresAffected.push('Event indexers');
  if (features.storageRemovedCount > 0) featuresAffected.push('Persistent storage readers');
  if (features.authChangedCount > 0) featuresAffected.push('Authorization flows');
  if (features.mutabilityChangedCount > 0) featuresAffected.push('View/pure callers');

  const confidenceScore = Math.round(
    (0.7 + Math.min(features.prevUpgradeCount, 10) * 0.03) * 100,
  ) / 100;

  return {
    overallRisk,
    confidenceScore: Math.min(confidenceScore, 0.99),
    affectedUserEstimate: affectedUsers,
    affectedIntegrationsEstimate: affectedIntegrations,
    estimatedMigrationComplexity: complexity,
    estimatedMigrationTimeHours: migrationHours,
    featuresAffected,
    dataMigrationRequired: features.removedEventCount > 0 || features.storageRemovedCount > 0,
    storageMigrationRequired: features.storageRemovedCount > 0 || features.storageChangesCount > 0,
    rollbackFeasible: breakingRisk < 0.7 && features.storageRemovedCount === 0,
    historicalPatternMatch: history
      ? matchHistoricalPattern(features, history)
      : undefined,
  };
}
