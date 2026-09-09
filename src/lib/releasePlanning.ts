/**
 * releasePlanning.ts
 * #605: AI-Powered Release Planning
 *
 * Provides complexity estimation, dependency graph analysis, team capacity
 * planning, and optimal release schedule recommendations. All analysis runs
 * client-side using statistical/heuristic methods and graph algorithms so
 * no external AI API key is required.
 */

import * as tf from '@tensorflow/tfjs'

// ---------------------------------------------------------------------------
// Core Types
// ---------------------------------------------------------------------------

export type IssueLabel =
  | 'bug'
  | 'feature'
  | 'enhancement'
  | 'documentation'
  | 'refactor'
  | 'performance'
  | 'security'
  | 'dependency'
  | 'testing'
  | 'unknown'

export type IssuePriority = 'critical' | 'high' | 'medium' | 'low'

export type IssueStatus = 'open' | 'in-progress' | 'review' | 'done'

export interface IssueMetadata {
  id: string
  title: string
  description: string
  labels: IssueLabel[]
  priority: IssuePriority
  status: IssueStatus
  estimatedHours?: number
  actualHours?: number
  commentCount: number
  linkedPRCount: number
  fileChangeCount: number
  createdAt: string
  updatedAt: string
  assignee?: string
  complexity?: ComplexityEstimate
}

export interface ComplexityEstimate {
  /** Story points (1, 2, 3, 5, 8, 13, 21) */
  storyPoints: number
  /** 0-1 confidence score */
  confidence: number
  /** Feature vector used for estimation */
  features: number[]
  /** Human-readable explanation */
  explanation: string
}

export interface DependencyEdge {
  from: string
  to: string
  type: 'blocks' | 'depends-on' | 'related-to'
  strength: number // 0-1
}

export interface DependencyGraph {
  issues: Map<string, IssueMetadata>
  edges: DependencyEdge[]
  /** Topologically sorted issue IDs */
  topologicalOrder: string[]
  /** Map of issue ID to its depth in the dependency tree */
  depthMap: Map<string, number>
  /** Map of issue ID to direct dependents count */
  dependentsCount: Map<string, number>
  /** Issues involved in cycles (if any) */
  cycleNodes: string[]
}

export interface TeamMember {
  id: string
  name: string
  role: 'developer' | 'designer' | 'reviewer' | 'lead'
  /** Hours available per week */
  weeklyCapacity: number
  /** Velocity factor (1.0 = average) */
  velocityFactor: number
  /** Skills / domain expertise tags */
  skills: string[]
}

export interface SprintConfig {
  sprintLengthWeeks: number
  bufferFactor: number // e.g. 0.85 means 85% productive time
  maxParallelWork: number
}

export interface CapacityPlan {
  teamMembers: TeamMember[]
  totalWeeklyCapacity: number
  adjustedWeeklyCapacity: number // after buffer
  sprintCapacity: number // story points per sprint
  memberAllocations: MemberAllocation[]
  riskLevel: 'low' | 'medium' | 'high'
  explanation: string
}

export interface MemberAllocation {
  memberId: string
  memberName: string
  allocatedStoryPoints: number
  allocatedHours: number
  issueIds: string[]
}

export interface ReleaseRecommendation {
  /** Grouped sets of issues per release */
  releaseGroups: ReleaseGroup[]
  /** Overall schedule */
  schedule: ReleaseSchedule
  /** Confidence score 0-1 */
  confidence: number
  /** Risk assessment */
  risks: RiskAssessment[]
  /** Explainable reasoning */
  explanation: string
}

export interface ReleaseGroup {
  releaseNumber: number
  name: string
  issueIds: string[]
  totalStoryPoints: number
  estimatedWeeks: number
  startDate: string
  endDate: string
  theme: string
  riskLevel: 'low' | 'medium' | 'high'
}

export interface ReleaseSchedule {
  totalReleases: number
  totalWeeks: number
  totalStoryPoints: number
  confidence: number
  criticalPath: string[]
}

export interface RiskAssessment {
  riskId: string
  description: string
  severity: 'low' | 'medium' | 'high'
  affectedIssues: string[]
  mitigation: string
}

// ---------------------------------------------------------------------------
// Complexity Estimation
// ---------------------------------------------------------------------------

/**
 * Extract a numeric feature vector from issue metadata for ML complexity
 * estimation.  Features:
 *   [0] label complexity score (weighted by label types)
 *   [1] priority numeric mapping (critical=4, high=3, medium=2, low=1)
 *   [2] log1p of description length (chars)
 *   [3] log1p of comment count
 *   [4] log1p of linked PR count
 *   [5] log1p of file change count
 *   [6] age in days (normalised)
 *   [7] has assignee (binary)
 */
