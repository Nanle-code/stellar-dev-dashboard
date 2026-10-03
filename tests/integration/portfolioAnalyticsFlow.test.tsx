/**
 * Portfolio analytics — end-to-end flow integration tests
 *
 * Drives the real feature pipeline a user exercises in the dashboard:
 *
 *   account balances -> CoinGecko price fetch -> USD estimates
 *     -> Recharts allocation/performance/risk views -> CSV export
 *
 * Only the seams are stubbed: the Zustand store (so state is controllable and
 * observable), the Horizon server (so effect history is deterministic) and
 * Recharts' ResponsiveContainer (jsdom cannot measure layout, so the real chart
 * components are handed a fixed 500x300 viewport instead).
 *
 * Every calculation, chart and export helper underneath is the production one.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor, act, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import '@testing-library/jest-dom';
import { server } from '../mocks/server';
import { clearPriceCache } from '../../src/lib/priceFeed';
import { fetchHistoricalPerformance } from '../../src/lib/portfolioAnalytics';
import { exportHistoricalBalances } from '../../src/utils/export';

// ── Store seam ────────────────────────────────────────────────────────────────
// PortfolioValue subscribes to the whole store, so the mock is a real external
// store: components read a live snapshot and the test can assert on it.

vi.mock('../../src/lib/store', async () => {
  const { useSyncExternalStore } = await import('react');

  const defaults = {
    accountData: null,
    connectedAddress: null,
    network: 'testnet',
    prices: {},
    pricesLoading: false,
    pricesError: null,
  };

  const listeners = new Set<() => void>();
  let current: Record<string, any>;

  function setState(partial: Record<string, any>) {
    // A new object identity is required: useSyncExternalStore bails out on an
    // unchanged snapshot reference.
    current = { ...current, ...partial };
    listeners.forEach((listener) => listener());
  }

  current = {
    ...defaults,
    setPrices: (prices: any) => setState({ prices, pricesError: null }),
    setPricesLoading: (pricesLoading: boolean) => setState({ pricesLoading }),
    setPricesError: (pricesError: string | null) => setState({ pricesError }),
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const getSnapshot = () => current;

  const useStore: any = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useStore.setState = setState;
  useStore.getState = getSnapshot;
  useStore.reset = () => setState({ ...defaults });

  return { useStore };
});

// ── Horizon seam ──────────────────────────────────────────────────────────────

let horizonServer: any = null;

vi.mock('../../src/lib/stellar', () => ({
  getServer: () => horizonServer,
}));

// ── Recharts seam ─────────────────────────────────────────────────────────────
// Two jsdom problems, both fixed without touching the chart components:
//   1. a 0x0 layout box makes ResponsiveContainer render nothing, so the real
//      chart children are handed an explicit viewport instead;
//   2. <Pie> animates its sectors in over 1.9s, so the entry animation is
//      switched off. Recharts resolves graphical-item props from
//      `type.defaultProps` (generateCategoricalChart.getFormatItems), so the
//      override has to land on the real class rather than on a wrapper — a
//      wrapper without Pie's defaults silently loses cx/cy/angle/radius and
//      renders no sectors at all.

vi.mock('recharts', async () => {
  const actual = await vi.importActual<any>('recharts');
  const { Children, cloneElement } = await import('react');

  actual.Pie.defaultProps = { ...actual.Pie.defaultProps, isAnimationActive: false };

  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) =>
      cloneElement(Children.only(children), { width: 500, height: 300 }),
  };
});

import { useStore } from '../../src/lib/store';
import PortfolioValue from '../../src/components/dashboard/PortfolioValue';

const store = useStore as unknown as {
  setState: (partial: Record<string, any>) => void;
  getState: () => Record<string, any>;
  reset: () => void;
};

const ACCOUNT_ID = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
const USDC_ISSUER = 'GD7XE3T5Z6J5K6FJH3Z2K4L2M4N6P8Q0R2S4T6V8W0X';
const HOUR_MS = 60 * 60 * 1000;

// fetchHistoricalPerformance measures its 30-day window from the real clock, so
// the effect fixtures are anchored to it rather than to a fixed epoch.
const NOW = Date.now();
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const HISTORY_DAY = new Date(at(3 * HOUR_MS)).toISOString().slice(0, 10);

// ── Fixtures ──────────────────────────────────────────────────────────────────

function buildAccount(balances: any[]) {
  return { id: ACCOUNT_ID, account_id: ACCOUNT_ID, sequence: '1', balances };
}

function nativeBalance(balance: string) {
  return { asset_type: 'native', balance };
}

function issuedBalance(assetCode: string, balance: string, issuer = USDC_ISSUER) {
  return { asset_type: 'credit_alphanum4', asset_code: assetCode, asset_issuer: issuer, balance };
}

const XLM_AND_USDC_BALANCES = [nativeBalance('1000.0000000'), issuedBalance('USDC', '400.0000000')];

/** Desc-ordered Horizon effect pages used to reconstruct balance history. */
const EFFECT_PAGES = [
  [
    {
      type: 'account_credited',
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      amount: '100.0000000',
      created_at: at(2 * HOUR_MS),
    },
    {
      type: 'account_debited',
      asset_type: 'native',
      amount: '200.0000000',
      created_at: at(3 * HOUR_MS),
    },
  ],
];

