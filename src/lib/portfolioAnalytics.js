/**
 * Portfolio Analytics Library
 * 
 * Provides sophisticated portfolio analysis including:
 * - Asset allocation calculations
 * - Performance tracking over time
 * - Risk assessment metrics
 * - P&L calculations
 * - Diversification analysis
 * - Real-time portfolio value tracking
 * - Correlation analysis
 * - Performance benchmarking
 * - Risk assessment
 * - Allocation suggestions
 * - Rebalancing recommendations
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

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * Identify concentration risk (assets > 25% allocation)
 */
export function identifyConcentrationRisks(portfolioItems) {
  const CONCENTRATION_THRESHOLD = 25
  
  return portfolioItems
    .filter(item => (item.allocation || 0) > CONCENTRATION_THRESHOLD)
    .map(item => ({
      asset: item.code,
      code: item.code,
      allocation: item.allocation,
      percentage: item.allocation,
      valueUsd: item.valueUsd,
      riskLevel: item.allocation > 50 ? 'high' : 'medium',
      message: `${item.code} represents ${item.allocation.toFixed(1)}% of the portfolio`
    }))
}

/**
 * Score concentration risk using the largest position and HHI.
 * 0 = balanced allocation, 100 = one asset dominates the portfolio.
 */
export function calculateConcentrationRiskScore(portfolioItems) {
  if (!portfolioItems || portfolioItems.length === 0) return 0

  const allocations = portfolioItems.map(item => item.allocation || 0)
  const largestAllocation = Math.max(...allocations)
  const hhi = allocations.reduce((sum, allocation) => sum + Math.pow(allocation, 2), 0)
  const hhiScore = Math.max(0, (hhi - (10000 / Math.max(portfolioItems.length, 1))) / 100)
  const largestScore = largestAllocation <= 25 ? largestAllocation * 0.6 : 15 + ((largestAllocation - 25) / 75) * 85

  return clampScore((largestScore * 0.65) + (hhiScore * 0.35))
}

/**
 * Assess issuer/counterparty exposure from Stellar trustline issuers.
 * Native XLM is protocol exposure, while issued assets carry counterparty risk.
 */
