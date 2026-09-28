// Historical Route Performance Tracker
// Tracks and analyzes route execution history

class RouteHistory {
  constructor(config = {}) {
    this.maxEntries = config.maxEntries || 1000;
    this.retentionDays = config.retentionDays || 30;
    this.executions = [];
    this.routeStats = new Map();
    this.assetPairStats = new Map();
  }

  recordExecution(execution) {
    const record = {
      id: this.generateId(),
      timestamp: Date.now(),
      route: execution.route,
      params: execution.params,
      result: execution.result,
      metrics: this.calculateMetrics(execution),
    };

    this.executions.push(record);

    if (this.executions.length > this.maxEntries) {
      this.executions.shift();
    }

    this.updateRouteStats(record);
    this.updateAssetPairStats(record);

    return record;
  }

  calculateMetrics(execution) {
    const { route, params, result } = execution;
    const sourceAmount = parseFloat(route.source_amount || 0);
    const destAmount = parseFloat(result?.actualAmount || route.destination_amount || 0);
    const expectedDestAmount = parseFloat(route.destination_amount || 0);

    return {
      success: result?.success || false,
      actualSlippage: result?.actualSlippage || 0,
      expectedSlippage: result?.expectedSlippage || 0,
      priceImpact: expectedDestAmount > 0 ? (destAmount - expectedDestAmount) / expectedDestAmount : 0,
      executionTime: result?.executionTime || 0,
      feePaid: result?.feePaid || 0,
      sourceAmount,
      destAmount,
      efficiency: sourceAmount > 0 ? destAmount / sourceAmount : 0,
    };
  }

  updateRouteStats(record) {
    const routeKey = this.getRouteKey(record.route);
    if (!this.routeStats.has(routeKey)) {
      this.routeStats.set(routeKey, {
        executions: 0,
        successes: 0,
        totalSlippage: 0,
        totalExecutionTime: 0,
        totalEfficiency: 0,
        lastExecution: null,
        firstExecution: record.timestamp,
      });
    }

    const stats = this.routeStats.get(routeKey);
    stats.executions++;
    if (record.metrics.success) stats.successes++;
    stats.totalSlippage += record.metrics.actualSlippage;
    stats.totalExecutionTime += record.metrics.executionTime;
    stats.totalEfficiency += record.metrics.efficiency;
    stats.lastExecution = record.timestamp;
  }

  updateAssetPairStats(record) {
    const { route } = record;
    const sourceAsset = route.source_asset_code || 'XLM';
    const destAsset = route.destination_asset_code || 'XLM';
    const pairKey = `${sourceAsset}-${destAsset}`;

    if (!this.assetPairStats.has(pairKey)) {
      this.assetPairStats.set(pairKey, {
        executions: 0,
        avgSlippage: 0,
        avgEfficiency: 0,
        bestRoute: null,
        worstRoute: null,
      });
    }

    const stats = this.assetPairStats.get(pairKey);
    stats.executions++;
    stats.avgSlippage = (stats.avgSlippage * (stats.executions - 1) + record.metrics.actualSlippage) / stats.executions;
    stats.avgEfficiency = (stats.avgEfficiency * (stats.executions - 1) + record.metrics.efficiency) / stats.executions;

    if (!stats.bestRoute || record.metrics.efficiency > stats.bestRoute.efficiency) {
      stats.bestRoute = { route: record.route, efficiency: record.metrics.efficiency };
    }
    if (!stats.worstRoute || record.metrics.efficiency < stats.worstRoute.efficiency) {
      stats.worstRoute = { route: record.route, efficiency: record.metrics.efficiency };
    }
  }

  getRouteKey(route) {
    const path = route.path || [];
    return `${route.source_asset_code || 'XLM'}-${route.destination_asset_code || 'XLM'}-${path.length}`;
  }

  generateId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getRoutePerformance(route) {
    const routeKey = this.getRouteKey(route);
    const stats = this.routeStats.get(routeKey);

    if (!stats || stats.executions === 0) {
      return null;
    }

    return {
      executions: stats.executions,
      successRate: stats.successes / stats.executions,
      avgSlippage: stats.totalSlippage / stats.executions,
      avgExecutionTime: stats.totalExecutionTime / stats.executions,
      avgEfficiency: stats.totalEfficiency / stats.executions,
      lastExecution: stats.lastExecution,
      trend: this.calculateTrend(routeKey),
    };
  }

  calculateTrend(routeKey) {
    const recentExecutions = this.executions
      .filter(e => this.getRouteKey(e.route) === routeKey)
      .slice(-10);

    if (recentExecutions.length < 3) return 'stable';

    const recentSuccessRate = recentExecutions.filter(e => e.metrics.success).length / recentExecutions.length;
    const olderExecutions = this.executions
      .filter(e => this.getRouteKey(e.route) === routeKey)
      .slice(-20, -10);

    if (olderExecutions.length === 0) return 'stable';

    const olderSuccessRate = olderExecutions.filter(e => e.metrics.success).length / olderExecutions.length;

    if (recentSuccessRate > olderSuccessRate + 0.1) return 'improving';
    if (recentSuccessRate < olderSuccessRate - 0.1) return 'declining';
    return 'stable';
  }

  getAssetPairPerformance(sourceAsset, destAsset) {
    const pairKey = `${sourceAsset}-${destAsset}`;
    return this.assetPairStats.get(pairKey) || null;
  }

  getTopRoutes(limit = 5) {
    const routePerf = [];
    for (const [key, stats] of this.routeStats.entries()) {
      if (stats.executions >= 3) {
        routePerf.push({
          routeKey: key,
          successRate: stats.successes / stats.executions,
          avgSlippage: stats.totalSlippage / stats.executions,
          avgEfficiency: stats.totalEfficiency / stats.executions,
          executions: stats.executions,
        });
      }
    }

    return routePerf
      .sort((a, b) => b.successRate - a.successRate || a.avgSlippage - b.avgSlippage)
      .slice(0, limit);
  }

  getRecentExecutions(limit = 20) {
    return this.executions.slice(-limit).reverse();
  }

  getAnalytics(timeRange = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - timeRange;
    const recent = this.executions.filter(e => e.timestamp > cutoff);

    if (recent.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        avgSlippage: 0,
        avgExecutionTime: 0,
        topRoutes: [],
      };
    }

    const successes = recent.filter(e => e.metrics.success).length;
    const totalSlippage = recent.reduce((sum, e) => sum + e.metrics.actualSlippage, 0);
    const totalExecTime = recent.reduce((sum, e) => sum + e.metrics.executionTime, 0);

    return {
      totalExecutions: recent.length,
      successRate: successes / recent.length,
      avgSlippage: totalSlippage / recent.length,
      avgExecutionTime: totalExecTime / recent.length,
      topRoutes: this.getTopRoutes(3),
    };
  }

  pruneOldData() {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    this.executions = this.executions.filter(e => e.timestamp > cutoff);
  }

  save() {
    return {
      executions: this.executions.slice(-this.maxEntries),
      routeStats: Object.fromEntries(this.routeStats),
      assetPairStats: Object.fromEntries(this.assetPairStats),
    };
  }

  static load(data) {
    const history = new RouteHistory();
    history.executions = data.executions || [];
    history.routeStats = new Map(Object.entries(data.routeStats || {}));
    history.assetPairStats = new Map(Object.entries(data.assetPairStats || {}));
    return history;
  }
}

module.exports = { RouteHistory };