export function extractComplexityFeatures(issue: IssueMetadata): number[] {
  const labelScores: Record<IssueLabel, number> = {
    bug: 2,
    feature: 4,
    enhancement: 3,
    documentation: 1,
    refactor: 3,
    performance: 3,
    security: 4,
    dependency: 2,
    testing: 2,
    unknown: 2,
  }

  const labelScore =
    issue.labels.length > 0
      ? issue.labels.reduce((sum, l) => sum + (labelScores[l] ?? 2), 0) /
        issue.labels.length
      : 2

  const priorityMap: Record<IssuePriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  }

  const descLen = Math.log1p(issue.description?.length ?? 0)
  const commentsLog = Math.log1p(issue.commentCount)
  const prsLog = Math.log1p(issue.linkedPRCount)
  const filesLog = Math.log1p(issue.fileChangeCount)

  const createdAt = new Date(issue.createdAt)
  const updatedAt = new Date(issue.updatedAt)
  const ageDays = Math.max(
    0,
    (updatedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  )
  const ageNorm = Math.log1p(ageDays) / Math.log1p(365) // normalised to ~1 year

  const hasAssignee = issue.assignee ? 1 : 0

  return [
    labelScore,
    priorityMap[issue.priority],
    descLen,
    commentsLog,
    prsLog,
    filesLog,
    ageNorm,
    hasAssignee,
  ]
}

/**
 * Map a continuous prediction to story points (Fibonacci-like).
 */
function predictionToStoryPoints(prediction: number): number {
  const fibonacciPoints = [1, 2, 3, 5, 8, 13, 21]
  // Scale prediction (expected range ~0-4) to index
  const index = Math.round(
    ((prediction - 0.5) / 3.5) * (fibonacciPoints.length - 1)
  )
  return fibonacciPoints[
    Math.max(0, Math.min(fibonacciPoints.length - 1, index))
  ]
}

/**
 * Estimate issue complexity using heuristic scoring + optional ML model.
 * Falls back to a heuristic weighted score if TFJS model is unavailable.
 */
export async function estimateComplexity(
  issue: IssueMetadata,
  model?: tf.LayersModel
): Promise<ComplexityEstimate> {
  const features = extractComplexityFeatures(issue)

  if (model) {
    try {
      const input = tf.tensor2d([features])
      const predictionTensor = model.predict(input) as tf.Tensor
      const prediction = (await predictionTensor.array()) as number[][]
      input.dispose()

      const rawScore = prediction?.[0]?.[0] ?? 0
      const storyPoints = predictionToStoryPoints(rawScore)
      const confidence = 0.85

      return {
        storyPoints,
        confidence,
        features,
        explanation: explainComplexity(issue, storyPoints, features),
      }
    } catch {
      // Fall through to heuristic
    }
  }

  // Heuristic approach: weighted sum of features
  const weights = [0.3, 0.2, 0.15, 0.1, 0.1, 0.1, 0.03, 0.02]
  const weightedSum = features.reduce(
    (sum, f, i) => sum + f * (weights[i] ?? 0),
    0
  )

  // Scale to story points (weightedSum ~0.1 to ~4 typically)
  const storyPoints = predictionToStoryPoints(weightedSum)
  const confidence = 0.78 // heuristic confidence

  return {
    storyPoints,
    confidence,
    features,
    explanation: explainComplexity(issue, storyPoints, features),
  }
}

/**
 * Generate human-readable complexity explanation.
 */
function explainComplexity(
  issue: IssueMetadata,
  storyPoints: number,
  _features: number[]
): string {
  const parts: string[] = []

  if (issue.labels.includes('security') || issue.labels.includes('bug')) {
    parts.push('requires careful testing and review')
  }
  if (issue.priority === 'critical' || issue.priority === 'high') {
    parts.push('high priority — needs thorough validation')
  }
  if (issue.linkedPRCount > 2) {
    parts.push(`involves ${issue.linkedPRCount} related PRs`)
  }
  if (issue.fileChangeCount > 10) {
    parts.push(`touches ${issue.fileChangeCount} files — wide surface area`)
  }
  if (issue.commentCount > 5) {
    parts.push('significant discussion indicating complexity')
  }

  const estimateLabel =
    storyPoints <= 2
      ? 'small'
      : storyPoints <= 5
        ? 'medium'
        : storyPoints <= 8
          ? 'large'
          : 'extra-large'

  const base = `Estimated as ${estimateLabel} (${storyPoints} story points)`

  return parts.length > 0
    ? `${base}. Factors: ${parts.join('; ')}.`
    : `${base}.`
}

/**
 * Train a simple TFJS model for complexity estimation.
 */
let complexityModel: tf.LayersModel | null = null