function buildHorizon(pages: any[][], { fail = false } = {}) {
  let index = 0;
  return {
    effects() {
      const builder: any = {
        forAccount: () => builder,
        order: () => builder,
        limit: () => builder,
        call: async () => {
          if (fail) throw new Error('Horizon 503 Service Unavailable');
          const records = pages[index++] ?? [];
          return { records, next: async () => ({ records: pages[index++] ?? [] }) };
        },
      };
      return builder;
    },
  };
}

const requestedPriceUrls: string[] = [];

function mockPrices(prices: Record<string, { usd: number; usd_24h_change: number }>) {
  server.use(
    http.get('https://api.coingecko.com/api/v3/simple/price', ({ request }) => {
      requestedPriceUrls.push(request.url);
      return HttpResponse.json(prices);
    })
  );
}

function mockPriceFailure() {
  server.use(
    http.get('https://api.coingecko.com/api/v3/simple/price', ({ request }) => {
      requestedPriceUrls.push(request.url);
      return HttpResponse.json({ error: 'rate limited' }, { status: 429 });
    })
  );
}

/** Holds the price response open so the in-flight state can be observed. */
function gatePrices(prices: Record<string, { usd: number; usd_24h_change: number }>) {
  let release: () => void = () => {};
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get('https://api.coingecko.com/api/v3/simple/price', async ({ request }) => {
      requestedPriceUrls.push(request.url);
      await opened;
      return HttpResponse.json(prices);
    })
  );
  return { release };
}

// ── Download capture ──────────────────────────────────────────────────────────

let capturedBlobs: Blob[] = [];
let capturedFilenames: string[] = [];

beforeEach(() => {
  capturedBlobs = [];
  capturedFilenames = [];
  requestedPriceUrls.length = 0;

  store.reset();
  store.setState({
    connectedAddress: ACCOUNT_ID,
    network: 'testnet',
    accountData: buildAccount(XLM_AND_USDC_BALANCES),
  });
  horizonServer = buildHorizon(EFFECT_PAGES);

  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const element = originalCreateElement(tag);
    if (tag === 'a') {
      (element as HTMLAnchorElement).click = () => {
        capturedFilenames.push((element as HTMLAnchorElement).download);
      };
    }
    return element;
  });

  (globalThis.URL as any).createObjectURL = vi.fn((blob: Blob) => {
    capturedBlobs.push(blob);
    return `blob:portfolio-${capturedBlobs.length}`;
  });
  (globalThis.URL as any).revokeObjectURL = vi.fn();
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  store.reset();
  await clearPriceCache();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

