/**
 * Alert Rule Evaluation Engine
 * Polls Horizon for account data and evaluates rules
 */

import type {
  AlertRule,
  BalanceThresholdConfig,
  OperationTypeConfig,
  CounterpartyConfig,
  FeeSpikeConfig,
  SubmissionFailuresConfig,
  RpcLatencyConfig,
} from '../types/alerts'
import type { NetworkName } from './stellar'
import { fetchAccount, fetchOperations, isValidPublicKey } from './stellar'
import { getEnabledRules, updateRuleEvaluationTime } from './alertRulesDb'
import { deliverNotification, createAlertNotification } from './alertNotifications'
import {
  countMetricEventsInWindow,
  getMetricPointsInWindow,
  getPercentile,
} from '../utils/metricsCollector'

// Evaluation loop state
let evaluationInterval: ReturnType<typeof setInterval> | null = null
let isRunning = false
let currentUserId: string | null = null
let currentNetwork: NetworkName = 'testnet'
let inAppNotificationCallback: ((notification: any) => void) | null = null

/**
 * Start the rule evaluation engine
 */
export function startRuleEngine(
  userId: string,
  network: NetworkName,
  onInAppNotification: (notification: any) => void
): void {
  if (isRunning && currentUserId === userId && currentNetwork === network) {
    return // Already running for this user/network
  }

  stopRuleEngine()

  currentUserId = userId
  currentNetwork = network
  inAppNotificationCallback = onInAppNotification
  isRunning = true

  // Run evaluation every 10 seconds (checks each rule's executionFrequency)
  evaluationInterval = setInterval(() => {
    evaluateAllRules().catch(err => {
      console.error('Rule evaluation error:', err)
    })
  }, 10000)

  // Run initial evaluation immediately
  evaluateAllRules().catch(err => {
    console.error('Initial rule evaluation error:', err)
  })
}

/**
 * Stop the rule evaluation engine
 */
export function stopRuleEngine(): void {
  if (evaluationInterval) {
    clearInterval(evaluationInterval)
    evaluationInterval = null
  }
  isRunning = false
  currentUserId = null
  inAppNotificationCallback = null
}

/**
 * Check if the engine is currently running
 */
export function isEngineRunning(): boolean {
  return isRunning
}

/**
 * Evaluate all enabled rules for the current user
 */
async function evaluateAllRules(): Promise<void> {
  if (!currentUserId || !isRunning) {
    return
  }

  const rules = await getEnabledRules(currentUserId)
  const now = Date.now()

  for (const rule of rules) {
    try {
      // Check if evaluation is due based on executionFrequency
      const lastEval = rule.lastEvaluatedAt || 0
      const frequencyMs = rule.executionFrequency * 1000
      
      if (now - lastEval < frequencyMs) {
        continue // Not due yet
      }

      // Evaluate the rule
      const triggered = await evaluateRule(rule, currentNetwork)

      // Update evaluation time
      await updateRuleEvaluationTime(
        rule.id,
        now,
        triggered ? now : rule.lastTriggeredAt || undefined
      )

      // Deliver notification if triggered
      if (triggered) {
        const notification = createNotificationForRule(rule)
        await deliverNotification(
          notification,
          rule.notificationChannels,
          inAppNotificationCallback || undefined
        )
      }
    } catch (error) {
      console.error(`Failed to evaluate rule ${rule.id}:`, error)
    }
  }
}

/**
 * Evaluate a single rule
 */
async function evaluateRule(rule: AlertRule, network: NetworkName): Promise<boolean> {
  if (!isValidPublicKey(rule.accountAddress)) {
    return false
  }

  switch (rule.type) {
    case 'balance_threshold':
      return evaluateBalanceThreshold(rule, network)
    case 'operation_type':
      return evaluateOperationType(rule, network)
    case 'counterparty':
      return evaluateCounterparty(rule, network)
    case 'fee_spike':
      return evaluateFeeSpike(rule)
    case 'submission_failures':
      return evaluateSubmissionFailures(rule)
    case 'rpc_latency':
      return evaluateRpcLatency(rule)
    default:
      return false
  }
}

