/**
 * issueAssignment.ts
 * #604: Predictive Issue Assignment
 *
 * AI system that automatically assigns GitHub issues to the most appropriate
 * developers based on expertise, workload, and historical patterns.
 */

import { getStoredValue, setStoredValue } from './storage'

export type IssuePriority = 'critical' | 'high' | 'medium' | 'low'

export interface DeveloperProfile {
  id: string
  name: string
  skills: string[]
  weeklyCapacity: number
  currentLoad: number
  resolvedIssues: ResolvedIssue[]
}

export interface ResolvedIssue {
  issueId: string
  labels: string[]
  success: boolean
  timeSpent: number
  timestamp: number
}

export interface IssueForAssignment {
  id: string
  title: string
  description: string
  labels: string[]
  priority: IssuePriority
  estimatedHours?: number
  createdAt: string
}

export interface AssignmentRecommendation {
  developer: DeveloperProfile
  score: number
  confidence: 'high' | 'medium' | 'low'
  factors: ScoreFactors
  reasoning: string
}

export interface ScoreFactors {
  expertise: number
  workload: number
  historicalFit: number
  specialization: number
}

export interface AssignmentFeedback {
  issueId: string
  developerId: string
  wasAccepted: boolean
  resolutionSuccess: boolean
  timestamp: number
}

export interface IssueAssignmentState {
  developers: DeveloperProfile[]
  feedbackHistory: AssignmentFeedback[]
  assignmentHistory: Array<{ issueId: string; developerId: string; timestamp: number }>
  lastTrainingRun: number
}

const STORAGE_KEY = 'issue-assignment:state'
const MAX_FEEDBACK_HISTORY = 1000
const MAX_ASSIGNMENT_HISTORY = 2000

function createDefaultState(): IssueAssignmentState {
  return {
    developers: [],
    feedbackHistory: [],
    assignmentHistory: [],
    lastTrainingRun: 0,
  }
}

export class PredictiveIssueAssigner {
  private state: IssueAssignmentState

  constructor(initialState?: Partial<IssueAssignmentState>) {
    this.state = { ...createDefaultState(), ...initialState }
  }

  getState(): IssueAssignmentState {
    return {
      ...this.state,
      developers: this.state.developers.map(d => ({ ...d, resolvedIssues: [...d.resolvedIssues] })),
      feedbackHistory: [...this.state.feedbackHistory],
      assignmentHistory: [...this.state.assignmentHistory],
    }
  }

  registerDeveloper(profile: DeveloperProfile): void {
    const existing = this.state.developers.find(d => d.id === profile.id)
    if (existing) {
      existing.name = profile.name
      existing.skills = profile.skills
      existing.weeklyCapacity = profile.weeklyCapacity
      existing.currentLoad = profile.currentLoad
    } else {
      this.state.developers.push({ ...profile })
    }
  }

  removeDeveloper(developerId: string): void {
    this.state.developers = this.state.developers.filter(d => d.id !== developerId)
  }

