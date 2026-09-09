import { StellarGraphEngine, NetworkGraphData } from './graphEngine';
import { StellarMarketForecaster, ForecastResult, MarketIndicator } from './marketForecaster';
import { StellarNLPAnalyzer, TextSentimentResult } from './nlpAnalyzer';

export interface BusinessSummary {
  marketOutlook: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  overallSentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  keyTakeaway: string;
}

export interface TechnicalReport {
  networkGraph: NetworkGraphData;
  marketIndicators: MarketIndicator;
  rawSentiment: TextSentimentResult;
}

export interface ComprehensiveAnalysisReport {
  timestamp: string;
  businessSummary: BusinessSummary;
  forecast: ForecastResult;
  technicalDetails: TechnicalReport;
}

export class BlockchainAnalysisService {
  private graphEngine = new StellarGraphEngine();
  private marketForecaster = new StellarMarketForecaster();
  private nlpAnalyzer = new StellarNLPAnalyzer();

  public analyzePlatform(
    transactions: { source: string; target: string; amount: number }[],
    prices: number[],
    volumes: number[],
    pair: string,
    sampleMemoText: string
  ): ComprehensiveAnalysisReport {
    // 1. Graph Analysis & Entity Resolution
    const networkGraph = this.graphEngine.buildFlowGraph(transactions);

    // 2. Market Dynamics & Indicators
    const marketIndicators = this.marketForecaster.calculateIndicators(prices, volumes, pair);
    const forecast = this.marketForecaster.forecast(marketIndicators);

    // 3. NLP Analysis
    const rawSentiment = this.nlpAnalyzer.analyzeText(sampleMemoText);

    // 4. Synthesize Business Summary
    const keyTakeaway = `${pair} shows a ${forecast.predictedTrend.toLowerCase()} outlook with ${
      rawSentiment.sentiment.toLowerCase()
    } community sentiment. Network density is currently ${networkGraph.densityScore}.`;

    return {
      timestamp: new Date().toISOString(),
      businessSummary: {
        marketOutlook: forecast.predictedTrend,
        overallSentiment: rawSentiment.sentiment,
        keyTakeaway,
      },
      forecast,
      technicalDetails: {
        networkGraph,
        marketIndicators,
        rawSentiment,
      },
    };
  }
}