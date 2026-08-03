/**
 * Unit tests for releasePlanning.ts (#605)
 */
import { describe, it, expect } from 'vitest'
import {
  extractComplexityFeatures,
  estimateComplexity,
  initComplexityModel,
  trainComplexityModel,
  buildDependencyGraph,
  findCriticalPath,
  calculateCapacity,
  validateSprintCapacity,
  generateReleasePlan,
  batchEstimateComplexity,
  simulateWhatIf,
} from '../releasePlanning'
import type {
  IssueMetadata,
  DependencyEdge,
  TeamMember,
  SprintConfig,
  IssueLabel,
} from '../releasePlanning'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeIssue(overrides: Partial<IssueMetadata> = {}): IssueMetadata {
  return {
    id: Math.random().toString(36).slice(2, 10),
    title: 'Test Issue',
    description: 'A test issue for release planning.',
    labels: ['feature'] as IssueLabel[],
    priority: 'medium',
    status: 'open',
    commentCount: 2,
    linkedPRCount: 1,
    fileChangeCount: 5,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

function makeEdge(
  from: string,
  to: string,
  type: DependencyEdge['type'] = 'blocks',
  strength = 0.8
): DependencyEdge {
  return { from, to, type, strength }
}

function makeTeamMember(
  overrides: Partial<TeamMember> = {}
): TeamMember {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: 'Test Developer',
    role: 'developer',
    weeklyCapacity: 40,
    velocityFactor: 1.0,
    skills: ['typescript', 'react'],
    ...overrides,
  }
}

function makeSprintConfig(
  overrides: Partial<SprintConfig> = {}
): SprintConfig {
  return {
    sprintLengthWeeks: 2,
    bufferFactor: 0.85,
    maxParallelWork: 3,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// extractComplexityFeatures
// ---------------------------------------------------------------------------
describe('extractComplexityFeatures', () => {
  it('returns exactly 8 features', () => {
    const issue = makeIssue()
    const features = extractComplexityFeatures(issue)
    expect(features).toHaveLength(8)
  })

  it('maps critical priority to higher feature value', () => {
    const low = makeIssue({ priority: 'low' })
    const critical = makeIssue({ priority: 'critical' })
    const lowFeat = extractComplexityFeatures(low)
    const critFeat = extractComplexityFeatures(critical)
    expect(critFeat[1]).toBeGreaterThan(lowFeat[1])
  })

  it('handles empty labels gracefully', () => {
    const issue = makeIssue({ labels: [] })
    const features = extractComplexityFeatures(issue)
    expect(features[0]).toBe(2) // default unknown score
  })

  it('handles missing description', () => {
    const issue = makeIssue({ description: '' })
    const features = extractComplexityFeatures(issue)
    expect(features[2]).toBe(0) // log1p(0) = 0
  })

  it('computes age as normalized feature', () => {
    const issue = makeIssue({
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
    })
    const features = extractComplexityFeatures(issue)
    expect(features[6]).toBeGreaterThan(0)
    expect(features[6]).toBeLessThanOrEqual(1)
  })

  it('returns 0 for hasAssignee when no assignee', () => {
    const issue = makeIssue({ assignee: undefined })
    const features = extractComplexityFeatures(issue)
    expect(features[7]).toBe(0)
  })

  it('returns 1 for hasAssignee when assignee exists', () => {
    const issue = makeIssue({ assignee: 'dev1' })
    const features = extractComplexityFeatures(issue)
    expect(features[7]).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// estimateComplexity
// ---------------------------------------------------------------------------
describe('estimateComplexity', () => {
  it('returns a complexity estimate for a typical issue', async () => {
    const issue = makeIssue()
    const result = await estimateComplexity(issue)

    expect(result.storyPoints).toBeGreaterThanOrEqual(1)
    expect(result.storyPoints).toBeLessThanOrEqual(21)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.features).toHaveLength(8)
    expect(result.explanation).toBeTruthy()
    expect(typeof result.explanation).toBe('string')
  })

  it('assigns higher story points to more complex issues', async () => {
    const simple = makeIssue({
      labels: ['documentation'],
      priority: 'low',
      commentCount: 0,
      linkedPRCount: 0,
      fileChangeCount: 1,
      description: 'Small fix',
    })
    const complex = makeIssue({
      labels: ['security', 'bug'],
      priority: 'critical',
      commentCount: 15,
      linkedPRCount: 5,
      fileChangeCount: 50,
      description:
        'Complex security vulnerability spanning multiple modules ' +
        'with significant architecture changes required. ' +
        'Needs coordination across multiple teams.',
    })

    const simpleEst = await estimateComplexity(simple)
    const complexEst = await estimateComplexity(complex)

    expect(complexEst.storyPoints).toBeGreaterThanOrEqual(
      simpleEst.storyPoints
    )
  })

  it('returns fibonacci-like story points', async () => {
    const validPoints = new Set([1, 2, 3, 5, 8, 13, 21])
    const issue = makeIssue()
    const result = await estimateComplexity(issue)
    expect(validPoints.has(result.storyPoints)).toBe(true)
  })

  it('handles issue with all default values', async () => {
    const empty = makeIssue({
      labels: [],
      priority: 'medium',
      description: '',
      commentCount: 0,
      linkedPRCount: 0,
      fileChangeCount: 0,
    })
    const result = await estimateComplexity(empty)
    expect(result.storyPoints).toBeGreaterThanOrEqual(1)
    expect(result.confidence).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// initComplexityModel & trainComplexityModel
// ---------------------------------------------------------------------------
describe('initComplexityModel', () => {
  it('creates a valid TFJS model', async () => {
    const model = await initComplexityModel()
    expect(model).toBeDefined()
    expect(model.inputs).toHaveLength(1)
  })

  it('returns the same model on repeated calls', async () => {
    const model1 = await initComplexityModel()
    const model2 = await initComplexityModel()
    expect(model1).toBe(model2)
  })
})

describe('trainComplexityModel', () => {
  it('trains on a small dataset without errors', async () => {
    const issues = Array.from({ length: 20 }, () => makeIssue())
    const labels = Array.from({ length: 20 }, () =>
      [1, 2, 3, 5, 8][Math.floor(Math.random() * 5)]
    )

    const result = await trainComplexityModel(issues, labels)
    expect(result.mae).toBeDefined()
    expect(result.loss).toBeDefined()
    expect(typeof result.mae).toBe('number')
    expect(typeof result.loss).toBe('number')
  })

  it('handles empty dataset gracefully', async () => {
    const result = await trainComplexityModel([], [])
    expect(result.mae).toBe(0)
    expect(result.loss).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// buildDependencyGraph
// ---------------------------------------------------------------------------
describe('buildDependencyGraph', () => {
  it('builds graph for a single issue with no edges', () => {
    const issue = makeIssue()
    const deps = buildDependencyGraph([issue], [])
    expect(deps.issues.size).toBe(1)
    expect(deps.edges).toEqual([])
    expect(deps.topologicalOrder).toEqual([issue.id])
    expect(deps.depthMap.get(issue.id)).toBe(0)
    expect(deps.dependentsCount.get(issue.id)).toBe(0)
  })

  it('builds correct topological order for linear dependency chain', () => {
    const issues = [
      makeIssue({ id: 'A' }),
      makeIssue({ id: 'B' }),
      makeIssue({ id: 'C' }),
    ]
    const edges = [
      makeEdge('A', 'B'),
      makeEdge('B', 'C'),
    ]

    const deps = buildDependencyGraph(issues, edges)
    expect(deps.topologicalOrder).toEqual(['A', 'B', 'C'])
    expect(deps.depthMap.get('A')).toBe(0)
    expect(deps.depthMap.get('B')).toBe(1)
    expect(deps.depthMap.get('C')).toBe(2)
  })

  it('handles diamond dependency pattern', () => {
    const issues = [
      makeIssue({ id: 'A' }),
      makeIssue({ id: 'B' }),
      makeIssue({ id: 'C' }),
      makeIssue({ id: 'D' }),
    ]
    const edges = [
      makeEdge('A', 'B'),
      makeEdge('A', 'C'),
      makeEdge('B', 'D'),
      makeEdge('C', 'D'),
    ]

    const deps = buildDependencyGraph(issues, edges)
    expect(deps.topologicalOrder).toContain('A')
    expect(deps.topologicalOrder).toContain('D')
    // A must come before B and C; B and C before D
    const aIdx = deps.topologicalOrder.indexOf('A')
    const bIdx = deps.topologicalOrder.indexOf('B')
    const cIdx = deps.topologicalOrder.indexOf('C')
    const dIdx = deps.topologicalOrder.indexOf('D')

    expect(aIdx).toBeLessThan(bIdx)
    expect(aIdx).toBeLessThan(cIdx)
    expect(bIdx).toBeLessThan(dIdx)
    expect(cIdx).toBeLessThan(dIdx)
  })

  it('handles empty input', () => {
    const deps = buildDependencyGraph([], [])
    expect(deps.issues.size).toBe(0)
    expect(deps.topologicalOrder).toEqual([])
    expect(deps.edges).toEqual([])
  })

  it('computes dependents count correctly', () => {
    const issues = [
      makeIssue({ id: 'A' }),
      makeIssue({ id: 'B' }),
      makeIssue({ id: 'C' }),
    ]
    const edges = [
      makeEdge('A', 'C'),
      makeEdge('B', 'C'),
    ]

    const deps = buildDependencyGraph(issues, edges)
    expect(deps.dependentsCount.get('A')).toBe(0)
    expect(deps.dependentsCount.get('B')).toBe(0)
    expect(deps.dependentsCount.get('C')).toBe(2)
  })

  it('sorts roots by priority when there are no dependencies', () => {
    const issues = [
      makeIssue({ id: 'low-prio', priority: 'low' }),
      makeIssue({ id: 'high-prio', priority: 'high' }),
      makeIssue({ id: 'crit-prio', priority: 'critical' }),
    ]

    const deps = buildDependencyGraph(issues, [])
    // Critical priorities should come first
    expect(deps.topologicalOrder[0]).toBe('crit-prio')
  })

  it('detects cycles and excludes them from topological order', () => {
    const issues = [
      makeIssue({ id: 'A' }),
      makeIssue({ id: 'B' }),
      makeIssue({ id: 'C' }),
    ]
    // A -> B -> C -> A (cycle)
    const edges = [
      makeEdge('A', 'B'),
      makeEdge('B', 'C'),
      makeEdge('C', 'A'),
    ]

    const deps = buildDependencyGraph(issues, edges)
    expect(deps.cycleNodes.length).toBeGreaterThan(0)
    // Cyclic nodes should not be in topological order
    for (const node of deps.cycleNodes) {
      expect(deps.topologicalOrder).not.toContain(node)
    }
    // Cycle nodes should have depth -1
    for (const node of deps.cycleNodes) {
      expect(deps.depthMap.get(node)).toBe(-1)
    }
  })

  it('returns empty cycleNodes for acyclic graphs', () => {
    const issues = [
      makeIssue({ id: 'A' }),
      makeIssue({ id: 'B' }),
    ]
    const edges = [makeEdge('A', 'B')]
    const deps = buildDependencyGraph(issues, edges)
    expect(deps.cycleNodes).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// findCriticalPath
// ---------------------------------------------------------------------------
describe('findCriticalPath', () => {
  it('returns empty for empty graph', () => {
    const deps = buildDependencyGraph([], [])
    expect(findCriticalPath(deps)).toEqual([])
  })

  it('finds critical path through deepest dependency chain', () => {
    const issues = [
      makeIssue({ id: 'A' }),
      makeIssue({ id: 'B' }),
      makeIssue({ id: 'C' }),
      makeIssue({ id: 'D' }),
    ]
    // A -> B -> C -> D (depth 3)
    const edges = [
      makeEdge('A', 'B'),
      makeEdge('B', 'C'),
      makeEdge('C', 'D'),
    ]

    const deps = buildDependencyGraph(issues, edges)
    const path = findCriticalPath(deps)
    expect(path).toEqual(['A', 'B', 'C', 'D'])
  })

  it('picks highest priority for single-node graph', () => {
    const issues = [
      makeIssue({ id: 'low', priority: 'low' }),
      makeIssue({ id: 'critical', priority: 'critical' }),
    ]
    const deps = buildDependencyGraph(issues, [])
    const path = findCriticalPath(deps)
    expect(path).toEqual(['critical'])
  })
})

// ---------------------------------------------------------------------------
// calculateCapacity
// ---------------------------------------------------------------------------
describe('calculateCapacity', () => {
  it('calculates capacity for a basic team', () => {
    const team = [
      makeTeamMember({ weeklyCapacity: 40, velocityFactor: 1.0 }),
      makeTeamMember({ weeklyCapacity: 30, velocityFactor: 0.9 }),
    ]
    const config = makeSprintConfig()

    const capacity = calculateCapacity(team, config)

    expect(capacity.totalWeeklyCapacity).toBe(70)
    expect(capacity.adjustedWeeklyCapacity).toBe(59.5) // 70 * 0.85
    expect(capacity.sprintCapacity).toBeGreaterThan(0)
    expect(capacity.memberAllocations).toHaveLength(2)
    expect(capacity.explanation).toBeTruthy()
  })

  it('handles empty team', () => {
    const capacity = calculateCapacity([], makeSprintConfig())
    expect(capacity.totalWeeklyCapacity).toBe(0)
    expect(capacity.sprintCapacity).toBe(0)
  })

  it('adjusts capacity with buffer factor', () => {
    const team = [makeTeamMember({ weeklyCapacity: 40 })]
    const strict = makeSprintConfig({ bufferFactor: 0.5 })
    const relaxed = makeSprintConfig({ bufferFactor: 1.0 })

    const strictCapacity = calculateCapacity(team, strict)
    const relaxedCapacity = calculateCapacity(team, relaxed)

    expect(strictCapacity.sprintCapacity).toBeLessThan(
      relaxedCapacity.sprintCapacity
    )
  })

  it('classifies risk level correctly', () => {
    const largeTeam = Array.from({ length: 10 }, () =>
      makeTeamMember({ weeklyCapacity: 40 })
    )
    const capacity = calculateCapacity(largeTeam, makeSprintConfig())
    expect(capacity.riskLevel).toBe('high')
  })
})

// ---------------------------------------------------------------------------
// validateSprintCapacity
// ---------------------------------------------------------------------------
describe('validateSprintCapacity', () => {
  it('confirms issues fit within capacity', () => {
    const issues = [makeIssue({ complexity: { storyPoints: 5, confidence: 0.9, features: [], explanation: 'test' } })]
    const team = [makeTeamMember({ weeklyCapacity: 40 })]
    const config = makeSprintConfig()
    const capacity = calculateCapacity(team, config)
    const deps = buildDependencyGraph(issues, [])

    const validation = validateSprintCapacity(issues, capacity, deps)
    expect(validation.fits).toBe(true)
    expect(validation.blockedIssues).toEqual([])
  })

  it('detects over-capacity sprint', () => {
    const issues = Array.from({ length: 100 }, () =>
      makeIssue({ complexity: { storyPoints: 13, confidence: 0.8, features: [], explanation: 'test' } })
    )
    const team = [makeTeamMember({ weeklyCapacity: 10 })]
    const capacity = calculateCapacity(team, makeSprintConfig())
    const deps = buildDependencyGraph(issues, [])

    const validation = validateSprintCapacity(issues, capacity, deps)
    expect(validation.fits).toBe(false)
    expect(validation.remainingCapacity).toBeLessThan(0)
  })

  it('detects blocked issues from missing dependencies', () => {
    const issueA = makeIssue({ id: 'A' })
    const issueB = makeIssue({ id: 'B' })
    const edges = [makeEdge('A', 'B', 'blocks')]

    // Only include B in the sprint, not A
    const deps = buildDependencyGraph([issueA, issueB], edges)
    const team = [makeTeamMember({ weeklyCapacity: 40 })]
    const capacity = calculateCapacity(team, makeSprintConfig())
    // A is not included but B is
    const validation = validateSprintCapacity([issueB], capacity, deps)
    expect(validation.fits).toBe(false)
    expect(validation.blockedIssues).toContain('B')
  })
})

// ---------------------------------------------------------------------------
// generateReleasePlan
// ---------------------------------------------------------------------------
describe('generateReleasePlan', () => {
  it('generates a plan for a simple set of issues', async () => {
    const issues = Array.from({ length: 5 }, (_, i) =>
      makeIssue({ id: `issue-${i}` })
    )
    const team = [
      makeTeamMember({ weeklyCapacity: 40 }),
      makeTeamMember({ weeklyCapacity: 40 }),
    ]
    const config = makeSprintConfig()

    const plan = await generateReleasePlan(issues, [], team, config)

    expect(plan.releaseGroups.length).toBeGreaterThan(0)
    expect(plan.schedule.totalReleases).toBeGreaterThan(0)
    expect(plan.schedule.totalStoryPoints).toBeGreaterThan(0)
    expect(plan.schedule.confidence).toBeGreaterThan(0)
    expect(plan.schedule.confidence).toBeLessThanOrEqual(1)
    expect(plan.explanation).toBeTruthy()
    expect(typeof plan.explanation).toBe('string')
  })

  it('respects dependency ordering in releases', async () => {
    const issues = [
      makeIssue({ id: 'A' }),
      makeIssue({ id: 'B' }),
      makeIssue({ id: 'C' }),
    ]
    // A blocks B blocks C
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')]
    const team = [
      makeTeamMember({ weeklyCapacity: 40 }),
    ]
    const config = makeSprintConfig({ sprintLengthWeeks: 1 })

    const plan = await generateReleasePlan(issues, edges, team, config)

    // Verify that dependencies are respected: A should be in same or earlier release than B
    const aRelease = plan.releaseGroups.findIndex((r) => r.issueIds.includes('A'))
    const bRelease = plan.releaseGroups.findIndex((r) => r.issueIds.includes('B'))
    const cRelease = plan.releaseGroups.findIndex((r) => r.issueIds.includes('C'))

    // All should be found
    expect(aRelease).toBeGreaterThanOrEqual(0)
    expect(bRelease).toBeGreaterThanOrEqual(0)
    expect(cRelease).toBeGreaterThanOrEqual(0)

    // Order should be consistent with dependencies
    expect(aRelease).toBeLessThanOrEqual(bRelease)
    expect(bRelease).toBeLessThanOrEqual(cRelease)
  })

  it('generates risks when capacity is exceeded', async () => {
    // Create complex issues that will exceed small team capacity
    const issues = Array.from({ length: 30 }, (_, i) =>
      makeIssue({
        id: `issue-${i}`,
        priority: 'critical',
        labels: ['security', 'bug'],
        commentCount: 20,
        linkedPRCount: 5,
        fileChangeCount: 30,
        description: 'Complex security vulnerability spanning multiple modules with architecture changes needed across the system.',
        assignee: 'dev1',
      })
    )
    // Single developer with minimal capacity
    const team = [makeTeamMember({ weeklyCapacity: 10 })]
    const config = makeSprintConfig({ bufferFactor: 1.0 })

    const plan = await generateReleasePlan(issues, [], team, config)

    expect(plan.risks.length).toBeGreaterThan(0)
  })

  it('handles empty input gracefully', async () => {
    const plan = await generateReleasePlan([], [], [], makeSprintConfig())
    expect(plan.releaseGroups).toEqual([])
    expect(plan.schedule.totalReleases).toBe(0)
    expect(plan.risks).toEqual([])
  })

  it('includes critical path in schedule', async () => {
    const issues = [
      makeIssue({ id: 'A' }),
      makeIssue({ id: 'B' }),
    ]
    const edges = [makeEdge('A', 'B')]
    const team = [makeTeamMember({ weeklyCapacity: 40 })]

    const plan = await generateReleasePlan(issues, edges, team, makeSprintConfig())
    expect(plan.schedule.criticalPath.length).toBeGreaterThan(0)
  })

  it('generates explainable recommendations', async () => {
    const issues = [
      makeIssue({
        id: 'feat-1',
        labels: ['feature', 'enhancement'],
        priority: 'high',
      }),
    ]
    const team = [makeTeamMember({ weeklyCapacity: 40 })]

    const plan = await generateReleasePlan(issues, [], team, makeSprintConfig())

    // Explanation should contain key information
    expect(plan.explanation).toContain('release')
    expect(plan.explanation).toContain('capacity')
    expect(plan.explanation).toContain('confidence')
  })
})

// ---------------------------------------------------------------------------
// batchEstimateComplexity
// ---------------------------------------------------------------------------
describe('batchEstimateComplexity', () => {
  it('estimates complexity for all issues in a batch', async () => {
    const issues = Array.from({ length: 5 }, () => makeIssue())
    const results = await batchEstimateComplexity(issues)

    expect(results).toHaveLength(5)
    for (const result of results) {
      expect(result.complexity).toBeDefined()
      expect(result.complexity!.storyPoints).toBeGreaterThanOrEqual(1)
      expect(result.complexity!.confidence).toBeGreaterThan(0)
    }
  })

  it('handles empty array', async () => {
    const results = await batchEstimateComplexity([])
    expect(results).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// simulateWhatIf
// ---------------------------------------------------------------------------
describe('simulateWhatIf', () => {
  it('computes what-if scenario with added team members', async () => {
    const issues = Array.from({ length: 10 }, (_, i) =>
      makeIssue({ id: `issue-${i}` })
    )
    const team = [makeTeamMember({ weeklyCapacity: 20 })]
    const config = makeSprintConfig()

    const basePlan = await generateReleasePlan(issues, [], team, config)

    const scenario = {
      name: 'Add 2 developers',
      addedTeamMembers: [
        makeTeamMember({ weeklyCapacity: 40 }),
        makeTeamMember({ weeklyCapacity: 40 }),
      ],
    }

    const result = await simulateWhatIf(
      basePlan,
      scenario,
      issues,
      [],
      team,
      config
    )

    expect(result.originalReleases).toBeGreaterThan(0)
    expect(result.newReleases).toBeGreaterThanOrEqual(0)
    expect(typeof result.weeksSaved).toBe('number')
    expect(typeof result.confidenceDelta).toBe('number')
  })

  it('computes what-if scenario with removed issues', async () => {
    const issues = Array.from({ length: 10 }, (_, i) =>
      makeIssue({ id: `issue-${i}` })
    )
    const team = [makeTeamMember({ weeklyCapacity: 40 })]
    const config = makeSprintConfig()

    const basePlan = await generateReleasePlan(issues, [], team, config)

    const scenario = {
      name: 'Remove 5 issues',
      removedIssues: issues.slice(0, 5).map((i) => i.id),
    }

    const result = await simulateWhatIf(
      basePlan,
      scenario,
      issues,
      [],
      team,
      config
    )

    expect(result.newReleases).toBeLessThanOrEqual(result.originalReleases)
  })
})
