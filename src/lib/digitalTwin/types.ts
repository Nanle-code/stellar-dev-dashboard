export interface AccountModel {
  address: string;
  averageBalance: number;
  transactionFrequency: number;
  preferredTokens: string[];
  contractInteractions: string[];
  riskTolerance: number;
  lastActivity: number;
}

export interface SimulationScenario {
  name: string;
  description: string;
  transactions: SimulatedTransaction[];
  marketChanges?: MarketChange[];
}

export interface SimulatedTransaction {
  type: 'payment' | 'contract_invoke' | 'dex_swap' | 'trustline';
  amount?: number;
  token?: string;
  contractId?: string;
  functionName?: string;
}

export interface MarketChange {
  token: string;
  priceChangePercent: number;
}

export interface SimulationResult {
  scenario: string;
  estimatedGas: number;
  balanceImpact: number;
  riskScore: number;
  confidence: number;
  recommendations: string[];
  timestamp: number;
}
