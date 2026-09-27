/**
 * Integration tests for the portfolio analytics flow:
 * account balances → USD price estimates → allocation/performance charts → CSV export.
 *
 * The whole chain is exercised through the routed UI (<PortfolioValue />) plus the
 * real price feed (CoinGecko via MSW), the real analytics library and the real
 * export utilities. Only two things are simulated: the browser download plumbing
 * and Recharts' ResizeObserver, which jsdom does not implement.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import PortfolioValue from '../../src/components/dashboard/PortfolioValue';
import { useStore } from '../../src/lib/store';
import {
  calculatePortfolioValue,
  clearPriceCache,
  fetchPrices,
  refreshPrices,
} from '../../src/lib/priceFeed';
import {
  calculateAssetAllocation,
  calculateAssetPnL,
  calculateCorrelation,
  calculateRebalancingActions,
  calculateSharpeRatio,
  calculateTotalPnL,
  fetchHistoricalPerformance,
  generatePortfolioSummary,
} from '../../src/lib/portfolioAnalytics';
import { exportChartDataAsCsv } from '../../src/lib/chartUtils';
import { exportCsv, exportHistoricalBalances } from '../../src/utils/export';

// ─── Stellar/Horizon is stubbed so history reconstruction is deterministic ──────
const { getServerMock } = vi.hoisted(() => ({ getServerMock: vi.fn() }));

vi.mock('../../src/lib/stellar', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, getServer: (...args: unknown[]) => getServerMock(...args) };
});

// ─── Recharts needs a ResizeObserver; jsdom has none ───────────────────────────
type ResizeHandler = ConstructorParameters<typeof ResizeObserver>[0];

class MockResizeObserver {
  private readonly callback: ResizeHandler;

  constructor(callback: ResizeHandler) {
    this.callback = callback;
  }

  observe() {
    this.callback([{ contentRect: { width: 800, height: 400 } }] as unknown as ResizeObserverEntry[], null as never);
  }

  unobserve() {}

  disconnect() {}
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const PRICES_URL = 'https://api.coingecko.com/api/v3/simple/price';
const DAY_MS = 24 * 60 * 60 * 1000;

const ISSUER_A = 'GA5ZSEJYB37JRC5AVCIA5MJP4B5E5A2ELYQDESQAG6SU3GOQ23T2';
const ISSUER_B = 'GBCFXSDQVXZXKAMQZ5YKJIHFB2EWTJ3GUQZGSMKFHXSPVXKMPQ5JRPX';

const MULTI_ASSET_BALANCES = [
  { asset_type: 'native', balance: '1000' },
  { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: ISSUER_A, balance: '250.5' },
  { asset_type: 'credit_alphanum4', asset_code: 'SCAT', asset_issuer: ISSUER_B, balance: '10' },
];

/** XLM 1000 × $0.50 = $500, USDC 250.5 × $1 = $250.50, SCAT has no price feed. */
const MULTI_ASSET_PRICES = {
  stellar: { usd: 0.5, usd_24h_change: 2.5 },
  'usd-coin': { usd: 1, usd_24h_change: 0 },
};

let priceRequests = 0;

function mockPrices(payload: Record<string, { usd: number | null; usd_24h_change?: number | null }>) {
  server.use(
    http.get(PRICES_URL, () => {
      priceRequests += 1;
      return HttpResponse.json(payload);
    }),
  );
}

function mockPriceFailure(status = 429) {
  server.use(
    http.get(PRICES_URL, () => {
      priceRequests += 1;
      return new HttpResponse('rate limited', { status });
    }),
  );
}

interface EffectRecord {
  id: string;
  type: string;
  created_at: string;
  asset_type?: string;
  asset_code?: string;
  amount: string;
}

function createEffectsServer(records: EffectRecord[], options: { fail?: boolean } = {}) {
  const call = vi.fn(async () => {
    if (options.fail) throw new Error('Horizon 503 Service Unavailable');
    return { records, next: async () => ({ records: [] }) };
  });
  const builder: Record<string, unknown> = {};
  builder.forAccount = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.call = call;
  return { server: { effects: () => builder }, call };
}

