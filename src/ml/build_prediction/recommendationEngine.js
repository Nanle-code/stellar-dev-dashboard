import { extractCodeChangeFeatures, extractDependencyFeatures, extractBuildHistoryFeatures } from './feature_extraction.js';

export function generateRecommendations(change, deps, history) {
  const recommendations = [];
  const codeFeatures = extractCodeChangeFeatures(change);
  const depFeatures = extractDependencyFeatures(deps);
  const historyFeatures = extractBuildHistoryFeatures(history);

  const codeRecs = analyzeCodePatterns(change, codeFeatures);
  recommendations.push(...codeRecs);

  const depRecs = analyzeDependencyPatterns(deps, depFeatures);
  recommendations.push(...depRecs);

  const buildRecs = analyzeBuildPatterns(history, historyFeatures);
  recommendations.push(...buildRecs);

  const processRecs = analyzeProcessPatterns(change, history);
  recommendations.push(...processRecs);

  return {
    recommendations: sortByImpact(recommendations),
    summary: generateSummary(recommendations),
    criticalCount: recommendations.filter(r => r.priority === 'high').length,
    totalCount: recommendations.length,
  };
}

function analyzeCodePatterns(change, features) {
  const recs = [];

  if ((change.srcFilesChanged || 0) > 10) {
    recs.push({
      category: 'codeOrganization',
      priority: 'high',
      title: 'Reduce commit scope',
      description: `Commit modifies ${change.srcFilesChanged} source files. Smaller, focused commits are easier to review and less likely to cause build failures.`,
      action: 'Split this commit into logical units with no more than 5-10 source files each.',
      expectedImpact: 'Reduces build failure risk by approximately 40% for large changes.',
    });
  }

  const totalLines = (change.linesAdded || 0) + (change.linesDeleted || 0);
  if (totalLines > 500) {
    recs.push({
      category: 'codeQuality',
      priority: 'medium',
      title: 'Run lint before commit',
      description: `Large diffs (${totalLines} lines) often contain lint and formatting issues that cause build failures.`,
      action: 'Configure pre-commit hooks (husky/lint-staged) to automatically lint and format changed files.',
      expectedImpact: 'Catches 60% of common build errors before they reach CI.',
    });
  }

  if (change.hasTypeChanges && !change.testFilesChanged) {
    recs.push({
      category: 'testing',
      priority: 'high',
      title: 'Add tests for type changes',
      description: 'Type and interface changes can introduce breaking changes that manifest as build failures.',
      action: 'Write unit tests that exercise the modified types, including edge cases.',
      expectedImpact: 'Prevents 50% of type-related build failures.',
    });
  }

  return recs;
}

function analyzeDependencyPatterns(deps, features) {
  const recs = [];

  if ((deps.majorUpgrades || 0) > 0) {
    recs.push({
      category: 'dependencies',
      priority: 'high',
      title: 'Isolate major dependency upgrades',
      description: `Major version upgrades (${deps.majorUpgrades}) are the leading cause of build failures. They often include breaking API changes and peer dependency conflicts.`,
      action: 'Upgrade major versions in separate dedicated commits. Test thoroughly before merging.',
      expectedImpact: `Reduces build failures from dependency changes by 70%.`,
    });
  }

  if ((deps.newDeps || 0) > 3) {
    recs.push({
      category: 'dependencies',
      priority: 'medium',
      title: 'Audit new dependencies',
      description: `Adding ${deps.newDeps} new dependencies increases bundle size and potential for version conflicts.`,
      action: 'Evaluate if existing dependencies can fulfill the requirement. Check dependency size and security advisories.',
      expectedImpact: 'Prevents bundle size budget violations and dependency-related build issues.',
    });
  }

  if ((deps.totalDeps || 0) > 50) {
    recs.push({
      category: 'dependencies',
      priority: 'low',
      title: 'Review dependency tree',
      description: `Project has ${deps.totalDeps} dependencies. Large dependency trees increase build time and failure probability.`,
      action: 'Run `npm audit` and remove unused dependencies. Consider lazy-loading heavy libraries.',
      expectedImpact: 'Improves build time by 20-30% and reduces failure surface area.',
    });
  }

  return recs;
}

