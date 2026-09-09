import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import { fetchPathPayments, type PathPaymentPath } from '../../lib/payments';
import {
  shortAddress,
  type NetworkName,
  type PathAsset,
  type PathPaymentMode,
} from '../../lib/stellar';
import { useRouteOptimization } from '../../hooks/useRouteOptimization';
import AIRouteRecommendations from './AIRouteRecommendations';
import RouteComparison from './RouteComparison';

const controlStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: 'var(--bg-canvas)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  color: 'var(--text-muted)',
  fontSize: '12px',
  fontWeight: 500,
};

function assetName(type: string, code?: string): string {
  return type === 'native' ? 'XLM' : (code || 'Unknown');
}

function AssetEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PathAsset;
  onChange: (asset: PathAsset) => void;
}) {
  return (
    <fieldset style={{ flex: 1, minWidth: '260px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
      <legend style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>{label}</legend>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px' }}>
        <label style={labelStyle}>
          Type
          <select
            aria-label={`${label} type`}
            value={value.type}
            onChange={(event) => onChange(event.target.value === 'native'
              ? { type: 'native', code: 'XLM' }
              : { type: 'credit', code: '', issuer: '' })}
            style={controlStyle}
          >
            <option value="native">XLM</option>
            <option value="credit">Credit</option>
          </select>
        </label>
        <label style={labelStyle}>
          Asset code
          <input
            aria-label={`${label} code`}
            value={value.type === 'native' ? 'XLM' : value.code}
            disabled={value.type === 'native'}
            maxLength={12}
            onChange={(event) => onChange({ ...value, code: event.target.value.toUpperCase() })}
            style={controlStyle}
            placeholder="USDC"
          />
        </label>
      </div>
      {value.type === 'credit' && (
        <label style={{ ...labelStyle, marginTop: '8px' }}>
          Issuer
          <input
            aria-label={`${label} issuer`}
            value={value.issuer || ''}
            onChange={(event) => onChange({ ...value, issuer: event.target.value.trim() })}
            style={controlStyle}
            placeholder="G..."
          />
        </label>
      )}
    </fieldset>
  );
}

function QuoteCard({ path, index, total }: { path: PathPaymentPath; index: number; total: number }) {
  const best = index === 0;
  return (
    <article style={{
      border: `1px solid ${best ? 'var(--green)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-md)',
      padding: '14px',
      background: best ? 'var(--green-glow-sm)' : 'var(--bg-elevated)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
        <strong style={{ color: best ? 'var(--green)' : 'var(--text-primary)', fontSize: '13px' }}>
          {best ? 'Best quote' : `Quote ${index + 1}`} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({total} total)</span>
        </strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{path.path?.length || 0} hops</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '8px' }}>
        {[
          ['Source amount', `${path.source_amount} ${assetName(path.source_asset_type, path.source_asset_code)}`],
          ['Destination amount', `${path.destination_amount} ${assetName(path.destination_asset_type, path.destination_asset_code)}`],
          ['Quote difference', `${path.slippagePct ?? '0.00'}%`],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: '9px 11px', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '13px', marginTop: '3px' }}>{value}</div>
          </div>
        ))}
      </div>
      {(path.path?.length || 0) > 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '10px' }}>
          Route: {path.path.map((hop) => assetName(hop.asset_type, hop.asset_code)).join(' -> ')}
        </div>
      )}
      {path.source_asset_issuer && <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '6px' }}>Source issuer: {shortAddress(path.source_asset_issuer, 6)}</div>}
    </article>
  );
}

export default function PathExplorer() {
  const [mode, setMode] = useState<PathPaymentMode>('strict-send');
  const [network, setNetwork] = useState<NetworkName>('testnet');
  const [amount, setAmount] = useState('');
  const [sourceAsset, setSourceAsset] = useState<PathAsset>({ type: 'native', code: 'XLM' });
  const [destAsset, setDestAsset] = useState<PathAsset>({ type: 'credit', code: '', issuer: '' });
  const [paths, setPaths] = useState<PathPaymentPath[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSearched, setLastSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAIRecommendations, setShowAIRecommendations] = useState(true);
  const [showComparison, setShowComparison] = useState(true);

  const {
    rankedRoutes,
    slippagePredictions,
    routeExplanations,
    selectedRoute,
    isLoading: isOptimizing,
    optimizeRoutes,
    selectRoute,
  } = useRouteOptimization();

  const handleSubmit = useCallback(async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);
    setIsLoading(true);
    setPaths([]);
    setLastSearched(false);
    try {
      const result = await fetchPathPayments({ sourceAsset, destAsset, amount, mode, network });
      setPaths(result);
      setLastSearched(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not fetch path quotes.');
      setLastSearched(true);
    } finally {
      setIsLoading(false);
    }
  }, [amount, destAsset, mode, network, sourceAsset]);

  useEffect(() => {
    if (paths.length > 0 && !isLoading) {
      optimizeRoutes(paths, {
        sourceAsset: assetName(sourceAsset.type, sourceAsset.code),
        destAsset: assetName(destAsset.type, destAsset.code),
        amount: Number(amount),
        liquidity: 0.5,
      });
    }
  }, [amount, destAsset, isLoading, optimizeRoutes, paths, sourceAsset]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '4px' }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', margin: '0 0 8px' }}>Path Explorer</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          Compare strict-send and strict-receive Horizon quotes by source amount, destination amount, and quote difference.
        </p>
      </div>

      <div className="card" style={{ padding: '20px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <label style={{ ...labelStyle, flex: 1, minWidth: '180px' }}>
              Quote mode
              <select value={mode} onChange={(event) => setMode(event.target.value as PathPaymentMode)} style={controlStyle}>
                <option value="strict-send">Strict send (exact source)</option>
                <option value="strict-receive">Strict receive (exact destination)</option>
              </select>
            </label>
            <label style={{ ...labelStyle, flex: 1, minWidth: '140px' }}>
              Network
              <select value={network} onChange={(event) => setNetwork(event.target.value as NetworkName)} style={controlStyle}>
                <option value="mainnet">Mainnet</option>
                <option value="testnet">Testnet</option>
                <option value="futurenet">Futurenet</option>
              </select>
            </label>
            <label style={{ ...labelStyle, flex: 1, minWidth: '180px' }}>
              {mode === 'strict-send' ? 'Exact source amount' : 'Exact destination amount'}
              <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="100.0000000" style={controlStyle} />
            </label>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <AssetEditor label="Source asset" value={sourceAsset} onChange={setSourceAsset} />
            <AssetEditor label="Destination asset" value={destAsset} onChange={setDestAsset} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button type="submit" disabled={isLoading} style={{ ...controlStyle, background: isLoading ? 'var(--bg-canvas)' : 'var(--cyan)', color: isLoading ? 'var(--text-muted)' : 'white', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
              {isLoading ? 'Searching...' : 'Find paths'}
            </button>
            <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}><input type="checkbox" checked={showAIRecommendations} onChange={(event) => setShowAIRecommendations(event.target.checked)} /> AI recommendations</label>
            <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}><input type="checkbox" checked={showComparison} onChange={(event) => setShowComparison(event.target.checked)} /> Compare routes</label>
          </div>
        </form>

        {error && <div role="alert" style={{ marginTop: '14px', padding: '10px 14px', color: 'var(--red)', background: 'var(--red-glow-sm)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>{error}</div>}
      </div>

      {showAIRecommendations && rankedRoutes.length > 0 && (
        <AIRouteRecommendations rankedRoutes={rankedRoutes} slippagePredictions={slippagePredictions} routeExplanations={routeExplanations} onSelectRoute={selectRoute} selectedRoute={selectedRoute} isLoading={isOptimizing} showExplanations />
      )}
      {showComparison && rankedRoutes.length >= 2 && <RouteComparison routes={rankedRoutes} onSelectRoute={selectRoute} selectedRoute={selectedRoute} />}

      {isLoading && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Searching for payment paths...</div>}
      {!isLoading && !lastSearched && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Enter two assets and an amount to request a quote.</div>}
      {!isLoading && lastSearched && paths.length === 0 && !error && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No liquid payment path was found for these assets and amount.</div>}
      {!isLoading && paths.length > 0 && (
        <section aria-label="Path quotes" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            {paths.length} quote{paths.length === 1 ? '' : 's'}; 0.00% is the best returned quote. Quotes can change before submission.
          </div>
          {paths.map((path, index) => <QuoteCard key={`${path.source_amount}-${path.destination_amount}-${index}`} path={path} index={index} total={paths.length} />)}
        </section>
      )}
    </div>
  );
}
