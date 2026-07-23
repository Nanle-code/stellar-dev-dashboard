import * as StellarSdk from '@stellar/stellar-sdk'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type NetworkName = 'mainnet' | 'testnet' | 'futurenet' | 'local' | 'custom'

export interface NetworkConfig {
  name: string
  horizonUrl: string
  sorobanUrl?: string
  passphrase: string
  faucetUrl?: string
}

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  mainnet: {
    name: 'Mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanUrl: 'https://soroban-rpc.stellar.org',
    passphrase: StellarSdk.Networks.PUBLIC,
  },
  testnet: {
    name: 'Testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanUrl: 'https://soroban-testnet.stellar.org',
    passphrase: StellarSdk.Networks.TESTNET,
    faucetUrl: 'https://friendbot.stellar.org',
  },
  futurenet: {
    name: 'Futurenet',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    sorobanUrl: 'https://soroban-futurenet.stellar.org',
    passphrase: StellarSdk.Networks.FUTURENET,
    faucetUrl: 'https://friendbot-futurenet.stellar.org',
  },
  local: {
    name: 'Local',
    horizonUrl: 'http://localhost:8000',
    sorobanUrl: 'http://localhost:8000/soroban/rpc',
    passphrase: 'Standalone Network ; February 2017',
  },
  custom: {
    name: 'Custom',
    horizonUrl: '',
    sorobanUrl: '',
    passphrase: '',
  },
}

const CACHE_PREFIX = 'stellar_cache_'
const CACHE_TTL_MS = 5 * 60 * 1000

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return data as T
  } catch {
    return null
  }
}

async function setCache(key: string, data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, timestamp: Date.now() }),
    )
  } catch {}
}

export function getServer(network: NetworkName = 'testnet'): StellarSdk.Horizon.Server {
  const config = NETWORKS[network]
  return new StellarSdk.Horizon.Server(config.horizonUrl || NETWORKS.testnet.horizonUrl)
}

export function getSorobanServer(network: NetworkName = 'testnet'): StellarSdk.SorobanRpc.Server {
  const config = NETWORKS[network]
  return new StellarSdk.SorobanRpc.Server(
    config.sorobanUrl || NETWORKS.testnet.sorobanUrl!,
  )
}

export function isValidPublicKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false
  const trimmed = key.trim()
  if (StellarSdk.StrKey.isValidEd25519PublicKey(trimmed)) return true
  if (trimmed.startsWith('M')) return true
  return /^[a-zA-Z0-9._-]+\*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)
}

export function shortAddress(addr: string | null | undefined, chars = 6): string {
  if (!addr) return ''
  return `${addr.slice(0, chars)}\u2026${addr.slice(-chars)}`
}

export function formatXLM(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  })
}

export async function fetchAccount(
  publicKey: string,
  network: NetworkName = 'testnet',
): Promise<any> {
  const cacheKey = `account:${publicKey}:${network}`
  const cached = await getCached<any>(cacheKey)
  if (cached) return cached

  const server = getServer(network)
  const account = await server.loadAccount(publicKey)

  const result = {
    id: account.id,
    account_id: account.account_id,
    sequence: account.sequence,
    subentry_count: account.subentry_count,
    balances: account.balances.map((b: any) => ({
      asset_type: b.asset_type,
      asset_code: b.asset_code,
      asset_issuer: b.asset_issuer,
      balance: b.balance,
      limit: b.limit,
    })),
    signers: account.signers.map((s: any) => ({
      key: s.key,
      type: s.type,
      weight: s.weight,
    })),
    thresholds: {
      low_threshold: account.thresholds.low_threshold,
      med_threshold: account.thresholds.med_threshold,
      high_threshold: account.thresholds.high_threshold,
    },
    last_modified_ledger: account.last_modified_ledger,
  }

  await setCache(cacheKey, result)
  return result
}

export async function fetchTransactions(
  publicKey: string,
  network: NetworkName = 'testnet',
  limit = 20,
  cursor: string | null = null,
): Promise<{
  records: any[]
  nextCursor: string | null
  hasMore: boolean
}> {
  const server = getServer(network)
  const request = server.transactions().forAccount(publicKey).order('desc').limit(limit)
  if (cursor) request.cursor(cursor)

  const txs = await request.call()
  const records = txs.records || []
  const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null

  return {
    records,
    nextCursor,
    hasMore: records.length === limit && !!nextCursor,
  }
}

