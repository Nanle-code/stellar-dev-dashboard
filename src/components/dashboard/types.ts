import type { Horizon } from '@stellar/stellar-sdk'

/** A single widget's configuration within the dashboard grid layout */
export interface WidgetConfig {
  id: string
  type: string
  height: number
  span: number
  order?: number
  component?: React.ReactElement
}

/** Serialised layout saved to user preferences — no React elements */
export interface WidgetLayout {
  id: string
  type: string
  height: number
  span: number
  order: number
}

/** Arguments passed to a contract function invocation */
export interface ContractArg {
  type: string
  value: string
}

/** Form state for the Contract Interaction panel */
export interface ContractFormData {
  contractId: string
  functionName: string
  sourceAccount: string
  secretKey: string
  args: ContractArg[]
}

/** A single operation within the Transaction Builder */
export interface BuilderOperation {
  id: number
  type: string
  [key: string]: unknown
}

/** Parameters passed to build / simulate a transaction */
export interface TransactionBuildParams {
  sourceAccount: string
  operations: BuilderOperation[]
  memo?: string
  memoType?: string
  baseFee: number
  timeout?: number
  timeBounds?: { minTime?: string; maxTime?: string }
  network: string
}

/** Simulation result returned by the transaction simulation API */
export interface SimulationResult {
  success: boolean
  fee?: number
  operationCount?: number
  hash?: string
  xdr?: string
  errors?: string[]
  warnings?: string[]
  feeOptions?: { label: string; fee: number }[]
  resourceUsage?: { cpuInstructions?: number }
  sorobanMetrics?: {
    resourceFee: number
    footprint: { readOnly: string[]; readWrite: string[] }
  }
  result?: unknown
  events?: unknown[]
}

/** A single asset entry in the portfolio breakdown */
export interface PortfolioItem {
  code: string
  amount: number
  issuer?: string | null
  priceUsd: number | null
  valueUsd: number | null
  change24h: number | null
}

/** Computed portfolio value */
export interface PortfolioValue {
  totalUsd: number
  items: PortfolioItem[]
}

/** Allocation breakdown for a single asset */
export interface AllocationItem {
  code: string
  asset?: string
  allocation: number
  percentage?: number
  valueUsd: number
  issuer?: string | null
}

/** A concentration risk found in the portfolio */
export interface ConcentrationRisk {
  asset: string
  code?: string
  message: string
  percentage: number
  allocation?: number
  riskLevel?: string
}

/** Volatility and diversification assessment for the portfolio */
export interface PortfolioAnalytics {
  allocation: AllocationItem[]
  diversificationScore: number
  concentrationRisks: ConcentrationRisk[]
  concentrationRiskScore?: number
  counterpartyRisk?: CounterpartyRisk
  change24h: number | null
  historicalPerformance: HistoricalPoint[]
  volatility: number
  riskAssessment: RiskAssessment
  summary: unknown
}

/** A single data point in the historical performance chart */
export interface HistoricalPoint {
  date: string
  balances: Record<string, number>
  value?: number
}

/** Risk assessment result */
export interface RiskAssessment {
  level: string
  score: number
  factors: { name?: string; factor?: string; description?: string; impact?: string }[]
  recommendations?: string[]
  components?: Record<string, number>
}

export interface CounterpartyRisk {
  score: number
  level: string
  issuerCount: number
  largestIssuerExposure: number
  issuedExposure?: number
  unpricedExposure: number
  unpricedAssets?: number
  issuerExposures: Array<{
    issuer: string
    valueUsd: number
    percentage: number
    assets: string[]
  }>
  factors: RiskAssessment['factors']
  recommendations: string[]
}

/** Recharts pie chart data entry */
export interface PieChartDatum {
  name: string
  value: number
  valueUsd: number
}

/** Recharts bar chart entry for 24h asset performance */
export interface AssetPerformanceBar {
  asset: string
  change: number
  value: number
}

/** Price information for a single asset from the store */
export interface PriceInfo {
  usd: number | null
  usd_24h_change: number | null
}

/** A ledger entry used in the RealTimeLedger component */
export interface StreamLedgerEntry {
  id?: string
  sequence: number
  successful_transaction_count: number
  failed_transaction_count: number
  operation_count: number
  closed_at: string
}

