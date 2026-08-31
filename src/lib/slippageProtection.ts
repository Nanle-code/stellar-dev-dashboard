/**
 * Slippage Protection & Price Impact Engine
 *
 * Calculates spot price, execution price, price impact %, and enforces user-selected
 * slippage protection tolerances before building DEX trades and path payment operations.
 */

export interface OrderBookEntry {
  price: string | number
  amount: string | number
}

export interface OrderBookData {
  bids?: OrderBookEntry[]
  asks?: OrderBookEntry[]
}

export interface AmmPoolData {
  reserveA: number
  reserveB: number
  feePercent?: number // e.g. 0.3 for 0.3%
}

export interface SlippageCalculationParams {
  tradeType: 'sell' | 'buy'
  amount: number | string
  orderbook?: OrderBookData | null
  pool?: AmmPoolData | null
  slippageTolerancePercent: number | string
  maxPriceImpactThresholdPercent?: number
}

export interface SlippageCalculationResult {
  isValid: boolean
  spotPrice: number
  executionPrice: number
  priceImpactPercent: number
  expectedOutput: number
  minimumReceived: number
  maximumSent: number
  slippageTolerancePercent: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  error?: string
  warning?: string
}

/**
 * Calculates spot price, execution price, and price impact from an orderbook or AMM pool,
 * and enforces user-selected slippage protection thresholds.
 */
