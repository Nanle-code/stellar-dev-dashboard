/**
 * D-028 — Asset component stories.
 *
 * AssetCard and AssetDiscovery depend on Zustand store and live Horizon API calls.
 * Stories use static replicas to demonstrate all documented UI states without
 * network I/O, while referencing the real component file for import context.
 */
import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { TrendingUp, TrendingDown, Star, Plus, ExternalLink, Search, Filter, X } from 'lucide-react';

const meta: Meta = {
  title: 'Assets',
  parameters: {
    docs: {
      description: {
        component:
          'Asset discovery and display components. Real components live at `src/components/assets/`. These stories use isolated replicas to avoid Zustand / Horizon API dependencies.',
      },
    },
  },
};
export default meta;

// ─── Data fixtures ────────────────────────────────────────────────────────────

interface MockAsset {
  code: string;
  issuer: string;
  issuerShort: string;
  balance?: string;
  price?: number;
  change24h?: number;
  domain?: string;
  trusted?: boolean;
  popular?: boolean;
}

const ASSETS: MockAsset[] = [
  {
    code: 'XLM',
    issuer: 'native',
    issuerShort: 'Native',
    balance: '12,345.00',
    price: 0.1134,
    change24h: 3.21,
    domain: 'stellar.org',
    trusted: true,
    popular: true,
  },
  {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    issuerShort: 'Centre.io',
    balance: '500.00',
    price: 1.0001,
    change24h: 0.01,
    domain: 'centre.io',
    trusted: true,
    popular: true,
  },
  {
    code: 'yXLM',
    issuer: 'GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMEJCE4SGTSA',
    issuerShort: 'Ultra Capital',
    balance: '234.50',
    price: 0.1089,
    change24h: -1.42,
    domain: 'ultracapital.xyz',
    trusted: true,
    popular: false,
  },
  {
    code: 'SHX',
    issuer: 'GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH',
    issuerShort: 'Stronghold',
    balance: '1,000.00',
    price: 0.0023,
    change24h: -5.3,
    domain: 'stronghold.co',
    trusted: false,
    popular: false,
  },
];

// ─── AssetCard replica ────────────────────────────────────────────────────────

const AssetCardPreview = ({
  asset,
  compact = false,
}: {
  asset: MockAsset;
  compact?: boolean;
}) => {
  const isNative = asset.issuer === 'native';
  const positive = (asset.change24h ?? 0) >= 0;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        overflow: 'hidden',
        minWidth: compact ? '160px' : '220px',
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          height: '2px',
          background: positive ? 'var(--green)' : 'var(--red)',
          opacity: 0.7,
        }}
      />
      <div style={{ padding: compact ? '12px' : '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: compact ? '14px' : '16px',
                color: 'var(--text-primary)',
              }}
            >
              {asset.code}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
              {asset.issuerShort}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {!isNative && (
              <button
                title={asset.trusted ? 'Remove trustline' : 'Add trustline'}
                aria-label={asset.trusted ? 'Remove trustline' : 'Add trustline'}
                style={{
                  width: '28px',
                  height: '28px',
                  background: asset.trusted ? 'var(--cyan-glow, rgba(0,229,255,0.08))' : 'var(--bg-elevated)',
                  border: `1px solid ${asset.trusted ? 'var(--cyan-dim, rgba(0,229,255,0.3))' : 'var(--border)'}`,
                  borderRadius: '6px',
                  color: asset.trusted ? 'var(--cyan)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Star size={12} fill={asset.trusted ? 'currentColor' : 'none'} />
              </button>
            )}
          </div>
        </div>

        {/* Balance */}
        {asset.balance && (
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Balance
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: '2px',
              }}
            >
              {asset.balance}
            </div>
          </div>
        )}

        {/* Price + change */}
        {asset.price !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              ${asset.price.toFixed(4)}
            </span>
            {asset.change24h !== undefined && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: positive ? 'var(--green)' : 'var(--red)',
                  padding: '2px 6px',
                  background: positive ? 'var(--green-glow, rgba(34,197,94,0.08))' : 'var(--red-glow, rgba(239,68,68,0.08))',
                  borderRadius: '4px',
                }}
              >
                {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {positive ? '+' : ''}{asset.change24h.toFixed(2)}%
              </span>
            )}
          </div>
        )}

        {/* Domain link */}
        {asset.domain && !compact && (
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              fontSize: '10px',
              color: 'var(--cyan)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={10} />
            {asset.domain}
          </a>
        )}
      </div>
    </div>
  );
};

// ─── AssetCard stories ────────────────────────────────────────────────────────

export const AssetCardDefault: StoryObj = {
  name: 'AssetCard — Default',
  render: () => <AssetCardPreview asset={ASSETS[0]} />,
  parameters: {
    docs: { description: { story: 'Standard asset card with balance, price, and 24h change.' } },
  },
};

