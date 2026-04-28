import * as StellarSdk from '@stellar/stellar-sdk'
import { Cache, TTL } from './cache.js'

// ─── Cache setup ──────────────────────────────────────────────────────────────

const stellarCache = new Cache({
  namespace: 'stellar',
  persist: true,
  maxSize: 500,
  defaultTTL: TTL.ACCOUNT
})

// ─── Network config ───────────────────────────────────────────────────────────

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

const COINGECKO_XLM_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd'

// ─── Servers ──────────────────────────────────────────────────────────────────

export function getNetworkDetails(network: NetworkName): NetworkConfig {
  return NETWORKS[network]
}

export function updateCustomNetworkConfig(config: Partial<NetworkConfig>) {
  Object.assign(NETWORKS.custom, config)
}

export function getServer(network: NetworkName = 'testnet'): StellarSdk.Horizon.Server {
  const config = NETWORKS[network]
  return new StellarSdk.Horizon.Server(config.horizonUrl || NETWORKS.testnet.horizonUrl)
}

export function getSorobanServer(network: NetworkName = 'testnet'): StellarSdk.SorobanRpc.Server {
  const config = NETWORKS[network]
  if (network === 'custom' && !config.sorobanUrl) {
    throw new Error('Custom Soroban RPC URL not configured')
  }
  return new StellarSdk.SorobanRpc.Server(config.sorobanUrl || NETWORKS.testnet.sorobanUrl!)
}

// ─── Account ──────────────────────────────────────────────────────────────────

export async function fetchAccount(
  publicKey: string,
  network: NetworkName = 'testnet'
): Promise<StellarSdk.Horizon.AccountResponse> {
  const cacheKey = `account:${publicKey}:${network}`
  const cached = stellarCache.get(cacheKey)
  if (cached) return cached

  const server = getServer(network)
  const account = await server.loadAccount(publicKey)
  stellarCache.set(cacheKey, account, TTL.ACCOUNT, ['account', publicKey])
  return account
}

// ─── Transactions & Operations ────────────────────────────────────────────────

export async function fetchTransactions(
  publicKey: string,
  network: NetworkName = 'testnet',
  limit = 20,
  cursor: string | null = null
): Promise<{ records: StellarSdk.Horizon.ServerApi.TransactionRecord[]; nextCursor: string | null; hasMore: boolean }> {
  const cacheKey = `transactions:${publicKey}:${network}:${limit}:${cursor || 'null'}`
  const cached = stellarCache.get(cacheKey)
  if (cached) return cached

  const server = getServer(network)
  const request = server
    .transactions()
    .forAccount(publicKey)
    .order('desc')
    .limit(limit)

  if (cursor) request.cursor(cursor)

  const txs = await request.call()
  const records = txs.records || []
  const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null

  const result = {
    records,
    nextCursor,
    hasMore: records.length === limit && !!nextCursor,
  }
  stellarCache.set(cacheKey, result, TTL.TRANSACTIONS, ['transactions', publicKey])
  return result
}

export async function fetchOperations(
  publicKey: string,
  network: NetworkName = 'testnet',
  limit = 20,
  cursor: string | null = null
): Promise<{ records: StellarSdk.Horizon.ServerApi.OperationRecord[]; nextCursor: string | null; hasMore: boolean }> {
  const cacheKey = `operations:${publicKey}:${network}:${limit}:${cursor || 'null'}`
  const cached = stellarCache.get(cacheKey)
  if (cached) return cached

  const server = getServer(network)
  const request = server
    .operations()
    .forAccount(publicKey)
    .order('desc')
    .limit(limit)

  if (cursor) request.cursor(cursor)

  const ops = await request.call()
  const records = ops.records || []
  const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null

  const result = {
    records,
    nextCursor,
    hasMore: records.length === limit && !!nextCursor,
  }
  stellarCache.set(cacheKey, result, TTL.OPERATIONS, ['operations', publicKey])
  return result
}

export async function fetchAccountOffers(
  publicKey: string,
  network: NetworkName = 'testnet'
): Promise<StellarSdk.Horizon.ServerApi.OfferRecord[]> {
  const cacheKey = `offers:${publicKey}:${network}`
  const cached = stellarCache.get(cacheKey)
  if (cached) return cached

  const server = getServer(network)
  const offers = await server
    .offers()
    .forAccount(publicKey)
    .call()
  const records = offers.records || []
  stellarCache.set(cacheKey, records, TTL.ACCOUNT, ['offers', publicKey])
  return records
}

// ─── Operation labels ───────────────────────────────────────────────────────────

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

function titleCaseLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function getOperationLabel(type: string): string {
  return OPERATION_LABELS[type] || titleCaseLabel(type)
}

export async function fetchAccountCreationDate(
  publicKey: string,
  network: NetworkName = 'testnet'
): Promise<string | null> {
  const server = getServer(network)

  try {
    const ops = await server
      .operations()
      .forAccount(publicKey)
      .order('asc')
      .limit(1)
      .call()

    const operation = ops.records[0]
    if (operation?.type !== 'create_account') return null

    return operation.created_at || null
  } catch {
    return null
  }
}

export function streamLedgers(
  callback: (ledger: StellarSdk.Horizon.ServerApi.LedgerRecord) => void,
  network: NetworkName = 'testnet'
): () => void {
  const server = getServer(network)
  return server
    .ledgers()
    .cursor('now')
    .stream({
      onmessage: (page) => {
        if (page?.records?.length) {
          page.records.forEach((ledger) => callback(ledger))
        }
      },
      onerror: (error) => console.error('Ledger stream error:', error),
    })
}

