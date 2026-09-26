const { FraudGraph } = require('./graphAnalysis.cjs');

class CoordinatedPatternDetector {
  constructor() {
    this.patterns = [];
    this.confidenceThreshold = 0.6;
  }

  detectAll(graph, transactions) {
    this.patterns = [];
    this.patterns.push(...this._detectCircularTrading(graph));
    this.patterns.push(...this._detectFanOutFanIn(graph));
    this.patterns.push(...this._detectBurstActivity(graph));
    this.patterns.push(...this._detectSelfFeeding(graph));
    this.patterns.push(...this._detectAmountClustering(transactions));
    this.patterns.push(...this._detectTemporalCoordination(transactions));
    this.patterns.push(...this._detectSyntheticVolume(graph, transactions));

    return this.patterns;
  }

  _detectCircularTrading(graph) {
    const patterns = [];
    if (!graph.communities) graph.detectCommunities();

    for (const [communityId, members] of graph.communities) {
      if (members.length < 3) continue;

      const hasCycle = graph._detectCircularFlow(members);
      if (hasCycle) {
        const subgraphEdges = graph.edges.filter(
          (e) => members.includes(e.source) && members.includes(e.target)
        );
        patterns.push({
          type: 'circular_trading',
          severity: 'high',
          confidence: Math.min(0.95, 0.5 + members.length * 0.05),
          description: `Circular trading detected among ${members.length} accounts`,
          accounts: members,
          transactionCount: subgraphEdges.length,
          evidence: subgraphEdges.slice(0, 10).map((e) => ({
            from: e.source,
            to: e.target,
            amount: e.amount,
            timestamp: e.timestamp,
          })),
          recommendation: 'Investigate potential wash trading or sybil attack',
        });
      }
    }

    return patterns;
  }

  _detectFanOutFanIn(graph) {
    const patterns = [];
    const degreeThreshold = 5;

    for (const [nodeId, node] of graph.nodes) {
      const neighbors = Array.from(graph.adjacencyList.get(nodeId) || []);
      if (neighbors.length < degreeThreshold) continue;

      const incoming = graph.edges.filter((e) => e.target === nodeId);
      const outgoing = graph.edges.filter((e) => e.source === nodeId);

      if (incoming.length >= degreeThreshold && outgoing.length >= degreeThreshold) {
        const commonNeighbors = new Set();
        for (const e of incoming) commonNeighbors.add(e.source);
        for (const e of outgoing) commonNeighbors.add(e.target);
        const overlap = Array.from(commonNeighbors).filter(
          (n) => neighbors.includes(n)
        );

        patterns.push({
          type: 'fan_out_fan_in',
          severity: 'medium',
          confidence: Math.min(0.9, 0.4 + overlap.length * 0.02),
          description: `Account ${nodeId} exhibits fan-out (${outgoing.length}) and fan-in (${incoming.length}) pattern`,
          centralAccount: nodeId,
          inboundCount: incoming.length,
          outboundCount: outgoing.length,
          overlappingCount: overlap.length,
          recommendation: 'Review for money laundering or layering activity',
        });
      }
    }

    return patterns;
  }

  _detectBurstActivity(graph) {
    const patterns = [];
    const bursts = graph.findBurstTransactions(60000, 5);

    for (const burst of bursts) {
      if (burst.uniqueParticipants >= 3) {
        patterns.push({
          type: 'coordinated_burst',
          severity: 'high',
          confidence: Math.min(0.95, 0.4 + burst.transactionCount * 0.03),
          description: `Coordinated burst of ${burst.transactionCount} transactions from ${burst.uniqueParticipants} accounts in short time window`,
          timeWindow: burst.timeWindow,
          transactionCount: burst.transactionCount,
          uniqueParticipants: burst.uniqueParticipants,
          recommendation: 'Likely coordinated attack or automated activity',
        });
      }
    }

    return patterns;
  }

  _detectSelfFeeding(graph) {
    const patterns = [];

    for (const edge of graph.edges) {
      if (edge.source === edge.target) {
        patterns.push({
          type: 'self_feeding',
          severity: 'low',
          confidence: 0.8,
          description: `Self-feeding transaction by account ${edge.source}`,
          account: edge.source,
          amount: edge.amount,
          timestamp: edge.timestamp,
          recommendation: 'Monitor for balance manipulation',
        });
      }
    }

    return patterns;
  }