let container: HTMLElement = document.body;

/**
 * Recharts appends a `recharts_measurement_span` to document.body and leaves it
 * there for the lifetime of the file, so asset codes leak into body-level
 * queries. Every assertion is therefore scoped to the rendered tree.
 */
function ui() {
  return within(container);
}

async function renderFlow() {
  await act(async () => {
    container = render(<PortfolioValue />).container;
  });
}

/** Wait until the price pipeline has settled with the expected asset codes. */
async function waitForPricing(expectedCodes: string[]) {
  await waitFor(() => {
    expect(store.getState().pricesLoading).toBe(false);
    expect(Object.keys(store.getState().prices).sort()).toEqual([...expectedCodes].sort());
  });
  // Let the derived analytics useMemo commit before asserting on the DOM.
  await act(async () => {});
}

function openTab(label: string) {
  fireEvent.click(ui().getByRole('button', { name: new RegExp(`^${label}$`, 'i') }));
}

async function openTabWhenReady(label: string, expectedCodes = ['USDC', 'XLM']) {
  await waitForPricing(expectedCodes);
  await act(async () => {
    openTab(label);
  });
}

/** The row element of the holdings table for a given asset code. */
function holdingsRow(code: string) {
  return ui().getByText(code).closest('div')!;
}

const pieSectors = () => container.querySelectorAll('.recharts-pie-sector');
const barRectangles = () => container.querySelectorAll('.recharts-bar-rectangle');
const lineCurves = () => container.querySelectorAll('.recharts-line-curve');

/** The chart root that contains `selector` — views render several at once. */
function chart(selector: string) {
  return Array.from(container.querySelectorAll('.recharts-wrapper')).find((node) =>
    node.querySelector(selector)
  ) as HTMLElement;
}

const axisTickValues = (root: HTMLElement, axis: 'xAxis' | 'yAxis') =>
  Array.from(
    root.querySelectorAll(`.recharts-${axis} .recharts-cartesian-axis-tick-value`)
  ).map((node) => node.textContent);

// ═══════════════════════════════════════════════════════════════════════════
// 1. Full flow: assets -> USD estimates -> allocation chart -> CSV export
// ═══════════════════════════════════════════════════════════════════════════