/**
 * Evaluate balance threshold rule
 */
async function evaluateBalanceThreshold(
  rule: AlertRule,
  network: NetworkName
): Promise<boolean> {
  const config = rule.config as BalanceThresholdConfig
  
  try {
    const account = await fetchAccount(rule.accountAddress, network)
    
    // Find the balance for the specified asset
    const balance = account.balances.find(b => {
      if (config.assetCode === 'XLM' || config.assetCode === 'native') {
        return b.asset_type === 'native'
      }
      return (
        b.asset_type !== 'native' &&
        (b as any).asset_code === config.assetCode &&
        (config.assetIssuer ? (b as any).asset_issuer === config.assetIssuer : true)
      )
    })

    if (!balance) {
      return false // Asset not found
    }

    const currentBalance = parseFloat(balance.balance)
    const threshold = config.threshold

    if (config.direction === 'below') {
      return currentBalance < threshold
    } else {
      return currentBalance > threshold
    }
  } catch (error) {
    console.error('Balance threshold evaluation error:', error)
    return false
  }
}

/**
 * Evaluate operation type rule
 */
async function evaluateOperationType(
  rule: AlertRule,
  network: NetworkName
): Promise<boolean> {
  const config = rule.config as OperationTypeConfig
  
  try {
    // Fetch operations since last evaluation
    const cursor = rule.lastEvaluatedAt 
      ? String(rule.lastEvaluatedAt) 
      : null
    
    const { records } = await fetchOperations(
      rule.accountAddress,
      network,
      20,
      cursor
    )

    // Check if any new operations match the configured types
    for (const operation of records) {
      if (config.operationTypes.includes(operation.type)) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error('Operation type evaluation error:', error)
    return false
  }
}

/**
 * Evaluate counterparty rule
 */
async function evaluateCounterparty(
  rule: AlertRule,
  network: NetworkName
): Promise<boolean> {
  const config = rule.config as CounterpartyConfig
  
  try {
    // Fetch operations since last evaluation
    const cursor = rule.lastEvaluatedAt 
      ? String(rule.lastEvaluatedAt) 
      : null
    
    const { records } = await fetchOperations(
      rule.accountAddress,
      network,
      20,
      cursor
    )

    // Check if any new operations involve the counterparty
    for (const operation of records) {
      const matchesCounterparty = checkCounterpartyMatch(
        operation,
        config.counterpartyAddress,
        rule.accountAddress,
        config.direction
      )
      
      if (matchesCounterparty) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error('Counterparty evaluation error:', error)
    return false
  }
}

export function evaluateFeeSpike(rule: AlertRule): boolean {
  const config = rule.config as FeeSpikeConfig
  if (!Number.isFinite(config.multiplier) || config.multiplier <= 1) {
    return false
  }

  const windowMs = Math.max(1, config.windowSeconds) * 1000
  const points = getMetricPointsInWindow('business.fee.stroops', windowMs)
  if (points.length < Math.max(1, config.minSamples)) {
    return false
  }

  const values = points.map((point) => point.value)
  const baseline = values.slice(0, -1)
  if (!baseline.length) {
    return false
  }

  const baselineMean = baseline.reduce((sum, value) => sum + value, 0) / baseline.length
  const latest = values[values.length - 1]
  return latest >= baselineMean * config.multiplier
}

export function evaluateSubmissionFailures(rule: AlertRule): boolean {
  const config = rule.config as SubmissionFailuresConfig
  if (!Number.isFinite(config.failureCountThreshold) || config.failureCountThreshold <= 0) {
    return false
  }

  const windowMs = Math.max(1, config.windowSeconds) * 1000
  const failures = countMetricEventsInWindow('business.tx.failure', windowMs)
  return failures >= config.failureCountThreshold
}

export function evaluateRpcLatency(rule: AlertRule): boolean {
  const config = rule.config as RpcLatencyConfig
  if (!Number.isFinite(config.thresholdMs) || config.thresholdMs <= 0) {
    return false
  }

  const windowMs = Math.max(1, config.windowSeconds) * 1000
  const labels = config.endpoint ? { endpoint: config.endpoint } : undefined
  const points = getMetricPointsInWindow('technical.api.latency_ms', windowMs, labels)
  if (points.length < Math.max(1, config.minSamples)) {
    return false
  }

  const values = points.map((point) => point.value)
  const observed = getPercentile(values, config.percentile)
  return observed >= config.thresholdMs
}

/**
 * Check if an operation matches counterparty criteria
 */
function checkCounterpartyMatch(
  operation: any,
  counterpartyAddress: string,
  accountAddress: string,
  direction: 'incoming' | 'outgoing' | 'any'
): boolean {
  const opType = operation.type

  // Check source account
  if (operation.source_account === counterpartyAddress) {
    if (direction === 'any' || direction === 'incoming') {
      return true
    }
  }

  // Check payment operations
  if (opType === 'payment' || opType === 'path_payment_strict_send' || opType === 'path_payment_strict_receive') {
    const from = operation.from || operation.source_account
    const to = operation.to || operation.destination

    if (direction === 'incoming' && from === counterpartyAddress && to === accountAddress) {
      return true
    }
    if (direction === 'outgoing' && from === accountAddress && to === counterpartyAddress) {
      return true
    }
    if (direction === 'any' && (from === counterpartyAddress || to === counterpartyAddress)) {
      return true
    }
  }

  // Check create_account operations
  if (opType === 'create_account') {
    const funder = operation.funder || operation.source_account
    const account = operation.account

    if (direction === 'incoming' && funder === counterpartyAddress && account === accountAddress) {
      return true
    }
    if (direction === 'any' && (funder === counterpartyAddress || account === counterpartyAddress)) {
      return true
    }
  }

  return false
}

/**
 * Create a notification message for a triggered rule
 */
function createNotificationForRule(rule: AlertRule): any {
  let title = ''
  let message = ''

  switch (rule.type) {
    case 'balance_threshold': {
      const config = rule.config as BalanceThresholdConfig
      title = `Balance Alert: ${config.assetCode}`
      message = `Balance is ${config.direction} ${config.threshold} ${config.assetCode}`
      break
    }
    case 'operation_type': {
      const config = rule.config as OperationTypeConfig
      title = 'Operation Alert'
      message = `New ${config.operationTypes.join(', ')} operation detected`
      break
    }
    case 'counterparty': {
      const config = rule.config as CounterpartyConfig
      const shortAddr = `${config.counterpartyAddress.slice(0, 6)}...${config.counterpartyAddress.slice(-6)}`
      title = 'Counterparty Alert'
      message = `${config.direction === 'incoming' ? 'Incoming' : config.direction === 'outgoing' ? 'Outgoing' : 'New'} transaction with ${shortAddr}`
      break
    }
    case 'fee_spike': {
      const config = rule.config as FeeSpikeConfig
      title = 'Fee Spike Alert'
      message = `Observed fees exceeded ${config.multiplier}x the recent baseline`
      break
    }
    case 'submission_failures': {
      const config = rule.config as SubmissionFailuresConfig
      title = 'Submission Failure Alert'
      message = `${config.failureCountThreshold}+ failed submissions detected in ${config.windowSeconds}s`
      break
    }
    case 'rpc_latency': {
      const config = rule.config as RpcLatencyConfig
      title = 'RPC Latency Alert'
      message = `p${config.percentile} latency exceeded ${config.thresholdMs}ms`
      break
    }
  }

  return createAlertNotification(
    rule.id,
    title,
    message,
    rule.accountAddress,
    rule.type
  )
}
