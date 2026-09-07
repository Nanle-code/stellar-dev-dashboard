import React from 'react';
import {
  getAssetTrustlineStatus,
  type AssetAuthorizationFlags,
  type TrustlineAuthorizationFlags,
} from '../../lib/assetTrustlineValidation';

export interface AssetTrustStatusProps {
  issuer?: string | null;
  flags?: AssetAuthorizationFlags | null;
  trustline?: TrustlineAuthorizationFlags | null;
  showValidIssuer?: boolean;
}

const COLORS = {
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
  muted: 'var(--text-muted)',
};

function Badge({ label, title, color }: { label: string; title: string; color: string }) {
  return (
    <span
      title={title}
      aria-label={`${label}: ${title}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${color}`,
        background: 'var(--bg-elevated)',
        color,
        fontSize: '10px',
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

export default function AssetTrustStatus({
  issuer,
  flags,
  trustline,
  showValidIssuer = true,
}: AssetTrustStatusProps) {
  const status = getAssetTrustlineStatus({ issuer, flags, trustline });
  const authorization = {
    'not-required': null,
    required: { label: 'AUTHORIZATION REQUIRED', color: COLORS.amber },
    authorized: { label: 'AUTHORIZED', color: COLORS.green },
    'maintain-liabilities': { label: 'MAINTAIN LIABILITIES ONLY', color: COLORS.amber },
    unauthorized: { label: 'UNAUTHORIZED', color: COLORS.red },
  }[status.authorization.state];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {(showValidIssuer || status.issuer.state !== 'valid') && (
        <Badge
          label={
            status.issuer.state === 'valid'
              ? 'VALID ISSUER'
              : status.issuer.state === 'missing'
                ? 'MISSING ISSUER'
                : 'INVALID ISSUER'
          }
          title={status.issuer.message}
          color={status.issuer.state === 'valid' ? COLORS.green : COLORS.red}
        />
      )}
      {authorization && (
        <Badge
          label={authorization.label}
          title={status.authorization.message}
          color={authorization.color}
        />
      )}
      {status.clawbackEnabled && (
        <Badge
          label="CLAWBACK ENABLED"
          title="The issuer can reclaim this asset from holder trustlines."
          color={COLORS.red}
        />
      )}
    </div>
  );
}
