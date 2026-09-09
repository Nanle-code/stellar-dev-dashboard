import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PredictiveIssueAssigner,
  resetIssueAssigner,
  getIssueAssigner,
  DeveloperProfile,
  IssueForAssignment,
  AssignmentFeedback,
} from '../issueAssignment'

vi.mock('../storage', () => ({
  getStoredValue: vi.fn().mockResolvedValue(null),
  setStoredValue: vi.fn().mockResolvedValue(undefined),
}))

function makeDeveloper(overrides: Partial<DeveloperProfile> = {}): DeveloperProfile {
  return {
    id: 'dev-1',
    name: 'Alice',
    skills: ['rust', 'blockchain', 'smart-contract'],
    weeklyCapacity: 40,
    currentLoad: 10,
    resolvedIssues: [],
    ...overrides,
  }
}

function makeIssue(overrides: Partial<IssueForAssignment> = {}): IssueForAssignment {
  return {
    id: 'issue-1',
    title: 'Fix wallet connection bug',
    description: 'Users cannot connect their wallet',
    labels: ['bug', 'wallet'],
    priority: 'high',
    createdAt: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

describe('PredictiveIssueAssigner', () => {
  let assigner: PredictiveIssueAssigner

  beforeEach(() => {
    resetIssueAssigner()
    assigner = new PredictiveIssueAssigner()
  })

  describe('developer management', () => {
    it('should register a new developer', () => {
      assigner.registerDeveloper(makeDeveloper())
      const state = assigner.getState()
      expect(state.developers).toHaveLength(1)
      expect(state.developers[0].name).toBe('Alice')
    })

    it('should update an existing developer on re-registration', () => {
      assigner.registerDeveloper(makeDeveloper())
      assigner.registerDeveloper(makeDeveloper({ name: 'Alice Updated', skills: ['rust', 'react'] }))
      const state = assigner.getState()
      expect(state.developers).toHaveLength(1)
      expect(state.developers[0].name).toBe('Alice Updated')
      expect(state.developers[0].skills).toEqual(['rust', 'react'])
    })

    it('should remove a developer', () => {
      assigner.registerDeveloper(makeDeveloper())
      assigner.registerDeveloper(makeDeveloper({ id: 'dev-2', name: 'Bob' }))
      assigner.removeDeveloper('dev-1')
      const state = assigner.getState()
      expect(state.developers).toHaveLength(1)
      expect(state.developers[0].id).toBe('dev-2')
    })

    it('should start new developers with empty resolved issues', () => {
      assigner.registerDeveloper(makeDeveloper())
      expect(assigner.getState().developers[0].resolvedIssues).toEqual([])
    })
  })

  describe('predictAssignees', () => {
    it('should return empty array when no developers registered', () => {
      const results = assigner.predictAssignees(makeIssue())
      expect(results).toEqual([])
    })

    it('should return recommendations sorted by score descending', () => {
      assigner.registerDeveloper(makeDeveloper({ id: 'dev-1', name: 'Alice', skills: ['rust', 'blockchain'] }))
      assigner.registerDeveloper(makeDeveloper({ id: 'dev-2', name: 'Bob', skills: ['react', 'frontend'] }))

      const issue = makeIssue({ labels: ['bug', 'rust'] })
      const results = assigner.predictAssignees(issue)

      expect(results).toHaveLength(2)
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
    })

    it('should prefer developers with matching skills', () => {
      assigner.registerDeveloper(makeDeveloper({ id: 'dev-1', name: 'Alice', skills: ['rust', 'blockchain'] }))
      assigner.registerDeveloper(makeDeveloper({ id: 'dev-2', name: 'Bob', skills: ['react', 'css'] }))

      const issue = makeIssue({ labels: ['bug', 'rust', 'blockchain'] })
      const results = assigner.predictAssignees(issue)

      expect(results[0].developer.id).toBe('dev-1')
    })

    it('should respect topN parameter', () => {
      for (let i = 0; i < 5; i++) {
        assigner.registerDeveloper(makeDeveloper({ id: `dev-${i}`, name: `Dev ${i}` }))
      }

      const results = assigner.predictAssignees(makeIssue(), 2)
      expect(results).toHaveLength(2)
    })
  })

  describe('expertise scoring', () => {
    it('should give higher score to developer with matching skills', () => {
      const rustDev = makeDeveloper({ id: 'dev-1', skills: ['rust'] })
      const reactDev = makeDeveloper({ id: 'dev-2', skills: ['react'] })

      assigner.registerDeveloper(rustDev)
      assigner.registerDeveloper(reactDev)

      const issue = makeIssue({ labels: ['bug', 'rust'] })
      const results = assigner.predictAssignees(issue)

      const rustScore = results.find(r => r.developer.id === 'dev-1')
      const reactScore = results.find(r => r.developer.id === 'dev-2')
      expect(rustScore!.score).toBeGreaterThan(reactScore!.score)
    })

    it('should return baseline score when no skills match', () => {
      assigner.registerDeveloper(makeDeveloper({ id: 'dev-1', skills: ['design'] }))
      const issue = makeIssue({ labels: ['rust'] })
      const results = assigner.predictAssignees(issue)
      expect(results[0].factors.expertise).toBeGreaterThanOrEqual(0.1)
    })
  })

  describe('workload scoring', () => {
    it('should prefer developers with lower current load', () => {
      assigner.registerDeveloper(makeDeveloper({ id: 'dev-1', name: 'Free', currentLoad: 5, skills: ['rust'] }))
      assigner.registerDeveloper(makeDeveloper({ id: 'dev-2', name: 'Busy', currentLoad: 35, skills: ['rust'] }))

      const issue = makeIssue({ labels: ['rust'] })
      const results = assigner.predictAssignees(issue)

      expect(results[0].developer.id).toBe('dev-1')
    })

    it('should give zero workload score when at full capacity', () => {
      assigner.registerDeveloper(makeDeveloper({ currentLoad: 40, weeklyCapacity: 40 }))
      const issue = makeIssue({ labels: ['rust'] })
      const results = assigner.predictAssignees(issue)
      expect(results[0].factors.workload).toBe(0)
    })

    it('should handle zero capacity gracefully', () => {
      assigner.registerDeveloper(makeDeveloper({ currentLoad: 0, weeklyCapacity: 0 }))
      const issue = makeIssue({ labels: ['rust'] })
      const results = assigner.predictAssignees(issue)
      expect(results[0].factors.workload).toBeGreaterThanOrEqual(0)
    })
  })

  describe('historical fit scoring', () => {
    it('should benefit from past success on similar issues', () => {
      const dev = makeDeveloper({
        id: 'dev-1',
        resolvedIssues: [
          { issueId: 'past-1', labels: ['bug', 'wallet'], success: true, timeSpent: 10, timestamp: 1000 },
          { issueId: 'past-2', labels: ['bug', 'wallet'], success: true, timeSpent: 20, timestamp: 2000 },
        ],
      })
      assigner.registerDeveloper(dev)

      const issue = makeIssue({ labels: ['bug', 'wallet'] })
      const results = assigner.predictAssignees(issue)
      expect(results[0].factors.historicalFit).toBeGreaterThan(0.5)
    })

    it('should return baseline score with no history', () => {
      assigner.registerDeveloper(makeDeveloper())
      const issue = makeIssue()
      const results = assigner.predictAssignees(issue)
      expect(results[0].factors.historicalFit).toBe(0.15)
    })
  })

  describe('feedback learning', () => {
    it('should record feedback and update resolved issues on success', () => {
      assigner.registerDeveloper(makeDeveloper())
      const feedback: AssignmentFeedback = {
        issueId: 'issue-1',
        developerId: 'dev-1',
        wasAccepted: true,
        resolutionSuccess: true,
        timestamp: Date.now(),
      }
      assigner.recordFeedback(feedback)
      expect(assigner.getState().feedbackHistory).toHaveLength(1)

      const dev = assigner.getState().developers.find(d => d.id === 'dev-1')!
      expect(dev.resolvedIssues).toHaveLength(1)
      expect(dev.resolvedIssues[0].issueId).toBe('issue-1')
    })

    it('should not add duplicate resolved issues', () => {
      assigner.registerDeveloper(makeDeveloper())
      const feedback: AssignmentFeedback = {
        issueId: 'issue-1',
        developerId: 'dev-1',
        wasAccepted: true,
        resolutionSuccess: true,
        timestamp: Date.now(),
      }
      assigner.recordFeedback(feedback)
      assigner.recordFeedback(feedback)
      const dev = assigner.getState().developers.find(d => d.id === 'dev-1')!
      expect(dev.resolvedIssues).toHaveLength(1)
    })

    it('should limit feedback history', () => {
      assigner.registerDeveloper(makeDeveloper())
      const maxHistory = 1000
      for (let i = 0; i < maxHistory + 50; i++) {
        assigner.recordFeedback({
          issueId: `issue-${i}`,
          developerId: 'dev-1',
          wasAccepted: true,
          resolutionSuccess: true,
          timestamp: i,
        })
      }
      expect(assigner.getState().feedbackHistory.length).toBeLessThanOrEqual(maxHistory)
    })
  })

  describe('recordAssignment', () => {
    it('should record assignment history', () => {
      assigner.recordAssignment('issue-1', 'dev-1')
      assigner.recordAssignment('issue-2', 'dev-2')
      const history = assigner.getState().assignmentHistory
      expect(history).toHaveLength(2)
      expect(history[0].issueId).toBe('issue-1')
    })

    it('should limit assignment history', () => {
      const maxHistory = 2000
      for (let i = 0; i < maxHistory + 50; i++) {
        assigner.recordAssignment(`issue-${i}`, 'dev-1')
      }
      expect(assigner.getState().assignmentHistory.length).toBeLessThanOrEqual(maxHistory)
    })
  })

  describe('workload balancing', () => {
    it('should pick the best-scoring least-loaded developer', () => {
      assigner.registerDeveloper(makeDeveloper({ id: 'dev-1', name: 'Alice', currentLoad: 30, skills: ['rust'] }))
      assigner.registerDeveloper(makeDeveloper({ id: 'dev-2', name: 'Bob', currentLoad: 5, skills: ['rust'] }))

      const result = assigner.balanceWorkload(makeIssue({ labels: ['rust'] }))
      expect(result.developer.id).toBe('dev-2')
    })

    it('should throw when no developers available', () => {
      expect(() => assigner.balanceWorkload(makeIssue())).toThrow('No developers available')
    })
  })

  describe('analytics', () => {
    it('should return developer workloads with utilization', () => {
      assigner.registerDeveloper(makeDeveloper({ weeklyCapacity: 40, currentLoad: 20 }))
      const workloads = assigner.getDeveloperWorkloads()
      expect(workloads).toHaveLength(1)
      expect(workloads[0].utilization).toBe(0.5)
    })

    it('should compute model accuracy from feedback', () => {
      assigner.registerDeveloper(makeDeveloper())
      expect(assigner.getModelAccuracy()).toBe(0)

      assigner.recordFeedback({ issueId: 'i1', developerId: 'dev-1', wasAccepted: true, resolutionSuccess: true, timestamp: 1 })
      assigner.recordFeedback({ issueId: 'i2', developerId: 'dev-1', wasAccepted: false, resolutionSuccess: false, timestamp: 2 })
      expect(assigner.getModelAccuracy()).toBe(0.5)
    })

    it('should generate expertise heatmap', () => {
      const dev = makeDeveloper({
        resolvedIssues: [
          { issueId: 'i1', labels: ['bug', 'wallet'], success: true, timeSpent: 10, timestamp: 1 },
          { issueId: 'i2', labels: ['bug', 'wallet'], success: false, timeSpent: 20, timestamp: 2 },
        ],
      })
      assigner.registerDeveloper(dev)
      const heatmap = assigner.getExpertiseHeatmap()
      expect(heatmap.length).toBeGreaterThan(0)
      const walletEntry = heatmap.find(h => h.label === 'wallet')
      expect(walletEntry).toBeDefined()
      expect(walletEntry!.successRate).toBe(0.5)
    })

    it('should return assignment stats', () => {
      assigner.registerDeveloper(makeDeveloper({ id: 'dev-1' }))
      assigner.registerDeveloper(makeDeveloper({ id: 'dev-2' }))
      assigner.recordAssignment('i1', 'dev-1')
      assigner.recordAssignment('i2', 'dev-2')
      assigner.recordAssignment('i3', 'dev-1')

      const stats = assigner.getAssignmentStats()
      expect(stats.totalAssignments).toBe(3)
      expect(stats.uniqueDevelopers).toBe(2)
      expect(stats.avgPerDeveloper).toBe(1.5)
    })
  })

  describe('persistence', () => {
    it('should save and load state', async () => {
      const { setStoredValue, getStoredValue } = await import('../storage')

      assigner.registerDeveloper(makeDeveloper())
      await assigner.save()
      expect(setStoredValue).toHaveBeenCalledWith('issue-assignment:state', expect.any(Object))

      vi.mocked(getStoredValue).mockResolvedValueOnce({
        developers: [makeDeveloper({ id: 'dev-loaded', name: 'Loaded' })],
        feedbackHistory: [],
        assignmentHistory: [],
        lastTrainingRun: 0,
      })
      const loaded = await PredictiveIssueAssigner.load()
      expect(loaded.getState().developers[0].name).toBe('Loaded')
    })

    it('should return fresh instance on load failure', async () => {
      const { getStoredValue } = await import('../storage')
      vi.mocked(getStoredValue).mockRejectedValueOnce(new Error('storage error'))
      const loaded = await PredictiveIssueAssigner.load()
      expect(loaded.getState().developers).toEqual([])
    })
  })

  describe('singleton', () => {
    it('should return the same instance via getIssueAssigner', async () => {
      const instance1 = await getIssueAssigner()
      const instance2 = await getIssueAssigner()
      expect(instance1).toBe(instance2)
    })

    it('should create a new instance after reset', async () => {
      const instance1 = await getIssueAssigner()
      resetIssueAssigner()
      const instance2 = await getIssueAssigner()
      expect(instance1).not.toBe(instance2)
    })
  })
})
