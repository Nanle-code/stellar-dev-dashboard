import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import PoolPerformanceTrends from '../PoolPerformanceTrends';
import type { PoolTradeInput } from '../../../lib/poolMetrics';

// jsdom has no layout, so recharts' ResponsiveContainer renders nothing.
// Stub the chart primitives with lightweight markup for assertions.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ data }: { data: { label: string; volume: number }[] }) => (
    <div data-testid="bar-chart">{data.map((d) => <span key={d.label}>{d.label}</span>)}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

afterEach(cleanup);

const POOL = {
  id: 'pool-1',
  assetCodeA: 'XLM',
  assetCodeB: 'USDC',
  feeBps: 30,
  reserveA: '100000',
  reserveB: '100000',
};

function trade(id: string, minutesAgo: number, baseAmount: number): PoolTradeInput {
  return {
    id,
    base_amount: String(baseAmount),
    counter_amount: String(baseAmount * 2),
    ledger_close_time: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
}

describe('PoolPerformanceTrends', () => {
  it('renders nothing without a selected pool', () => {
    const { container } = render(<PoolPerformanceTrends pool={null} trades={[]} loading={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows fee APR and daily volume for an active pool (primary flow)', () => {
    const trades = Array.from({ length: 8 }, (_, i) => trade(`t${i}`, i * 20 + 5, 100));
    render(<PoolPerformanceTrends pool={POOL} trades={trades} loading={false} />);

    expect(screen.getByText(/Fee APR & Volume Trends/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/estimated fee apr \d+(\.\d+)? percent/i)).toBeInTheDocument();
    expect(screen.getByText(/Est. Daily Volume/)).toBeInTheDocument();
    expect(screen.getByTestId('volume-trend-chart')).toBeInTheDocument();
  });

  it('flags extrapolated APR for short trade windows (boundary)', () => {
    const trades = Array.from({ length: 8 }, (_, i) => trade(`t${i}`, i + 1, 100));
    render(<PoolPerformanceTrends pool={POOL} trades={trades} loading={false} />);

    expect(screen.getByText(/extrapolated from <24h/i)).toBeInTheDocument();
    expect(screen.getByText(/of trades observed; volume was scaled/i)).toBeInTheDocument();
  });

  it('explains why the APR is unavailable for a pool without trades', () => {
    render(<PoolPerformanceTrends pool={POOL} trades={[]} loading={false} />);

    // APR / fees / volume stats all render an em-dash placeholder.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('status')).toHaveTextContent(/no recent trades available/i);
    expect(screen.queryByTestId('volume-trend-chart')).not.toBeInTheDocument();
  });

  it('renders an alert for invalid pool data (failure path)', () => {
    const brokenPool = { ...POOL, feeBps: -10 };
    render(<PoolPerformanceTrends pool={brokenPool} trades={[trade('a', 10, 100)]} loading={false} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/fee tier is missing or invalid/i);
  });

  it('reports skipped trade records without crashing (failure path)', () => {
    const trades: PoolTradeInput[] = [
      null as unknown as PoolTradeInput,
      { id: 'bad', base_amount: 'not-a-number', counter_amount: '5' },
      trade('good', 30, 250),
    ];
    render(<PoolPerformanceTrends pool={POOL} trades={trades} loading={false} />);

    expect(screen.getByText(/2 trade records could not be parsed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/estimated fee apr/i)).toBeInTheDocument();
  });
});
