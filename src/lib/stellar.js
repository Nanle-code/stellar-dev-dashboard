import * as StellarSdk from '@stellar/stellar-sdk'

export const NETWORKS = {
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

export function getServer(network = 'testnet') {
  return new StellarSdk.Horizon.Server(NETWORKS[network].horizonUrl)
}

export function getSorobanServer(network = 'testnet') {
  return new StellarSdk.SorobanRpc.Server(NETWORKS[network].sorobanUrl)
}

export async function fetchAccount(publicKey, network = 'testnet') {
  const server = getServer(network)
  return await server.loadAccount(publicKey)
}

export async function fetchTransactions(publicKey, network = 'testnet', limit = 20) {
  const server = getServer(network)
  const txs = await server
    .transactions()
    .forAccount(publicKey)
    .order('desc')
    .limit(limit)
    .call()
  return txs.records
}

export async function fetchOperations(publicKey, network = 'testnet', limit = 20) {
  const server = getServer(network)
  const ops = await server
    .operations()
    .forAccount(publicKey)
    .order('desc')
    .limit(limit)
    .call()
  return ops.records
}

export async function fetchAccountOffers(publicKey, network = 'testnet') {
  const server = getServer(network)
  const offers = await server
    .offers()
    .forAccount(publicKey)
    .call()
  return offers.records
}

export async function fetchAccountCreationDate(publicKey, network = 'testnet') {
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

export async function fetchNetworkStats(network = 'testnet') {
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

export function streamLedgers(callback, network = 'testnet') {
  const server = getServer(network)
  return server
    .ledgers()
    .cursor('now')
    .stream({
      onmessage: (ledger) => callback(ledger),
      onerror: (error) => console.error('Ledger stream error:', error),
    })
}

export async function fundTestnetAccount(publicKey) {
  const res = await fetch(
    `${NETWORKS.testnet.faucetUrl}?addr=${publicKey}`
  )
  if (!res.ok) throw new Error('Faucet request failed')
  return await res.json()
}

export async function fetchContractInfo(contractId, network = 'testnet') {
  const server = getSorobanServer(network)
  try {
    const instance = await server.getContractData(
      contractId,
      StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
      StellarSdk.SorobanRpc.Durability.Persistent
    )
    return instance
  } catch (e) {
    throw new Error(`Contract not found: ${e.message}`)
  }
}

function getLedgerKeyType(key) {
  const kind = key.switch()
  return kind?.name || kind?.toString?.() || 'unknown'
}

function serializeLedgerKey(key) {
  return {
    type: getLedgerKeyType(key),
    xdr: key.toXDR('base64'),
  }
}

function serializeScVal(value) {
  try {
    return StellarSdk.scValToNative(value)
  } catch {
    return value.toXDR('base64')
  }
}

function serializeDiagnosticEvent(event) {
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

function parseContractArgument({ type, value }, index) {
  const trimmedValue = value?.trim?.() ?? ''

  if (trimmedValue === '') {
    throw new Error(`Argument ${index + 1} is empty`)
  }

  switch (type) {
    case 'string':
      return StellarSdk.nativeToScVal(trimmedValue, { type: 'string' })
    case 'int': {
      let parsed
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
      throw new Error(`Unsupported argument type: ${type}`)
  }
}

async function buildContractInvocationTransaction({
  contractId,
  functionName,
  args = [],
  sourceAccount,
  network = 'testnet',
}) {
  if (!isValidContractId(contractId)) {
    throw new Error('Invalid contract address')
  }

  if (!functionName?.trim()) {
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

export async function simulateContractCall({
  contractId,
  functionName,
  args = [],
  sourceAccount,
  network = 'testnet',
}) {
  const server = getSorobanServer(network)
  const transaction = await buildContractInvocationTransaction({
    contractId,
    functionName,
    args,
    sourceAccount,
    network,
  })

  const simulation = await server.simulateTransaction(transaction)

  if (simulation.error) {
    throw new Error(simulation.error)
  }

  const footprint = simulation.transactionData
    ? {
        readOnly: simulation.transactionData.getReadOnly().map(serializeLedgerKey),
        readWrite: simulation.transactionData.getReadWrite().map(serializeLedgerKey),
        minResourceFee: simulation.minResourceFee,
      }
    : null

  return {
    xdr: transaction.toXDR(),
    latestLedger: simulation.latestLedger,
    cost: simulation.cost,
    result: simulation.result ? serializeScVal(simulation.result.retval) : null,
    events: (simulation.events || []).map(serializeDiagnosticEvent),
    footprint,
  }
}

export async function invokeContract({
  contractId,
  functionName,
  args = [],
  secretKey,
  network = 'testnet',
}) {
  if (network !== 'testnet') {
    throw new Error('Transaction submission is only enabled on Testnet')
  }

  if (!secretKey?.trim()) {
    throw new Error('Secret key is required to submit a transaction')
  }

  let keypair
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
    diagnosticEvents: (response.diagnosticEvents || []).map(event => event.toXDR('base64')),
  }
}

function normalizeContractValue(value) {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Uint8Array) return Array.from(value)
  if (Array.isArray(value)) return value.map(normalizeContractValue)

  if (value && typeof value === 'object') {
    if (typeof value.toString === 'function' && value.constructor && value.constructor.name === 'Address') {
      return value.toString()
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeContractValue(entry)])
    )
  }

  return value
}

function formatLedgerKey(key) {
  return {
    type: key.switch().name,
    xdr: key.toXDR('base64'),
  }
}

function formatFootprint(transactionData) {
  if (!transactionData) return { readOnly: [], readWrite: [] }

  return {
    readOnly: transactionData.getReadOnly().map(formatLedgerKey),
    readWrite: transactionData.getReadWrite().map(formatLedgerKey),
  }
}

function toContractScVal(arg, index) {
  const value = arg.value?.trim?.() ?? ''

  switch (arg.type) {
    case 'string':
      return StellarSdk.nativeToScVal(value)
    case 'int':
      if (!value) throw new Error(`Argument ${index + 1}: Enter an integer value`)
      try {
        return StellarSdk.nativeToScVal(BigInt(value), { type: 'i128' })
      } catch {
        throw new Error(`Argument ${index + 1}: Invalid integer value`)
      }
    case 'address':
      if (!value) throw new Error(`Argument ${index + 1}: Enter an address`)
      try {
        return StellarSdk.Address.fromString(value).toScVal()
      } catch {
        throw new Error(`Argument ${index + 1}: Invalid Stellar address`)
      }
    case 'bool':
      if (value !== 'true' && value !== 'false') {
        throw new Error(`Argument ${index + 1}: Boolean values must be true or false`)
      }
      return StellarSdk.nativeToScVal(value === 'true')
    default:
      throw new Error(`Argument ${index + 1}: Unsupported argument type`)
  }
}

async function buildContractInvocationTransaction({
  sourceAccount,
  contractId,
  functionName,
  args = [],
  network = 'testnet',
  fee = StellarSdk.BASE_FEE,
}) {
  if (!sourceAccount || !isValidPublicKey(sourceAccount)) {
    throw new Error('Enter a valid source account public key')
  }

  if (!contractId || !isValidContractId(contractId)) {
    throw new Error('Enter a valid contract ID')
  }

  if (!functionName?.trim()) {
    throw new Error('Enter a contract function name')
  }

  const account = await getServer(network).loadAccount(sourceAccount)
  const contract = new StellarSdk.Contract(contractId)
  const scArgs = args.map(toContractScVal)

  return new StellarSdk.TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase: NETWORKS[network].passphrase,
  })
    .addOperation(contract.call(functionName.trim(), ...scArgs))
    .setTimeout(30)
    .build()
}

function formatSimulation(simulation) {
  const isSuccess = StellarSdk.SorobanRpc.Api.isSimulationSuccess(simulation)
  const isRestore = StellarSdk.SorobanRpc.Api.isSimulationRestore(simulation)

  return {
    success: isSuccess,
    error: simulation.error || null,
    latestLedger: simulation.latestLedger,
    cost: simulation.cost || null,
    minResourceFee: simulation.minResourceFee || null,
    result: simulation.result ? normalizeContractValue(StellarSdk.scValToNative(simulation.result.retval)) : null,
    resultXdr: simulation.result?.retval?.toXDR('base64') || null,
    auth: simulation.result?.auth?.map((entry) => entry.toXDR('base64')) || [],
    events: StellarSdk.humanizeEvents(simulation.events || []).map(normalizeContractValue),
    footprint: isSuccess ? formatFootprint(simulation.transactionData) : { readOnly: [], readWrite: [] },
    stateChanges: simulation.stateChanges?.map((change) => ({
      type: change.type,
      key: change.key.toXDR('base64'),
      before: change.before ? change.before.toXDR('base64') : null,
      after: change.after ? change.after.toXDR('base64') : null,
    })) || [],
    restoreRequired: isRestore,
    restorePreamble: isRestore ? {
      minResourceFee: simulation.restorePreamble.minResourceFee,
      footprint: formatFootprint(simulation.restorePreamble.transactionData),
    } : null,
  }
}

async function waitForTransaction(server, hash, attempts = 12, delayMs = 1500) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await server.getTransaction(hash)

    if (response.status !== StellarSdk.SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
      return response
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  return null
}

function formatSubmittedTransaction(transaction) {
  if (!transaction) return null

  const diagnosticEvents = transaction.diagnosticEventsXdr
    ? StellarSdk.humanizeEvents(transaction.diagnosticEventsXdr).map(normalizeContractValue)
    : []

  return {
    status: transaction.status,
    ledger: transaction.ledger,
    createdAt: transaction.createdAt,
    returnValue: transaction.returnValue
      ? normalizeContractValue(StellarSdk.scValToNative(transaction.returnValue))
      : null,
    returnValueXdr: transaction.returnValue?.toXDR('base64') || null,
    events: diagnosticEvents,
    resultXdr: transaction.resultXdr?.toXDR('base64') || null,
  }
}

export async function simulateContractCall({
  sourceAccount,
  contractId,
  functionName,
  args = [],
  network = 'testnet',
}) {
  const server = getSorobanServer(network)
  const transaction = await buildContractInvocationTransaction({
    sourceAccount,
    contractId,
    functionName,
    args,
    network,
  })
  const simulation = await server.simulateTransaction(transaction)

  return {
    transactionXdr: transaction.toXDR(),
    ...formatSimulation(simulation),
  }
}

export async function invokeContract({
  contractId,
  functionName,
  args = [],
  secretKey,
  sourceAccount,
  network = 'testnet',
}) {
  if (network !== 'testnet') {
    throw new Error('Submitting contract invocations is only enabled on Testnet')
  }

  const trimmedSecret = secretKey?.trim()
  if (!trimmedSecret || !StellarSdk.StrKey.isValidEd25519SecretSeed(trimmedSecret)) {
    throw new Error('Enter a valid Stellar secret key')
  }

  const keypair = StellarSdk.Keypair.fromSecret(trimmedSecret)
  const derivedSourceAccount = keypair.publicKey()

  if (sourceAccount && sourceAccount !== derivedSourceAccount) {
    throw new Error('Source account must match the provided secret key')
  }

  const server = getSorobanServer(network)
  const transaction = await buildContractInvocationTransaction({
    sourceAccount: derivedSourceAccount,
    contractId,
    functionName,
    args,
    network,
  })

  const preparedTransaction = await server.prepareTransaction(transaction)
  preparedTransaction.sign(keypair)

  const sendResponse = await server.sendTransaction(preparedTransaction)

  if (sendResponse.status === 'ERROR') {
    throw new Error(sendResponse.errorResult
      ? sendResponse.errorResult.toXDR('base64')
      : 'Soroban RPC rejected the transaction')
  }

  const finalized = await waitForTransaction(server, sendResponse.hash)

  if (finalized?.status === StellarSdk.SorobanRpc.Api.GetTransactionStatus.FAILED) {
    throw new Error(finalized.resultXdr?.toXDR('base64') || 'Submitted transaction failed')
  }

  return {
    hash: sendResponse.hash,
    sendStatus: sendResponse.status,
    latestLedger: sendResponse.latestLedger,
    transactionXdr: preparedTransaction.toXDR(),
    transaction: formatSubmittedTransaction(finalized),
    pending: !finalized,
  }
}

export function isValidPublicKey(key) {
  return StellarSdk.StrKey.isValidEd25519PublicKey(key)
}

export function isValidContractId(id) {
  try {
    StellarSdk.Address.fromString(id)
    return true
  } catch {
    return false
  }
}

export function formatXLM(amount) {
  return parseFloat(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  })
}