export function assessCounterpartyRisk(portfolioItems) {
  if (!portfolioItems || portfolioItems.length === 0) {
    return {
      score: 0,
      level: 'low',
      issuerCount: 0,
      largestIssuerExposure: 0,
      unpricedExposure: 0,
      issuerExposures: [],
      factors: [],
      recommendations: []
    }
  }

  const totalValue = portfolioItems.reduce((sum, item) => sum + (item.valueUsd || 0), 0)
  const issuerMap = new Map()
  let issuedValue = 0
  let unpricedAssets = 0
  let unpricedAmount = 0

  portfolioItems.forEach((item) => {
    if (!item.issuer) {
      return
    }

    if (!item.valueUsd || item.valueUsd <= 0) {
      unpricedAssets += 1
      unpricedAmount += item.amount || 0
      return
    }

    issuedValue += item.valueUsd
    const current = issuerMap.get(item.issuer) || { issuer: item.issuer, valueUsd: 0, assets: [] }
    current.valueUsd += item.valueUsd
    current.assets.push(item.code)
    issuerMap.set(item.issuer, current)
  })

  const issuerExposures = Array.from(issuerMap.values())
    .map((entry) => ({
      ...entry,
      percentage: totalValue > 0 ? (entry.valueUsd / totalValue) * 100 : 0,
      assets: Array.from(new Set(entry.assets))
    }))
    .sort((a, b) => b.percentage - a.percentage)

  const issuerCount = issuerExposures.length
  const largestIssuerExposure = issuerExposures[0]?.percentage || 0
  const issuedExposure = totalValue > 0 ? (issuedValue / totalValue) * 100 : 0
  const unpricedExposure = portfolioItems.length > 0 ? (unpricedAssets / portfolioItems.length) * 100 : 0

  let score = issuedExposure * 0.25 + largestIssuerExposure * 0.55 + unpricedExposure * 0.2
  if (issuerCount === 1 && issuedExposure > 20) score += 10
  if (issuerCount > 0 && issuerCount < 3 && issuedExposure > 50) score += 8
  score = clampScore(score)

  const factors = []
  const recommendations = []

  if (largestIssuerExposure >= 35) {
    factors.push({
      name: 'High issuer exposure',
      factor: 'High issuer exposure',
      impact: 'high',
      description: `One issuer backs ${largestIssuerExposure.toFixed(1)}% of priced portfolio value.`
    })
    recommendations.push('Reduce exposure to the largest issuer or add assets backed by independent issuers.')
  } else if (largestIssuerExposure >= 15) {
    factors.push({
      name: 'Moderate issuer exposure',
      factor: 'Moderate issuer exposure',
      impact: 'medium',
      description: `Largest issuer exposure is ${largestIssuerExposure.toFixed(1)}% of portfolio value.`
    })
  }

  if (unpricedAssets > 0) {
    factors.push({
      name: 'Unpriced trustlines',
      factor: 'Unpriced trustlines',
      impact: unpricedAssets > 2 ? 'medium' : 'low',
      description: `${unpricedAssets} issued asset${unpricedAssets === 1 ? '' : 's'} lack pricing data and may hide counterparty risk.`
    })
    recommendations.push('Review unpriced trustlines and remove stale or unknown assets.')
  }

  if (issuerCount === 0) {
    factors.push({
      name: 'Protocol-only exposure',
      factor: 'Protocol-only exposure',
      impact: 'low',
      description: 'No priced issued assets were found in the portfolio.'
    })
  }

  return {
    score,
    level: score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low',
    issuerCount,
    largestIssuerExposure,
    issuedExposure,
    unpricedExposure,
    unpricedAssets,
    unpricedAmount,
    issuerExposures,
    factors,
    recommendations
  }
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
    if (item.valueUsd === null || item.valueUsd === undefined || item.change24h === null || item.change24h === undefined) continue

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
export function calculateVolatility(historicalData, options = {}) {
  if (!historicalData || historicalData.length < 2) return 0
  const annualized = options.annualized === true

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

  // Standard deviation of observed returns. Annualize only when explicitly requested.
  const volatility = Math.sqrt(variance) * (annualized ? Math.sqrt(365) : 1) * 100

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
  const {
    volatility = 0,
    diversificationScore = 0,
    concentrationRisks = [],
    concentrationRiskScore = 0,
    counterpartyRisk = { score: 0, factors: [], recommendations: [] },
    unpricedAssetCount = 0,
    assetCount = 0
  } = metrics

  const factors = []
  const recommendations = []

  const volatilityScore = clampScore((volatility / 15) * 100)
  const diversificationRiskScore = clampScore(100 - diversificationScore)
  const counterpartyScore = counterpartyRisk.score || 0
  const valuationRiskScore = assetCount > 0 ? clampScore((unpricedAssetCount / assetCount) * 100) : 0

  let riskScore = clampScore(
    volatilityScore * 0.3 +
    concentrationRiskScore * 0.3 +
    counterpartyScore * 0.25 +
    valuationRiskScore * 0.15
  )

  if (volatility >= 10) {
    factors.push({ name: 'High volatility', factor: 'High volatility', impact: 'high', description: `Portfolio value volatility is ${volatility.toFixed(2)}%.` })
    recommendations.push('Consider reducing exposure to assets with large recent price swings.')
  } else if (volatility >= 5) {
    factors.push({ name: 'Moderate volatility', factor: 'Moderate volatility', impact: 'medium', description: `Portfolio value volatility is ${volatility.toFixed(2)}%.` })
  } else {
    factors.push({ name: 'Low volatility', factor: 'Low volatility', impact: 'low', description: `Portfolio value volatility is ${volatility.toFixed(2)}%.` })
  }

  if (diversificationScore < 30) {
    factors.push({ name: 'Poor diversification', factor: 'Poor diversification', impact: 'high', description: 'Portfolio allocation is heavily concentrated.' })
    recommendations.push('Add exposure to additional assets or reduce the largest position.')
  } else if (diversificationScore < 60) {
    factors.push({ name: 'Moderate diversification', factor: 'Moderate diversification', impact: 'medium', description: 'Portfolio has some diversification, but allocation can be improved.' })
  } else {
    factors.push({ name: 'Good diversification', factor: 'Good diversification', impact: 'low', description: 'Portfolio allocation is reasonably balanced.' })
  }

  if (concentrationRisks.length > 0) {
    const highRiskCount = concentrationRisks.filter(r => r.riskLevel === 'high').length
    if (highRiskCount > 0) {
      factors.push({ name: 'High concentration', factor: `${highRiskCount} highly concentrated asset(s)`, impact: 'high', description: 'At least one asset exceeds 50% of portfolio value.' })
      recommendations.push('Rebalance positions above 50% of portfolio value.')
    } else {
      factors.push({ name: 'Concentration', factor: `${concentrationRisks.length} concentrated asset(s)`, impact: 'medium', description: 'One or more assets exceed 25% of portfolio value.' })
    }
  }

  ;(counterpartyRisk.factors || []).forEach((factor) => factors.push(factor))
  ;(counterpartyRisk.recommendations || []).forEach((recommendation) => recommendations.push(recommendation))

  if (factors.some((factor) => factor.impact === 'high')) {
    riskScore = Math.max(riskScore, 45)
  } else if (factors.some((factor) => factor.impact === 'medium')) {
    riskScore = Math.max(riskScore, 25)
  }

  if (unpricedAssetCount > 0) {
    recommendations.push('Confirm pricing and liquidity for assets without market data before increasing exposure.')
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain periodic reviews as prices, issuers, and allocations change.')
  }

  // Determine risk level
  let level = 'low'
  if (riskScore >= 70) level = 'high'
  else if (riskScore >= 35) level = 'medium'

  return {
    level,
    score: riskScore,
    factors,
    recommendations: Array.from(new Set(recommendations)),
    components: {
      volatility: volatilityScore,
      concentration: concentrationRiskScore,
      diversification: diversificationRiskScore,
      counterparty: counterpartyScore,
      valuation: valuationRiskScore
    }
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
  const concentrationRiskScore = calculateConcentrationRiskScore(allocation)
  const counterpartyRisk = assessCounterpartyRisk(allocation)
  const performance24h = calculate24hPortfolioChange(portfolioItems)
  const volatility = calculateVolatility(historicalData)
  const unpricedAssetCount = portfolioItems.filter(item => item.priceUsd === null || item.valueUsd === null).length
  const riskAssessment = assessPortfolioRisk({
    volatility,
    diversificationScore,
    concentrationRisks,
    concentrationRiskScore,
    counterpartyRisk,
    unpricedAssetCount,
    assetCount: portfolioItems.length
  })

  const totalValue = portfolioItems.reduce((sum, item) => sum + (item.valueUsd || 0), 0)
  const assetCount = portfolioItems.length

  return {
    totalValue,
    assetCount,
    allocation,
    diversificationScore,
    concentrationRisks,
    concentrationRiskScore,
    counterpartyRisk,
    performance24h,
    change24h: performance24h.changePercent,
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
  calculateConcentrationRiskScore,
  assessCounterpartyRisk,
  calculateSharpeRatio,
  assessPortfolioRisk,
  calculateAssetPnL,
  calculateTotalPnL,
  calculateCorrelation,
  calculateRebalancingActions,
  generatePortfolioSummary
}
