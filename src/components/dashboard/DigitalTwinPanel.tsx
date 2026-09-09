import React, { useState, useCallback } from 'react';
import { AccountDigitalTwin, SimulationEngine, type SimulationScenario, type SimulationResult } from '../../lib/digitalTwin';

interface Props {
  accountAddress: string;
}

export const DigitalTwinPanel: React.FC<Props> = ({ accountAddress }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const twin = new AccountDigitalTwin({
        address: accountAddress,
        averageBalance: 5000,
        transactionFrequency: 25,
        preferredTokens: ['XLM', 'USDC'],
        contractInteractions: ['swap', 'stake'],
        riskTolerance: 0.4,
        lastActivity: Date.now(),
      });

      const engine = new SimulationEngine(twin);
      const scenario: SimulationScenario = {
        name: 'Daily Activity Forecast',
        description: 'Simulate typical daily transaction patterns',
        transactions: [
          { type: 'payment', amount: 100, token: 'XLM' },
          { type: 'dex_swap', amount: 250, token: 'USDC' },
          { type: 'contract_invoke', contractId: 'swap_router' },
        ],
        marketChanges: [{ token: 'XLM', priceChangePercent: -2.5 }],
      };

      const simulationResult = await engine.simulate(scenario);
      setResult(simulationResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [accountAddress]);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Digital Twin Simulation</h2>

      <button
        onClick={runSimulation}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {loading ? 'Running Simulation...' : 'Run Simulation'}
      </button>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-gray-400">Estimated Gas</p>
              <p className="text-lg font-bold text-white">{result.estimatedGas.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-gray-400">Balance Impact</p>
              <p className="text-lg font-bold">
                {result.balanceImpact}
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-gray-400">Risk Score</p>
              <p className="text-lg font-bold text-yellow-400">{result.riskScore}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-gray-400">Confidence</p>
              <p className="text-lg font-bold text-blue-400">{Math.round(result.confidence * 100)}%</p>
            </div>
          </div>

          {result.recommendations.length > 0 && (
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-xs text-gray-400 mb-2">Recommendations</p>
              <ul className="space-y-1">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
