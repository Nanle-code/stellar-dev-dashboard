/**
 * Portfolio Analytics Library
 * 
 * Provides sophisticated portfolio analysis including:
 * - Asset allocation calculations
 * - Performance tracking over time
 * - Risk assessment metrics
 * - P&L calculations
 * - Diversification analysis
 */

// ── Asset Allocation ──────────────────────────────────────────────────────────

/**
 * Calculate asset allocation percentages
 * @param {Array} portfolioItems - Array of { code, valueUsd, amount }
 * @returns {Array} Items with allocation percentage
 */
export function calculateAssetAllocation(portfolioItems) {
  if (!portfolioItems || portfolioItems.length === 0) return []

  const totalValue = portfolioItems.reduce((sum, item) => sum + (item.valueUsd || 0), 0)
  
  if (totalValue === 0) return portfolioItems.map(item => ({ ...item, allocation: 0 }))

  return portfolioItems
    .map(item => ({
      ...item,
      allocation: ((item.valueUsd || 0) / totalValue) * 100
    }))
    .sort((a, b) => b.allocation - a.allocation)
}

/**
 * Calculate diversification score (0-100)
 * Higher score = more diversified
 * Uses Herfindahl-Hirschman Index (HHI)
 */
export function calculateDiversificationScore(portfolioItems) {
  if (!portfolioItems || portfolioItems.length === 0) return 0
  if (portfolioItems.length === 1) return 0

  const allocations = portfolioItems.map(item => item.allocation || 0)
  const hhi = allocations.reduce((sum, alloc) => sum + Math.pow(alloc, 2), 0)
  
  // Normalize HHI to 0-100 scale (inverted so higher = more diversified)
  // HHI ranges from 10000 (monopoly) to 10000/n (perfect distribution)
  const maxHHI = 10000
  const minHHI = 10000 / portfolioItems.length
  const normalizedScore = ((maxHHI - hhi) / (maxHHI - minHHI)) * 100
  
  return Math.max(0, Math.min(100, normalizedScore))
}

/**
 * Identify concentration risk (assets > 25% allocation)
 */
export function identifyConcentrationRisks(portfolioItems) {
  const CONCENTRATION_THRESHOLD = 25
  
  return portfolioItems
    .filter(item => (item.allocation || 0) > CONCENTRATION_THRESHOLD)
    .map(item => ({
      code: item.code,
      allocation: item.allocation,
      valueUsd: item.valueUsd,
      riskLevel: item.allocation > 50 ? 'high' : 'medium'
    }))
}

// ── Performance Tracking ──────────────────────────────────────────────────────

/**
 * Calculate portfolio performance metrics
 * @param {number} currentValue - Current portfolio value
 * @param {number} previousValue - Previous portfolio value (24h ago)
 * @returns {Object} Performance metrics
 */
export function calculatePerformanceMetrics(currentValue, previousValue) {
  if (!currentValue || !previousValue || previousValue === 0) {
    return {
      change: 0,
      changePercent: 0,
      isPositive: false
    }
  }

  const change = currentValue - previousValue
  const changePercent = (change / previousValue) * 100

  return {
    change,
    changePercent,
    isPositive: change >= 0
  }
}

/**
 * Calculate 24h portfolio change based on individual asset changes
 */
export function calculate24hPortfolioChange(portfolioItems) {
  let totalCurrentValue = 0
  let totalPreviousValue = 0

  for (const item of portfolioItems) {
    if (!item.valueUsd || !item.change24h) continue

    const currentValue = item.valueUsd
    const previousValue = currentValue / (1 + item.change24h / 100)

    totalCurrentValue += currentValue
    totalPreviousValue += previousValue
  }

  return calculatePerformanceMetrics(totalCurrentValue, totalPreviousValue)
}

/**
 * Reconstructs historical running balances by parsing account effects backwards.
 * Handles sequential page token parsing and network history truncation rules.
 * @param {Object} server - Horizon server instance
 * @param {string} accountId - Stellar account ID
 * @param {Object} currentBalances - Current balances { assetCode: amount }
 * @param {number} days - Timeline window (e.g. 30, 90)
 * @returns {Array} Snapshot series
 */