export async function initComplexityModel(
  inputDim = 8
): Promise<tf.LayersModel> {
  if (complexityModel) return complexityModel

  try {
    complexityModel = await tf.loadLayersModel(
      'indexeddb://stellar-release-complexity-model'
    )
    complexityModel.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae'],
    })
    return complexityModel
  } catch {
    const model = tf.sequential()
    model.add(
      tf.layers.dense({ units: 16, activation: 'relu', inputShape: [inputDim] })
    )
    model.add(tf.layers.dropout({ rate: 0.2 }))
    model.add(
      tf.layers.dense({ units: 8, activation: 'relu' })
    )
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }))

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae'],
    })

    complexityModel = model
    return complexityModel
  }
}

/**
 * Train the complexity model on historical issue data.
 * `labels` contains the ground-truth story points for each issue.
 */
export async function trainComplexityModel(
  issues: IssueMetadata[],
  storyPointLabels: number[]
): Promise<{ mae: number; loss: number }> {
  const features = issues.map(extractComplexityFeatures)

  if (features.length === 0) {
    return { mae: 0, loss: 0 }
  }

  const model = await initComplexityModel(8)
  const xs = tf.tensor2d(features)
  const ys = tf.tensor2d(
    storyPointLabels.map((sp) => [sp])
  )

  const history = await model.fit(xs, ys, {
    epochs: 20,
    batchSize: Math.min(16, features.length),
    shuffle: true,
    verbose: 0,
  })

  try {
    await model.save('indexeddb://stellar-release-complexity-model')
  } catch {
    // Ignore save error in non-browser environments
  }

  xs.dispose()
  ys.dispose()

  const lastMae = history.history.mae
    ? (history.history.mae[history.history.mae.length - 1] as number)
    : 0
  const lastLoss = history.history.loss
    ? (history.history.loss[history.history.loss.length - 1] as number)
    : 0

  return { mae: lastMae, loss: lastLoss }
}

// ---------------------------------------------------------------------------
// Dependency Graph Analysis
// ---------------------------------------------------------------------------

/**
 * Build a dependency graph from issue list and edge definitions.
 * Performs topological sorting and computes dependency depth.
 */
export function buildDependencyGraph(
  issues: IssueMetadata[],
  edges: DependencyEdge[]
): DependencyGraph {
  const issueMap = new Map<string, IssueMetadata>()
  for (const issue of issues) {
    issueMap.set(issue.id, issue)
  }

  // Build adjacency lists
  const adjacency = new Map<string, string[]>()
  const reverseAdj = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const issue of issues) {
    adjacency.set(issue.id, [])
    reverseAdj.set(issue.id, [])
    inDegree.set(issue.id, 0)
  }

  for (const edge of edges) {
    const adj = adjacency.get(edge.from)
    if (adj) adj.push(edge.to)
    const rev = reverseAdj.get(edge.to)
    if (rev) rev.push(edge.from)
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1)
  }

  // Topological sort (Kahn's algorithm)
  const queue: string[] = []
  const topOrder: string[] = []

  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  // Sort queue by priority for deterministic ordering
  queue.sort((a, b) => {
    const ai = issueMap.get(a)
    const bi = issueMap.get(b)
    const prioScore = (p: IssuePriority) =>
      ({ critical: 4, high: 3, medium: 2, low: 1 })[p]
    return (prioScore(bi?.priority ?? 'medium') -
      prioScore(ai?.priority ?? 'medium'))
  })

  while (queue.length > 0) {
    const node = queue.shift()!
    topOrder.push(node)

    for (const neighbor of adjacency.get(node) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) {
        queue.push(neighbor)
      }
    }
  }

  // Compute depths via BFS from root nodes (in-degree 0)
  const depthMap = new Map<string, number>()
  const rootNodes = issues
    .filter(
      (i) =>
        !edges.some((e) => e.to === i.id) ||
        (inDegree.get(i.id) === 0 && !edges.some((e) => e.to === i.id))
    )
    .map((i) => i.id)

  for (const root of rootNodes) {
    const visited = new Set<string>()
    const bfsQueue: { id: string; depth: number }[] = [{ id: root, depth: 0 }]

    while (bfsQueue.length > 0) {
      const { id, depth } = bfsQueue.shift()!
      if (visited.has(id)) continue
      visited.add(id)

      const current = depthMap.get(id) ?? -1
      depthMap.set(id, Math.max(current, depth))

      for (const neighbor of adjacency.get(id) ?? []) {
        bfsQueue.push({ id: neighbor, depth: depth + 1 })
      }
    }
  }

  // Dependents count: how many issues depend on each issue
  const dependentsCount = new Map<string, number>()
  for (const issue of issues) {
    dependentsCount.set(issue.id, 0)
  }
  for (const edge of edges) {
    const count = dependentsCount.get(edge.to) ?? 0
    dependentsCount.set(edge.to, count + 1)
  }

  // Detect cycles: nodes not included in topological order but present in the graph
  const cycleNodes = issues
    .filter((i) => !topOrder.includes(i.id))
    .map((i) => i.id)

  // For cycle nodes, assign a depth of -1 to indicate they're in a cycle
  for (const node of cycleNodes) {
    depthMap.set(node, -1)
  }

  return {
    issues: issueMap,
    edges,
    topologicalOrder: topOrder,
    depthMap,
    dependentsCount,
    cycleNodes,
  }
}