// ─── Network stats ────────────────────────────────────────────────────────────

export interface NetworkStats {
  latestLedger: StellarSdk.Horizon.ServerApi.LedgerRecord
  feeStats: StellarSdk.Horizon.HorizonApi.FeeStatsResponse
}

export async function fetchNetworkStats(network: NetworkName = 'testnet'): Promise<NetworkStats> {
  const cacheKey = `network-stats:${network}`
  const cached = stellarCache.get(cacheKey)
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
  stellarCache.set(cacheKey, result, TTL.LEDGER, ['network-stats', network])
  return result
}

export interface XLMPrice {
  usd: number
  source: 'coingecko'
}

export interface AssetPriceEstimate {
  xlm: number
  source: 'sdex'
  method: 'midpoint' | 'best_bid' | 'best_ask'
  bestBid: number | null
  bestAsk: number | null
}

export interface AssetBalanceLike {
  asset_type: string
  asset_code?: string
  asset_issuer?: string
}

function parseTopOfBookPrice(levels: Array<{ price?: string }> = []): number | null {
  const price = parseFloat(levels[0]?.price ?? '')
  if (!Number.isFinite(price) || price <= 0) return null
  return price
}

export async function fetchXLMPrice(): Promise<XLMPrice> {
  const response = await fetch(COINGECKO_XLM_PRICE_URL)

  if (!response.ok) {
    throw new Error(`XLM price request failed: ${response.status}`)
  }

  const data = await response.json()
  const usd = data?.stellar?.usd

  if (!Number.isFinite(usd)) {
    throw new Error('XLM price data unavailable')
  }

  return {
    usd,
    source: 'coingecko',
  }
}

export async function fetchAssetPrice(
  asset: AssetBalanceLike,
  network: NetworkName = 'testnet'
): Promise<AssetPriceEstimate | null> {
  if (!asset || asset.asset_type === 'native') return null

  if (!asset.asset_type.startsWith('credit_alphanum') || !asset.asset_code || !asset.asset_issuer) {
    return null
  }

  const params = new URLSearchParams({
    selling_asset_type: asset.asset_type,
    selling_asset_code: asset.asset_code,
    selling_asset_issuer: asset.asset_issuer,
    buying_asset_type: 'native',
  })

  const response = await fetch(`${NETWORKS[network].horizonUrl}/order_book?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Order book request failed: ${response.status}`)
  }

  const orderBook = await response.json()
  const bestBid = parseTopOfBookPrice(orderBook.bids)
  const bestAsk = parseTopOfBookPrice(orderBook.asks)

  if (bestBid !== null && bestAsk !== null) {
    return {
      xlm: (bestBid + bestAsk) / 2,
      source: 'sdex',
      method: 'midpoint',
      bestBid,
      bestAsk,
    }
  }

  const fallback = bestBid ?? bestAsk
  if (fallback === null) return null

  return {
    xlm: fallback,
    source: 'sdex',
    method: bestBid !== null ? 'best_bid' : 'best_ask',
    bestBid,
    bestAsk,
  }
}


// ─── Faucet ───────────────────────────────────────────────────────────────────

export async function fundTestnetAccount(publicKey: string): Promise<unknown> {
  const res = await fetch(`${NETWORKS.testnet.faucetUrl}?addr=${publicKey}`)
  if (!res.ok) throw new Error('Faucet request failed')
  return res.json()
}

// ─── Contract ─────────────────────────────────────────────────────────────────

export async function fetchContractInfo(
  contractId: string,
  network: NetworkName = 'testnet'
): Promise<StellarSdk.SorobanRpc.Api.LedgerEntryResult> {
  const server = getSorobanServer(network)
  try {
    const instance = await server.getContractData(
      contractId,
      StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
      StellarSdk.SorobanRpc.Durability.Persistent
    )
    return instance
  } catch (e) {
    throw new Error(`Contract not found: ${(e as Error).message}`)
  }
}

export interface ContractInvocationArg {
  type: 'string' | 'int' | 'address' | 'bool'
  value: string
}

export interface SerializedLedgerKey {
  type: string
  xdr: string
}

export interface SerializedContractEvent {
  inSuccessfulContractCall: boolean
  type: string
  contractId: string | null
  topics: unknown[]
  value: unknown
}

export interface ContractSimulationResult {
  xdr: string
  latestLedger: number
  cost?: StellarSdk.SorobanRpc.Api.Cost
  result: unknown
  events: SerializedContractEvent[]
  footprint: {
    readOnly: SerializedLedgerKey[]
    readWrite: SerializedLedgerKey[]
    minResourceFee: string
  } | null
}

export interface ContractSubmitResult {
  hash: string
  status: StellarSdk.SorobanRpc.Api.SendTransactionStatus
  errorResult: string | null
  diagnosticEvents: string[]
}

function getLedgerKeyType(key: StellarSdk.xdr.LedgerKey): string {
  const kind = key.switch()
  return kind?.name || kind?.toString?.() || 'unknown'
}

function serializeLedgerKey(key: StellarSdk.xdr.LedgerKey): SerializedLedgerKey {
  return {
    type: getLedgerKeyType(key),
    xdr: key.toXDR('base64'),
  }
}

function serializeScVal(value: StellarSdk.xdr.ScVal): unknown {
  try {
    return StellarSdk.scValToNative(value)
  } catch {
    return value.toXDR('base64')
  }
}

