/**
 * Fee-bump envelope inspector.
 *
 * Parses any transaction XDR string and returns a structured summary that
 * callers can render without knowing the XDR format themselves.  Works for
 * both plain Transactions and FeeBumpTransactions.
 */

import * as StellarSdk from '@stellar/stellar-sdk'
import { NETWORKS } from '../lib/stellar'

export interface InnerEnvelopeInfo {
  hash: string
  source: string
  fee: string
  operationCount: number
  operations: Array<{ type: string; source: string | null }>
  sequenceNumber: string
  signatures: number
}

export interface FeeBumpInfo {
  type: 'fee_bump'
  hash: string
  feeSource: string
  fee: string
  innerTransaction: InnerEnvelopeInfo
}

export interface PlainTxInfo {
  type: 'transaction'
  hash: string
  source: string
  fee: string
  operationCount: number
  operations: Array<{ type: string; source: string | null }>
  sequenceNumber: string
  signatures: number
}

export type EnvelopeInfo = FeeBumpInfo | PlainTxInfo

export interface InspectResult {
  ok: true
  envelope: EnvelopeInfo
}

export interface InspectError {
  ok: false
  error: string
}

/**
 * Parse an XDR string and extract human-readable envelope details.
 *
 * @param xdr  - Base64-encoded XDR envelope string
 * @param network - One of 'testnet' | 'mainnet' | 'futurenet' | 'local' | 'custom'
 * @returns Discriminated union — check `.ok` before accessing `.envelope`
 */
export function inspectEnvelope(
  xdr: string,
  network: string,
): InspectResult | InspectError {
  if (!xdr || typeof xdr !== 'string' || xdr.trim() === '') {
    return { ok: false, error: 'XDR is empty.' }
  }

  const passphrase =
    (NETWORKS as Record<string, { passphrase: string }>)[network]?.passphrase ??
    NETWORKS.testnet.passphrase

  let parsed: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction
  try {
    parsed = StellarSdk.TransactionBuilder.fromXDR(xdr.trim(), passphrase)
  } catch (err) {
    return {
      ok: false,
      error: `Could not parse XDR: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (parsed instanceof StellarSdk.FeeBumpTransaction) {
    const inner = parsed.innerTransaction
    return {
      ok: true,
      envelope: {
        type: 'fee_bump',
        hash: parsed.hash().toString('hex'),
        feeSource: parsed.feeSource,
        fee: parsed.fee,
        innerTransaction: {
          hash: inner.hash().toString('hex'),
          source: inner.source,
          fee: inner.fee,
          operationCount: inner.operations.length,
          operations: inner.operations.map((op) => ({
            type: op.type,
            source: op.source ?? null,
          })),
          sequenceNumber: inner.sequence,
          signatures: inner.signatures.length,
        },
      },
    }
  }

  // Plain transaction
  const tx = parsed as StellarSdk.Transaction
  return {
    ok: true,
    envelope: {
      type: 'transaction',
      hash: tx.hash().toString('hex'),
      source: tx.source,
      fee: tx.fee,
      operationCount: tx.operations.length,
      operations: tx.operations.map((op) => ({
        type: op.type,
        source: op.source ?? null,
      })),
      sequenceNumber: tx.sequence,
      signatures: tx.signatures.length,
    },
  }
}
