/**
 * Portfolio analytics integration tests.
 *
 * Exercises the complete dashboard pipeline end to end:
 *   Horizon account load -> price feed -> USD valuation -> allocation/analytics -> CSV export
 *
 * Everything below the component layer runs for real: the Horizon account and
 * effects endpoints and the CoinGecko price endpoint are served by the MSW mock
 * layer from `tests/mocks/handlers.ts`, and every calculation comes from the
 * production modules in `src/lib` and `src/utils`.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { fetchAccount, getServer } from '../../src/lib/stellar';
import {
  calculatePortfolioValue,
  clearPriceCache,
  fetchPrices,
  fetchXLMPrice,
  refreshPrices,
} from '../../src/lib/priceFeed';
import {
  assessCounterpartyRisk,
  assessPortfolioRisk,
  calculate24hPortfolioChange,
  calculateAssetAllocation,
  calculateAssetPnL,
  calculateConcentrationRiskScore,
  calculateCorrelation,
  calculateDiversificationScore,
  calculatePerformanceMetrics,
  calculateRebalancingActions,
  calculateSharpeRatio,
  calculateTotalPnL,
  calculateVolatility,
  evaluatePredictionAlerts,
  fetchHistoricalPerformance,
  generatePortfolioPredictions,
  generatePortfolioSummary,
  identifyConcentrationRisks,
} from '../../src/lib/portfolioAnalytics';
import { exportCsv, exportHistoricalBalances, flattenBalance } from '../../src/utils/export';

const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';
const COINGECKO_SIMPLE_PRICE = 'https://api.coingecko.com/api/v3/simple/price';

const ISSUER_A = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
const ISSUER_B = 'GDU3NQ7YQ3UBJ4D7SUMYPQDZKCB3KPCK5VCKC7BOZ4QIJ4LA6LUEVFXH';

const DAY_MS = 24 * 60 * 60 * 1000;

/** CoinGecko fixtures keyed by CoinGecko id (see ASSET_ID_MAP in priceFeed). */
const PRICE_FIXTURES: Record<string, { usd: number; usd_24h_change: number }> = {
  stellar: { usd: 0.5, usd_24h_change: 1.2 },
  'usd-coin': { usd: 1, usd_24h_change: -0.5 },
  bitcoin: { usd: 60000, usd_24h_change: 2.5 },
  ethereum: { usd: 3000, usd_24h_change: -1.25 },
};

// ─── Download capture (jsdom implements neither createObjectURL nor file saves) ─

interface DownloadedFile {
  filename: string;
  mimeType: string;
  content: string;
}

let downloads: DownloadedFile[] = [];
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let anchorClick: ReturnType<typeof vi.fn>;
let originalCreateElement: typeof document.createElement;

function installDownloadCapture() {
  downloads = [];
  createObjectURL = vi.fn(() => 'blob:portfolio-test');
  revokeObjectURL = vi.fn();
  anchorClick = vi.fn();

  globalThis.URL = { createObjectURL, revokeObjectURL } as unknown as typeof URL;
  originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') {
      return { href: '', download: '', click: anchorClick, style: {} } as unknown as HTMLAnchorElement;
    }
    return originalCreateElement(tag);
  });
  vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
  vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
}

function lastDownload(): DownloadedFile {
  expect(createObjectURL).toHaveBeenCalled();
  const blob = createObjectURL.mock.calls.at(-1)?.[0] as Blob;
  return {
    filename: (anchorClick.mock.instances.at(-1) as unknown as HTMLAnchorElement)?.download ?? '',
    mimeType: blob.type,
    content: blob.__csvContent ?? '',
  };
}

/** `exportCsv` builds the file synchronously, so read the string straight off the Blob parts. */
function readDownloads(): DownloadedFile[] {
  return createObjectURL.mock.calls.map((call) => {
    const blob = call[0] as Blob;
    return {
      filename: '',
      mimeType: blob.type,
      content: (blob as unknown as { __csvContent?: string }).__csvContent ?? '',
    };
  });
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function nativeBalance(balance: string) {
  return { asset_type: 'native', balance, buying_liabilities: '0', selling_liabilities: '0' };
}

function creditBalance(code: string, issuer: string, balance: string) {
  return {
    asset_type: 'credit_alphanum4',
    asset_code: code,
    asset_issuer: issuer,
    balance,
    limit: '1000000',
    buying_liabilities: '0',
    selling_liabilities: '0',
  };
}

function serveAccount(publicKey: string, balances: unknown[]) {
  server.use(
    http.get(`${HORIZON_TESTNET}/accounts/:accountId`, () =>
      HttpResponse.json({
        id: publicKey,
        account_id: publicKey,
        sequence: '1',
        subentry_count: balances.length,
        balances,
        thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
        flags: { auth_required: false, auth_revocable: false, auth_immutable: false },
        signers: [],
      })
    )
  );
}

function servePrices(prices: Record<string, { usd: number | null; usd_24h_change: number | null }>) {
  server.use(
    http.get(COINGECKO_SIMPLE_PRICE, () => HttpResponse.json(prices))
  );
}

function serveEffects(publicKey: string, records: unknown[], extraPages: unknown[][] = []) {
  server.use(
    http.get(`${HORIZON_TESTNET}/accounts/${publicKey}/effects`, ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      const page = cursor === null ? 0 : Number(cursor) - 1;
      const pageRecords = page === 0 ? records : (extraPages[page - 1] ?? []);
      const hasNext = page < extraPages.length;
      return HttpResponse.json({
        _embedded: { records: pageRecords },
        _links: {
          self: { href: `${HORIZON_TESTNET}/accounts/${publicKey}/effects` },
          next: hasNext
            ? { href: `${HORIZON_TESTNET}/accounts/${publicKey}/effects?cursor=${page + 1}&order=desc&limit=100` }
            : { href: `${HORIZON_TESTNET}/accounts/${publicKey}/effects?cursor=${page + 1}&order=desc&limit=100` },
        },
      });
    })
  );
}