function analyzeBuildPatterns(history, features) {
  const recs = [];
  const totalBuilds = history.totalBuilds || 0;
  const failedBuilds = history.failedBuilds || 0;

  if (totalBuilds > 0) {
    const failureRate = failedBuilds / totalBuilds;
    if (failureRate > 0.15) {
      recs.push({
        category: 'ciConfiguration',
        priority: 'high',
        title: 'Investigate high build failure rate',
        description: `Build failure rate is ${(failureRate * 100).toFixed(0)}%, which is above the 15% threshold.`,
        action: 'Review recent CI logs to identify common failure patterns. Check for flaky tests, timeout issues, or resource constraints.',
        expectedImpact: 'Addressing systemic failures can reduce build failures by 50%.',
      });
    }
  }

  if ((history.consecutiveFailures || 0) > 1) {
    recs.push({
      category: 'buildStability',
      priority: 'high',
      title: 'Fix consecutive build failures',
      description: `${history.consecutiveFailures} consecutive builds have failed. Each failure increases the probability of subsequent failures.`,
      action: 'Pause merging until the root cause is identified and fixed. Run `npm run build` locally to verify.',
      expectedImpact: 'Prevents cascading failures that block the entire team.',
    });
  }

  if ((history.avgBuildDuration || 0) > 180) {
    recs.push({
      category: 'buildPerformance',
      priority: 'medium',
      title: 'Optimize build duration',
      description: `Average build duration is ${Math.round((history.avgBuildDuration || 0) / 60)} minutes. Long builds reduce developer productivity.`,
      action: 'Implement build caching, parallelize CI jobs, and consider using a faster build tool.',
      expectedImpact: 'Can reduce build time by 40-60% with proper caching and parallelization.',
    });
  }

  const bundleChange = history.bundleSizeChange || 0;
  if (bundleChange > 50) {
    recs.push({
      category: 'bundleSize',
      priority: 'medium',
      title: 'Review bundle size increase',
      description: `Bundle size increased by ${bundleChange} KB. Large bundles slow down page loads.`,
      action: 'Use bundle analyzer (`npm run build:analyze`) to identify large dependencies. Consider code splitting.',
      expectedImpact: 'Keeps bundle within budget and prevents CI bundle size check failures.',
    });
  }

  return recs;
}

function analyzeProcessPatterns(change, history) {
  const recs = [];

  if (change.commitCount > 5 && change.commitCount <= 20) {
    recs.push({
      category: 'process',
      priority: 'low',
      title: 'Reduce commits per push',
      description: `${change.commitCount} commits in this push. More commits means more changes to validate.`,
      action: 'Use interactive rebase to squash related commits before pushing.',
      expectedImpact: 'Makes code review more manageable and reduces CI pipeline congestion.',
    });
  }

  if ((history.hasLintErrors || history.hasTypeErrors || history.hasTestFailures) && change.commitCount > 1) {
    recs.push({
      category: 'process',
      priority: 'medium',
      title: 'Enable pre-commit validation',
      description: 'Previous builds have failed due to lint, type, or test issues that could have been caught locally.',
      action: 'Configure husky pre-commit hooks to run `npm run lint`, `npm run type-check`, and relevant tests before each commit.',
      expectedImpact: 'Prevents 80% of common build failures by catching issues before they reach CI.',
    });
  }

  return recs;
}

function sortByImpact(recommendations) {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return [...recommendations].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

function generateSummary(recommendations) {
  const high = recommendations.filter(r => r.priority === 'high').length;
  const medium = recommendations.filter(r => r.priority === 'medium').length;
  const low = recommendations.filter(r => r.priority === 'low').length;
  return `${high} critical, ${medium} suggested, ${low} optional improvements`;
}
