import { describe, it, expect } from 'vitest';
import {
  isRenderableChartData,
  summarizeSeries,
  describeChart,
  buildChartTable,
} from '../chartAccessibility';

const data = [
  { date: '2026-01-01', fees: 100, latency: 200 },
  { date: '2026-01-02', fees: 150, latency: 180 },
  { date: '2026-01-03', fees: 200, latency: 160 },
];

describe('isRenderableChartData', () => {
  it('accepts a non-empty array of objects (primary flow)', () => {
    expect(isRenderableChartData(data)).toBe(true);
  });

  it('rejects an empty array (boundary case)', () => {
    expect(isRenderableChartData([])).toBe(false);
  });

  it('rejects null, undefined, and non-array input (failure case)', () => {
    expect(isRenderableChartData(null)).toBe(false);
    expect(isRenderableChartData(undefined)).toBe(false);
    expect(isRenderableChartData('not an array')).toBe(false);
    expect(isRenderableChartData(42)).toBe(false);
    expect(isRenderableChartData([1, 2, 3])).toBe(false);
  });
});

describe('summarizeSeries', () => {
  it('computes min/max/average/trend for a numeric series (primary flow)', () => {
    const summary = summarizeSeries(data, { key: 'fees', label: 'Fees', unit: 'stroops' });
    expect(summary.count).toBe(3);
    expect(summary.min).toBe(100);
    expect(summary.max).toBe(200);
    expect(summary.average).toBe(150);
    expect(summary.trend).toBe('up');
  });

  it('detects a downward trend', () => {
    const summary = summarizeSeries(data, { key: 'latency', label: 'Latency' });
    expect(summary.trend).toBe('down');
  });

  it('returns a safe empty summary for a single data point (boundary case)', () => {
    const summary = summarizeSeries([{ date: '2026-01-01', fees: 100 }], { key: 'fees' });
    expect(summary.count).toBe(1);
    expect(summary.trend).toBe('flat');
  });

  it('skips non-finite values instead of throwing (failure case)', () => {
    const malformed = [
      { date: '2026-01-01', fees: 'not-a-number' },
      { date: '2026-01-02', fees: NaN },
      { date: '2026-01-03', fees: 300 },
    ];
    const summary = summarizeSeries(malformed, { key: 'fees' });
    expect(summary.count).toBe(1);
    expect(summary.average).toBe(300);
  });

  it('returns an empty summary for invalid/empty datasets', () => {
    expect(summarizeSeries(null, { key: 'fees' }).count).toBe(0);
    expect(summarizeSeries([], { key: 'fees' }).min).toBeNull();
  });
});

describe('describeChart', () => {
  it('produces a readable sentence describing the series (primary flow)', () => {
    const text = describeChart({
      title: 'Fee Trend',
      data,
      series: [{ key: 'fees', label: 'Fees', unit: 'stroops' }],
    });
    expect(text).toContain('Fee Trend');
    expect(text).toContain('3 data points');
    expect(text).toContain('Fees ranges from 100');
  });

  it('reports no data available for empty datasets (boundary case)', () => {
    expect(describeChart({ title: 'Fee Trend', data: [], series: [] })).toBe(
      'Fee Trend: no data is currently available.'
    );
  });

  it('does not throw for malformed input (failure case)', () => {
    expect(() =>
      describeChart({ title: 'Broken', data: 'garbage' as unknown, series: [] })
    ).not.toThrow();
    expect(describeChart({ title: 'Broken', data: undefined, series: [] })).toContain(
      'no data is currently available'
    );
  });
});

describe('buildChartTable', () => {
  it('builds headers and rows matching the dataset (primary flow)', () => {
    const table = buildChartTable(data, [
      { key: 'date', label: 'Date' },
      { key: 'fees', label: 'Fees' },
    ]);
    expect(table.headers).toEqual(['Date', 'Fees']);
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0]).toEqual(['2026-01-01', '100']);
  });

  it('renders an em dash for missing values (boundary case)', () => {
    const table = buildChartTable([{ date: '2026-01-01' }], [
      { key: 'date', label: 'Date' },
      { key: 'fees', label: 'Fees' },
    ]);
    expect(table.rows[0]).toEqual(['2026-01-01', '—']);
  });

  it('returns an empty table for invalid data or columns instead of throwing (failure case)', () => {
    expect(buildChartTable(null, [{ key: 'fees' }])).toEqual({ headers: [], rows: [] });
    expect(buildChartTable(data, [])).toEqual({ headers: [], rows: [] });
    expect(buildChartTable('garbage' as unknown, [{ key: 'fees' }])).toEqual({
      headers: [],
      rows: [],
    });
  });
});
