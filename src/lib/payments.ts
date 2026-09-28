// Thin shim: re-exports path-payment utilities from stellar.ts under the names
// expected by PathExplorer.tsx, and exports invariant validation engines.
export type { PaymentPathRecord as PathPaymentPath, FetchPaymentPathsParams } from './stellar';
export { fetchPaymentPaths as fetchPathPayments } from './stellar';

export * from './pathPaymentInvariants';
