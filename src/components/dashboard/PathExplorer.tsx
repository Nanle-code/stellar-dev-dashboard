import React, { useState, useCallback, type FormEvent, type ReactNode } from 'react';
import { shortAddress } from '../../lib/stellar';
import { fetchPathPayments, type PathPaymentPath } from '../../lib/payments';

interface ExplorePathsCardProps {
  destination: string
  amount: string
  sourceAsset: string
  paths: PathPaymentPath[]
  isLoading: boolean
  lastSearched: boolean
}

interface MultiHopPathProps {
  path: PathPaymentPath
  sourceAsset: string
  index: number
  total: number
}

interface PathStepProps {
  label: string
  value: string
  sub?: string
}

const currentYear = new Date().getFullYear();
const DEFAULT_ASSET = 'native';

const PathStep = ({ label, value, sub }: PathStepProps) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '8px 12px',
    background: 'var(--bg-canvas)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
  }}>
    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
      {value}
    </div>
    {sub && (
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        {sub}
      </div>
    )}
  </div>
);

const MultiHopPath = ({ path, sourceAsset, index, total }: MultiHopPathProps) => {
  const pathHops = path.path || [];
  const isBest = index === 0;
  const effectiveSourceAmount = sourceAsset === DEFAULT_ASSET
    ? path.source_amount
    : path.destination_amount;

  return (
    <div style={{
      border: `1px solid ${isBest ? 'var(--green)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-md)',
      padding: '14px',
      background: isBest ? 'var(--green-glow-sm)' : 'var(--bg-elevated)',
      transition: 'var(--transition)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: isBest ? 'var(--green)' : 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          {isBest ? '⭐ Best Path' : `Path #${index + 1}`}
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
            ({total} total)
          </span>
        </div>
        <div style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          background: 'var(--bg-canvas)',
          padding: '3px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)'
        }}>
          {pathHops.length} hop{pathHops.length !== 1 ? 's' : ''}
        </div>
      </div>

      {path.source_amount && (
        <div style={{ marginBottom: '10px' }}>
          <PathStep
            label="Source Amount"
            value={`${parseFloat(path.source_amount).toLocaleString()} ${path.source_asset_type === DEFAULT_ASSET ? 'XLM' : (path.source_asset_code || 'Unknown')}`}
          />
        </div>
      )}

      {pathHops.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
            Intermediate Hops
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {pathHops.map((hop: string, hopIndex: number) => (
              <div key={hopIndex} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: 'var(--bg-canvas)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)'
              }}>
                <span style={{ color: 'var(--cyan)', fontSize: '10px' }}>⬤</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Hop {hopIndex + 1}</span>
                <span>{shortAddress(hop, 6)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {path.destination_amount && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <PathStep
            label="Destination Amount"
            value={`${parseFloat(path.destination_amount).toLocaleString()} ${path.destination_asset_code || (path.destination_asset_type === DEFAULT_ASSET ? 'XLM' : 'Unknown')}`}
            sub={path.destination_asset_issuer ? `Issuer: ${shortAddress(path.destination_asset_issuer, 6)}` : undefined}
          />
        </div>
      )}

      {effectiveSourceAmount && !path.destination_amount && (
        <div style={{ padding: '8px 12px', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', background: 'var(--amber-glow-sm)', fontSize: '12px', color: 'var(--amber)' }}>
          ⚠ Incomplete path data – source amount available but destination amount is not quoted.
        </div>
      )}
    </div>
  );
};

const ExplorePathsCard = ({ destination, amount, sourceAsset, paths, isLoading, lastSearched }: ExplorePathsCardProps) => {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '14px', marginBottom: '8px' }}>⏳</div>
        <div style={{ fontSize: '13px' }}>Searching for payment paths...</div>
      </div>
    );
  }

  if (!lastSearched) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>{''}</div>
        <div style={{ fontSize: '14px' }}>Enter a destination and amount, then click "Find Paths"</div>
        <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-muted)' }}>
          Pathfinding finds the cheapest route across the Stellar network.
        </div>
      </div>
    );
  }

  if (!paths || paths.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>🔍</div>
        <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>No paths found</div>
        <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '400px' }}>
          Could not find any payment paths for the specified parameters. The destination may not accept the asset, or no liquid path exists.
        </div>
      </div>
    );
  }

  const bestPath = paths[0];
  const savingsMessage = paths.length > 1 && bestPath.source_amount && paths[paths.length - 1].source_amount
    ? `${((parseFloat(paths[paths.length - 1].source_amount!) - parseFloat(bestPath.source_amount)) / parseFloat(paths[paths.length - 1].source_amount!) * 100).toFixed(1)}% cheaper than worst`
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {paths.length} path{paths.length !== 1 ? 's' : ''} found
        </div>
        {savingsMessage && (
          <div style={{
            fontSize: '11px',
            padding: '4px 10px',
            background: 'var(--green-glow-sm)',
            border: '1px solid var(--green)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--green)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 500
          }}>
            {savingsMessage}
          </div>
        )}
      </div>
      {paths.map((path: PathPaymentPath, index: number) => (
        <MultiHopPath
          key={index}
          path={path}
          sourceAsset={sourceAsset}
          index={index}
          total={paths.length}
        />
      ))}
    </div>
  );
};