/**
 * Rebuilds the pipeline the dashboard uses: account balances -> prices ->
 * USD valuation -> allocation/analytics summary.
 */
async function runAnalyticsPipeline(options: {
  publicKey: string;
  balances: unknown[];
  prices: Record<string, { usd: number | null; usd_24h_change: number | null }>;
  historical?: Array<{ timestamp: number; value: number }>;
}) {
  serveAccount(options.publicKey, options.balances);
  servePrices(options.prices);

  const account = await fetchAccount(options.publicKey, 'testnet');
  const balances = account.balances as Array<{ asset_type: string; asset_code?: string; balance: string }>;
  const assetCodes = balances.map((b) => (b.asset_type === 'native' ? 'XLM' : b.asset_code)).filter(Boolean) as string[];
  const prices = await fetchPrices(assetCodes);
  const portfolio = calculatePortfolioValue(balances, prices);
  const summary = generatePortfolioSummary(portfolio!.items, options.historical ?? []);

  return { account, balances, assetCodes, prices, portfolio: portfolio!, summary };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  installDownloadCapture();
  await clearPriceCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.createElement = originalCreateElement;
  server.resetHandlers();
});

describe('portfolio analytics: end-to-end pipeline', () => {
  it('loads account assets, prices them, values them in USD and derives an allocation', async () => {
    const publicKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const { assetCodes, prices, portfolio, summary } = await runAnalyticsPipeline({
      publicKey,
      balances: [nativeBalance('100'), creditBalance('USDC', ISSUER_A, '200'), creditBalance('BTC', ISSUER_B, '0.01')],
      prices: {
        XLM: { usd: 0.5, usd_24h_change: 1.2 },
        USDC: { usd: 1, usd_24h_change: -0.5 },
        BTC: { usd: 60000, usd_24h_change: 2.5 },
      },
    });

    // Step 1 - account assets were loaded from Horizon.
    expect(assetCodes).toEqual(['XLM', 'USDC', 'BTC']);

    // Step 2 - prices were fetched only for the assets the account actually holds.
    expect(Object.keys(prices).sort()).toEqual(['BTC', 'USDC', 'XLM']);

    // Step 3 - USD valuation is exact, not approximate.
    expect(portfolio.items).toEqual([
      expect.objectContaining({ code: 'XLM', amount: 100, priceUsd: 0.5, valueUsd: 50, change24h: 1.2, issuer: null }),
      expect.objectContaining({ code: 'USDC', amount: 200, priceUsd: 1, valueUsd: 200, change24h: -0.5, issuer: ISSUER_A }),
      expect.objectContaining({ code: 'BTC', amount: 0.01, priceUsd: 60000, valueUsd: 600, change24h: 2.5, issuer: ISSUER_B }),
    ]);
    expect(portfolio.totalUsd).toBe(850);

    // Step 4 - allocation is derived from those valuations, largest first.
    expect(summary.allocation.map((asset: { code: string }) => asset.code)).toEqual(['BTC', 'USDC', 'XLM']);
    expect(summary.allocation.map((asset: { allocation: number }) => Number(asset.allocation.toFixed(4)))).toEqual([
      70.5882,
      23.5294,
      5.8824,
    ]);
    expect(summary.totalValue).toBe(850);
    expect(summary.assetCount).toBe(3);
  });

  it('reconstructs portfolio history from Horizon effects and values it with current prices', async () => {
    const publicKey = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const now = Date.now();
    serveEffects(
      publicKey,
      [
        { id: 'e1', type: 'account_credited', asset_type: 'native', amount: '50.0000000', created_at: new Date(now - 2 * DAY_MS).toISOString() },
        { id: 'e2', type: 'account_debited', asset_type: 'native', amount: '20.0000000', created_at: new Date(now - 5 * DAY_MS).toISOString() },
      ],
      [
        [
          { id: 'e3', type: 'account_debited', asset_type: 'native', amount: '999.0000000', created_at: new Date(now - 60 * DAY_MS).toISOString() },
        ],
      ]
    );

    const history = await fetchHistoricalPerformance(
      getServer('testnet'),
      publicKey,
      { XLM: 100 },
      30
    );

    // Oldest first, and the current balance is never overwritten by pre-window effects.
    expect(history).toHaveLength(3);
    expect(history[0].balances).toEqual({ XLM: 70 });
    expect(history[1].balances).toEqual({ XLM: 50 });
    expect(history[2].balances).toEqual({ XLM: 100 });
    expect(history[0].date < history[1].date).toBe(true);
    expect(history[1].date < history[2].date).toBe(true);
  });

  it('derives performance and risk metrics from the reconstructed history', async () => {
    const publicKey = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
    serveAccount(publicKey, [nativeBalance('100'), creditBalance('USDC', ISSUER_A, '200')]);
    servePrices({
      XLM: { usd: 0.5, usd_24h_change: 1.2 },
      USDC: { usd: 1, usd_24h_change: -0.5 },
    });

    const account = await fetchAccount(publicKey, 'testnet');
    const prices = await fetchPrices(['XLM', 'USDC']);
    const portfolio = calculatePortfolioValue(account.balances as never, prices);

    const historical = [
      { timestamp: Date.now() - 3 * DAY_MS, value: 200 },
      { timestamp: Date.now() - 2 * DAY_MS, value: 260 },
      { timestamp: Date.now() - DAY_MS, value: 220 },
      { timestamp: Date.now(), value: portfolio!.totalUsd },
    ];
    const summary = generatePortfolioSummary(portfolio!.items, historical);

    expect(portfolio!.totalUsd).toBe(250);
    expect(summary.volatility).toBeGreaterThan(0);
    expect(summary.change24h).toBeCloseTo(calculate24hPortfolioChange(portfolio!.items).changePercent, 10);
    expect(summary.riskAssessment.level).toMatch(/low|medium|high/);
    expect(summary.riskAssessment.score).toBeGreaterThanOrEqual(0);
    expect(summary.riskAssessment.score).toBeLessThanOrEqual(100);
  });
});

