"""
Automation Builder - No-code automation creation for Starknet workflows.

This module provides a no-code automation builder interface for creating,
configuring, and managing automations based on workflow patterns.
"""

import { AutomationImplementation, AutomationOpportunity } from './workflowPatternMining'

export interface Automation {
  id: string
  name: string
  description: string
  implementation: AutomationImplementation
  enabled: boolean
  lastExecuted?: number
  executionCount: number
  parameters: Record<string, any>
  schedule?: AutomationSchedule
  conditions?: AutomationCondition[]
  actions: AutomationAction[]
}

export interface AutomationSchedule {
  enabled: boolean
  type: 'interval' | 'cron' | 'event' | 'manual'
  interval?: {
    value: number
    unit: 'second' | 'minute' | 'hour' | 'day' | 'week'
  }
  cron?: string
  event?: string
}

export interface AutomationCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'exists'
  value: any
}

export interface AutomationAction {
  id: string
  type: string
  description: string
  parameters: Record<string, any>
  dependencies?: string[]
}

export interface AutomationContext {
  userId: string
  accountId?: string
  network?: 'mainnet' | 'testnet' | 'futurenet'
  triggerId?: string
  metadata?: Record<string, any>
}

export class AutomationBuilder {
  private automations: Automation[]
  private nextId: number

  constructor() {
    this.automations = []
    this.nextId = 1
  }

  createAutomation(
    opportunity: AutomationOpportunity,
    config: Partial<AutomationImplementation>,
    name: string,
    actions: AutomationAction[]
  ): Automation {
    const id = `auto-${this.nextId++}`

    const automation: Automation = {
      id,
      name,
      description: opportunity.description,
      implementation: {
        id: `impl-${this.nextId++}`, // Unique implementation ID
        type: opportunity.implementation?.type || 'simple',
        config: config,
        capabilities: this.generateCapabilities(opportunity),
      },
      enabled: false,
      executionCount: 0,
      parameters: this.extractParameters(opportunity, config),
      actions,
    }

    this.automations.push(automation)
    return automation
  }

  configureSchedule(automationId: string, schedule: AutomationSchedule): void {
    const automation = this.automations.find(a => a.id === automationId)
    if (automation) {
      automation.schedule = schedule
    }
  }

  configureConditions(automationId: string, conditions: AutomationCondition[]): void {
    const automation = this.automations.find(a => a.id === automationId)
    if (automation) {
      automation.conditions = conditions
    }
  }

  updateAutomationStatus(automationId: string, enabled: boolean): void {
    const automation = this.automations.find(a => a.id === automationId)
    if (automation) {
      automation.enabled = enabled
    }
  }

  getAutomations(filters?: {
    enabled?: boolean
    name?: string
    category?: string
  }): Automation[] {
    let filtered = [...this.automations]

    if (filters?.enabled !== undefined) {
      filtered = filtered.filter(a => a.enabled === filters.enabled)
    }

    if (filters?.name) {
      filtered = filtered.filter(a => a.name.toLowerCase().includes(filters.name!.toLowerCase()))
    }

    return filtered
  }

  getAutomation(id: string): Automation | undefined {
    return this.automations.find(a => a.id === id)
  }

  async executeAutomation(automationId: string, context: AutomationContext): Promise<AutomationExecution> {
    const automation = this.getAutomation(automationId)
    if (!automation) {
      throw new Error(`Automation not found: ${automationId}`)
    }

    if (!automation.enabled) {
      throw new Error('Cannot execute disabled automation')
    }

    const execution: AutomationExecution = {
      id: `exec-${this.nextId++}-${Date.now()}`, // Ensure uniqueness
      automationId,
      status: 'running',
      startTime: Date.now(),
      logs: [`Automation ${automation.name} started`],
    }

    try {
      await this.evaluateConditions(automation, context)
      await this.runActions(automation, context, execution)
      automation.lastExecuted = Date.now()
      automation.executionCount += 1
      execution.status = 'completed'
      execution.result = {
        success: true,
        message: 'Automation executed successfully',
        metrics: {
          executionTime: Date.now() - execution.startTime,
          actionsExecuted: automation.actions.length,
          conditionsEvaluated: automation.conditions?.length || 0,
        },
      }
    } catch (error) {
      execution.status = 'failed'
      execution.result = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          executionTime: Date.now() - execution.startTime,
        },
      }
    }

    execution.endTime = Date.now()
    execution.progress = execution.status === 'completed' ? 100 : 0

    return execution
  }

  private extractParameters(opportunity: AutomationOpportunity, config: Partial<AutomationImplementation>): Record<string, any> {
    const params: Record<string, any> = {}

    opportunity.steps.forEach(step => {
      if (step.parameters) {
        params[step.action] = step.parameters
      }
    })

    if (config) {
      params.config = config
    }

    return params
  }

  private generateCapabilities(opportunity: AutomationOpportunity): string[] {
    const capabilities: string[] = []

    if (opportunity.customizability.schedule) {
      capabilities.push('scheduled_execution')
    }

    if (opportunity.customizability.parameters) {
      capabilities.push('parameter_customization')
    }

    if (opportunity.customizability.conditions) {
      capabilities.push('conditional_logic')
    }

    if (opportunity.customizability.outputs) {
      capabilities.push('output_management')
    }

    return capabilities
  }

  private async evaluateConditions(automation: Automation, context: AutomationContext): Promise<void> {
    if (!automation.conditions || automation.conditions.length === 0) {
      return
    }

    for (const condition of automation.conditions) {
      const fieldValue = this.evaluateFieldPath(context, condition.field)

      if (!this.evaluateCondition(fieldValue, condition.operator, condition.value)) {
        throw new Error(`Automation condition failed: ${condition.field} ${condition.operator} ${condition.value}`)
      }
    }
  }

  private evaluateFieldPath(context: AutomationContext, path: string): any {
    const parts = path.split('.')
    let value: any = context

    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined
      }
      value = value[part]
    }

    return value
  }

  private evaluateCondition(value: any, operator: string, conditionValue: any): boolean {
    switch (operator) {
      case 'equals':
        return value === conditionValue
      case 'not_equals':
        return value !== conditionValue
      case 'greater_than':
        return value > conditionValue
      case 'less_than':
        return value < conditionValue
      case 'contains':
        return typeof value === 'string' && value.includes(conditionValue)
      case 'exists':
        return value !== undefined && value !== null
      default:
        return false
    }
  }

  private async runActions(automation: Automation, context: AutomationContext, execution: AutomationExecution): Promise<void> {
    for (let i = 0; i < automation.actions.length; i++) {
      const action = automation.actions[i]
      execution.logs.push(`Executing action ${i + 1}: ${action.description}`)

      try {
        await this.executeAction(action, context, execution)
      } catch (error) {
        execution.logs.push(`Action ${action.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        throw error
      }
    }
  }

  private async executeAction(action: AutomationAction, context: AutomationContext, execution: AutomationExecution): Promise<void> {
    execution.progress = Math.round(((execution.logs.length - 1) / automation.actions.length) * 100)

    // Add comprehensive logging
    execution.logs.push(`Action ${action.id}: parameters configured - ${JSON.stringify(action.parameters)}`)

    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 100))

    execution.logs.push(`Action ${action.id}: successfully executed`)
  }
}

export interface AutomationExecution {
  id: string
  automationId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  startTime: number
  endTime?: number
  result?: ExecutionResult
  logs: string[]
}

export interface ExecutionResult {
  success: boolean
  message: string
  metrics: Record<string, any>
}