export function shortAddress(addr, chars = 6) {
  if (!addr) return ''
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`
}

export async function buildTransaction({ sourceAccount, operations, memo, baseFee, timeBounds, network }) {
  const server = getServer(network)
  const account = await server.loadAccount(sourceAccount)

  const txBuilder = new StellarSdk.TransactionBuilder(account, {
    fee: baseFee.toString(),
    networkPassphrase: NETWORKS[network].passphrase,
  })

  // Add time bounds if specified
  if (timeBounds.minTime || timeBounds.maxTime) {
    txBuilder.setTimeout(
      timeBounds.maxTime ? parseInt(timeBounds.maxTime) - Math.floor(Date.now() / 1000) : 0
    )
  }

  // Add operations
  operations.forEach(op => {
    if (op.type === 'payment') {
      txBuilder.addOperation(StellarSdk.Operation.payment({
        destination: op.destination,
        asset: StellarSdk.Asset.native(),
        amount: op.amount
      }))
    } else if (op.type === 'createAccount') {
      txBuilder.addOperation(StellarSdk.Operation.createAccount({
        destination: op.destination,
        startingBalance: op.startingBalance
      }))
    }
  })

  // Add memo if specified
  if (memo) {
    txBuilder.addMemo(StellarSdk.Memo.text(memo))
  }

  return txBuilder.build()
}

export async function simulateTransaction(params) {
  try {
    const transaction = await buildTransaction(params)

    // For simulation, we'll validate the transaction structure and estimate fees
    // In a real implementation, you might use Soroban RPC for more detailed simulation

    // Basic validation
    if (!isValidPublicKey(params.sourceAccount)) {
      throw new Error('Invalid source account')
    }

    // Validate operations
    const errors = []
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

    // Calculate estimated fee (base fee * number of operations)
    const estimatedFee = params.baseFee * params.operations.length

    return {
      fee: estimatedFee,
      operationCount: transaction.operations.length,
      success: errors.length === 0,
      errors,
      xdr: transaction.toXDR()
    }
  } catch (error) {
    return {
      fee: 0,
      operationCount: params.operations.length,
      success: false,
      errors: [error.message]
    }
  }
}

export async function exportTransactionXDR(params) {
  const transaction = await buildTransaction(params)
  return transaction.toXDR()
}

export async function fetchPaymentPaths({ sourceAsset, destAsset, amount, mode = 'strict-send', network = 'testnet' }) {
  const horizonUrl = NETWORKS[network].horizonUrl

  function assetParams(asset, prefix) {
    if (asset.type === 'native') {
      return `${prefix}_asset_type=native`
    }
    return `${prefix}_asset_type=credit_alphanum${asset.code.length <= 4 ? '4' : '12'}&${prefix}_asset_code=${asset.code}&${prefix}_asset_issuer=${asset.issuer}`
  }

  function assetString(asset) {
    if (asset.type === 'native') return 'native'
    return `${asset.code}:${asset.issuer}`
  }

  let url
  if (mode === 'strict-send') {
    url = `${horizonUrl}/paths/strict-send?${assetParams(sourceAsset, 'source')}&source_amount=${amount}&destination_assets=${encodeURIComponent(assetString(destAsset))}`
  } else {
    url = `${horizonUrl}/paths/strict-receive?${assetParams(destAsset, 'destination')}&destination_amount=${amount}&source_assets=${encodeURIComponent(assetString(sourceAsset))}`
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Horizon error: ${res.status}`)
  const data = await res.json()
  return data._embedded?.records || []
}

export { StellarSdk }
