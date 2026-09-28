/**
 * Portfolio analytics — calculation pipeline integration tests
 *
 * Exercises the real modules that back the Portfolio Analytics flow
 * (src/lib/priceFeed.ts + src/lib/portfolioAnalytics.ts) end to end:
 * account balances -> USD estimates -> allocation -> risk -> P&L -> CSV rows.
 *
 * The companion suite (portfolioAnalyticsFlow.test.tsx) covers the rendered
 * component; this suite covers every exported calculation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import {
  calculatePortfolioValue,
  clearPriceCache,
  fetchPrices,
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
  fetchHistoricalPerformance,
  generatePortfolioSummary,
  identifyConcentrationRisks,
} from '../../src/lib/portfolioAnalytics';
import { buildCsv } from '../../src/lib/chartUtils';

const ACCOUNT_ID = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
const USDC_ISSUER = 'GD7XE3T5Z6J5K6FJH3Z2K4L2M4N6P8Q0R2S4T6V8W0X';
const UNKNOWN_ISSUER = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// fetchHistoricalPerformance measures its window from the real clock, so the
// fixtures are anchored to it rather than to a fixed epoch.
const NOW = Date.now();
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

/** Horizon balance rows as returned by account.balances. */
function buildBalances() {
  return [
    { asset_type: 'native', balance: '1000.0000000' },
    {
      asset_type: 'credit_alphanum4',
      asset_code: 'USDC',
      asset_issuer: USDC_ISSUER,
      balance: '400.0000000',
    },
  ];
}

/** Items as produced by calculatePortfolioValue for XLM + USDC. */
function buildPricedItems() {
  return [
    { code: 'XLM', valueUsd: 250, amount: 1000, priceUsd: 0.25, change24h: 10, issuer: null },
    {
      code: 'USDC',
      valueUsd: 400,
      amount: 400,
      priceUsd: 1,
      change24h: -5,
      issuer: USDC_ISSUER,
    },
  ];
}

function overrideCoinGecko(prices: Record<string, { usd: number; usd_24h_change: number }>) {
  server.use(
    http.get('https://api.coingecko.com/api/v3/simple/price', () => HttpResponse.json(prices))
  );
}

async function pricedPortfolio() {
  const prices = await fetchPrices(['XLM', 'USDC']);
  return calculatePortfolioValue(buildBalances(), prices);
}

beforeEach(async () => {
  await clearPriceCache();
});

afterEach(async () => {
  await clearPriceCache();
});

// ─── USD estimation ───────────────────────────────────────────────────────────

describe('USD estimation: account balances -> priced portfolio items', () => {
  it('values every balance from CoinGecko prices and sums the total', async () => {
    overrideCoinGecko({
      stellar: { usd: 0.25, usd_24h_change: 10 },
      'usd-coin': { usd: 1, usd_24h_change: -5 },
    });

    const { totalUsd, items } = await pricedPortfolio();

    expect(totalUsd).toBe(650);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      code: 'XLM',
      amount: 1000,
      issuer: null,
      priceUsd: 0.25,
      valueUsd: 250,
      change24h: 10,
    });
    expect(items[1]).toEqual({
      code: 'USDC',
      amount: 400,
      issuer: USDC_ISSUER,
      priceUsd: 1,
      valueUsd: 400,
      change24h: -5,
    });
  });

  it('marks balances as unpriced when the price map has no entry', () => {
    const portfolio = calculatePortfolioValue([{ asset_type: 'native', balance: '1000.0000000' }], {});

    expect(portfolio.totalUsd).toBe(0);
    expect(portfolio.items[0]).toMatchObject({
      code: 'XLM',
      priceUsd: null,
      valueUsd: null,
      change24h: null,
    });
  });

  it('returns null when balances or prices are missing entirely', () => {
    expect(calculatePortfolioValue(null, {})).toBeNull();
    expect(calculatePortfolioValue(buildBalances(), null)).toBeNull();
  });

  it('treats an unparseable balance string as a zero amount', () => {
    const portfolio = calculatePortfolioValue(
      [{ asset_type: 'native', balance: 'not-a-number' }],
      { XLM: { usd: 2, usd_24h_change: 0 } }
    );

    expect(portfolio.items[0].amount).toBe(0);
    expect(portfolio.totalUsd).toBe(0);
  });

  it('degrades to unpriced items when the price API fails', async () => {
    server.use(
      http.get('https://api.coingecko.com/api/v3/simple/price', () =>
        HttpResponse.json({ error: 'rate limited' }, { status: 429 })
      )
    );

    const prices = await fetchPrices(['XLM', 'USDC']);
    expect(prices).toEqual({});

    const portfolio = calculatePortfolioValue(buildBalances(), prices);
    expect(portfolio.totalUsd).toBe(0);
    expect(portfolio.items.every((item) => item.valueUsd === null)).toBe(true);
  });

  it('skips asset codes that have no CoinGecko mapping', async () => {
    overrideCoinGecko({ stellar: { usd: 0.25, usd_24h_change: 10 } });

    const prices = await fetchPrices(['XLM', 'SCAMTOKEN']);
    expect(Object.keys(prices)).toEqual(['XLM']);
  });
});

