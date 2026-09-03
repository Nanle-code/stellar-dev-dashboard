// Route Explanation Generator
// Generates human-readable explanations for route recommendations

class RouteExplanation {
  constructor() {
    this.templates = {
      hopCount: {
        low: 'This route uses {hops} intermediate step{s}, minimizing complexity.',
        medium: 'This route uses {hops} intermediate steps, balancing simplicity and cost.',
        high: 'This route requires {hops} intermediate hops, which may increase slippage.',
      },
      cost: {
        low: 'This route offers the best value with {savings}% savings compared to alternatives.',
        medium: 'This route provides competitive pricing.',
        high: 'This route is more expensive but offers other advantages.',
      },
      slippage: {
        low: 'Expected slippage is minimal ({slippage}%).',
        medium: 'Moderate slippage expected ({slippage}%).',
        high: 'Higher slippage risk ({slippage}%) due to market conditions.',
      },
      reliability: {
        high: 'This route has a {successRate}% success rate based on historical data.',
        medium: 'This route has shown mixed reliability.',
        low: 'Limited historical data for this route - proceed with caution.',
      },
    };
  }

  generateExplanation(rankedRoute, context = {}) {
    const { route, scores, overallScore } = rankedRoute;
    const hops = route.path?.length || 0;
    const sourceAmount = parseFloat(route.source_amount || 0);
    const destAmount = parseFloat(route.destination_amount || 0);

    const explanation = {
      summary: this.generateSummary(rankedRoute),
      factors: this.generateFactors(rankedRoute, context),
      recommendation: this.generateRecommendation(rankedRoute),
      confidence: this.calculateConfidence(rankedRoute),
      warnings: this.generateWarnings(rankedRoute, context),
    };

    return explanation;
  }

  generateSummary(rankedRoute) {
    const { route, overallScore, rank } = rankedRoute;
    const hops = route.path?.length || 0;
    const destAmount = parseFloat(route.destination_amount || 0);
    const sourceAmount = parseFloat(route.source_amount || 0);

    const efficiency = sourceAmount > 0 ? (destAmount / sourceAmount * 100).toFixed(1) : 0;

    if (rank === 1) {
      return `This is the recommended route with ${hops} hop${hops !== 1 ? 's' : ''} and ${efficiency}% efficiency.`;
    }
    return `Route ranked #${rank} with ${hops} hop${hops !== 1 ? 's' : ''} and ${efficiency}% efficiency.`;
  }

  generateFactors(rankedRoute, context) {
    const factors = [];
    const { route, scores } = rankedRoute;
    const hops = route.path?.length || 0;

    if (scores.cost > 0.7) {
      factors.push({
        type: 'positive',
        label: 'Cost Efficiency',
        detail: 'This route provides excellent value for your transaction.',
      });
    } else if (scores.cost < 0.3) {
      factors.push({
        type: 'negative',
        label: 'Cost Efficiency',
        detail: 'This route is more expensive than alternatives.',
      });
    }

    if (hops <= 2) {
      factors.push({
        type: 'positive',
        label: 'Simplicity',
        detail: `Only ${hops} intermediate step${hops !== 1 ? 's' : ''} reduces potential failure points.`,
      });
    } else if (hops >= 4) {
      factors.push({
        type: 'warning',
        label: 'Complexity',
        detail: `${hops} hops increase the risk of slippage and failed execution.`,
      });
    }

    if (context.slippagePrediction) {
      const slippage = context.slippagePrediction.predictedSlippage;
      if (slippage < 0.01) {
        factors.push({
          type: 'positive',
          label: 'Low Slippage Risk',
          detail: `Predicted slippage of ${(slippage * 100).toFixed(2)}% is minimal.`,
        });
      } else if (slippage > 0.03) {
        factors.push({
          type: 'warning',
          label: 'Slippage Risk',
          detail: `Predicted slippage of ${(slippage * 100).toFixed(2)}% may affect your output.`,
        });
      }
    }

    if (scores.reliability > 0.8) {
      factors.push({
        type: 'positive',
        label: 'Reliability',
        detail: 'This route has a strong track record of successful executions.',
      });
    }

    if (scores.speed > 0.8) {
      factors.push({
        type: 'positive',
        label: 'Speed',
        detail: 'This route typically executes quickly.',
      });
    }

    return factors;
  }

  generateRecommendation(rankedRoute) {
    const { overallScore, rank } = rankedRoute;

    if (rank === 1 && overallScore > 0.8) {
      return 'Strongly recommended - this route offers the best balance of cost, speed, and reliability.';
    }
    if (rank === 1) {
      return 'Recommended as the best available option for your transaction.';
    }
    if (overallScore > 0.7) {
      return 'A solid alternative if the primary route is unavailable.';
    }
    if (overallScore > 0.5) {
      return 'Consider this route if you need redundancy or specific asset pairs.';
    }
    return 'Other routes may be more suitable for your transaction.';
  }

  calculateConfidence(rankedRoute) {
    const { scores, overallScore } = rankedRoute;
    const scoreValues = Object.values(scores);
    const variance = scoreValues.reduce((sum, val) => sum + Math.pow(val - overallScore, 2), 0) / scoreValues.length;
    const consistency = 1 - Math.min(1, variance * 2);
    return Math.round((overallScore * 0.6 + consistency * 0.4) * 100);
  }

  generateWarnings(rankedRoute, context) {
    const warnings = [];
    const { route, scores } = rankedRoute;
    const hops = route.path?.length || 0;

    if (hops >= 4) {
      warnings.push('Multi-hop routes have higher failure risk.');
    }

    if (context.slippagePrediction?.riskLevel === 'high' || context.slippagePrediction?.riskLevel === 'critical') {
      warnings.push('Consider setting a higher slippage tolerance for this route.');
    }

    const sourceAmount = parseFloat(route.source_amount || 0);
    if (sourceAmount > 50000) {
      warnings.push('Large transactions may experience higher slippage.');
    }

    if (scores.reliability < 0.5) {
      warnings.push('Limited historical data - route may not perform as expected.');
    }

    return warnings;
  }

  generateComparisonExplanation(topRoutes) {
    if (topRoutes.length < 2) return null;

    const [best, second] = topRoutes;
    const costDiff = ((best.scores.cost - second.scores.cost) * 100).toFixed(1);
    const reliabilityDiff = ((best.scores.reliability - second.scores.reliability) * 100).toFixed(1);

    return {
      summary: `Route #1 is ${Math.abs(costDiff)}% ${costDiff > 0 ? 'more' : 'less'} cost-effective than Route #2.`,
      tradeoffs: [
        costDiff > 0
          ? 'Route #1 offers better pricing.'
          : 'Route #2 offers better pricing.',
        reliabilityDiff > 0
          ? 'Route #1 has better historical reliability.'
          : 'Route #2 has better historical reliability.',
      ],
      bestFor: {
        costOptimal: best,
        reliabilityOptimal: best.scores.reliability > second.scores.reliability ? best : second,
      },
    };
  }
}

module.exports = { RouteExplanation };