describe('portfolio analytics flow: balances -> USD estimates -> charts -> CSV', () => {
  it('prices every account asset and reports accurate USD estimates', async () => {
    mockPrices({
      stellar: { usd: 0.25, usd_24h_change: 10 },
      'usd-coin': { usd: 1, usd_24h_change: -5 },
    });

    await renderFlow();
    await waitFor(() => expect(ui().getByText('$650.00')).toBeInTheDocument());

    // Total: 1000 XLM @ $0.25 = $250  +  400 USDC @ $1.00 = $400
    expect(ui().getByText('Total Value')).toBeInTheDocument();
    expect(ui().getByText('$650.00')).toBeInTheDocument();

    // 24h change is rebuilt from per-asset moves: $650 vs $648.33 = +0.26%
    expect(ui().getByText('+0.26%')).toBeInTheDocument();
    expect(ui().getByText('Gain')).toBeInTheDocument();

    // 2-asset 61.5/38.5 split is close to perfectly diversified
    expect(ui().getByText('95/100')).toBeInTheDocument();
    expect(ui().getByText('Well diversified')).toBeInTheDocument();

    expect(holdingsRow('XLM')).toHaveTextContent('1,000');
    expect(holdingsRow('XLM')).toHaveTextContent('$0.2500');
    expect(holdingsRow('XLM')).toHaveTextContent('$250.00');
    expect(holdingsRow('XLM')).toHaveTextContent('10.00%');

    expect(holdingsRow('USDC')).toHaveTextContent('400');
    expect(holdingsRow('USDC')).toHaveTextContent('$1.0000');
    expect(holdingsRow('USDC')).toHaveTextContent('$400.00');
    expect(holdingsRow('USDC')).toHaveTextContent('-5.00%');
  });

  it('requests prices only for the asset codes the account actually holds', async () => {
    mockPrices({
      stellar: { usd: 0.25, usd_24h_change: 10 },
      'usd-coin': { usd: 1, usd_24h_change: -5 },
    });

    await renderFlow();
    await waitForPricing(['USDC', 'XLM']);

    expect(requestedPriceUrls).toHaveLength(1);
    const url = new URL(requestedPriceUrls[0]);
    expect(url.pathname).toBe('/api/v3/simple/price');
    // Only Stellar-mapped assets are requested, de-duplicated and sorted.
    expect(url.searchParams.get('ids')).toBe('stellar,usd-coin');
    expect(url.searchParams.get('vs_currencies')).toBe('usd');
    expect(url.searchParams.get('include_24hr_change')).toBe('true');

    expect(store.getState().prices).toEqual({
      XLM: { usd: 0.25, usd_24h_change: 10 },
      USDC: { usd: 1, usd_24h_change: -5 },
    });
  });

  it('renders the allocation pie and per-asset weights for a two-asset book', async () => {
    mockPrices({
      stellar: { usd: 0.25, usd_24h_change: 10 },
      'usd-coin': { usd: 1, usd_24h_change: -5 },
    });

    await renderFlow();
    await openTabWhenReady('Allocation');

    expect(ui().getByText('Asset Allocation')).toBeInTheDocument();
    expect(container.querySelector('.recharts-pie')).toBeInTheDocument();
    expect(pieSectors()).toHaveLength(2);

    // 400/650 = 61.5% and 250/650 = 38.5%, shown in the legend and again in
    // the concentration panel because both clear the 25% threshold.
    expect(ui().getAllByText('61.5%')).toHaveLength(2);
    expect(ui().getAllByText('38.5%')).toHaveLength(2);
    expect(ui().getByText('$400.00')).toBeInTheDocument();
    expect(ui().getByText('$250.00')).toBeInTheDocument();

    expect(ui().getByText('Concentration Risks')).toBeInTheDocument();
    expect(ui().getByText('USDC represents 61.5% of the portfolio')).toBeInTheDocument();
    expect(ui().getByText('XLM represents 38.5% of the portfolio')).toBeInTheDocument();
  });

  it('renders the 30-day performance line and per-asset 24h bars from Horizon history', async () => {
    mockPrices({
      stellar: { usd: 0.25, usd_24h_change: 10 },
      'usd-coin': { usd: 1, usd_24h_change: -5 },
    });

    await renderFlow();
    await openTabWhenReady('Performance');

    // Reconstructed balances: (1200/300) -> (1000/300) -> (1000/400)
    // Priced at $0.25/$1.00: 600 -> 550 -> 650, dated on today and today.
    expect(lineCurves().length).toBeGreaterThan(0);
    expect(axisTickValues(chart('.recharts-line-curve'), 'xAxis')).toContain(HISTORY_DAY);

    // The 24h bar chart is laid out vertically, so the asset codes are its
    // category axis, ordered by change: XLM (+10) above USDC (-5).
    expect(ui().getByText('24h Asset Performance')).toBeInTheDocument();
    expect(barRectangles()).toHaveLength(2);
    expect(axisTickValues(chart('.recharts-bar-rectangle'), 'yAxis')).toEqual(['XLM', 'USDC']);
  });

  it('surfaces the risk view metrics derived from the reconstructed history', async () => {
    mockPrices({
      stellar: { usd: 0.25, usd_24h_change: 10 },
      'usd-coin': { usd: 1, usd_24h_change: -5 },
    });

    await renderFlow();
    await openTabWhenReady('Risk');

    // Std-dev of the reconstructed series (600 -> 550 -> 650) is ~13.26%
    expect(ui().getByText('13.26%')).toBeInTheDocument();
    expect(ui().getByText('High volatility')).toBeInTheDocument();
    expect(ui().getByText('Good diversification')).toBeInTheDocument();
    expect(ui().getByText('38/100')).toBeInTheDocument(); // concentration
    expect(ui().getByText('67/100')).toBeInTheDocument(); // counterparty
    expect(ui().getByText('High issuer exposure')).toBeInTheDocument();

    // USDC is the only issued asset, so counterparty exposure is 61.5%
    expect(ui().getByText('Counterparty')).toBeInTheDocument();
    expect(ui().getByText('1 issuer')).toBeInTheDocument();
    expect(ui().getByText('61.5%')).toBeInTheDocument();

    expect(ui().getByText('Recommendations')).toBeInTheDocument();
    expect(ui().getByText(/Reduce exposure to the largest issuer/i)).toBeInTheDocument();
  });

  it('exports the flow portfolio snapshot as a CSV download', async () => {
    mockPrices({
      stellar: { usd: 0.25, usd_24h_change: 10 },
      'usd-coin': { usd: 1, usd_24h_change: -5 },
    });

    await renderFlow();
    await waitForPricing(['USDC', 'XLM']);

    // Export the same reconstructed timeline the performance chart consumes.
    const history = await fetchHistoricalPerformance(
      buildHorizon(EFFECT_PAGES),
      ACCOUNT_ID,
      { XLM: 1000, USDC: 400 },
      30
    );

    await act(async () => {
      exportHistoricalBalances(history, 'portfolio-export');
    });

    expect(capturedFilenames).toEqual(['portfolio-export.csv']);
    expect(capturedBlobs).toHaveLength(1);
    expect(capturedBlobs[0].type).toBe('text/csv');

    const lines = (await capturedBlobs[0].text()).split('\r\n');
    expect(lines[0]).toBe('Timestamp,Balance,Asset');
    // 3 snapshots x 2 assets = 6 data rows
    expect(lines).toHaveLength(7);
    expect(lines).toContain(`${at(3 * HOUR_MS)},1200,XLM`);
    expect(lines).toContain(`${at(3 * HOUR_MS)},300,USDC`);
    expect(lines).toContain(`${at(2 * HOUR_MS)},1000,XLM`);
    expect(lines).toContain(`${at(2 * HOUR_MS)},300,USDC`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Portfolio compositions
// ═══════════════════════════════════════════════════════════════════════════

describe('portfolio analytics flow: alternative compositions', () => {
  it('renders a single-sector pie and a 100% weight for a one-asset portfolio', async () => {
    store.setState({ accountData: buildAccount([nativeBalance('1000.0000000')]) });
    horizonServer = buildHorizon([[]]);
    mockPrices({ stellar: { usd: 0.25, usd_24h_change: 10 } });

    await renderFlow();
    await waitForPricing(['XLM']);

    // $250.00 shows up twice on the overview: the Total Value stat and the
    // single holdings row.
    expect(ui().getAllByText('$250.00')).toHaveLength(2);
    expect(holdingsRow('XLM')).toHaveTextContent('$250.00');
    expect(ui().getByText('0/100')).toBeInTheDocument();
    expect(ui().getByText('Concentrated')).toBeInTheDocument();
    expect(ui().getByText('+10.00%')).toBeInTheDocument();

    await act(async () => {
      openTab('Allocation');
    });

    expect(pieSectors()).toHaveLength(1);
    expect(ui().getAllByText('100.0%')).toHaveLength(2); // legend + concentration
    expect(ui().getByText('XLM represents 100.0% of the portfolio')).toBeInTheDocument();
  });

  it('renders a five-slice pie with BTC- and ETH-dominated weights', async () => {
    store.setState({
      accountData: buildAccount([
        nativeBalance('1000.0000000'),
        issuedBalance('USDC', '1000.0000000'),
        issuedBalance('BTC', '1.0000000'),
        issuedBalance('ETH', '10.0000000'),
        issuedBalance('SHX', '1000.0000000'),
      ]),
    });
    horizonServer = buildHorizon([[]]);
    mockPrices({
      stellar: { usd: 0.25, usd_24h_change: 1 },
      'usd-coin': { usd: 1, usd_24h_change: 0 },
      bitcoin: { usd: 30000, usd_24h_change: -2 },
      ethereum: { usd: 1500, usd_24h_change: 3 },
      'stronghold-token': { usd: 0.1, usd_24h_change: -1 },
    });

    await renderFlow();
    // 250 + 1000 + 30000 + 15000 + 100 = 46350
    await waitFor(() => expect(ui().getByText('$46,350.00')).toBeInTheDocument());

    await act(async () => {
      openTab('Allocation');
    });

    expect(pieSectors()).toHaveLength(5);
    // The legend renders ungrouped currency via toFixed, the header stat uses
    // toLocaleString.
    expect(ui().getAllByText('64.7%')).toHaveLength(2);
    expect(ui().getAllByText('32.4%')).toHaveLength(2);
    expect(ui().getByText('2.2%')).toBeInTheDocument();
    expect(ui().getByText('$30000.00')).toBeInTheDocument();
    expect(ui().getByText('$15000.00')).toBeInTheDocument();
    // Only BTC and ETH clear the 25% concentration threshold.
    expect(ui().getByText('BTC represents 64.7% of the portfolio')).toBeInTheDocument();
    expect(ui().getByText('ETH represents 32.4% of the portfolio')).toBeInTheDocument();
    expect(ui().queryByText('USDC represents 2.2% of the portfolio')).toBeNull();
  });

  it('excludes unpriced assets from the totals but keeps them listed', async () => {
    store.setState({
      accountData: buildAccount([...XLM_AND_USDC_BALANCES, issuedBalance('SCAM', '5000.0000000')]),
    });
    horizonServer = buildHorizon([[]]);
    mockPrices({
      stellar: { usd: 0.25, usd_24h_change: 10 },
      'usd-coin': { usd: 1, usd_24h_change: -5 },
    });

    await renderFlow();
    await waitFor(() => expect(ui().getByText('$650.00')).toBeInTheDocument());

    const scamRow = holdingsRow('SCAM');
    expect(scamRow).toHaveTextContent('5,000');
    expect(scamRow).toHaveTextContent('—'); // no price, no value, no 24h change
    expect(scamRow).not.toHaveTextContent('$');

    await act(async () => {
      openTab('Risk');
    });
    expect(ui().getByText('Unpriced trustlines')).toBeInTheDocument();
    expect(
      ui().getByText('1 issued asset lack pricing data and may hide counterparty risk.')
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe('portfolio analytics flow: empty and disconnected states', () => {
  it('shows an empty state instead of charts when the account holds no assets', async () => {
    store.setState({ accountData: buildAccount([]) });
    horizonServer = buildHorizon([[]]);

    await renderFlow();

    // The overview is the only view that can render without any priced items.
    expect(ui().getByText('No data available')).toBeInTheDocument();
    expect(ui().queryByText('Asset Holdings')).toBeNull();
    expect(container.querySelector('.recharts-pie')).toBeNull();
    expect(barRectangles()).toHaveLength(0);

    // The analytics tabs stay empty rather than rendering a zero-value chart.
    await act(async () => {
      openTab('Allocation');
    });
    expect(ui().queryByText('No data available')).toBeNull();
    expect(container.querySelector('.recharts-pie')).toBeNull();

    // Nothing to price, so the refresh control is inert and no request is made.
    expect(ui().getByRole('button', { name: /refresh prices/i })).toBeDisabled();
    expect(requestedPriceUrls).toHaveLength(0);
    expect(store.getState().prices).toEqual({});
  });

  it('prompts to connect when no account is loaded', async () => {
    store.setState({ accountData: null, connectedAddress: null });

    await renderFlow();

    expect(ui().getByText('No account connected')).toBeInTheDocument();
    expect(ui().queryByRole('button', { name: /^allocation$/i })).toBeNull();
  });

  it('keeps the loading spinner until the price request settles', async () => {
    const { release } = gatePrices({
      stellar: { usd: 0.25, usd_24h_change: 10 },
      'usd-coin': { usd: 1, usd_24h_change: -5 },
    });

    await renderFlow();

    // The price request is still in flight: every analytics view is withheld.
    expect(store.getState().pricesLoading).toBe(true);
    expect(container.querySelector('.spinner')).not.toBeNull();
    expect(ui().queryByText('Total Value')).toBeNull();

    await act(async () => {
      release();
    });

    await waitForPricing(['USDC', 'XLM']);

    expect(container.querySelector('.spinner')).toBeNull();
    expect(ui().getByText('$650.00')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Failure handling
// ═══════════════════════════════════════════════════════════════════════════

describe('portfolio analytics flow: failure handling', () => {
  it('degrades to unpriced holdings when the price API fails', async () => {
    mockPriceFailure();

    await renderFlow();
    await waitFor(() => {
      expect(store.getState().pricesLoading).toBe(false);
      expect(store.getState().prices).toEqual({});
    });
    await act(async () => {});

    // Renders without throwing; every valuation cell falls back to an em dash.
    expect(ui().getByText('Total Value')).toBeInTheDocument();
    expect(ui().getByText('$0.00')).toBeInTheDocument();
    expect(holdingsRow('XLM')).toHaveTextContent('—');
    expect(holdingsRow('XLM')).toHaveTextContent('1,000');
    expect(holdingsRow('USDC')).toHaveTextContent('—');
    expect(holdingsRow('USDC')).toHaveTextContent('400');

    // No weights can be derived, so allocation degrades to 0.0% with em-dash
    // valuations instead of crashing on a null valueUsd.
    await act(async () => {
      openTab('Allocation');
    });
    expect(ui().getByText('Asset Allocation')).toBeInTheDocument();
    expect(ui().getAllByText('0.0%')).toHaveLength(2);
    expect(ui().getAllByText('—')).toHaveLength(2);
    expect(ui().queryByText('Concentration Risks')).toBeNull();
  });

  it('recovers a full portfolio when prices become available on refresh', async () => {
    mockPriceFailure();

    await renderFlow();
    await waitFor(() => {
      expect(store.getState().pricesLoading).toBe(false);
      expect(store.getState().prices).toEqual({});
    });

    mockPrices({
      stellar: { usd: 0.25, usd_24h_change: 10 },
      'usd-coin': { usd: 1, usd_24h_change: -5 },
    });

    await act(async () => {
      fireEvent.click(ui().getByRole('button', { name: /refresh prices/i }));
    });

    await waitFor(() => expect(ui().getByText('$650.00')).toBeInTheDocument());
    expect(ui().getByText('Asset Holdings')).toBeInTheDocument();
    expect(requestedPriceUrls).toHaveLength(2);
  });

  it('keeps rendering every view when Horizon history reconstruction fails', async () => {
    mockPrices({
      stellar: { usd: 0.25, usd_24h_change: 10 },
      'usd-coin': { usd: 1, usd_24h_change: -5 },
    });
    horizonServer = buildHorizon([], { fail: true });

    await renderFlow();
    await waitFor(() => expect(ui().getByText('$650.00')).toBeInTheDocument());

    // Falls back to the current snapshot: total value is unaffected, volatility 0.
    await act(async () => {
      openTab('Risk');
    });
    expect(ui().getByText('0.00%')).toBeInTheDocument();
    expect(ui().getByText('Low volatility')).toBeInTheDocument();

    await act(async () => {
      openTab('Performance');
    });
    expect(ui().getByText('Portfolio Value (30 Days)')).toBeInTheDocument();
    expect(barRectangles()).toHaveLength(2);
  });
});
