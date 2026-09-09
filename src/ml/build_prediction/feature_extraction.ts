function safeNumber(v) {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

export function extractCodeChangeFeatures(change) {
  const filesAdded = safeNumber(change.filesAdded);
  const filesModified = safeNumber(change.filesModified);
  const filesDeleted = safeNumber(change.filesDeleted);
  const linesAdded = safeNumber(change.linesAdded);
  const linesDeleted = safeNumber(change.linesDeleted);
  const srcFilesChanged = safeNumber(change.srcFilesChanged);
  const configFilesChanged = safeNumber(change.configFilesChanged);
  const depFilesChanged = safeNumber(change.depFilesChanged);
  const testFilesChanged = safeNumber(change.testFilesChanged);
  const hasTypeChanges = change.hasTypeChanges ? 1 : 0;
  const hasBreakingChanges = change.hasBreakingChanges ? 1 : 0;
  const hasNewDeps = change.hasNewDeps ? 1 : 0;
  const hasDepUpgrades = change.hasDepUpgrades ? 1 : 0;
  const hasDepDowngrades = change.hasDepDowngrades ? 1 : 0;
  const commitCount = safeNumber(change.commitCount);
  const authorExperience = Math.min(1, safeNumber(change.authorExperience) / 100);

  return [
    Math.log1p(filesAdded || 0),
    Math.log1p(filesModified || 0),
    Math.log1p(filesDeleted || 0),
    Math.log1p(linesAdded),
    Math.log1p(linesDeleted),
    Math.log1p(srcFilesChanged),
    Math.log1p(configFilesChanged),
    Math.log1p(depFilesChanged),
    Math.log1p(testFilesChanged),
    hasTypeChanges,
    hasBreakingChanges,
    hasNewDeps,
    hasDepUpgrades,
    hasDepDowngrades,
    Math.log1p(commitCount),
    authorExperience,
  ];
}

export function extractDependencyFeatures(deps) {
  const totalDeps = safeNumber(deps.totalDeps);
  const newDeps = safeNumber(deps.newDeps);
  const upgradedDeps = safeNumber(deps.upgradedDeps);
  const downgradedDeps = safeNumber(deps.downgradedDeps);
  const removedDeps = safeNumber(deps.removedDeps);
  const majorUpgrades = safeNumber(deps.majorUpgrades);
  const minorUpgrades = safeNumber(deps.minorUpgrades);
  const patchUpgrades = safeNumber(deps.patchUpgrades);
  const hasPeerDepChanges = deps.hasPeerDepChanges ? 1 : 0;
  const hasEnginesChange = deps.hasEnginesChange ? 1 : 0;
  const depCount = safeNumber(deps.depCount);
  const avgDepAge = Math.min(1, safeNumber(deps.avgDepAge) / 365);

  return [
    Math.log1p(totalDeps),
    Math.log1p(newDeps),
    Math.log1p(upgradedDeps),
    Math.log1p(downgradedDeps),
    Math.log1p(removedDeps),
    Math.log1p(majorUpgrades),
    Math.log1p(minorUpgrades),
    Math.log1p(patchUpgrades),
    hasPeerDepChanges,
    hasEnginesChange,
    Math.log1p(depCount),
    avgDepAge,
  ];
}

export function extractBuildHistoryFeatures(history) {
  const totalBuilds = safeNumber(history.totalBuilds);
  const failedBuilds = safeNumber(history.failedBuilds);
  const successRate = totalBuilds > 0 ? failedBuilds / totalBuilds : 0;
  const recentFailures = safeNumber(history.recentFailures);
  const avgBuildDuration = Math.log1p(safeNumber(history.avgBuildDuration));
  const lastBuildDuration = Math.log1p(safeNumber(history.lastBuildDuration));
  const durationVariance = Math.log1p(safeNumber(history.durationVariance));
  const consecutiveFailures = safeNumber(history.consecutiveFailures);
  const lastBuildFailed = history.lastBuildFailed ? 1 : 0;
  const hasLintErrors = history.hasLintErrors ? 1 : 0;
  const hasTypeErrors = history.hasTypeErrors ? 1 : 0;
  const hasTestFailures = history.hasTestFailures ? 1 : 0;
  const bundleSizeChange = safeNumber(history.bundleSizeChange);
  const depCountChange = safeNumber(history.depCountChange);

  return [
    Math.log1p(totalBuilds),
    Math.log1p(failedBuilds),
    successRate,
    Math.log1p(recentFailures),
    Math.log1p(avgBuildDuration),
    Math.log1p(lastBuildDuration),
    Math.log1p(durationVariance),
    Math.log1p(consecutiveFailures),
    lastBuildFailed,
    hasLintErrors,
    hasTypeErrors,
    hasTestFailures,
    Math.log1p(bundleSizeChange),
    Math.log1p(depCountChange),
  ];
}

export function extractAllFeatures(change, deps, history) {
  return [
    ...extractCodeChangeFeatures(change),
    ...extractDependencyFeatures(deps),
    ...extractBuildHistoryFeatures(history),
  ];
}
