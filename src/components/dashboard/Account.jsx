import React, { useState, useEffect } from 'react'
import { useStore } from '../../lib/store'
import { shortAddress, formatXLM, fetchAccountOffers } from '../../lib/stellar'

function formatAsset(assetType, assetCode) {
  if (assetType === 'native') return 'XLM'
  return assetCode || 'Unknown'
}

function InfoRow({ label, value, mono = true, accent }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '16px',
      padding: '10px 18px',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: '12px',
        color: accent || 'var(--text-primary)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
        wordBreak: 'break-all',
        textAlign: 'right',
      }}>{value ?? '—'}</span>
    </div>
  )
}

export default function Account() {
  const { accountData, connectedAddress, network } = useStore()
  const [offers, setOffers] = useState([])
  const [offersLoading, setOffersLoading] = useState(false)
  const [offersError, setOffersError] = useState(null)

  useEffect(() => {
    if (connectedAddress) {
      setOffersLoading(true)
      setOffersError(null)
      fetchAccountOffers(connectedAddress, network)
        .then(res => setOffers(res))
        .catch(err => setOffersError(err.message))
        .finally(() => setOffersLoading(false))
    }
  }, [connectedAddress, network])

  if (!accountData) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No account loaded</div>
  )

  const xlm = accountData.balances?.find(b => b.asset_type === 'native')
  const signers = accountData.signers || []
  const flags = accountData.flags || {}
  const thresholds = accountData.thresholds || {}

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Account Detail</div>

      {/* Identity */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Identity</div>
        <InfoRow label="Public Key" value={connectedAddress} />
        <InfoRow label="Account ID" value={accountData.account_id} />
        <InfoRow label="Sequence" value={accountData.sequence} />
        <InfoRow label="XLM Balance" value={xlm ? formatXLM(xlm.balance) + ' XLM' : '—'} accent="var(--cyan)" />
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

      {/* Thresholds */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Thresholds</div>
        <InfoRow label="Low" value={thresholds.low_threshold} />
        <InfoRow label="Medium" value={thresholds.med_threshold} />
        <InfoRow label="High" value={thresholds.high_threshold} />
      </div>

      {/* Flags */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Flags</div>
        {Object.entries(flags).map(([key, val]) => (
          <div key={key} style={{
            display: 'flex', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {key.replace(/_/g, ' ')}
            </span>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '3px',
              background: val ? 'var(--green-glow)' : 'var(--bg-elevated)',
              border: `1px solid ${val ? 'var(--green)' : 'var(--border)'}`,
              color: val ? 'var(--green)' : 'var(--text-muted)',
            }}>
              {val ? 'TRUE' : 'FALSE'}
            </span>
          </div>
        ))}
      </div>

      {/* Signers */}
      {signers.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
            Signers ({signers.length})
          </div>
          {signers.map((s, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 18px', borderBottom: i < signers.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {shortAddress(s.key)}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>weight: {s.weight}</span>
            </div>
          ))}
        </div>
      )}

      {/* Open Offers */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
          Open Offers
        </div>
        {offersLoading ? (
          <div style={{ padding: '16px 18px', fontSize: '12px', color: 'var(--text-muted)' }}>Loading offers...</div>
        ) : offersError ? (
          <div style={{ padding: '16px 18px', fontSize: '12px', color: 'var(--red)' }}>Error: {offersError}</div>
        ) : offers.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: '12px', color: 'var(--text-muted)' }}>No open offers</div>
        ) : (
          <div>
            {offers.map((offer, i) => (
              <div key={offer.id} style={{
                padding: '12px 18px',
                borderBottom: i < offers.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Offer ID: {offer.id}</span>
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
                  <div style={{ flex: 1 }}><span style={{ color: 'var(--text-muted)' }}>Selling:</span> {formatXLM(offer.amount)} {formatAsset(offer.selling.asset_type, offer.selling.asset_code)}</div>
                  <div style={{ flex: 1 }}><span style={{ color: 'var(--text-muted)' }}>Buying:</span> {formatAsset(offer.buying.asset_type, offer.buying.asset_code)}</div>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                  <div style={{ flex: 1 }}><span style={{ color: 'var(--text-muted)' }}>Price:</span> {offer.price}</div>
                  <div style={{ flex: 1 }}><span style={{ color: 'var(--text-muted)' }}>Ratio:</span> {offer.price_r.n}/{offer.price_r.d}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
