import React from 'react';
import { Clock, ShieldAlert } from 'lucide-react';

interface RpcRetentionBannerProps {
  retentionLimitLedgers?: number;
  retentionLimitReached?: boolean;
  onSwitchToHorizon?: () => void;
}

export const RpcRetentionBanner: React.FC<RpcRetentionBannerProps> = ({
  retentionLimitLedgers = 100_000,
  retentionLimitReached = false,
  onSwitchToHorizon,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        marginBottom: '12px',
        borderRadius: 'var(--radius-md, 8px)',
        background: retentionLimitReached ? 'rgba(239, 68, 68, 0.1)' : 'rgba(6, 182, 212, 0.08)',
        border: `1px solid ${retentionLimitReached ? 'rgba(239, 68, 68, 0.3)' : 'rgba(6, 182, 212, 0.25)'}`,
        color: retentionLimitReached ? 'var(--red, #ef4444)' : 'var(--text-secondary, #94a3b8)',
        fontSize: '12px',
        fontFamily: 'var(--font-sans, sans-serif)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {retentionLimitReached ? <ShieldAlert size={16} /> : <Clock size={16} style={{ color: 'var(--cyan, #06b6d4)' }} />}
        <span>
          {retentionLimitReached ? (
            <strong>
              Stellar RPC retention window limit reached (~{retentionLimitLedgers.toLocaleString()} ledgers). Historical data beyond this window is not retained by RPC nodes.
            </strong>
          ) : (
            <>
              <strong>Stellar RPC Data Source:</strong> Retains recent network history (~
              {retentionLimitLedgers.toLocaleString()} ledgers window). Full historical queries automatically fallback to Horizon.
            </>
          )}
        </span>
      </div>

      {onSwitchToHorizon && (
        <button
          onClick={onSwitchToHorizon}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            borderRadius: '4px',
            background: 'var(--cyan-glow, rgba(6, 182, 212, 0.15))',
            border: '1px solid var(--cyan, #06b6d4)',
            color: 'var(--cyan, #06b6d4)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          Use Horizon
        </button>
      )}
    </div>
  );
};

export default RpcRetentionBanner;
