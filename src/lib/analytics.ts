import type { Horizon } from '@stellar/stellar-sdk'

export interface Insight {
  id: string
  type: 'trend' | 'outlier' | 'summary'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

export interface AnalyticsSummary {
  insights: Insight[]
  stats: {
    totalTransactions: number
    totalOperations: number
    avgFee: number
    successRate: number
  }
}

/**
 * Calculates a standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0
  const squareDiffs = values.map((value) => {
    const diff = value - mean
    return diff * diff
  })
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(avgSquareDiff)
}

/**
 * Generates natural language insights based on transaction and operations data
 */
export function generateInsights(
  transactions: Horizon.ServerApi.TransactionRecord[],
  operations: Horizon.ServerApi.OperationRecord[]
): AnalyticsSummary {
  const insights: Insight[] = []
  
  if (!transactions.length) {
    return {
      insights: [{
        id: 'no-data',
        type: 'summary',
        title: 'No Data Available',
        description: 'Insufficient data to generate meaningful insights at this time.',
        severity: 'low'
      }],
      stats: { totalTransactions: 0, totalOperations: 0, avgFee: 0, successRate: 0 }
    }
  }

  // Basic Stats
  const successfulTxs = transactions.filter(t => t.successful).length
  const successRate = (successfulTxs / transactions.length) * 100
  const fees = transactions.map(t => parseInt(t.fee_charged, 10)).filter(f => !isNaN(f))
  const avgFee = fees.length ? fees.reduce((a, b) => a + b, 0) / fees.length : 0

  const summaryStats = {
    totalTransactions: transactions.length,
    totalOperations: operations.length,
    avgFee: Math.round(avgFee),
    successRate: Math.round(successRate * 10) / 10
  }

  // 1. Success Rate Insight
  if (successRate < 80) {
    insights.push({
      id: 'low-success',
      type: 'trend',
      title: 'Elevated Failure Rate',
      description: `Your transaction success rate has dropped to ${summaryStats.successRate}%. Review recent failed transactions for potential network or fee issues.`,
      severity: 'high'
    })
  } else if (successRate === 100) {
    insights.push({
      id: 'perfect-success',
      type: 'summary',
      title: 'Perfect Execution',
      description: '100% of your recent transactions were successful. Your current fee strategy is highly effective.',
      severity: 'low'
    })
  }

  // 2. Fee Outliers
  if (fees.length > 5) {
    const stdDevFee = calculateStdDev(fees, avgFee)
    const highFeeThreshold = avgFee + (stdDevFee * 2)
    
    const outliers = transactions.filter(t => parseInt(t.fee_charged, 10) > highFeeThreshold)
    if (outliers.length > 0) {
      insights.push({
        id: 'fee-outlier',
        type: 'outlier',
        title: 'Spike in Transaction Fees',
        description: `We detected ${outliers.length} transaction(s) with unusually high fees (>$${Math.round(highFeeThreshold)} stroops). This might indicate sudden network congestion.`,
        severity: 'medium'
      })
    }
  }

  // 3. Operation Trends (detecting specific patterns)
  const operationTypes = operations.reduce((acc, op) => {
    acc[op.type] = (acc[op.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topOperation = Object.entries(operationTypes).sort((a, b) => b[1] - a[1])[0]
  if (topOperation) {
    const percentage = Math.round((topOperation[1] / operations.length) * 100)
    if (percentage > 50) {
      insights.push({
        id: 'dominant-operation',
        type: 'trend',
        title: 'Dominant Activity Pattern',
        description: `The majority of your recent activity (${percentage}%) consists of '${topOperation[0]}' operations.`,
        severity: 'low'
      })
    }
  }

  // Prioritize high severity
  insights.sort((a, b) => {
    const order = { high: 3, medium: 2, low: 1 }
    return order[b.severity] - order[a.severity]
  })

  return {
    insights,
    stats: summaryStats
  }
}