/**
 * Find the critical path (longest path) in the dependency graph.
 * Returns issue IDs in order along the critical path.
 */
export function findCriticalPath(deps: DependencyGraph): string[] {
  const { issues, depthMap, topologicalOrder } = deps

  if (issues.size === 0) return []

  // Filter out cycle nodes (depth -1)
  const validNodes = topologicalOrder.filter((id) => (depthMap.get(id) ?? -1) >= 0)

  if (validNodes.length === 0) {
    // No valid nodes — might be all cycles, pick highest priority
    let highestPrio: IssueMetadata | undefined
    const prioOrder: IssuePriority[] = ['critical', 'high', 'medium', 'low']
    for (const prio of prioOrder) {
      highestPrio = Array.from(issues.values()).find((i) => i.priority === prio)
      if (highestPrio) break
    }
    return highestPrio ? [highestPrio.id] : []
  }

  // Find the issue(s) with maximum depth
  let maxDepth = -1
  let deepestId = ''

  for (const id of validNodes) {
    const depth = depthMap.get(id) ?? 0
    if (depth > maxDepth) {
      maxDepth = depth
      deepestId = id
    }
  }

  if (!deepestId) {
    // No dependencies, pick highest priority
    let highestPrio: IssueMetadata | undefined
    const prioOrder: IssuePriority[] = ['critical', 'high', 'medium', 'low']
    for (const prio of prioOrder) {
      highestPrio = Array.from(issues.values()).find((i) => i.priority === prio)
      if (highestPrio) break
    }
    return highestPrio ? [highestPrio.id] : []
  }

  // Walk backwards to root using depth-based backtracking
  const path: string[] = []
  let current = deepestId
  const visited = new Set<string>()

  while (current && !visited.has(current)) {
    visited.add(current)
    path.unshift(current)

    const currentDepth = depthMap.get(current) ?? 0
    if (currentDepth <= 0) break

    // Find any predecessor with depth = currentDepth - 1
    const predecessors = deps.edges.filter((e) => e.to === current)
    let pred = predecessors.find(
      (e) => (depthMap.get(e.from) ?? -1) === currentDepth - 1
    )

    // Fallback: if no exact match, pick any predecessor with lower depth
    if (!pred) {
      pred = predecessors.find(
        (e) => (depthMap.get(e.from) ?? -1) >= 0 && (depthMap.get(e.from) ?? 0) < currentDepth
      )
    }

    current = pred?.from ?? ''
  }

  return path
}

// ---------------------------------------------------------------------------
// Capacity Planning
// ---------------------------------------------------------------------------

/**
 * Calculate team capacity based on member availability, velocity,
 * and sprint configuration.
 */
export function calculateCapacity(
  team: TeamMember[],
  sprintConfig: SprintConfig,
  storyPointToHourRatio = 4 // avg hours per story point
): CapacityPlan {
  if (team.length === 0) {
    return {
      teamMembers: [],
      totalWeeklyCapacity: 0,
      adjustedWeeklyCapacity: 0,
      sprintCapacity: 0,
      memberAllocations: [],
      riskLevel: 'low',
      explanation: 'No team members configured.',
    }
  }

  const totalWeeklyCapacity = team.reduce(
    (sum, m) => sum + m.weeklyCapacity,
    0
  )
  const adjustedWeeklyCapacity = totalWeeklyCapacity * sprintConfig.bufferFactor
  const sprintCapacity = Math.round(
    (adjustedWeeklyCapacity * sprintConfig.sprintLengthWeeks) /
      storyPointToHourRatio
  )

  // Allocate members to issues (simplified: proportional to capacity)
  const memberAllocations: MemberAllocation[] = team.map((m) => ({
    memberId: m.id,
    memberName: m.name,
    allocatedStoryPoints: Math.round(
      (m.weeklyCapacity / totalWeeklyCapacity) * sprintCapacity
    ),
    allocatedHours:
      m.weeklyCapacity * sprintConfig.sprintLengthWeeks * sprintConfig.bufferFactor,
    issueIds: [],
  }))

  const riskLevel =
    sprintCapacity < 10
      ? 'low'
      : sprintCapacity < 30
        ? 'medium'
        : 'high'

  const explanation = [
    `Team of ${team.length} with ${totalWeeklyCapacity}h/week total capacity.`,
    `After ${Math.round((1 - sprintConfig.bufferFactor) * 100)}% buffer: ${Math.round(adjustedWeeklyCapacity)}h/week.`,
    `Estimated sprint capacity: ${sprintCapacity} story points over ${sprintConfig.sprintLengthWeeks} weeks.`,
    `Risk level: ${riskLevel} — ${riskLevel === 'high' ? 'Consider reducing scope or adding team members.' : riskLevel === 'medium' ? 'Manageable with careful prioritization.' : 'Well within capacity.'}`,
  ].join(' ')

  return {
    teamMembers: team,
    totalWeeklyCapacity,
    adjustedWeeklyCapacity,
    sprintCapacity,
    memberAllocations,
    riskLevel,
    explanation,
  }
}

