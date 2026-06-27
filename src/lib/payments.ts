// Thin shim: re-exports path-payment utilities from stellar.ts under the names
// expected by PathExplorer.tsx.
export type { PaymentPathRecord as PathPaymentPath, FetchPaymentPathsParams } from './stellar'
export { fetchPaymentPaths as fetchPathPayments } from './stellar'
