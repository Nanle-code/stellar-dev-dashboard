import React, { useState, useEffect } from 'react';
import { useStore } from '../../../lib/store';
import WidgetBase from './WidgetBase';
import { useErrorHandler } from '../../../hooks/useErrorHandler';

export interface BaseWidgetProps {
  onRefresh?: () => void;
}

export interface PriceData {
  xlm: {
    price: number;
    change24h: number;
    volume24h: number;
  };
}

export default function PriceTickerWidget({ onRefresh }: BaseWidgetProps) {
  const { network } = useStore();
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { handleError } = useErrorHandler('PriceTickerWidget');

  const fetchPriceData = async () => {
    if (network !== 'mainnet') return; // Only show prices for mainnet

    try {
      setLoading(true);
      // Mock price data - in a real app, you'd fetch from a price API
      const mockData: PriceData = {
        xlm: {
          price: 0.1234,
          change24h: 2.45,
          volume24h: 12345678
        }
      };
      setPriceData(mockData);
    } catch (error) {
      handleError(error, { network });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPriceData();
    const interval = setInterval(fetchPriceData, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [network]);

  const handleRefresh = () => {
    fetchPriceData();
    onRefresh?.();
  };

  if (network !== 'mainnet') {
    return (
      <WidgetBase
        title="Price Ticker"
        subtitle="Mainnet only"
        icon="💹"
        onRefresh={handleRefresh}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center',
          padding: '20px'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🌐</div>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '4px'
          }}>
            Testnet Mode
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: 1.4
          }}>
            Price data is only available on mainnet
          </div>
        </div>
      </WidgetBase>
    );
  }

  return (
    <WidgetBase
      title="XLM Price"
      subtitle="Live market data"
      icon="💹"
      onRefresh={handleRefresh}
      loading={loading}
    >
      {priceData ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          height: '100%',
          justifyContent: 'center'
        }}>
          {/* Current Price */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '28px',
              fontWeight: 800,
              color: 'var(--cyan)',
              fontFamily: 'var(--font-mono)',
              marginBottom: '4px'
            }}>
              ${priceData.xlm.price.toFixed(4)}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              USD per XLM
            </div>
          </div>

          {/* 24h Change */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: priceData.xlm.change24h >= 0 ? 'var(--green-glow-sm)' : 'var(--red-glow-sm)',
            border: `1px solid ${priceData.xlm.change24h >= 0 ? 'var(--green)' : 'var(--red)'}`,
            borderRadius: 'var(--radius-md)'
          }}>
            <span style={{ fontSize: '14px' }}>
              {priceData.xlm.change24h >= 0 ? '📈' : '📉'}
            </span>
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: priceData.xlm.change24h >= 0 ? 'var(--green)' : 'var(--red)',
              fontFamily: 'var(--font-mono)'
            }}>
              {priceData.xlm.change24h >= 0 ? '+' : ''}{priceData.xlm.change24h.toFixed(2)}%
            </span>
            <span style={{
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}>
              24h
            </span>
          </div>

          {/* Volume */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderTop: '1px solid var(--border)',
            fontSize: '12px'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              24h Volume:
            </span>
            <span style={{
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)'
            }}>
              ${(priceData.xlm.volume24h / 1000000).toFixed(1)}M
            </span>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>💹</div>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '4px'
          }}>
            No Price Data
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: 1.4
          }}>
            Unable to fetch current market data
          </div>
        </div>
      )}
    </WidgetBase>
  );
}