function serializeDiagnosticEvent(
  event: StellarSdk.xdr.DiagnosticEvent
): SerializedContractEvent {
  const contractEvent = event.event()
  const body = contractEvent.body().v0()
  const contractId = contractEvent.contractId()

  return {
    inSuccessfulContractCall: event.inSuccessfulContractCall(),
    type: contractEvent.type().name || contractEvent.type().toString(),
    contractId: contractId ? StellarSdk.Address.fromScAddress(contractId).toString() : null,
    topics: body.topics().map(serializeScVal),
    value: serializeScVal(body.data()),
  }
}

function parseContractArgument(
  arg: ContractInvocationArg,
  index: number
): StellarSdk.xdr.ScVal {
  const trimmedValue = arg.value?.trim?.() ?? ''

  if (!trimmedValue) {
    throw new Error(`Argument ${index + 1} is empty`)
  }

  switch (arg.type) {
    case 'string':
      return StellarSdk.nativeToScVal(trimmedValue, { type: 'string' })
    case 'int': {
      let parsed: bigint
      try {
        parsed = BigInt(trimmedValue)
      } catch {
        throw new Error(`Argument ${index + 1} must be a valid integer`)
      }
      return StellarSdk.nativeToScVal(parsed, { type: 'i128' })
    }
    case 'address':
      try {
        return StellarSdk.Address.fromString(trimmedValue).toScVal()
      } catch {
        throw new Error(`Argument ${index + 1} must be a valid Stellar address`)
      }
    case 'bool':
      if (trimmedValue !== 'true' && trimmedValue !== 'false') {
        throw new Error(`Argument ${index + 1} must be true or false`)
      }
      return StellarSdk.nativeToScVal(trimmedValue === 'true', { type: 'bool' })
    default:
      throw new Error(`Unsupported argument type: ${arg.type}`)
  }
}

interface BuildContractInvocationParams {
  contractId: string
  functionName: string
  args?: ContractInvocationArg[]
  sourceAccount: string
  network?: NetworkName
}

async function buildContractInvocationTransaction(
  params: BuildContractInvocationParams
): Promise<StellarSdk.Transaction> {
  const {
    contractId,
    functionName,
    args = [],
    sourceAccount,
    network = 'testnet',
  } = params

  if (!isValidContractId(contractId)) {
    throw new Error('Invalid contract address')
  }

  if (!functionName.trim()) {
    throw new Error('Function name is required')
  }

  if (!isValidPublicKey(sourceAccount)) {
    throw new Error('A valid source account is required')
  }

  const horizon = getServer(network)
  const account = await horizon.loadAccount(sourceAccount)
  const contract = new StellarSdk.Contract(contractId.trim())
  const parsedArgs = args.map(parseContractArgument)

  return new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE.toString(),
    networkPassphrase: NETWORKS[network].passphrase,
  })
    .setTimeout(30)
    .addOperation(contract.call(functionName.trim(), ...parsedArgs))
    .build()
}

export async function simulateContractCall(
  params: BuildContractInvocationParams
): Promise<ContractSimulationResult> {
  const { network = 'testnet' } = params
  const server = getSorobanServer(network)
  const transaction = await buildContractInvocationTransaction(params)
  const simulation = await server.simulateTransaction(transaction)

  if ('error' in simulation && simulation.error) {
    throw new Error(simulation.error)
  }

  const successfulSimulation = simulation as Exclude<
    StellarSdk.SorobanRpc.Api.SimulateTransactionResponse,
    StellarSdk.SorobanRpc.Api.SimulateTransactionErrorResponse
  >

  const footprint = successfulSimulation.transactionData
    ? {
        readOnly: successfulSimulation.transactionData.getReadOnly().map(serializeLedgerKey),
        readWrite: successfulSimulation.transactionData.getReadWrite().map(serializeLedgerKey),
        minResourceFee: successfulSimulation.minResourceFee,
      }
    : null

  return {
    xdr: transaction.toXDR(),
    latestLedger: successfulSimulation.latestLedger,
    cost: successfulSimulation.cost,
    result: successfulSimulation.result ? serializeScVal(successfulSimulation.result.retval) : null,
    events: (successfulSimulation.events || []).map(serializeDiagnosticEvent),
    footprint,
  }
}

interface InvokeContractParams {
  contractId: string
  functionName: string
  args?: ContractInvocationArg[]
  secretKey: string
  network?: NetworkName
}

export async function invokeContract(
  params: InvokeContractParams
): Promise<ContractSubmitResult> {
  const { contractId, functionName, args = [], secretKey, network = 'testnet' } = params

  if (network !== 'testnet') {
    throw new Error('Transaction submission is only enabled on Testnet')
  }

  if (!secretKey.trim()) {
    throw new Error('Secret key is required to submit a transaction')
  }

  let keypair: StellarSdk.Keypair
  try {
    keypair = StellarSdk.Keypair.fromSecret(secretKey.trim())
  } catch {
    throw new Error('Invalid secret key')
  }

  const sourceAccount = keypair.publicKey()
  const server = getSorobanServer(network)
  const transaction = await buildContractInvocationTransaction({
    contractId,
    functionName,
    args,
    sourceAccount,
    network,
  })
  const prepared = await server.prepareTransaction(transaction)

  prepared.sign(keypair)

  const response = await server.sendTransaction(prepared)

  return {
    hash: response.hash,
    status: response.status,
    errorResult: response.errorResult ? response.errorResult.toXDR('base64') : null,
    diagnosticEvents: (response.diagnosticEvents || []).map((event) =>
      event.toXDR('base64')
    ),
  }
}

// ─── Validators ───────────────────────────────────────────────────────────────

export function isValidPublicKey(key: string): boolean {
  return StellarSdk.StrKey.isValidEd25519PublicKey(key)
}