  _detectAmountClustering(transactions) {
    const patterns = [];
    const amountBuckets = new Map();

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount || 0);
      if (amount <= 0) continue;
      const bucket = Math.round(amount);
      if (!amountBuckets.has(bucket)) {
        amountBuckets.set(bucket, []);
      }
      amountBuckets.get(bucket).push(tx);
    }

    for (const [amount, txs] of amountBuckets) {
      if (txs.length >= 5) {
        const uniqueSenders = new Set(txs.map((t) => t.source_account || t.from));
        const uniqueRecipients = new Set(
          txs.flatMap((t) => t.recipients || (t.to ? [t.to] : []))
        );

        if (uniqueSenders.size >= 3 || uniqueRecipients.size >= 3) {
          patterns.push({
            type: 'amount_clustering',
            severity: 'medium',
            confidence: Math.min(0.85, 0.3 + txs.length * 0.03),
            description: `${txs.length} transactions at exactly ${amount} units from ${uniqueSenders.size} senders to ${uniqueRecipients.size} recipients`,
            amount,
            transactionCount: txs.length,
            uniqueSenders: uniqueSenders.size,
            uniqueRecipients: uniqueRecipients.size,
            sampleTransactions: txs.slice(0, 5).map((t) => ({
              id: t.id,
              from: t.source_account || t.from,
              to: t.to,
              amount: t.amount,
            })),
            recommendation: 'Suspicious fixed-amount pattern, possible coordinated activity',
          });
        }
      }
    }

    return patterns;
  }

  _detectTemporalCoordination(transactions) {
    const patterns = [];
    const timeBuckets = new Map();

    for (const tx of transactions) {
      const ts = new Date(tx.created_at || tx.timestamp || Date.now());
      const bucket = Math.floor(ts.getTime() / 1000);

      if (!timeBuckets.has(bucket)) {
        timeBuckets.set(bucket, []);
      }
      timeBuckets.get(bucket).push(tx);
    }

    for (const [timestamp, txs] of timeBuckets) {
      if (txs.length >= 4) {
        const uniqueSenders = new Set(txs.map((t) => t.source_account || t.from));
        const uniqueRecipients = new Set(
          txs.flatMap((t) => t.recipients || (t.to ? [t.to] : []))
        );

        if (uniqueSenders.size >= 2 && uniqueRecipients.size >= 1) {
          patterns.push({
            type: 'temporal_coordination',
            severity: 'high',
            confidence: Math.min(0.9, 0.3 + txs.length * 0.04),
            description: `${txs.length} transactions executed at the same second by ${uniqueSenders.size} accounts`,
            timestamp: new Date(timestamp * 1000).toISOString(),
            transactionCount: txs.length,
            uniqueSenders: uniqueSenders.size,
            uniqueRecipients: uniqueRecipients.size,
            sampleTransactions: txs.slice(0, 5).map((t) => ({
              id: t.id,
              from: t.source_account || t.from,
              to: t.to,
              amount: t.amount,
            })),
            recommendation: 'Automated or scripted transaction execution detected',
          });
        }
      }
    }

    return patterns;
  }

  _detectSyntheticVolume(graph, transactions) {
    const patterns = [];
    if (!graph.communities) graph.detectCommunities();

    for (const [communityId, members] of graph.communities) {
      if (members.length < 4) continue;

      const communityEdges = graph.edges.filter(
        (e) => members.includes(e.source) && members.includes(e.target)
      );

      if (communityEdges.length === 0) continue;

      let totalVolume = 0;
      let txCount = 0;
      for (const edge of communityEdges) {
        totalVolume += parseFloat(edge.amount || 0);
        txCount++;
      }

      const avgVolume = totalVolume / txCount;
      const externalEdges = graph.edges.filter(
        (e) =>
          (members.includes(e.source) && !members.includes(e.target)) ||
          (!members.includes(e.source) && members.includes(e.target))
      );

      const volumeRatio = externalEdges.length > 0
        ? communityEdges.length / externalEdges.length
        : Infinity;

      if (volumeRatio > 3 && txCount > 10) {
        patterns.push({
          type: 'synthetic_volume',
          severity: 'high',
          confidence: Math.min(0.9, 0.3 + volumeRatio * 0.05),
          description: `Community of ${members.length} accounts shows ${volumeRatio.toFixed(1)}x more internal than external transactions`,
          communitySize: members.length,
          internalTxCount: txCount,
          externalTxCount: externalEdges.length,
          internalVolume: totalVolume,
          avgTransactionValue: avgVolume,
          volumeRatio,
          accounts: members,
          recommendation: 'Suspicious volume generation, possible wash trading',
        });
      }
    }

    return patterns;
  }

  getHighConfidencePatterns(minConfidence = 0.75) {
    return this.patterns.filter((p) => p.confidence >= minConfidence);
  }

  getPatternSummary() {
    const byType = {};
    for (const pattern of this.patterns) {
      if (!byType[pattern.type]) {
        byType[pattern.type] = { count: 0, totalConfidence: 0, severities: [] };
      }
      byType[pattern.type].count++;
      byType[pattern.type].totalConfidence += pattern.confidence;
      byType[pattern.type].severities.push(pattern.severity);
    }

    return Object.entries(byType).map(([type, data]) => ({
      type,
      count: data.count,
      avgConfidence: data.count > 0 ? data.totalConfidence / data.count : 0,
      maxSeverity: data.severities.includes('high')
        ? 'high'
        : data.severities.includes('medium')
          ? 'medium'
          : 'low',
    }));
  }
}

module.exports = { CoordinatedPatternDetector };
