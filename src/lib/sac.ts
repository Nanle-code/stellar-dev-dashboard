import * as StellarSdk from '@stellar/stellar-sdk'
import { getServer, getSorobanServer, NETWORKS, type NetworkName } from './stellar'

export interface SacAsset {
  code?: string
  issuer?: string | null
  asset_type?: string
}

export interface SacMetadata {
  name?: string
  symbol?: string
  decimals?: number
  admin?: string
}

export interface SacInspection {
  contractId: string
  deployed: boolean
  metadata: SacMetadata
  error?: string
}

function asAsset(asset: SacAsset): StellarSdk.Asset {
  if (asset.asset_type === 'native' || !asset.issuer) return StellarSdk.Asset.native()
  if (!asset.code) throw new Error('A credit asset must include an asset code.')
  return new StellarSdk.Asset(asset.code, asset.issuer)
}

export function getSacContractId(asset: SacAsset, network: NetworkName): string {
  return asAsset(asset).contractId(NETWORKS[network].passphrase)
}

export function createSacDeploymentOperation(asset: SacAsset) {
  return StellarSdk.Operation.createStellarAssetContract({ asset: asAsset(asset) })
}

export async function inspectSac(asset: SacAsset, network: NetworkName): Promise<SacInspection> {
  const contractId = getSacContractId(asset, network)
  const metadata: SacMetadata = {}
  try {
    const server = getSorobanServer(network) as any
    if (typeof server.queryContract === 'function') {
      const calls = await Promise.allSettled([
        server.queryContract(contractId, 'name'),
        server.queryContract(contractId, 'symbol'),
        server.queryContract(contractId, 'decimals'),
        server.queryContract(contractId, 'admin'),
      ])
      const values = calls.map((call) => call.status === 'fulfilled' ? call.value?.result : undefined)
      if (typeof values[0] === 'string') metadata.name = values[0]
      if (typeof values[1] === 'string') metadata.symbol = values[1]
      if (typeof values[2] === 'number') metadata.decimals = values[2]
      if (typeof values[3] === 'string') metadata.admin = values[3]
    }
    await server.getContractData(
      contractId,
      StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
      StellarSdk.SorobanRpc.Durability.Persistent,
    )
    return { contractId, deployed: true, metadata }
  } catch (error) {
    return { contractId, deployed: false, metadata, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function submitSacDeployment(
  asset: SacAsset,
  sourceAccount: string,
  network: NetworkName,
  sign: (xdr: string, network: string) => Promise<string>,
): Promise<{ hash: string; contractId: string }> {
  if (network === 'mainnet') {
    throw new Error('Mainnet SAC deployment must be explicitly confirmed by the caller.')
  }
  const horizon = getServer(network)
  const account = await horizon.loadAccount(sourceAccount)
  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORKS[network].passphrase,
  })
    .addOperation(createSacDeploymentOperation(asset))
    .setTimeout(300)
    .build()
  const signedXdr = await sign(transaction.toXDR(), network.toUpperCase())
  const signed = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORKS[network].passphrase)
  const result = await horizon.submitTransaction(signed as any)
  return { hash: result.hash, contractId: getSacContractId(asset, network) }
}
