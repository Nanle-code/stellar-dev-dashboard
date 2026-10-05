import { describe, it, expect } from 'vitest';
import {
  exportTradeJournal,
  computeTradeJournalRow,
} from '../../../src/services/analyticsService';
import { TradeStatus, type Trade } from '../../../src/types/trade';

// ── Fixtures ────────────────────────────────────────────────────────────────

const closedBuy: Trade = {
  id: 'a-001',
  symbol: 'XLM/USDC',
  side: 'buy',
  status: TradeStatus.CLOSED,
  quantity: 200,
  price: 0.10,
  fee: 0.02,
  executedAt: '2026-03-01T09:00:00.000Z',
};

const closedSell: Trade = {
  id: 'a-002',
  symbol: 'XLM/USDC',
  side: 'sell',
  status: TradeStatus.CLOSED,
  quantity: 200,
  price: 0.15,
  fee: 0.02,
  executedAt: '2026-04-01T12:00:00.000Z',
};

const openTrade: Trade = {
  id: 'a-003',
  symbol: 'XLM/USDC',
  side: 'buy',
  status: TradeStatus.OPEN,
  quantity: 50,
  price: 0.12,
  executedAt: '2026-04-15T08:00:00.000Z',
};

const cancelledTrade: Trade = {
  id: 'a-004',
  symbol: 'BTC/USDC',
  side: 'buy',
  status: TradeStatus.CANCELLED,
  quantity: 1,
  price: 60000,
  executedAt: '2026-04-20T10:00:00.000Z',
};

// ── computeTradeJournalRow ───────────────────────────────────────────────────

describe('computeTradeJournalRow', () => {
  it('primary flow: computes correct fields for a closed sell trade', () => {
    const row = computeTradeJournalRow(closedSell);

    expect(row).not.toBeNull();
    expect(row!.id).toBe('a-002');
    expect(row!.symbol).toBe('XLM/USDC');
    expect(row!.side).toBe('sell');
    expect(row!.status).toBe(TradeStatus.CLOSED);
    // grossValue = 200 * 0.15 = 30
    expect(row!.grossValue).toBe(30);
    // costBasis = grossValue + fee = 30 + 0.02 = 30.02
    expect(row!.costBasis).toBe(30.02);
    // netProceeds = grossValue - fee = 30 - 0.02 = 29.98
    expect(row!.netProceeds).toBe(29.98);
    // realizedPnl is populated for closed trades
    expect(row!.realizedPnl).not.toBeNull();
    expect(row!.realizedPnlPercent).not.toBeNull();
  });

  it('primary flow: computes correct fields for a closed buy trade', () => {
    const row = computeTradeJournalRow(closedBuy);

    expect(row).not.toBeNull();
    // grossValue = 200 * 0.10 = 20
    expect(row!.grossValue).toBe(20);
    // costBasis = grossValue + fee = 20 + 0.02 = 20.02
    expect(row!.costBasis).toBe(20.02);
    // For buy: netProceeds = grossValue (fee not deducted on open side)
    expect(row!.netProceeds).toBe(20);
    // realizedPnl populated for CLOSED
    expect(row!.realizedPnl).not.toBeNull();
  });

  it('fee defaults to 0 when not provided', () => {
    const trade: Trade = { ...closedBuy, fee: undefined };
    const row = computeTradeJournalRow(trade);
    expect(row!.fee).toBe(0);
    expect(row!.costBasis).toBe(row!.grossValue);
  });

  it('boundary: returns null for trade with non-finite quantity', () => {
    const bad = { ...closedBuy, quantity: NaN };
    expect(computeTradeJournalRow(bad)).toBeNull();
  });

  it('boundary: returns null for trade with non-finite price', () => {
    const bad = { ...closedBuy, price: Infinity };
    expect(computeTradeJournalRow(bad)).toBeNull();
  });

  it('boundary: returns null when called with a non-object', () => {
    expect(computeTradeJournalRow(null as unknown as Trade)).toBeNull();
  });
});

