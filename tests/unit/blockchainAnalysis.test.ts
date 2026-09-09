import { describe, it, expect } from 'vitest';
import { BlockchainAnalysisService } from '../../src/analysis/blockchainAnalysisService';
import { StellarGraphEngine } from '../../src/analysis/graphEngine';
import { StellarMarketForecaster } from '../../src/analysis/marketForecaster';
import { StellarNLPAnalyzer } from '../../src/analysis/nlpAnalyzer';

describe('Blockchain Analysis Engine', () => {
  it('should resolve known entities and calculate graph flow correctly', () => {
    const graphEngine = new StellarGraphEngine();
    const transactions = [
      { source: 'G1234567890BINANCE', target: 'G9876543210KRAKEN', amount: 500 },
      { source: 'G1234567890BINANCE', target: 'G9876543210KRAKEN', amount: 300 },
      { source: 'G1234567890BINANCE', target: 'G0000000000USER123', amount: 100 },
    ];

    const graph = graphEngine.buildFlowGraph(transactions);

    expect(graph.entities.length).toBe(3);
    expect(graph.edges.length).toBe(2);
    
    const binanceKrakenEdge = graph.edges.find(
      (e) => e.source === 'G1234567890BINANCE' && e.target === 'G9876543210KRAKEN'
    );
    expect(binanceKrakenEdge?.volumeXLM).toBe(800);
    expect(binanceKrakenEdge?.transactionCount).toBe(2);
  });

  it('should forecast market trends based on RSI indicators', () => {
    const forecaster = new StellarMarketForecaster();
    const prices = [10, 9, 8, 7, 6, 5, 4]; // Downward trend -> Oversold RSI
    const volumes = [100000, 200000, 300000];

    const indicators = forecaster.calculateIndicators(prices, volumes, 'XLM/USDC');
    const forecast = forecaster.forecast(indicators);

    expect(indicators.rsi).toBeLessThan(30);
    expect(forecast.predictedTrend).toBe('BULLISH');
    expect(forecast.confidenceScore).toBeGreaterThan(0.6);
  });

  it('should extract sentiment and intent from transaction memo text', () => {
    const nlp = new StellarNLPAnalyzer();
    const result = nlp.analyzeText('Stake XLM for growth and yields!');

    expect(result.sentiment).toBe('POSITIVE');
    expect(result.intent).toBe('STAKING');
    expect(result.detectedKeywords).toContain('growth');
    expect(result.detectedKeywords).toContain('stake');
  });

  it('should generate comprehensive reports for both technical and business audiences', () => {
    const service = new BlockchainAnalysisService();
    const report = service.analyzePlatform(
      [{ source: 'G1234567890BINANCE', target: 'G9876543210KRAKEN', amount: 1000 }],
      [1, 1.1, 1.2, 1.3, 1.4],
      [600000, 700000],
      'XLM/USD',
      'Swap XLM for liquid staking rewards'
    );

    expect(report.businessSummary).toBeDefined();
    expect(report.businessSummary.marketOutlook).toBeDefined();
    expect(report.technicalDetails.networkGraph.entities.length).toBeGreaterThan(0);
    expect(report.technicalDetails.marketIndicators.pair).toBe('XLM/USD');
  });
});