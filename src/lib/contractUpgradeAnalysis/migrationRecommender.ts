import type {
  ABIDiffResult,
  ImpactPrediction,
  MigrationRecommendation,
  MigrationStep,
  CompatibilityScore,
} from './types';

function buildMigrationSteps(
  abiDiff: ABIDiffResult,
  impact: ImpactPrediction,
): MigrationStep[] {
  const steps: MigrationStep[] = [];
  let order = 1;

  if (impact.storageMigrationRequired) {
    const removedSlots = abiDiff.storageChanges.filter((s) => s.removed);
    const typeChanges = abiDiff.storageChanges.filter((s) => s.type);

    steps.push({
      order: order++,
      title: 'Storage migration',
      description:
        `Migrate persistent storage for ${removedSlots.length} removed slot(s) and ${typeChanges.length} type-changed slot(s). ` +
        'Deploy a temporary migration contract to read old data and rewrite it in the new layout.',
      estimatedTimeMinutes: Math.max(removedSlots.length * 15, 30),
      complexity: 'complex',
      required: true,
      codeExample: `// Migration contract
#[contractimpl]
impl MigrationContract {
    pub fn migrate(env: Env, source: Address, dest: Address) {
        // Read old storage keys
        // Write to new layout
        // Verify data integrity
    }
}`,
    });
  }

  for (const fn of abiDiff.removedFunctions) {
    steps.push({
      order: order++,
      title: `Update callers of "${fn.name}"`,
      description:
        `All direct invocations of "${fn.name}" must be removed or replaced. ` +
        `Signature: ${fn.name}(${fn.inputs.map((p) => p.type).join(', ')})`,
      estimatedTimeMinutes: 15,
      complexity: 'moderate',
      required: true,
    });
  }

  for (const diff of abiDiff.modifiedFunctions) {
    const typeChanges = diff.inputChanges.filter((c) => c.type);
    if (typeChanges.length > 0) {
      steps.push({
        order: order++,
        title: `Update call sites for "${diff.name}"`,
        description:
          `Parameter types changed in "${diff.name}". Update all call sites to pass the new types.`,
        estimatedTimeMinutes: 10,
        complexity: 'moderate',
        required: true,
      });
    }

    if (diff.authChanged) {
      steps.push({
        order: order++,
        title: `Update auth for "${diff.name}"`,
        description:
          diff.after.authRequired
            ? `Auth requirement added to "${diff.name}". Ensure callers authorize via the correct signer.`
            : `Auth requirement removed from "${diff.name}". Review whether callers unnecessarily set auth.`,
        estimatedTimeMinutes: 10,
        complexity: 'simple',
        required: true,
      });
    }
  }

  if (impact.featuresAffected.includes('Event indexers')) {
    steps.push({
      order: order++,
      title: 'Update event indexers',
      description:
        'Update off-chain indexers, analytics pipelines, and event watchers to handle removed/changed events.',
      estimatedTimeMinutes: 30,
      complexity: 'moderate',
      required: true,
    });
  }

  if (abiDiff.breakingChanges.length > 0) {
    steps.push({
      order: order++,
      title: 'Update SDK/client wrappers',
      description:
        'Update any SDK wrappers, TypeScript bindings, or client libraries that reference the old contract interface.',
      estimatedTimeMinutes: 20,
      complexity: 'moderate',
      required: true,
    });
  }

  steps.push({
    order: order++,
    title: 'Test all integration paths',
    description:
      'Run comprehensive integration tests covering all updated call sites and migration paths.',
    estimatedTimeMinutes: 20,
    complexity: 'moderate',
    required: true,
  });

  return steps;
}

function buildPreMigrationChecks(
  abiDiff: ABIDiffResult,
  impact: ImpactPrediction,
): string[] {
  const checks: string[] = [
    'Back up all current contract state and storage',
    'Verify the new WASM artifact compiles and passes audit',
    'Ensure rollback contract is available if rollbackFeasible is true',
  ];

  if (impact.storageMigrationRequired) {
    checks.push('Validate storage migration script on a fork of testnet state');
    checks.push('Snapshot all current storage slots for comparison');
  }

  if (impact.affectedIntegrationsEstimate > 0) {
    checks.push(
      `Notify ${impact.affectedIntegrationsEstimate} potentially affected integrations`,
    );
  }

  if (abiDiff.removedFunctions.length > 0) {
    checks.push(
      `Verify no active transaction submissions reference: ${abiDiff.removedFunctions.map((f) => f.name).join(', ')}`,
    );
  }

  return checks;
}

