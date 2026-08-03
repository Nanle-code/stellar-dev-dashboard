import { AccountDigitalTwin } from './accountDigitalTwin';
import type { SimulationScenario, SimulationResult } from './types';

export class SimulationEngine {
  private twin: AccountDigitalTwin;

  constructor(twin: AccountDigitalTwin) {
    this.twin = twin;
  }

  async simulate(scenario: SimulationScenario): Promise<SimulationResult> {
    const riskScore = await this.twin.predictRiskScore();
    let totalGas = 0;
    let totalImpact = 0;

    for (const tx of scenario.transactions) {
      totalGas += this.estimateGas(tx);
      if (tx.amount) {
        const impact = await this.twin.predictBalanceImpact(tx.amount);
        totalImpact += impact;
      }
    }

    if (scenario.marketChanges) {
      for (const change of scenario.marketChanges) {
        totalImpact *= (1 + change.priceChangePercent / 100);
      }
    }

    const confidence = this.calculateConfidence(scenario.transactions.length, riskScore);

    return {
      scenario: scenario.name,
      estimatedGas: totalGas,
      balanceImpact: Math.round(totalImpact * 100) / 100,
      riskScore,
      confidence,
      recommendations: this.generateRecommendations(riskScore, totalGas),
      timestamp: Date.now(),
    };
  }

  private estimateGas(tx: SimulationScenario['transactions'][0]): number {
    const baseEstimates: Record<string, number> = {
      payment: 100,
      contract_invoke: 5000,
      dex_swap: 2000,
      trustline: 300,
    };
    return baseEstimates[tx.type] ?? 500;
  }

  private calculateConfidence(txCount: number, riskScore: number): number {
    const baseConfidence = 0.85;
    const txDampening = 1 - txCount * 0.02;
    const riskAdjustment = riskScore > 0.7 ? 0.9 : 1;
    return Math.round(baseConfidence * txDampening * riskAdjustment * 100) / 100;
  }

  private generateRecommendations(riskScore: number, gas: number): string[] {
    const recs: string[] = [];
    if (riskScore > 0.7) recs.push('Consider splitting into smaller transactions');
    if (gas > 10000) recs.push('Batch transactions to save gas');
    if (riskScore < 0.3) recs.push('Low risk — safe to proceed');
    if (recs.length === 0) recs.push('Transaction looks normal');
    return recs;
  }
}
