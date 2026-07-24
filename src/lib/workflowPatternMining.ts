"""
Workflow Pattern Mining and Automation Suggestion System

This module implements workflow pattern mining on user interaction sequences to identify
transparent automation opportunities. It builds upon existing pattern analysis capabilities
and extends them to capture recurring user actions across the Stellar dev dashboard.
"""

import { DetectedPattern } from './transactionPatternAnalysis'

export type WorkflowOperationType =
  | 'payment'
  | 'contract'
  | 'trustline'
  | 'account_operation'
  | 'data_query'
  | 'export'
  | 'notification'
  | 'authentication'
  | 'validation'
  | 'other'

export interface WorkflowStep {
  id: string
  action: string
  operation?: WorkflowOperationType
  parameters?: Record<string, any>
  timestamp: number
  userId: string
  sessionId?: string
  metadata?: Record<string, any>
}

export interface WorkflowSequence {
  id: string
  userId: string
  steps: WorkflowStep[]
  startTime: number
  endTime?: number
  category?: WorkflowCategory
  context?: WorkflowContext
}

export type WorkflowCategory =
  | 'payments'
  | 'asset_management'
  | 'contract_interaction'
  | 'account_management'
  | 'portfolio_analysis'
  | 'data_export'
  | 'administration'
  | 'trading'
  | 'compliance'
  | 'analytics'

export interface WorkflowContext {
  network?: 'mainnet' | 'testnet' | 'futurenet'
  assetTypes?: string[]
  counterparties?: string[]
  timePatterns?: TimePatternAnalysis
  userPreferences?: Record<string, any>
}

export interface TimePatternAnalysis {
  averageInterval: number
  peakTimes: PeakTime[]
  frequency: 'daily' | 'weekly' | 'monthly' | 'irregular'
  dayOfWeekPattern?: Record<number, number>
}

export interface PeakTime {
  hour: number
  dayOfWeek: number
  frequency: number
}

export interface AutomationOpportunity {
  id: string
  title: string
  description: string
  category: AutomationCategory
  confidence: number
  frequency: number
  estimatedTimeSaved: string
  complexity: 'low' | 'medium' | 'high'
  steps: AutomationStep[]
  suggestedActions: SuggestedAction[]
  customizability: CustomizabilityOptions
  userApprovalRequired: boolean
  implementation?: AutomationImplementation
}

export type AutomationCategory =
  | 'repetitive_actions'
  | 'batch_operations'
  | 'scheduled_tasks'
  | 'conditional_logic'
  | 'multi_step_processes'
  | 'data_operations'

export interface AutomationStep {
  id: string
  action: string
  parameters: Record<string, any>
  preconditions?: string
  successConditions?: string
  order: number
}

export interface SuggestedAction {
  id: string
  type: 'automate' | 'modify' | 'hide'
  label: string
  description: string
  icon?: string
}

export interface CustomizabilityOptions {
  schedule: boolean
  parameters: boolean
  conditions: boolean
  outputs: boolean
}

export interface AutomationImplementation {
  id: string
  type: 'simple' | 'conditional' | 'scheduled' | 'event_driven'
  config: Record<string, any>
  capabilities: string[]
}

export interface WorkflowPattern {
  id: string
  name: string
  description: string
  pattern: string
  frequency: number
  affectedUsers: number
  averageTimePerExecution: number
  estimatedSavings: number
}

export interface WorkflowAnalytics {
  totalWorkflows: number
  automationOpportunityCount: number
  averageSequenceLength: number
  mostCommonOperations: WorkflowOperationTypeCount[]
  automationReadinessScore: number
}

export interface WorkflowOperationTypeCount {
  type: WorkflowOperationType
  count: number
  percentage: number
}

export class WorkflowPatternMiner {
  private sequences: WorkflowSequence[]

  constructor() {
    this.sequences = []
  }

  addSequence(sequence: WorkflowSequence): void {
    this.sequences.push(sequence)
  }

