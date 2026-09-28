import * as StellarSdk from '@stellar/stellar-sdk'
import { NETWORKS, type BuildTransactionParams } from './stellar'

export interface OperationFeeAttribution {
  operationIndex: number
  operationType: string
  sourceAccount?: string
  baseFee: number
  estimatedFee: number
  feeBreakdown: {
    base: number
    operationWeight: number
    complexityMultiplier: number
  }
}

export interface FeeAttributionReport {
  totalFee: number
  baseFee: number
  operationCount: number
  operations: OperationFeeAttribution[]
  feeBump?: {
    feeSource: string
    baseFee: number
    innerTransactionFee: number
  }
}

function getOperationTypeWeight(type: string): number {
  const weights: Record<string, number> = {
    payment: 1.0,
    createAccount: 1.2,
    changeTrust: 0.8,
    manageSellOffer: 1.1,
    manageBuyOffer: 1.1,
    setOptions: 0.9,
    accountMerge: 0.5,
    manageData: 0.7,
    pathPaymentStrictSend: 1.5,
    pathPaymentStrictReceive: 1.5,
    claimClaimableBalance: 1.0,
    createClaimableBalance: 1.3,
    bumpSequence: 0.6,
    revokeSponsorship: 0.9,
    beginSponsoringFutureReserves: 0.8,
    endSponsoringFutureReserves: 0.6,
    clawback: 1.1,
    feeBump: 0,
    invokeHostFunction: 2.0,
  }
  return weights[type] || 1.0
}

function getOperationComplexityMultiplier(op: StellarSdk.Operation): number {
  let multiplier = 1.0
  
  if (op.type === 'invokeHostFunction') {
    multiplier = 2.5
  } else if (op.type === 'pathPaymentStrictSend' || op.type === 'pathPaymentStrictReceive') {
    multiplier = 1.8
  } else if (op.type === 'createClaimableBalance') {
    multiplier = 1.5
  } else if (op.type === 'manageSellOffer' || op.type === 'manageBuyOffer') {
    multiplier = 1.3
  }
  
  return multiplier
}

function getOperationSource(op: StellarSdk.Operation): string | undefined {
  if ('source' in op && op.source) {
    const source = op.source
    if (typeof source === 'string') {
      return source
    }
    if ('ed25519' in source) {
      return StellarSdk.StrKey.encodeEd25519PublicKey(source.ed25519())
    }
    // Handle MuxedAccount
    if ('accountId' in source) {
      return StellarSdk.StrKey.encodeEd25519PublicKey(source.accountId.ed25519())
    }
  }
  return undefined
}

export function calculateOperationFeeAttribution(
  params: BuildTransactionParams
): FeeAttributionReport {
  const { operations, baseFee = 100, network = 'testnet' } = params
  
  const passphrase = NETWORKS[network]?.passphrase || NETWORKS.testnet.passphrase
  
  let transaction: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction
  
  try {
    transaction = StellarSdk.TransactionBuilder.fromXDR(
      StellarSdk.TransactionBuilder.fromXDR(
        buildTransactionXDR(params),
        passphrase
      ).toXDR(),
      passphrase
    )
  } catch {
    return {
      totalFee: 0,
      baseFee,
      operationCount: operations.length,
      operations: operations.map((op, index) => ({
        operationIndex: index,
        operationType: op.type,
        sourceAccount: getOperationSourceFromParams(op),
        baseFee,
        estimatedFee: baseFee,
        feeBreakdown: {
          base: baseFee,
          operationWeight: getOperationTypeWeight(op.type),
          complexityMultiplier: 1.0,
        },
      })),
    }
  }

  const operationAttributions: OperationFeeAttribution[] = []
  
  if (transaction instanceof StellarSdk.FeeBumpTransaction) {
    const innerOps = transaction.innerTransaction.operations
    const feeBumpFee = parseInt(transaction.fee.toString(), 10)
    const innerFee = parseInt(transaction.innerTransaction.fee.toString(), 10)
    
    for (let i = 0; i < innerOps.length; i++) {
      const op = innerOps[i]
      const opType = op.type
      const weight = getOperationTypeWeight(opType)
      const complexity = getOperationComplexityMultiplier(op)
      
      const estimatedFee = Math.ceil((innerFee / innerOps.length) * weight * complexity)
      
      operationAttributions.push({
        operationIndex: i,
        operationType: opType,
        sourceAccount: getOperationSource(op),
        baseFee: innerFee / innerOps.length,
        estimatedFee,
        feeBreakdown: {
          base: innerFee / innerOps.length,
          operationWeight: weight,
          complexityMultiplier: complexity,
        },
      })
    }
    
    return {
      totalFee: feeBumpFee + innerFee,
      baseFee: feeBumpFee,
      operationCount: innerOps.length + 1,
      operations: operationAttributions,
      feeBump: {
        feeSource: transaction.feeSource,
        baseFee: feeBumpFee,
        innerTransactionFee: innerFee,
      },
    }
  }
  
  const totalFee = parseInt(transaction.fee.toString(), 10)
  const opCount = transaction.operations.length
  
  for (let i = 0; i < opCount; i++) {
    const op = transaction.operations[i]
    const opType = op.type
    const weight = getOperationTypeWeight(opType)
    const complexity = getOperationComplexityMultiplier(op)
    
    const basePerOp = Math.floor(totalFee / opCount)
    const estimatedFee = Math.ceil(basePerOp * weight * complexity)
    
    operationAttributions.push({
      operationIndex: i,
      operationType: opType,
      sourceAccount: getOperationSource(op),
      baseFee: basePerOp,
      estimatedFee,
      feeBreakdown: {
        base: basePerOp,
        operationWeight: weight,
        complexityMultiplier: complexity,
      },
    })
  }
  
  return {
    totalFee,
    baseFee,
    operationCount: opCount,
    operations: operationAttributions,
  }
}

