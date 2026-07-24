"""
Unit tests for workflow pattern mining and automation system.
"""

import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowPatternMiner } from './workflowPatternMining'
import { AutomationBuilder } from './automationBuilder'

// Mock data for testing
const mockSequence = {
  id: 'seq-1',
  userId: 'user-1',
  steps: [
    { id: 'step-1', action: 'payment', parameters: { amount: '100' }, timestamp: Date.now() - 86400000, userId: 'user-1' },
    { id: 'step-2', action: 'trustline', parameters: { asset: 'USDC' }, timestamp: Date.now() - 43200000, userId: 'user-1' },
    { id: 'step-3', action: 'payment', parameters: { amount: '200' }, timestamp: Date.now() - 3600000, userId: 'user-1' },
  ],
  startTime: Date.now() - 86400000,
}

const mockSequence2 = {
  id: 'seq-2',
  userId: 'user-2',
  steps: [
    { id: 'step-1', action: 'payment', parameters: { amount: '50' }, timestamp: Date.now() - 86400000, userId: 'user-2' },
    { id: 'step-2', action: 'contract', parameters: { function: 'transfer' }, timestamp: Date.now() - 43200000, userId: 'user-2' },
  ],
  startTime: Date.now() - 86400000,
}

describe('WorkflowPatternMiner', () => {
  let miner: WorkflowPatternMiner

  beforeEach(() => {
    miner = new WorkflowPatternMiner()
    miner.addSequence(mockSequence)
    miner.addSequence(mockSequence2)
  })

  it('should mine patterns from sequences', () => {
    const patterns = miner.minePatterns()
    expect(patterns.length).toBeGreaterThan(0)
    expect(patterns[0].frequency).toBeGreaterThanOrEqual(0.5)
  })

  it('should generate automation opportunities', () => {
    const patterns = miner.minePatterns()
    const opportunities = miner.generateOpportunities(patterns)
    expect(opportunities.length).toBeGreaterThan(0)
    expect(opportunities[0].confidence).toBeGreaterThanOrEqual(30)
    expect(opportunities[0].frequency).toBeGreaterThanOrEqual(0.3)
  })

  it('should create automation steps from patterns', () => {
    const patterns = miner.minePatterns()
    const opportunities = miner.generateOpportunities(patterns)

    expect(opportunities.length).toBeGreaterThan(0)
    expect(opportunities[0].steps.length).toBeGreaterThanOrEqual(1)
    expect(opportunities[0].steps[0].action).toBeDefined()
  })
})

describe('AutomationBuilder', () => {
  let builder: AutomationBuilder
  let mockOpportunity: any

  beforeEach(() => {
    builder = new AutomationBuilder()
    mockOpportunity = {
      id: 'opp-1',
      title: 'Test Automation',
      description: 'A test automation opportunity',
      category: 'repetitive_actions',
      confidence: 85,
      frequency: 0.5,
      estimatedTimeSaved: '1 hour',
      complexity: 'low',
      steps: [
        { id: 'step-1', action: 'payment', parameters: { amount: '100' }, order: 1 },
        { id: 'step-2', action: 'trustline', parameters: { asset: 'USDC' }, order: 2 },
      ],
      suggestedActions: [],
      customizability: {
        schedule: true,
        parameters: true,
        conditions: false,
        outputs: true,
      },
      userApprovalRequired: true,
    }
  })

  it('should create an automation from opportunity', () => {
    const automation = builder.createAutomation(
      mockOpportunity,
      { type: 'simple', config: {}, capabilities: ['scheduled_execution'] },
      'Test Payment Automation',
      []
    )

    expect(automation.id).toBeDefined()
    expect(automation.name).toBe('Test Payment Automation')
    expect(automation.enabled).toBe(false)
    expect(automation.actions).toHaveLength(0)
  })

  it('should update automation status', () => {
    const automation = builder.createAutomation(
      mockOpportunity,
      { type: 'simple', config: {}, capabilities: ['scheduled_execution'] },
      'Test Automation',
      []
    )

    expect(automation.enabled).toBe(false)

    builder.updateAutomationStatus(automation.id, true)

    expect(automation.enabled).toBe(true)
  })

  it('should get automations with filters', () => {
    builder.createAutomation(
      mockOpportunity,
      { type: 'simple', config: {}, capabilities: ['scheduled_execution'] },
      'Enabled Automation',
      []
    )

    builder.createAutomation(
      mockOpportunity,
      { type: 'simple', config: {}, capabilities: ['scheduled_execution'] },
      'Disabled Automation',
      []
    )

    builder.updateAutomationStatus('auto-2', false)

    const enabled = builder.getAutomations({ enabled: true })
    const disabled = builder.getAutomations({ enabled: false })

    expect(enabled).toHaveLength(1)
    expect(enabled[0].name).toBe('Enabled Automation')
    expect(disabled).toHaveLength(1)
    expect(disabled[0].name).toBe('Disabled Automation')
  })
})