/** Running balances walked backwards from the current holdings using debit effects only. */
const HISTORY_BASE = Date.now();
const HISTORY_ISO = (daysAgo: number) => new Date(HISTORY_BASE - daysAgo * DAY_MS).toISOString();

const HISTORY_EFFECTS: EffectRecord[] = [
  {
    id: 'e3',
    type: 'account_debited',
    created_at: HISTORY_ISO(6),
    asset_type: 'credit_alphanum4',
    asset_code: 'USDC',
    amount: '40',
  },
  {
    id: 'e2',
    type: 'account_debited',
    created_at: HISTORY_ISO(4),
    asset_type: 'native',
    amount: '100',
  },
  {
    id: 'e1',
    type: 'account_debited',
    created_at: HISTORY_ISO(2),
    asset_type: 'native',
    amount: '250',
  },
];

/** The map PortfolioValue hands to the history engine, derived from the priced items. */
const HISTORY_CURRENT_BALANCES = { XLM: 1000, USDC: 250.5, SCAT: 10 };

// ─── Download capture ─────────────────────────────────────────────────────────
let capturedBlob: Blob | null = null;
let capturedFilename = '';

async function captureCsv(call: () => void) {
  capturedBlob = null;
  capturedFilename = '';
  call();
  expect(capturedBlob).toBeInstanceOf(Blob);
  return (capturedBlob as Blob).text();
}

function statCardText(label: string) {
  return screen.getByText(label).parentElement?.textContent ?? '';
}

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    capturedBlob = blob;
    return 'blob:portfolio-analytics-test';
  }) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function captureDownload(
    this: HTMLAnchorElement,
  ) {
    capturedFilename = this.download;
  });
});