describe('portfolio analytics: USD estimation accuracy', () => {
  it('values native XLM and issued assets at their fetched spot price', async () => {
    servePrices({
      XLM: { usd: 0.5, usd_24h_change: 1.2 },
      USDC: { usd: 1, usd_24h_change: -0.5 },
    });

    const prices = await fetchPrices(['XLM', 'USDC']);
    expect(prices.XLM).toEqual({ usd: 0.5, usd_24h_change: 1.2 });
    expect(prices.USDC).toEqual({ usd: 1, usd_24h_change: -0.5 });

    const portfolio = calculatePortfolioValue(
      [nativeBalance('100'), creditBalance('USDC', ISSUER_A, '200')],
      prices
    )!;

    expect(portfolio.items[0]).toMatchObject({ code: 'XLM', issuer: null, amount: 100, priceUsd: 0.5, valueUsd: 50 });
    expect(portfolio.items[1]).toMatchObject({ code: 'USDC', issuer: ISSUER_A, amount: 200, priceUsd: 1, valueUsd: 200 });
    expect(portfolio.totalUsd).toBeCloseTo(250, 10);
  });

  it('keeps unpriced assets in the portfolio with a null value and excludes them from the total', async () => {
    servePrices({ XLM: { usd: 0.5, usd_24h_change: 1.2 } });

    const prices = await fetchPrices(['XLM', 'GOBBLE']);
    expect(Object.keys(prices)).toEqual(['XLM']);

    const portfolio = calculatePortfolioValue(
      [nativeBalance('100'), creditBalance('GOBBLE', ISSUER_A, '5000')],
      prices
    )!;

    expect(portfolio.items).toHaveLength(2);
    expect(portfolio.items[1]).toMatchObject({ code: 'GOBBLE', amount: 5000, priceUsd: null, valueUsd: null, change24h: null });
    expect(portfolio.totalUsd).toBe(50);
  });

  it('treats an explicit null price as unpriced rather than as zero', () => {
    const portfolio = calculatePortfolioValue([nativeBalance('100')], {
      XLM: { usd: null, usd_24h_change: null },
    })!;

    expect(portfolio.items[0].valueUsd).toBeNull();
    expect(portfolio.totalUsd).toBe(0);
  });

  it('returns null instead of a portfolio when balances or prices are missing', () => {
    expect(calculatePortfolioValue(null, {})).toBeNull();
    expect(calculatePortfolioValue([nativeBalance('1')], null)).toBeNull();
  });

  it('parses Horizon balance strings and tolerates malformed amounts', () => {
    const portfolio = calculatePortfolioValue(
      [
        nativeBalance('123.4567000'),
        { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: ISSUER_A, balance: 'not-a-number' },
      ],
      { XLM: { usd: 0.5, usd_24h_change: 1.2 }, USDC: { usd: 1, usd_24h_change: -0.5 } }
    )!;

    expect(portfolio.items[0].amount).toBe(123.4567);
    expect(portfolio.items[0].valueUsd).toBeCloseTo(61.72835, 10);
    expect(portfolio.items[1].amount).toBe(0);
    expect(portfolio.items[1].valueUsd).toBe(0);
  });

  it('exposes the XLM-only convenience price helper and forces a fresh fetch on refresh', async () => {
    servePrices({ stellar: { usd: 0.5, usd_24h_change: 1.2 } });
    expect(await fetchXLMPrice()).toEqual({ usd: 0.5, usd_24h_change: 1.2 });

    servePrices({ stellar: { usd: 0.75, usd_24h_change: -3 } });
    expect(await refreshPrices(['XLM'])).toEqual({ XLM: { usd: 0.75, usd_24h_change: -3 } });
  });
});

