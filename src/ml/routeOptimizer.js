// Reinforcement Learning Route Optimizer for Path Payments
// Uses Q-learning to find optimal routing strategies

class RouteOptimizer {
  constructor(config = {}) {
    this.learningRate = config.learningRate || 0.1;
    this.discountFactor = config.discountFactor || 0.95;
    this.epsilon = config.epsilon || 0.1;
    this.epsilonDecay = config.epsilonDecay || 0.995;
    this.minEpsilon = config.minEpsilon || 0.01;
    this.qTable = new Map();
    this.episodeHistory = [];
  }

  getStateKey(state) {
    return JSON.stringify({
      sourceAsset: state.sourceAsset,
      destAsset: state.destAsset,
      amountBucket: this.bucketAmount(state.amount),
      liquidityBucket: this.bucketLiquidity(state.liquidity),
      feeBucket: this.bucketFee(state.fee),
    });
  }

  bucketAmount(amount) {
    if (amount < 100) return 'small';
    if (amount < 1000) return 'medium';
    if (amount < 10000) return 'large';
    return 'whale';
  }

  bucketLiquidity(liquidity) {
    if (liquidity < 0.3) return 'low';
    if (liquidity < 0.7) return 'medium';
    return 'high';
  }

  bucketFee(fee) {
    if (fee < 0.01) return 'low';
    if (fee < 0.05) return 'medium';
    return 'high';
  }

  getActions(routes) {
    return routes.map((route, index) => ({
      index,
      hops: route.path?.length || 0,
      sourceAmount: parseFloat(route.source_amount || 0),
      destAmount: parseFloat(route.destination_amount || 0),
      estimatedSlippage: this.estimateSlippage(route),
    }));
  }

  estimateSlippage(route) {
    const hops = route.path?.length || 0;
    const baseSlippage = hops * 0.001;
    const amountFactor = parseFloat(route.source_amount || 0) > 10000 ? 0.005 : 0.001;
    return baseSlippage + amountFactor;
  }

  getQValue(stateKey, actionIndex) {
    const key = `${stateKey}:${actionIndex}`;
    return this.qTable.get(key) || 0;
  }

  setQValue(stateKey, actionIndex, value) {
    const key = `${stateKey}:${actionIndex}`;
    this.qTable.set(key, value);
  }

  selectAction(state, routes) {
    const stateKey = this.getStateKey(state);
    const actions = this.getActions(routes);

    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * actions.length);
    }

    let bestAction = 0;
    let bestQ = -Infinity;
    for (let i = 0; i < actions.length; i++) {
      const q = this.getQValue(stateKey, i);
      if (q > bestQ) {
        bestQ = q;
        bestAction = i;
      }
    }
    return bestAction;
  }

  calculateReward(route, executionResult) {
    const destAmount = parseFloat(route.destination_amount || 0);
    const sourceAmount = parseFloat(route.source_amount || 0);
    const expectedDestAmount = parseFloat(executionResult?.expectedDestination || destAmount);

    const priceImprovement = (destAmount - expectedDestAmount) / expectedDestAmount;
    const slippagePenalty = executionResult?.actualSlippage || 0;
    const feeCost = parseFloat(route.source_amount || 0) * 0.001;

    return priceImprovement - slippagePenalty - feeCost;
  }

  updateQValue(state, actionIndex, reward, nextState, nextRoutes) {
    const stateKey = this.getStateKey(state);
    const nextKey = this.getStateKey(nextState);

    const currentQ = this.getQValue(stateKey, actionIndex);
    let maxNextQ = 0;
    if (nextRoutes && nextRoutes.length > 0) {
      for (let i = 0; i < nextRoutes.length; i++) {
        const q = this.getQValue(nextKey, i);
        if (q > maxNextQ) maxNextQ = q;
      }
    }

    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
    this.setQValue(stateKey, actionIndex, newQ);
  }

  optimize(state, routes, executionResult = null) {
    const actionIndex = this.selectAction(state, routes);
    const selectedRoute = routes[actionIndex];

    if (executionResult) {
      const reward = this.calculateReward(selectedRoute, executionResult);
      this.updateQValue(state, actionIndex, reward, state, routes);
    }

    this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);

    return {
      selectedRoute,
      routeIndex: actionIndex,
      confidence: 1 - this.epsilon,
      allRoutes: routes.map((route, i) => ({
        route,
        qValue: this.getQValue(this.getStateKey(state), i),
      })),
    };
  }

  getRouteStats() {
    const stats = {
      totalEntries: this.qTable.size,
      avgQValue: 0,
      maxQValue: -Infinity,
      minQValue: Infinity,
    };

    for (const value of this.qTable.values()) {
      stats.avgQValue += value;
      stats.maxQValue = Math.max(stats.maxQValue, value);
      stats.minQValue = Math.min(stats.minQValue, value);
    }

    stats.avgQValue /= stats.totalEntries || 1;
    return stats;
  }

  save() {
    return {
      qTable: Object.fromEntries(this.qTable),
      config: {
        learningRate: this.learningRate,
        discountFactor: this.discountFactor,
        epsilon: this.epsilon,
        epsilonDecay: this.epsilonDecay,
        minEpsilon: this.minEpsilon,
      },
      stats: this.getRouteStats(),
    };
  }

  static load(data) {
    const optimizer = new RouteOptimizer(data.config);
    optimizer.qTable = new Map(Object.entries(data.qTable));
    return optimizer;
  }
}

module.exports = { RouteOptimizer };
