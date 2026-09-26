/**
 * Sandbox Test Fixtures and Builders (#908)
 *
 * Provides mock builders and pre-baked fixtures for testing sandbox analytics demos,
 * anonymized accounts, and trade series.
 */

import {
  SAMPLE_SANDBOX_ACCOUNTS,
  SAMPLE_SANDBOX_TRADES,
  ANONYMIZED_ADDRESSES,
} from '../../src/fixtures/sandboxDatasets';

export { SAMPLE_SANDBOX_ACCOUNTS, SAMPLE_SANDBOX_TRADES, ANONYMIZED_ADDRESSES };

/**
 * Build a customized mock sandbox account for testing.
 * @param {object} [overrides={}]
 * @returns {object}
 */
export const buildSandboxAccountFixture = (overrides = {}) => {
  const base = SAMPLE_SANDBOX_ACCOUNTS[0];
  return {
    ...base,
    ...overrides,
    balances: overrides.balances ?? [...base.balances],
    signers: overrides.signers ?? [...base.signers],
    thresholds: { ...base.thresholds, ...(overrides.thresholds ?? {}) },
    flags: { ...base.flags, ...(overrides.flags ?? {}) },
    tags: overrides.tags ?? [...base.tags],
  };
};

/**
 * Build a customized mock sandbox trade for testing.
 * @param {object} [overrides={}]
 * @returns {object}
 */
export const buildSandboxTradeFixture = (overrides = {}) => {
  const base = SAMPLE_SANDBOX_TRADES[0];
  return {
    ...base,
    ...overrides,
    price: { ...base.price, ...(overrides.price ?? {}) },
  };
};

/**
 * Generate a synthetic series of trade fixtures spanning a custom time range.
 * @param {number} count
 * @param {object} [baseOverrides={}]
 * @returns {object[]}
 */
export const generateSandboxTradeSeries = (count = 5, baseOverrides = {}) => {
  const series = [];
  const basePrice = 0.125;
  const startTime = new Date('2026-09-25T10:00:00Z').getTime();

  for (let i = 0; i < count; i++) {
    const time = new Date(startTime + i * 15 * 60 * 1000).toISOString();
    const priceFloat = basePrice + (i % 2 === 0 ? 0.001 * i : -0.0005 * i);
    const priceStr = priceFloat.toFixed(7);
    const amount = (1000 + i * 100).toFixed(7);
    const counterAmount = ((1000 + i * 100) * priceFloat).toFixed(7);

    series.push(
      buildSandboxTradeFixture({
        id: `mock_trade_series_${i + 1}`,
        paging_token: `2000-${i + 1}`,
        ledger_close_time: time,
        base_amount: amount,
        counter_amount: counterAmount,
        price_r: priceStr,
        price: { n: Math.round(priceFloat * 10000), d: 10000 },
        base_is_seller: i % 2 === 0,
        ...baseOverrides,
      })
    );
  }

  return series;
};
