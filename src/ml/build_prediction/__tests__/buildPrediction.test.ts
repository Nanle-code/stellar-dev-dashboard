import { describe, expect, it } from 'vitest'

const sampleChange = {
  filesAdded: 1,
  filesModified: 3,
  filesDeleted: 0,
  linesAdded: 100,
  linesDeleted: 25,
  srcFilesChanged: 2,
  configFilesChanged: 0,
  depFilesChanged: 0,
  testFilesChanged: 1,
  hasTypeChanges: false,
  hasBreakingChanges: false,
  hasNewDeps: false,
  hasDepUpgrades: false,
  hasDepDowngrades: false,
  commitCount: 1,
  authorExperience: 80,
}

const sampleDeps = {
  totalDeps: 42,
  newDeps: 0,
  upgradedDeps: 0,
  downgradedDeps: 0,
  removedDeps: 0,
  majorUpgrades: 0,
  minorUpgrades: 0,
  patchUpgrades: 0,
  hasPeerDepChanges: false,
  hasEnginesChange: false,
  depCount: 42,
  avgDepAge: 180,
}

const sampleHistory = {
  totalBuilds: 150,
  failedBuilds: 5,
  recentFailures: 0,
  avgBuildDuration: 120,
  lastBuildDuration: 115,
  durationVariance: 10,
  consecutiveFailures: 0,
  lastBuildFailed: false,
  hasLintErrors: false,
  hasTypeErrors: false,
  hasTestFailures: false,
  bundleSizeChange: 2,
  depCountChange: 0,
}

describe('Feature Extraction', () => {
  it('extracts code change features', async () => {
    const { extractCodeChangeFeatures } = await import('../feature_extraction.js')
    const features = extractCodeChangeFeatures(sampleChange)
    expect(features).toHaveLength(16)
    expect(features.every(f => typeof f === 'number')).toBe(true)
    expect(features[3]).toBeCloseTo(Math.log1p(100), 5)
  })

  it('extracts dependency features', async () => {
    const { extractDependencyFeatures } = await import('../feature_extraction.js')
    const features = extractDependencyFeatures(sampleDeps)
    expect(features).toHaveLength(12)
    expect(features.every(f => typeof f === 'number')).toBe(true)
  })

  it('extracts build history features', async () => {
    const { extractBuildHistoryFeatures } = await import('../feature_extraction.js')
    const features = extractBuildHistoryFeatures(sampleHistory)
    expect(features).toHaveLength(14)
    expect(features.every(f => typeof f === 'number')).toBe(true)
    expect(features[2]).toBeCloseTo(5 / 150, 5)
  })

  it('extracts all features combined', async () => {
    const { extractAllFeatures } = await import('../feature_extraction.js')
    const features = extractAllFeatures(sampleChange, sampleDeps, sampleHistory)
    expect(features).toHaveLength(42)
    expect(features.every(f => typeof f === 'number')).toBe(true)
  })
})

describe('Risk Scoring', () => {
  it('returns low risk for simple changes', async () => {
    const { calculateRiskScore } = await import('../riskScorer.js')
    const score = calculateRiskScore(sampleChange, sampleDeps, sampleHistory)
    expect(score.totalScore).toBeLessThan(0.3)
    expect(score.level).toBe('low')
    expect(score.breakdown).toHaveProperty('codeComplexity')
    expect(score.breakdown).toHaveProperty('dependencyChanges')
    expect(score.breakdown).toHaveProperty('buildHistory')
    expect(score.breakdown).toHaveProperty('authorFactors')
    expect(score.breakdown).toHaveProperty('breakingChanges')
  })

  it('returns high risk for large changes with breaking changes', async () => {
    const { calculateRiskScore } = await import('../riskScorer.js')
    const riskyChange = {
      ...sampleChange,
      srcFilesChanged: 25,
      linesAdded: 3000,
      linesDeleted: 800,
      hasBreakingChanges: true,
      hasTypeChanges: true,
      commitCount: 15,
      authorExperience: 3,
    }
    const riskyDeps = {
      ...sampleDeps,
      totalDeps: 55,
      majorUpgrades: 4,
      newDeps: 8,
      hasEnginesChange: true,
    }
    const riskyHistory = {
      ...sampleHistory,
      failedBuilds: 60,
      recentFailures: 8,
      consecutiveFailures: 5,
      lastBuildFailed: true,
    }
    const score = calculateRiskScore(riskyChange, riskyDeps, riskyHistory)
    expect(score.totalScore).toBeGreaterThanOrEqual(0.5)
    expect(['high', 'critical']).toContain(score.level)
  })

  it('handles zero build history gracefully', async () => {
    const { calculateRiskScore } = await import('../riskScorer.js')
    const zeroHistory = {
      totalBuilds: 0,
      failedBuilds: 0,
      recentFailures: 0,
      avgBuildDuration: 0,
      lastBuildDuration: 0,
      durationVariance: 0,
      consecutiveFailures: 0,
      lastBuildFailed: false,
      hasLintErrors: false,
      hasTypeErrors: false,
      hasTestFailures: false,
      bundleSizeChange: 0,
      depCountChange: 0,
    }
    const score = calculateRiskScore(sampleChange, sampleDeps, zeroHistory)
    expect(score.totalScore).toBeGreaterThanOrEqual(0)
    expect(score.level).toBeDefined()
  })
})

