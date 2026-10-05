// Analytics domain types for DeFi analytics and data export workflows.

export type TradeSide = 'buy' | 'sell';

export interface ExecutedTrade {
  id: string;
  /** Trading pair or market symbol, e.g. "ETH/USDC". */
  symbol: string;
  side: TradeSide;
  /** Base-asset quantity that was executed. */
  quantity: number;
  /** Execution price per unit of the base asset. */
  price: number;
  /** Total fees paid for the execution, in quote-asset terms. */
  fee?: number;
  /** ISO-8601 timestamp of execution. */
  executedAt: string;
}

/**
 * Cost basis helper fields derived from a trade's execution history.
 * These are computed values used to attribute realized PnL to a trade.
 */
export interface CostBasisFields {
  /** Average cost per unit of the base asset at the time of execution. */
  averageCost: number;
  /** Total cost basis consumed by this trade, in quote-asset terms. */
  totalCostBasis: number;
  /** Remaining base-asset quantity after this trade is applied. */
  remainingQuantity: number;
}

/**
 * Realized PnL columns for accounting workflows. Populated for closing
 * (sell) trades; zero for opening (buy) trades.
 */
export interface RealizedPnlFields {
  /** Proceeds from the trade before fees, in quote-asset terms. */
  proceeds: number;
  /** Realized profit or loss, net of fees, in quote-asset terms. */
  realizedPnl: number;
  /** Realized PnL as a ratio of the consumed cost basis. */
  realizedPnlRatio: number;
}

/** A single row of the exported trade journal. */
export interface TradeJournalRow
  extends ExecutedTrade,
    CostBasisFields,
    RealizedPnlFields {}

/**
 * Result of a trade journal export. `rows` is empty when the export
 * succeeds but no trades match the requested range.
 */
export interface TradeJournalExport {
  rows: TradeJournalRow[];
  /** ISO-8601 timestamp the export was generated. */
  generatedAt: string;
  /** Total realized PnL across all exported rows, in quote-asset terms. */
  totalRealizedPnl: number;
}

/**
 * Options controlling a trade journal export. All fields are optional so
 * callers can export the full journal by default.
 */
export interface TradeJournalExportOptions {
  /** Inclusive ISO-8601 lower bound on execution time. */
  from?: string;
  /** Exclusive ISO-8601 upper bound on execution time. */
  to?: string;
  /** Restrict the export to a single symbol. */
  symbol?: string;
}

/**
 * Reasons a trade journal export can fail. Callers should surface these
 * to the user rather than throwing raw errors.
 */
export type TradeJournalExportErrorCode =
  | 'INVALID_OPTIONS'
  | 'UNSUPPORTED_ENVIRONMENT'
  | 'EXPORT_FAILED';

export interface TradeJournalExportError {
  code: TradeJournalExportErrorCode;
  message: string;
}

/** Discriminated result returned by the trade journal exporter. */
export type TradeJournalExportResult =
  | { ok: true; data: TradeJournalExport }
  | { ok: false; error: TradeJournalExportError };
