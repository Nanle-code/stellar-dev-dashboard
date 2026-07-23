import React, { useEffect, useState, useMemo } from 'react';
import { 
  Sliders, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, 
  Info, Sparkles, Plus, Trash2, Play, Key, RefreshCw, Zap, ArrowRight, ShieldCheck 
} from 'lucide-react';
import { useStore } from '../../lib/store';
import { suggestRebalancing } from '../../lib/defiAnalytics';
import { fetchPrices, calculatePortfolioValue } from '../../lib/priceFeed';
import { getServer, NETWORKS } from '../../lib/stellar';
import { buildTransaction, signAndSubmitTransaction, simulateTransaction } from '../../lib/transactionBuilder';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Legend, CartesianGrid
} from 'recharts';

interface Suggestion {
  asset: string;
  action: 'buy' | 'sell';
  amount: number; // in USD
  currentPct: number;
  targetPct: number;
}

interface Holding {
  asset: string;
  value: number;
  amount: number;
  price: number;
  assetType: string;
  assetIssuer: string;
}

const DEFAULT_TARGETS: Record<string, number> = { XLM: 0.5, USDC: 0.3, AQUA: 0.2 };

const SUPPORTED_ASSETS = [
  { code: 'XLM', name: 'Stellar Lumens', type: 'native', issuer: '' },
  { code: 'USDC', name: 'USD Coin', type: 'credit_alphanum4', issuer: 'GBBD47R2HS7ND7TSBSCOCCFD43TCJJMOND547KUNA3ISP52QDWCCCEQD' },
  { code: 'AQUA', name: 'Aquarius', type: 'credit_alphanum4', issuer: 'GBNZ4J2NEJX2Z7R32JTC7CRM7QISD6Q5WFBEX4QR2FOA57PI57QQ7ZOO' },
  { code: 'BTC', name: 'Bitcoin', type: 'credit_alphanum4', issuer: 'GDPJTL4K55W5KUBFND4NLAWTLO2TWCKNN3W77W5YSMCCCK3IN6X4N6N6' },
  { code: 'ETH', name: 'Ethereum', type: 'credit_alphanum4', issuer: 'GBDEVU63M6N7Z2V5E333333333333333333333333333333333333333' }
];

const AI_PRESETS = [
  { name: 'Conservative', description: 'Low volatility, high stability', targets: { XLM: 0.3, USDC: 0.6, AQUA: 0.1 } },
  { name: 'Moderate', description: 'Balanced growth and stability', targets: { XLM: 0.5, USDC: 0.3, AQUA: 0.2 } },
  { name: 'Aggressive', description: 'High growth potential', targets: { XLM: 0.6, USDC: 0.1, AQUA: 0.3 } },
  { name: 'Yield-Optimized', description: 'Focused on AMM incentives', targets: { XLM: 0.4, USDC: 0.2, AQUA: 0.4 } },
];

function fmt(n: number, d = 2) { 
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); 
}

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const ASSET_ID_MAP: Record<string, string> = {
  XLM: 'stellar',
  native: 'stellar',
  USDC: 'usd-coin',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  AQUA: 'aquarius',
};

