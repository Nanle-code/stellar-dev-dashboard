/**
 * Type definitions for the Alert Rules and Notifications System
 */

export type AlertRuleType =
  | 'balance_threshold'
  | 'operation_type'
  | 'counterparty'
  | 'fee_spike'
  | 'submission_failures'
  | 'rpc_latency'
export type NotificationChannel = 'in_app' | 'browser'
export type BalanceDirection = 'below' | 'above'
export type CounterpartyDirection = 'incoming' | 'outgoing' | 'any'
export type ExecutionFrequency = 30 | 60 | 300 | 600 // seconds

export interface BalanceThresholdConfig {
  assetCode: string
  assetIssuer?: string
  threshold: number
  direction: BalanceDirection
}

export interface OperationTypeConfig {
  operationTypes: string[]
}

export interface CounterpartyConfig {
  counterpartyAddress: string
  direction: CounterpartyDirection
}

export interface FeeSpikeConfig {
  multiplier: number
  windowSeconds: number
  minSamples: number
}

export interface SubmissionFailuresConfig {
  failureCountThreshold: number
  windowSeconds: number
}

export interface RpcLatencyConfig {
  endpoint?: string
  percentile: 50 | 95 | 99
  thresholdMs: number
  windowSeconds: number
  minSamples: number
}

export type AlertRuleConfig =
  | BalanceThresholdConfig
  | OperationTypeConfig
  | CounterpartyConfig
  | FeeSpikeConfig
  | SubmissionFailuresConfig
  | RpcLatencyConfig

export interface AlertRule {
  id: string
  userId: string // connectedAddress
  accountAddress: string
  type: AlertRuleType
  config: AlertRuleConfig
  executionFrequency: ExecutionFrequency
  enabled: boolean
  createdAt: number
  lastEvaluatedAt: number | null
  lastTriggeredAt: number | null
  notificationChannels: NotificationChannel[]
}

export interface AlertNotification {
  id: string
  ruleId: string
  triggeredAt: number
  message: string
  title: string
  read: boolean
  accountAddress: string
  ruleType: AlertRuleType
}