// ─── Performance ──────────────────────────────────────────────────────────────

describe('performance metrics', () => {
  it('derives change and changePercent from current and previous values', () => {
    expect(calculatePerformanceMetrics(650, 500)).toEqual({
      change: 150,
      changePercent: 30,
      isPositive: true,
    });
    expect(calculatePerformanceMetrics(400, 500)).toEqual({
      change: -100,
      changePercent: -20,
      isPositive: false,
    });
  });

  it('returns a neutral result for missing or zero baselines', () => {
    const neutral = { change: 0, changePercent: 0, isPositive: false };
    expect(calculatePerformanceMetrics(0, 500)).toEqual(neutral);
    expect(calculatePerformanceMetrics(650, 0)).toEqual(neutral);
    expect(calculatePerformanceMetrics(null, undefined)).toEqual(neutral);
  });

  it('reconstructs the 24h portfolio change from per-asset moves', async () => {
    overrideCoinGecko({
      stellar: { usd: 0.25, usd_24h_change: 10 },
      'usd-coin': { usd: 1, usd_24h_change: -5 },
    });

    const { items } = await pricedPortfolio();
    const change = calculate24hPortfolioChange(items);

    // Previous values: 250 / 1.10 = 227.2727…  +  400 / 0.95 = 421.0526…
    expect(change.change).toBeCloseTo(1.6746411, 6);
    expect(change.changePercent).toBeCloseTo(0.25830258, 6);
    expect(change.isPositive).toBe(true);
  });

  it('ignores assets that are missing a price or a 24h change', () => {
    const change = calculate24hPortfolioChange([
      { code: 'XLM', valueUsd: 250, change24h: 10 },
      { code: 'MYSTERY', valueUsd: null, change24h: null },
      { code: 'SHX', valueUsd: 100, change24h: undefined },
    ]);

    expect(change.changePercent).toBeCloseTo(10, 6);
  });
});

// ─── Allocation, diversification, concentration ───────────────────────────────

