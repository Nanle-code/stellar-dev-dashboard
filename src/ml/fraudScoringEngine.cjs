const { FraudGraph } = require('./graphAnalysis.cjs');
const { CoordinatedPatternDetector } = require('./coordinatedPatternDetector.cjs');

class FraudScoringEngine {
  constructor() {
    this.weights = {
      graphAnomaly: 0.25,
      communityRisk: 0.2,
      patternRisk: 0.2,
      transactionAnomaly: 0.2,
      temporalRisk: 0.15,
    };
  }

  setWeights(newWeights) {
    this.weights = { ...this.weights, ...newWeights };
  }

  score(graph, transactions, patterns) {
    const graphScore = this._scoreGraphAnomalies(graph);
    const communityScore = this._scoreCommunityRisk(graph);
    const patternScore = this._scorePatterns(patterns);
    const txScore = this._scoreTransactionAnomalies(transactions);
    const temporalScore = this._scoreTemporalAnomalies(transactions);

    const weightedScore =
      this.weights.graphAnomaly * graphScore +
      this.weights.communityRisk * communityScore +
      this.weights.patternRisk * patternScore +
      this.weights.transactionAnomaly * txScore +
      this.weights.temporalRisk * temporalScore;

    const score = Math.min(1, Math.max(0, weightedScore));

    const factors = {
      graphAnomalyScore: graphScore,
      communityRiskScore: communityScore,
      patternRiskScore: patternScore,
      transactionAnomalyScore: txScore,
      temporalRiskScore: temporalScore,
    };

    const severityLevel = this._classifySeverity(score);

    return {
      score,
      severity: severityLevel,
      isFraud: score > 0.6,
      factors,
      details: this._generateScoreDetails(factors),
    };
  }

  scoreTransaction(tx, graphContext) {
    let txScore = 0;
    const reasons = [];

    const amount = parseFloat(tx.amount || 0);
    if (amount > 10000) {
      txScore += 0.2;
      reasons.push({ factor: 'high_value', contribution: 0.2, detail: `Transaction value ${amount} exceeds threshold` });
    }

    if (tx.operation_count && tx.operation_count > 5) {
      txScore += 0.15;
      reasons.push({ factor: 'high_op_count', contribution: 0.15, detail: `${tx.operation_count} operations in single transaction` });
    }

    if (graphContext) {
      const node = graphContext.nodes.get(tx.source_account || tx.from);
      if (node && node.pageRank && node.pageRank > 0.05) {
        txScore += 0.25 * Math.min(1, node.pageRank * 10);
        reasons.push({ factor: 'high_pagerank', contribution: 0.25, detail: `Account has elevated PageRank (${node.pageRank.toFixed(4)})` });
      }
    }

    const senderFreq = tx.senderFreq || 0;
    if (senderFreq === 0 && amount > 1000) {
      txScore += 0.15;
      reasons.push({ factor: 'new_account_high_value', contribution: 0.15, detail: 'New account with high-value transaction' });
    }

    const hour = new Date(tx.timestamp || tx.created_at || Date.now()).getHours();
    if (hour >= 0 && hour <= 5) {
      txScore += 0.1;
      reasons.push({ factor: 'unusual_hour', contribution: 0.1, detail: `Transaction at unusual hour (${hour}:00)` });
    }

    if (tx.inputs && tx.outputs) {
      const ratio = tx.inputs / Math.max(1, tx.outputs);
      if (ratio > 3 || (tx.outputs > 0 && ratio < 0.33)) {
        txScore += 0.15;
        reasons.push({ factor: 'input_output_imbalance', contribution: 0.15, detail: `Input/output ratio of ${ratio.toFixed(2)} is abnormal` });
      }
    }

    const finalScore = Math.min(1, txScore);

    return {
      score: finalScore,
      isFraud: finalScore > 0.6,
      reasons,
    };
  }

  scoreAccounts(accounts, graph) {
    return accounts.map((accountId) => {
      const node = graph.nodes.get(accountId);
      if (!node) return { accountId, score: 0, isSuspicious: false };

      let score = 0;
      const factors = [];

      if (node.pageRank && node.pageRank > 0.02) {
        const prScore = Math.min(0.4, node.pageRank * 5);
        score += prScore;
        factors.push({ name: 'pageRank', value: prScore });
      }

      const communitySize = this._getCommunitySize(accountId, graph);
      if (communitySize >= 5) {
        const communityScore = Math.min(0.2, communitySize * 0.01);
        score += communityScore;
        factors.push({ name: 'communitySize', value: communityScore });
      }

      if (node.degree && node.degree > 10) {
        const degreeScore = Math.min(0.2, node.degree * 0.005);
        score += degreeScore;
        factors.push({ name: 'degree', value: degreeScore });
      }

      const suspiciousEdges = this._countSuspiciousEdges(accountId, graph);
      if (suspiciousEdges > 0) {
        const edgeScore = Math.min(0.3, suspiciousEdges * 0.05);
        score += edgeScore;
        factors.push({ name: 'suspiciousConnections', value: edgeScore });
      }

      const finalScore = Math.min(1, score);
      return {
        accountId,
        score: finalScore,
        isSuspicious: finalScore > 0.5,
        factors,
      };
    });
  }

