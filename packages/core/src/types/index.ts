import type { NetworkName, NetworkConfig } from '../networks.js';

export interface Balances {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
}

export interface Signer {
  key: string;
  type: string;
  weight: number;
}

export interface Thresholds {
  low_threshold: number;
  med_threshold: number;
  high_threshold: number;
}

export interface AccountData {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  balances: Balances[];
  signers: Signer[];
  thresholds: Thresholds;
  last_modified_ledger: number;
}

export interface TransactionRecord {
  id: string;
  hash: string;
  source_account: string;
  created_at: string;
  fee_charged: number;
  fee: number;
  memo: string | null;
  memo_type: string | null;
  operation_count: number;
  successful: boolean;
  paging_token: string;
}

export interface OperationRecord {
  id: string;
  type: string;
  type_i: number;
  source_account: string;
  created_at: string;
  transaction_hash: string;
  paging_token: string;
}

export interface FeeStats {
  fee_charged: PercentileStats;
  max_fee: PercentileStats;
  ledger_capacity_usage: string;
}

export interface PercentileStats {
  max: string;
  min: string;
  p10: string;
  p20: string;
  p30: string;
  p50: string;
  p80: string;
  p95: string;
  p99: string;
}

export interface LatestLedger {
  sequence: number;
  closed_at: string;
  transaction_count: number;
  operation_count: number;
  base_reserve: number;
}

export interface NetworkStats {
  latestLedger: LatestLedger;
  feeStats: FeeStats;
}

export interface NetworkProbeResult {
  network: NetworkName;
  name: string;
  horizon: ServiceProbeResult;
  soroban: ServiceProbeResult;
}

export type ProbeStatus = 'up' | 'degraded' | 'down';

export interface ServiceProbeResult {
  url: string;
  status: ProbeStatus;
  latency: number | null;
  statusCode?: number;
  breakerState: CircuitState;
  error?: string;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface MemoRequirementResult {
  required: boolean;
  checked: boolean;
  error?: string;
}

export interface ResolvedAddress {
  accountId: string;
  muxedId?: string;
  originalInput: string;
  inputType: 'ed25519' | 'muxed' | 'federated';
  federatedAddress?: string;
  memoId?: string;
  memoType?: string;
}

export type MemoType = 'none' | 'text' | 'id' | 'hash' | 'return';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface AssetInfo {
  code: string;
  issuer: string;
  domain?: string;
  name?: string;
  description?: string;
  image?: string;
  conditions?: string;
  is_verified?: boolean;
  is_asset_anchored?: boolean;
  anchor_asset_type?: string;
  anchor_asset?: string;
  redemption_instructions?: string;
  collateral_addresses?: string[];
  collateral_address_messages?: string[];
  status?: string;
  display_decimals?: number;
  num_accounts?: number;
  amount?: string;
  flags?: {
    auth_required?: boolean;
    auth_revocable?: boolean;
    auth_immutable?: boolean;
    auth_clawback_enabled?: boolean;
  };
  paging_token?: string;
}

export interface AccountReserves {
  baseReserve: number;
  signerReserve: number;
  assetReserve: number;
  offerReserve: number;
  subentryReserve: number;
  totalReserves: number;
  availableBalance: number;
  totalBalance: number;
}

export interface XLMPrice {
  usd: number;
}

export { NetworkName, NetworkConfig };