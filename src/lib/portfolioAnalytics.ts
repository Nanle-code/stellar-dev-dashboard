export interface HistoricalPerformancePoint {
  date: string;
  value: number;
  xlmPrice?: number;
}

export interface PortfolioSummary {
  totalValue: string;
  totalChange24h: string;
  totalChangePercent24h: number;
  assetCount: number;
  xlmBalance: string;
  assetBalances: Array<{
    assetCode: string;
    issuer: string;
    balance: string;
    value: string;
    change24h: string;
  }>;
}

export interface PortfolioPrediction {
  predictedValue: string;
  confidence: number;
  timeframe: string;
  factors: string[];
}

export interface PredictionAlert {
  id: string;
  type: 'threshold' | 'trend' | 'anomaly';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

export async function fetchHistoricalPerformance(
  _address: string,
  _days: number = 30
): Promise<HistoricalPerformancePoint[]> {
  return [];
}

export function generatePortfolioSummary(
  _accountData: unknown,
  _assetData: unknown,
  _priceData: unknown
): PortfolioSummary {
  return {
    totalValue: '0',
    totalChange24h: '0',
    totalChangePercent24h: 0,
    assetCount: 0,
    xlmBalance: '0',
    assetBalances: [],
  };
}

export function generatePortfolioPredictions(
  _historicalData: HistoricalPerformancePoint[],
  _timeframe: string = '7d'
): PortfolioPrediction {
  return {
    predictedValue: '0',
    confidence: 0,
    timeframe,
    factors: ['Insufficient data for prediction'],
  };
}

export function evaluatePredictionAlerts(
  _predictions: PortfolioPrediction[],
  _currentValue: string
): PredictionAlert[] {
  return [];
}