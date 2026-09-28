import { Trade, TradeStatus } from '../types/trade';
import { logger } from '../utils/logger';

/**
 * A single row in the exported trade journal.
 * Includes cost basis helper fields and realized PnL columns so the export
 * can be consumed directly by accounting workflows.
 */
export interface TradeJournalRow {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  status: TradeStatus;
  quantity: number;
  price: number;
  fee: number;
  /** Gross notional value of the trade (quantity * price). */
  grossValue: number;
  /** Total cost basis including fees. */
  costBasis: number;
  /** Proceeds net of fees for sells; gross value for buys. */
  netProceeds: number;
  /** Realized PnL for closed trades; null for open trades. */
  realizedPnl: number | null;
  /** Realized PnL as a percentage of cost basis; null when not applicable. */
  realizedPnlPercent: number | null;
  executedAt: string;
}

export interface TradeJournalExportOptions {
  /** Only include trades executed on or after this ISO date. */
  from?: string;
  /** Only include trades executed on or before this ISO date. */
  to?: string;
  /** Only include trades for this symbol. */
  symbol?: string;
}

export interface TradeJournalExportResult {
  rows: TradeJournalRow[];
  csv: string;
  totalRealizedPnl: number;
  generatedAt: string;
}

const CSV_COLUMNS: Array<keyof TradeJournalRow> = [
  'id',
  'symbol',
  'side',
  'status',
  'quantity',
  'price',
  'fee',
  'grossValue',
  'costBasis',
  'netProceeds',
  'realizedPnl',
  'realizedPnlPercent',
  'executedAt',
];

function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Compute cost basis helper fields and realized PnL for a single trade.
 * Returns null when the trade is missing required numeric fields.
 */
export function computeTradeJournalRow(trade: Trade): TradeJournalRow | null {
  if (!trade || typeof trade !== 'object') {
    return null;
  }
  const { quantity, price, fee } = trade;
  if (
    typeof quantity !== 'number' ||
    typeof price !== 'number' ||
    !Number.isFinite(quantity) ||
    !Number.isFinite(price)
  ) {
    return null;
  }

  const safeFee = typeof fee === 'number' && Number.isFinite(fee) ? fee : 0;
  const grossValue = quantity * price;
  const costBasis = grossValue + safeFee;
  const isClosed = trade.status === TradeStatus.CLOSED;
  const netProceeds = trade.side === 'sell' ? grossValue - safeFee : grossValue;

  let realizedPnl: number | null = null;
  let realizedPnlPercent: number | null = null;
  if (isClosed) {
    realizedPnl = trade.side === 'sell' ? netProceeds - costBasis : costBasis - netProceeds;
    realizedPnlPercent = costBasis !== 0 ? (realizedPnl / costBasis) * 100 : null;
  }

  return {
    id: String(trade.id),
    symbol: trade.symbol,
    side: trade.side,
    status: trade.status,
    quantity,
    price,
    fee: safeFee,
    grossValue,
    costBasis,
    netProceeds,
    realizedPnl,
    realizedPnlPercent,
    executedAt: trade.executedAt,
  };
}

/**
 * Build a CSV trade journal export of executed trades with cost basis and
 * realized PnL columns for accounting workflows.
 *
 * Throws when the environment does not support the required APIs or when
 * options are invalid.
 */
export function exportTradeJournal(
  trades: Trade[],
  options: TradeJournalExportOptions = {},
): TradeJournalExportResult {
  if (!Array.isArray(trades)) {
    throw new TypeError('exportTradeJournal: trades must be an array');
  }
  if (options.from && !isValidDate(options.from)) {
    throw new RangeError('exportTradeJournal: invalid "from" date');
  }
  if (options.to && !isValidDate(options.to)) {
    throw new RangeError('exportTradeJournal: invalid "to" date');
  }
  if (options.from && options.to && Date.parse(options.from) > Date.parse(options.to)) {
    throw new RangeError('exportTradeJournal: "from" must be before "to"');
  }

  const fromTime = options.from ? Date.parse(options.from) : null;
  const toTime = options.to ? Date.parse(options.to) : null;

  const rows: TradeJournalRow[] = [];
  for (const trade of trades) {
    if (!trade || trade.status !== TradeStatus.CLOSED) {
      continue;
    }
    if (options.symbol && trade.symbol !== options.symbol) {
      continue;
    }
    const executedTime = Date.parse(trade.executedAt);
    if (Number.isNaN(executedTime)) {
      logger.warn('exportTradeJournal: skipping trade with invalid executedAt', { id: trade.id });
      continue;
    }
    if (fromTime !== null && executedTime < fromTime) {
      continue;
    }
    if (toTime !== null && executedTime > toTime) {
      continue;
    }
    const row = computeTradeJournalRow(trade);
    if (!row) {
      logger.warn('exportTradeJournal: skipping trade with invalid numeric fields', {
        id: trade.id,
      });
      continue;
    }
    rows.push(row);
  }

  const header = CSV_COLUMNS.join(',');
  const body = rows
    .map((row) => CSV_COLUMNS.map((col) => escapeCsv(row[col])).join(','))
    .join('\n');
  const csv = body ? `${header}\n${body}` : header;

  const totalRealizedPnl = rows.reduce((sum, row) => sum + (row.realizedPnl ?? 0), 0);

  return {
    rows,
    csv,
    totalRealizedPnl,
    generatedAt: new Date().toISOString(),
  };
}