function buildPostMigrationValidation(
  abiDiff: ABIDiffResult,
  impact: ImpactPrediction,
): string[] {
  const checks: string[] = [
    'Verify all new functions are callable and return expected types',
    'Confirm no transaction simulation failures on updated call sites',
  ];

  if (impact.storageMigrationRequired) {
    checks.push('Compare old and new storage snapshots to confirm data integrity');
    checks.push('Run historical state queries to verify backward-compatible reads');
  }

  if (abiDiff.addedEvents.length > 0) {
    checks.push('Emit test events for each new event and verify indexer picks them up');
  }

  if (abiDiff.removedFunctions.length > 0) {
    checks.push(
      'Confirm that all known callers no longer attempt removed function calls',
    );
  }

  return checks;
}

function buildRollbackPlan(impact: ImpactPrediction): string {
  if (!impact.rollbackFeasible) {
    return 'Rollback is NOT feasible due to storage layout changes. ' +
      'A forward-fix patch must be prepared. Consider deploying the upgrade behind a feature flag or proxy contract.';
  }

  return (
    'Rollback plan:\n' +
    '1. Re-deploy the previous contract version to a new contract address.\n' +
    '2. Migrate any state that was written to the upgraded contract back to the old layout.\n' +
    '3. Update all callers to point at the old contract address.\n' +
    '4. Verify all integration paths work with the rolled-back version.\n' +
    '5. Monitor for 24 hours to ensure stability.'
  );
}

function buildRiskMitigationTips(impact: ImpactPrediction): string[] {
  const tips: string[] = [];

  if (impact.overallRisk === 'critical') {
    tips.push('Consider phased rollout — upgrade testnet contracts first, then staging, then mainnet');
    tips.push('Implement a pause mechanism to halt all contract interactions during migration');
  }

  if (impact.estimatedMigrationComplexity === 'extensive') {
    tips.push('Break the migration into multiple smaller, independently-deployable upgrades');
    tips.push('Engage a third-party auditor for the migration plan');
  }

  if (impact.dataMigrationRequired) {
    tips.push('Use a dual-write pattern during migration: write to both old and new layouts');
  }

  tips.push('Monitor all contract interactions for the first 48 hours post-upgrade');
  tips.push('Keep the rollback contract deployable for at least 7 days');

  return tips;
}

export function generateMigrationRecommendation(
  abiDiff: ABIDiffResult,
  impact: ImpactPrediction,
  _compatScore: CompatibilityScore,
): MigrationRecommendation {
  const migrationSteps = buildMigrationSteps(abiDiff, impact);
  const totalTime = migrationSteps.reduce((sum, s) => sum + s.estimatedTimeMinutes, 0);

  const overallStrategy =
    impact.overallRisk === 'critical'
      ? 'CRITICAL: This upgrade contains severe breaking changes. Execute a phased rollout with extensive testing. ' +
        'Consider splitting into multiple smaller upgrades.'
      : impact.overallRisk === 'high'
        ? 'High-risk upgrade. Deploy to testnet first, validate all integrations, then proceed to mainnet with a rollback plan.'
        : impact.overallRisk === 'medium'
          ? 'Moderate upgrade. Update all known callers, run integration tests, and deploy with monitoring.'
          : 'Low-risk upgrade. Standard deployment with post-upgrade validation is sufficient.';

  return {
    overallStrategy,
    migrationSteps,
    preMigrationChecks: buildPreMigrationChecks(abiDiff, impact),
    postMigrationValidation: buildPostMigrationValidation(abiDiff, impact),
    rollbackPlan: buildRollbackPlan(impact),
    estimatedTotalTimeMinutes: totalTime,
    riskMitigationTips: buildRiskMitigationTips(impact),
  };
}