export async function fetchHistoricalPerformance(server, accountId, currentBalances, days = 30) {
  const endTime = Date.now();
  const startTime = endTime - (days * 24 * 60 * 60 * 1000);
  
  let runningBalances = { ...currentBalances };
  const history = [];

  // Start with the latest snapshot
  history.push({
    timestamp: endTime,
    balances: { ...runningBalances },
    date: new Date(endTime).toISOString().split('T')[0]
  });

  try {
    // Sequential page parsing backwards
    let page = await server.effects()
      .forAccount(accountId)
      .order('desc')
      .limit(100)
      .call();

    while (page.records.length > 0) {
      for (const record of page.records) {
        const ts = new Date(record.created_at).getTime();
        if (ts < startTime) break;

        // Reconstruct history backwards: reverse accounting logic
        if (record.type === 'account_credited') {
          const asset = record.asset_type === 'native' ? 'XLM' : record.asset_code;
          runningBalances[asset] = (runningBalances[asset] || 0) - parseFloat(record.amount);
        } else if (record.type === 'account_debited') {
          const asset = record.asset_type === 'native' ? 'XLM' : record.asset_code;
          runningBalances[asset] = (runningBalances[asset] || 0) + parseFloat(record.amount);
        }

        history.push({
          timestamp: ts,
          balances: { ...runningBalances },
          date: record.created_at.split('T')[0]
        });
      }

      const oldestInPage = new Date(page.records[page.records.length - 1].created_at).getTime();
      if (oldestInPage < startTime) break;
      page = await page.next();
    }
  } catch (err) {
    console.warn('Horizon history engine encountered an error or truncation:', err);
  }
  return history.reverse();
}

// ── Risk Assessment ───────────────────────────────────────────────────────────

/**
 * Calculate portfolio volatility (standard deviation of returns)
 * @param {Array} historicalData - Array of { value, timestamp }
 * @returns {number} Volatility percentage
 */
export function calculateVolatility(historicalData) {
  if (!historicalData || historicalData.length < 2) return 0

  // Calculate daily returns
  const returns = []
  for (let i = 1; i < historicalData.length; i++) {
    const currentValue = historicalData[i].value
    const previousValue = historicalData[i - 1].value
    if (previousValue > 0) {
      returns.push((currentValue - previousValue) / previousValue)
    }
  }

  if (returns.length === 0) return 0

  // Calculate mean return
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length

  // Calculate variance
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length

  // Standard deviation (volatility)
  const volatility = Math.sqrt(variance) * 100

  return volatility
}

/**
 * Calculate Sharpe Ratio (risk-adjusted return)
 * @param {number} portfolioReturn - Portfolio return percentage
 * @param {number} volatility - Portfolio volatility
 * @param {number} riskFreeRate - Risk-free rate (default 4% annual)
 * @returns {number} Sharpe ratio
 */
export function calculateSharpeRatio(portfolioReturn, volatility, riskFreeRate = 4) {
  if (volatility === 0) return 0
  return (portfolioReturn - riskFreeRate) / volatility
}

/**
 * Assess overall portfolio risk level
 * @param {Object} metrics - { volatility, diversificationScore, concentrationRisks }
 * @returns {Object} { level: 'low'|'medium'|'high', score: 0-100, factors: [] }
 */
export function assessPortfolioRisk(metrics) {
  const { volatility = 0, diversificationScore = 0, concentrationRisks = [] } = metrics

  let riskScore = 0
  const factors = []

  // Volatility contribution (0-40 points)
  if (volatility > 10) {
    riskScore += 40
    factors.push({ factor: 'High volatility', impact: 'high' })
  } else if (volatility > 5) {
    riskScore += 20
    factors.push({ factor: 'Moderate volatility', impact: 'medium' })
  } else {
    factors.push({ factor: 'Low volatility', impact: 'low' })
  }

  // Diversification contribution (0-30 points)
  if (diversificationScore < 30) {
    riskScore += 30
    factors.push({ factor: 'Poor diversification', impact: 'high' })
  } else if (diversificationScore < 60) {
    riskScore += 15
    factors.push({ factor: 'Moderate diversification', impact: 'medium' })
  } else {
    factors.push({ factor: 'Good diversification', impact: 'low' })
  }

  // Concentration contribution (0-30 points)
  if (concentrationRisks.length > 0) {
    const highRiskCount = concentrationRisks.filter(r => r.riskLevel === 'high').length
    if (highRiskCount > 0) {
      riskScore += 30
      factors.push({ factor: `${highRiskCount} highly concentrated asset(s)`, impact: 'high' })
    } else {
      riskScore += 15
      factors.push({ factor: `${concentrationRisks.length} concentrated asset(s)`, impact: 'medium' })
    }
  }

  // Determine risk level
  let level = 'low'
  if (riskScore > 60) level = 'high'
  else if (riskScore > 30) level = 'medium'

  return {
    level,
    score: riskScore,
    factors
  }
}

// ── P&L Calculations ──────────────────────────────────────────────────────────

/**
 * Calculate profit/loss for individual assets
 * @param {Array} portfolioItems - Current portfolio items
 * @param {Object} costBasis - Map of { assetCode: averageCost }
 * @returns {Array} Items with P&L data
 */
export function calculateAssetPnL(portfolioItems, costBasis = {}) {
  return portfolioItems.map(item => {
    const avgCost = costBasis[item.code] || item.priceUsd || 0
    const currentPrice = item.priceUsd || 0
    const amount = item.amount || 0

    const totalCost = avgCost * amount
    const currentValue = item.valueUsd || 0
    const unrealizedPnL = currentValue - totalCost
    const unrealizedPnLPercent = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0

    return {
      ...item,
      avgCost,
      totalCost,
      unrealizedPnL,
      unrealizedPnLPercent,
      isProfitable: unrealizedPnL >= 0
    }
  })
}