export function isValidContractId(id: string): boolean {
  try {
    StellarSdk.Address.fromString(id)
    return true
  } catch {
    return false
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatXLM(amount: string | number): string {
  return parseFloat(String(amount)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  })
}

export function shortAddress(addr: string | null | undefined, chars = 6): string {
  if (!addr) return ''
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`
}

// ─── Transaction builder ──────────────────────────────────────────────────────

export type OperationType = 'payment' | 'createAccount'

export interface PaymentOperation {
  type: 'payment'
  destination: string
  amount: string
}

export interface CreateAccountOperation {
  type: 'createAccount'
  destination: string
  startingBalance: string
}

export type BuilderOperation = PaymentOperation | CreateAccountOperation

export interface TimeBounds {
  minTime?: string | number
  maxTime?: string | number
}

export interface BuildTransactionParams {
  sourceAccount: string
  operations: BuilderOperation[]
  memo?: string
  baseFee: number
  timeBounds: TimeBounds
  network: NetworkName
}

export async function buildTransaction(
  params: BuildTransactionParams
): Promise<StellarSdk.Transaction> {
  const { sourceAccount, operations, memo, baseFee, timeBounds, network } = params
  const server = getServer(network)
  const account = await server.loadAccount(sourceAccount)

  const txBuilder = new StellarSdk.TransactionBuilder(account, {
    fee: baseFee.toString(),
    networkPassphrase: NETWORKS[network].passphrase,
  })

  if (timeBounds.minTime || timeBounds.maxTime) {
    txBuilder.setTimeout(
      timeBounds.maxTime
        ? parseInt(String(timeBounds.maxTime)) - Math.floor(Date.now() / 1000)
        : 0
    )
  }

  operations.forEach(op => {
    if (op.type === 'payment') {
      txBuilder.addOperation(
        StellarSdk.Operation.payment({
          destination: op.destination,
          asset: StellarSdk.Asset.native(),
          amount: op.amount,
        })
      )
    } else if (op.type === 'createAccount') {
      txBuilder.addOperation(
        StellarSdk.Operation.createAccount({
          destination: op.destination,
          startingBalance: op.startingBalance,
        })
      )
    }
  })

  if (memo) {
    txBuilder.addMemo(StellarSdk.Memo.text(memo))
  }

  return txBuilder.build()
}

// ─── Simulate transaction ─────────────────────────────────────────────────────

export interface SimulateResult {
  fee: number
  operationCount: number
  success: boolean
  errors: string[]
  xdr?: string
}

export async function simulateTransaction(
  params: BuildTransactionParams
): Promise<SimulateResult> {
  try {
    const transaction = await buildTransaction(params)

    if (!isValidPublicKey(params.sourceAccount)) {
      throw new Error('Invalid source account')
    }

    const errors: string[] = []
    params.operations.forEach((op, index) => {
      if (op.type === 'payment') {
        if (!isValidPublicKey(op.destination)) {
          errors.push(`Operation ${index + 1}: Invalid destination address`)
        }
        if (!op.amount || parseFloat(op.amount) <= 0) {
          errors.push(`Operation ${index + 1}: Invalid amount`)
        }
      } else if (op.type === 'createAccount') {
        if (!isValidPublicKey(op.destination)) {
          errors.push(`Operation ${index + 1}: Invalid destination address`)
        }
        if (!op.startingBalance || parseFloat(op.startingBalance) < 1) {
          errors.push(`Operation ${index + 1}: Starting balance must be at least 1 XLM`)
        }
      }
    })

    const estimatedFee = params.baseFee * params.operations.length

    return {
      fee: estimatedFee,
      operationCount: transaction.operations.length,
      success: errors.length === 0,
      errors,
      xdr: transaction.toXDR(),
    }
  } catch (error) {
    return {
      fee: 0,
      operationCount: params.operations.length,
      success: false,
      errors: [(error as Error).message],
    }
  }
}

export interface SimulationWhatIfScenario {
  label: string
  baseFee?: number
  operationMultiplier?: number
  networkCongestion?: number
}

export interface SimulationFeeOption {
  label: string
  fee: number
  expectedInclusion: 'slow' | 'standard' | 'priority'
}

export interface ExecutionTraceStep {
  step: string
  status: 'ok' | 'warning' | 'error'
  detail: string
}

export interface AdvancedSimulationParams extends BuildTransactionParams {
  scenarios?: SimulationWhatIfScenario[]
  currentLedgerLoad?: number
}

export interface AdvancedSimulationReport {
  base: SimulateResult
  optimizedFee: number
  feeOptions: SimulationFeeOption[]
  successProbability: number
  executionTrace: ExecutionTraceStep[]
  scenarios: Array<{
    label: string
    estimatedFee: number
    successProbability: number
  }>
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function optimizeTransactionFee(
  baseFee: number,
  operationCount: number,
  currentLedgerLoad = 0.5
): number {
  const congestionMultiplier = 1 + clamp(currentLedgerLoad, 0, 1.5) * 0.85
  const opWeight = 1 + Math.max(0, operationCount - 1) * 0.08
  return Math.ceil(baseFee * congestionMultiplier * opWeight)
}

export function scoreTransactionSuccess(
  simulation: SimulateResult,
  currentLedgerLoad = 0.5
): number {
  if (!simulation.success) return 0

  const errorPenalty = simulation.errors.length * 0.2
  const congestionPenalty = clamp(currentLedgerLoad, 0, 1.5) * 0.28
  const opPenalty = Math.max(0, simulation.operationCount - 2) * 0.04
  const raw = 0.95 - errorPenalty - congestionPenalty - opPenalty
  return clamp(raw, 0.05, 0.99)
}

export function buildExecutionTrace(
  params: BuildTransactionParams,
  simulation: SimulateResult
): ExecutionTraceStep[] {
  const steps: ExecutionTraceStep[] = [
    {
      step: 'Validate source account',
      status: isValidPublicKey(params.sourceAccount) ? 'ok' : 'error',
      detail: isValidPublicKey(params.sourceAccount)
        ? 'Source account format is valid.'
        : 'Source account is not a valid ed25519 public key.',
    },
    {
      step: 'Assemble operations',
      status: params.operations.length > 0 ? 'ok' : 'error',
      detail: `${params.operations.length} operation(s) attached to transaction.`,
    },
    {
      step: 'Estimate fee and bounds',
      status: params.baseFee >= 100 ? 'ok' : 'warning',
      detail: `Base fee ${params.baseFee} stroops with ${params.timeBounds.maxTime ? 'custom' : 'default'} time bounds.`,
    },
    {
      step: 'Simulate preflight',
      status: simulation.success ? 'ok' : 'error',
      detail: simulation.success
        ? 'Simulation succeeded with no blocking errors.'
        : simulation.errors.join('; '),
    },
  ]

  return steps
}

export async function runAdvancedTransactionSimulation(
  params: AdvancedSimulationParams
): Promise<AdvancedSimulationReport> {
  const base = await simulateTransaction(params)
  const operationCount = Math.max(1, params.operations.length)
  const currentLedgerLoad = params.currentLedgerLoad ?? 0.55
  const optimizedFee = optimizeTransactionFee(params.baseFee, operationCount, currentLedgerLoad)
  const successProbability = scoreTransactionSuccess(base, currentLedgerLoad)
  const executionTrace = buildExecutionTrace(params, base)

  const feeOptions: SimulationFeeOption[] = [
    {
      label: 'Slow / Cost Saver',
      fee: Math.max(100, Math.floor(optimizedFee * 0.85)),
      expectedInclusion: 'slow',
    },
    {
      label: 'Standard',
      fee: optimizedFee,
      expectedInclusion: 'standard',
    },
    {
      label: 'Priority',
      fee: Math.ceil(optimizedFee * 1.2),
      expectedInclusion: 'priority',
    },
  ]

  const scenarios = (params.scenarios || []).map((scenario) => {
    const scenarioOps = Math.max(
      1,
      Math.round(operationCount * (scenario.operationMultiplier ?? 1))
    )
    const scenarioFee = optimizeTransactionFee(
      scenario.baseFee ?? params.baseFee,
      scenarioOps,
      scenario.networkCongestion ?? currentLedgerLoad
    )

    const scenarioProbability = clamp(
      successProbability - (scenario.networkCongestion ?? currentLedgerLoad) * 0.15 + 0.05,
      0.03,
      0.99
    )

    return {
      label: scenario.label,
      estimatedFee: scenarioFee,
      successProbability: scenarioProbability,
    }
  })

  return {
    base,
    optimizedFee,
    feeOptions,
    successProbability,
    executionTrace,
    scenarios,
  }
}

export async function exportTransactionXDR(params: BuildTransactionParams): Promise<string> {
  const transaction = await buildTransaction(params)
  return transaction.toXDR()
}

// ─── Path payments ────────────────────────────────────────────────────────────

export type PathPaymentMode = 'strict-send' | 'strict-receive'

export interface PathAsset {
  type: 'native' | 'credit'
  code: string
  issuer?: string
}

export interface PaymentPathRecord {
  source_asset_type: string
  source_asset_code?: string
  source_asset_issuer?: string
  source_amount: string
  destination_asset_type: string
  destination_asset_code?: string
  destination_asset_issuer?: string
  destination_amount: string
  path: Array<{
    asset_type: string
    asset_code?: string
    asset_issuer?: string
  }>
  /** Slippage % vs best path — annotated client-side, not from Horizon */
  slippagePct?: string
}

export interface FetchPaymentPathsParams {
  sourceAsset: PathAsset
  destAsset: PathAsset
  amount: string
  mode?: PathPaymentMode
  network?: NetworkName
}

// ─── Asset Discovery & Analytics ─────────────────────────────────────────────

export interface AssetInfo {
  code: string
  issuer: string
  domain?: string
  name?: string
  description?: string
  image?: string
  conditions?: string
  is_verified?: boolean
  is_asset_anchored?: boolean
  anchor_asset_type?: string
  anchor_asset?: string
  redemption_instructions?: string
  collateral_addresses?: string[]
  collateral_address_messages?: string[]
  status?: string
  display_decimals?: number
  num_accounts?: number
  amount?: string
  flags?: {
    auth_required?: boolean
    auth_revocable?: boolean
    auth_immutable?: boolean
    auth_clawback_enabled?: boolean
  }
  paging_token?: string
}

export interface AssetStats {
  asset: AssetInfo
  num_accounts: number
  num_claimable_balances: number
  num_liquidity_pools: number
  num_contracts: number
  amount: string
  accounts: {
    authorized: number
    authorized_to_maintain_liabilities: number
    unauthorized: number
  }
  balances: {
    authorized: string
    authorized_to_maintain_liabilities: string
    unauthorized: string
  }
  claimable_balances_amount: string
  liquidity_pools_amount: string
  contracts_amount: string
}

export interface AssetMarketData {
  asset: AssetInfo
  price_usd?: number
  price_xlm?: number
  volume_24h_usd?: number
  volume_24h_xlm?: number
  market_cap_usd?: number
  change_24h?: number
  high_24h?: number
  low_24h?: number
  last_updated?: string
  trading_pairs?: TradingPair[]
}

export interface TradingPair {
  base_asset: AssetInfo
  counter_asset: AssetInfo
  price: string
  volume_24h: string
  change_24h: string
  high_24h: string
  low_24h: string
  last_trade_at: string
}

export interface IssuerInfo {
  account_id: string
  domain?: string
  name?: string
  description?: string
  website?: string
  logo?: string
  support_email?: string
  support_url?: string
  keybase?: string
  twitter?: string
  github?: string
  telegram?: string
  linkedin?: string
  facebook?: string
  medium?: string
  reddit?: string
  is_verified?: boolean
  verification_level?: 'none' | 'domain' | 'manual' | 'full'
  assets_issued?: AssetInfo[]
  toml_url?: string
  toml_last_updated?: string
}

export interface AssetSearchFilters {
  query?: string
  asset_type?: 'credit_alphanum4' | 'credit_alphanum12' | 'native'
  asset_issuer?: string
  verified_only?: boolean
  min_accounts?: number
  max_accounts?: number
  min_amount?: string
  max_amount?: string
  has_domain?: boolean
  order?: 'asc' | 'desc'
  sort_by?: 'code' | 'num_accounts' | 'amount' | 'created_at'
  limit?: number
  cursor?: string
}

export interface TrustlineRecommendation {
  asset: AssetInfo
  issuer_info: IssuerInfo
  recommendation_score: number
  reasons: string[]
  risk_factors: string[]
  similar_assets?: AssetInfo[]
  market_data?: AssetMarketData
}

// Popular assets list (curated)
export const POPULAR_ASSETS: AssetInfo[] = [
  {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    domain: 'centre.io',
    name: 'USD Coin',
    description: 'USDC is a fully collateralized US dollar stablecoin',
    is_verified: true,
    is_asset_anchored: true,
    anchor_asset_type: 'fiat',
    anchor_asset: 'USD'
  },
  {
    code: 'AQUA',
    issuer: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
    domain: 'aqua.network',
    name: 'Aqua Token',
    description: 'AQUA is the native token of the Aqua Network',
    is_verified: true
  },
  {
    code: 'yXLM',
    issuer: 'GARDNV3Q7YGT4AKSDF25LT32YSCCW67UUQRWQGZ2FQOTQADAAY6RQXU',
    domain: 'ultrastellar.com',
    name: 'yXLM',
    description: 'Yield-bearing XLM token',
    is_verified: true
  },
  {
    code: 'MOBI',
    issuer: 'GA6HCMBLTZS5VYYBCATRBRZ3BZJMAFUDKYYF6AH6MVCMGWMRDNSWJPIH',
    domain: 'mobius.network',
    name: 'Mobius Token',
    description: 'MOBI is the native token of the Mobius Network',
    is_verified: true
  }
];

/**
 * Fetch all assets from Horizon
 */
export async function fetchAssets(
  network: NetworkName = 'testnet',
  filters: AssetSearchFilters = {}
): Promise<{ records: AssetInfo[], next?: string, prev?: string }> {
  const server = getServer(network)
  
  let assetsCall = server.assets()
  
  if (filters.asset_issuer) {
    assetsCall = assetsCall.forIssuer(filters.asset_issuer)
  }
  
  if (filters.asset_type) {
    // Note: Horizon doesn't have direct asset type filtering, we'll filter client-side
  }
  
  if (filters.order) {
    assetsCall = assetsCall.order(filters.order)
  }
  
  if (filters.limit) {
    assetsCall = assetsCall.limit(filters.limit)
  }
  
  if (filters.cursor) {
    assetsCall = assetsCall.cursor(filters.cursor)
  }

  const response = await assetsCall.call()
  
  let assets = response.records.map((asset: any): AssetInfo => ({
    code: asset.asset_code,
    issuer: asset.asset_issuer,
    num_accounts: parseInt(asset.num_accounts),
    amount: asset.amount,
    flags: {
      auth_required: asset.flags.auth_required,
      auth_revocable: asset.flags.auth_revocable,
      auth_immutable: asset.flags.auth_immutable,
      auth_clawback_enabled: asset.flags.auth_clawback_enabled
    },
    paging_token: asset.paging_token
  }))
  
  // Client-side filtering
  if (filters.query) {
    const query = filters.query.toLowerCase()
    assets = assets.filter(asset => 
      asset.code.toLowerCase().includes(query) ||
      asset.issuer.toLowerCase().includes(query) ||
      asset.domain?.toLowerCase().includes(query) ||
      asset.name?.toLowerCase().includes(query)
    )
  }
  
  if (filters.verified_only) {
    assets = assets.filter(asset => asset.is_verified)
  }
  
  if (filters.min_accounts) {
    assets = assets.filter(asset => (asset.num_accounts || 0) >= filters.min_accounts!)
  }
  
  if (filters.max_accounts) {
    assets = assets.filter(asset => (asset.num_accounts || 0) <= filters.max_accounts!)
  }
  
  if (filters.has_domain) {
    assets = assets.filter(asset => !!asset.domain)
  }

  return {
    records: assets,
    next: response.next ? response.next() : undefined,
    prev: response.prev ? response.prev() : undefined
  }
}

/**
 * Fetch detailed asset statistics
 */
export async function fetchAssetStats(
  assetCode: string,
  assetIssuer: string,
  network: NetworkName = 'testnet'
): Promise<AssetStats | null> {
  try {
    const server = getServer(network)
    const asset = await server.assets()
      .forCode(assetCode)
      .forIssuer(assetIssuer)
      .call()
    
    if (asset.records.length === 0) return null
    
    const assetData = asset.records[0]
    
    return {
      asset: {
        code: assetData.asset_code,
        issuer: assetData.asset_issuer,
        num_accounts: parseInt(assetData.num_accounts),
        amount: assetData.amount,
        flags: {
          auth_required: assetData.flags.auth_required,
          auth_revocable: assetData.flags.auth_revocable,
          auth_immutable: assetData.flags.auth_immutable,
          auth_clawback_enabled: assetData.flags.auth_clawback_enabled
        }
      },
      num_accounts: parseInt(assetData.num_accounts),
      num_claimable_balances: parseInt(assetData.num_claimable_balances || '0'),
      num_liquidity_pools: parseInt(assetData.num_liquidity_pools || '0'),
      num_contracts: parseInt(assetData.num_contracts || '0'),
      amount: assetData.amount,
      accounts: {
        authorized: parseInt(assetData.accounts?.authorized || '0'),
        authorized_to_maintain_liabilities: parseInt(assetData.accounts?.authorized_to_maintain_liabilities || '0'),
        unauthorized: parseInt(assetData.accounts?.unauthorized || '0')
      },
      balances: {
        authorized: assetData.balances?.authorized || '0',
        authorized_to_maintain_liabilities: assetData.balances?.authorized_to_maintain_liabilities || '0',
        unauthorized: assetData.balances?.unauthorized || '0'
      },
      claimable_balances_amount: assetData.claimable_balances_amount || '0',
      liquidity_pools_amount: assetData.liquidity_pools_amount || '0',
      contracts_amount: assetData.contracts_amount || '0'
    }
  } catch (error) {
    console.error('Error fetching asset stats:', error)
    return null
  }
}

/**
 * Fetch issuer information from stellar.toml
 */
export async function fetchIssuerInfo(
  issuerAccount: string,
  network: NetworkName = 'testnet'
): Promise<IssuerInfo> {
  try {
    const server = getServer(network)
    const account = await server.loadAccount(issuerAccount)
    
    let issuerInfo: IssuerInfo = {
      account_id: issuerAccount,
      verification_level: 'none'
    }
    
    // Check if account has a home domain
    if (account.home_domain) {
      issuerInfo.domain = account.home_domain
      issuerInfo.toml_url = `https://${account.home_domain}/.well-known/stellar.toml`
      
      try {
        // Fetch stellar.toml
        const tomlResponse = await fetch(issuerInfo.toml_url)
        if (tomlResponse.ok) {
          const tomlText = await tomlResponse.text()
          const tomlData = parseToml(tomlText)
          
          // Extract organization info
          if (tomlData.DOCUMENTATION) {
            issuerInfo.name = tomlData.DOCUMENTATION.ORG_NAME
            issuerInfo.description = tomlData.DOCUMENTATION.ORG_DESCRIPTION
            issuerInfo.website = tomlData.DOCUMENTATION.ORG_URL
            issuerInfo.logo = tomlData.DOCUMENTATION.ORG_LOGO
            issuerInfo.support_email = tomlData.DOCUMENTATION.ORG_SUPPORT_EMAIL
            issuerInfo.support_url = tomlData.DOCUMENTATION.ORG_SUPPORT_URL
            issuerInfo.keybase = tomlData.DOCUMENTATION.ORG_KEYBASE
            issuerInfo.twitter = tomlData.DOCUMENTATION.ORG_TWITTER
            issuerInfo.github = tomlData.DOCUMENTATION.ORG_GITHUB
          }
          
          issuerInfo.verification_level = 'domain'
          issuerInfo.toml_last_updated = new Date().toISOString()
        }
      } catch (tomlError) {
        console.warn('Failed to fetch stellar.toml:', tomlError)
      }
    }
    
    return issuerInfo
  } catch (error) {
    console.error('Error fetching issuer info:', error)
    return {
      account_id: issuerAccount,
      verification_level: 'none'
    }
  }
}

