import { describe, it, expect } from 'vitest';
import {
  buildSandboxAccountFixture,
  buildSandboxTradeFixture,
  generateSandboxTradeSeries,
  SAMPLE_SANDBOX_ACCOUNTS,
  SAMPLE_SANDBOX_TRADES,
  ANONYMIZED_ADDRESSES,
} from '../../__factories__/sandboxFixtures';

describe('Sandbox Test Factories (#908)', () => {
  it('exports sample datasets and anonymized addresses', () => {
    expect(SAMPLE_SANDBOX_ACCOUNTS.length).toBeGreaterThan(0);
    expect(SAMPLE_SANDBOX_TRADES.length).toBeGreaterThan(0);
    expect(ANONYMIZED_ADDRESSES.RETAIL_TRADER).toBeDefined();
    expect(ANONYMIZED_ADDRESSES.MARKET_MAKER).toBeDefined();
  });

  it('builds custom sandbox account fixtures with overrides', () => {
    const custom = buildSandboxAccountFixture({
      displayName: 'Custom Test Account',
      subentry_count: 99,
    });

    expect(custom.displayName).toBe('Custom Test Account');
    expect(custom.subentry_count).toBe(99);
    expect(custom.id).toBe(SAMPLE_SANDBOX_ACCOUNTS[0].id);
  });

  it('builds custom sandbox trade fixtures with overrides', () => {
    const customTrade = buildSandboxTradeFixture({
      id: 'custom_tx_1',
      base_amount: '9999.0000000',
    });

    expect(customTrade.id).toBe('custom_tx_1');
    expect(customTrade.base_amount).toBe('9999.0000000');
  });

  it('generates a synthetic trade series over time', () => {
    const series = generateSandboxTradeSeries(7);
    expect(series).toHaveLength(7);
    expect(series[0].id).toBe('mock_trade_series_1');
    expect(series[6].id).toBe('mock_trade_series_7');

    // Chronologically sequential
    const t0 = new Date(series[0].ledger_close_time).getTime();
    const t1 = new Date(series[1].ledger_close_time).getTime();
    expect(t1).toBeGreaterThan(t0);
  });
});