beforeEach(async () => {
  priceRequests = 0;
  getServerMock.mockReset();
  getServerMock.mockReturnValue(createEffectsServer([]).server);
  useStore.setState(
    {
      accountData: null,
      connectedAddress: null,
      network: 'testnet',
      prices: {},
      pricesLoading: false,
      pricesError: null,
    } as never,
    false,
  );
  await clearPriceCache();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('portfolio analytics flow (integration)', () => {
  describe('account assets → USD estimates', () => {
    it('prices every mapped balance, totals the portfolio and surfaces the 24h move', async () => {
      mockPrices(MULTI_ASSET_PRICES);
      useStore.setState({ accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES } } as never, false);

      render(<PortfolioValue />);

      await waitFor(() => expect(statCardText('Total Value')).toContain('$750.50'));

      expect(priceRequests).toBe(1);
      expect(statCardText('Total Value')).toContain('$750.50');
      // (750.5 - (500 / 1.025 + 250.5)) / (500 / 1.025 + 250.5)
      expect(statCardText('24h Change')).toContain('+1.65%');
      expect(statCardText('24h Change')).toContain('Gain');
      expect(statCardText('Diversification')).toContain('67/100');
      expect(statCardText('Risk Level')).toContain('Score: 45/100');
    });

    it('reports the per-asset price, USD value and change for each holding', async () => {
      mockPrices(MULTI_ASSET_PRICES);
      useStore.setState({ accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES } } as never, false);

      render(<PortfolioValue />);
      await waitFor(() => expect(screen.getByText('$750.50')).toBeInTheDocument());

      const rows = screen.getByText('Asset Holdings').parentElement as HTMLElement;
      const xlmRow = within(rows).getByText('XLM').parentElement as HTMLElement;
      const usdcRow = within(rows).getByText('USDC').parentElement as HTMLElement;
      const scatRow = within(rows).getByText('SCAT').parentElement as HTMLElement;

      expect(xlmRow).toHaveTextContent('1,000');
      expect(xlmRow).toHaveTextContent('$0.5000');
      expect(xlmRow).toHaveTextContent('$500.00');
      expect(xlmRow).toHaveTextContent('2.50%');

      expect(usdcRow).toHaveTextContent('250.5');
      expect(usdcRow).toHaveTextContent('$1.0000');
      expect(usdcRow).toHaveTextContent('$250.50');
      expect(usdcRow).toHaveTextContent('0.00%');

      // Unpriced trustline degrades to em dashes instead of $0
      expect(scatRow).toHaveTextContent('10');
      expect(scatRow).toHaveTextContent('—');
      expect(scatRow).not.toHaveTextContent('$0.00');
    });

    it('treats the native balance as XLM without an issuer and sums the estimate', () => {
      const portfolio = calculatePortfolioValue(MULTI_ASSET_BALANCES, {
        XLM: { usd: 0.5, usd_24h_change: 2.5 },
        USDC: { usd: 1, usd_24h_change: 0 },
      });

      expect(portfolio).not.toBeNull();
      expect(portfolio?.totalUsd).toBeCloseTo(750.5, 10);
      expect(portfolio?.items).toHaveLength(3);

      const [xlm, usdc, scat] = portfolio!.items;
      expect(xlm).toMatchObject({ code: 'XLM', issuer: null, amount: 1000, priceUsd: 0.5, valueUsd: 500, change24h: 2.5 });
      expect(usdc).toMatchObject({ code: 'USDC', issuer: ISSUER_A, amount: 250.5, priceUsd: 1, valueUsd: 250.5 });
      expect(scat).toMatchObject({ code: 'SCAT', priceUsd: null, valueUsd: null, change24h: null });
    });

    it('refreshes prices on demand and recomputes the total from the new feed', async () => {
      mockPrices(MULTI_ASSET_PRICES);
      useStore.setState({ accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES } } as never, false);

      render(<PortfolioValue />);
      await waitFor(() => expect(statCardText('Total Value')).toContain('$750.50'));

      mockPrices({
        stellar: { usd: 0.8, usd_24h_change: -4 },
        'usd-coin': { usd: 1, usd_24h_change: 0 },
      });

      const refresh = screen.getByRole('button', { name: 'Refresh prices' });
      fireEvent.click(refresh);

      await waitFor(() => expect(statCardText('Total Value')).toContain('$1,050.50'));
      expect(priceRequests).toBe(2);
    });

    it('caches the price feed between renders and bypasses the cache on a forced refresh', async () => {
      mockPrices(MULTI_ASSET_PRICES);

      const first = await fetchPrices(['XLM', 'USDC']);
      const second = await fetchPrices(['USDC', 'XLM']);
      expect(priceRequests).toBe(1);
      expect(first.XLM?.usd).toBe(0.5);
      expect(second.USDC?.usd).toBe(1);

      const forced = await refreshPrices(['XLM', 'USDC']);
      expect(priceRequests).toBe(2);
      expect(forced).toEqual(first);
    });

    it('never requests a price for asset codes the feed cannot map', async () => {
      mockPrices(MULTI_ASSET_PRICES);

      const prices = await fetchPrices(['SCAT', 'MOON']);

      expect(prices).toEqual({});
      expect(priceRequests).toBe(0);
    });
  });

  describe('allocation charts', () => {
    it('renders one pie sector and one legend row per allocated asset, sorted by weight', async () => {
      mockPrices(MULTI_ASSET_PRICES);
      useStore.setState({ accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES } } as never, false);

      const { container } = render(<PortfolioValue />);
      await waitFor(() => expect(statCardText('Total Value')).toContain('$750.50'));

      fireEvent.click(screen.getByRole('button', { name: /Allocation/ }));

      const allocationPanel = screen.getByText('Asset Allocation').parentElement as HTMLElement;
      const legendRows = Array.from(allocationPanel.querySelectorAll('div[style*="flex-direction: column"] > div'))
        .map((row) => row.textContent ?? '')
        .filter((text) => /%$/.test(text));

      expect(legendRows[0]).toContain('XLM');
      expect(legendRows[0]).toContain('66.6%');
      expect(legendRows[0]).toContain('$500.00');
      expect(legendRows[1]).toContain('USDC');
      expect(legendRows[1]).toContain('33.4%');
      expect(legendRows[1]).toContain('$250.50');
      expect(legendRows[2]).toContain('SCAT');
      expect(legendRows[2]).toContain('0.0%');

      await waitFor(() => {
        // one sector layer per allocation row, including the unpriced SCAT row at 0%
        expect(container.querySelectorAll('.recharts-pie-sector')).toHaveLength(3);
      });
      // Recharts skips the path for a zero-sized arc, so only the two priced slices are drawn
      expect(container.querySelectorAll('.recharts-pie-sector path')).toHaveLength(2);
      expect(container.querySelector('.recharts-pie')).toBeInTheDocument();
      expect(container.querySelector('svg.recharts-surface')).toBeInTheDocument();
    });

    it('flags every position above the 25% concentration threshold', async () => {
      mockPrices(MULTI_ASSET_PRICES);
      useStore.setState({ accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES } } as never, false);

      render(<PortfolioValue />);
      await waitFor(() => expect(statCardText('Total Value')).toContain('$750.50'));
      fireEvent.click(screen.getByRole('button', { name: /Allocation/ }));

      const riskPanel = screen.getByText('Concentration Risks').parentElement as HTMLElement;
      expect(within(riskPanel).getByText('XLM represents 66.6% of the portfolio')).toBeInTheDocument();
      expect(within(riskPanel).getByText('USDC represents 33.4% of the portfolio')).toBeInTheDocument();
    });

    it('draws the 30-day value line and a bar per asset with a 24h change', async () => {
      mockPrices(MULTI_ASSET_PRICES);
      getServerMock.mockReturnValue(createEffectsServer(HISTORY_EFFECTS).server);
      useStore.setState({
        accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES },
        connectedAddress: 'GACCOUNT',
      } as never, false);

      const { container } = render(<PortfolioValue />);
      await waitFor(() => expect(statCardText('Total Value')).toContain('$750.50'));
      fireEvent.click(screen.getByRole('button', { name: /Performance/ }));

      expect(screen.getByText(/Portfolio Value \(30 Days\)/)).toBeInTheDocument();
      expect(screen.getByText('24h Asset Performance')).toBeInTheDocument();

      await waitFor(() => {
        expect(container.querySelectorAll('.recharts-line-curve').length).toBeGreaterThan(0);
      });
      // SCAT has no 24h change, so it is excluded from the performance bars
      expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(2);
      expect(container.querySelector('.recharts-line')).toBeInTheDocument();
      expect(container.querySelector('.recharts-bar')).toBeInTheDocument();
    });

    it('exposes the risk view with volatility, concentration and counterparty scores', async () => {
      mockPrices(MULTI_ASSET_PRICES);
      getServerMock.mockReturnValue(createEffectsServer(HISTORY_EFFECTS).server);
      useStore.setState({
        accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES },
        connectedAddress: 'GACCOUNT',
      } as never, false);

      render(<PortfolioValue />);
      await waitFor(() => expect(statCardText('Total Value')).toContain('$750.50'));
      fireEvent.click(screen.getByRole('button', { name: /Risk/ }));

      // Reconstructed history: 965.50 → 840.50 → 790.50 → 750.50
      expect(statCardText('Volatility')).toContain('3.53%');
      expect(statCardText('Volatility')).toContain('Low');
      expect(statCardText('Concentration')).toContain('48/100');
      expect(statCardText('Counterparty')).toContain('43/100');
      expect(statCardText('Counterparty')).toContain('1 issuer');

      const exposure = screen.getByText('Counterparty Exposure').parentElement as HTMLElement;
      expect(within(exposure).getByText('USDC')).toBeInTheDocument();
      expect(within(exposure).getByText('33.4%')).toBeInTheDocument();
    });

    it('produces multi-horizon predictions from the reconstructed history', async () => {
      mockPrices(MULTI_ASSET_PRICES);
      getServerMock.mockReturnValue(createEffectsServer(HISTORY_EFFECTS).server);
      useStore.setState({
        accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES },
        connectedAddress: 'GACCOUNT',
      } as never, false);

      render(<PortfolioValue />);
      await waitFor(() => expect(statCardText('Total Value')).toContain('$750.50'));
      fireEvent.click(screen.getByRole('button', { name: /Predictions/ }));

      expect(screen.getByText('7-day Prediction')).toBeInTheDocument();
      expect(screen.getByText('Multi-horizon forecast')).toBeInTheDocument();
      expect(statCardText('7-day Prediction')).toContain('expected');
      // Not enough history for the 80% model-accuracy target
      expect(statCardText('Model Accuracy')).toContain('Needs more history');
    });
  });

  describe('CSV export', () => {
    it('exports the allocation breakdown produced by the analytics pipeline', async () => {
      mockPrices(MULTI_ASSET_PRICES);
      useStore.setState({ accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES } } as never, false);

      render(<PortfolioValue />);
      await waitFor(() => expect(statCardText('Total Value')).toContain('$750.50'));

      const items = calculatePortfolioValue(MULTI_ASSET_BALANCES, {
        XLM: { usd: 0.5, usd_24h_change: 2.5 },
        USDC: { usd: 1, usd_24h_change: 0 },
      })!.items;
      const allocation = calculateAssetAllocation(items);
      const rows = allocation.map((entry) => ({
        Asset: entry.code,
        Amount: entry.amount,
        PriceUsd: entry.priceUsd,
        ValueUsd: entry.valueUsd,
        AllocationPct: Number(entry.allocation.toFixed(2)),
        Change24h: entry.change24h,
      }));

      const csv = await captureCsv(() => exportCsv(rows, 'portfolio-allocation'));
      const lines = csv.split('\r\n');

      expect(capturedFilename).toBe('portfolio-allocation.csv');
      expect(capturedBlob?.type).toBe('text/csv');
      expect(lines[0]).toBe('Asset,Amount,PriceUsd,ValueUsd,AllocationPct,Change24h');
      expect(lines[1]).toBe('XLM,1000,0.5,500,66.62,2.5');
      expect(lines[2]).toBe('USDC,250.5,1,250.5,33.38,0');
      expect(lines[3]).toBe('SCAT,10,,,0,');
      expect(lines).toHaveLength(4);
    });

    it('quotes values that contain a CSV delimiter', async () => {
      const csv = await captureCsv(() =>
        exportCsv([{ Asset: 'A,B', Issuer: 'say "hi"' }], 'portfolio-escaped'),
      );

      expect(csv.split('\r\n')).toEqual(['Asset,Issuer', '"A,B","say ""hi"""']);
    });

    it('exports the pie chart series with a single newline per row', async () => {
      mockPrices(MULTI_ASSET_PRICES);
      useStore.setState({ accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES } } as never, false);

      render(<PortfolioValue />);
      await waitFor(() => expect(statCardText('Total Value')).toContain('$750.50'));
      fireEvent.click(screen.getByRole('button', { name: /Allocation/ }));

      const items = calculatePortfolioValue(MULTI_ASSET_BALANCES, {
        XLM: { usd: 0.5, usd_24h_change: 2.5 },
        USDC: { usd: 1, usd_24h_change: 0 },
      })!.items;
      const chartRows = calculateAssetAllocation(items).map((entry) => ({
        name: entry.code,
        value: Number(entry.allocation.toFixed(2)),
        valueUsd: entry.valueUsd === null ? null : Number(entry.valueUsd.toFixed(2)),
      }));

      const csv = await captureCsv(() => exportChartDataAsCsv(chartRows, 'portfolio-allocation-chart.csv'));

      expect(capturedFilename).toBe('portfolio-allocation-chart.csv');
      expect(csv).toBe(
        ['name,value,valueUsd', 'XLM,66.62,500', 'USDC,33.38,250.5', 'SCAT,0,'].join('\n'),
      );
    });

    it('reconstructs balances from Horizon effects and exports them as portfolio history', async () => {
      mockPrices(MULTI_ASSET_PRICES);
      const effects = createEffectsServer(HISTORY_EFFECTS);
      getServerMock.mockReturnValue(effects.server);

      const history = await fetchHistoricalPerformance(
        effects.server as never,
        'GACCOUNT',
        HISTORY_CURRENT_BALANCES,
        30,
      );

      expect(effects.call).toHaveBeenCalled();
      expect(history).toHaveLength(4);
      expect(history[0].balances).toEqual({ XLM: 1350, USDC: 290.5, SCAT: 10 });
      expect(history[1].balances).toEqual({ XLM: 1100, USDC: 290.5, SCAT: 10 });
      expect(history[2].balances).toEqual({ XLM: 1000, USDC: 290.5, SCAT: 10 });
      expect(history[3].balances).toEqual(HISTORY_CURRENT_BALANCES);

      const csv = await captureCsv(() => exportHistoricalBalances(history, 'portfolio-history'));
      const lines = csv.split('\r\n');

      expect(capturedFilename).toBe('portfolio-history.csv');
      expect(lines[0]).toBe('Timestamp,Balance,Asset');
      expect(lines[1]).toBe(`${HISTORY_ISO(2)},1350,XLM`);
      expect(lines[2]).toBe(`${HISTORY_ISO(2)},290.5,USDC`);
      expect(lines[3]).toBe(`${HISTORY_ISO(2)},10,SCAT`);
      expect(lines[4]).toBe(`${HISTORY_ISO(4)},1100,XLM`);
      expect(lines[7]).toBe(`${HISTORY_ISO(6)},1000,XLM`);
      // The newest snapshot is stamped at call time, so only its balances are pinned.
      expect(lines.slice(10)).toEqual([
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z,1000,XLM$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z,250\.5,USDC$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z,10,SCAT$/),
      ]);
      expect(lines).toHaveLength(13);
    });

    it('writes an empty CSV when the portfolio has no priced assets', async () => {
      useStore.setState({ accountData: { account_id: 'GACCOUNT', balances: [] } } as never, false);

      render(<PortfolioValue />);
      await waitFor(() => expect(screen.getByText('No data available')).toBeInTheDocument());

      const csv = await captureCsv(() => exportCsv([], 'portfolio-allocation'));

      expect(capturedFilename).toBe('portfolio-allocation.csv');
      expect(csv).toBe('');
    });
  });

  describe('degenerate portfolios', () => {
    it('renders an empty state for an account with no balances and never calls the price feed', async () => {
      mockPrices(MULTI_ASSET_PRICES);
      useStore.setState({ accountData: { account_id: 'GACCOUNT', balances: [] } } as never, false);

      const { container } = render(<PortfolioValue />);

      await waitFor(() => expect(screen.getByText('No data available')).toBeInTheDocument());
      expect(priceRequests).toBe(0);
      expect(screen.queryByText('Asset Holdings')).not.toBeInTheDocument();
      expect(container.querySelector('svg.recharts-surface')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Refresh prices' })).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: /Allocation/ }));
      expect(screen.queryByText('Asset Allocation')).not.toBeInTheDocument();
    });

    it('returns a zeroed portfolio for an empty balance list', () => {
      const portfolio = calculatePortfolioValue([], {});

      expect(portfolio).toEqual({ totalUsd: 0, items: [] });
      expect(calculateAssetAllocation(portfolio!.items)).toEqual([]);
    });

    it('allocates 100% to a single-asset account and marks it as concentrated', async () => {
      mockPrices({ stellar: { usd: 0.5, usd_24h_change: 2.5 } });
      useStore.setState({
        accountData: { account_id: 'GACCOUNT', balances: [{ asset_type: 'native', balance: '1000' }] },
      } as never, false);

      const { container } = render(<PortfolioValue />);
      await waitFor(() => expect(statCardText('Total Value')).toContain('$500.00'));

      expect(statCardText('Diversification')).toContain('0/100');
      expect(statCardText('Diversification')).toContain('Concentrated');
      expect(statCardText('Total Value')).toContain('$500.00');

      fireEvent.click(screen.getByRole('button', { name: /Allocation/ }));

      await waitFor(() => {
        expect(container.querySelectorAll('.recharts-pie-sector')).toHaveLength(1);
      });
      const riskPanel = screen.getByText('Concentration Risks').parentElement as HTMLElement;
      expect(within(riskPanel).getByText('XLM represents 100.0% of the portfolio')).toBeInTheDocument();
    });

    it('prices a single unpriced asset as a full-value concentration with no history', () => {
      const items = calculatePortfolioValue(
        [{ asset_type: 'credit_alphanum4', asset_code: 'SCAT', asset_issuer: ISSUER_B, balance: '10' }],
        {},
      )!.items;
      const summary = generatePortfolioSummary(items);

      expect(summary.totalValue).toBe(0);
      expect(summary.assetCount).toBe(1);
      expect(summary.allocation[0].allocation).toBe(0);
      expect(summary.diversificationScore).toBe(0);
      expect(summary.counterpartyRisk.unpricedAssets).toBe(1);
      expect(summary.counterpartyRisk.issuerCount).toBe(0);
    });
  });

  describe('price feed failures', () => {
    it('keeps the dashboard usable when every price request fails', async () => {
      mockPriceFailure(500);
      useStore.setState({ accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES } } as never, false);

      const { container } = render(<PortfolioValue />);

      await waitFor(() => expect(statCardText('Total Value')).toContain('$0.00'));

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[priceFeed] Failed to fetch asset prices'),
        expect.anything(),
      );
      expect(statCardText('Total Value')).toContain('$0.00');
      expect(screen.getByRole('button', { name: 'Refresh prices' })).toBeEnabled();
      expect(container.querySelector('svg.recharts-surface')).not.toBeInTheDocument();

      const holdings = screen.getByText('Asset Holdings').parentElement as HTMLElement;
      // price, value and 24h columns for each of the three holdings
      expect(within(holdings).getAllByText('—')).toHaveLength(9);
    });

    it('prices the assets that succeeded when only part of the feed resolves', async () => {
      mockPrices({ stellar: { usd: 0.5, usd_24h_change: 2.5 } });
      useStore.setState({ accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES } } as never, false);

      render(<PortfolioValue />);

      await waitFor(() => expect(statCardText('Total Value')).toContain('$500.00'));

      const holdings = screen.getByText('Asset Holdings').parentElement as HTMLElement;
      const usdcRow = within(holdings).getByText('USDC').parentElement as HTMLElement;
      expect(usdcRow).toHaveTextContent('—');
      expect(statCardText('Diversification')).toContain('0/100');
    });

    it('survives a Horizon failure while reconstructing history', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockPrices(MULTI_ASSET_PRICES);
      getServerMock.mockReturnValue(createEffectsServer([], { fail: true }).server);
      useStore.setState({
        accountData: { account_id: 'GACCOUNT', balances: MULTI_ASSET_BALANCES },
        connectedAddress: 'GACCOUNT',
      } as never, false);

      render(<PortfolioValue />);

      await waitFor(() => expect(statCardText('Total Value')).toContain('$750.50'));
      await waitFor(() =>
        expect(console.warn).toHaveBeenCalledWith(
          'Horizon history engine encountered an error or truncation:',
          expect.any(Error),
        ),
      );

      fireEvent.click(screen.getByRole('button', { name: /Risk/ }));
      expect(screen.getByText('Risk Assessment')).toBeInTheDocument();
      // Only the current snapshot survives, so the portfolio has no measurable volatility
      expect(statCardText('Volatility')).toContain('0.00%');
    });

    it('returns an empty price map instead of throwing', async () => {
      mockPriceFailure(503);

      await expect(fetchPrices(['XLM', 'USDC'])).resolves.toEqual({});
    });
  });

  describe('portfolio calculation logic', () => {
    const pricedItems = [
      { code: 'XLM', issuer: null, amount: 1000, priceUsd: 0.5, valueUsd: 500, change24h: 2.5 },
      { code: 'USDC', issuer: ISSUER_A, amount: 250.5, priceUsd: 1, valueUsd: 250.5, change24h: 0 },
    ];

    it('summarises allocation, diversification, concentration and 24h performance', () => {
      const summary = generatePortfolioSummary(pricedItems, [
        { timestamp: 1, value: 715 },
        { timestamp: 2, value: 675 },
        { timestamp: 3, value: 625 },
        { timestamp: 4, value: 500 },
      ]);

      expect(summary.totalValue).toBeCloseTo(750.5, 10);
      expect(summary.assetCount).toBe(2);
      expect(summary.change24h).toBeCloseTo(summary.performance24h.changePercent, 10);
      expect(summary.allocation.map((entry) => entry.code)).toEqual(['XLM', 'USDC']);
      // Two-asset HHI floor is 5000, so a 2/3 - 1/3 split scores well above zero
      expect(summary.diversificationScore).toBeCloseTo(88.95, 2);
      expect(summary.concentrationRisks.map((risk) => risk.code)).toEqual(['XLM', 'USDC']);
      expect(summary.concentrationRisks[0].riskLevel).toBe('high');
      expect(summary.concentrationRisks[1].riskLevel).toBe('medium');
      expect(summary.concentrationRiskScore).toBe(42);
      expect(summary.topAssets).toHaveLength(2);
      expect(summary.volatility).toBeCloseTo(6.41, 2);
      expect(summary.riskAssessment.components.valuation).toBe(0);
      expect(summary.lastUpdated).toEqual(expect.any(String));
    });

    it('computes unrealised P&L against a cost basis', () => {
      const withPnl = calculateAssetPnL(pricedItems, { XLM: 0.4, USDC: 1.2 });

      expect(withPnl[0]).toMatchObject({ avgCost: 0.4, unrealizedPnLPercent: 25, isProfitable: true });
      expect(withPnl[0].totalCost).toBeCloseTo(400, 10);
      expect(withPnl[0].unrealizedPnL).toBeCloseTo(100, 10);

      expect(withPnl[1]).toMatchObject({ avgCost: 1.2, isProfitable: false });
      expect(withPnl[1].totalCost).toBeCloseTo(300.6, 10);
      expect(withPnl[1].unrealizedPnL).toBeCloseTo(-50.1, 10);
    });

    it('totals portfolio P&L and flags a profitable book', () => {
      const withPnl = calculateAssetPnL(pricedItems, { XLM: 0.4, USDC: 1.2 });
      const totalPnl = calculateTotalPnL(withPnl);

      expect(totalPnl.totalCost).toBeCloseTo(700.6, 10);
      expect(totalPnl.totalValue).toBeCloseTo(750.5, 10);
      expect(totalPnl.totalPnL).toBeCloseTo(49.9, 10);
      expect(totalPnl.isProfitable).toBe(true);
    });

    it('correlates two asset series and rejects mismatched inputs', () => {
      expect(calculateCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
      expect(calculateCorrelation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 10);
      expect(calculateCorrelation([1, 2, 3], [3, 2])).toBe(0);
      expect(calculateCorrelation([1, 1, 1], [1, 1, 1])).toBe(0);
    });

    it('turns a return/volatility pair into a Sharpe ratio', () => {
      expect(calculateSharpeRatio(10, 3)).toBeCloseTo(2, 10);
      expect(calculateSharpeRatio(10, 0)).toBe(0);
    });

    it('suggests rebalancing trades only for deviations above 5%', () => {
      const allocation = calculateAssetAllocation(pricedItems);
      const actions = calculateRebalancingActions(allocation, { XLM: 50, USDC: 50 }, 750.5);

      expect(actions).toHaveLength(2);
      expect(actions[0]).toMatchObject({ asset: 'XLM', action: 'sell', priority: 'high' });
      expect(actions[1]).toMatchObject({ asset: 'USDC', action: 'buy' });
      expect(actions[0].amountUsd).toBeCloseTo(Math.abs(375.25 - 500), 6);
    });
  });
});
