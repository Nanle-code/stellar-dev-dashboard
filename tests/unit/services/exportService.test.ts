import { describe, it, expect } from 'vitest';
import {
  exportTradeJournal,
  buildTradeJournalRow,
  ExportError,
  type ExecutedTrade,
} from '../../../src/services/exportService';

// ── Fixtures ────────────────────────────────────────────────────────────────

const buyTrade: ExecutedTrade = {
  id: 'trade-001',
  symbol: 'XLM/USDC',
  executedAt: '2026-01-15T10:00:00.000Z',
  side: 'buy',
  quantity: 100,
  price: 0.12,
  fee: 0.05,
  costBasis: 0.12,
};

const sellTrade: ExecutedTrade = {
  id: 'trade-002',
  symbol: 'XLM/USDC',
  executedAt: '2026-02-20T14:30:00.000Z',
  side: 'sell',
  quantity: 100,
  price: 0.18,
  fee: 0.05,
  costBasis: 0.12,
};

// ── buildTradeJournalRow ─────────────────────────────────────────────────────

describe('buildTradeJournalRow', () => {
  it('primary flow: enriches a sell trade with correct PnL columns', () => {
    const row = buildTradeJournalRow(sellTrade);

    expect(row.id).toBe('trade-002');
    expect(row.symbol).toBe('XLM/USDC');
    expect(row.side).toBe('sell');
    expect(row.quantity).toBe(100);
    expect(row.price).toBe(0.18);
    expect(row.fee).toBe(0.05);
    // notional = 100 * 0.18 = 18
    expect(row.notional).toBe(18);
    // costBasisPerUnit = 0.12, totalCostBasis = 0.12 * 100 = 12
    expect(row.costBasisPerUnit).toBe(0.12);
    expect(row.totalCostBasis).toBe(12);
    // realizedPnl = notional - totalCostBasis = 18 - 12 = 6
    expect(row.realizedPnl).toBe(6);
    // realizedPnlNet = realizedPnl - fee = 6 - 0.05 = 5.95
    expect(row.realizedPnlNet).toBe(5.95);
  });

  it('buy trade has zero realizedPnl and negative realizedPnlNet (fee only)', () => {
    const row = buildTradeJournalRow(buyTrade);

    expect(row.side).toBe('buy');
    expect(row.realizedPnl).toBe(0);
    // realizedPnlNet = -fee for buys
    expect(row.realizedPnlNet).toBe(-0.05);
  });

  it('defaults side to "buy" when not provided', () => {
    const trade: ExecutedTrade = { ...buyTrade, side: undefined as unknown as 'buy' };
    const row = buildTradeJournalRow(trade);
    expect(row.side).toBe('buy');
  });

  it('defaults fee to 0 when not provided', () => {
    const trade: ExecutedTrade = { ...sellTrade, fee: undefined };
    const row = buildTradeJournalRow(trade);
    expect(row.fee).toBe(0);
  });

  it('boundary: costBasis defaults to price when not supplied', () => {
    const trade: ExecutedTrade = { ...sellTrade, costBasis: undefined };
    const row = buildTradeJournalRow(trade);
    // costBasisPerUnit should fall back to price (0.18)
    expect(row.costBasisPerUnit).toBe(trade.price);
    // With same cost and price, realized PnL should be 0 (before fee)
    expect(row.realizedPnl).toBe(0);
  });
});

// ── exportTradeJournal ───────────────────────────────────────────────────────