describe('asset allocation and concentration', () => {
  it('computes percentages that sum to 100 and sorts by weight', () => {
    const allocation = calculateAssetAllocation(buildPricedItems());

    expect(allocation.map((entry) => entry.code)).toEqual(['USDC', 'XLM']);
    expect(allocation[0].allocation).toBeCloseTo(61.538462, 6);
    expect(allocation[1].allocation).toBeCloseTo(38.461538, 6);
    expect(allocation.reduce((sum, entry) => sum + entry.allocation, 0)).toBeCloseTo(100, 6);
  });

  it('returns an empty allocation for an empty or missing portfolio', () => {
    expect(calculateAssetAllocation([])).toEqual([]);
    expect(calculateAssetAllocation(null)).toEqual([]);
  });

  it('returns zero allocations rather than dividing by zero when nothing is priced', () => {
    const allocation = calculateAssetAllocation([{ code: 'MYSTERY', valueUsd: null, amount: 10 }]);

    expect(allocation).toEqual([{ code: 'MYSTERY', valueUsd: null, amount: 10, allocation: 0 }]);
  });

  it('scores a 50/50 split as maximally diversified', () => {
    expect(
      calculateDiversificationScore([
        { code: 'A', allocation: 50 },
        { code: 'B', allocation: 50 },
      ])
    ).toBe(100);
  });

  it('scores a single-asset portfolio as zero diversification', () => {
    expect(calculateDiversificationScore([])).toBe(0);
    expect(calculateDiversificationScore([{ code: 'XLM', allocation: 100 }])).toBe(0);
  });

  it('flags every allocation above the 25% concentration threshold', () => {
    const risks = identifyConcentrationRisks(calculateAssetAllocation(buildPricedItems()));

    // 61.5% and 38.5% both clear 25%.
    expect(risks).toHaveLength(2);
    expect(risks[0]).toMatchObject({
      asset: 'USDC',
      code: 'USDC',
      valueUsd: 400,
      riskLevel: 'high',
    });
    expect(risks[0].allocation).toBeCloseTo(61.538462, 6);
    expect(risks[0].percentage).toBeCloseTo(61.538462, 6);
    expect(risks[0].message).toBe('USDC represents 61.5% of the portfolio');
    expect(risks[1]).toMatchObject({ code: 'XLM', riskLevel: 'medium' });
  });

  it('rates 25-50% weight as medium concentration', () => {
    const risks = identifyConcentrationRisks([{ code: 'A', allocation: 30, valueUsd: 30 }]);
    expect(risks[0].riskLevel).toBe('medium');
  });

  it('keeps assets at or below the 25% threshold out of the risk list', () => {
    const risks = identifyConcentrationRisks([
      { code: 'A', allocation: 25 },
      { code: 'B', allocation: 20 },
    ]);
    expect(risks).toEqual([]);
  });

  it('scores concentration higher for a single dominant asset', () => {
    // One asset only: HHI cannot exceed the theoretical minimum, so only the
    // largest-position term contributes.
    expect(calculateConcentrationRiskScore([{ allocation: 100 }])).toBe(65);
    // Same dominant weight spread over two slots also lifts the HHI term.
    expect(calculateConcentrationRiskScore([{ allocation: 100 }, { allocation: 0 }])).toBe(83);
    expect(
      calculateConcentrationRiskScore([{ allocation: 50 }, { allocation: 50 }])
    ).toBe(28);
    expect(
      calculateConcentrationRiskScore([
        { allocation: 20 },
        { allocation: 20 },
        { allocation: 20 },
        { allocation: 20 },
        { allocation: 20 },
      ])
    ).toBe(8);
    expect(calculateConcentrationRiskScore([])).toBe(0);
  });
});

// ─── Counterparty risk ────────────────────────────────────────────────────────

describe('issuer counterparty exposure', () => {
  it('returns a zeroed report for an empty portfolio', () => {
    const risk = assessCounterpartyRisk([]);

    expect(risk.score).toBe(0);
    expect(risk.level).toBe('low');
    expect(risk.issuerCount).toBe(0);
    expect(risk.largestIssuerExposure).toBe(0);
    expect(risk.issuerExposures).toEqual([]);
    expect(risk.factors).toEqual([]);
  });

  it('ignores native XLM when measuring issuer exposure', () => {
    const risk = assessCounterpartyRisk([{ code: 'XLM', valueUsd: 1000, amount: 1000, issuer: null }]);

    expect(risk.issuerCount).toBe(0);
    expect(risk.issuedExposure).toBe(0);
    expect(risk.factors.map((factor) => factor.name)).toEqual(['Protocol-only exposure']);
    expect(risk.level).toBe('low');
  });

  it('groups assets by issuer and ranks exposure by percentage', () => {
    const risk = assessCounterpartyRisk([
      { code: 'XLM', valueUsd: 250, amount: 1000, issuer: null },
      { code: 'USDC', valueUsd: 400, amount: 400, issuer: USDC_ISSUER },
      { code: 'DAI', valueUsd: 100, amount: 100, issuer: USDC_ISSUER },
      { code: 'SHX', valueUsd: 250, amount: 250, issuer: UNKNOWN_ISSUER },
    ]);

    expect(risk.issuerCount).toBe(2);
    expect(risk.issuedExposure).toBeCloseTo(75, 6);
    expect(risk.issuerExposures[0].issuer).toBe(USDC_ISSUER);
    expect(risk.issuerExposures[0].assets).toEqual(['USDC', 'DAI']);
    expect(risk.issuerExposures[0].percentage).toBeCloseTo(50, 6);
    expect(risk.issuerExposures[1].percentage).toBeCloseTo(25, 6);
    expect(risk.largestIssuerExposure).toBeCloseTo(50, 6);
    expect(risk.factors.map((factor) => factor.name)).toEqual(['High issuer exposure']);
    expect(risk.recommendations).toHaveLength(1);
  });

  it('escalates a sole issuer with heavy exposure to high risk', () => {
    const risk = assessCounterpartyRisk([
      { code: 'USDC', valueUsd: 800, amount: 800, issuer: USDC_ISSUER },
    ]);

    // 100% issued/largest exposure: 100 * 0.25 + 100 * 0.55 = 80, +10 for a
    // sole issuer above 20% exposure, +8 for fewer than three issuers above 50%.
    expect(risk.score).toBe(98);
    expect(risk.level).toBe('high');
    expect(risk.recommendations.join(' ')).toMatch(/largest issuer/i);
  });

  it('reports unpriced trustlines as a hidden counterparty exposure', () => {
    const risk = assessCounterpartyRisk([
      { code: 'XLM', valueUsd: 500, amount: 2000, issuer: null },
      { code: 'MYSTERY', valueUsd: null, amount: 25, issuer: UNKNOWN_ISSUER },
    ]);

    expect(risk.unpricedAssets).toBe(1);
    expect(risk.unpricedAmount).toBe(25);
    expect(risk.unpricedExposure).toBeCloseTo(50, 6);
    expect(risk.factors.map((factor) => factor.name)).toContain('Unpriced trustlines');
    expect(risk.recommendations.join(' ')).toMatch(/unpriced trustlines/i);
  });
});

