/**
 * Starter alert rule templates for common developer incidents.
 */

import type {
  AlertRule,
  ExecutionFrequency,
  FeeSpikeConfig,
  RpcLatencyConfig,
  SubmissionFailuresConfig,
} from '../types/alerts'

export type AlertRuleTemplateId = 'fee_spike' | 'submission_failures' | 'rpc_latency'

export interface AlertRuleTemplate {
  id: AlertRuleTemplateId
  name: string
  description: string
  type: AlertRule['type']
  defaultConfig: FeeSpikeConfig | SubmissionFailuresConfig | RpcLatencyConfig
  defaultFrequency: ExecutionFrequency
  requiredMetrics: string[]
}

export const ALERT_RULE_TEMPLATES: Record<AlertRuleTemplateId, AlertRuleTemplate> = {
  fee_spike: {
    id: 'fee_spike',
    name: 'Fee Spike',
    description: 'Alert when observed base fees exceed the recent baseline by a configured multiplier.',
    type: 'fee_spike',
    defaultConfig: {
      multiplier: 2,
      windowSeconds: 900,
      minSamples: 5,
    },
    defaultFrequency: 60,
    requiredMetrics: ['business.fee.stroops'],
  },
  submission_failures: {
    id: 'submission_failures',
    name: 'Failed Submissions',
    description: 'Alert when failed transaction submissions exceed a threshold within a time window.',
    type: 'submission_failures',
    defaultConfig: {
      failureCountThreshold: 3,
      windowSeconds: 300,
    },
    defaultFrequency: 60,
    requiredMetrics: ['business.tx.failure'],
  },
  rpc_latency: {
    id: 'rpc_latency',
    name: 'RPC Latency Regression',
    description: 'Alert when RPC/API latency percentile exceeds a threshold.',
    type: 'rpc_latency',
    defaultConfig: {
      endpoint: 'horizon',
      percentile: 95,
      thresholdMs: 1500,
      windowSeconds: 600,
      minSamples: 10,
    },
    defaultFrequency: 60,
    requiredMetrics: ['technical.api.latency_ms'],
  },
}

export function listAlertRuleTemplates(): AlertRuleTemplate[] {
  return Object.values(ALERT_RULE_TEMPLATES)
}

export function getAlertRuleTemplate(templateId: AlertRuleTemplateId): AlertRuleTemplate | null {
  return ALERT_RULE_TEMPLATES[templateId] ?? null
}

export interface CreateAlertRuleFromTemplateInput {
  templateId: AlertRuleTemplateId
  userId: string
  accountAddress: string
  overrides?: Partial<FeeSpikeConfig | SubmissionFailuresConfig | RpcLatencyConfig>
  executionFrequency?: ExecutionFrequency
}

export function createAlertRuleFromTemplate(input: CreateAlertRuleFromTemplateInput): AlertRule {
  const template = getAlertRuleTemplate(input.templateId)
  if (!template) {
    throw new Error(`Unknown alert rule template: ${input.templateId}`)
  }

  if (!input.userId?.trim() || !input.accountAddress?.trim()) {
    throw new Error('userId and accountAddress are required')
  }

  return {
    id: `template-${input.templateId}-${Date.now()}`,
    userId: input.userId.trim(),
    accountAddress: input.accountAddress.trim(),
    type: template.type,
    config: {
      ...template.defaultConfig,
      ...input.overrides,
    },
    executionFrequency: input.executionFrequency ?? template.defaultFrequency,
    enabled: true,
    createdAt: Date.now(),
    lastEvaluatedAt: null,
    lastTriggeredAt: null,
    notificationChannels: ['in_app'],
  }
}