  _scoreGraphAnomalies(graph) {
    let score = 0;
    const stats = graph.getNetworkStats();

    if (stats.density > 0.3 && stats.nodeCount > 5) {
      score += 0.3;
    }

    if (stats.communityCount > 0 && stats.nodeCount / stats.communityCount < 3) {
      score += 0.2;
    }

    if (stats.averageDegree > 10) {
      score += 0.15;
    }

    const highDegreeNodes = Array.from(graph.nodes.values()).filter(
      (n) => n.degree > stats.averageDegree * 2
    ).length;

    if (highDegreeNodes > stats.nodeCount * 0.1) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  _scoreCommunityRisk(graph) {
    if (!graph.communities || graph.communities.size === 0) {
      graph.detectCommunities();
    }

    let score = 0;
    const communities = Array.from(graph.communities.values());
    const largeCommunities = communities.filter((c) => c.length >= 5);

    if (largeCommunities.length > 0) {
      score += Math.min(0.4, largeCommunities.length * 0.05);
    }

    for (const members of communities) {
      if (members.length >= 10) {
        score += 0.15;
      }
      if (graph._detectCircularFlow(members)) {
        score += 0.3;
      }
    }

    return Math.min(1, score);
  }

  _scorePatterns(patterns) {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.severity === 'high') {
        score += pattern.confidence * 0.25;
      } else if (pattern.severity === 'medium') {
        score += pattern.confidence * 0.15;
      } else {
        score += pattern.confidence * 0.05;
      }
    }
    return Math.min(1, score);
  }

  _scoreTransactionAnomalies(transactions) {
    if (transactions.length === 0) return 0;

    let score = 0;
    const amounts = transactions.map((t) => parseFloat(t.amount || 0)).filter((a) => a > 0);
    if (amounts.length > 0) {
      const sorted = [...amounts].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const outliers = amounts.filter((a) => a > q3 + 1.5 * iqr).length;
      score += Math.min(0.3, outliers * 0.03);
    }

    const highValueTx = transactions.filter((t) => parseFloat(t.amount || 0) > 10000);
    score += Math.min(0.2, highValueTx.length * 0.02);

    const failedTx = transactions.filter((t) => t.successful === false);
    if (transactions.length > 0) {
      const failRate = failedTx.length / transactions.length;
      if (failRate > 0.3) {
        score += Math.min(0.2, failRate * 0.3);
      }
    }

    return Math.min(1, score);
  }

  _scoreTemporalAnomalies(transactions) {
    if (transactions.length < 3) return 0;

    let score = 0;
    const timestamps = transactions
      .map((t) => new Date(t.created_at || t.timestamp || Date.now()).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b);

    if (timestamps.length < 2) return 0;

    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((s, i) => s + i, 0) / intervals.length;
    if (avgInterval < 1000 && intervals.length > 5) {
      score += 0.3;
    }

    const burstWindows = [];
    let burstStart = 0;
    for (let i = 0; i < intervals.length; i++) {
      if (intervals[i] < 5000) {
        if (burstStart === 0) burstStart = i;
      } else {
        if (burstStart > 0) {
          burstWindows.push(i - burstStart + 1);
          burstStart = 0;
        }
      }
    }
    if (burstStart > 0) {
      burstWindows.push(intervals.length - burstStart + 1);
    }

    const maxBurst = Math.max(...burstWindows, 0);
    if (maxBurst >= 5) {
      score += Math.min(0.3, maxBurst * 0.01);
    }

    const hourCounts = new Array(24).fill(0);
    for (const tx of transactions) {
      const h = new Date(tx.created_at || tx.timestamp || Date.now()).getHours();
      hourCounts[h]++;
    }

    const nightTx = hourCounts.slice(0, 6).reduce((s, c) => s + c, 0);
    const nightRatio = nightTx / transactions.length;
    if (nightRatio > 0.5) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  _classifySeverity(score) {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    if (score >= 0.2) return 'low';
    return 'none';
  }

  _generateScoreDetails(factors) {
    return Object.entries(factors).map(([name, value]) => ({
      name,
      value,
      contribution: value > 0.3 ? 'significant' : value > 0.1 ? 'moderate' : 'minor',
    }));
  }

  _getCommunitySize(accountId, graph) {
    if (!graph.communities) return 0;
    for (const [, members] of graph.communities) {
      if (members.includes(accountId)) return members.length;
    }
    return 0;
  }

  _countSuspiciousEdges(accountId, graph) {
    let count = 0;
    for (const edge of graph.edges) {
      if (edge.source === accountId || edge.target === accountId) {
        const amount = parseFloat(edge.amount || 0);
        if (amount > 10000) count++;
        if (edge.source === edge.target) count++;
      }
    }
    return count;
  }
}

module.exports = { FraudScoringEngine };
