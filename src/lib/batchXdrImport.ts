import * as StellarSdk from '@stellar/stellar-sdk'
import { NETWORKS } from './stellar'
import { inspectEnvelope, type EnvelopeInfo, type InspectError } from '../utils/feeBumpInspector'

export interface XdrImportItem {
  xdr: string
  label?: string
}

export interface ValidationReportItem {
  index: number
  label?: string
  valid: boolean
  envelope?: EnvelopeInfo
  error?: string
  warnings?: string[]
}

export interface BatchXdrImportResult {
  items: ValidationReportItem[]
  summary: {
    total: number
    valid: number
    invalid: number
    hasFeeBump: boolean
    totalOperations: number
    totalFee: string
  }
}

export interface BatchXdrImportOptions {
  network: string
  skipEmpty?: boolean
  maxItems?: number
}

function parseXdrItem(
  xdr: string,
  network: string,
  index: number,
  label?: string
): ValidationReportItem {
  const trimmed = xdr.trim()
  
  if (!trimmed) {
    return {
      index,
      label,
      valid: false,
      error: 'XDR is empty',
    }
  }

  const result = inspectEnvelope(trimmed, network)
  
  if (!result.ok) {
    return {
      index,
      label,
      valid: false,
      error: result.error,
    }
  }

  const envelope = result.envelope
  const warnings: string[] = []

  if (envelope.type === 'fee_bump') {
    warnings.push('Fee-bump transaction detected - inner transaction will be validated separately')
  }

  if (envelope.operationCount === 0) {
    warnings.push('Transaction has no operations')
  }

  if (envelope.signatures === 0) {
    warnings.push('Transaction is not signed')
  }

  return {
    index,
    label,
    valid: true,
    envelope,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

export function importBatchXdr(
  items: XdrImportItem[],
  options: BatchXdrImportOptions
): BatchXdrImportResult {
  const { network, skipEmpty = true, maxItems = 100 } = options
  
  const limitedItems = items.slice(0, maxItems)
  
  const reports = limitedItems.map((item, index) => {
    if (skipEmpty && (!item.xdr || item.xdr.trim() === '')) {
      return {
        index,
        label: item.label,
        valid: false,
        error: 'XDR is empty',
      }
    }
    return parseXdrItem(item.xdr, network, index, item.label)
  })

  const validItems = reports.filter(r => r.valid)
  const invalidItems = reports.filter(r => !r.valid)
  
  const hasFeeBump = validItems.some(r => r.envelope?.type === 'fee_bump')
  const totalOperations = validItems.reduce((sum, r) => sum + (r.envelope?.operationCount || 0), 0)
  
  let totalFee = 0n
  for (const r of validItems) {
    if (r.envelope) {
      if (r.envelope.type === 'fee_bump') {
        totalFee += BigInt(r.envelope.fee)
        totalFee += BigInt(r.envelope.innerTransaction.fee)
      } else {
        totalFee += BigInt(r.envelope.fee)
      }
    }
  }

  return {
    items: reports,
    summary: {
      total: reports.length,
      valid: validItems.length,
      invalid: invalidItems.length,
      hasFeeBump,
      totalOperations,
      totalFee: totalFee.toString(),
    },
  }
}

export async function simulateBatchXdr(
  items: XdrImportItem[],
  network: string
): Promise<{
  results: Array<{
    index: number
    label?: string
    success: boolean
    fee?: string
    operationCount?: number
    error?: string
    warnings?: string[]
  }>
  summary: {
    total: number
    successful: number
    failed: number
    totalFee: string
    totalOperations: number
  }
}> {
  const importResult = importBatchXdr(items, { network, skipEmpty: false })
  
  const results = await Promise.all(
    importResult.items.map(async (report, index) => {
      if (!report.valid || !report.envelope) {
        return {
          index: report.index,
          label: report.label,
          success: false,
          error: report.error || 'Invalid XDR',
          warnings: report.warnings,
        }
      }

      try {
        const passphrase = NETWORKS[network]?.passphrase || NETWORKS.testnet.passphrase
        let transaction: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction
        
        // Use the original XDR from items array
        const originalXdr = items[index]?.xdr?.trim()
        if (!originalXdr) {
          return {
            index: report.index,
            label: report.label,
            success: false,
            error: 'Original XDR not found',
            warnings: report.warnings,
          }
        }
        
        transaction = StellarSdk.TransactionBuilder.fromXDR(originalXdr, passphrase)

        return {
          index: report.index,
          label: report.label,
          success: true,
          fee: transaction.fee,
          operationCount: report.envelope.operationCount,
          warnings: report.warnings,
        }
      } catch (err) {
        return {
          index: report.index,
          label: report.label,
          success: false,
          error: `Simulation failed: ${err instanceof Error ? err.message : String(err)}`,
          warnings: report.warnings,
        }
      }
    })
  )

  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)
  
  let totalFee = 0n
  let totalOps = 0
  for (const r of successful) {
    if (r.fee) totalFee += BigInt(r.fee)
    if (r.operationCount) totalOps += r.operationCount
  }

  return {
    results,
    summary: {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      totalFee: totalFee.toString(),
      totalOperations: totalOps,
    },
  }
}

export function validateXdrForBroadcast(
  xdr: string,
  network: string
): {
  valid: boolean
  error?: string
  envelope?: EnvelopeInfo
  warnings?: string[]
} {
  const result = inspectEnvelope(xdr, network)
  
  if (!result.ok) {
    return {
      valid: false,
      error: result.error,
    }
  }

  const envelope = result.envelope
  const warnings: string[] = []

  if (envelope.signatures === 0) {
    warnings.push('Transaction is not signed - will fail on submission')
  }

  if (envelope.operationCount === 0) {
    warnings.push('Transaction has no operations')
  }

  if (envelope.type === 'fee_bump' && envelope.innerTransaction.signatures === 0) {
    warnings.push('Inner transaction of fee-bump is not signed')
  }

  return {
    valid: true,
    envelope,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}