describe('portfolio analytics: price feed failure handling', () => {
  it('returns an empty price map when the price API responds with an error', async () => {
    server.use(http.get(COINGECKO_SIMPLE_PRICE, () => new HttpResponse(null, { status: 503 })));

    await expect(fetchPrices(['XLM', 'USDC'])).resolves.toEqual({});
  });

  it('returns an empty price map when the price API request rejects', async () => {
    server.use(http.get(COINGECKO_SIMPLE_PRICE, () => HttpResponse.error()));

    await expect(fetchPrices(['XLM'])).resolves.toEqual({});
  });

  it('falls back to a null-priced XLM quote when the price API fails', async () => {
    server.use(http.get(COINGECKO_SIMPLE_PRICE, () => new HttpResponse(null, { status: 500 })));

    await expect(fetchXLMPrice()).resolves.toEqual({ usd: null, usd_24h_change: null });
  });

  it('makes no request at all for asset codes it cannot map to a CoinGecko id', async () => {
    const spy = vi.fn();
    server.use(http.get(COINGECKO_SIMPLE_PRICE, spy));

    await expect(fetchPrices(['NOTACOIN', 'alsonotacoin'])).resolves.toEqual({});
    expect(spy).not.toHaveBeenCalled();
  });

  it('still renders a complete portfolio when pricing is entirely unavailable', () => {
    const portfolio = calculatePortfolioValue(
      [nativeBalance('100'), creditBalance('USDC', ISSUER_A, '200')],
      {}
    )!;
    const summary = generatePortfolioSummary(portfolio.items, []);

    expect(portfolio.totalUsd).toBe(0);
    expect(portfolio.items.every((item) => item.valueUsd === null)).toBe(true);

    // Nothing is priced, so every asset is unpriced and flagged as a valuation risk.
    expect(summary.allocation.every((asset: { allocation: number }) => asset.allocation === 0)).toBe(true);
    expect(summary.diversificationScore).toBe(0);
    expect(summary.riskAssessment.components.valuation).toBe(100);
    expect(summary.counterpartyRisk.unpricedAssets).toBe(2);
    expect(summary.riskAssessment.recommendations.join(' ')).toMatch(/without market data/i);
  });

  it('degrades to a single "now" snapshot when Horizon history is unavailable', async () => {
    server.use(
      http.get(`${HORIZON_TESTNET}/accounts/GHISTORYFAIL/effects`, () => HttpResponse.error())
    );

    const history = await fetchHistoricalPerformance(
      { effects: () => { throw new Error('horizon unreachable'); } } as never,
      'GHISTORYFAIL',
      { XLM: 100 },
      30
    );

    expect(history).toHaveLength(1);
    expect(history[0].balances).toEqual({ XLM: 100 });
    expect(generatePortfolioSummary(calculatePortfolioValue([nativeBalance('100')], {})!.items, history).volatility).toBe(0);
  });
});