  minePatterns(
    minSupport: number = 0.2,
    minConfidence: number = 0.7,
    maxPatternLength: number = 5
  ): WorkflowPattern[] {
    const patterns: WorkflowPattern[] = []

    // Extract frequent sequences using simple frequency-based approach
    const sequenceCounts = this.countSequencesByPattern()

    for (const [pattern, count] of Object.entries(sequenceCounts)) {
      const frequency = count / this.sequences.length

      if (frequency >= minSupport && pattern.split('>').length <= maxPatternLength) {
        // Calculate confidence (how often this pattern appears in completed workflows)
        const confidence = this.calculatePatternConfidence(pattern, count)

        if (confidence >= minConfidence) {
          const patternObj: WorkflowPattern = {
            id: this.generatePatternId(pattern),
            name: this.generatePatternName(pattern),
            description: this.generatePatternDescription(pattern),
            pattern: pattern,
            frequency: frequency,
            affectedUsers: count,
            averageTimePerExecution: this.calculateAverageExecutionTime(pattern),
            estimatedSavings: this.calculateEstimatedSavings(pattern),
          }

          patterns.push(patternObj)
        }
      }
    }

    return patterns.sort((a, b) => b.frequency - a.frequency)
  }

  generateOpportunities(patterns: WorkflowPattern[]): AutomationOpportunity[] {
    const opportunities: AutomationOpportunity[] = []n
    let oppId = 1

    for (const pattern of patterns) {
      if (pattern.frequency >= 0.3) { // Focus on patterns that occur 30%+ of the time
        const opportunity: AutomationOpportunity = {
          id: `opp-${oppId++}`,
          title: this.suggestAutomationTitle(pattern),
          description: this.generateOpportunityDescription(pattern),
          category: this.categorizeOpportunity(pattern),
          confidence: Math.round(pattern.frequency * 100),
          frequency: pattern.frequency,
          estimatedTimeSaved: this.estimateTimeSaved(pattern),
          complexity: this.assessComplexity(pattern),
          steps: this.extractAutomationSteps(pattern),
          suggestedActions: [
            { type: 'automate', label: 'Automate', description: 'Create automation for this pattern' },
            { type: 'modify', label: 'Modify', description: 'Adjust pattern before automating' },
            { type: 'hide', label: 'Hide', description: 'Exclude this action from automation' },
          ],
          customizability: {
            schedule: true,
            parameters: true,
            conditions: true,
            outputs: true,
          },
          userApprovalRequired: true,
        }

        opportunities.push(opportunity)
      }
    }

    return opportunities
  }

  private countSequencesByPattern(): Record<string, number> {
    const patternCounts: Record<string, number> = {}

    for (const sequence of this.sequences) {
      const actions = sequence.steps.map(step => step.action)
      const pattern = actions.join(' > ')

      patternCounts[pattern] = (patternCounts[pattern] || 0) + 1
    }

    return patternCounts
  }

  private calculatePatternConfidence(pattern: string, count: number): number {
    // Simple heuristic: patterns that are complete (not partial) have higher confidence
    const actions = pattern.split(' > ')
    const isComplete = actions.length >= 3

    return isComplete ? 0.8 + (count / this.sequences.length) * 0.2 : 0.5
  }

  private generatePatternId(pattern: string): string {
    return `pattern-${Buffer.from(pattern).toString('base64').substring(0, 8)}`
  }

  private generatePatternName(pattern: string): string {
    const actionMap: Record<string, string> = {
      'payment': 'Payment',
      'contract': 'Contract Call',
      'trustline': 'Trustline Operation',
      'account_operation': 'Account Operation',
      'data_query': 'Data Query',
      'export': 'Export',
      'notification': 'Notification',
      'authentication': 'Authentication',
      'validation': 'Validation',
      'other': 'Other Action',
    }

    const actions = pattern.split(' > ')
    const actionNames = actions.map(action => actionMap[action] || action)

    if (actionNames.length === 1) {
      return `${actionNames[0]} Pattern`
    }

    return `${actionNames[0]} → ${actionNames[actionNames.length - 1]} Chain`
  }