/**
 * Simple TOML parser for stellar.toml files
 */
function parseToml(tomlText: string): any {
  const result: any = {}
  let currentSection = result
  let currentSectionName = ''
  
  const lines = tomlText.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue
    
    // Section headers
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSectionName = trimmed.slice(1, -1)
      currentSection = result[currentSectionName] = {}
      continue
    }
    
    // Key-value pairs
    const equalIndex = trimmed.indexOf('=')
    if (equalIndex > 0) {
      const key = trimmed.slice(0, equalIndex).trim()
      let value = trimmed.slice(equalIndex + 1).trim()
      
      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      
      currentSection[key] = value
    }
  }
  
  return result
}

/**
 * Get trustline recommendations for an account
 */
export async function getTrustlineRecommendations(
  accountId: string,
  network: NetworkName = 'testnet',
  limit: number = 10
): Promise<TrustlineRecommendation[]> {
  try {
    const server = getServer(network)
    const account = await server.loadAccount(accountId)
    
    // Get current trustlines
    const currentAssets = new Set(
      account.balances
        .filter(balance => balance.asset_type !== 'native')
        .map(balance => `${balance.asset_code}:${balance.asset_issuer}`)
    )
    
    // Fetch popular assets
    const { records: popularAssets } = await fetchAssets(network, {
      limit: 50,
      order: 'desc'
    })
    
    const recommendations: TrustlineRecommendation[] = []
    
    for (const asset of popularAssets) {
      const assetKey = `${asset.code}:${asset.issuer}`
      
      // Skip if already trusted
      if (currentAssets.has(assetKey)) continue
      
      // Get issuer info
      const issuerInfo = await fetchIssuerInfo(asset.issuer, network)
      
      // Calculate recommendation score
      let score = 0
      const reasons: string[] = []
      const riskFactors: string[] = []
      
      // Scoring factors
      if (asset.num_accounts && asset.num_accounts > 1000) {
        score += 30
        reasons.push(`Popular asset with ${asset.num_accounts.toLocaleString()} holders`)
      }
      
      if (issuerInfo.verification_level === 'domain') {
        score += 25
        reasons.push('Verified issuer with domain')
      }
      
      if (asset.is_verified) {
        score += 20
        reasons.push('Verified asset')
      }
      
      if (asset.flags?.auth_required) {
        score -= 10
        riskFactors.push('Requires authorization from issuer')
      }
      
      if (asset.flags?.auth_revocable) {
        score -= 15
        riskFactors.push('Issuer can revoke authorization')
      }
      
      if (asset.flags?.auth_clawback_enabled) {
        score -= 20
        riskFactors.push('Issuer can clawback funds')
      }
      
      if (!issuerInfo.domain) {
        score -= 15
        riskFactors.push('No domain verification')
      }
      
      // Only recommend assets with positive scores
      if (score > 0) {
        recommendations.push({
          asset,
          issuer_info: issuerInfo,
          recommendation_score: score,
          reasons,
          risk_factors: riskFactors
        })
      }
      
      if (recommendations.length >= limit) break
    }
    
    // Sort by recommendation score
    return recommendations.sort((a, b) => b.recommendation_score - a.recommendation_score)
  } catch (error) {
    console.error('Error getting trustline recommendations:', error)
    return []
  }
}

