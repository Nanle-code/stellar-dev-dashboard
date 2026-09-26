const { performance } = require('perf_hooks');

class FraudGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.adjacencyList = new Map();
    this.communities = null;
  }

  addNode(id, data = {}) {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { id, ...data, degree: 0 });
      this.adjacencyList.set(id, new Set());
    }
    return this.nodes.get(id);
  }

  addEdge(source, target, data = {}) {
    this.addNode(source);
    this.addNode(target);
    const edge = { source, target, ...data, id: `${source}-${target}-${Date.now()}` };
    this.edges.push(edge);
    this.adjacencyList.get(source).add(target);
    this.adjacencyList.get(target).add(source);
    this.nodes.get(source).degree = this.adjacencyList.get(source).size;
    this.nodes.get(target).degree = this.adjacencyList.get(target).size;
    return edge;
  }

  buildFromTransactions(transactions) {
    const start = performance.now();
    for (const tx of transactions) {
      const sender = tx.source_account || tx.from;
      const recipients = tx.recipients || (tx.to ? [tx.to] : []);
      for (const recipient of recipients) {
        this.addEdge(sender, recipient, {
          amount: tx.amount || 0,
          timestamp: tx.created_at || tx.timestamp,
          txId: tx.id,
          operationCount: tx.operation_count || 1,
        });
      }
    }
    return performance.now() - start;
  }

  detectCommunities() {
    const labels = new Map();
    const nodes = Array.from(this.nodes.keys());

    for (const id of nodes) {
      labels.set(id, id);
    }

    let changed = true;
    let iterations = 0;
    const maxIterations = 100;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      const shuffled = [...nodes].sort(() => Math.random() - 0.5);

      for (const node of shuffled) {
        const neighbors = Array.from(this.adjacencyList.get(node) || []);
        if (neighbors.length === 0) continue;

        const labelCounts = new Map();
        for (const neighbor of neighbors) {
          const label = labels.get(neighbor);
          labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
        }

        let maxCount = 0;
        let bestLabel = labels.get(node);
        for (const [label, count] of labelCounts) {
          if (count > maxCount) {
            maxCount = count;
            bestLabel = label;
          }
        }

        if (bestLabel !== labels.get(node)) {
          labels.set(node, bestLabel);
          changed = true;
        }
      }
    }

    this.communities = new Map();
    for (const [nodeId, communityId] of labels) {
      if (!this.communities.has(communityId)) {
        this.communities.set(communityId, []);
      }
      this.communities.get(communityId).push(nodeId);
    }

    return this.communities;
  }

  computePageRank(dampingFactor = 0.85, maxIterations = 100, tol = 1e-6) {
    const ranks = new Map();
    const nodeIds = Array.from(this.nodes.keys());
    const N = nodeIds.length;
    if (N === 0) return ranks;

    for (const id of nodeIds) {
      ranks.set(id, 1 / N);
    }

    for (let iter = 0; iter < maxIterations; iter++) {
      const newRanks = new Map();
      let diff = 0;

      for (const id of nodeIds) {
        let sum = 0;
        const neighbors = Array.from(this.adjacencyList.get(id) || []);
        for (const neighbor of neighbors) {
          const neighborDegree = this.nodes.get(neighbor).degree || 1;
          sum += (ranks.get(neighbor) || 0) / neighborDegree;
        }
        const newRank = (1 - dampingFactor) / N + dampingFactor * sum;
        newRanks.set(id, newRank);
        diff += Math.abs(newRank - (ranks.get(id) || 0));
      }

      ranks.clear();
      for (const [id, rank] of newRanks) {
        ranks.set(id, rank);
      }

      if (diff < tol) break;
    }

    for (const id of nodeIds) {
      this.nodes.get(id).pageRank = ranks.get(id) || 0;
    }

    return ranks;
  }

  findSuspiciousSubgraphs(minSize = 3, minDensity = 0.4) {
    if (!this.communities) this.detectCommunities();
    const suspicious = [];

    for (const [communityId, members] of this.communities) {
      if (members.length < minSize) continue;

      let internalEdges = 0;
      let totalPossible = (members.length * (members.length - 1)) / 2;
      if (totalPossible === 0) continue;

      for (const edge of this.edges) {
        if (members.includes(edge.source) && members.includes(edge.target)) {
          internalEdges++;
        }
      }

      const density = internalEdges / totalPossible;
      if (density >= minDensity) {
        const avgAmount = this._averageTransactionAmount(members);
        const circularFlow = this._detectCircularFlow(members);
        suspicious.push({
          communityId,
          members,
          size: members.length,
          density,
          avgTransactionAmount: avgAmount,
          circularFlow,
          suspiciousScore: density * (circularFlow ? 1.5 : 1.0),
        });
      }
    }

    return suspicious.sort((a, b) => b.suspiciousScore - a.suspiciousScore);
  }

  findBurstTransactions(windowMs = 60000, threshold = 5) {
    const bursts = [];
    const timeSortedEdges = [...this.edges].sort(
      (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
    );

    let window = [];
    for (const edge of timeSortedEdges) {
      const edgeTime = new Date(edge.timestamp || 0).getTime();
      window.push(edge);

      while (window.length > 0) {
        const firstTime = new Date(window[0].timestamp || 0).getTime();
        if (edgeTime - firstTime > windowMs) {
          window.shift();
        } else {
          break;
        }
      }

      if (window.length >= threshold) {
        const participants = new Set();
        for (const w of window) {
          participants.add(w.source);
          participants.add(w.target);
        }
        bursts.push({
          timeWindow: {
            start: window[0].timestamp,
            end: edge.timestamp,
          },
          transactionCount: window.length,
          uniqueParticipants: participants.size,
          transactions: [...window],
        });
      }
    }

    return bursts;
  }

  shortestPath(source, target, maxDepth = 6) {
    if (!this.nodes.has(source) || !this.nodes.has(target)) return null;
    if (source === target) return [source];

    const queue = [[source]];
    const visited = new Set([source]);

    while (queue.length > 0) {
      const path = queue.shift();
      const node = path[path.length - 1];

      if (path.length > maxDepth) continue;

      const neighbors = Array.from(this.adjacencyList.get(node) || []);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const newPath = [...path, neighbor];
          if (neighbor === target) return newPath;
          visited.add(neighbor);
          queue.push(newPath);
        }
      }
    }

    return null;
  }

  findMutualConnections(node1, node2) {
    const n1Neighbors = this.adjacencyList.get(node1) || new Set();
    const n2Neighbors = this.adjacencyList.get(node2) || new Set();
    const mutual = [];
    for (const neighbor of n1Neighbors) {
      if (n2Neighbors.has(neighbor)) {
        mutual.push(neighbor);
      }
    }
    return mutual;
  }

  getNetworkStats() {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      averageDegree: this.nodes.size > 0
        ? Array.from(this.nodes.values()).reduce((s, n) => s + n.degree, 0) / this.nodes.size
        : 0,
      communityCount: this.communities ? this.communities.size : 0,
      density: this.nodes.size > 1
        ? (2 * this.edges.length) / (this.nodes.size * (this.nodes.size - 1))
        : 0,
    };
  }

  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      stats: this.getNetworkStats(),
      communities: this.communities
        ? Array.from(this.communities.entries()).map(([id, members]) => ({
            id,
            members,
            size: members.length,
          }))
        : [],
    };
  }

  _averageTransactionAmount(members) {
    const memberSet = new Set(members);
    let total = 0;
    let count = 0;
    for (const edge of this.edges) {
      if (memberSet.has(edge.source) && memberSet.has(edge.target)) {
        total += parseFloat(edge.amount || 0);
        count++;
      }
    }
    return count > 0 ? total / count : 0;
  }

  _detectCircularFlow(members) {
    const memberSet = new Set(members);
    if (members.length < 3) return false;

    const subEdges = this.edges.filter(
      (e) => memberSet.has(e.source) && memberSet.has(e.target)
    );

    const visited = new Set();
    const recStack = new Set();

    const dfs = (node) => {
      visited.add(node);
      recStack.add(node);

      const neighbors = subEdges
        .filter((e) => e.source === node)
        .map((e) => e.target);

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const member of members) {
      if (!visited.has(member)) {
        if (dfs(member)) return true;
      }
    }

    return false;
  }
}

function buildFraudGraph(transactions) {
  const graph = new FraudGraph();
  graph.buildFromTransactions(transactions);
  graph.detectCommunities();
  graph.computePageRank();
  return graph;
}

module.exports = { FraudGraph, buildFraudGraph };
