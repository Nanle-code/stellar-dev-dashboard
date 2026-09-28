// Multi-Criteria Route Ranking System
// Ranks routes by speed, cost, reliability, and other factors

class RouteRanker {
  constructor(config = {}) {
    this.criteria = config.criteria || {
      cost: { weight: 0.35, maximize: false },
      speed: { weight: 0.25, maximize: true },
      reliability: { weight: 0.25, maximize: true },
      slippage: { weight: 0.15, maximize: false },
    };
    this.historicalPerformance = new Map();
  }

  normalizeValue(value, min, max) {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  }

  calculateCostScore(route) {
    const sourceAmount = parseFloat(route.source_amount || 0);
    const destAmount = parseFloat(route.destination_amount || 0);
    if (destAmount === 0) return 0;
    const effectivePrice = sourceAmount / destAmount;
    return effectivePrice;
  }

  calculateSpeedScore(route) {
    const hops = route.path?.length || 0;
    const baseScore = Math.max(0, 1 - hops * 0.15);
    const historicalSpeed = this.getHistoricalSpeed(route);
    return baseScore * 0.7 + historicalSpeed * 0.3;
  }

  calculateReliabilityScore(route) {
    const routeKey = this.getRouteKey(route);
    const history = this.historicalPerformance.get(routeKey);
    if (!history || history.length === 0) return 0.5;

    const successRate = history.filter(h => h.success).length / history.length;
    const avgSlippage = history.reduce((sum, h) => sum + h.slippage, 0) / history.length;
    const consistency = 1 - Math.min(1, this.calculateVariability(history));

    return successRate * 0.5 + (1 - avgSlippage * 10) * 0.3 + consistency * 0.2;
  }

  calculateSlippageScore(route, slippagePrediction) {
    const predictedSlippage = slippagePrediction?.predictedSlippage || 0.02;
    return 1 - Math.min(1, predictedSlippage * 10);
  }

  calculateVariability(history) {
    if (history.length < 2) return 0;
    const slippages = history.map(h => h.slippage);
    const mean = slippages.reduce((a, b) => a + b, 0) / slippages.length;
    const variance = slippages.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / slippages.length;
    return Math.sqrt(variance);
  }

  getHistoricalSpeed(route) {
    const routeKey = this.getRouteKey(route);
    const history = this.historicalPerformance.get(routeKey);
    if (!history || history.length === 0) return 0.5;

    const recentExecutions = history.slice(-10);
    const avgExecutionTime = recentExecutions.reduce((sum, h) => sum + (h.executionTime || 0), 0) / recentExecutions.length;
    return Math.max(0, 1 - avgExecutionTime / 30000);
  }

  getRouteKey(route) {
    const path = route.path || [];
    return `${route.source_asset_code || 'XLM'}-${route.destination_asset_code || 'XLM'}-${path.length}`;
  }

  rankRoutes(routes, slippagePredictions = []) {
    if (routes.length === 0) return [];

    const scores = routes.map((route, index) => {
      const slippagePred = slippagePredictions[index];
      return {
        route,
        originalIndex: index,
        scores: {
          cost: this.calculateCostScore(route),
          speed: this.calculateSpeedScore(route),
          reliability: this.calculateReliabilityScore(route),
          slippage: this.calculateSlippageScore(route, slippagePred),
        },
      };
    });

    const normalizedScores = this.normalizeScores(scores);

    const ranked = normalizedScores.map(item => {
      let weightedScore = 0;
      for (const [criterion, config] of Object.entries(this.criteria)) {
        const score = item.scores[criterion];
        const normalized = config.maximize ? score : 1 - score;
        weightedScore += normalized * config.weight;
      }
      return {
        ...item,
        overallScore: weightedScore,
        rank: 0,
      };
    });

    ranked.sort((a, b) => b.overallScore - a.overallScore);
    ranked.forEach((item, index) => {
      item.rank = index + 1;
    });

    return ranked;
  }

  normalizeScores(scores) {
    const criteriaNames = Object.keys(this.criteria);
    const mins = {};
    const maxs = {};

    for (const criterion of criteriaNames) {
      const values = scores.map(s => s.scores[criterion]);
      mins[criterion] = Math.min(...values);
      maxs[criterion] = Math.max(...values);
    }

    return scores.map(item => {
      const normalized = { ...item.scores };
      for (const criterion of criteriaNames) {
        normalized[criterion] = this.normalizeValue(
          item.scores[criterion],
          mins[criterion],
          maxs[criterion]
        );
      }
      return { ...item, scores: normalized };
    });
  }

  addHistoricalExecution(route, executionData) {
    const routeKey = this.getRouteKey(route);
    if (!this.historicalPerformance.has(routeKey)) {
      this.historicalPerformance.set(routeKey, []);
    }

    const history = this.historicalPerformance.get(routeKey);
    history.push({
      timestamp: Date.now(),
      success: executionData.success,
      slippage: executionData.slippage || 0,
      executionTime: executionData.executionTime || 0,
      actualAmount: executionData.actualAmount || 0,
    });

    if (history.length > 100) {
      history.shift();
    }
  }

  getRouteInsights(route) {
    const routeKey = this.getRouteKey(route);
    const history = this.historicalPerformance.get(routeKey);

    if (!history || history.length === 0) {
      return {
        hasHistory: false,
        insight: 'No historical data available for this route.',
      };
    }

    const successRate = history.filter(h => h.success).length / history.length;
    const avgSlippage = history.reduce((sum, h) => sum + h.slippage, 0) / history.length;
    const avgExecutionTime = history.reduce((sum, h) => sum + h.executionTime, 0) / history.length;
    const recentTrend = this.calculateRecentTrend(history);

    return {
      hasHistory: true,
      successRate,
      avgSlippage,
      avgExecutionTime,
      recentTrend,
      executionCount: history.length,
      insight: this.generateInsight(successRate, avgSlippage, recentTrend),
    };
  }

  calculateRecentTrend(history) {
    if (history.length < 5) return 'stable';
    const recent = history.slice(-5);
    const older = history.slice(-10, -5);

    if (older.length === 0) return 'stable';

    const recentSuccess = recent.filter(h => h.success).length / recent.length;
    const olderSuccess = older.filter(h => h.success).length / older.length;

    if (recentSuccess > olderSuccess + 0.1) return 'improving';
    if (recentSuccess < olderSuccess - 0.1) return 'declining';
    return 'stable';
  }

  generateInsight(successRate, avgSlippage, trend) {
    const parts = [];

    if (successRate > 0.9) parts.push('Highly reliable route');
    else if (successRate > 0.7) parts.push('Generally reliable');
    else parts.push('Use with caution');

    if (avgSlippage < 0.01) parts.push('minimal slippage');
    else if (avgSlippage < 0.03) parts.push('moderate slippage');
    else parts.push('expect significant slippage');

    if (trend === 'improving') parts.push('performance improving');
    else if (trend === 'declining') parts.push('performance declining');

    return parts.join(' - ');
  }

  save() {
    return {
      criteria: this.criteria,
      historicalPerformance: Object.fromEntries(this.historicalPerformance),
    };
  }

  static load(data) {
    const ranker = new RouteRanker({ criteria: data.criteria });
    ranker.historicalPerformance = new Map(Object.entries(data.historicalPerformance));
    return ranker;
  }
}

module.exports = { RouteRanker };
