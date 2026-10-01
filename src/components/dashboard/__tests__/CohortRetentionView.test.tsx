import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CohortRetentionView from '../CohortRetentionView';
import type { AccountActivityRecord } from '../../lib/cohortRetention';

// Mock Recharts ResponsiveContainer to avoid size observer issues in jsdom
vi.mock('recharts', async () => {
  const actual: any = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

describe('CohortRetentionView Component', () => {
  const baseMs = Date.UTC(2026, 5, 1);
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const mockActivities: AccountActivityRecord[] = [
    { accountId: 'GA_1', timestamp: baseMs, activityType: 'payment' },
    { accountId: 'GA_2', timestamp: baseMs, activityType: 'payment' },
    { accountId: 'GA_1', timestamp: baseMs + weekMs, activityType: 'payment' },
    { accountId: 'GA_3', timestamp: baseMs + weekMs, activityType: 'payment' },
  ];

  it('renders cohort retention header, stat cards, table, and controls', () => {
    render(
      <CohortRetentionView activities={mockActivities} title="Account Activity Cohort Retention" />
    );

    // Header & Title
    expect(screen.getByText('Account Activity Cohort Retention')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Group accounts by initial activity period and analyze cohort retention over time.'
      )
    ).toBeInTheDocument();

    // Metric Cards
    expect(screen.getByText('Total Tracked Cohorts')).toBeInTheDocument();
    expect(screen.getByText('Unique Tracked Accounts')).toBeInTheDocument();
    expect(screen.getByText('Avg Period 1 Retention (+1 week)')).toBeInTheDocument();

    // Heatmap Matrix Table
    expect(screen.getByText('Cohort Retention Matrix')).toBeInTheDocument();
    expect(screen.getByText('Wk 0')).toBeInTheDocument();
    expect(screen.getByText('+1 Wk')).toBeInTheDocument();
  });

  it('allows changing granularity and view mode toggles', () => {
    render(<CohortRetentionView activities={mockActivities} />);

    // Select Daily Granularity
    const granularitySelect = screen.getByLabelText('Select Cohort Period Granularity');
    fireEvent.change(granularitySelect, { target: { value: 'day' } });
    expect(screen.getByText('Day 0')).toBeInTheDocument();

    // Toggle Account Count mode
    const countBtn = screen.getByLabelText('Show Account Counts');
    fireEvent.click(countBtn);

    expect(screen.getByText('Displaying: Active Accounts (#)')).toBeInTheDocument();

    // Toggle Percentage mode back
    const percentBtn = screen.getByLabelText('Show Retention Percentages');
    fireEvent.click(percentBtn);
    expect(screen.getByText('Displaying: Retention Rate (%)')).toBeInTheDocument();
  });

  it('triggers onExport callback when CSV or JSON buttons are clicked', () => {
    const handleExport = vi.fn();
    render(<CohortRetentionView activities={mockActivities} onExport={handleExport} />);

    const csvBtn = screen.getByLabelText('Export CSV');
    fireEvent.click(csvBtn);
    expect(handleExport).toHaveBeenCalledWith(
      'csv',
      expect.stringContaining('# Cohort Retention Report')
    );

    const jsonBtn = screen.getByLabelText('Export JSON');
    fireEvent.click(jsonBtn);
    expect(handleExport).toHaveBeenCalledWith('json', expect.stringContaining('"ok": true'));
  });

  it('renders demo data when Demo Data button is clicked', () => {
    render(<CohortRetentionView activities={[]} />);

    const demoBtn = screen.getByLabelText('Refresh Demo Data');
    fireEvent.click(demoBtn);

    expect(screen.getByText('Total Tracked Cohorts')).toBeInTheDocument();
    expect(screen.getByText('Cohort Retention Matrix')).toBeInTheDocument();
  });
});
