import * as StellarSdk from '@stellar/stellar-sdk'

// ─── Network config ───────────────────────────────────────────────────────────

export type NetworkName = 'mainnet' | 'testnet'

export interface NetworkConfig {
  name: string
  horizonUrl: string
  sorobanUrl: string
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
}

// ─── Servers ──────────────────────────────────────────────────────────────────

export function getServer(network: NetworkName = 'testnet'): StellarSdk.Horizon.Server {
  return new StellarSdk.Horizon.Server(NETWORKS[network].horizonUrl)
}

export function getSorobanServer(network: NetworkName = 'testnet'): StellarSdk.SorobanRpc.Server {
  return new StellarSdk.SorobanRpc.Server(NETWORKS[network].sorobanUrl)
}

// ─── Account ──────────────────────────────────────────────────────────────────

export async function fetchAccount(
  publicKey: string,
  network: NetworkName = 'testnet'
): Promise<StellarSdk.Horizon.AccountResponse> {
  const server = getServer(network)
  return server.loadAccount(publicKey)
}

// ─── Transactions & Operations ────────────────────────────────────────────────

export async function fetchTransactions(
  publicKey: string,
  network: NetworkName = 'testnet',
  limit = 20,
  cursor: string | null = null
): Promise<{ records: StellarSdk.Horizon.ServerApi.TransactionRecord[]; nextCursor: string | null; hasMore: boolean }> {
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
  cursor: string | null = null
): Promise<{ records: StellarSdk.Horizon.ServerApi.OperationRecord[]; nextCursor: string | null; hasMore: boolean }> {
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

  return {
    records,
    nextCursor,
    hasMore: records.length === limit && !!nextCursor,
  }
}

export async function fetchAccountOffers(
  publicKey: string,
  network: NetworkName = 'testnet'
): Promise<StellarSdk.Horizon.ServerApi.OfferRecord[]> {
  const server = getServer(network)
  const offers = await server
    .offers()
    .forAccount(publicKey)
    .call()
  return offers.records
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
  const server = getServer(network)
  const [ledger, feeStats] = await Promise.all([
    server.ledgers().order('desc').limit(1).call(),
    server.feeStats(),
  ])
  return {
    latestLedger: ledger.records[0],
    feeStats,
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

