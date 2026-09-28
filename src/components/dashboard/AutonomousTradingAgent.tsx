import React, { useMemo, useState } from 'react';
import {
  createDefaultAgentConfig,
  createInitialAgentState,
  type AgentConfig,
  type AgentState,
  type TradingSignal,
  buildTradePlan,
  optimizeStrategyWeights,
} from '../../lib/tradingAgent';

const BASE_SIGNAL: TradingSignal = {
  symbol: 'XLM',
  price: 0.12,
  trend: 0.78,
  momentum: 0.71,
  volatility: 0.14,
  volume: 0.64,
  sentiment: 0.69,
};

export default function AutonomousTradingAgent() {
  const [config, setConfig] = useState<AgentConfig>(createDefaultAgentConfig());
  const [state, setState] = useState<AgentState>(() => createInitialAgentState(10000));
  const [signal, setSignal] = useState<TradingSignal>(BASE_SIGNAL);
  const [lastPlan, setLastPlan] = useState(() => buildTradePlan(BASE_SIGNAL, createDefaultAgentConfig(), createInitialAgentState(10000)));

  const plan = useMemo(() => buildTradePlan(signal, config, state), [config, signal, state]);

  const applyLearning = () => {
    const updated = optimizeStrategyWeights(
      {
        symbol: signal.symbol,
        action: plan.action === 'buy' ? 'buy' : 'sell',
        realizedPnl: plan.action === 'buy' ? 180 : -85,
        returnPct: plan.action === 'buy' ? 0.018 : -0.0085,
      },
      state,
      config
    );
    setState(updated);
    setLastPlan(plan);
  };

  return (
    <div style={{ display: 'grid', gap: '16px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px' }}>Autonomous Trading Agent</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>
            Reinforcement-learning inspired execution with risk controls, adaptive strategy weights, and continuous learning.
          </p>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: '999px', background: 'rgba(6, 182, 212, 0.14)', color: 'var(--cyan)' }}>
          Status: {plan.action.toUpperCase()}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', background: 'var(--bg-card)' }}>
          <h3 style={{ marginTop: 0 }}>Live signal</h3>
          <div style={{ display: 'grid', gap: '8px' }}>
            {Object.entries(signal).filter(([key]) => key !== 'symbol').map(([key, value]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{key}</span>
                <strong>{typeof value === 'number' ? value.toFixed(3) : value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', background: 'var(--bg-card)' }}>
          <h3 style={{ marginTop: 0 }}>Agent state</h3>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Capital</span><strong>${state.capital.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Win rate</span><strong>{(state.winRate * 100).toFixed(1)}%</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Trades</span><strong>{state.totalTrades}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Drawdown</span><strong>{(state.drawdown * 100).toFixed(1)}%</strong></div>
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', background: 'var(--bg-card)' }}>
        <h3 style={{ marginTop: 0 }}>Execution plan</h3>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Action</span><strong>{plan.action}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Confidence</span><strong>{(plan.confidence * 100).toFixed(1)}%</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Position size</span><strong>{plan.positionSize.toFixed(3)} units</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Stop-loss</span><strong>${plan.stopLoss.toFixed(4)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Take-profit</span><strong>${plan.takeProfit.toFixed(4)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Risk score</span><strong>{(plan.riskScore * 100).toFixed(1)}%</strong></div>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>{plan.rationale}</p>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', background: 'var(--bg-card)' }}>
        <h3 style={{ marginTop: 0 }}>Risk controls</h3>
        <div style={{ display: 'grid', gap: '10px' }}>
          <label>
            <span style={{ display: 'block', marginBottom: '4px' }}>Max position size (% of capital)</span>
            <input type="range" min="0.05" max="0.4" step="0.01" value={config.maxPositionSizePct} onChange={(event) => setConfig({ ...config, maxPositionSizePct: Number(event.target.value) })} style={{ width: '100%' }} />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: '4px' }}>Risk per trade (% of capital)</span>
            <input type="range" min="0.005" max="0.03" step="0.001" value={config.riskPerTradePct} onChange={(event) => setConfig({ ...config, riskPerTradePct: Number(event.target.value) })} style={{ width: '100%' }} />
          </label>
          <label>
            <span style={{ display: 'block', marginBottom: '4px' }}>Stop loss (%)</span>
            <input type="range" min="0.03" max="0.12" step="0.01" value={config.stopLossPct} onChange={(event) => setConfig({ ...config, stopLossPct: Number(event.target.value) })} style={{ width: '100%' }} />
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button type="button" onClick={applyLearning} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: 'var(--cyan)', color: '#04111b', fontWeight: 700, cursor: 'pointer' }}>
          Simulate learning update
        </button>
        <div style={{ color: 'var(--text-secondary)' }}>
          Last update: {lastPlan.action} @ {(lastPlan.confidence * 100).toFixed(1)}% confidence
        </div>
      </div>
    </div>
  );
}