/**
 * Check if a set of issues fits within sprint capacity.
 * Considers dependencies and complexity.
 */
export function validateSprintCapacity(
  issues: IssueMetadata[],
  capacity: CapacityPlan,
  deps: DependencyGraph
): {
  fits: boolean
  totalStoryPoints: number
  remainingCapacity: number
  blockedIssues: string[]
  recommendation: string
} {
  const totalStoryPoints = issues.reduce(
    (sum, i) => sum + (i.complexity?.storyPoints ?? 0),
    0
  )

  // Find blocked issues: issues in the sprint that depend on issues NOT in the sprint.
  // The dependency graph must contain both the sprint issues and their prerequisites
  // for blocked-issue detection to work correctly.
  const issueIds = new Set(issues.map((i) => i.id))
  const blockedIssues: string[] = []

  for (const edge of deps.edges) {
    // An issue is blocked if it's in the sprint but its blocking prerequisite is not
    if (
      issueIds.has(edge.to) &&
      edge.type !== 'related-to' &&
      !issueIds.has(edge.from) &&
      // The prerequisite must exist in the full dependency graph
      deps.issues.has(edge.from)
    ) {
      blockedIssues.push(edge.to)
    }
  }

  const fits = totalStoryPoints <= capacity.sprintCapacity && blockedIssues.length === 0

  const remaining = capacity.sprintCapacity - totalStoryPoints

  let recommendation: string
  if (fits) {
    recommendation = `Sprint scope fits within capacity with ${remaining} story points remaining.`
  } else if (totalStoryPoints > capacity.sprintCapacity) {
    recommendation = `Sprint is over capacity by ${-remaining} story points. Consider removing lower-priority issues or extending the sprint.`
  } else {
    recommendation = `${blockedIssues.length} issue(s) are blocked by dependencies outside the sprint. Add the prerequisite issues or remove blocked items.`
  }

  return {
    fits,
    totalStoryPoints,
    remainingCapacity: remaining,
    blockedIssues,
    recommendation,
  }
}

// ---------------------------------------------------------------------------
// Release Recommendation Engine
// ---------------------------------------------------------------------------

/**
 * Generate optimal release grouping recommendations.
 *
 * The algorithm:
 * 1. Topologically sort issues by dependencies
 * 2. Group issues by similar theme/labels and dependency clusters
 * 3. Pack groups into releases based on capacity
 * 4. Order releases by critical path priority
 */
export async function generateReleasePlan(
  issues: IssueMetadata[],
  edges: DependencyEdge[],
  team: TeamMember[],
  sprintConfig: SprintConfig,
  startDate: Date = new Date()
): Promise<ReleaseRecommendation> {
  // Estimate complexity for all issues (use estimated copies to avoid mutating input)
  const estimatedIssues = await batchEstimateComplexity(issues)

  // Build dependency graph
  const deps = buildDependencyGraph(estimatedIssues, edges)

  // Calculate capacity
  const capacity = calculateCapacity(team, sprintConfig)

  // Find critical path
  const criticalPath = findCriticalPath(deps)

  // Cluster issues by dependency depth and label similarity
  const clusters = clusterIssues(estimatedIssues, deps)

  // Pack clusters into releases
  const releaseGroups = packReleases(clusters, capacity, sprintConfig, startDate)

  // Assess risks
  const risks = assessRisks(estimatedIssues, deps, capacity, releaseGroups)

  const schedule: ReleaseSchedule = {
    totalReleases: releaseGroups.length,
    totalWeeks: releaseGroups.reduce((sum, r) => sum + r.estimatedWeeks, 0),
    totalStoryPoints: releaseGroups.reduce((sum, r) => sum + r.totalStoryPoints, 0),
    confidence: computeScheduleConfidence(releaseGroups, capacity),
    criticalPath,
  }

  const explanation = generateExplanation(releaseGroups, schedule, risks, capacity)

  return {
    releaseGroups,
    schedule,
    confidence: schedule.confidence,
    risks,
    explanation,
  }
}

