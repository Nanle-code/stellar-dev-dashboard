// Slippage Prediction Model for Path Payments
// Uses historical data and real-time conditions to predict slippage

class SlippagePredictor {
  constructor(config = {}) {
    this.lookbackPeriod = config.lookbackPeriod || 100;
    this.volatilityWindow = config.volatilityWindow || 20;
    this.historicalData = new Map();
    this.modelWeights = {
      hopCount: 0.25,
      liquidityDepth: 0.30,
      amountSize: 0.20,
      volatility: 0.15,
      timeOfDay: 0.10,
    };
  }

  addHistoricalData(assetPair, data) {
    if (!this.historicalData.has(assetPair)) {
      this.historicalData.set(assetPair, []);
    }
    const history = this.historicalData.get(assetPair);
    history.push({
      timestamp: Date.now(),
      slippage: data.slippage,
      amount: data.amount,
      liquidity: data.liquidity,
      hops: data.hops,
    });

    if (history.length > this.lookbackPeriod) {
      history.shift();
    }
  }

  calculateVolatility(assetPair) {
    const history = this.historicalData.get(assetPair);
    if (!history || history.length < 2) return 0.5;

    const recent = history.slice(-this.volatilityWindow);
    const slippages = recent.map(d => d.slippage);
    const mean = slippages.reduce((a, b) => a + b, 0) / slippages.length;
    const variance = slippages.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / slippages.length;
    return Math.sqrt(variance);
  }

  getLiquidityScore(liquidity) {
    if (liquidity >= 0.8) return 0.1;
    if (liquidity >= 0.5) return 0.3;
    if (liquidity >= 0.3) return 0.5;
    return 0.8;
  }

  getAmountScore(amount) {
    if (amount < 100) return 0.1;
    if (amount < 1000) return 0.2;
    if (amount < 10000) return 0.4;
    if (amount < 100000) return 0.6;
    return 0.9;
  }

  getTimeOfDayScore() {
    const hour = new Date().getHours();
    if (hour >= 8 && hour <= 16) return 0.2;
    if (hour >= 16 && hour <= 20) return 0.4;
    return 0.6;
  }

  predictSlippage(route, context = {}) {
    const hops = route.path?.length || 0;
    const amount = parseFloat(route.source_amount || 0);
    const liquidity = context.liquidity || 0.5;
    const assetPair = `${route.source_asset_code || 'XLM'}-${route.destination_asset_code || 'XLM'}`;

    const hopScore = Math.min(1, hops * 0.15);
    const liquidityScore = this.getLiquidityScore(liquidity);
    const amountScore = this.getAmountScore(amount);
    const volatilityScore = this.calculateVolatility(assetPair);
    const timeScore = this.getTimeOfDayScore();

    const rawSlippage =
      hopScore * this.modelWeights.hopCount +
      liquidityScore * this.modelWeights.liquidityDepth +
      amountScore * this.modelWeights.amountSize +
      volatilityScore * this.modelWeights.volatility +
      timeScore * this.modelWeights.timeOfDay;

    const historicalAdjustment = this.getHistoricalAdjustment(assetPair);
    const predictedSlippage = Math.min(0.1, Math.max(0, rawSlippage + historicalAdjustment));

    return {
      predictedSlippage,
      confidence: this.calculateConfidence(assetPair),
      breakdown: {
        hopContribution: hopScore * this.modelWeights.hopCount,
        liquidityContribution: liquidityScore * this.modelWeights.liquidityDepth,
        amountContribution: amountScore * this.modelWeights.amountSize,
        volatilityContribution: volatilityScore * this.modelWeights.volatility,
        timeContribution: timeScore * this.modelWeights.timeOfDay,
      },
      riskLevel: this.getRiskLevel(predictedSlippage),
    };
  }

  getHistoricalAdjustment(assetPair) {
    const history = this.historicalData.get(assetPair);
    if (!history || history.length < 5) return 0;

    const recent = history.slice(-10);
    const avgSlippage = recent.reduce((sum, d) => sum + d.slippage, 0) / recent.length;
    return (avgSlippage - 0.02) * 0.3;
  }

  calculateConfidence(assetPair) {
    const history = this.historicalData.get(assetPair);
    if (!history) return 0.3;
    if (history.length < 10) return 0.5;
    if (history.length < 50) return 0.7;
    return 0.9;
  }

  getRiskLevel(slippage) {
    if (slippage < 0.01) return 'low';
    if (slippage < 0.03) return 'medium';
    if (slippage < 0.05) return 'high';
    return 'critical';
  }

  getRecommendedSlippageTolerance(slippage, riskLevel) {
    const multipliers = {
      low: 1.5,
      medium: 2.0,
      high: 2.5,
      critical: 3.0,
    };
    return slippage * (multipliers[riskLevel] || 2.0);
  }

  save() {
    return {
      historicalData: Object.fromEntries(this.historicalData),
      modelWeights: this.modelWeights,
    };
  }

  static load(data) {
    const predictor = new SlippagePredictor();
    predictor.historicalData = new Map(Object.entries(data.historicalData));
    predictor.modelWeights = data.modelWeights;
    return predictor;
  }
}

module.exports = { SlippagePredictor };
