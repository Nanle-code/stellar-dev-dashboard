/**
 * Export service for the 2026 DEX analytics surface.
 *
 * Provides trade journal export of executed trades enriched with cost basis
 * helper fields and realized PnL columns for accounting workflows.
 *
 * Compatibility: pure TypeScript, no runtime dependencies. Works in Node and
 * browser environments. CSV output is RFC 4180 compatible (CRLF line endings,
 * quoted fields) so it can be consumed by spreadsheets and accounting tools.
 *
 * Security: exported rows contain only trade data supplied by the caller. No
 * secrets, credentials, or wallet private material are read or emitted here.
 */

export interface ExecutedTrade {
  /** Unique trade identifier. */
  id: string;
  /** Trading pair symbol, e.g. "ETH/USDC". */
  symbol: string;
  /** ISO-8601 timestamp of execution. */
  executedAt: string;
  /** Base asset quantity (positive number). */
  quantity: number;
  /** Execution price per unit of base asset. */
  price: number;
  /** Fee paid for the trade, in quote currency. Optional. */
  fee?: number;
  /** Cost basis per unit at acquisition, in quote currency. Optional. */
  costBasis?: number;
  /** Side of the trade. */
  side?: "buy" | "sell";
}

/** A trade row enriched with cost basis helpers and realized PnL columns. */
export interface TradeJournalRow {
  id: string;
  symbol: string;
  executedAt: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fee: number;
  /** Total notional value of the trade (quantity * price). */
  notional: number;
  /** Cost basis per unit used for this trade. */
  costBasisPerUnit: number;
  /** Total cost basis for the traded quantity. */
  totalCostBasis: number;
  /** Realized PnL before fees (proceeds - cost basis). */
  realizedPnl: number;
  /** Realized PnL after subtracting fees. */
  realizedPnlNet: number;
}

export interface TradeJournalExportOptions {
  /** Output format. Defaults to "csv". */
  format?: "csv" | "json";
  /** When true, only sell trades are exported (realized events). Defaults to false. */
  realizedOnly?: boolean;
}

export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportError";
  }
}

const CSV_COLUMNS: Array<keyof TradeJournalRow> = [
  "id",
  "symbol",
  "executedAt",
  "side",
  "quantity",
  "price",
  "fee",
  "notional",
  "costBasisPerUnit",
  "totalCostBasis",
  "realizedPnl",
  "realizedPnlNet",
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number, decimals = 8): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Validate a single executed trade. Throws ExportError on invalid input so
 * callers get an explicit failure path instead of silently corrupt output.
 */
function validateTrade(trade: ExecutedTrade, index: number): void {
  if (!trade || typeof trade !== "object") {
    throw new ExportError(`Invalid trade at index ${index}: expected an object.`);
  }
  if (typeof trade.id !== "string" || trade.id.trim() === "") {
    throw new ExportError(`Invalid trade at index ${index}: "id" is required.`);
  }
  if (typeof trade.symbol !== "string" || trade.symbol.trim() === "") {
    throw new ExportError(`Invalid trade at index ${index}: "symbol" is required.`);
  }
  if (typeof trade.executedAt !== "string" || Number.isNaN(Date.parse(trade.executedAt))) {
    throw new ExportError(
      `Invalid trade at index ${index}: "executedAt" must be a valid ISO-8601 date.`,
    );
  }
  if (!isFiniteNumber(trade.quantity) || trade.quantity <= 0) {
    throw new ExportError(`Invalid trade at index ${index}: "quantity" must be a positive number.`);
  }
  if (!isFiniteNumber(trade.price) || trade.price < 0) {
    throw new ExportError(`Invalid trade at index ${index}: "price" must be a non-negative number.`);
  }
  if (trade.fee !== undefined && (!isFiniteNumber(trade.fee) || trade.fee < 0)) {
    throw new ExportError(`Invalid trade at index ${index}: "fee" must be a non-negative number.`);
  }
  if (trade.costBasis !== undefined && (!isFiniteNumber(trade.costBasis) || trade.costBasis < 0)) {
    throw new ExportError(
      `Invalid trade at index ${index}: "costBasis" must be a non-negative number.`,
    );
  }
  if (trade.side !== undefined && trade.side !== "buy" && trade.side !== "sell") {
    throw new ExportError(`Invalid trade at index ${index}: "side" must be "buy" or "sell".`);
  }
}

/**
 * Enrich a single executed trade with cost basis helpers and realized PnL.
 *
 * Realized PnL is only meaningful for sells; buys report zero realized PnL
 * while still exposing cost basis helper columns for downstream accounting.
 */
export function buildTradeJournalRow(trade: ExecutedTrade): TradeJournalRow {
  const side: "buy" | "sell" = trade.side ?? "buy";
  const fee = trade.fee ?? 0;
  const notional = round(trade.quantity * trade.price);
  const costBasisPerUnit = round(trade.costBasis ?? trade.price);
  const totalCostBasis = round(costBasisPerUnit * trade.quantity);

  const realizedPnl = side === "sell" ? round(notional - totalCostBasis) : 0;
  const realizedPnlNet = side === "sell" ? round(realizedPnl - fee) : round(-fee);

  return {
    id: trade.id,
    symbol: trade.symbol,
    executedAt: trade.executedAt,
    side,
    quantity: trade.quantity,
    price: trade.price,
    fee,
    notional,
    costBasisPerUnit,
    totalCostBasis,
    realizedPnl,
    realizedPnlNet,
  };
}

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: TradeJournalRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const lines = rows.map((row) =>
    CSV_COLUMNS.map((column) => escapeCsvField(row[column])).join(","),
  );
  return [header, ...lines].join("\r\n");
}

/**
 * Export a trade journal of executed trades with cost basis helpers and
 * realized PnL columns.
 *
 * @throws ExportError when input is invalid or the requested format is
 * unsupported in the current environment.
 */
export function exportTradeJournal(
  trades: ExecutedTrade[],
  options: TradeJournalExportOptions = {},
): string {
  if (!Array.isArray(trades)) {
    throw new ExportError("Invalid input: trades must be an array.");
  }

  const format = options.format ?? "csv";
  if (format !== "csv" && format !== "json") {
    throw new ExportError(`Unsupported export format: "${String(format)}".`);
  }

  trades.forEach((trade, index) => validateTrade(trade, index));

  const rows = trades
    .map(buildTradeJournalRow)
    .filter((row) => (options.realizedOnly ? row.side === "sell" : true));

  if (format === "json") {
    return JSON.stringify(rows, null, 2);
  }

  return toCsv(rows);
}