describe('exportTradeJournal', () => {
  // Primary flow: CSV output
  it('primary flow: returns RFC 4180 CSV with header and data rows', () => {
    const output = exportTradeJournal([buyTrade, sellTrade]);

    const lines = output.split('\r\n');
    // First line is the header
    expect(lines[0]).toContain('id');
    expect(lines[0]).toContain('symbol');
    expect(lines[0]).toContain('realizedPnl');
    expect(lines[0]).toContain('realizedPnlNet');
    // Two data rows
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toContain('trade-001');
    expect(lines[2]).toContain('trade-002');
  });

  it('primary flow: JSON format returns parseable array of enriched rows', () => {
    const output = exportTradeJournal([buyTrade, sellTrade], { format: 'json' });
    const rows = JSON.parse(output);

    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('trade-001');
    expect(rows[1].realizedPnl).toBe(6);
  });

  it('realizedOnly option filters to sell trades only', () => {
    const output = exportTradeJournal([buyTrade, sellTrade], {
      format: 'json',
      realizedOnly: true,
    });
    const rows = JSON.parse(output);

    expect(rows).toHaveLength(1);
    expect(rows[0].side).toBe('sell');
  });

  it('boundary: empty array returns only the CSV header', () => {
    const output = exportTradeJournal([]);
    // Should have just the header line with no trailing CRLF data row
    const lines = output.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('id');
  });

  it('boundary: single trade with no optional fields exports cleanly', () => {
    const minimal: ExecutedTrade = {
      id: 'min-001',
      symbol: 'BTC/USDC',
      executedAt: '2026-03-01T00:00:00.000Z',
      quantity: 0.5,
      price: 60000,
    };
    const output = exportTradeJournal([minimal]);
    const lines = output.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('min-001');
  });

  // Failure cases
  it('failure: throws ExportError when trades is not an array', () => {
    expect(() => exportTradeJournal(null as unknown as ExecutedTrade[])).toThrow(ExportError);
    expect(() => exportTradeJournal(null as unknown as ExecutedTrade[])).toThrow(
      'trades must be an array',
    );
  });

  it('failure: throws ExportError for unsupported format', () => {
    expect(() =>
      exportTradeJournal([buyTrade], { format: 'xml' as unknown as 'csv' }),
    ).toThrow(ExportError);
    expect(() =>
      exportTradeJournal([buyTrade], { format: 'xml' as unknown as 'csv' }),
    ).toThrow('Unsupported export format');
  });

  it('failure: throws ExportError when a trade has invalid executedAt', () => {
    const bad: ExecutedTrade = { ...buyTrade, executedAt: 'not-a-date' };
    expect(() => exportTradeJournal([bad])).toThrow(ExportError);
    expect(() => exportTradeJournal([bad])).toThrow('"executedAt" must be a valid ISO-8601 date');
  });

  it('failure: throws ExportError when quantity is zero or negative', () => {
    const bad: ExecutedTrade = { ...buyTrade, quantity: 0 };
    expect(() => exportTradeJournal([bad])).toThrow(ExportError);
    expect(() => exportTradeJournal([bad])).toThrow('"quantity" must be a positive number');
  });

  it('failure: throws ExportError when price is negative', () => {
    const bad: ExecutedTrade = { ...buyTrade, price: -1 };
    expect(() => exportTradeJournal([bad])).toThrow(ExportError);
    expect(() => exportTradeJournal([bad])).toThrow('"price" must be a non-negative number');
  });

  it('failure: throws ExportError when fee is negative', () => {
    const bad: ExecutedTrade = { ...buyTrade, fee: -0.1 };
    expect(() => exportTradeJournal([bad])).toThrow(ExportError);
    expect(() => exportTradeJournal([bad])).toThrow('"fee" must be a non-negative number');
  });

  it('failure: throws ExportError when id is missing', () => {
    const bad = { ...buyTrade, id: '' };
    expect(() => exportTradeJournal([bad])).toThrow(ExportError);
    expect(() => exportTradeJournal([bad])).toThrow('"id" is required');
  });

  it('CSV escapes fields that contain commas or quotes', () => {
    const trade: ExecutedTrade = {
      ...buyTrade,
      id: 'trade,"quoted"',
      symbol: 'A,B',
    };
    const output = exportTradeJournal([trade]);
    // Both fields must be quoted in the output
    expect(output).toContain('"trade,""quoted"""');
    expect(output).toContain('"A,B"');
  });
});