// ─── Volatility, Sharpe, overall risk ─────────────────────────────────────────

describe('volatility, Sharpe ratio and risk assessment', () => {
  const series = [700, 600, 650];

  it('computes the standard deviation of period returns', () => {
    const volatility = calculateVolatility(series.map((value) => ({ value })));

    expect(volatility).toBeCloseTo(11.309524, 5);
    expect(calculateVolatility([{ value: 700 }])).toBe(0);
    expect(calculateVolatility([])).toBe(0);
  });

  it('scales volatility by sqrt(365) only when annualisation is requested', () => {
    const observed = calculateVolatility(series.map((value) => ({ value })));
    const annualised = calculateVolatility(series.map((value) => ({ value })), {
      annualized: true,
    });

    expect(annualised).toBeCloseTo(observed * Math.sqrt(365), 3);
    expect(annualised).toBeGreaterThan(observed);
  });

  it('skips periods whose baseline value is zero', () => {
    const volatility = calculateVolatility([{ value: 0 }, { value: 100 }, { value: 100 }]);
    expect(volatility).toBe(0);
  });

  it('computes excess return over volatility', () => {
    expect(calculateSharpeRatio(20, 10)).toBe(1.6);
    expect(calculateSharpeRatio(20, 10, 5)).toBe(1.5);
    expect(calculateSharpeRatio(20, 0)).toBe(0);
  });

  it('escalates to high risk for a concentrated, volatile, single-issuer book', () => {
    const risk = assessPortfolioRisk({
      volatility: 18,
      diversificationScore: 5,
      concentrationRisks: [{ code: 'XLM', riskLevel: 'high', allocation: 90 }],
      concentrationRiskScore: 90,
      counterpartyRisk: { score: 70, factors: [], recommendations: [] },
      unpricedAssetCount: 0,
      assetCount: 2,
    });

    expect(risk.score).toBe(75);
    expect(risk.level).toBe('high');
    expect(risk.components).toEqual({
      volatility: 100,
      concentration: 90,
      diversification: 95,
      counterparty: 70,
      valuation: 0,
    });
    expect(risk.factors.map((factor) => factor.name)).toEqual(
      expect.arrayContaining(['High volatility', 'Poor diversification', 'High concentration'])
    );
    expect(risk.recommendations.join(' ')).toMatch(/Rebalance positions above 50%/);
  });

  it('floors a high-impact factor at a medium risk score', () => {
    const risk = assessPortfolioRisk({
      volatility: 1,
      diversificationScore: 0,
      concentrationRisks: [],
      concentrationRiskScore: 0,
      counterpartyRisk: { score: 0, factors: [], recommendations: [] },
      unpricedAssetCount: 0,
      assetCount: 1,
    });

    expect(risk.score).toBe(45);
    expect(risk.level).toBe('medium');
  });

  it('stays low risk for a balanced book with no unpriced assets', () => {
    const risk = assessPortfolioRisk({
      volatility: 1,
      diversificationScore: 90,
      concentrationRisks: [],
      concentrationRiskScore: 10,
      counterpartyRisk: { score: 0, factors: [], recommendations: [] },
      unpricedAssetCount: 0,
      assetCount: 5,
    });

    expect(risk.level).toBe('low');
    expect(risk.factors.map((factor) => factor.name)).toEqual([
      'Low volatility',
      'Good diversification',
    ]);
    expect(risk.recommendations).toEqual([
      'Maintain periodic reviews as prices, issuers, and allocations change.',
    ]);
  });

  it('weights unpriced holdings into the valuation component', () => {
    const risk = assessPortfolioRisk({
      volatility: 0,
      diversificationScore: 100,
      concentrationRisks: [],
      concentrationRiskScore: 0,
      counterpartyRisk: { score: 0, factors: [], recommendations: [] },
      unpricedAssetCount: 1,
      assetCount: 4,
    });

    expect(risk.components.valuation).toBe(25);
    expect(risk.recommendations.join(' ')).toMatch(/without market data/i);
  });

  it('merges counterparty factors and de-duplicates recommendations', () => {
    const risk = assessPortfolioRisk({
      volatility: 6,
      diversificationScore: 80,
      concentrationRisks: [],
      concentrationRiskScore: 0,
      counterpartyRisk: {
        score: 40,
        factors: [
          {
            name: 'High issuer exposure',
            factor: 'High issuer exposure',
            impact: 'high',
            description: 'One issuer backs 80.0% of priced portfolio value.',
          },
        ],
        recommendations: [
          'Add assets backed by independent issuers.',
          'Add assets backed by independent issuers.',
        ],
      },
      unpricedAssetCount: 0,
      assetCount: 3,
    });

    expect(risk.factors.map((factor) => factor.name)).toContain('High issuer exposure');
    expect(
      risk.recommendations.filter((r) => r === 'Add assets backed by independent issuers.')
    ).toHaveLength(1);
  });
});

