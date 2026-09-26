import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FeeStrategyComparisonPanel from '../../../src/components/dashboard/FeeStrategyComparisonPanel';

const VALID_SOURCE_ACCOUNT = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const VALID_DESTINATION = 'GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2G6EXO2Z6EBVEW5UJTBES';

describe('FeeStrategyComparisonPanel UI Component', () => {
  const defaultParams = {
    sourceAccount: VALID_SOURCE_ACCOUNT,
    operations: [
      {
        type: 'payment',
        destination: VALID_DESTINATION,
        amount: '25',
      },
    ],
    memo: 'Test Memo',
    network: 'testnet',
  };

  it('renders the comparison panel with low, medium, and high strategy cards', async () => {
    render(<FeeStrategyComparisonPanel transactionParams={defaultParams} />);

    expect(screen.getByText('Fee Strategy Dry-Run Comparison')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('strategy-card-low')).toBeDefined();
      expect(screen.getByTestId('strategy-card-medium')).toBeDefined();
      expect(screen.getByTestId('strategy-card-high')).toBeDefined();
    });

    expect(screen.getByText('Low (Economy)')).toBeDefined();
    expect(screen.getByText('Medium (Standard)')).toBeDefined();
    expect(screen.getByText('High (Priority)')).toBeDefined();
  });

  it('allows user to select and apply a strategy via callback', async () => {
    const onApplyFee = vi.fn();
    const onSelectStrategy = vi.fn();

    render(
      <FeeStrategyComparisonPanel
        transactionParams={defaultParams}
        onApplyFee={onApplyFee}
        onSelectStrategy={onSelectStrategy}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('apply-strategy-btn-high')).toBeDefined();
    });

    const highApplyBtn = screen.getByTestId('apply-strategy-btn-high');
    fireEvent.click(highApplyBtn);

    expect(onApplyFee).toHaveBeenCalled();
    expect(onApplyFee.mock.calls[0][1]).toBe('high');
    expect(onSelectStrategy).toHaveBeenCalled();
    expect(onSelectStrategy.mock.calls[0][0].tier).toBe('high');
  });

  it('updates congestion load using the interactive slider', async () => {
    render(<FeeStrategyComparisonPanel transactionParams={defaultParams} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Simulated Network Congestion/i)).toBeDefined();
    });

    const slider = screen.getByLabelText(/Simulated Network Congestion/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '1.2' } });

    await waitFor(() => {
      expect(screen.getByText(/120%/)).toBeDefined();
    });
  });

  it('displays validation errors when transaction parameters are invalid', async () => {
    render(
      <FeeStrategyComparisonPanel
        transactionParams={{
          sourceAccount: 'invalid-key',
          operations: [],
          network: 'testnet',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('validation-errors-banner')).toBeDefined();
    });

    expect(screen.getByText(/Source account is not a valid ed25519 public key/i)).toBeDefined();
    expect(screen.getByText(/At least one operation is required/i)).toBeDefined();
  });
});
