import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const storeState: Record<string, unknown> = {};
vi.mock('../../../lib/store', () => ({
  useStore: () => storeState,
}));

import ContextualEmptyState from '../ContextualEmptyState';

describe('ContextualEmptyState (#876)', () => {
  let setActiveTab: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActiveTab = vi.fn();
    for (const key of Object.keys(storeState)) delete storeState[key];
    Object.assign(storeState, { network: 'testnet', activeTab: 'overview', setActiveTab });
  });

  it('renders preset copy and navigates to the suggested tool (primary flow)', () => {
    render(<ContextualEmptyState context="noPools" />);

    expect(screen.getByRole('status')).toHaveAttribute('data-context', 'noPools');
    expect(screen.getByText('No liquidity pools found')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Suggested next steps' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Browse the DEX/ }));
    expect(setActiveTab).toHaveBeenCalledWith('dex');
  });

  it('runs in-page handlers before preset actions', () => {
    const onSelect = vi.fn();
    render(
      <ContextualEmptyState
        context="noPools"
        extraActions={[{ label: 'Go to Discover', onSelect }]}
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('Go to Discover');
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('respects title/description overrides and maxActions (boundary)', () => {
    render(
      <ContextualEmptyState context="noPools" title="Custom" description="Custom description" maxActions={1} />,
    );
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('Custom description')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('omits the faucet on mainnet (unsupported environment)', () => {
    storeState.network = 'mainnet';
    render(<ContextualEmptyState context="walletRequired" />);
    expect(screen.getByRole('button', { name: /Connect a wallet/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Fund a test account/ })).not.toBeInTheDocument();
  });

  it('shows a fallback hint when every suggestion is unavailable', () => {
    render(<ContextualEmptyState actions={[{ label: 'Ghost', routeId: 'not-a-route' }]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('contextual-empty-state-fallback')).toBeInTheDocument();
  });

  it('renders no fallback for presets that intentionally have no actions', () => {
    render(<ContextualEmptyState context="noPoolSelected" />);
    expect(screen.queryByTestId('contextual-empty-state-fallback')).not.toBeInTheDocument();
  });

  it('falls back to the generic preset for an unknown context', () => {
    render(<ContextualEmptyState context={'bogus' as never} />);
    expect(screen.getByText('Nothing to show yet')).toBeInTheDocument();
  });

  it('surfaces an inline alert when an action throws (failure path)', () => {
    const onSelect = vi.fn(() => {
      throw new Error('boom');
    });
    render(<ContextualEmptyState actions={[{ label: 'Explode', onSelect }]} />);

    fireEvent.click(screen.getByRole('button', { name: /Explode/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn\'t open "Explode"');
  });

  it('surfaces an inline alert when navigation is unavailable (failure path)', () => {
    delete storeState.setActiveTab;
    render(<ContextualEmptyState context="noPools" />);

    fireEvent.click(screen.getByRole('button', { name: /Browse the DEX/ }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