/**
 * Cluster issues by dependency depth and thematic similarity.
 */
function clusterIssues(
  issues: IssueMetadata[],
  deps: DependencyGraph
): Map<string, IssueMetadata[]> {
  const clusters = new Map<string, IssueMetadata[]>()
  const assigned = new Set<string>()

  // First pass: group by dependency clusters
  const rootNodes = issues.filter(
    (i) =>
      !deps.edges.some((e) => e.to === i.id && e.type !== 'related-to')
  )

  for (const root of rootNodes) {
    if (assigned.has(root.id)) continue

    const cluster: IssueMetadata[] = [root]
    assigned.add(root.id)

    // BFS to collect connected issues
    const visited = new Set<string>([root.id])
    const queue = [root.id]

    while (queue.length > 0) {
      const current = queue.shift()!
      for (const edge of deps.edges) {
        if (
          edge.from === current &&
          edge.type !== 'related-to' &&
          !visited.has(edge.to)
        ) {
          visited.add(edge.to)
          const issue = deps.issues.get(edge.to)
          if (issue) {
            cluster.push(issue)
            assigned.add(issue.id)
            queue.push(edge.to)
          }
        }
      }
    }

    // Name cluster by dominant label
    const labelCounts = new Map<string, number>()
    for (const issue of cluster) {
      for (const label of issue.labels) {
        labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
      }
    }
    const dominantLabel = [...labelCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] ?? 'feature'

    const clusterName = `${dominantLabel}-cluster-${clusters.size + 1}`
    clusters.set(clusterName, cluster)
  }

  // Assign unassigned issues to nearest cluster or create new ones
  for (const issue of issues) {
    if (!assigned.has(issue.id)) {
      const soloCluster = `solo-${clusters.size + 1}`
      clusters.set(soloCluster, [issue])
      assigned.add(issue.id)
    }
  }

  return clusters
}

/**
 * Pack issue clusters into releases based on capacity.
 */
function packReleases(
  clusters: Map<string, IssueMetadata[]>,
  capacity: CapacityPlan,
  sprintConfig: SprintConfig,
  startDate: Date
): ReleaseGroup[] {
  const releases: ReleaseGroup[] = []
  let releaseNumber = 1
  let currentDate = new Date(startDate)

  // Sort clusters: high priority + dependency depth first
  const sortedClusters = [...clusters.entries()].sort(([, issuesA], [, issuesB]) => {
    const prioScore = (issues: IssueMetadata[]) => {
      const maxPrio = Math.max(
        ...issues.map((i) =>
          ({ critical: 4, high: 3, medium: 2, low: 1 })[i.priority]
        )
      )
      return maxPrio
    }
    return prioScore(issuesB) - prioScore(issuesA)
  })

  // Bin-packing: fit clusters into releases greedily
  let currentReleaseIssues: IssueMetadata[] = []
  let currentReleaseSP = 0

  for (const [, clusterIssues] of sortedClusters) {
    const clusterSP = clusterIssues.reduce(
      (sum, i) => sum + (i.complexity?.storyPoints ?? 3),
      0
    )

    // If adding this cluster exceeds capacity, start a new release
    if (
      currentReleaseSP + clusterSP > capacity.sprintCapacity &&
      currentReleaseIssues.length > 0
    ) {
      releases.push(createReleaseGroup(
        releaseNumber,
        currentReleaseIssues,
        currentReleaseSP,
        currentDate,
        sprintConfig,
        capacity
      ))
      releaseNumber++
      currentDate = new Date(
        currentDate.getTime() +
          sprintConfig.sprintLengthWeeks * 7 * 24 * 60 * 60 * 1000
      )
      currentReleaseIssues = []
      currentReleaseSP = 0
    }

    currentReleaseIssues.push(...clusterIssues)
    currentReleaseSP += clusterSP
  }

  // Push the last release
  if (currentReleaseIssues.length > 0) {
    releases.push(createReleaseGroup(
      releaseNumber,
      currentReleaseIssues,
      currentReleaseSP,
      currentDate,
      sprintConfig,
      capacity
    ))
  }

  return releases
}

