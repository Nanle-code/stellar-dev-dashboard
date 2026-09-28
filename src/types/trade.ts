/**
 * Trade domain types for the DEX trade journal export.
 *
 * These types represent executed DEX trades with the status and fields
 * required for cost basis calculation and realized PnL accounting.
 */

/** Lifecycle status of a DEX trade. */
export enum TradeStatus {
  /** Trade is open / position has not been closed. */
  OPEN = 'OPEN',
  /** Trade has been fully executed and the position is closed. */
  CLOSED = 'CLOSED',
  /** Trade was cancelled before execution. */
  CANCELLED = 'CANCELLED',
}

/** A single executed DEX trade. */
export interface Trade {
  /** Unique trade identifier. */
  id: string;
  /** Trading pair symbol, e.g. "XLM/USDC". */
  symbol: string;
  /** Side of the trade. */
  side: 'buy' | 'sell';
  /** Lifecycle status of the trade. */
  status: TradeStatus;
  /** Base asset quantity that was executed (positive). */
  quantity: number;
  /** Execution price per unit of the base asset. */
  price: number;
  /** Fees paid for the trade, in quote-asset terms. Optional. */
  fee?: number;
  /** ISO-8601 timestamp of execution. */
  executedAt: string;
}
