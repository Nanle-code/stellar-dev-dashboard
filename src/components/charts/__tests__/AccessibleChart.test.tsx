import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AccessibleChart from '../AccessibleChart';

const data = [
  { date: '2026-01-01', fees: 100 },
  { date: '2026-01-02', fees: 150 },
  { date: '2026-01-03', fees: 200 },
];

const series = [{ key: 'fees', label: 'Fees', unit: 'stroops' }];

describe('<AccessibleChart />', () => {
  it('renders a screen-reader summary and the chart content (primary flow)', () => {
    render(
      <AccessibleChart title="Fee Trend" data={data} series={series} categoryKey="date" categoryLabel="Date">
        <div data-testid="chart-body">chart</div>
      </AccessibleChart>
    );

    expect(screen.getByTestId('chart-body')).toBeInTheDocument();
    expect(screen.getByText(/Fee Trend: 3 data points/)).toBeInTheDocument();
  });

  it('reveals an accessible data table when toggled via keyboard-operable button', () => {
    render(
      <AccessibleChart title="Fee Trend" data={data} series={series} categoryKey="date" categoryLabel="Date">
        <div>chart</div>
      </AccessibleChart>
    );

    const toggle = screen.getByRole('button', { name: /show data table/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Fees' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '100' })).toBeInTheDocument();
  });

  it('renders an empty-state message instead of the chart for an empty dataset (boundary case)', () => {
    render(
      <AccessibleChart title="Fee Trend" data={[]} series={series} categoryKey="date">
        <div data-testid="chart-body">chart</div>
      </AccessibleChart>
    );

    expect(screen.queryByTestId('chart-body')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No data is currently available for this chart.');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('falls back gracefully instead of crashing on malformed data (failure case)', () => {
    render(
      <AccessibleChart
        title="Fee Trend"
        data={'not-an-array' as unknown as Array<Record<string, unknown>>}
        series={series}
        categoryKey="date"
        emptyMessage="Chart data failed to load."
      >
        <div data-testid="chart-body">chart</div>
      </AccessibleChart>
    );

    expect(screen.queryByTestId('chart-body')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Chart data failed to load.');
  });
});