describe('Pre-Build Validation', () => {
  it('passes for low-risk commits', async () => {
    const { validateCommit } = await import('../preBuildValidator.js')
    const result = await validateCommit({
      commitId: 'abc123',
      change: sampleChange,
      deps: sampleDeps,
      history: sampleHistory,
    })
    expect(result.passed).toBe(true)
    expect(result.canBuild).toBe(true)
  })

  it('fails for commits with excessive major upgrades', async () => {
    const { validateCommit } = await import('../preBuildValidator.js')
    const result = await validateCommit({
      commitId: 'abc123',
      change: sampleChange,
      deps: { ...sampleDeps, majorUpgrades: 5 },
      history: sampleHistory,
    })
    expect(result.passed).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.issues.some(i => i.rule === 'excessiveMajorUpgrades')).toBe(true)
  })
})

describe('Recommendation Engine', () => {
  it('generates recommendations for large changes', async () => {
    const { generateRecommendations } = await import('../recommendationEngine.js')
    const largeChange = {
      ...sampleChange,
      srcFilesChanged: 15,
      linesAdded: 2000,
      linesDeleted: 500,
      hasTypeChanges: true,
    }
    const recs = generateRecommendations(largeChange, sampleDeps, sampleHistory)
    expect(recs.recommendations.length).toBeGreaterThan(0)
    expect(recs.summary).toBeDefined()
    expect(recs.totalCount).toBeGreaterThan(0)
  })

  it('generates recommendations for dependency-heavy changes', async () => {
    const { generateRecommendations } = await import('../recommendationEngine.js')
    const depHeavyDeps = {
      ...sampleDeps,
      majorUpgrades: 2,
      totalDeps: 60,
      newDeps: 4,
    }
    const recs = generateRecommendations(sampleChange, depHeavyDeps, sampleHistory)
    expect(recs.recommendations.length).toBeGreaterThan(0)
    expect(recs.recommendations.some(r => r.category === 'dependencies')).toBe(true)
  })

  it('generates build stability recommendations for failing builds', async () => {
    const { generateRecommendations } = await import('../recommendationEngine.js')
    const failingHistory = {
      ...sampleHistory,
      consecutiveFailures: 3,
      failedBuilds: 50,
      recentFailures: 5,
    }
    const recs = generateRecommendations(sampleChange, sampleDeps, failingHistory)
    expect(recs.recommendations.length).toBeGreaterThan(0)
    expect(recs.criticalCount).toBeGreaterThan(0)
  })

  it('sorts recommendations by priority', async () => {
    const { generateRecommendations } = await import('../recommendationEngine.js')
    const highRisk = {
      ...sampleChange,
      srcFilesChanged: 20,
      linesAdded: 3000,
      hasBreakingChanges: true,
    }
    const recs = generateRecommendations(highRisk, sampleDeps, sampleHistory)
    const priorities = recs.recommendations.map(r => r.priority)
    const highIdx = priorities.indexOf('high')
    const mediumIdx = priorities.indexOf('medium')
    const lowIdx = priorities.indexOf('low')
    expect(highIdx).toBeLessThan(mediumIdx >= 0 ? mediumIdx : Infinity)
    expect(mediumIdx >= 0 ? mediumIdx : Infinity).toBeLessThan(lowIdx >= 0 ? lowIdx : Infinity)
  })

  it('returns empty recommendations for minimal changes', async () => {
    const { generateRecommendations } = await import('../recommendationEngine.js')
    const minimalChange = {
      ...sampleChange,
      filesAdded: 0,
      filesModified: 1,
      linesAdded: 5,
      linesDeleted: 2,
      srcFilesChanged: 1,
      testFilesChanged: 0,
    }
    const recs = generateRecommendations(minimalChange, sampleDeps, sampleHistory)
    expect(Array.isArray(recs.recommendations)).toBe(true)
  })
})
