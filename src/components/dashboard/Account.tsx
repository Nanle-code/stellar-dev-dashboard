import React, { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import type { Horizon } from '@stellar/stellar-sdk';
import { useStore } from '../../lib/store';
import {
  shortAddress,
  formatXLM,
  fetchAccountCreationDate,
  fetchAccountOffers,
  calculateAccountReserves,
} from '../../lib/stellar';
import { accountRequests, AccountLanes, isCancellation } from '../../lib/requestCancellation';
import CopyableValue from './CopyableValue';
import useAssetUsdEstimates, { formatEstimatedUsd } from '../../hooks/useAssetUsdEstimates';
import AddressLabelBadge from '../addressLabels/AddressLabelBadge';
import AssetTrustStatus from '../assets/AssetTrustStatus';
import type { AccountOffer, ReservesInfo, InfoRowProps } from './types';

function formatAsset(assetType: string, assetCode?: string): string {
  if (assetType === 'native') return 'XLM';
  return assetCode || 'Unknown';
}

function InfoRow({ label, value, mono = true, accent, copyValue, secondaryValue }: InfoRowProps) {
  const textStyle: React.CSSProperties = {
    fontSize: '12px',
    color: accent || 'var(--text-primary)',
    fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
    wordBreak: 'break-all',
    textAlign: 'right',
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '16px',
        padding: '10px 18px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '4px',
          minWidth: 0,
        }}
      >
        {copyValue ? (
          <CopyableValue value={copyValue} textStyle={textStyle}>
            {value ?? '—'}
          </CopyableValue>
        ) : (
          <span style={textStyle}>{value ?? '—'}</span>
        )}
        {secondaryValue && (
          <span
            style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {secondaryValue}
          </span>
        )}
      </div>
    </div>
  );
}

function DataSourceBadge({ dataSource, offline }: { dataSource?: string; offline?: boolean }) {
  if (!offline && (!dataSource || dataSource === 'live')) return null;
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        background: dataSource === 'cache-stale' ? 'var(--amber-glow)' : 'var(--bg-elevated)',
        color: dataSource === 'cache-stale' ? 'var(--amber)' : 'var(--text-muted)',
        border: `1px solid ${dataSource === 'cache-stale' ? 'var(--amber)' : 'var(--border)'}`,
      }}
    >
      {offline ? 'Offline' : dataSource}
    </span>
  );
}