export async function fetchOperations(
  publicKey: string,
  network: NetworkName = 'testnet',
  limit = 20,
  cursor: string | null = null,
): Promise<{
  records: any[]
  nextCursor: string | null
  hasMore: boolean
}> {
  const server = getServer(network)
  const request = server.operations().forAccount(publicKey).order('desc').limit(limit)
  if (cursor) request.cursor(cursor)

  const ops = await request.call()
  const records = ops.records || []
  const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null

  return {
    records,
    nextCursor,
    hasMore: records.length === limit && !!nextCursor,
  }
}

export async function fetchNetworkStats(network: NetworkName = 'testnet'): Promise<{
  latestLedger: any
  feeStats: any
}> {
  const cacheKey = `network-stats:${network}`
  const cached = await getCached<any>(cacheKey)
  if (cached) return cached

  const server = getServer(network)
  const [ledger, feeStats] = await Promise.all([
    server.ledgers().order('desc').limit(1).call(),
    server.feeStats(),
  ])

  const result = {
    latestLedger: ledger.records[0],
    feeStats,
  }

  await setCache(cacheKey, result)
  return result
}

export async function fundTestnetAccount(publicKey: string): Promise<any> {
  const res = await fetch(`${NETWORKS.testnet.faucetUrl}?addr=${publicKey}`)
  if (!res.ok) throw new Error('Faucet request failed')
  return res.json()
}

export async function fetchXLMPrice(): Promise<{ usd: number }> {
  const cacheKey = 'xlm-price'
  const cached = await getCached<any>(cacheKey)
  if (cached) return cached

  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd',
  )
  if (!res.ok) throw new Error('Price fetch failed')
  const data = await res.json()

  const result = { usd: data?.stellar?.usd ?? 0 }
  await setCache(cacheKey, result)
  return result
}

export function calculateAccountReserves(accountData: any, networkStats: any, offerCount = 0) {
  const baseReserveStroops = Number(networkStats?.latestLedger?.base_reserve) || 10000000
  const baseReserve = baseReserveStroops / 10000000

  const assetCount = accountData.balances?.filter((b: any) => b.asset_type !== 'native').length || 0
  const signerCount =
    accountData.signers?.filter((s: any) => s.key !== accountData.account_id).length || 0
  const subentryCount = accountData.subentry_count || 0

  const signerReserve = signerCount * (baseReserve / 2)
  const assetReserve = assetCount * (baseReserve / 2)
  const offerReserve = offerCount * (baseReserve / 2)
  const subentryReserve = subentryCount * (baseReserve / 2)
  const totalReserves = baseReserve + signerReserve + assetReserve + offerReserve + subentryReserve

  const xlmBalance = accountData.balances?.find((b: any) => b.asset_type === 'native')?.balance || '0'
  const totalBalance = parseFloat(xlmBalance)
  const availableBalance = Math.max(0, totalBalance - totalReserves)

  return {
    baseReserve,
    signerReserve,
    assetReserve,
    offerReserve,
    subentryReserve,
    totalReserves,
    availableBalance,
    totalBalance,
  }
}

export const OPERATION_LABELS: Record<string, string> = {
  create_account: 'Create Account',
  payment: 'Payment',
  path_payment_strict_send: 'Path Payment (Send)',
  path_payment_strict_receive: 'Path Payment (Receive)',
  manage_buy_offer: 'Buy Offer',
  manage_sell_offer: 'Sell Offer',
  create_passive_sell_offer: 'Create Passive Sell Offer',
  set_options: 'Set Options',
  change_trust: 'Change Trust',
  allow_trust: 'Allow Trust',
  account_merge: 'Account Merge',
  manage_data: 'Manage Data',
  bump_sequence: 'Bump Sequence',
  create_claimable_balance: 'Create Claimable Balance',
  claim_claimable_balance: 'Claim Claimable Balance',
  begin_sponsoring_future_reserves: 'Begin Sponsoring Future Reserves',
  end_sponsoring_future_reserves: 'End Sponsoring Future Reserves',
  revoke_sponsorship: 'Revoke Sponsorship',
  clawback: 'Clawback',
  clawback_claimable_balance: 'Clawback Claimable Balance',
  set_trust_line_flags: 'Set Trustline Flags',
  liquidity_pool_deposit: 'Liquidity Pool Deposit',
  liquidity_pool_withdraw: 'Liquidity Pool Withdraw',
  invoke_host_function: 'Contract Call',
  extend_footprint_ttl: 'Extend Footprint TTL',
  restore_footprint: 'Restore Footprint',
}

export function getOperationLabel(type: string): string {
  return OPERATION_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
