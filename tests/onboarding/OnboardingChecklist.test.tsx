import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import OnboardingChecklist from './OnboardingChecklist';

describe('OnboardingChecklist', () => {
  it('renders primary flow correctly', () => {
    render(<OnboardingChecklist state={{ walletConnected: false, faucetFunded: false, firstTxSent: false }} onAction={jest.fn()} />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('handles action failure', async () => {
    const onAction = jest.fn().mockRejectedValue(new Error('Network error'));
    render(<OnboardingChecklist state={{ walletConnected: false, faucetFunded: false, firstTxSent: false }} onAction={onAction} />);
    
    fireEvent.click(screen.getByTestId('btn-wallet'));
    await waitFor(() => {
      expect(screen.getByTestId('checklist-error')).toHaveTextContent('Network error');
    });
  });

  it('disables subsequent steps boundary case', () => {
    render(<OnboardingChecklist state={{ walletConnected: false, faucetFunded: false, firstTxSent: false }} onAction={jest.fn()} />);
    expect(screen.getByTestId('btn-faucet')).toBeDisabled();
    expect(screen.getByTestId('btn-tx')).toBeDisabled();
  });
});