function createReleaseGroup(
  number: number,
  issues: IssueMetadata[],
  storyPoints: number,
  startDate: Date,
  sprintConfig: SprintConfig,
  capacity: CapacityPlan
): ReleaseGroup {
  const estimatedWeeks =
    Math.ceil(storyPoints / (capacity.sprintCapacity || 1)) *
    sprintConfig.sprintLengthWeeks

  const endDate = new Date(
    startDate.getTime() + estimatedWeeks * 7 * 24 * 60 * 60 * 1000
  )

  // Determine theme from dominant label
  const labelCounts = new Map<string, number>()
  for (const issue of issues) {
    for (const label of issue.labels) {
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
    }
  }
  const theme = [...labelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label)
    .slice(0, 2)
    .join(' & ') || 'General'

  const riskLevel =
    storyPoints > capacity.sprintCapacity * 1.3
      ? 'high'
      : storyPoints > capacity.sprintCapacity * 0.8
        ? 'medium'
        : 'low'

  return {
    releaseNumber: number,
    name: `Release ${number}`,
    issueIds: issues.map((i) => i.id),
    totalStoryPoints: storyPoints,
    estimatedWeeks,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    theme: theme.charAt(0).toUpperCase() + theme.slice(1),
    riskLevel,
  }
}

// ---------------------------------------------------------------------------
// Risk Assessment
// ---------------------------------------------------------------------------

function assessRisks(
  issues: IssueMetadata[],
  deps: DependencyGraph,
  capacity: CapacityPlan,
  releases: ReleaseGroup[]
): RiskAssessment[] {
  const risks: RiskAssessment[] = []

  // Risk: overloaded sprint
  const overloadedReleases = releases.filter((r) => r.riskLevel === 'high')
  if (overloadedReleases.length > 0) {
    risks.push({
      riskId: 'overloaded-sprint',
      description: `${overloadedReleases.length} release(s) exceed recommended capacity.`,
      severity: 'high',
      affectedIssues: overloadedReleases.flatMap((r) => r.issueIds),
      mitigation:
        'Split overloaded releases into multiple sprints or increase team capacity.',
    })
  }

  // Risk: unmet dependencies
  const allReleaseIssues = new Set(
    releases.flatMap((r) => r.issueIds)
  )
  const unmetDeps = deps.edges.filter(
    (e) =>
      e.type === 'blocks' &&
      allReleaseIssues.has(e.to) &&
      !allReleaseIssues.has(e.from)
  )
  if (unmetDeps.length > 0) {
    risks.push({
      riskId: 'unmet-dependencies',
      description: `${unmetDeps.length} blocking dependencies are not included in any release.`,
      severity: 'high',
      affectedIssues: unmetDeps.map((e) => e.to),
      mitigation:
        'Include prerequisite issues or remove dependent issues from the release plan.',
    })
  }

  // Risk: high priority issues late in schedule
  const criticalIssues = issues.filter((i) => i.priority === 'critical')
  const lateCritical = criticalIssues.filter((ci) => {
    const releaseIdx = releases.findIndex((r) => r.issueIds.includes(ci.id))
    return releaseIdx > releases.length / 2
  })
  if (lateCritical.length > 0) {
    risks.push({
      riskId: 'late-critical-issues',
      description: `${lateCritical.length} critical-priority issues are scheduled late in the release cycle.`,
      severity: 'medium',
      affectedIssues: lateCritical.map((i) => i.id),
      mitigation:
        'Re-prioritize critical issues to earlier releases.',
    })
  }

  // Risk: single point of failure (one person owns many issues)
  const assigneeLoads = new Map<string, number>()
  for (const issue of issues) {
    if (issue.assignee) {
      assigneeLoads.set(
        issue.assignee,
        (assigneeLoads.get(issue.assignee) ?? 0) +
          (issue.complexity?.storyPoints ?? 3)
      )
    }
  }
  const highLoad = [...assigneeLoads.entries()].filter(
    ([, sp]) => sp > capacity.sprintCapacity * 0.6
  )
  if (highLoad.length > 0) {
    risks.push({
      riskId: 'single-point-of-failure',
      description: `${highLoad.length} team member(s) have high story point load.`,
      severity: 'medium',
      affectedIssues: issues
        .filter((i) => highLoad.some(([a]) => a === i.assignee))
        .map((i) => i.id),
      mitigation:
        'Redistribute workload across more team members to reduce bus factor.',
    })
  }

  // Risk: many high-complexity issues (13+ SP)
  const complexIssues = issues.filter(
    (i) => (i.complexity?.storyPoints ?? 0) >= 13
  )
  if (complexIssues.length > 2) {
    risks.push({
      riskId: 'high-complexity-cluster',
      description: `${complexIssues.length} issues are estimated at 13+ story points — high uncertainty.`,
      severity: 'medium',
      affectedIssues: complexIssues.map((i) => i.id),
      mitigation:
        'Consider breaking down large issues into smaller, more estimable tasks.',
    })
  }

  return risks
}

// ---------------------------------------------------------------------------
// Schedule Confidence
// ---------------------------------------------------------------------------