// ── exportTradeJournal ───────────────────────────────────────────────────────

describe('exportTradeJournal (analyticsService)', () => {
  // Primary flow
  it('primary flow: returns rows and CSV for closed trades', () => {
    const result = exportTradeJournal([closedBuy, closedSell, openTrade]);

    // Open trades must be excluded
    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((r) => r.status === TradeStatus.CLOSED)).toBe(true);

    // CSV has header + 2 data lines
    const lines = result.csv.split('\n').filter(Boolean);
    expect(lines).toHaveLength(3); // header + 2 rows

    // generatedAt is a valid ISO date
    expect(() => new Date(result.generatedAt)).not.toThrow();
    expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt);
  });

  it('primary flow: totalRealizedPnl sums realizedPnl across rows', () => {
    const result = exportTradeJournal([closedBuy, closedSell]);
    const manualSum = result.rows.reduce((sum, r) => sum + (r.realizedPnl ?? 0), 0);
    expect(result.totalRealizedPnl).toBeCloseTo(manualSum, 8);
  });

  it('primary flow: symbol filter restricts rows to that symbol', () => {
    const btcTrade: Trade = {
      ...closedBuy,
      id: 'btc-001',
      symbol: 'BTC/USDC',
    };
    const result = exportTradeJournal([closedBuy, closedSell, btcTrade], {
      symbol: 'BTC/USDC',
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].symbol).toBe('BTC/USDC');
  });

  it('date range filter: "from" excludes trades before the lower bound', () => {
    const result = exportTradeJournal([closedBuy, closedSell], {
      from: '2026-04-01T00:00:00.000Z',
    });
    // closedBuy is on 2026-03-01, should be excluded
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe('a-002');
  });

  it('date range filter: "to" excludes trades after the upper bound', () => {
    const result = exportTradeJournal([closedBuy, closedSell], {
      to: '2026-03-31T23:59:59.000Z',
    });
    // closedSell is on 2026-04-01, should be excluded
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe('a-001');
  });

  // Boundary cases
  it('boundary: empty trades array returns empty rows and header-only CSV', () => {
    const result = exportTradeJournal([]);
    expect(result.rows).toHaveLength(0);
    expect(result.totalRealizedPnl).toBe(0);
    // CSV should still have the header
    const lines = result.csv.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('id');
  });

  it('boundary: OPEN and CANCELLED trades are silently excluded', () => {
    const result = exportTradeJournal([openTrade, cancelledTrade]);
    expect(result.rows).toHaveLength(0);
  });

  it('boundary: from === to returns only trades at that exact timestamp', () => {
    const ts = '2026-03-01T09:00:00.000Z';
    const result = exportTradeJournal([closedBuy, closedSell], {
      from: ts,
      to: ts,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe('a-001');
  });

  // Failure cases
  it('failure: throws TypeError when trades is not an array', () => {
    expect(() => exportTradeJournal('bad' as unknown as Trade[])).toThrow(TypeError);
    expect(() => exportTradeJournal('bad' as unknown as Trade[])).toThrow(
      'trades must be an array',
    );
  });

  it('failure: throws RangeError for invalid "from" date string', () => {
    expect(() =>
      exportTradeJournal([closedBuy], { from: 'not-a-date' }),
    ).toThrow(RangeError);
    expect(() =>
      exportTradeJournal([closedBuy], { from: 'not-a-date' }),
    ).toThrow('invalid "from" date');
  });

  it('failure: throws RangeError for invalid "to" date string', () => {
    expect(() =>
      exportTradeJournal([closedBuy], { to: 'bad-date' }),
    ).toThrow(RangeError);
  });

  it('failure: throws RangeError when "from" is after "to"', () => {
    expect(() =>
      exportTradeJournal([closedBuy], {
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow(RangeError);
    expect(() =>
      exportTradeJournal([closedBuy], {
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow('"from" must be before "to"');
  });
});
