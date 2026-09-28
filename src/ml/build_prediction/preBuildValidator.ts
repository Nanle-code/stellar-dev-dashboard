import { scoreCommit } from './riskScorer.js';

export const VALIDATION_RULES = {
  dependencyPinning: { enabled: true, severity: 'warning' },
  bundleSizeBudget: { enabled: true, severity: 'error' },
  typeScriptStrictness: { enabled: true, severity: 'warning' },
  lintCompliance: { enabled: true, severity: 'error' },
  testCoverage: { enabled: true, severity: 'warning' },
  breakingChangeReview: { enabled: true, severity: 'error' },
};

export async function validateCommit(commitData) {
  const riskAssessment = await scoreCommit(commitData);
  const issues = [];
  const warnings = [];

  if (riskAssessment.riskLevel === 'critical') {
    issues.push({
      rule: 'riskThreshold',
      message: 'Commit risk score exceeds critical threshold. Manual review required before build.',
      severity: 'error',
      details: `Risk score: ${riskAssessment.riskScore}`,
    });
  }

  if (riskAssessment.riskLevel === 'high') {
    warnings.push({
      rule: 'riskThreshold',
      message: 'High risk commit. Consider splitting into smaller changes.',
      severity: 'warning',
      details: `Risk score: ${riskAssessment.riskScore}`,
    });
  }

  const { change, deps } = commitData;

  const depValidation = validateDependencies(deps);
  depValidation.errors.forEach(e => issues.push(e));
  depValidation.warnings.forEach(w => warnings.push(w));

  const changeValidation = validateCodeChanges(change);
  changeValidation.errors.forEach(e => issues.push(e));
  changeValidation.warnings.forEach(w => warnings.push(w));

  if (riskAssessment.mlPrediction) {
    warnings.push({
      rule: 'mlPrediction',
      message: 'ML model predicts potential build failure. Review changes carefully.',
      severity: 'warning',
      details: `Prediction confidence: ${(riskAssessment.riskScore * 100).toFixed(0)}%`,
    });
  }

  return {
    passed: issues.length === 0,
    canBuild: issues.filter(i => i.severity === 'error').length === 0,
    riskLevel: riskAssessment.riskLevel,
    riskScore: riskAssessment.riskScore,
    issues,
    warnings,
    topRisks: riskAssessment.topRisks,
    mlPrediction: riskAssessment.mlPrediction,
  };
}

function validateDependencies(deps) {
  const errors = [];
  const warnings = [];

  if ((deps.majorUpgrades || 0) > 3) {
    errors.push({
      rule: 'excessiveMajorUpgrades',
      message: `Too many major dependency upgrades (${deps.majorUpgrades}). Upgrade dependencies incrementally.`,
      severity: 'error',
    });
  }

  if ((deps.newDeps || 0) > 10) {
    warnings.push({
      rule: 'excessiveNewDeps',
      message: `Adding ${deps.newDeps} new dependencies increases build risk and maintenance burden.`,
      severity: 'warning',
    });
  }

  if (deps.hasEnginesChange) {
    warnings.push({
      rule: 'enginesChange',
      message: 'Node.js engine version requirement changed. Verify compatibility.',
      severity: 'warning',
    });
  }

  if (deps.hasPeerDepChanges) {
    warnings.push({
      rule: 'peerDepChange',
      message: 'Peer dependency changes may affect downstream consumers.',
      severity: 'warning',
    });
  }

  return { errors, warnings };
}

function validateCodeChanges(change) {
  const errors = [];
  const warnings = [];

  if ((change.srcFilesChanged || 0) > 30) {
    errors.push({
      rule: 'excessiveSrcChanges',
      message: `Modifying ${change.srcFilesChanged} source files in one commit makes review and build validation difficult.`,
      severity: 'error',
    });
  }

  if ((change.configFilesChanged || 0) > 5) {
    warnings.push({
      rule: 'configChanges',
      message: 'Multiple configuration files changed. Verify build configuration is consistent.',
      severity: 'warning',
    });
  }

  const totalLines = (change.linesAdded || 0) + (change.linesDeleted || 0);
  if (totalLines > 2000) {
    warnings.push({
      rule: 'largeDiff',
      message: `Large diff (${totalLines} lines). Consider breaking into smaller, focused commits.`,
      severity: 'warning',
    });
  }

  if (change.hasBreakingChanges) {
    errors.push({
      rule: 'breakingChanges',
      message: 'Breaking changes detected. Ensure migration path and documentation are provided.',
      severity: 'error',
    });
  }

  if (change.hasTypeChanges && !change.testFilesChanged) {
    warnings.push({
      rule: 'untestedTypeChanges',
      message: 'Type changes detected without corresponding test changes. Add tests for new types.',
      severity: 'warning',
    });
  }

  if (change.hasDepUpgrades && !change.testFilesChanged) {
    warnings.push({
      rule: 'untestedDepUpgrades',
      message: 'Dependency upgrades should be verified with corresponding test updates.',
      severity: 'warning',
    });
  }

  return { errors, warnings };
}