export function calculatePriceImpactAndSlippage(
  params: SlippageCalculationParams
): SlippageCalculationResult {
  const {
    tradeType,
    amount: rawAmount,
    orderbook,
    pool,
    slippageTolerancePercent: rawSlippage,
    maxPriceImpactThresholdPercent = 15.0,
  } = params

  const amount = Number(rawAmount)
  const slippagePercent = Number(rawSlippage)

  // Validation 1: Check numerical inputs
  if (isNaN(amount) || amount <= 0) {
    return createFailedResult('Invalid trade amount. Amount must be a positive number.', slippagePercent)
  }

  if (isNaN(slippagePercent) || slippagePercent < 0 || slippagePercent > 50) {
    return createFailedResult('Invalid slippage tolerance. Must be between 0% and 50%.', 0.5)
  }

  let spotPrice = 0
  let expectedOutput = 0
  let executionPrice = 0

  // Calculation Path A: Orderbook depth calculation
  if (orderbook && (orderbook.bids?.length || orderbook.asks?.length)) {
    const isSell = tradeType === 'sell'
    const orders = isSell ? (orderbook.bids || []) : (orderbook.asks || [])

    if (!orders.length) {
      return createFailedResult(`No ${isSell ? 'bids' : 'asks'} available in order book.`, slippagePercent)
    }

    spotPrice = Number(orders[0].price)
    if (isNaN(spotPrice) || spotPrice <= 0) {
      return createFailedResult('Invalid orderbook spot price.', slippagePercent)
    }

    let remainingAmount = amount
    let totalOutput = 0
    let totalSpent = 0

    for (const order of orders) {
      const p = Number(order.price)
      const a = Number(order.amount)
      if (isNaN(p) || isNaN(a) || p <= 0 || a <= 0) continue

      if (isSell) {
        // Selling base asset for counter asset (receive counter = amount * price)
        const fillAmount = Math.min(remainingAmount, a)
        totalOutput += fillAmount * p
        totalSpent += fillAmount
        remainingAmount -= fillAmount
      } else {
        // Buying base asset (paying counter = amount * price)
        const fillAmount = Math.min(remainingAmount, a)
        totalOutput += fillAmount
        totalSpent += fillAmount * p
        remainingAmount -= fillAmount
      }

      if (remainingAmount <= 0) break
    }

    if (remainingAmount > 0) {
      return createFailedResult(
        `Insufficient orderbook liquidity for requested amount (${amount}). Available: ${(amount - remainingAmount).toFixed(4)}.`,
        slippagePercent
      )
    }

    expectedOutput = totalOutput
    executionPrice = isSell ? totalOutput / amount : totalSpent / amount
  }
  // Calculation Path B: AMM Pool Constant Product (x * y = k)
  else if (pool && pool.reserveA > 0 && pool.reserveB > 0) {
    const feeDecimal = (pool.feePercent ?? 0.3) / 100
    const amountWithFee = amount * (1 - feeDecimal)

    if (tradeType === 'sell') {
      // Selling asset A for asset B
      spotPrice = pool.reserveB / pool.reserveA
      expectedOutput = (pool.reserveB * amountWithFee) / (pool.reserveA + amountWithFee)
      executionPrice = expectedOutput / amount
    } else {
      // Buying asset B with asset A
      spotPrice = pool.reserveA / pool.reserveB
      const newReserveB = pool.reserveB - amount
      if (newReserveB <= 0) {
        return createFailedResult('Trade amount exceeds AMM pool reserves.', slippagePercent)
      }
      const requiredA = (pool.reserveA * amount) / newReserveB
      expectedOutput = amount
      executionPrice = requiredA / amount
    }
  } else {
    return createFailedResult('No orderbook or liquidity pool data provided for trade calculation.', slippagePercent)
  }

  // Calculate Price Impact (%)
  // For sell: spotPrice is initial rate; executionPrice is effective rate received.
  // Price impact = ((spotPrice - executionPrice) / spotPrice) * 100
  let priceImpactPercent = 0
  if (tradeType === 'sell') {
    priceImpactPercent = spotPrice > 0 ? ((spotPrice - executionPrice) / spotPrice) * 100 : 0
  } else {
    priceImpactPercent = spotPrice > 0 ? ((executionPrice - spotPrice) / spotPrice) * 100 : 0
  }

  // Ensure non-negative price impact percentage for display
  priceImpactPercent = Math.max(0, Number(priceImpactPercent.toFixed(4)))

  // Calculate Minimum Received and Maximum Sent based on slippage tolerance
  const minimumReceived = expectedOutput * (1 - slippagePercent / 100)
  const maximumSent = amount * (1 + slippagePercent / 100)

  // Risk Assessment
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
  let warning: string | undefined = undefined

  if (priceImpactPercent >= 10.0) {
    riskLevel = 'critical'
    warning = `Critical Price Impact (${priceImpactPercent.toFixed(2)}%)! Execution price is significantly worse than spot price.`
  } else if (priceImpactPercent >= 3.0) {
    riskLevel = 'high'
    warning = `High Price Impact (${priceImpactPercent.toFixed(2)}%). High risk of slippage.`
  } else if (priceImpactPercent >= 1.0) {
    riskLevel = 'medium'
    warning = `Moderate Price Impact (${priceImpactPercent.toFixed(2)}%).`
  }

  // Enforce Slippage Protection Threshold
  if (priceImpactPercent > slippagePercent || priceImpactPercent > maxPriceImpactThresholdPercent) {
    return {
      isValid: false,
      spotPrice,
      executionPrice,
      priceImpactPercent,
      expectedOutput,
      minimumReceived,
      maximumSent,
      slippageTolerancePercent: slippagePercent,
      riskLevel: 'critical',
      error: `Trade blocked by slippage protection: Price impact of ${priceImpactPercent.toFixed(2)}% exceeds your maximum slippage tolerance of ${slippagePercent}%.`,
      warning,
    }
  }

  return {
    isValid: true,
    spotPrice,
    executionPrice,
    priceImpactPercent,
    expectedOutput,
    minimumReceived,
    maximumSent,
    slippageTolerancePercent: slippagePercent,
    riskLevel,
    warning,
  }
}

function createFailedResult(errorMsg: string, slippagePercent: number): SlippageCalculationResult {
  return {
    isValid: false,
    spotPrice: 0,
    executionPrice: 0,
    priceImpactPercent: 0,
    expectedOutput: 0,
    minimumReceived: 0,
    maximumSent: 0,
    slippageTolerancePercent: slippagePercent,
    riskLevel: 'critical',
    error: errorMsg,
  }
}

/**
 * Validates and enforces user-selected slippage protection before building trade operations.
 * Throws a descriptive error if protection rules are violated.
 */
export function enforceSlippageProtectionOrThrow(
  params: SlippageCalculationParams
): SlippageCalculationResult {
  const result = calculatePriceImpactAndSlippage(params)
  if (!result.isValid) {
    throw new Error(result.error || 'Trade violates slippage protection rules.')
  }
  return result
}