// ─── P&L ──────────────────────────────────────────────────────────────────────

describe('profit and loss', () => {
  it('compares current value against the supplied cost basis', () => {
    const pnl = calculateAssetPnL(
      [
        { code: 'XLM', valueUsd: 250, amount: 1000, priceUsd: 0.25 },
        { code: 'SHX', valueUsd: 150, amount: 100, priceUsd: 1.5 },
      ],
      { XLM: 0.2 }
    );

    expect(pnl[0]).toMatchObject({
      avgCost: 0.2,
      totalCost: 200,
      unrealizedPnL: 50,
      unrealizedPnLPercent: 25,
      isProfitable: true,
    });
    // SHX has no cost-basis entry, so the current price becomes the basis.
    expect(pnl[1]).toMatchObject({
      avgCost: 1.5,
      totalCost: 150,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      isProfitable: true,
    });
  });

  it('reports a losing position as unprofitable', () => {
    const pnl = calculateAssetPnL(
      [{ code: 'ETH', valueUsd: 80, amount: 1, priceUsd: 80 }],
      { ETH: 100 }
    );

    expect(pnl[0].unrealizedPnL).toBe(-20);
    expect(pnl[0].unrealizedPnLPercent).toBe(-20);
    expect(pnl[0].isProfitable).toBe(false);
  });

  it('aggregates per-asset P&L into a portfolio total', () => {
    const total = calculateTotalPnL([
      { totalCost: 200, valueUsd: 250 },
      { totalCost: 150, valueUsd: 100 },
    ]);

    expect(total).toEqual({
      totalCost: 350,
      totalValue: 350,
      totalPnL: 0,
      totalPnLPercent: 0,
      isProfitable: true,
    });
  });

  it('handles a zero cost basis without dividing by zero', () => {
    expect(calculateTotalPnL([{ totalCost: 0, valueUsd: 0 }])).toMatchObject({
      totalPnLPercent: 0,
      isProfitable: true,
    });
  });
});

// ─── Correlation and rebalancing ───────────────────────────────────────────────