  predictAssignees(issue: IssueForAssignment, topN: number = 3): AssignmentRecommendation[] {
    if (this.state.developers.length === 0) return []

    const scored = this.state.developers
      .map(dev => this.scoreDeveloper(dev, issue))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, topN)
  }

  private scoreDeveloper(developer: DeveloperProfile, issue: IssueForAssignment): AssignmentRecommendation {
    const expertise = this.computeExpertiseScore(developer, issue)
    const workload = this.computeWorkloadScore(developer)
    const historicalFit = this.computeHistoricalFitScore(developer, issue)
    const specialization = this.computeSpecializationScore(developer, issue)

    const totalScore = expertise * 0.35 + workload * 0.3 + historicalFit * 0.2 + specialization * 0.15

    const confidence: 'high' | 'medium' | 'low' =
      totalScore >= 0.7 ? 'high' :
      totalScore >= 0.4 ? 'medium' : 'low'

    const factors: ScoreFactors = { expertise, workload, historicalFit, specialization }
    const reasoning = this.buildReasoning(developer, issue, factors)

    return {
      developer,
      score: Math.max(0, Math.min(1, totalScore)),
      confidence,
      factors,
      reasoning,
    }
  }

  private computeExpertiseScore(developer: DeveloperProfile, issue: IssueForAssignment): number {
    if (developer.skills.length === 0 || issue.labels.length === 0) return 0.1

    const matchedSkills = developer.skills.filter(s =>
      issue.labels.some(l => l.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(l.toLowerCase()))
    ).length

    const totalPossible = Math.max(1, issue.labels.length)
    const directMatch = matchedSkills / totalPossible

    const categoryMatch = issue.labels.some(l =>
      developer.skills.some(s => this.isCategoryMatch(s, l))
    ) ? 0.3 : 0

    return Math.max(0.1, Math.min(1, directMatch * 0.7 + categoryMatch))
  }

  private isCategoryMatch(skill: string, label: string): boolean {
    const categories: Record<string, string[]> = {
      frontend: ['ui', 'ux', 'frontend', 'react', 'javascript', 'css'],
      backend: ['backend', 'api', 'server', 'database', 'rust', 'node'],
      blockchain: ['blockchain', 'stellar', 'smart-contract', 'crypto', 'defi'],
      security: ['security', 'auth', 'encryption', 'audit'],
      devops: ['devops', 'ci/cd', 'deployment', 'infrastructure'],
      data: ['data', 'analytics', 'ml', 'ai', 'machine-learning'],
    }

    const skillLower = skill.toLowerCase()
    const labelLower = label.toLowerCase()

    for (const members of Object.values(categories)) {
      if (members.includes(skillLower) && members.includes(labelLower)) return true
    }
    return false
  }

  private computeWorkloadScore(developer: DeveloperProfile): number {
    const capacity = developer.weeklyCapacity || 40
    const loadRatio = developer.currentLoad / Math.max(1, capacity)
    return Math.max(0, 1 - loadRatio)
  }

  private computeHistoricalFitScore(developer: DeveloperProfile, issue: IssueForAssignment): number {
    const relevantResolutions = developer.resolvedIssues.filter(r =>
      r.labels.some(l => issue.labels.includes(l))
    )

    if (relevantResolutions.length === 0) return 0.15

    const successRate = relevantResolutions.filter(r => r.success).length / relevantResolutions.length
    const avgTime = relevantResolutions.reduce((s, r) => s + r.timeSpent, 0) / relevantResolutions.length
    const efficiencyScore = Math.max(0, 1 - avgTime / 100)

    return successRate * 0.6 + efficiencyScore * 0.4
  }

  private computeSpecializationScore(developer: DeveloperProfile, issue: IssueForAssignment): number {
    if (developer.resolvedIssues.length === 0) return 0.2

    const byLabel: Record<string, { total: number; success: number }> = {}
    for (const res of developer.resolvedIssues) {
      for (const label of res.labels) {
        if (!byLabel[label]) byLabel[label] = { total: 0, success: 0 }
        byLabel[label].total++
        if (res.success) byLabel[label].success++
      }
    }

    const labelScores = issue.labels.map(l => {
      const data = byLabel[l]
      if (!data) return 0
      return data.success / Math.max(1, data.total)
    })

    return labelScores.length > 0
      ? labelScores.reduce((s, v) => s + v, 0) / labelScores.length
      : 0.2
  }

  recordFeedback(feedback: AssignmentFeedback): void {
    this.state.feedbackHistory.push(feedback)
    if (this.state.feedbackHistory.length > MAX_FEEDBACK_HISTORY) {
      this.state.feedbackHistory = this.state.feedbackHistory.slice(-MAX_FEEDBACK_HISTORY)
    }

    const dev = this.state.developers.find(d => d.id === feedback.developerId)
    if (dev && feedback.resolutionSuccess) {
      const existing = dev.resolvedIssues.find(r => r.issueId === feedback.issueId)
      if (!existing) {
        dev.resolvedIssues.push({
          issueId: feedback.issueId,
          labels: [],
          success: true,
          timeSpent: 0,
          timestamp: feedback.timestamp,
        })
      }
    }
  }

  recordAssignment(issueId: string, developerId: string): void {
    this.state.assignmentHistory.push({ issueId, developerId, timestamp: Date.now() })
    if (this.state.assignmentHistory.length > MAX_ASSIGNMENT_HISTORY) {
      this.state.assignmentHistory = this.state.assignmentHistory.slice(-MAX_ASSIGNMENT_HISTORY)
    }
  }

  getDeveloperWorkloads(): Array<{ developerId: string; name: string; currentLoad: number; capacity: number; utilization: number }> {
    return this.state.developers.map(d => ({
      developerId: d.id,
      name: d.name,
      currentLoad: d.currentLoad,
      capacity: d.weeklyCapacity,
      utilization: d.weeklyCapacity > 0 ? d.currentLoad / d.weeklyCapacity : 0,
    }))
  }

  balanceWorkload(issue: IssueForAssignment): AssignmentRecommendation {
    const recommendations = this.predictAssignees(issue, this.state.developers.length)
    if (recommendations.length === 0) throw new Error('No developers available')

    const minLoad = Math.min(...recommendations.map(r => r.developer.currentLoad))
    const leastLoaded = recommendations.filter(r => r.developer.currentLoad === minLoad)

    return leastLoaded.reduce((best, curr) =>
      curr.score > best.score ? curr : best
    )
  }

  getModelAccuracy(): number {
    if (this.state.feedbackHistory.length === 0) return 0
    const accepted = this.state.feedbackHistory.filter(f => f.wasAccepted).length
    return accepted / this.state.feedbackHistory.length
  }

  getExpertiseHeatmap(): Array<{ developerId: string; name: string; label: string; successRate: number; count: number }> {
    const heatmap: Array<{ developerId: string; name: string; label: string; successRate: number; count: number }> = []

    for (const dev of this.state.developers) {
      const byLabel: Record<string, { success: number; total: number }> = {}
      for (const res of dev.resolvedIssues) {
        for (const label of res.labels) {
          if (!byLabel[label]) byLabel[label] = { success: 0, total: 0 }
          byLabel[label].total++
          if (res.success) byLabel[label].success++
        }
      }
      for (const [label, data] of Object.entries(byLabel)) {
        heatmap.push({
          developerId: dev.id,
          name: dev.name,
          label,
          successRate: data.total > 0 ? data.success / data.total : 0,
          count: data.total,
        })
      }
    }

    return heatmap
  }

  getAssignmentStats(): { totalAssignments: number; uniqueDevelopers: number; avgPerDeveloper: number; accuracy: number } {
    const totalAssignments = this.state.assignmentHistory.length
    const uniqueDevs = new Set(this.state.assignmentHistory.map(a => a.developerId)).size
    return {
      totalAssignments,
      uniqueDevelopers: uniqueDevs,
      avgPerDeveloper: uniqueDevs > 0 ? totalAssignments / uniqueDevs : 0,
      accuracy: this.getModelAccuracy(),
    }
  }

  private buildReasoning(developer: DeveloperProfile, issue: IssueForAssignment, factors: ScoreFactors): string {
    const parts: string[] = []
    if (factors.expertise > 0.6) {
      parts.push(`strong expertise match for ${issue.labels.join(', ')}`)
    }
    if (factors.workload > 0.6) {
      parts.push('has available capacity')
    } else if (factors.workload < 0.3) {
      parts.push('currently has high workload')
    }
    if (factors.historicalFit > 0.6) {
      parts.push('strong historical success rate on similar issues')
    }
    if (factors.specialization > 0.6) {
      parts.push('specialized in this area')
    }
    return parts.length > 0
      ? `${developer.name} ${parts.join(', ')}`
      : `${developer.name} is available for assignment`
  }

  async save(): Promise<void> {
    await setStoredValue(STORAGE_KEY, this.state)
  }

  static async load(): Promise<PredictiveIssueAssigner> {
    try {
      const saved = await getStoredValue(STORAGE_KEY)
      if (saved) return new PredictiveIssueAssigner(saved as Partial<IssueAssignmentState>)
    } catch {
      // Fall back to default state
    }
    return new PredictiveIssueAssigner()
  }
}

let _instance: PredictiveIssueAssigner | null = null

export async function getIssueAssigner(): Promise<PredictiveIssueAssigner> {
  if (!_instance) {
    _instance = await PredictiveIssueAssigner.load()
  }
  return _instance
}

export function resetIssueAssigner(): void {
  _instance = null
}