export const AssetCardPositive: StoryObj = {
  name: 'AssetCard — Positive Change',
  render: () => <AssetCardPreview asset={ASSETS[1]} />,
};

export const AssetCardNegative: StoryObj = {
  name: 'AssetCard — Negative Change',
  render: () => <AssetCardPreview asset={ASSETS[2]} />,
};

export const AssetCardUntrusted: StoryObj = {
  name: 'AssetCard — Untrusted Asset',
  render: () => <AssetCardPreview asset={ASSETS[3]} />,
  parameters: {
    docs: {
      description: {
        story:
          'Asset without an established trustline. The star button is unfilled to indicate it can be added.',
      },
    },
  },
};

export const AssetCardGrid: StoryObj = {
  name: 'AssetCard — Grid',
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '16px',
        maxWidth: '860px',
      }}
    >
      {ASSETS.map((a) => (
        <AssetCardPreview key={a.code} asset={a} />
      ))}
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Grid layout showing multiple asset cards.' } },
  },
};

export const AssetCardMobile: StoryObj = {
  name: 'AssetCard — Mobile',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {ASSETS.slice(0, 3).map((a) => (
        <AssetCardPreview key={a.code} asset={a} compact />
      ))}
    </div>
  ),
  parameters: {
    viewport: { defaultViewport: 'mobile375' },
    docs: { description: { story: 'Compact card layout for mobile viewports.' } },
  },
};

// ─── AssetDiscovery replica ───────────────────────────────────────────────────

const AssetDiscoveryPreview = ({
  loading = false,
  empty = false,
}: {
  loading?: boolean;
  empty?: boolean;
}) => {
  const [query, setQuery] = useState('');
  const filtered = empty
    ? []
    : ASSETS.filter(
        (a) =>
          a.code.toLowerCase().includes(query.toLowerCase()) ||
          a.issuerShort.toLowerCase().includes(query.toLowerCase()),
      );

  return (
    <div style={{ maxWidth: '620px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '20px',
            marginBottom: '4px',
          }}
        >
          Asset Discovery
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Search Stellar assets by code, issuer, or domain
        </div>
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code or issuer…"
            aria-label="Search assets"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          />
          {query && (
            <button
              aria-label="Clear search"
              onClick={() => setQuery('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          aria-label="Filter assets"
          style={{
            padding: '8px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
          }}
        >
          <Filter size={13} />
          Filter
        </button>
      </div>

      {/* Results */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div className="spinner" />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Searching assets…</span>
          </div>
        ) : empty || filtered.length === 0 ? (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Search size={32} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              No assets found
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Try a different search term or check the asset code.
            </div>
          </div>
        ) : (
          filtered.map((asset, i) => (
            <div
              key={asset.code}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px',
                  color: 'var(--cyan)',
                  flexShrink: 0,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {asset.code.slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>{asset.code}</span>
                  {asset.trusted && (
                    <Star size={10} style={{ color: 'var(--cyan)' }} fill="currentColor" />
                  )}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {asset.issuerShort}
                </div>
              </div>
              {asset.price !== undefined && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    ${asset.price.toFixed(4)}
                  </div>
                  {asset.change24h !== undefined && (
                    <div
                      style={{
                        fontSize: '10px',
                        color: asset.change24h >= 0 ? 'var(--green)' : 'var(--red)',
                      }}
                    >
                      {asset.change24h >= 0 ? '+' : ''}
                      {asset.change24h.toFixed(2)}%
                    </div>
                  )}
                </div>
              )}
              {!asset.trusted && asset.issuer !== 'native' && (
                <button
                  aria-label={`Add trustline for ${asset.code}`}
                  style={{
                    padding: '5px 10px',
                    background: 'var(--cyan-glow, rgba(0,229,255,0.08))',
                    border: '1px solid var(--cyan-dim, rgba(0,229,255,0.3))',
                    borderRadius: '6px',
                    color: 'var(--cyan)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                  }}
                >
                  <Plus size={11} />
                  Trust
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const AssetDiscoveryDefault: StoryObj = {
  name: 'AssetDiscovery — Default',
  render: () => <AssetDiscoveryPreview />,
  parameters: {
    docs: {
      description: {
        story:
          'Asset discovery panel with a live-filtered search. Real component at `src/components/assets/AssetDiscovery.jsx`.',
      },
    },
  },
};

export const AssetDiscoveryLoading: StoryObj = {
  name: 'AssetDiscovery — Loading',
  render: () => <AssetDiscoveryPreview loading />,
};

export const AssetDiscoveryEmpty: StoryObj = {
  name: 'AssetDiscovery — No Results',
  render: () => <AssetDiscoveryPreview empty />,
  parameters: {
    docs: { description: { story: 'Empty state when no assets match the search query.' } },
  },
};

export const AssetDiscoveryMobile: StoryObj = {
  name: 'AssetDiscovery — Mobile',
  render: () => <AssetDiscoveryPreview />,
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};