/**
 * Search assets with advanced filtering
 */
export async function searchAssets(
  query: string,
  network: NetworkName = 'testnet',
  filters: AssetSearchFilters = {}
): Promise<AssetInfo[]> {
  const searchFilters: AssetSearchFilters = {
    ...filters,
    query: query.trim(),
    limit: filters.limit || 20
  }
  
  const { records } = await fetchAssets(network, searchFilters)
  
  // Enhance with issuer info for top results
  const enhancedAssets = await Promise.all(
    records.slice(0, 10).map(async (asset) => {
      try {
        const issuerInfo = await fetchIssuerInfo(asset.issuer, network)
        return {
          ...asset,
          domain: issuerInfo.domain,
          name: issuerInfo.name,
          description: issuerInfo.description,
          is_verified: issuerInfo.verification_level !== 'none'
        }
      } catch (error) {
        return asset
      }
    })
  )
  
  return [...enhancedAssets, ...records.slice(10)]
}

/**
 * Get asset market data (mock implementation - would integrate with real price APIs)
 */
export async function fetchAssetMarketData(
  assetCode: string,
  assetIssuer: string,
  network: NetworkName = 'testnet'
): Promise<AssetMarketData | null> {
  try {
    // This would integrate with real market data APIs like CoinGecko, CoinMarketCap, etc.
    // For now, return mock data for popular assets
    
    const mockMarketData: Record<string, Partial<AssetMarketData>> = {
      'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN': {
        price_usd: 1.00,
        price_xlm: 8.33, // Assuming XLM = $0.12
        volume_24h_usd: 1500000,
        market_cap_usd: 45000000000,
        change_24h: 0.01,
        high_24h: 1.001,
        low_24h: 0.999
      },
      'AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA': {
        price_usd: 0.0045,
        price_xlm: 0.0375,
        volume_24h_usd: 125000,
        change_24h: -2.5,
        high_24h: 0.0048,
        low_24h: 0.0043
      }
    }
    
    const assetKey = `${assetCode}:${assetIssuer}`
    const marketData = mockMarketData[assetKey]
    
    if (!marketData) return null
    
    const assetStats = await fetchAssetStats(assetCode, assetIssuer, network)
    
    return {
      asset: assetStats?.asset || { code: assetCode, issuer: assetIssuer },
      last_updated: new Date().toISOString(),
      ...marketData
    } as AssetMarketData
  } catch (error) {
    console.error('Error fetching asset market data:', error)
    return null
  }
}