export default function PortfolioRebalancer() {
  const { connectedAddress, network, accountData, setAccountData } = useStore();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [targets, setTargets] = useState<Record<string, number>>(DEFAULT_TARGETS);
  
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Execution states
  const [secretKey, setSecretKey] = useState('');
  const [showExecution, setShowExecution] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [showXDR, setShowXDR] = useState(false);

  // Chart data
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState(30);

  // New asset selection
  const [newAssetCode, setNewAssetCode] = useState('');

  // Total weight helper
  const totalWeight = useMemo(() => {
    return Math.round(Object.values(targets).reduce((sum, w) => sum + w, 0) * 100);
  }, [targets]);

  // Fetch prices and analyze current portfolio
  async function analyze() {
    if (!connectedAddress) { 
      setError('Connect an account first.'); 
      return; 
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setSimulationResult(null);
    try {
      const server = getServer(network);
      const account = await server.loadAccount(connectedAddress);
      
      const targetAssets = Object.keys(targets);
      const assetCodes = Array.from(new Set([
        ...account.balances.map((b: any) => b.asset_type === 'native' ? 'XLM' : b.asset_code),
        ...targetAssets
      ]));
      
      const prices = await fetchPrices(assetCodes);
      const portfolio = calculatePortfolioValue(account.balances, prices);
      
      const activeHoldings = (portfolio?.items || []).map((item: any) => {
        const orig = account.balances.find((b: any) =>
          b.asset_type === 'native' ? item.code === 'XLM' : b.asset_code === item.code
        );
        return {
          asset: item.code,
          value: item.valueUsd ?? 0,
          amount: item.amount ?? 0,
          price: item.priceUsd ?? 0,
          assetType: orig?.asset_type || 'credit_alphanum4',
          assetIssuer: orig?.asset_issuer || '',
        };
      });

      // Include target assets that are not in the current portfolio with 0 balance
      targetAssets.forEach(asset => {
        if (!activeHoldings.some(h => h.asset === asset)) {
          const supported = SUPPORTED_ASSETS.find(s => s.code === asset);
          const price = prices[asset]?.usd ?? 0;
          activeHoldings.push({
            asset,
            value: 0,
            amount: 0,
            price,
            assetType: supported?.type || 'credit_alphanum4',
            assetIssuer: supported?.issuer || '',
          });
        }
      });

      setHoldings(activeHoldings);

      // Generate suggestions
      const cleanHoldings = activeHoldings.filter(h => h.value > 0 || targets[h.asset] > 0);
      const rebalSuggestions = suggestRebalancing(cleanHoldings, targets) as Suggestion[];
      setSuggestions(rebalSuggestions);
      
      // Auto-approve all suggestions initially
      const initialApproved: Record<string, boolean> = {};
      rebalSuggestions.forEach(s => {
        initialApproved[s.asset] = true;
      });
      setApproved(initialApproved);

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to analyze portfolio');
    } finally {
      setLoading(false);
    }
  }

  // Load portfolio on mount or address change
  useEffect(() => {
    if (connectedAddress) {
      analyze();
    }
  }, [connectedAddress, network]);

  // Re-generate suggestions when targets change
  useEffect(() => {
    if (holdings.length > 0) {
      const cleanHoldings = holdings.filter(h => h.value > 0 || targets[h.asset] > 0);
      const rebalSuggestions = suggestRebalancing(cleanHoldings, targets) as Suggestion[];
      setSuggestions(rebalSuggestions);
    }
  }, [targets, holdings]);

  // Fetch or simulate historical prices
  async function fetchHistoricalPrices(assetCodes: string[], days: number): Promise<Record<string, number[]>> {
    const history: Record<string, number[]> = {};
    
    for (const code of assetCodes) {
      const coinId = ASSET_ID_MAP[code];
      if (!coinId) {
        history[code] = generateSimulatedPrices(code, days);
        continue;
      }
      
      try {
        const res = await fetch(`${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`);
        if (!res.ok) throw new Error('Rate limit');
        const data = await res.json();
        history[code] = data.prices.map((p: any) => p[1]);
      } catch (e) {
        history[code] = generateSimulatedPrices(code, days);
      }
    }
    return history;
  }

  function generateSimulatedPrices(code: string, days: number): number[] {
    const currentHolding = holdings.find(h => h.asset === code);
    const currentPrice = currentHolding?.price || (code === 'USDC' ? 1.0 : code === 'XLM' ? 0.12 : 0.05);
    const prices = [];
    let price = currentPrice;
    const dailyVolatility = code === 'USDC' ? 0.001 : code === 'XLM' ? 0.03 : 0.05;
    const trend = code === 'USDC' ? 0 : 0.0003; 
    
    for (let i = 0; i <= days; i++) {
      prices.push(price);
      const change = 1 + (Math.random() - 0.5) * dailyVolatility - trend;
      price = price / change;
    }
    return prices.reverse();
  }

  // Fetch history data for comparison chart
  useEffect(() => {
    if (holdings.length === 0) return;

    let active = true;
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const assetCodes = holdings.map(h => h.asset);
        Object.keys(targets).forEach(asset => {
          if (!assetCodes.includes(asset)) {
            assetCodes.push(asset);
          }
        });

        const pricesHistory = await fetchHistoricalPrices(assetCodes, timeRange);
        
        if (!active) return;

        const chartData = [];
        const initialValue = 10000;
        
        const currentAllocations: Record<string, number> = {};
        const totalCurrentValue = holdings.reduce((sum, h) => sum + h.value, 0);
        
        if (totalCurrentValue > 0) {
          holdings.forEach(h => {
            currentAllocations[h.asset] = h.value / totalCurrentValue;
          });
        } else {
          currentAllocations['XLM'] = 1.0;
        }

        for (let day = 0; day <= timeRange; day++) {
          let currentVal = 0;
          let targetVal = 0;

          for (const asset of assetCodes) {
            const history = pricesHistory[asset] || [];
            const price0 = history[0] || 1;
            const priceT = history[day] || price0;
            const priceRatio = priceT / price0;

            const currentAlloc = currentAllocations[asset] || 0;
            currentVal += initialValue * currentAlloc * priceRatio;

            const targetAlloc = targets[asset] || 0;
            targetVal += initialValue * targetAlloc * priceRatio;
          }

          const date = new Date();
          date.setDate(date.getDate() - (timeRange - day));
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          chartData.push({
            date: dateStr,
            Current: Math.round(currentVal),
            Target: Math.round(targetVal),
            'Current ROI (%)': +(((currentVal - initialValue) / initialValue) * 100).toFixed(2),
            'Target ROI (%)': +(((targetVal - initialValue) / initialValue) * 100).toFixed(2),
          });
        }

        setHistoryData(chartData);
      } catch (err) {
        console.error('Error generating historical comparison:', err);
      } finally {
        if (active) setHistoryLoading(false);
      }
    }

    loadHistory();
    return () => {
      active = false;
    };
  }, [holdings, targets, timeRange]);

  // AI Assistant Reasoning
  const aiReasoning = useMemo(() => {
    if (holdings.length === 0) return null;
    
    const totalVal = holdings.reduce((sum, h) => sum + h.value, 0);
    const allocations = holdings.map(h => h.value / (totalVal || 1));
    const hhi = allocations.reduce((sum, a) => sum + a * a, 0);
    const diversificationScore = Math.round((1 - hhi) * 100);

    const concentrated = holdings.filter(h => h.value / (totalVal || 1) > 0.4);

    let totalDeviation = 0;
    Object.entries(targets).forEach(([asset, targetPct]) => {
      const currentHolding = holdings.find(h => h.asset === asset);
      const currentPct = currentHolding ? (currentHolding.value / (totalVal || 1)) : 0;
      totalDeviation += Math.abs(currentPct - targetPct);
    });

    const isHighDeviation = totalDeviation > 0.15;

    let riskLevel = 'Moderate';
    let expectedVolatility = 'Medium';
    let primaryBenefit = 'Optimized Risk-Adjusted Returns';

    const targetXlm = targets['XLM'] || 0;
    const targetUsdc = targets['USDC'] || 0;
    const targetAqua = targets['AQUA'] || 0;

    if (targetUsdc > 0.45) {
      riskLevel = 'Conservative';
      expectedVolatility = 'Low';
      primaryBenefit = 'Capital Preservation & Volatility Reduction';
    } else if (targetXlm > 0.55 || targetAqua > 0.25) {
      riskLevel = 'Aggressive';
      expectedVolatility = 'High';
      primaryBenefit = 'Capital Appreciation & Yield Generation';
    } else {
      riskLevel = 'Balanced';
      expectedVolatility = 'Moderate';
      primaryBenefit = 'Balanced Growth & Defensive Stability';
    }

    const points = [];
    if (diversificationScore < 45) {
      points.push(`Your current portfolio diversification is low (${diversificationScore}/100), creating concentration risk. Rebalancing will spread risk.`);
    } else {
      points.push(`Your current portfolio is well-diversified (${diversificationScore}/100). Rebalancing will maintain this balanced structure.`);
    }

    if (concentrated.length > 0) {
      points.push(`Currently, ${concentrated.map(h => h.asset).join(', ')} represents over 40% of your holdings, exposing you heavily to its individual price movement.`);
    }

    if (isHighDeviation) {
      points.push(`Drift from your target allocation is significant (${Math.round(totalDeviation * 100)}%). Rebalancing restores your intended risk profile.`);
    }

    points.push(`The proposed ${riskLevel} target allocation offers ${expectedVolatility.toLowerCase()} volatility. The primary benefit is ${primaryBenefit.toLowerCase()}.`);

    return {
      riskLevel,
      expectedVolatility,
      primaryBenefit,
      points,
      summary: `AI recommends rebalancing to a ${riskLevel} stance to achieve ${primaryBenefit.toLowerCase()}.`
    };
  }, [holdings, targets]);

  // Adjust sliders to sum to 100%
  function autoBalance() {
    const sum = Object.values(targets).reduce((s, w) => s + w, 0);
    if (sum === 0) return;
    const normalized: Record<string, number> = {};
    Object.entries(targets).forEach(([asset, w]) => {
      normalized[asset] = +(w / sum).toFixed(4);
    });
    setTargets(normalized);
  }

  // Handle slider changes
  const handleSliderChange = (asset: string, val: number) => {
    setTargets(prev => ({
      ...prev,
      [asset]: val / 100
    }));
  };

  // Add new asset to targets
  const addAssetToTargets = () => {
    if (!newAssetCode || targets[newAssetCode] !== undefined) return;
    setTargets(prev => ({
      ...prev,
      [newAssetCode]: 0.1
    }));
    setNewAssetCode('');
  };

  // Remove asset from targets
  const removeAssetFromTargets = (asset: string) => {
    if (asset === 'XLM') return; // XLM is required
    const newTargets = { ...targets };
    delete newTargets[asset];
    setTargets(newTargets);
  };

  // Select AI Preset
  const selectPreset = (presetTargets: Record<string, number>) => {
    setTargets(presetTargets);
  };

  // Build trade operations
  function buildRebalanceOperations() {
    const totalVal = holdings.reduce((sum, h) => sum + h.value, 0);
    const ops: any[] = [];
    const xlmHolding = holdings.find(h => h.asset === 'XLM');
    const xlmPrice = xlmHolding?.price || 0.12;

    // Process sells first (converts assets to XLM)
    suggestions
      .filter(s => s.action === 'sell' && approved[s.asset])
      .forEach(s => {
        const holding = holdings.find(h => h.asset === s.asset);
        if (!holding || holding.asset === 'XLM') return;
        
        const amountToSell = s.amount / holding.price;
        const priceInXlm = holding.price / xlmPrice;

        ops.push({
          type: 'manageSellOffer',
          params: {
            sellingAssetType: holding.assetType,
            sellingAssetCode: holding.asset,
            sellingAssetIssuer: holding.assetIssuer,
            buyingAssetType: 'native',
            buyingAssetCode: 'XLM',
            buyingAssetIssuer: '',
            amount: amountToSell.toFixed(7),
            price: priceInXlm.toFixed(7),
          }
        });
      });

    // Process buys next (converts XLM to assets)
    suggestions
      .filter(s => s.action === 'buy' && approved[s.asset])
      .forEach(s => {
        const holding = holdings.find(h => h.asset === s.asset);
        if (!holding || holding.asset === 'XLM') return;

        const priceInAsset = xlmPrice / holding.price;
        const amountXlmToSell = s.amount / xlmPrice;

        ops.push({
          type: 'manageSellOffer',
          params: {
            sellingAssetType: 'native',
            sellingAssetCode: 'XLM',
            sellingAssetIssuer: '',
            buyingAssetType: holding.assetType,
            buyingAssetCode: holding.asset,
            buyingAssetIssuer: holding.assetIssuer,
            amount: amountXlmToSell.toFixed(7),
            price: priceInAsset.toFixed(7),
          }
        });
      });

    return ops;
  }

  // Simulate rebalancing transaction
  async function handleSimulate() {
    if (!connectedAddress) return;
    setError('');
    setSimulationResult(null);
    setExecuting(true);

    try {
      const ops = buildRebalanceOperations();
      if (ops.length === 0) {
        throw new Error('No trades selected or approved.');
      }

      const simResult = await simulateTransaction({
        sourceAccount: connectedAddress,
        operations: ops,
        network,
        baseFee: '100',
      });

      setSimulationResult(simResult);

      if (!simResult.success) {
        setError('Simulation failed: ' + simResult.errors.join(', '));
      }
    } catch (e: any) {
      setError(e.message || 'Simulation failed.');
    } finally {
      setExecuting(false);
    }
  }

  // Execute Mock Rebalance (Updates UI state locally)
  function handleMockExecute() {
    if (!connectedAddress || !accountData) return;
    setExecuting(true);
    setError('');

    setTimeout(() => {
      try {
        const totalVal = holdings.reduce((sum, h) => sum + h.value, 0);
        
        // Compute new balances based on target weights
        const newBalances = accountData.balances.map((b: any) => {
          const code = b.asset_type === 'native' ? 'XLM' : b.asset_code;
          const targetPct = targets[code] ?? 0;
          const holding = holdings.find(h => h.asset === code);
          const price = holding?.price || 1.0;
          const newBalanceValue = totalVal * targetPct;
          const newAmount = newBalanceValue / price;
          
          return {
            ...b,
            balance: newAmount.toFixed(7)
          };
        });

        // Add any target assets that weren't in the wallet before
        Object.entries(targets).forEach(([code, targetPct]) => {
          const exists = newBalances.some((b: any) => 
            b.asset_type === 'native' ? code === 'XLM' : b.asset_code === code
          );
          if (!exists && targetPct > 0) {
            const supported = SUPPORTED_ASSETS.find(s => s.code === code);
            const price = holdings.find(h => h.asset === code)?.price || 1.0;
            const newAmount = (totalVal * targetPct) / price;
            
            newBalances.push({
              asset_type: supported?.type || 'credit_alphanum4',
              asset_code: code,
              asset_issuer: supported?.issuer || '',
              balance: newAmount.toFixed(7)
            });
          }
        });

        setAccountData({
          ...accountData,
          balances: newBalances
        });

        setSuccessMsg('Portfolio successfully rebalanced (Simulated)! The dashboard has been updated to reflect the new allocations.');
        setShowExecution(false);
        setSimulationResult(null);
        setSecretKey('');
        
        // Trigger a fresh analysis based on the new local state
        setTimeout(() => analyze(), 100);

      } catch (e: any) {
        setError('Mock execution failed: ' + e.message);
      } finally {
        setExecuting(false);
      }
    }, 1500);
  }

  // Execute Live Rebalance on network
  async function handleLiveExecute() {
    if (!connectedAddress || !secretKey) return;
    setExecuting(true);
    setError('');
    setSuccessMsg('');

    try {
      const ops = buildRebalanceOperations();
      if (ops.length === 0) {
        throw new Error('No trades selected.');
      }

      // Build
      const tx = await buildTransaction({
        sourceAccount: connectedAddress,
        operations: ops,
        network,
        baseFee: '100',
      });

      // Sign & Submit
      const result = await signAndSubmitTransaction(tx, secretKey, network);

      if (result.successful) {
        setSuccessMsg(`Live rebalancing transaction submitted successfully! Hash: ${result.hash.slice(0, 16)}...`);
        setShowExecution(false);
        setSimulationResult(null);
        setSecretKey('');
        // Reload account details from Horizon
        analyze();
      } else {
        throw new Error('Transaction submission was not successful.');
      }
    } catch (e: any) {
      setError(e.message || 'Live execution failed.');
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Upper Grid: Current Allocation & Targets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        
        {/* Left: Current Allocation Analysis */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={18} style={{ color: 'var(--cyan)' }} /> Current Allocation Analysis
          </h3>
          
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {holdings.map(h => {
                  const totalVal = holdings.reduce((sum, item) => sum + item.value, 0);
                  const currentPct = totalVal > 0 ? (h.value / totalVal) * 100 : 0;
                  const targetPct = (targets[h.asset] || 0) * 100;
                  
                  return (
                    <div key={h.asset} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 12, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{h.asset}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {fmt(currentPct)}% <span style={{ color: 'var(--text-muted)' }}>(${fmt(h.value)})</span>
                        </span>
                      </div>
                      
                      {/* Visual progress bar: Current vs Target */}
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ 
                          width: `${currentPct}%`, 
                          height: '100%', 
                          background: 'var(--cyan, #06b6d4)', 
                          position: 'absolute',
                          left: 0,
                          top: 0
                        }} />
                        <div style={{ 
                          width: `${targetPct}%`, 
                          height: '100%', 
                          background: 'var(--amber, #f59e0b)', 
                          opacity: 0.4,
                          position: 'absolute',
                          left: 0,
                          top: 0
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                        <span>Current: {fmt(currentPct)}%</span>
                        <span>Target: {fmt(targetPct)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Total Portfolio Value</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  ${fmt(holdings.reduce((sum, h) => sum + h.value, 0))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Target Allocation Config */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: 'var(--amber)' }} /> Target Allocation Input
          </h3>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {AI_PRESETS.map(p => (
              <button
                key={p.name}
                onClick={() => selectPreset(p.targets)}
                style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 11,
                  color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'flex-start', gap: 2, transition: 'all 0.2s', textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--cyan)';
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                }}
              >
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{p.description}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
            {Object.entries(targets).map(([asset, weight]) => (
              <div key={asset} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{asset}</span>
                    {asset !== 'XLM' && (
                      <button 
                        onClick={() => removeAssetFromTargets(asset)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 2 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input 
                      type="number" 
                      value={Math.round(weight * 100)}
                      onChange={(e) => handleSliderChange(asset, parseFloat(e.target.value) || 0)}
                      style={{ 
                        width: 50, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', textAlign: 'center',
                        fontSize: 12, padding: '2px 4px'
                      }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={Math.round(weight * 100)} 
                  onChange={(e) => handleSliderChange(asset, parseInt(e.target.value))}
                  style={{ width: '100%', height: 4, cursor: 'pointer', accentColor: 'var(--cyan)' }}
                />
              </div>
            ))}
          </div>

          {/* Add Asset dropdown */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
            <select
              value={newAssetCode}
              onChange={(e) => setNewAssetCode(e.target.value)}
              style={{
                flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '6px 10px',
                fontSize: 12
              }}
            >
              <option value="">-- Add Asset --</option>
              {SUPPORTED_ASSETS.filter(a => targets[a.code] === undefined).map(a => (
                <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
              ))}
            </select>
            <button
              onClick={addAssetToTargets}
              disabled={!newAssetCode}
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 12,
                color: 'var(--text-primary)', cursor: 'pointer', opacity: newAssetCode ? 1 : 0.5
              }}
            >
              <Plus size={14} /> Add
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={autoBalance}
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: 12,
                color: 'var(--cyan)', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Auto-balance to 100%
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: totalWeight === 100 ? 'var(--green)' : 'var(--amber)', fontWeight: 700 }}>
                Total: {totalWeight}%
              </span>
              {totalWeight !== 100 && (
                <span style={{ fontSize: 11, color: 'var(--amber)' }}>⚠ Must be 100%</span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Middle Grid: AI Assistant & Suggestions */}
      {aiReasoning && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20, alignItems: 'stretch' }}>
          
          {/* Left: AI Assistant & Reasoning */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} style={{ color: 'var(--cyan)' }} /> AI-Driven Portfolio Insight
            </h3>
            
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>AI Recommendation</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{aiReasoning.summary}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {aiReasoning.points.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <Info size={14} style={{ color: 'var(--cyan)', marginTop: 2, flexShrink: 0 }} />
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Suggested Rebalancing Trades */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={18} style={{ color: 'var(--green)' }} /> Suggested Rebalancing Trades
            </h3>

            {suggestions.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--text-muted)', gap: 8 }}>
                <CheckCircle size={24} style={{ color: 'var(--green)' }} />
                <span style={{ fontSize: 13 }}>Your portfolio is perfectly balanced!</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                  {suggestions.map(s => {
                    const actionColor = s.action === 'buy' ? 'var(--green)' : 'var(--red)';
                    const isApproved = !!approved[s.asset];
                    
                    return (
                      <div
                        key={s.asset}
                        style={{
                          display: 'grid', gridTemplateColumns: '24px 1fr auto auto',
                          alignItems: 'center', gap: 12,
                          background: isApproved ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                          border: `1px solid ${isApproved ? 'var(--cyan)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-md)', padding: 12,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isApproved}
                          onChange={(e) => setApproved((prev) => ({ ...prev, [s.asset]: e.target.checked }))}
                          aria-label={`Approve ${s.action} ${s.asset}`}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--cyan)' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{s.asset}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {fmt(s.currentPct)}% <ArrowRight size={10} style={{ display: 'inline', margin: '0 4px' }} /> {fmt(s.targetPct)}%
                          </div>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                          ${fmt(s.amount)}
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          background: `${actionColor}15`, color: actionColor,
                          textTransform: 'uppercase',
                        }}>
                          {s.action}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      setSecretKey('');
                      setShowExecution(true);
                      setSimulationResult(null);
                      setError('');
                    }}
                    disabled={!Object.values(approved).some(Boolean) || totalWeight !== 100}
                    style={{
                      flex: 1, background: 'var(--cyan, #06b6d4)', color: '#0a0a0a', border: 'none',
                      borderRadius: 'var(--radius-sm)', padding: '10px 18px', fontWeight: 700, cursor: 'pointer',
                      opacity: !Object.values(approved).some(Boolean) || totalWeight !== 100 ? 0.5 : 1, fontSize: 13,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Play size={14} /> Execute Rebalance ({Object.values(approved).filter(Boolean).length})
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Historical Performance Comparison */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} style={{ color: 'var(--cyan)' }} /> Historical Performance Comparison (30D)
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setTimeRange(d)}
                style={{
                  background: timeRange === d ? 'var(--cyan)' : 'var(--bg-elevated)',
                  color: timeRange === d ? '#0a0a0a' : 'var(--text-secondary)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                }}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>

        {historyLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" />
          </div>
        ) : historyData.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>
            No historical data available.
          </div>
        ) : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} unit="%" />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                  labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line 
                  type="monotone" 
                  dataKey="Current ROI (%)" 
                  stroke="var(--cyan, #06b6d4)" 
                  strokeWidth={2.5} 
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Target ROI (%)" 
                  stroke="var(--amber, #f59e0b)" 
                  strokeWidth={2.5} 
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Execution Panel Modal / Section */}
      {showExecution && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 24, width: '90%', maxWidth: 500,
            display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={20} style={{ color: 'var(--cyan)' }} /> Execute Portfolio Rebalance
            </h3>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Review the trades that will be built and executed. You can perform a local simulation first or enter your secret key to execute the trades live.
            </p>

            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Trades to Execute</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                {suggestions.filter(s => approved[s.asset]).map(s => (
                  <div key={s.asset} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{s.asset}</span>
                    <span style={{ color: s.action === 'buy' ? 'var(--green)' : 'var(--red)', fontWeight: 700, textTransform: 'uppercase' }}>
                      {s.action} ${fmt(s.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Secret Key Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Key size={13} /> Secret Key (S...) <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(Optional - Live submission only)</span>
              </label>
              <input
                type="password"
                placeholder="S..."
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '10px 12px',
                  fontSize: 13, fontFamily: 'var(--font-mono)', boxSizing: 'border-box'
                }}
              />
            </div>

            {simulationResult && (
              <div style={{
                background: simulationResult.success ? 'var(--green-glow, rgba(34,197,94,0.06))' : 'var(--red-glow, rgba(239,68,68,0.06))',
                border: `1px solid ${simulationResult.success ? 'var(--green)' : 'var(--red)'}`,
                borderRadius: 'var(--radius-md)', padding: 12, fontSize: 12
              }}>
                <div style={{ fontWeight: 700, color: simulationResult.success ? 'var(--green)' : 'var(--red)', marginBottom: 4 }}>
                  {simulationResult.success ? 'Simulation Successful' : 'Simulation Failed'}
                </div>
                {simulationResult.success && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: 'var(--text-secondary)' }}>
                    <span>Estimated Fee: {simulationResult.fee} stroops</span>
                    <span>Operations: {simulationResult.operationCount}</span>
                    <button 
                      onClick={() => setShowXDR(!showXDR)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--cyan)', cursor: 'pointer', padding: 0, textAlign: 'left', fontSize: 11, marginTop: 4 }}
                    >
                      {showXDR ? 'Hide' : 'Show'} Transaction XDR
                    </button>
                    {showXDR && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, wordBreak: 'break-all', maxHeight: 80, overflowY: 'auto', background: 'var(--bg-base)', padding: 6, borderRadius: 4, marginTop: 4 }}>
                        {simulationResult.xdr}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--red)', fontSize: 12 }}>
                <AlertTriangle size={15} /> {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => {
                  setShowExecution(false);
                  setSimulationResult(null);
                  setError('');
                }}
                style={{
                  flex: 1, background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '10px 16px', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 13
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleSimulate}
                disabled={executing}
                style={{
                  flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '10px 16px', color: 'var(--cyan)',
                  fontWeight: 600, cursor: 'pointer', opacity: executing ? 0.6 : 1, fontSize: 13
                }}
              >
                {executing ? 'Simulating...' : 'Simulate'}
              </button>

              {secretKey ? (
                <button
                  onClick={handleLiveExecute}
                  disabled={executing}
                  style={{
                    flex: 1.5, background: 'var(--green, #22c55e)', color: '#0a0a0a', border: 'none',
                    borderRadius: 'var(--radius-sm)', padding: '10px 16px', fontWeight: 700,
                    cursor: 'pointer', opacity: executing ? 0.6 : 1, fontSize: 13
                  }}
                >
                  {executing ? 'Executing...' : 'Execute Live'}
                </button>
              ) : (
                <button
                  onClick={handleMockExecute}
                  disabled={executing}
                  style={{
                    flex: 1.5, background: 'var(--cyan, #06b6d4)', color: '#0a0a0a', border: 'none',
                    borderRadius: 'var(--radius-sm)', padding: '10px 16px', fontWeight: 700,
                    cursor: 'pointer', opacity: executing ? 0.6 : 1, fontSize: 13
                  }}
                >
                  {executing ? 'Executing...' : 'Execute (Mock)'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div style={{
          background: 'var(--green-glow, rgba(34,197,94,0.06))', border: '1px solid var(--green)',
          borderRadius: 'var(--radius-lg)', padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12
        }}>
          <CheckCircle size={20} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: 14 }}>Rebalance Succeeded!</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{successMsg}</div>
            <button 
              onClick={() => setSuccessMsg('')}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, textAlign: 'left', fontSize: 11, marginTop: 4, textDecoration: 'underline' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
