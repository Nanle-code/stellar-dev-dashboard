import React, { useMemo } from 'react';

export interface OrderLevel {
  price: number;
  amount: number;
}

export default function OrderBookHeatmap({ 
  bids, 
  asks, 
  error 
}: { 
  bids: OrderLevel[], 
  asks: OrderLevel[], 
  error?: string 
}) {
  const maxVolume = useMemo(() => {
    const allAmounts = [...bids, ...asks].map(o => o.amount);
    return allAmounts.length ? Math.max(...allAmounts) : 1;
  }, [bids, asks]);

  if (error) {
    return <div data-testid="heatmap-error" style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (bids.length === 0 && asks.length === 0) {
    return <div data-testid="heatmap-empty">No order book data available.</div>;
  }

  return (
    <div className="orderbook-heatmap" style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
      {asks.map((ask, i) => {
        const width = (ask.amount / maxVolume) * 100;
        return (
          <div key={`ask-${i}`} style={{ display: 'flex', justifyContent: 'space-between', background: `linear-gradient(to left, #ef444433 ${width}%, transparent ${width}%)` }}>
            <span style={{ color: '#ef4444' }}>{ask.price.toFixed(4)}</span>
            <span>{ask.amount.toFixed(2)}</span>
          </div>
        );
      })}
      <div style={{ height: '1px', background: '#4b5563', margin: '4px 0' }} />
      {bids.map((bid, i) => {
        const width = (bid.amount / maxVolume) * 100;
        return (
          <div key={`bid-${i}`} style={{ display: 'flex', justifyContent: 'space-between', background: `linear-gradient(to left, #22c55e33 ${width}%, transparent ${width}%)` }}>
            <span style={{ color: '#22c55e' }}>{bid.price.toFixed(4)}</span>
            <span>{bid.amount.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}
