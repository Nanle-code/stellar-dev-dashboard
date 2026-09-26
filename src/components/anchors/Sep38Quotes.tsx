import React, { useState, useEffect } from 'react';
import anchorService from '../../lib/anchors.js';

export default function Sep38Quotes({ anchorId, anchorSession }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [sellAsset, setSellAsset] = useState('iso4217:USD');
  const [buyAsset, setBuyAsset] = useState('stellar:USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN');
  const [amount, setAmount] = useState('100');
  const [quoteType, setQuoteType] = useState('sell');
  
  const [prices, setPrices] = useState(null);
  const [priceError, setPriceError] = useState(null);
  
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    loadInfo();
  }, [anchorId]);

  useEffect(() => {
    if (quote && quote.expires_at) {
      const interval = setInterval(() => {
        const remaining = Math.floor((new Date(quote.expires_at).getTime() - Date.now()) / 1000);
        setCountdown(remaining > 0 ? remaining : 0);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [quote]);

  const loadInfo = async () => {
    try {
      setError(null);
      const data = await anchorService.getSep38Info(anchorId);
      setInfo(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadPrices = async () => {
    try {
      setPriceError(null);
      const data = await anchorService.getSep38Prices(anchorId, sellAsset, amount);
      setPrices(data);
    } catch (err) {
      setPriceError(err.message);
    }
  };

  const requestQuote = async () => {
    try {
      setQuoteError(null);
      if (!anchorSession || !anchorSession.token) {
        throw new Error('SEP-10 authentication required for /quote');
      }
      const data = await anchorService.requestSep38Quote(
        anchorId,
        anchorSession.token,
        'sep31',
        sellAsset,
        buyAsset,
        amount,
        quoteType
      );
      setQuote(data);
      if (data.expires_at) {
        const remaining = Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000);
        setCountdown(remaining > 0 ? remaining : 0);
      }
    } catch (err) {
      setQuoteError(err.message);
    }
  };

  if (!info && !error) return <div>Loading SEP-38 Info...</div>;

  return (
    <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>SEP-38 Quotes</h3>
      
      {error ? (
        <div style={{ color: 'var(--red)' }}>Error: {error}</div>
      ) : (
        <div>
          <div style={{ marginBottom: '16px', fontSize: '12px' }}>
            <strong>Supported Assets (/info):</strong>
            <pre style={{ background: '#000', padding: '8px', color: '#0f0', maxHeight: '100px', overflow: 'auto' }}>
              {JSON.stringify(info?.assets, null, 2)}
            </pre>
          </div>

          <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
            <label>Sell Asset: <input value={sellAsset} onChange={e => setSellAsset(e.target.value)} /></label>
            <label>Buy Asset: <input value={buyAsset} onChange={e => setBuyAsset(e.target.value)} /></label>
            <label>Amount: <input value={amount} onChange={e => setAmount(e.target.value)} /></label>
            <label>Type: 
              <select value={quoteType} onChange={e => setQuoteType(e.target.value)}>
                <option value="sell">Sell</option>
                <option value="buy">Buy</option>
              </select>
            </label>
            <button onClick={loadPrices} style={{ padding: '4px', background: 'var(--cyan)', border: 'none', color: '#fff' }}>Get Prices</button>
          </div>

          {priceError && <div style={{ color: 'var(--red)', marginBottom: '16px' }}>Prices Error: {priceError}</div>}
          
          {prices && (
             <div style={{ marginBottom: '16px', fontSize: '12px' }}>
               <strong>Prices Response:</strong>
               <pre style={{ background: '#000', padding: '8px', color: '#0f0', maxHeight: '100px', overflow: 'auto' }}>
                 {JSON.stringify(prices, null, 2)}
               </pre>
             </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <button onClick={requestQuote} style={{ padding: '4px', background: 'var(--blue)', border: 'none', color: '#fff' }}>Request Quote</button>
            {!anchorSession?.token && <span style={{ marginLeft: '8px', color: 'var(--orange)', fontSize: '12px' }}>Requires Authentication</span>}
          </div>

          {quoteError && <div style={{ color: 'var(--red)' }}>Quote Error: {quoteError}</div>}

          {quote && (
            <div style={{ padding: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <strong>Quote Details:</strong>
              <div>ID: {quote.id}</div>
              <div>Price: {quote.price}</div>
              <div>Expires in: {countdown > 0 ? `${countdown}s` : 'Expired'}</div>
              <pre style={{ background: '#000', padding: '8px', color: '#0f0', maxHeight: '100px', overflow: 'auto', marginTop: '8px', fontSize: '11px' }}>
                {JSON.stringify(quote, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
