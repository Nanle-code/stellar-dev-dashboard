import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Analytics from '../Analytics';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useTablePresets } from '../../hooks/useTablePresets';

// Mock the hooks
vi.mock('../../hooks/useAnalytics');
vi.mock('../../hooks/useTablePresets');

describe('Analytics Component with EnhancedTable', () => {
  const mockAnalytics = {
    account: {
      xlmBalance: 1000.5,
      trustlineCount: 5,
      totalAssets: 3,
      nonNativeBalanceCount: 2,
    },
    transactions: {
      totalTransactions: 100,
      successfulTransactions: 95,
      failedTransactions: 5,
      successRate: 0.95,
      weeklyActivity: 25,
      averageOperationsPerTx: 2.5,
      opTypeCounts: {
        payment: 50,
        create_account: 20,
        manage_buy_offer: 15,
        manage_sell_offer: 10,
        path_payment: 5,
      },
    },
    network: {
      latestLedgerSequence: 50000,
      baseFee: 100,
      p90Fee: 500,
      txSuccessCount: 1000,
      txFailedCount: 50,
      operationCount: 2500,
      averageCloseSeconds: 3.5,
    },
    risks: [
      { id: 'risk1', label: 'High transaction volume', active: true, severity: 'high' },
      { id: 'risk2', label: 'Unusual pattern', active: false, severity: 'medium' },
      { id: 'risk3', label: 'Normal activity', active: false, severity: 'low' },
    ],
    activity: [],
  };

  const mockRiskPresets = {
    presets: [],
    visibleColumns: ['label', 'severity', 'status'],
    density: 'comfortable',
    setVisibleColumns: vi.fn(),
    setDensity: vi.fn(),
    onPresetSave: vi.fn(),
    onPresetDelete: vi.fn(),
    onPresetApply: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAnalytics as any).mockReturnValue(mockAnalytics);
    (useTablePresets as any).mockReturnValue(mockRiskPresets);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render analytics with enhanced table controls', () => {
    render(<Analytics />);

    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('XLM Balance')).toBeInTheDocument();
    expect(screen.getByText('Trustlines')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('Weekly Activity')).toBeInTheDocument();
  });

  it('should display risk signals in table format', () => {
    render(<Analytics />);

    expect(screen.getByText('Risk Signals')).toBeInTheDocument();
    expect(screen.getByText('High transaction volume')).toBeInTheDocument();
    expect(screen.getByText('Unusual pattern')).toBeInTheDocument();
    expect(screen.getByText('Normal activity')).toBeInTheDocument();
  });

  it('should render table density controls', () => {
    render(<Analytics />);

    // Check for density toggle button (Settings icon)
    const densityButtons = screen.getAllByRole('button');
    const densityButton = densityButtons.find(btn => btn.textContent?.includes('comfortable'));
    expect(densityButton).toBeInTheDocument();
  });

  it('should render column visibility controls', () => {
    render(<Analytics />);

    // Check for column toggle button
    const columnButtons = screen.getAllByRole('button');
    const columnButton = columnButtons.find(btn => btn.textContent?.includes('Columns'));
    expect(columnButton).toBeInTheDocument();
  });

  it('should render preset controls', () => {
    render(<Analytics />);

    // Check for preset button
    const presetButtons = screen.getAllByRole('button');
    const presetButton = presetButtons.find(btn => btn.textContent?.includes('Presets'));
    expect(presetButton).toBeInTheDocument();
  });

  it('should display severity badges with correct colors', () => {
    render(<Analytics />);

    const highSeverity = screen.getByText('HIGH');
    const mediumSeverity = screen.getByText('MEDIUM');
    const lowSeverity = screen.getByText('LOW');

    expect(highSeverity).toBeInTheDocument();
    expect(mediumSeverity).toBeInTheDocument();
    expect(lowSeverity).toBeInTheDocument();
  });

  it('should display network statistics', () => {
    render(<Analytics />);

    expect(screen.getByText('Latest Ledger')).toBeInTheDocument();
    expect(screen.getByText('50000')).toBeInTheDocument();
    expect(screen.getByText('Base Fee')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Avg Close Time')).toBeInTheDocument();
    expect(screen.getByText('3.50s')).toBeInTheDocument();
  });
});