/**
 * Calculate total portfolio P&L
 */
export function calculateTotalPnL(portfolioItemsWithPnL) {
  const totalCost = portfolioItemsWithPnL.reduce((sum, item) => sum + (item.totalCost || 0), 0)
  const totalValue = portfolioItemsWithPnL.reduce((sum, item) => sum + (item.valueUsd || 0), 0)
  const totalPnL = totalValue - totalCost
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

  return {
    totalCost,
    totalValue,
    totalPnL,
    totalPnLPercent,
    isProfitable: totalPnL >= 0
  }
}

// ── Asset Correlation ─────────────────────────────────────────────────────────

/**
 * Calculate correlation between two assets
 * @param {Array} asset1Data - Historical prices for asset 1
 * @param {Array} asset2Data - Historical prices for asset 2
 * @returns {number} Correlation coefficient (-1 to 1)
 */
export function calculateCorrelation(asset1Data, asset2Data) {
  if (!asset1Data || !asset2Data || asset1Data.length !== asset2Data.length || asset1Data.length < 2) {
    return 0
  }

  const n = asset1Data.length
  const mean1 = asset1Data.reduce((sum, val) => sum + val, 0) / n
  const mean2 = asset2Data.reduce((sum, val) => sum + val, 0) / n

  let numerator = 0
  let sum1Sq = 0
  let sum2Sq = 0

  for (let i = 0; i < n; i++) {
    const diff1 = asset1Data[i] - mean1
    const diff2 = asset2Data[i] - mean2
    numerator += diff1 * diff2
    sum1Sq += diff1 * diff1
    sum2Sq += diff2 * diff2
  }

  const denominator = Math.sqrt(sum1Sq * sum2Sq)
  if (denominator === 0) return 0

  return numerator / denominator
}

// ── Portfolio Rebalancing ─────────────────────────────────────────────────────

/**
 * Calculate rebalancing recommendations
 * @param {Array} currentAllocation - Current portfolio allocation
 * @param {Object} targetAllocation - Target allocation percentages { assetCode: percentage }
 * @param {number} totalValue - Total portfolio value
 * @returns {Array} Rebalancing actions
 */
export function calculateRebalancingActions(currentAllocation, targetAllocation, totalValue) {
  const actions = []
  const THRESHOLD = 5 // 5% deviation threshold

  for (const item of currentAllocation) {
    const currentPercent = item.allocation || 0
    const targetPercent = targetAllocation[item.code] || 0
    const deviation = currentPercent - targetPercent

    if (Math.abs(deviation) > THRESHOLD) {
      const targetValue = (targetPercent / 100) * totalValue
      const currentValue = item.valueUsd || 0
      const amountChange = targetValue - currentValue

      actions.push({
        asset: item.code,
        currentPercent,
        targetPercent,
        deviation,
        action: amountChange > 0 ? 'buy' : 'sell',
        amountUsd: Math.abs(amountChange),
        priority: Math.abs(deviation) > 10 ? 'high' : 'medium'
      })
    }
  }

  return actions.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
}

// ── Summary Statistics ────────────────────────────────────────────────────────

/**
 * Generate comprehensive portfolio summary
 */
export function generatePortfolioSummary(portfolioItems, historicalData = []) {
  const allocation = calculateAssetAllocation(portfolioItems)
  const diversificationScore = calculateDiversificationScore(allocation)
  const concentrationRisks = identifyConcentrationRisks(allocation)
  const performance24h = calculate24hPortfolioChange(portfolioItems)
  const volatility = calculateVolatility(historicalData)
  const riskAssessment = assessPortfolioRisk({
    volatility,
    diversificationScore,
    concentrationRisks
  })

  const totalValue = portfolioItems.reduce((sum, item) => sum + (item.valueUsd || 0), 0)
  const assetCount = portfolioItems.length

  return {
    totalValue,
    assetCount,
    allocation,
    diversificationScore,
    concentrationRisks,
    performance24h,
    volatility,
    riskAssessment,
    topAssets: allocation.slice(0, 5),
    lastUpdated: new Date().toISOString()
  }
}

// ── Export all functions ──────────────────────────────────────────────────────

export default {
  calculateAssetAllocation,
  calculateDiversificationScore,
  identifyConcentrationRisks,
  calculatePerformanceMetrics,
  calculate24hPortfolioChange,
  fetchHistoricalPerformance,
  calculateVolatility,
  calculateSharpeRatio,
  assessPortfolioRisk,
  calculateAssetPnL,
  calculateTotalPnL,
  calculateCorrelation,
  calculateRebalancingActions,
  generatePortfolioSummary
}