  private generatePatternDescription(pattern: string): string {
    return `Sequence: ${pattern.replace(/>/g, ' → ')}`
  }

  private generateOpportunityDescription(pattern: WorkflowPattern): string {
    return `${pattern.estimatedSavings.toLocaleString()} 'time units' can be saved by automating this pattern. It occurs ${pattern.frequency * 100}% of the time.`
  }

  private categorizeOpportunity(pattern: WorkflowPattern): AutomationCategory {
    if (pattern.estimatedSavings > 100) {
      return 'batch_operations'
    }

    if (pattern.pattern.includes('payment') || pattern.pattern.includes('trustline')) {
      return 'repetitive_actions'
    }

    if (pattern.pattern.split('>').length > 3) {
      return 'multi_step_processes'
    }

    return 'repetitive_actions'
  }

  private estimateTimeSaved(pattern: WorkflowPattern): string {
    const hours = Math.round(pattern.estimatedSavings / 60)

    if (hours > 24) {
      return `${Math.round(hours / 24)} days`
    } else if (hours > 1) {
      return `${hours} hours`
    } else if (Math.round(pattern.estimatedSavings) > 0) {
      return `${Math.round(pattern.estimatedSavings)} minutes`
    }

    return '< 1 minute'
  }

  private assessComplexity(pattern: WorkflowPattern): 'low' | 'medium' | 'high' {
    if (pattern.pattern.split('>').length <= 2) {
      return 'low'
    } else if (pattern.pattern.split('>').length <= 4) {
      return 'medium'
    } else {
      return 'high'
    }
  }

  private extractAutomationSteps(pattern: WorkflowPattern): AutomationStep[] {
    const actions = pattern.pattern.split(' > ')

    return actions.map((action, index) => ({
      id: `step-${index + 1}`,
      action: action,
      parameters: this.extractParameters(action),
      order: index + 1,
    }))
  }

  private extractParameters(action: string): Record<string, any> {
    const paramMap: Record<string, any> = {
      'payment': { destination: 'user-specified', amount: 'variable' },
      'contract': { contractId: 'user-specified', function: 'variable' },
      'trustline': { asset: 'user-specified', limit: 'variable' },
      'account_operation': { operation: 'variable' },
      'data_query': { query: 'variable', filters: 'user-defined' },
      'export': { format: 'user-specified', dataScope: 'selected' },
      'notification': { type: 'user-defined', recipients: 'custom' },
      'authentication': { method: 'configured', targets: 'user-defined' },
      'validation': { rules: 'user-defined', thresholds: 'configurable' },
      'other': { parameters: 'context-dependent' },
    }

    const actionType = Object.keys(paramMap).find(key => action.includes(key)) || 'other'

    return paramMap[actionType] || {}
  }

  private calculateAverageExecutionTime(pattern: string): number {
    return Math.round((pattern.split('>').length * 2 + 3) * 10) / 10
  }

  private calculateEstimatedSavings(pattern: WorkflowPattern): number {
    const actionCount = pattern.pattern.split('>').length
    const baseSaving = actionCount * 15 // 15 minutes per action saved
    const complexityFactor = 1 + (actionCount - 1) * 0.5

    return baseSaving * complexityFactor
  }

  private suggestAutomationTitle(pattern: WorkflowPattern): string {
    const actionMap: Record<string, string> = {
      'payment': 'Batch Payment Setup',
      'contract': 'Contract Batch Caller',
      'trustline': 'Trustline Automation',
      'account_operation': 'Account Operations Batch',
      'data_query': 'Data Export Automation',
      'export': 'Report Generator',
      'notification': 'Custom Notification System',
      'authentication': 'Secure Auth Automation',
      'validation': 'Validation Pipeline',
      'other': 'Operation Automation',
    }

    const actionType = Object.keys(actionMap).find(key => pattern.pattern.includes(key)) || 'other'

    return actionMap[actionType]
  }
}