export async function fetchPaymentPaths(
  params: FetchPaymentPathsParams
): Promise<PaymentPathRecord[]> {
  const { sourceAsset, destAsset, amount, mode = 'strict-send', network = 'testnet' } = params
  const horizonUrl = NETWORKS[network].horizonUrl

  function assetParams(asset: PathAsset, prefix: string): string {
    if (asset.type === 'native') {
      return `${prefix}_asset_type=native`
    }
    const alphaNum = asset.code.length <= 4 ? '4' : '12'
    return `${prefix}_asset_type=credit_alphanum${alphaNum}&${prefix}_asset_code=${asset.code}&${prefix}_asset_issuer=${asset.issuer}`
  }

  function assetString(asset: PathAsset): string {
    if (asset.type === 'native') return 'native'
    return `${asset.code}:${asset.issuer}`
  }

  let url: string
  if (mode === 'strict-send') {
    url = `${horizonUrl}/paths/strict-send?${assetParams(sourceAsset, 'source')}&source_amount=${amount}&destination_assets=${encodeURIComponent(assetString(destAsset))}`
  } else {
    url = `${horizonUrl}/paths/strict-receive?${assetParams(destAsset, 'destination')}&destination_amount=${amount}&source_assets=${encodeURIComponent(assetString(sourceAsset))}`
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Horizon error: ${res.status}`)
  const data = await res.json() as { _embedded?: { records: PaymentPathRecord[] } }
  return data._embedded?.records ?? []
}

export { StellarSdk }
