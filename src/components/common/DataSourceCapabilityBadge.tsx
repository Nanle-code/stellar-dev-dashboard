import React from 'react';
import { Database, Cpu } from 'lucide-react';
import { evaluateReadSourceCapabilities, NetworkName } from '../../lib/stellar';

interface DataSourceCapabilityBadgeProps {
  network?: NetworkName;
  activeSource?: 'rpc' | 'horizon';
  fallbackUsed?: boolean;
  showCapabilities?: boolean;
}

export const DataSourceCapabilityBadge: React.FC<DataSourceCapabilityBadgeProps> = ({
  network = 'testnet',
  activeSource = 'rpc',
  fallbackUsed = false,
  showCapabilities = false,
}) => {
  const readSourceInfo = evaluateReadSourceCapabilities(network);
  const caps = readSourceInfo.capabilities;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        padding: '4px 10px',
        borderRadius: 'var(--radius-md, 6px)',
        background: fallbackUsed
          ? 'rgba(245, 158, 11, 0.12)'
          : activeSource === 'rpc'
            ? 'rgba(6, 182, 212, 0.12)'
            : 'rgba(59, 130, 246, 0.12)',
        border: `1px solid ${
          fallbackUsed
            ? 'rgba(245, 158, 11, 0.3)'
            : activeSource === 'rpc'
              ? 'rgba(6, 182, 212, 0.3)'
              : 'rgba(59, 130, 246, 0.3)'
        }`,
        color: fallbackUsed
          ? 'var(--amber, #f59e0b)'
          : activeSource === 'rpc'
            ? 'var(--cyan, #06b6d4)'
            : 'var(--text-primary, #f8fafc)',
      }}
      title={`Active Data Layer: ${activeSource.toUpperCase()} ${
        fallbackUsed ? '(Horizon Fallback Active)' : ''
      }`}
    >
      {activeSource === 'rpc' ? <Cpu size={13} /> : <Database size={13} />}
      <span>
        Source: {activeSource.toUpperCase()}
        {fallbackUsed && ' (Fallback)'}
      </span>

      {showCapabilities && (
        <div style={{ display: 'flex', gap: '4px', marginLeft: '4px', opacity: 0.85 }}>
          <span
            title={caps.accountOffers ? 'Account Offers Supported (Horizon)' : 'Account Offers Unsupported on RPC-only'}
            style={{
              padding: '1px 5px',
              borderRadius: '4px',
              background: caps.accountOffers ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: caps.accountOffers ? '#4ade80' : '#f87171',
              fontSize: '10px',
            }}
          >
            {caps.accountOffers ? 'Offers ✓' : 'Offers ✗ (RPC-only)'}
          </span>
        </div>
      )}
    </div>
  );
};

export default DataSourceCapabilityBadge;