export default function PathExplorer() {
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [sourceAsset, setSourceAsset] = useState<string>(DEFAULT_ASSET);
  const [paths, setPaths] = useState<PathPaymentPath[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSearched, setLastSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!destination || !amount) {
      setError('Please enter both a destination address and amount.');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Amount must be a positive number.');
      return;
    }

    setIsLoading(true);
    setPaths([]);

    try {
      const result = await fetchPathPayments({
        destination,
        amount: amountNum.toString(),
        sourceAsset,
        sourceAssetIssuer: undefined,
      });
      setPaths(result);
      setLastSearched(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching paths';
      setError(message);
      setPaths([]);
      setLastSearched(true);
    } finally {
      setIsLoading(false);
    }
  }, [destination, amount, sourceAsset]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '4px' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
          Path Explorer
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          Discover optimal payment paths across the Stellar network to minimize costs and maximize delivery.
        </p>
      </div>

      <div className="card" style={{
        padding: '20px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
          Search Parameters
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Destination Address
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="GABCD... or *.stellar"
              style={{
                padding: '10px 12px',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                transition: 'var(--transition)',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                Amount
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
                step="any"
                min="0"
                style={{
                  padding: '10px 12px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  transition: 'var(--transition)',
                }}
              />
            </div>

            <div style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                Source Asset
              </label>
              <select
                value={sourceAsset}
                onChange={(e) => setSourceAsset(e.target.value)}
                style={{
                  padding: '10px 12px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  transition: 'var(--transition)',
                  cursor: 'pointer',
                }}
              >
                <option value={DEFAULT_ASSET}>XLM (Native)</option>
                <option value="USDC">USDC</option>
                <option value="yUSDC">yUSDC</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '10px 20px',
              background: isLoading ? 'var(--bg-elevated)' : 'var(--cyan)',
              color: isLoading ? 'var(--text-muted)' : 'white',
              border: `1px solid ${isLoading ? 'var(--border)' : 'var(--cyan)'}`,
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'var(--transition)',
              fontFamily: 'var(--font-display)',
              alignSelf: 'flex-start',
            }}
          >
            {isLoading ? 'Searching...' : '🔍 Find Paths'}
          </button>
        </form>

        {error && (
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            background: 'var(--red-glow-sm)',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--red)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </div>

      <ExplorePathsCard
        destination={destination}
        amount={amount}
        sourceAsset={sourceAsset}
        paths={paths}
        isLoading={isLoading}
        lastSearched={lastSearched}
      />
    </div>
  );
}
