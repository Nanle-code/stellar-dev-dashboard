import { render, screen } from '@testing-library/react';
import React from 'react';
import OrderBookHeatmap from './OrderBookHeatmap';

describe('OrderBookHeatmap', () => {
  it('renders primary flow correctly', () => {
    const bids = [{ price: 10, amount: 100 }];
    const asks = [{ price: 11, amount: 50 }];
    render(<OrderBookHeatmap bids={bids} asks={asks} />);
    
    expect(screen.getByText('10.0000')).toBeInTheDocument();
    expect(screen.getByText('11.0000')).toBeInTheDocument();
  });

  it('handles boundary case (empty book)', () => {
    render(<OrderBookHeatmap bids={[]} asks={[]} />);
    expect(screen.getByTestId('heatmap-empty')).toBeInTheDocument();
  });

  it('handles failure case (error message provided)', () => {
    render(<OrderBookHeatmap bids={[]} asks={[]} error="Failed to fetch book" />);
    expect(screen.getByTestId('heatmap-error')).toHaveTextContent('Failed to fetch book');
  });
});
