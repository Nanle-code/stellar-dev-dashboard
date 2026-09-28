import { predictBuildFailure } from './buildPredictor.js';

const RISK_WEIGHTS = {
  codeComplexity: 0.20,
  dependencyChanges: 0.25,
  buildHistory: 0.30,
  authorFactors: 0.15,
  breakingChanges: 0.10,
};

function scoreCodeComplexity(change) {
  let score = 0;
  const srcFiles = change.srcFilesChanged || 0;
  const linesAdded = change.linesAdded || 0;
  const linesDeleted = change.linesDeleted || 0;

  if (srcFiles > 20) score += 1.0;
  else if (srcFiles > 10) score += 0.7;
  else if (srcFiles > 5) score += 0.4;
  else if (srcFiles > 0) score += 0.1;

  const totalLines = linesAdded + linesDeleted;
  if (totalLines > 1000) score += 1.0;
  else if (totalLines > 500) score += 0.7;
  else if (totalLines > 100) score += 0.4;
  else if (totalLines > 0) score += 0.1;

  return Math.min(1, score / 2);
}

function scoreDependencyChanges(deps) {
  let score = 0;
  const majorUpgrades = deps.majorUpgrades || 0;
  const newDeps = deps.newDeps || 0;
  const removedDeps = deps.removedDeps || 0;

  if (majorUpgrades > 3) score += 1.0;
  else if (majorUpgrades > 1) score += 0.7;
  else if (majorUpgrades > 0) score += 0.4;

  if (newDeps > 5) score += 1.0;
  else if (newDeps > 2) score += 0.5;
  else if (newDeps > 0) score += 0.2;

  if (removedDeps > 3) score += 0.5;
  else if (removedDeps > 0) score += 0.2;

  if (deps.hasPeerDepChanges) score += 0.5;
  if (deps.hasEnginesChange) score += 0.5;

  return Math.min(1, score / 3);
}

function scoreBuildHistory(history) {
  let score = 0;
  const totalBuilds = history.totalBuilds || 0;
  const failedBuilds = history.failedBuilds || 0;
  const recentFailures = history.recentFailures || 0;
  const consecutiveFailures = history.consecutiveFailures || 0;

  if (totalBuilds > 0) {
    const failureRate = failedBuilds / totalBuilds;
    if (failureRate > 0.3) score += 1.0;
    else if (failureRate > 0.15) score += 0.6;
    else if (failureRate > 0.05) score += 0.3;
  }

  if (recentFailures > 3) score += 1.0;
  else if (recentFailures > 1) score += 0.5;
  else if (recentFailures > 0) score += 0.2;

  if (consecutiveFailures > 2) score += 1.0;
  else if (consecutiveFailures > 0) score += 0.5;

  if (history.lastBuildFailed) score += 0.5;
  if (history.hasLintErrors) score += 0.3;
  if (history.hasTypeErrors) score += 0.4;
  if (history.hasTestFailures) score += 0.4;

  return Math.min(1, score / 4);
}

function scoreAuthorFactors(change) {
  let score = 0;
  const experience = change.authorExperience || 0;
  const commitCount = change.commitCount || 0;

  if (experience < 5) score += 0.6;
  else if (experience < 20) score += 0.3;

  if (commitCount > 20) score += 0.2;
  else if (commitCount > 10) score += 0.4;
  else if (commitCount > 0) score += 0.6;

  return Math.min(1, score);
}

function scoreBreakingChanges(change) {
  let score = 0;
  if (change.hasBreakingChanges) score += 1.0;
  if (change.hasTypeChanges) score += 0.3;
  if (change.hasNewDeps) score += 0.3;
  if (change.hasDepUpgrades) score += 0.2;
  return Math.min(1, score);
}

export function calculateRiskScore(change, deps, history) {
  const codeComplexity = scoreCodeComplexity(change);
  const dependencyChanges = scoreDependencyChanges(deps);
  const buildHistory = scoreBuildHistory(history);
  const authorFactors = scoreAuthorFactors(change);
  const breakingChanges = scoreBreakingChanges(change);

  const weighted = {
    codeComplexity: codeComplexity * RISK_WEIGHTS.codeComplexity,
    dependencyChanges: dependencyChanges * RISK_WEIGHTS.dependencyChanges,
    buildHistory: buildHistory * RISK_WEIGHTS.buildHistory,
    authorFactors: authorFactors * RISK_WEIGHTS.authorFactors,
    breakingChanges: breakingChanges * RISK_WEIGHTS.breakingChanges,
  };

  const totalScore = Object.values(weighted).reduce((a, b) => a + b, 0);

  let level;
  if (totalScore >= 0.7) level = 'critical';
  else if (totalScore >= 0.5) level = 'high';
  else if (totalScore >= 0.3) level = 'medium';
  else level = 'low';

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    level,
    breakdown: {
      codeComplexity,
      dependencyChanges,
      buildHistory,
      authorFactors,
      breakingChanges,
    },
    weighted,
  };
}

export async function scoreCommit(commitData) {
  const { change, deps, history } = commitData;
  const heuristic = calculateRiskScore(change, deps, history);
  let prediction = { score: 0, isFailurePredicted: false };

  try {
    prediction = await predictBuildFailure(change, deps, history);
  } catch {
    // ML model not available, use heuristic only
  }

  const finalScore = prediction.isFailurePredicted
    ? Math.max(heuristic.totalScore, prediction.score)
    : heuristic.totalScore;

  const finalLevel =
    finalScore >= 0.7
      ? 'critical'
      : finalScore >= 0.5
        ? 'high'
        : finalScore >= 0.3
          ? 'medium'
          : 'low';

  return {
    commitId: commitData.commitId,
    riskScore: Math.round(finalScore * 100) / 100,
    riskLevel: finalLevel,
    mlPrediction: prediction.isFailurePredicted,
    heuristicScore: heuristic.totalScore,
    breakdown: heuristic.breakdown,
    topRisks: identifyTopRisks(heuristic),
  };
}

function identifyTopRisks(heuristic) {
  const risks = [];
  if (heuristic.breakdown.codeComplexity > 0.5)
    risks.push({ factor: 'codeComplexity', severity: heuristic.breakdown.codeComplexity, message: 'Large number of file changes increases build risk' });
  if (heuristic.breakdown.dependencyChanges > 0.5)
    risks.push({ factor: 'dependencyChanges', severity: heuristic.breakdown.dependencyChanges, message: 'Significant dependency changes may introduce incompatibilities' });
  if (heuristic.breakdown.buildHistory > 0.5)
    risks.push({ factor: 'buildHistory', severity: heuristic.breakdown.buildHistory, message: 'Recent build failures suggest instability' });
  if (heuristic.breakdown.authorFactors > 0.5)
    risks.push({ factor: 'authorFactors', severity: heuristic.breakdown.authorFactors, message: 'Author has limited experience or large commit batch' });
  if (heuristic.breakdown.breakingChanges > 0.5)
    risks.push({ factor: 'breakingChanges', severity: heuristic.breakdown.breakingChanges, message: 'Breaking changes detected that may affect the build' });
  return risks;
}