export default function Account() {
  const { accountData, connectedAddress, network, networkStats } = useStore();
  const [offers, setOffers] = useState<AccountOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [createdAtLoading, setCreatedAtLoading] = useState(false);

  const reserves = useMemo<ReservesInfo | null>(() => {
    if (!accountData) return null;
    return calculateAccountReserves(accountData, networkStats, offers.length);
  }, [accountData, networkStats, offers.length]);

  useEffect(() => {
    if (!connectedAddress) {
      // No account selected: cancel anything still loading for the previous one.
      accountRequests.abort(AccountLanes.Offers);
      accountRequests.abort(AccountLanes.CreationDate);
      setOffers([]);
      setOffersLoading(false);
      setOffersError(null);
      setCreatedAt(null);
      setCreatedAtLoading(false);
      return;
    }

    // Starting these lanes cancels the reads for the previously selected account
    // or network, so their slower responses can no longer land here (Issue #745).
    const creationLease = accountRequests.begin(AccountLanes.CreationDate);
    const offersLease = accountRequests.begin(AccountLanes.Offers);

    setOffersLoading(true);
    setOffersError(null);
    setCreatedAtLoading(true);
    setCreatedAt(null);

    fetchAccountCreationDate(connectedAddress, network, { signal: creationLease.signal })
      .then((date) => {
        creationLease.commit(() => setCreatedAt(date ? new Date(date) : null));
      })
      .catch((err) => {
        if (isCancellation(err)) return;
        creationLease.commit(() => setCreatedAt(null));
      })
      .finally(() => {
        creationLease.commit(() => setCreatedAtLoading(false));
      });

    fetchAccountOffers(connectedAddress, network, { signal: offersLease.signal })
      .then((res) => {
        offersLease.commit(() => setOffers(res as AccountOffer[]));
      })
      .catch((err: Error) => {
        if (isCancellation(err)) return;
        offersLease.commit(() => setOffersError(err.message));
      })
      .finally(() => {
        offersLease.commit(() => setOffersLoading(false));
      });

    return () => {
      creationLease.abort();
      offersLease.abort();
    };
  }, [connectedAddress, network]);

  if (!accountData)
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No account loaded
      </div>
    );

  const xlm = accountData.balances?.find((b: { asset_type: string }) => b.asset_type === 'native');
  const otherAssets =
    accountData.balances?.filter((b: { asset_type: string }) => b.asset_type !== 'native') || [];
  const signers = accountData.signers || [];
  const flags = accountData.flags || {};
  const thresholds = accountData.thresholds || {};
  const createdValue = createdAtLoading
    ? 'Loading...'
    : createdAt
      ? format(new Date(createdAt), 'MMM d, yyyy')
      : 'Unknown';
  const { getEstimate } = useAssetUsdEstimates({
    balances: accountData?.balances || [],
    connectedAddress,
    network,
    refreshKey: accountData,
  });
  const xlmEstimate = xlm ? getEstimate(xlm) : null;
  const offline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  const dataSource = 'live';
  const accountCachedAt: number | null = null;

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>
          Account Detail
        </div>
        <DataSourceBadge dataSource={dataSource} offline={offline} />
      </div>

      {offline && accountData && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '12px 16px',
            background: dataSource === 'cache-stale' ? 'var(--amber-glow)' : 'var(--bg-elevated)',
            border: `1px solid ${dataSource === 'cache-stale' ? 'var(--amber)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            color: dataSource === 'cache-stale' ? 'var(--amber)' : 'var(--text-muted)',
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontSize: '16px', flexShrink: 0 }}>
            {dataSource === 'cache-stale' ? '⚠' : 'ℹ'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                color: dataSource === 'cache-stale' ? 'var(--amber)' : 'var(--text-secondary)',
                marginBottom: '2px',
              }}
            >
              {dataSource === 'cache-stale' ? 'Using stale cached data' : 'Offline read-only mode'}
            </div>
            <div>
              {dataSource === 'cache-stale'
                ? 'Cached account data is older than 5 minutes. All write actions are disabled. Reconnect to refresh.'
                : 'Displaying last-known cached account data. Write actions (faucet, contract invocation, transaction submission) are blocked until reconnected.'}
            </div>
            {accountCachedAt && (
              <div
                style={{
                  marginTop: '4px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Last cached: {format(new Date(accountCachedAt), 'MMM d, yyyy HH:mm:ss')}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          Identity
        </div>
        <InfoRow
          label="Public Key"
          value={connectedAddress}
          copyValue={connectedAddress ?? undefined}
        />
        <InfoRow
          label="Account ID"
          value={accountData.account_id}
          copyValue={accountData.account_id}
        />
        <InfoRow label="Sequence" value={accountData.sequence} />
        <InfoRow label="Created" value={createdValue} mono={false} />
        <InfoRow
          label="XLM Balance"
          value={xlm ? formatXLM(xlm.balance) + ' XLM' : '—'}
          accent="var(--cyan)"
          secondaryValue={xlmEstimate ? `Est. ${formatEstimatedUsd(xlmEstimate.usd)}` : null}
        />
        <InfoRow label="Subentry Count" value={accountData.subentry_count} />
        <div style={{ padding: '10px 18px' }}>
          <a
            href={`https://stellar.expert/explorer/${network}/account/${connectedAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '12px',
              color: 'var(--cyan)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            View on Stellar Expert ↗
          </a>
        </div>
      </div>

      {reserves && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            Reserve Breakdown
          </div>
          <InfoRow label="Base Reserve" value={formatXLM(reserves.baseReserve) + ' XLM'} />
          <InfoRow label="Signer Reserve" value={formatXLM(reserves.signerReserve) + ' XLM'} />
          <InfoRow label="Asset Reserve" value={formatXLM(reserves.assetReserve) + ' XLM'} />
          <InfoRow label="Offer Reserve" value={formatXLM(reserves.offerReserve) + ' XLM'} />
          <InfoRow label="Subentry Reserve" value={formatXLM(reserves.subentryReserve) + ' XLM'} />
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                }}
              >
                Total Locked
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--amber)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                }}
              >
                {formatXLM(reserves.totalReserves)} XLM
              </span>
            </div>
          </div>
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--cyan-glow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                }}
              >
                Available Spendable
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--cyan)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                }}
              >
                {formatXLM(reserves.availableBalance)} XLM
              </span>
            </div>
          </div>
          <div style={{ padding: '10px 18px' }}>
            <a
              href="https://developers.stellar.org/docs/glossary/fees/#minimum-balance"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '12px',
                color: 'var(--cyan)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Learn about Stellar reserves ↗
            </a>
          </div>
        </div>
      )}

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          Asset Balances
        </div>
        {otherAssets.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: '12px', color: 'var(--text-muted)' }}>
            No non-native assets
          </div>
        ) : (
          otherAssets.map((asset: Horizon.BalanceLine, index: number) => {
            const estimate = getEstimate(asset);

            return (
              <div
                key={`${asset.asset_type}:${(asset as Horizon.BalanceLineAsset).asset_code}:${(asset as Horizon.BalanceLineAsset).asset_issuer}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '12px 18px',
                  borderBottom: index < otherAssets.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatAsset(asset.asset_type, (asset as Horizon.BalanceLineAsset).asset_code)}
                  </div>
                  {(asset as Horizon.BalanceLineAsset).asset_issuer && (
                    <CopyableValue
                      value={(asset as Horizon.BalanceLineAsset).asset_issuer}
                      title="Copy asset issuer public key"
                      containerStyle={{
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        marginTop: '4px',
                        fontFamily: 'var(--font-mono)',
                      }}
                      textStyle={{
                        maxWidth: '220px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <AddressLabelBadge
                        address={(asset as Horizon.BalanceLineAsset).asset_issuer}
                      />
                      {shortAddress((asset as Horizon.BalanceLineAsset).asset_issuer)}
                    </CopyableValue>
                  )}
                  <div style={{ marginTop: '6px' }}>
                    <AssetTrustStatus
                      issuer={(asset as Horizon.BalanceLineAsset).asset_issuer}
                      trustline={{
                        is_authorized: (asset as Horizon.BalanceLineAsset).is_authorized,
                        is_authorized_to_maintain_liabilities: (asset as Horizon.BalanceLineAsset)
                          .is_authorized_to_maintain_liabilities,
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '4px',
                  }}
                >
                  <span
                    style={{
                      color: 'var(--cyan)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                    }}
                  >
                    {formatXLM(asset.balance)}
                  </span>
                  {estimate && (
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                      }}
                    >
                      Est. {formatEstimatedUsd(estimate.usd)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          Thresholds
        </div>
        <InfoRow label="Low" value={thresholds.low_threshold} />
        <InfoRow label="Medium" value={thresholds.med_threshold} />
        <InfoRow label="High" value={thresholds.high_threshold} />
      </div>

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          Flags
        </div>
        {Object.entries(flags).map(([key, val]) => (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 18px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
              }}
            >
              {key.replace(/_/g, ' ')}
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '3px',
                background: val ? 'var(--green-glow)' : 'var(--bg-elevated)',
                border: `1px solid ${val ? 'var(--green)' : 'var(--border)'}`,
                color: val ? 'var(--green)' : 'var(--text-muted)',
              }}
            >
              {val ? 'TRUE' : 'FALSE'}
            </span>
          </div>
        ))}
      </div>

      {signers.length > 0 && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            Signers ({signers.length})
          </div>
          {signers.map((s: Horizon.AccountSigner, i: number) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 18px',
                borderBottom: i < signers.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <CopyableValue
                value={s.key}
                title="Copy signer public key"
                textStyle={{
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <AddressLabelBadge address={s.key} />
                {shortAddress(s.key)}
              </CopyableValue>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                weight: {s.weight}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          Open Offers
        </div>
        {offersLoading ? (
          <div style={{ padding: '16px 18px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Loading offers...
          </div>
        ) : offersError ? (
          <div style={{ padding: '16px 18px', fontSize: '12px', color: 'var(--red)' }}>
            Error: {offersError}
          </div>
        ) : offers.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: '12px', color: 'var(--text-muted)' }}>
            No open offers
          </div>
        ) : (
          <div>
            {offers.map((offer, i) => (
              <div
                key={offer.id}
                style={{
                  padding: '12px 18px',
                  borderBottom: i < offers.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Offer ID: {offer.id}
                  </span>
                  <a
                    href={`https://stellar.expert/explorer/${network}/offer/${offer.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '11px', color: 'var(--cyan)' }}
                  >
                    View ↗
                  </a>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Selling:</span>{' '}
                    {formatXLM(offer.amount)}{' '}
                    {formatAsset(offer.selling.asset_type, offer.selling.asset_code)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Buying:</span>{' '}
                    {formatAsset(offer.buying.asset_type, offer.buying.asset_code)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Price:</span> {offer.price}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ratio:</span> {offer.price_r.n}/
                    {offer.price_r.d}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '13px',
              marginBottom: '4px',
            }}
          >
            Claimable Balances
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            View and simulate claiming pending balances
          </div>
        </div>
        <button
          onClick={() => useStore.getState().setActiveTab('claimableBalances')}
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--cyan-dim)',
            background: 'var(--cyan-glow)',
            color: 'var(--cyan)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
          }}
        >
          View ⊛
        </button>
      </div>
    </div>
  );
}