describe('correlation', () => {
  it('returns 1 for perfectly correlated series and -1 for inverted ones', () => {
    expect(calculateCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
    expect(calculateCorrelation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it('returns 0 for mismatched, too-short or flat series', () => {
    expect(calculateCorrelation([1, 2, 3], [1, 2])).toBe(0);
    expect(calculateCorrelation([1], [1])).toBe(0);
    expect(calculateCorrelation(null, [1, 2])).toBe(0);
    expect(calculateCorrelation([2, 2, 2], [1, 5, 9])).toBe(0);
  });
});

describe('rebalancing recommendations', () => {
  it('buys under-allocated and sells over-allocated assets beyond the 5% band', () => {
    const actions = calculateRebalancingActions(
      [
        { code: 'XLM', allocation: 70, valueUsd: 700 },
        { code: 'USDC', allocation: 30, valueUsd: 300 },
      ],
      { XLM: 40, USDC: 60 },
      1000
    );

    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({
      asset: 'XLM',
      action: 'sell',
      amountUsd: 300,
      priority: 'high',
    });
    expect(actions[1]).toMatchObject({
      asset: 'USDC',
      action: 'buy',
      amountUsd: 300,
      priority: 'high',
    });
  });

  it('ignores drift inside the 5% threshold', () => {
    const actions = calculateRebalancingActions(
      [
        { code: 'XLM', allocation: 42, valueUsd: 420 },
        { code: 'USDC', allocation: 58, valueUsd: 580 },
      ],
      { XLM: 40, USDC: 60 },
      1000
    );

    expect(actions).toEqual([]);
  });

  it('marks 5-10% deviations as medium priority and sorts by absolute drift', () => {
    const actions = calculateRebalancingActions(
      [
        { code: 'A', allocation: 47, valueUsd: 470 },
        { code: 'B', allocation: 46, valueUsd: 460 },
        { code: 'C', allocation: 8, valueUsd: 8 },
      ],
      { A: 40, B: 40, C: 40 },
      1000
    );

    expect(actions.map((action) => action.asset)).toEqual(['C', 'A', 'B']);
    expect(actions[0]).toMatchObject({ priority: 'high' });
    expect(actions.slice(1).every((action) => action.priority === 'medium')).toBe(true);
  });
});

// ─── Historical reconstruction ────────────────────────────────────────────────

function buildHorizonStub(pages: any[][], { failOnCall = false } = {}) {
  let pageIndex = 0;
  return {
    effects() {
      const builder: any = {
        forAccount: () => builder,
        order: () => builder,
        limit: () => builder,
        call: async () => {
          if (failOnCall) throw new Error('Horizon 503');
          const records = pages[pageIndex++] ?? [];
          return { records, next: async () => ({ records: pages[pageIndex++] ?? [] }) };
        },
      };
      return builder;
    },
  };
}

describe('historical performance reconstruction', () => {
  const currentBalances = { XLM: 1000, USDC: 400 };

  it('reverses desc-ordered Horizon effects into a chronological balance timeline', async () => {
    const serverStub = buildHorizonStub([
      [
        // newest first, as Horizon returns them
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
    ]);

    const history = await fetchHistoricalPerformance(serverStub, ACCOUNT_ID, currentBalances, 30);

    expect(history).toHaveLength(3);
    expect(history.map((point) => point.balances)).toEqual([
      { XLM: 1200, USDC: 300 },
      { XLM: 1000, USDC: 300 },
      { XLM: 1000, USDC: 400 },
    ]);
    expect(history.map((point) => point.timestamp)).toEqual([
      new Date(at(3 * HOUR_MS)).getTime(),
      new Date(at(2 * HOUR_MS)).getTime(),
      history[2].timestamp,
    ]);
    expect(history[0].date).toBe(new Date(at(3 * HOUR_MS)).toISOString().split('T')[0]);
  });

  it('returns only the current snapshot when there are no effects', async () => {
    const history = await fetchHistoricalPerformance(
      buildHorizonStub([[]]),
      ACCOUNT_ID,
      currentBalances,
      30
    );

    expect(history).toHaveLength(1);
    expect(history[0].balances).toEqual(currentBalances);
  });

  it('stops at the requested window and ignores older effects', async () => {
    const serverStub = buildHorizonStub([
      [
        {
          type: 'account_credited',
          asset_type: 'native',
          amount: '50.0000000',
          created_at: at(2 * HOUR_MS),
        },
        {
          type: 'account_credited',
          asset_type: 'native',
          amount: '9999.0000000',
          created_at: at(40 * DAY_MS),
        },
      ],
    ]);

    const history = await fetchHistoricalPerformance(serverStub, ACCOUNT_ID, currentBalances, 30);

    expect(history).toHaveLength(2);
    expect(history[0].balances).toEqual({ XLM: 950, USDC: 400 });
  });

  it('paginates backwards until the window is exhausted', async () => {
    const serverStub = buildHorizonStub([
      [
        {
          type: 'account_credited',
          asset_type: 'native',
          amount: '10.0000000',
          created_at: at(1 * HOUR_MS),
        },
      ],
      [
        {
          type: 'account_debited',
          asset_type: 'native',
          amount: '30.0000000',
          created_at: at(2 * HOUR_MS),
        },
      ],
    ]);

    const history = await fetchHistoricalPerformance(serverStub, ACCOUNT_ID, currentBalances, 30);

    expect(history.map((point) => point.balances.XLM)).toEqual([1020, 990, 1000]);
  });

  it('degrades to the current snapshot when Horizon fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const history = await fetchHistoricalPerformance(
      buildHorizonStub([], { failOnCall: true }),
      ACCOUNT_ID,
      currentBalances,
      30
    );

    expect(history).toHaveLength(1);
    expect(history[0].balances).toEqual(currentBalances);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// ─── End-to-end summary ───────────────────────────────────────────────────────

describe('generatePortfolioSummary', () => {
  it('ties balances, prices, allocation and risk into one report', () => {
    const summary = generatePortfolioSummary(buildPricedItems(), [
      { value: 600 },
      { value: 550 },
      { value: 650 },
    ]);

    expect(summary.totalValue).toBe(650);
    expect(summary.assetCount).toBe(2);
    expect(summary.allocation.map((entry) => entry.code)).toEqual(['USDC', 'XLM']);
    expect(summary.diversificationScore).toBeCloseTo(94.674556, 5);
    expect(summary.concentrationRiskScore).toBe(38);
    expect(summary.concentrationRisks).toHaveLength(2);
    expect(summary.counterpartyRisk.issuerCount).toBe(1);
    expect(summary.counterpartyRisk.largestIssuerExposure).toBeCloseTo(61.538462, 6);
    expect(summary.change24h).toBeCloseTo(summary.performance24h.changePercent, 10);
    expect(summary.volatility).toBeCloseTo(13.257, 2);
    expect(summary.riskAssessment.level).toBe('medium');
    expect(summary.riskAssessment.score).toBe(55);
    expect(summary.riskAssessment.components).toEqual({
      volatility: 88,
      concentration: 38,
      diversification: 5,
      counterparty: 67,
      valuation: 0,
    });
    expect(summary.topAssets).toEqual(summary.allocation);
    expect(summary.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('reports an empty portfolio without throwing', () => {
    const summary = generatePortfolioSummary([], []);

    expect(summary.totalValue).toBe(0);
    expect(summary.assetCount).toBe(0);
    expect(summary.allocation).toEqual([]);
    expect(summary.concentrationRisks).toEqual([]);
    expect(summary.volatility).toBe(0);
    expect(summary.riskAssessment.level).toBe('medium');
    expect(summary.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('counts unpriced holdings in the valuation risk component', () => {
    const summary = generatePortfolioSummary(
      [
        { code: 'XLM', valueUsd: 250, amount: 1000, priceUsd: 0.25, change24h: 10, issuer: null },
        {
          code: 'MYSTERY',
          valueUsd: null,
          amount: 5,
          priceUsd: null,
          change24h: null,
          issuer: UNKNOWN_ISSUER,
        },
      ],
      []
    );

    expect(summary.riskAssessment.components.valuation).toBe(50);
    expect(summary.riskAssessment.recommendations.join(' ')).toMatch(/without market data/i);
  });
});

// ─── CSV export of the analytics payload ──────────────────────────────────────

describe('CSV export of the analytics payload', () => {
  it('renders the allocation table as spreadsheet-ready rows', () => {
    const allocation = calculateAssetAllocation(buildPricedItems());

    const csv = buildCsv(
      allocation.map((entry) => ({
        Asset: entry.code,
        Balance: entry.amount,
        'Value (USD)': entry.valueUsd.toFixed(2),
        'Allocation (%)': entry.allocation.toFixed(2),
      }))
    );

    const lines = csv.split('\n');
    expect(lines[0]).toBe('Asset,Balance,Value (USD),Allocation (%)');
    expect(lines[1]).toBe('USDC,400,400.00,61.54');
    expect(lines[2]).toBe('XLM,1000,250.00,38.46');
    expect(lines).toHaveLength(3);
  });

  it('produces an empty string for an empty export', () => {
    expect(buildCsv([])).toBe('');
  });
});
