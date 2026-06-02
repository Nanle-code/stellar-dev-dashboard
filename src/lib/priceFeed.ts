const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

// Map of common Stellar asset codes to CoinGecko IDs
const ASSET_ID_MAP = {
  XLM: 'stellar',
  native: 'stellar',
  USDC: 'usd-coin',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  AQUA: 'aquarius',
  yXLM: 'stellar',
  SHX: 'stronghold-token',
}

/**
 * Fetch current prices for a list of asset codes.
 * Returns an object keyed by asset code with { usd, usd_24h_change } values.
 */
export async function fetchPrices(assetCodes = ['XLM']) {
  const geckoIds = new Set()
  const codeToId = {}

  for (const code of assetCodes) {
    const id = ASSET_ID_MAP[code] || ASSET_ID_MAP[code.toUpperCase()]
    if (id) {
      geckoIds.add(id)
      codeToId[code] = id
    }
  }

  if (geckoIds.size === 0) return {}

  const ids = Array.from(geckoIds).join(',')
  const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Price API error: ${response.status}`)
  }

  const data = await response.json()

  const prices = {}
  for (const code of assetCodes) {
    const id = codeToId[code]
    if (id && data[id]) {
      prices[code] = {
        usd: data[id].usd ?? null,
        usd_24h_change: data[id].usd_24h_change ?? null,
      }
    }
  }

  return prices
}

/**
 * Fetch the XLM price only (most common use case).
 */
export async function fetchXLMPrice() {
  const prices = await fetchPrices(['XLM'])
  return prices.XLM || { usd: null, usd_24h_change: null }
}

/**
 * Calculate portfolio value in USD from account balances and prices.
 */
export function calculatePortfolioValue(balances, prices) {
  if (!balances || !prices) return null

  let totalUsd = 0
  const items = []

  for (const balance of balances) {
    const code = balance.asset_type === 'native' ? 'XLM' : balance.asset_code
    const amount = parseFloat(balance.balance) || 0
    const price = prices[code]

    if (price && price.usd !== null) {
      const usdValue = amount * price.usd
      totalUsd += usdValue
      items.push({
        code,
        amount,
        priceUsd: price.usd,
        valueUsd: usdValue,
        change24h: price.usd_24h_change,
      })
    } else {
      items.push({
        code,
        amount,
        priceUsd: null,
        valueUsd: null,
        change24h: null,
      })
    }
  }

  return { totalUsd, items }
}