function getOperationSourceFromParams(op: BuildTransactionParams['operations'][0]): string | undefined {
  const params = op.params as Record<string, unknown>
  if (params.source) return String(params.source)
  if (params.from) return String(params.from)
  if (params.destination) return String(params.destination)
  if (params.account) return String(params.account)
  if (params.sponsoredId) return String(params.sponsoredId)
  if (params.feeSource) return String(params.feeSource)
  return undefined
}

function buildTransactionXDR(params: BuildTransactionParams): string {
  const passphrase = NETWORKS[params.network || 'testnet']?.passphrase || NETWORKS.testnet.passphrase
  const account = new StellarSdk.Account(
    params.sourceAccount || StellarSdk.Keypair.random().publicKey(),
    '1'
  )
  
  const builder = new StellarSdk.TransactionBuilder(account, {
    fee: params.baseFee.toString(),
    networkPassphrase: passphrase,
  })
  
  builder.setTimeout(180)
  
  params.operations.forEach((op) => {
    builder.addOperation(createOperationFromParams(op))
  })
  
  if (params.memo) {
    switch (params.memoType || 'text') {
      case 'text':
        builder.addMemo(StellarSdk.Memo.text(params.memo))
        break
      case 'id':
        builder.addMemo(StellarSdk.Memo.id(params.memo))
        break
      case 'hash':
        builder.addMemo(StellarSdk.Memo.hash(params.memo))
        break
      case 'return':
        builder.addMemo(StellarSdk.Memo.return(params.memo))
        break
    }
  }
  
  return builder.build().toXDR()
}

