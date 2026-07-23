export interface Balances {
  asset_type: string
  asset_code?: string
  asset_issuer?: string
  balance: string
  limit?: string
}

export interface Signer {
  key: string
  type: string
  weight: number
}

export interface Thresholds {
  low_threshold: number
  med_threshold: number
  high_threshold: number
}

export interface AccountData {
  id: string
  account_id: string
  sequence: string
  subentry_count: number
  balances: Balances[]
  signers: Signer[]
  thresholds: Thresholds
  last_modified_ledger: number
}

export interface TransactionRecord {
  id: string
  hash: string
  source_account: string
  created_at: string
  fee_charged: number
  fee: number
  memo: string | null
  memo_type: string | null
  operation_count: number
  successful: boolean
  paging_token: string
}

export interface OperationRecord {
  id: string
  type: string
  type_i: number
  source_account: string
  created_at: string
  transaction_hash: string
  paging_token: string
}

export interface NetworkStats {
  latestLedger: {
    sequence: number
    closed_at: string
    transaction_count: number
    operation_count: number
    base_reserve: number
  }
  feeStats: {
    fee_charged: { max: string; min: string; p10: string; p20: string; p30: string; p50: string; p80: string; p95: string; p99: string }
    max_fee: { max: string; min: string; p10: string; p20: string; p30: string; p50: string; p80: string; p95: string; p99: string }
    ledger_capacity_usage: string
  }
}