/** Chart data point for ledger close intervals */
export interface LedgerChartPoint {
  sequence: number
  interval: number
  operations: number
  txCount: number
  formattedSequence: string
}

/** Congestion calculation result */
export interface CongestionInfo {
  ratio: number
  percentage: number
  level: string
  color: string
  successRate: number
}

/** Fee prediction levels */
export interface FeePrediction {
  low: { stroops: number; xlm: number; expectedInclusion: string }
  standard: { stroops: number; xlm: number; expectedInclusion: string }
  high: { stroops: number; xlm: number; expectedInclusion: string }
}

/** Performance metrics for the network */
export interface PerformanceMetrics {
  ops: string
  tps: string
  closeTime: string
}

/** Network health banner status */
export interface GlobalHealth {
  label: string
  desc: string
  color: string
  glow: string
  badge: string
}

/** Claim state for a claimable balance */
export interface ClaimState {
  loading?: boolean
  result?: { fee?: number; minFee?: string } | null
  error?: string | null
}

/** An order-book entry (bid or ask) */
export interface OrderBookEntry {
  price: string
  amount: string
}

/** Order-book chart data point */
export interface OrderBookChartPoint {
  price: number
  amount: number
  cumulative: number
  type: 'bid' | 'ask'
}

/** Spread calculation from the order book */
export interface SpreadInfo {
  absolute: number
  percent: number
  bestBid: number
  bestAsk: number
}

/** Asset reference for path explorer */
export interface AssetReference {
  type: string
  code: string
  issuer?: string
}

/** Payment path result */
export interface PaymentPath {
  source_amount: string
  destination_amount: string
  source_asset_type?: string
  source_asset_code?: string
  destination_asset_type: string
  destination_asset_code: string
  path?: { asset_type: string; asset_code?: string; asset_issuer?: string }[]
  slippagePct?: string
}

/** Liquidity pool reference */
export interface LiquidityPool {
  id: string
  assetA: string
  assetB: string
  assetCodeA: string
  assetCodeB: string
  feeBps: number
  reserveA: string
  reserveB: string
  totalShares: string
  priceBperA: string
  priceAperB: string
}

/** User's LP position */
export interface LiquidityPosition {
  poolId: string
  shares?: string
  balance?: string
  sharePercent: string
}

/** Validator status from network monitoring */
export interface ValidatorInfo {
  id: string
  name: string
  operator: string
  status: 'ONLINE' | 'OFFLINE'
  region: string
  country: string
  protocolVersion: string
  ping: number
  consensus: number
  votingPower: number
}

/** A single row helper for key-value data display */
export interface InfoRowProps {
  label: string
  value?: React.ReactNode
  mono?: boolean
  accent?: string
  copyValue?: string
  secondaryValue?: React.ReactNode
}

/** An offer from the Stellar account */
export interface AccountOffer {
  id: string
  amount: string
  price: string
  price_r: { n: number; d: number }
  selling: { asset_type: string; asset_code?: string; asset_issuer?: string }
  buying: { asset_type: string; asset_code?: string; asset_issuer?: string }
}

/** Reserve calculation result */
export interface ReservesInfo {
  baseReserve: number
  signerReserve: number
  assetReserve: number
  offerReserve: number
  subentryReserve: number
  totalReserves: number
  availableBalance: number
}

/** Claimable balance record */
export interface ClaimableBalanceRecord {
  id: string
  asset: string
  amount: string
  sponsor: string
  last_modified_ledger: number
  claimants: Claimant[]
}

/** A claimant on a claimable balance */
export interface Claimant {
  destination: string
  predicate: unknown
}

/** A notification/alert entry */
export interface AlertEntry {
  id: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
}

/** Health probe result for a service */
export interface HealthProbe {
  status: string
  latency: number | null
  error: string | null
  breakerState: string
}

/** Network health data from monitoring */
export interface NetworkHealthProbe {
  network: string
  name: string
  horizon: HealthProbe
  soroban: HealthProbe
}

/** System monitoring snapshot */
export interface MonitoringSnapshot {
  online: boolean
  visibility: string
  memory: { usedJSHeapSize: number; totalJSHeapSize: number } | null
  navigation: { loadEventMs: number } | null
  networkHealth: NetworkHealthProbe[]
  latencyHistory: { timestamp: number; latency: number }[]
  timestamp: string
}

/** Tab definition for tab switchers */
export interface TabDefinition {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number }>
}