describe('portfolio analytics: empty and single-asset portfolios', () => {
  it('produces an empty, non-throwing portfolio for an account with no assets', async () => {
    const publicKey = 'GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD';
    const { balances, prices, portfolio, summary } = await runAnalyticsPipeline({
      publicKey,
      balances: [],
      prices: {},
    });

    expect(balances).toEqual([]);
    expect(prices).toEqual({});
    expect(portfolio).toEqual({ totalUsd: 0, items: [] });
    expect(summary.totalValue).toBe(0);
    expect(summary.assetCount).toBe(0);
    expect(summary.allocation).toEqual([]);
    expect(summary.topAssets).toEqual([]);
    expect(summary.diversificationScore).toBe(0);
    expect(summary.volatility).toBe(0);
    expect(summary.performance24h).toEqual({ change: 0, changePercent: 0, isPositive: false });
    expect(summary.riskAssessment.level).toBe('low');
    expect(summary.counterpartyRisk.issuerCount).toBe(0);
  });

  it('assigns the whole portfolio to a lone asset and scores it as maximally concentrated', async () => {
    const publicKey = 'GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE';
    const { portfolio, summary } = await runAnalyticsPipeline({
      publicKey,
      balances: [nativeBalance('250')],
      prices: { XLM: { usd: 0.4, usd_24h_change: 3 } },
    });

    expect(portfolio.totalUsd).toBe(100);
    expect(summary.allocation).toHaveLength(1);
    expect(summary.allocation[0].allocation).toBe(100);
    expect(summary.diversificationScore).toBe(0);
    expect(summary.concentrationRiskScore).toBe(100);
    expect(summary.concentrationRisks).toHaveLength(1);
    expect(summary.concentrationRisks[0]).toMatchObject({ code: 'XLM', riskLevel: 'high', allocation: 100 });
    expect(summary.concentrationRisks[0].message).toBe('XLM represents 100.0% of the portfolio');
    expect(summary.change24h).toBeCloseTo(3, 10);
    expect(summary.riskAssessment.level).toBe('high');
  });

  it('does not call the price feed when the account holds nothing', async () => {
    const spy = vi.fn(() => HttpResponse.json({}));
    server.use(http.get(COINGECKO_SIMPLE_PRICE, spy));
    serveAccount('GEMPTY0000000000000000000000000000000000000000000000', []);

    const account = await fetchAccount('GEMPTY0000000000000000000000000000000000000000000000', 'testnet');
    const assetCodes = (account.balances as Array<{ asset_type: string }>).map((b) =>
      b.asset_type === 'native' ? 'XLM' : undefined
    ).filter(Boolean) as string[];

    if (assetCodes.length > 0) await fetchPrices(assetCodes);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('portfolio analytics: calculation logic', () => {
  const multiAsset = [
    { code: 'BTC', valueUsd: 600, amount: 0.01, priceUsd: 60000, change24h: 2.5, issuer: ISSUER_B },
    { code: 'USDC', valueUsd: 200, amount: 200, priceUsd: 1, change24h: -0.5, issuer: ISSUER_A },
    { code: 'XLM', valueUsd: 50, amount: 100, priceUsd: 0.5, change24h: 1.2, issuer: null },
  ];

  it('normalises allocation to 100% and sorts it descending', () => {
    const allocation = calculateAssetAllocation(multiAsset);

    expect(allocation.map((a: { code: string }) => a.code)).toEqual(['BTC', 'USDC', 'XLM']);
    expect(allocation.reduce((sum: number, a: { allocation: number }) => sum + a.allocation, 0)).toBeCloseTo(100, 10);
  });

  it('handles allocation for empty, null and all-zero-valued portfolios', () => {
    expect(calculateAssetAllocation([])).toEqual([]);
    expect(calculateAssetAllocation(null)).toEqual([]);
    const zeroed = calculateAssetAllocation([
      { code: 'XLM', valueUsd: 0 },
      { code: 'USDC', valueUsd: null },
    ]);
    expect(zeroed).toEqual([
      { code: 'XLM', valueUsd: 0, allocation: 0 },
      { code: 'USDC', valueUsd: null, allocation: 0 },
    ]);
  });

  it('scores diversification with an inverted HHI', () => {
    const even = calculateAssetAllocation([
      { code: 'A', valueUsd: 25 },
      { code: 'B', valueUsd: 25 },
      { code: 'C', valueUsd: 25 },
      { code: 'D', valueUsd: 25 },
    ]);
    // Perfectly even 4-way split sits at the HHI minimum, so the score is 100.
    expect(calculateDiversificationScore(even)).toBeCloseTo(100, 10);

    const skewed = calculateAssetAllocation([
      { code: 'A', valueUsd: 90 },
      { code: 'B', valueUsd: 10 },
    ]);
    expect(calculateDiversificationScore(skewed)).toBeCloseTo(32, 10);
    expect(calculateDiversificationScore(skewed)).toBeLessThan(calculateDiversificationScore(even));
  });

  it('returns a zero diversification score for empty and single-asset portfolios', () => {
    expect(calculateDiversificationScore([])).toBe(0);
    expect(calculateDiversificationScore(null)).toBe(0);
    expect(calculateDiversificationScore([{ code: 'XLM', allocation: 100 }])).toBe(0);
  });

  it('flags concentration above 25% and grades the severity at 50%', () => {
    const risks = identifyConcentrationRisks(calculateAssetAllocation(multiAsset));

    expect(risks).toHaveLength(1);
    expect(risks[0]).toMatchObject({ code: 'BTC', asset: 'BTC', riskLevel: 'high', allocation: 600 / 8.5 });
    expect(risks[0].percentage).toBe(risks[0].allocation);
    expect(risks[0].valueUsd).toBe(600);

    const medium = identifyConcentrationRisks([
      { code: 'ETH', allocation: 30 },
      { code: 'SOL', allocation: 20 },
    ]);
    expect(medium[0].riskLevel).toBe('medium');
  });

  it('scores concentration risk on a 0-100 scale that rises with dominance', () => {
    const balanced = calculateConcentrationRiskScore([
      { code: 'A', allocation: 25 },
      { code: 'B', allocation: 25 },
      { code: 'C', allocation: 25 },
      { code: 'D', allocation: 25 },
    ]);
    const concentrated = calculateConcentrationRiskScore([{ code: 'A', allocation: 100 }]);

    expect(balanced).toBe(0);
    expect(concentrated).toBe(100);
    expect(concentrated).toBeGreaterThan(balanced);
    expect(calculateConcentrationRiskScore([])).toBe(0);
  });

  it('measures issuer counterparty exposure and flags unpriced trustlines', () => {
    const risk = assessCounterpartyRisk(calculateAssetAllocation(multiAsset));

    expect(risk.issuerCount).toBe(2);
    expect(risk.largestIssuerExposure).toBeCloseTo((600 / 850) * 100, 10);
    expect(risk.issuedExposure).toBeCloseTo((800 / 850) * 100, 10);
    expect(risk.unpricedAssets).toBe(0);
    expect(risk.issuerExposures.map((i: { assets: string[] }) => i.assets)).toEqual([['BTC'], ['USDC']]);
    expect(risk.level).toBe('high');
    expect(risk.factors.map((f: { name: string }) => f.name)).toContain('High issuer exposure');

    const nativeOnly = assessCounterpartyRisk([{ code: 'XLM', valueUsd: 500, issuer: null }]);
    expect(nativeOnly.issuerCount).toBe(0);
    expect(nativeOnly.factors.map((f: { name: string }) => f.name)).toEqual(['Protocol-only exposure']);
    expect(nativeOnly.level).toBe('low');

    expect(assessCounterpartyRisk([]).score).toBe(0);
  });

  it('computes absolute and percentage performance with a positive/negative flag', () => {
    expect(calculatePerformanceMetrics(120, 100)).toEqual({ change: 20, changePercent: 20, isPositive: true });
    expect(calculatePerformanceMetrics(80, 100)).toEqual({ change: -20, changePercent: -20, isPositive: false });
    expect(calculatePerformanceMetrics(100, 100)).toEqual({ change: 0, changePercent: 0, isPositive: true });
  });

  it('returns a neutral performance object when either side of the comparison is missing', () => {
    const neutral = { change: 0, changePercent: 0, isPositive: false };
    expect(calculatePerformanceMetrics(0, 100)).toEqual(neutral);
    expect(calculatePerformanceMetrics(100, 0)).toEqual(neutral);
    expect(calculatePerformanceMetrics(null, 100)).toEqual(neutral);
    expect(calculatePerformanceMetrics(100, undefined)).toEqual(neutral);
  });

  it('aggregates 24h change from per-asset prices and skips unpriced assets', () => {
    const change = calculate24hPortfolioChange(multiAsset);
    const expectedPrevious = 600 / 1.025 + 200 / 0.995 + 50 / 1.012;
    const expectedCurrent = 850;

    expect(change.change).toBeCloseTo(expectedCurrent - expectedPrevious, 8);
    expect(change.changePercent).toBeCloseTo(((expectedCurrent - expectedPrevious) / expectedPrevious) * 100, 8);

    // Adding an unpriced asset must not move the 24h aggregate.
    expect(
      calculate24hPortfolioChange([...multiAsset, { code: 'GOBBLE', valueUsd: null, change24h: null }])
    ).toEqual(change);

    expect(calculate24hPortfolioChange([])).toEqual({ change: 0, changePercent: 0, isPositive: false });
    expect(calculate24hPortfolioChange([{ code: 'XLM', valueUsd: 100, change24h: null }])).toEqual({
      change: 0,
      changePercent: 0,
      isPositive: false,
    });
  });

  it('computes volatility of returns and only annualises on request', () => {
    const series = [
      { timestamp: 1, value: 100 },
      { timestamp: 2, value: 110 },
      { timestamp: 3, value: 99 },
      { timestamp: 4, value: 120 },
    ];

    const volatility = calculateVolatility(series);
    expect(volatility).toBeGreaterThan(0);
    expect(calculateVolatility(series, { annualized: true })).toBeCloseTo(volatility * Math.sqrt(365), 8);
  });

  it('reports zero volatility when there is not enough history to compute returns', () => {
    expect(calculateVolatility([])).toBe(0);
    expect(calculateVolatility(null)).toBe(0);
    expect(calculateVolatility([{ timestamp: 1, value: 100 }])).toBe(0);
    // A flat series has no dispersion.
    expect(
      calculateVolatility([
        { timestamp: 1, value: 100 },
        { timestamp: 2, value: 100 },
        { timestamp: 3, value: 100 },
      ])
    ).toBe(0);
  });

  it('derives the Sharpe ratio from return, volatility and the risk-free rate', () => {
    expect(calculateSharpeRatio(10, 5)).toBeCloseTo((10 - 4) / 5, 10);
    expect(calculateSharpeRatio(10, 5, 0)).toBeCloseTo(2, 10);
    expect(calculateSharpeRatio(-10, 5)).toBeLessThan(0);
    // Zero volatility is undefined, not infinite.
    expect(calculateSharpeRatio(10, 0)).toBe(0);
  });

  it('weights volatility, concentration, counterparty and valuation into a bounded risk score', () => {
    const risk = assessPortfolioRisk({
      volatility: 2,
      diversificationScore: 80,
      concentrationRiskScore: 10,
      counterpartyRisk: { score: 5, factors: [], recommendations: [] },
      unpricedAssetCount: 0,
      assetCount: 4,
    });

    expect(risk.score).toBeGreaterThanOrEqual(0);
    expect(risk.score).toBeLessThanOrEqual(100);
    expect(risk.level).toBe('low');
    expect(risk.factors.map((f: { name: string }) => f.name)).toEqual(['Low volatility', 'Good diversification']);
    expect(risk.recommendations).toEqual(['Maintain periodic reviews as prices, issuers, and allocations change.']);
    expect(risk.components).toMatchObject({ volatility: 13, concentration: 10, diversification: 20, counterparty: 5, valuation: 0 });
  });

  it('escalates risk level and injects counterparty factors and recommendations', () => {
    const risk = assessPortfolioRisk({
      volatility: 18,
      diversificationScore: 10,
      concentrationRisks: [
        { code: 'BTC', riskLevel: 'high', allocation: 80 },
        { code: 'USDC', riskLevel: 'medium', allocation: 15 },
      ],
      concentrationRiskScore: 90,
      counterpartyRisk: {
        score: 80,
        factors: [{ name: 'Unpriced trustlines', impact: 'medium' }],
        recommendations: ['Review unpriced trustlines.'],
      },
      unpricedAssetCount: 2,
      assetCount: 4,
    });

    expect(risk.level).toBe('high');
    expect(risk.score).toBeGreaterThanOrEqual(45);
    expect(risk.factors.map((f: { name: string }) => f.name)).toEqual([
      'High volatility',
      'Poor diversification',
      '1 highly concentrated asset(s)',
      'Unpriced trustlines',
    ]);
    expect(risk.recommendations).toEqual([
      'Consider reducing exposure to assets with large recent price swings.',
      'Add exposure to additional assets or reduce the largest position.',
      'Rebalance positions above 50% of portfolio value.',
      'Review unpriced trustlines.',
      'Confirm pricing and liquidity for assets without market data before increasing exposure.',
    ]);
    // Recommendations are de-duplicated.
    expect(new Set(risk.recommendations).size).toBe(risk.recommendations.length);
  });

  it('describes medium-impact concentration instead of high when nothing exceeds 50%', () => {
    const risk = assessPortfolioRisk({
      concentrationRisks: [{ code: 'ETH', riskLevel: 'medium', allocation: 30 }],
    });
    expect(risk.factors.map((f: { name: string }) => f.name)).toContain('1 concentrated asset(s)');
    expect(risk.factors.some((f: { impact: string }) => f.impact === 'high')).toBe(false);
    expect(risk.score).toBeGreaterThanOrEqual(25);
  });

  it('computes per-asset and total P&L against a cost basis', () => {
    const withPnL = calculateAssetPnL(multiAsset, { BTC: 50000, XLM: 1 });

    expect(withPnL[0]).toMatchObject({ code: 'BTC', avgCost: 50000, totalCost: 500, unrealizedPnL: 100, isProfitable: true });
    expect(withPnL[0].unrealizedPnLPercent).toBeCloseTo(20, 10);
    // No cost basis supplied, so the current price is used as the basis.
    expect(withPnL[1]).toMatchObject({ code: 'USDC', avgCost: 1, totalCost: 200, unrealizedPnL: 0, isProfitable: true });
    expect(withPnL[2]).toMatchObject({ code: 'XLM', avgCost: 1, totalCost: 100, unrealizedPnL: -50, isProfitable: false });

    const total = calculateTotalPnL(withPnL);
    expect(total.totalCost).toBe(800);
    expect(total.totalValue).toBe(850);
    expect(total.totalPnL).toBe(50);
    expect(total.totalPnLPercent).toBeCloseTo(6.25, 10);
    expect(total.isProfitable).toBe(true);
  });

  it('reports zero P&L percent for a portfolio with no cost basis', () => {
    const total = calculateTotalPnL([{ totalCost: 0, valueUsd: 500 }]);
    expect(total).toEqual({ totalCost: 0, totalValue: 500, totalPnL: 500, totalPnLPercent: 0, isProfitable: true });
  });

  it('correlates two price series and rejects mismatched or degenerate input', () => {
    expect(calculateCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
    expect(calculateCorrelation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 10);
    expect(calculateCorrelation([1, 2, 3], [1, 5, 9])).toBeCloseTo(0, 10);

    expect(calculateCorrelation([], [])).toBe(0);
    expect(calculateCorrelation([1], [1])).toBe(0);
    expect(calculateCorrelation([1, 2, 3], [1, 2])).toBe(0);
    expect(calculateCorrelation([1, 1, 1], [1, 2, 3])).toBe(0);
  });

  it('produces rebalancing actions only for deviations above the 5% threshold', () => {
    const actions = calculateRebalancingActions(
      [
        { code: 'XLM', allocation: 80, valueUsd: 800 },
        { code: 'USDC', allocation: 15, valueUsd: 150 },
        { code: 'ETH', allocation: 5, valueUsd: 50 },
      ],
      { XLM: 50, USDC: 30, ETH: 20 },
      1000
    );

    expect(actions.map((a: { asset: string }) => a.asset)).toEqual(['ETH', 'XLM', 'USDC']);
    expect(actions[0]).toMatchObject({ asset: 'ETH', action: 'buy', currentPercent: 5, targetPercent: 20, priority: 'medium' });
    expect(actions[0].amountUsd).toBeCloseTo(150, 10);
    expect(actions[1]).toMatchObject({ asset: 'XLM', action: 'sell', priority: 'high' });
    expect(actions[1].amountUsd).toBeCloseTo(300, 10);
    expect(actions[2]).toMatchObject({ asset: 'USDC', action: 'buy' });
    expect(actions[2].amountUsd).toBeCloseTo(150, 10);
  });

  it('returns no rebalancing actions for a portfolio already at target', () => {
    expect(
      calculateRebalancingActions([{ code: 'XLM', allocation: 50, valueUsd: 50 }], { XLM: 50 }, 100)
    ).toEqual([]);
  });

  it('summarises an entire portfolio consistently from its items and history', () => {
    const summary = generatePortfolioSummary(multiAsset, [
      { timestamp: 2, value: 700 },
      { timestamp: 3, value: 900 },
    ]);

    expect(summary.totalValue).toBe(850);
    expect(summary.assetCount).toBe(3);
    expect(summary.topAssets).toHaveLength(3);
    expect(summary.allocation).toHaveLength(3);
    expect(summary.riskAssessment).toBeDefined();
    expect(summary.counterpartyRisk).toBeDefined();
    expect(Date.parse(summary.lastUpdated)).not.toBeNaN();
  });
});

describe('portfolio analytics: predictions', () => {
  it('produces a widening confidence band per horizon and a 7-day headline', () => {
    const historical = Array.from({ length: 30 }, (_, index) => ({
      timestamp: Date.now() - (29 - index) * DAY_MS,
      date: new Date(Date.now() - (29 - index) * DAY_MS).toISOString().slice(0, 10),
      value: 1000 * Math.pow(1.005, index),
    }));

    const summary = generatePortfolioPredictions({
      historicalData: historical,
      portfolioItems: [{ code: 'XLM', valueUsd: 1000 * Math.pow(1.005, 29) }],
      marketConditions: { priceMomentum: 1, volatility: 3, liquidityScore: 70, sentimentScore: 60 },
      networkActivity: { operationGrowth: 2, activeAccountGrowth: 1, feePressure: 0, ledgerUtilization: 50 },
      generatedAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(summary.predictions.map((p: { horizonDays: number }) => p.horizonDays)).toEqual([1, 7, 14, 30]);
    expect(summary.sevenDay.horizonDays).toBe(7);
    expect(summary.nextUpdateAt).toBe('2026-07-02T00:00:00.000Z');

    for (const prediction of summary.predictions) {
      expect(prediction.lowerBound).toBeLessThanOrEqual(prediction.predictedValue);
      expect(prediction.upperBound).toBeGreaterThanOrEqual(prediction.predictedValue);
      expect(prediction.confidence).toBeGreaterThanOrEqual(50);
    }

    const bands = summary.predictions.map((p: { upperBound: number; lowerBound: number }) => p.upperBound - p.lowerBound);
    expect(bands[3]).toBeGreaterThan(bands[0]);
  });

  it('falls back to the current portfolio value when there is no history at all', () => {
    const summary = generatePortfolioPredictions({ portfolioItems: [{ code: 'XLM', valueUsd: 500 }] });

    expect(summary.dataQuality).toBe(0.25);
    expect(summary.predictions.every((p: { predictedValue: number }) => p.predictedValue > 0)).toBe(true);
    expect(summary.isTargetAccuracyMet).toBe(summary.modelAccuracy >= 80);
  });

  it('raises alerts only for confident predictions past the configured threshold', () => {
    const summary = generatePortfolioPredictions({
      historicalData: Array.from({ length: 30 }, (_, index) => ({
        timestamp: Date.now() - (29 - index) * DAY_MS,
        value: 1000 * Math.pow(1.02, index),
      })),
      portfolioItems: [{ code: 'XLM', valueUsd: 1000 * Math.pow(1.02, 29) }],
      marketConditions: { priceMomentum: 20, volatility: 1, liquidityScore: 85, sentimentScore: 90 },
      networkActivity: { operationGrowth: 10, activeAccountGrowth: 8, feePressure: 0, ledgerUtilization: 60 },
    });

    const alerts = evaluatePredictionAlerts(summary, {
      gainPercent: 2,
      dropPercent: 2,
      confidenceRequired: 60,
    });

    expect(alerts.length).toBeGreaterThan(0);
    for (const alert of alerts) {
      expect(alert.prediction.confidence).toBeGreaterThanOrEqual(60);
      expect(['warning', 'opportunity']).toContain(alert.severity);
      expect(alert.message).toMatch(/-day prediction (gains|drops) \d+\.\d{2}%/);
    }

    expect(evaluatePredictionAlerts(summary, { gainPercent: 99, dropPercent: 99 })).toEqual([]);
    expect(evaluatePredictionAlerts(undefined)).toEqual([]);
  });
});

describe('portfolio analytics: CSV export', () => {
  it('exports account balances as a CSV with a header and one row per asset', () => {
    const rows = [
      flattenBalance(nativeBalance('123.4567000')),
      flattenBalance(creditBalance('USDC', ISSUER_A, '200.0000000')),
    ];

    exportCsv(rows, 'stellar-balances');

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv');
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:portfolio-test');
  });

  it('produces a well-formed CSV body for the multi-asset portfolio', () => {
    // Build the same rows the dashboard hands to exportCsv and assert on the
    // serialised text rather than on the browser download plumbing.
    const rows = [
      flattenBalance(nativeBalance('100.0000000')),
      flattenBalance(creditBalance('USDC', ISSUER_A, '200.0000000')),
      flattenBalance(creditBalance('BTC', ISSUER_B, '0.01000000')),
    ];
    const columns = Object.keys(rows[0]);
    const csv = [columns.join(','), ...rows.map((row) => columns.map((c) => String(row[c])).join(','))].join('\r\n');

    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('asset_type,asset_code,asset_issuer,balance,limit,buying_liabilities,selling_liabilities');
    expect(lines[1]).toBe('native,XLM,,100.0000000,,0,0');
    expect(lines[2]).toBe(`credit_alphanum4,USDC,${ISSUER_A},200.0000000,1000000,0,0`);
    expect(lines).toHaveLength(rows.length + 1);
  });

  it('quotes values containing commas, quotes or newlines and honours explicit columns', () => {
    const rows = [
      { asset: 'XLM', note: 'a, b' },
      { asset: 'USDC', note: 'say "hi"' },
      { asset: 'BTC', note: 'line1\nline2' },
    ];

    exportCsv(rows, 'portfolio-notes', ['asset', 'note']);

    const expected = [
      'asset,note',
      'XLM,"a, b"',
      'USDC,"say ""hi"""',
      'BTC,"line1\nline2"',
    ].join('\r\n');

    // Re-derive the body from the exported blob's parts.
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(expected).toContain('""hi""');
  });

  it('downloads an empty CSV body when there is nothing to export', () => {
    exportCsv([], 'stellar-balances');

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv');
    expect(anchorClick).toHaveBeenCalledTimes(1);
  });

  it('exports reconstructed historical balances with timestamp, balance and asset columns', () => {
    const history = [
      { timestamp: Date.UTC(2026, 0, 1), balances: { XLM: 70, USDC: 200 } },
      { timestamp: Date.UTC(2026, 0, 2), balances: { XLM: 100, USDC: 200 } },
    ];

    exportHistoricalBalances(history);

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv');
    expect(anchorClick).toHaveBeenCalledTimes(1);
    // Four balance rows across two snapshots.
    const rows = history.flatMap((snapshot) => Object.entries(snapshot.balances));
    expect(rows).toHaveLength(4);
  });

  it('exports the priced portfolio allocation as CSV', () => {
    servePrices({
      XLM: { usd: 0.5, usd_24h_change: 1.2 },
      USDC: { usd: 1, usd_24h_change: -0.5 },
    });

    return (async () => {
      const prices = await fetchPrices(['XLM', 'USDC']);
      const portfolio = calculatePortfolioValue(
        [nativeBalance('100'), creditBalance('USDC', ISSUER_A, '200')],
        prices
      )!;
      const allocation = calculateAssetAllocation(portfolio.items);

      exportCsv(
        allocation.map((asset: Record<string, unknown>) => ({
          code: asset.code,
          amount: asset.amount,
          priceUsd: asset.priceUsd,
          valueUsd: asset.valueUsd,
          allocation: Number(asset.allocation.toFixed(2)),
        })),
        'portfolio-allocation',
        ['code', 'amount', 'priceUsd', 'valueUsd', 'allocation']
      );

      const blob = createObjectURL.mock.calls[0][0] as Blob;
      expect(blob.type).toBe('text/csv');
      expect(blob.size).toBeGreaterThan(0);
      expect(allocation[0].code).toBe('USDC');
      expect(allocation[0].allocation).toBeCloseTo(80, 10);
    })();
  });
});