function createOperationFromParams(op: BuildTransactionParams['operations'][0]): StellarSdk.Operation {
  const p = op.params as Record<string, unknown>
  
  switch (op.type) {
    case 'payment':
      return StellarSdk.Operation.payment({
        destination: String(p.destination),
        asset: p.assetType === 'native' 
          ? StellarSdk.Asset.native() 
          : new StellarSdk.Asset(String(p.assetCode), String(p.assetIssuer)),
        amount: String(p.amount),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'createAccount':
      return StellarSdk.Operation.createAccount({
        destination: String(p.destination),
        startingBalance: String(p.startingBalance),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'changeTrust':
      return StellarSdk.Operation.changeTrust({
        asset: new StellarSdk.Asset(String(p.assetCode), String(p.assetIssuer)),
        limit: p.limit ? String(p.limit) : undefined,
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'manageSellOffer':
      return StellarSdk.Operation.manageSellOffer({
        selling: p.sellingAssetType === 'native'
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(String(p.sellingAssetCode), String(p.sellingAssetIssuer)),
        buying: p.buyingAssetType === 'native'
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(String(p.buyingAssetCode), String(p.buyingAssetIssuer)),
        amount: String(p.amount),
        price: String(p.price),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'manageBuyOffer':
      return StellarSdk.Operation.manageBuyOffer({
        selling: p.sellingAssetType === 'native'
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(String(p.sellingAssetCode), String(p.sellingAssetIssuer)),
        buying: p.buyingAssetType === 'native'
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(String(p.buyingAssetCode), String(p.buyingAssetIssuer)),
        buyAmount: String(p.buyAmount),
        price: String(p.price),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'setOptions':
      const options: Record<string, unknown> = {}
      if (p.homeDomain) options.homeDomain = String(p.homeDomain)
      if (p.setFlags) options.setFlags = parseInt(String(p.setFlags), 10)
      if (p.clearFlags) options.clearFlags = parseInt(String(p.clearFlags), 10)
      return StellarSdk.Operation.setOptions(options)
      
    case 'accountMerge':
      return StellarSdk.Operation.accountMerge({
        destination: String(p.destination),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'manageData':
      return StellarSdk.Operation.manageData({
        name: String(p.name),
        value: p.value ? String(p.value) : null,
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'pathPaymentStrictSend':
      return StellarSdk.Operation.pathPaymentStrictSend({
        sendAsset: p.sendAssetType === 'native'
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(String(p.sendAssetCode), String(p.sendAssetIssuer)),
        sendAmount: String(p.sendAmount),
        destination: String(p.destination),
        destAsset: p.destAssetType === 'native'
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(String(p.destAssetCode), String(p.destAssetIssuer)),
        destMin: String(p.destMin),
        path: (p.path as Array<{assetCode: string; assetIssuer: string}> || []).map(
          a => new StellarSdk.Asset(a.assetCode, a.assetIssuer)
        ),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'pathPaymentStrictReceive':
      return StellarSdk.Operation.pathPaymentStrictReceive({
        sendAsset: p.sendAssetType === 'native'
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(String(p.sendAssetCode), String(p.sendAssetIssuer)),
        sendMax: String(p.sendMax),
        destination: String(p.destination),
        destAsset: p.destAssetType === 'native'
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(String(p.destAssetCode), String(p.destAssetIssuer)),
        destAmount: String(p.destAmount),
        path: (p.path as Array<{assetCode: string; assetIssuer: string}> || []).map(
          a => new StellarSdk.Asset(a.assetCode, a.assetIssuer)
        ),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'claimClaimableBalance':
      return StellarSdk.Operation.claimClaimableBalance({
        balanceId: String(p.balanceId),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'createClaimableBalance':
      return StellarSdk.Operation.createClaimableBalance({
        asset: p.assetType === 'native'
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(String(p.assetCode), String(p.assetIssuer)),
        amount: String(p.amount),
        claimants: (p.claimants as Array<{destination: string; predicate: unknown}> || []).map(
          c => new StellarSdk.Claimant(c.destination, c.predicate)
        ),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'bumpSequence':
      return StellarSdk.Operation.bumpSequence({
        bumpTo: String(p.bumpTo),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'revokeSponsorship':
      return StellarSdk.Operation.revokeAccountSponsorship({
        account: String(p.account),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'beginSponsoringFutureReserves':
      return StellarSdk.Operation.beginSponsoringFutureReserves({
        sponsoredId: String(p.sponsoredId),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'endSponsoringFutureReserves':
      return StellarSdk.Operation.endSponsoringFutureReserves({
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'clawback':
      return StellarSdk.Operation.clawback({
        asset: new StellarSdk.Asset(String(p.assetCode), String(p.assetIssuer)),
        from: String(p.from),
        amount: String(p.amount),
        source: p.source ? String(p.source) : undefined,
      })
      
    case 'invokeHostFunction':
      const contract = new StellarSdk.Contract(String(p.contractId))
      const args = (p.args as Array<{type: string; value: unknown}> || []).map(arg => {
        switch (arg.type) {
          case 'string':
            return StellarSdk.nativeToScVal(String(arg.value), { type: 'string' })
          case 'int':
            return StellarSdk.nativeToScVal(BigInt(String(arg.value)), { type: 'i128' })
          case 'address':
            return StellarSdk.Address.fromString(String(arg.value)).toScVal()
          case 'bool':
            return StellarSdk.nativeToScVal(arg.value === 'true', { type: 'bool' })
          default:
            throw new Error(`Unsupported argument type: ${arg.type}`)
        }
      })
      return contract.call(String(p.functionName), ...args)
      
    default:
      throw new Error(`Unsupported operation type: ${op.type}`)
  }
}

export function formatFeeAttribution(report: FeeAttributionReport): string {
  const lines = [
    '=== Fee Attribution Breakdown ===',
    `Total Fee: ${report.totalFee.toLocaleString()} stroops (${(report.totalFee / 10_000_000).toFixed(7)} XLM)`,
    `Base Fee: ${report.baseFee} stroops`,
    `Operation Count: ${report.operationCount}`,
    '',
    'Per-Operation Breakdown:',
  ]
  
  for (const op of report.operations) {
    const percentage = report.totalFee > 0 ? ((op.estimatedFee / report.totalFee) * 100).toFixed(1) : '0'
    lines.push(
      `  [${op.operationIndex + 1}] ${op.operationType}${
        op.sourceAccount ? ` (source: ${op.sourceAccount.slice(0, 8)}...)` : ''
      }`
    )
    lines.push(
      `      Estimated: ${op.estimatedFee.toLocaleString()} stroops (${percentage}%) | ` +
      `Base: ${op.baseFee} | Weight: ${op.feeBreakdown.operationWeight} | Complexity: ${op.feeBreakdown.complexityMultiplier}x`
    )
  }
  
  if (report.feeBump) {
    lines.push('')
    lines.push('Fee-Bump Transaction:')
    lines.push(`  Fee Source: ${report.feeBump.feeSource}`)
    lines.push(`  Fee-Bump Fee: ${report.feeBump.baseFee.toLocaleString()} stroops`)
    lines.push(`  Inner Transaction Fee: ${report.feeBump.innerTransactionFee.toLocaleString()} stroops`)
  }
  
  return lines.join('\n')
}