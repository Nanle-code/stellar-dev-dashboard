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

export { StellarSdk }