function computeScheduleConfidence(
  releases: ReleaseGroup[],
  capacity: CapacityPlan
): number {
  if (releases.length === 0) return 1

  // Confidence decreases with each release
  const baseConfidence = 0.92 // first release confidence

  // Penalize overloaded releases
  let confidenceSum = 0
  for (let i = 0; i < releases.length; i++) {
    const release = releases[i]
    const overloadFactor = Math.max(
      0,
      (release.totalStoryPoints - capacity.sprintCapacity) / capacity.sprintCapacity
    )
    const releaseConfidence = baseConfidence * Math.pow(0.93, i) * (1 - overloadFactor * 0.3)
    confidenceSum += Math.max(0.3, releaseConfidence)
  }

  return Math.round((confidenceSum / releases.length) * 100) / 100
}

// ---------------------------------------------------------------------------
// Explanation Generation
// ---------------------------------------------------------------------------

function generateExplanation(
  releases: ReleaseGroup[],
  schedule: ReleaseSchedule,
  risks: RiskAssessment[],
  capacity: CapacityPlan
): string {
  const lines: string[] = [
    `Release plan generated with ${schedule.totalReleases} release(s) over ${schedule.totalWeeks} weeks.`,
    `Total scope: ${schedule.totalStoryPoints} story points.`,
    `Team capacity: ${capacity.sprintCapacity} SP/sprint (${capacity.adjustedWeeklyCapacity} adjusted hours/week).`,
    ``,
    `Schedule confidence: ${Math.round(schedule.confidence * 100)}%.`,
  ]

  for (const release of releases) {
    lines.push(
      `  ${release.name}: ${release.totalStoryPoints} SP, ${release.estimatedWeeks} weeks [${release.startDate} → ${release.endDate}] — ${release.theme} (${release.riskLevel} risk)`
    )
  }

  if (risks.length > 0) {
    lines.push(``)
    lines.push(`Risks identified (${risks.length}):`)
    for (const risk of risks) {
      lines.push(`  • [${risk.severity.toUpperCase()}] ${risk.description}`)
      lines.push(`    Mitigation: ${risk.mitigation}`)
    }
  }

  if (schedule.criticalPath.length > 0) {
    lines.push(``)
    lines.push(
      `Critical path: ${schedule.criticalPath.length} issues in dependency chain.`
    )
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Utility: Batch Estimate Complexity
// ---------------------------------------------------------------------------

export async function batchEstimateComplexity(
  issues: IssueMetadata[]
): Promise<IssueMetadata[]> {
  if (issues.length === 0) return []

  const model = await initComplexityModel()

  const results = await Promise.all(
    issues.map(async (issue) => {
      const complexity = await estimateComplexity(issue, model)
      return { ...issue, complexity }
    })
  )

  return results
}

// ---------------------------------------------------------------------------
// Utility: Simulate What-If Scenarios
// ---------------------------------------------------------------------------

export interface WhatIfScenario {
  name: string
  addedTeamMembers?: TeamMember[]
  removedIssues?: string[]
  adjustedBuffer?: number
  adjustedVelocity?: number
}

export interface WhatIfResult {
  scenario: WhatIfScenario
  originalReleases: number
  newReleases: number
  weeksSaved: number
  confidenceDelta: number
}

export async function simulateWhatIf(
  basePlan: ReleaseRecommendation,
  scenario: WhatIfScenario,
  originalIssues: IssueMetadata[],
  edges: DependencyEdge[],
  baseTeam: TeamMember[],
  baseSprintConfig: SprintConfig
): Promise<WhatIfResult> {
  const newTeam = [
    ...baseTeam,
    ...(scenario.addedTeamMembers ?? []),
  ]

  const filteredIssues = scenario.removedIssues
    ? originalIssues.filter((i) => !scenario.removedIssues!.includes(i.id))
    : originalIssues

  const newConfig: SprintConfig = {
    ...baseSprintConfig,
    bufferFactor: scenario.adjustedBuffer ?? baseSprintConfig.bufferFactor,
  }

  // Adjust velocities if specified
  const adjustedTeam = scenario.adjustedVelocity
    ? newTeam.map((m) => ({
        ...m,
        velocityFactor: m.velocityFactor * scenario.adjustedVelocity!,
      }))
    : newTeam

  const newPlan = await generateReleasePlan(
    filteredIssues,
    edges,
    adjustedTeam,
    newConfig
  )

  return {
    scenario,
    originalReleases: basePlan.schedule.totalReleases,
    newReleases: newPlan.schedule.totalReleases,
    weeksSaved: basePlan.schedule.totalWeeks - newPlan.schedule.totalWeeks,
    confidenceDelta:
      Math.round(
        (newPlan.schedule.confidence - basePlan.schedule.confidence) * 100
      ) / 100,
  }
}
