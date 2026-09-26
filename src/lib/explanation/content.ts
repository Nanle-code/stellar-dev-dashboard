import { OPERATION_LABELS } from '../stellar'
import { STELLAR_ERROR_CODES } from '../errorHandling/ErrorMessages'

export interface ExplanationContent {
  title: string
  description: string
  keyFields: string[]
  commonFailureCodes: string[]
  docsUrl: string
}

const STELLAR_DOCS = 'https://developers.stellar.org/docs'

const OPERATION_FAILURES: Record<string, string[]> = {
  create_account: ['op_op_bad_auth', 'op_low_reserve', 'op_underfunded'],
  payment: ['op_no_destination', 'op_underfunded', 'op_no_trust'],
  path_payment_strict_send: ['op_no_destination', 'op_underfunded', 'op_no_trust'],
  path_payment_strict_receive: ['op_no_destination', 'op_underfunded', 'op_no_trust'],
  change_trust: ['op_invalid_limit', 'op_no_issuer', 'op_self_not_allowed'],
  allow_trust: ['op_no_trust', 'op_not_authorized'],
  account_merge: ['op_no_destination', 'op_underfunded'],
  invoke_host_function: ['tx_bad_auth', 'tx_insufficient_balance', 'tx_insufficient_fee'],
  extend_footprint_ttl: ['tx_bad_auth', 'tx_insufficient_balance'],
  restore_footprint: ['tx_bad_auth', 'tx_insufficient_balance'],
}

const OPERATION_FIELDS: Record<string, string[]> = {
  create_account: ['source', 'destination', 'startingBalance'],
  payment: ['source', 'destination', 'asset', 'amount'],
  path_payment_strict_send: ['source', 'destination', 'sendAsset', 'sendAmount', 'path'],
  path_payment_strict_receive: ['source', 'destination', 'sendAsset', 'destAsset', 'destAmount', 'path'],
  change_trust: ['source', 'asset', 'limit'],
  manage_buy_offer: ['source', 'selling', 'buying', 'buyAmount', 'price'],
  manage_sell_offer: ['source', 'selling', 'buying', 'amount', 'price'],
  invoke_host_function: ['source', 'contract', 'function', 'arguments', 'footprint'],
}

function humanize(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildOperationContent(type: string, title: string): ExplanationContent {
  const soroban = type === 'invoke_host_function' || type === 'extend_footprint_ttl' || type === 'restore_footprint'
  return {
    title,
    description: soroban
      ? `${title} executes a Soroban transaction against the network.`
      : `${title} changes Stellar account, asset, or offer state on the network.`,
    keyFields: OPERATION_FIELDS[type] ?? ['source', 'transaction', 'network'],
    commonFailureCodes: OPERATION_FAILURES[type] ?? ['tx_bad_auth', 'tx_bad_seq', 'tx_insufficient_fee'],
    docsUrl: `${STELLAR_DOCS}/${soroban ? 'learn/smart-contracts' : 'build/guides/transactions'}`,
  }
}

/** Localizable content for every operation supported by the dashboard. */
export const OPERATION_EXPLANATIONS: Record<string, ExplanationContent> = Object.fromEntries(
  Object.entries(OPERATION_LABELS).map(([type, title]) => [type, buildOperationContent(type, title)]),
)

/** Content for transaction and operation result codes, including unknown codes. */
export const RESULT_CODE_EXPLANATIONS: Record<string, ExplanationContent> = Object.fromEntries(
  Object.entries(STELLAR_ERROR_CODES).map(([code, description]) => [code, {
    title: humanize(code),
    description,
    keyFields: ['transaction result', 'operation result', 'source account'],
    commonFailureCodes: [code],
    docsUrl: `${STELLAR_DOCS}/build/guides/transactions/errors`,
  }]),
)

export function getOperationExplanation(type: string): ExplanationContent {
  return OPERATION_EXPLANATIONS[type] ?? buildOperationContent(type, humanize(type))
}

export function getResultCodeExplanation(code: string): ExplanationContent {
  return RESULT_CODE_EXPLANATIONS[code] ?? {
    title: humanize(code),
    description: 'The Stellar network rejected this transaction or operation. Inspect the transaction details and retry after correcting the reported condition.',
    keyFields: ['transaction result', 'operation result'],
    commonFailureCodes: [code],
    docsUrl: `${STELLAR_DOCS}/build/guides/transactions/errors`,
  }
}

